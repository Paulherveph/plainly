import type { z } from "zod";
import { latestChannel } from "@/shared/lib/latest-channel";
import { err, ok } from "@/shared/lib/result";
import type { AiCall, AiGateway, AiResult, AiStream, AiUsage, UsageRecorder } from "../application/ports";
import type { AiError } from "../domain/errors";
import { ZERO_USAGE } from "../domain/pricing";

export type FakeReply = { value: unknown; partials?: unknown[] };
export type FakeResponder = (call: AiCall) => FakeReply | Promise<FakeReply>;

/** Per model attempt: "fail" simulates a provider outage, "invalid" a schema miss. */
export type FakeScript = { failModels?: ReadonlySet<string>; error?: AiError["kind"] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic, free gateway for unit tests, E2E and load tests (USE_FAKE_AI=true).
 * It meters like the real one (model "fake", zero cost), so ai_usage and credits behave the same.
 */
export class FakeAiGateway implements AiGateway {
  readonly calls: AiCall[] = [];

  constructor(
    private readonly respond: FakeResponder,
    private readonly opts: { usage?: UsageRecorder; stepMs?: number; script?: FakeScript; models?: string[] } = {},
  ) {}

  streamObject<T>(call: AiCall & { schema: z.ZodType<T> }): AiStream<T> {
    const channel = latestChannel<unknown>();
    const stepMs = this.opts.stepMs ?? 0;
    const final = this.run<T>(call, async (reply) => {
      for (const partial of reply.partials ?? []) {
        if (call.signal?.aborted) throw new DOMException("aborted", "AbortError");
        channel.push(partial);
        if (stepMs) await sleep(stepMs);
      }
      return call.schema.parse(reply.value);
    }).finally(() => channel.close());
    return { partials: channel, final };
  }

  generateObject<T>(call: AiCall & { schema: z.ZodType<T> }): Promise<AiResult<T>> {
    return this.run<T>(call, async (reply) => call.schema.parse(reply.value));
  }

  generateText(call: AiCall): Promise<AiResult<string>> {
    return this.run<string>(call, async (reply) => String(reply.value));
  }

  private async run<T>(call: AiCall, produce: (reply: FakeReply) => Promise<T>): Promise<AiResult<T>> {
    this.calls.push(call);
    const models = this.opts.models ?? ["fake"];
    let attempts = 0;
    for (const model of models) {
      attempts++;
      if (this.opts.script?.failModels?.has(model)) {
        await this.record(call, model, "failed", "next_model");
        continue;
      }
      if (this.opts.script?.error) {
        await this.record(call, model, "failed", this.opts.script.error);
        return err({ kind: this.opts.script.error });
      }
      try {
        const value = await produce(await this.respond(call));
        await this.record(call, model, "ok", null);
        const usage: AiUsage = { ...ZERO_USAGE, costMicros: 0, provider: "fake", model, attempts };
        return ok({ value, usage });
      } catch (error) {
        const aborted = call.signal?.aborted === true;
        await this.record(call, model, aborted ? "aborted" : "failed", aborted ? "aborted" : "repair");
        return err({ kind: aborted ? "aborted" : "invalid_output" });
      }
    }
    return err({ kind: "unavailable" });
  }

  private async record(call: AiCall, model: string, status: "ok" | "failed" | "aborted", errorKind: string | null) {
    await this.opts.usage?.record({
      ...ZERO_USAGE,
      userId: call.userId,
      documentId: call.documentId ?? null,
      requestId: call.requestId,
      profile: call.profile,
      provider: "fake",
      model,
      costMicros: 0,
      latencyMs: 0,
      status,
      errorKind,
    });
  }
}
