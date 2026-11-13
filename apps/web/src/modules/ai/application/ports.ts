import type { z } from "zod";
import type { Result } from "@/shared/lib/result";
import type { AiError } from "../domain/errors";
import type { TokenUsage } from "../domain/pricing";

/** A task class. Each maps to an ordered model list from `AI_PROFILE_*`. */
export type Profile = "analysis" | "chat" | "chat_deep" | "fast" | "translate";

/** `cache: true` marks the end of a stable prefix (prompt-cache breakpoint). */
export type AiPart =
  | { type: "text"; text: string; cache?: boolean }
  | { type: "file"; mediaType: string; data: Uint8Array; cache?: boolean };

export type AiMessage = { role: "user" | "assistant"; content: string | AiPart[] };

/** What the call is for. Lets fakes answer deterministically; never sent to a provider. */
export type AiTask = "analyze" | "classify" | "transcribe" | "chat" | "summarize_history" | "translate" | "eval";

export type AiCall = {
  profile: Profile;
  task: AiTask;
  /** Stable instructions. Never contains document text. */
  system: string;
  messages: AiMessage[];
  maxOutputTokens: number;
  /** Rejected before any provider call when the text input is longer. */
  maxInputChars: number;
  requestId: string;
  userId: string | null;
  documentId?: string | null;
  signal?: AbortSignal;
  /** Total wall time across all attempts. */
  timeoutMs?: number;
  /** Route to the cheapest model of the profile (budget guard at 80%). */
  degraded?: boolean;
  /** Skip the first n models of the profile (B08: retry on the next model). */
  startAt?: number;
};

export type AiUsage = TokenUsage & {
  costMicros: number;
  provider: string;
  model: string;
  /** Attempts made, including fallbacks and the repair retry. */
  attempts: number;
};

export type AiOk<T> = { value: T; usage: AiUsage };
export type AiResult<T> = Result<AiOk<T>, AiError>;

export type AiStream<T> = {
  /** Full partial snapshots (not deltas). Unverified, for display only. Restarts on fallback. */
  partials: AsyncIterable<unknown>;
  /** Settles even if nobody reads `partials` (the job keeps running after a disconnect). */
  final: Promise<AiResult<T>>;
};

/** The only way the app talks to AI providers. */
export interface AiGateway {
  streamObject<T>(call: AiCall & { schema: z.ZodType<T> }): AiStream<T>;
  generateObject<T>(call: AiCall & { schema: z.ZodType<T> }): Promise<AiResult<T>>;
  generateText(call: AiCall): Promise<AiResult<string>>;
}

export type UsageRow = TokenUsage & {
  userId: string | null;
  documentId: string | null;
  requestId: string;
  profile: Profile;
  provider: string;
  model: string;
  costMicros: number;
  latencyMs: number;
  status: "ok" | "failed" | "aborted" | "cache_hit";
  errorKind: string | null;
};

export interface UsageRecorder {
  record(row: UsageRow): Promise<void>;
  spendTodayMicros(): Promise<number>;
}

/** Runtime switches from `feature_flags` (cached about 30 s). */
export interface FlagReader {
  get(key: string): Promise<unknown>;
}

export interface FlagStore extends FlagReader {
  all(): Promise<Map<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
}

export type { Mailer } from "@/shared/lib/mailer";
