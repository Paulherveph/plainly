import "server-only";
import {
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  Output,
  streamText,
} from "ai";
import type { z } from "zod";
import { latestChannel } from "@/shared/lib/latest-channel";
import { logError } from "@/shared/lib/log";
import { err, ok } from "@/shared/lib/result";
import type {
  AiCall,
  AiGateway,
  AiMessage,
  AiResult,
  AiStream,
  AiUsage,
  FlagReader,
  Profile,
  UsageRecorder,
} from "../application/ports";
import { type AiError, classifyFailure, type FailureAction, terminalError } from "../domain/errors";
import {
  costMicros,
  type ModelRef,
  modelKey,
  type ProviderName,
  parseModelRef,
  priceFor,
  type TokenUsage,
  ZERO_USAGE,
} from "../domain/pricing";

const MAX_ATTEMPTS = 3; // primary + at most 2 fallbacks (a repair retry counts as an attempt)
const DEGRADED_MS = 60_000;
const DEFAULT_TIMEOUT_MS: Record<Profile, number> = {
  analysis: 150_000,
  chat: 60_000,
  chat_deep: 90_000,
  fast: 45_000,
  translate: 60_000,
};
const REPAIR_NOTE =
  "Your previous reply did not match the required JSON schema. Reply again with JSON that matches it exactly.";

/** Lives for the whole server instance (the gateway itself is built per request). */
export type GatewayState = {
  degradedUntil: Map<ProviderName, number>;
  disabled: Set<ProviderName>;
  factories: Map<ProviderName, Promise<(id: string) => LanguageModel>>;
};

export const createGatewayState = (): GatewayState => ({
  degradedUntil: new Map(),
  disabled: new Set(),
  factories: new Map(),
});

type Deps = {
  state: GatewayState;
  profiles: Record<Profile, ModelRef[]>;
  allowed: readonly ProviderName[];
  keys: Partial<Record<ProviderName, string>>;
  usage: UsageRecorder;
  flags: FlagReader;
};

type AttemptOutput<T> = { value: T; usage: LanguageModelUsage | null };
type Attempt<T> = (
  model: LanguageModel,
  messages: ModelMessage[],
  signal: AbortSignal,
) => Promise<AttemptOutput<T>>;

/**
 * Resolves a profile to an ordered model list, falls back on provider errors, keeps an
 * in-memory circuit breaker, sets cache breakpoints, and writes one ai_usage row per attempt.
 */
export class AiSdkGateway implements AiGateway {
  private readonly degradedUntil: Map<ProviderName, number>;
  private readonly disabled: Set<ProviderName>;
  private readonly factories: Map<ProviderName, Promise<(id: string) => LanguageModel>>;

  constructor(private readonly deps: Deps) {
    this.degradedUntil = deps.state.degradedUntil;
    this.disabled = deps.state.disabled;
    this.factories = deps.state.factories;
  }

  streamObject<T>(call: AiCall & { schema: z.ZodType<T> }): AiStream<T> {
    const channel = latestChannel<unknown>();
    const final = this.run<T>(call, async (model, messages, signal) => {
      let streamError: unknown = null;
      const result = streamText({
        model,
        instructions: call.system,
        messages,
        output: Output.object({ schema: call.schema }),
        maxOutputTokens: call.maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
        onError: ({ error }) => {
          streamError = error;
        },
      });
      for await (const partial of result.partialOutputStream) channel.push(partial);
      const value = await Promise.resolve(result.output).catch((e: unknown) => {
        throw streamError ?? e;
      });
      const finishReason = await Promise.resolve(result.finishReason).catch(() => null);
      if (finishReason === "content-filter") throw new RefusalSignal();
      const usage = await Promise.resolve(result.totalUsage).catch(() => null);
      return { value: call.schema.parse(value), usage };
    }).finally(() => channel.close());
    return { partials: channel, final };
  }

  generateObject<T>(call: AiCall & { schema: z.ZodType<T> }): Promise<AiResult<T>> {
    return this.run<T>(call, async (model, messages, signal) => {
      const result = await generateText({
        model,
        instructions: call.system,
        messages,
        output: Output.object({ schema: call.schema }),
        maxOutputTokens: call.maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
      });
      if (result.finishReason === "content-filter") throw new RefusalSignal();
      return { value: call.schema.parse(result.output), usage: result.totalUsage };
    });
  }

  generateText(call: AiCall): Promise<AiResult<string>> {
    return this.run<string>(call, async (model, messages, signal) => {
      const result = await generateText({
        model,
        instructions: call.system,
        messages,
        maxOutputTokens: call.maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
      });
      if (result.finishReason === "content-filter") throw new RefusalSignal();
      return { value: result.text, usage: result.totalUsage };
    });
  }

  private async run<T>(call: AiCall, attempt: Attempt<T>): Promise<AiResult<T>> {
    if (inputChars(call) > call.maxInputChars) return err({ kind: "context_too_long" });
    const candidates = await this.candidates(call);
    if (!Array.isArray(candidates)) return err(candidates);

    const deadline = Date.now() + (call.timeoutMs ?? DEFAULT_TIMEOUT_MS[call.profile]);
    const base = toModelMessages(call.messages);
    let attempts = 0;
    let lastError: AiError = { kind: "unavailable" };

    for (const ref of candidates) {
      let messages = base;
      let repaired = false;
      while (attempts < MAX_ATTEMPTS) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return err(lastError);
        attempts++;
        const signal = call.signal
          ? AbortSignal.any([call.signal, AbortSignal.timeout(remaining)])
          : AbortSignal.timeout(remaining);
        const startedAt = Date.now();
        try {
          const model = (await this.factory(ref.provider))(ref.model);
          const out = await attempt(model, messages, signal);
          const tokens = toTokens(out.usage);
          const usage = this.usageOf(ref, tokens, attempts);
          await this.record(call, ref, tokens, usage.costMicros, Date.now() - startedAt, "ok", null);
          return ok({ value: out.value, usage });
        } catch (error) {
          const action = this.actionFor(error, call.signal);
          await this.record(
            call,
            ref,
            ZERO_USAGE,
            0,
            Date.now() - startedAt,
            action === "aborted" ? "aborted" : "failed",
            action,
          );
          lastError = terminalError(action);
          if (action === "aborted" || action === "refused" || action === "context_too_long")
            return err(lastError);
          if (action === "repair" && !repaired) {
            repaired = true;
            messages = [...base, { role: "user", content: REPAIR_NOTE }];
            continue;
          }
          if (action === "disable_provider") {
            this.disabled.add(ref.provider);
            logError("ai.provider_disabled", { provider: ref.provider });
          } else if (action === "next_model") {
            this.degradedUntil.set(ref.provider, Date.now() + DEGRADED_MS);
          }
          break; // next model
        }
      }
      if (attempts >= MAX_ATTEMPTS) break;
    }
    return err(lastError.kind === "invalid_output" ? lastError : { kind: "unavailable" });
  }

  /** Profile list after flags, allow-list, disabled providers and the circuit breaker. */
  private async candidates(call: AiCall): Promise<ModelRef[] | AiError> {
    if ((await this.deps.flags.get("ai_enabled")) === false) return { kind: "capacity" };
    const override = await this.deps.flags.get(`profile_override:${call.profile}`);
    const fromFlag =
      typeof override === "string"
        ? override
            .split(",")
            .map(parseModelRef)
            .filter((r): r is ModelRef => r !== null && priceFor(r) !== null)
        : [];
    let list = fromFlag.length > 0 ? fromFlag : this.deps.profiles[call.profile];
    if (call.degraded)
      list = [...list].sort((a, b) => (priceFor(a)?.inputPerM ?? 0) - (priceFor(b)?.inputPerM ?? 0));

    const usable: ModelRef[] = [];
    for (const ref of list) {
      if (!this.deps.allowed.includes(ref.provider) || this.disabled.has(ref.provider)) continue;
      if ((await this.deps.flags.get(`provider_disabled:${ref.provider}`)) === true) continue;
      usable.push(ref);
    }
    const now = Date.now();
    const healthy = (r: ModelRef) => (this.degradedUntil.get(r.provider) ?? 0) <= now;
    // Degraded providers move to the end instead of disappearing (the breaker is advisory).
    const ordered = [...usable.filter(healthy), ...usable.filter((r) => !healthy(r))].slice(
      call.startAt ?? 0,
    );
    return ordered.length > 0 ? ordered : { kind: "unavailable" };
  }

  /** Provider state for /api/health and /admin. Never includes keys. */
  health(): { provider: ProviderName; state: "ok" | "degraded" | "disabled" }[] {
    const now = Date.now();
    return this.deps.allowed.map((provider) => ({
      provider,
      state: this.disabled.has(provider)
        ? "disabled"
        : (this.degradedUntil.get(provider) ?? 0) > now
          ? "degraded"
          : "ok",
    }));
  }

  private factory(provider: ProviderName): Promise<(id: string) => LanguageModel> {
    let f = this.factories.get(provider);
    if (!f) {
      f = loadProvider(provider, this.deps.keys[provider]);
      this.factories.set(provider, f);
    }
    return f;
  }

  private actionFor(error: unknown, userSignal?: AbortSignal): FailureAction {
    if (error instanceof RefusalSignal) return "refused";
    const e = unwrap(error);
    return classifyFailure({
      aborted: userSignal?.aborted === true,
      status: e.statusCode,
      name: e.name,
      message: e.message,
    });
  }

  private usageOf(ref: ModelRef, tokens: TokenUsage, attempts: number): AiUsage {
    const price = priceFor(ref);
    return {
      ...tokens,
      costMicros: price ? costMicros(tokens, price) : 0,
      provider: ref.provider,
      model: ref.model,
      attempts,
    };
  }

  private async record(
    call: AiCall,
    ref: ModelRef,
    tokens: TokenUsage,
    cost: number,
    latencyMs: number,
    status: "ok" | "failed" | "aborted",
    errorKind: string | null,
  ): Promise<void> {
    try {
      await this.deps.usage.record({
        ...tokens,
        userId: call.userId,
        documentId: call.documentId ?? null,
        requestId: call.requestId,
        profile: call.profile,
        provider: ref.provider,
        model: ref.model,
        costMicros: cost,
        latencyMs,
        status,
        errorKind,
      });
    } catch {
      logError("ai.usage_record_failed", { requestId: call.requestId, model: modelKey(ref) });
    }
  }
}

class RefusalSignal extends Error {
  override name = "RefusalSignal";
}

/** Adding a provider: install its package, add a case here, a price row and an env key. */
async function loadProvider(
  provider: ProviderName,
  apiKey: string | undefined,
): Promise<(id: string) => LanguageModel> {
  switch (provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({ apiKey });
      return (id) => anthropic(id);
    }
  }
}

const CACHE = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

function toModelMessages(messages: AiMessage[]): ModelMessage[] {
  return messages.map((m): ModelMessage => {
    if (typeof m.content === "string") return { role: m.role, content: m.content } as ModelMessage;
    if (m.role === "assistant")
      return { role: "assistant", content: m.content.map((p) => (p.type === "text" ? p.text : "")).join("") };
    return {
      role: "user",
      content: m.content.map((p) => {
        const providerOptions = p.cache ? CACHE : undefined;
        return p.type === "text"
          ? { type: "text" as const, text: p.text, providerOptions }
          : { type: "file" as const, mediaType: p.mediaType, data: p.data, providerOptions };
      }),
    };
  });
}

function inputChars(call: AiCall): number {
  let n = call.system.length;
  for (const m of call.messages) {
    if (typeof m.content === "string") n += m.content.length;
    else for (const p of m.content) if (p.type === "text") n += p.text.length;
  }
  return n;
}

function toTokens(u: LanguageModelUsage | null): TokenUsage {
  if (!u) return ZERO_USAGE;
  return {
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    cacheReadTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: u.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}

function unwrap(error: unknown): { statusCode?: number; name?: string; message?: string } {
  const e = error as { lastError?: unknown; statusCode?: number; name?: string; message?: string } | null;
  if (e && typeof e === "object" && "lastError" in e && e.lastError) return unwrap(e.lastError);
  return { statusCode: e?.statusCode, name: e?.name, message: e?.message };
}
