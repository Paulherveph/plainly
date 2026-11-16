/**
 * Provider prices per million tokens, in USD. One row per "provider:model".
 * Fill only from the provider's pricing page (never from memory) and update `verifiedOn`.
 * A model without a row is rejected by the env validator, so cost is never recorded as zero.
 */
export const SUPPORTED_PROVIDERS = ["anthropic", "google", "ollama", "xai"] as const;
export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

export type ModelRef = { provider: ProviderName; model: string };

export type Price = {
  inputPerM: number;
  outputPerM: number;
  /** Cache write (Anthropic 5-minute TTL is 1.25x input). */
  cacheWritePerM: number;
  cacheReadPerM: number;
  verifiedOn: string;
  /** Date of the last `pnpm ai:eval` run that passed the promotion thresholds, if any. */
  evalPassedOn: string | null;
};

const anthropic = (input: number, output: number, cacheRead: number, verifiedOn: string): Price => ({
  inputPerM: input,
  outputPerM: output,
  cacheWritePerM: input * 1.25,
  cacheReadPerM: cacheRead,
  verifiedOn,
  evalPassedOn: null,
});

/** Providers with no cache-write fee: a cache write costs the normal input price. */
const noWriteFee = (input: number, output: number, cacheRead: number, verifiedOn: string): Price => ({
  inputPerM: input,
  outputPerM: output,
  cacheWritePerM: input,
  cacheReadPerM: cacheRead,
  verifiedOn,
  evalPassedOn: null,
});

export const PRICES: Readonly<Record<string, Price>> = {
  // Source: Anthropic model table (claude-api reference, cached 2026-11-03).
  "anthropic:claude-opus-5-5": anthropic(4, 20, 0.2, "2026-11-03"),
  "anthropic:claude-sonnet-5-5": anthropic(2, 10, 0.1, "2026-11-03"),
  "anthropic:claude-haiku-5-5": anthropic(0.1, 0.5, 0.01, "2026-11-03"),
  // Source: docs.x.ai/docs/models, prompts under 200k tokens (Plainly's input budgets stay far below).
  "xai:grok-4.7": noWriteFee(2, 6, 0.5, "2026-11-16"),
  "xai:grok-4.3": noWriteFee(1.25, 2.5, 0.2, "2026-11-16"),
  // Source: aistudio.google.com/docs/pricing, paid tier. 3.8 Flash uses the standard rate that starts
  // 2027-01-01 (the launch rate until then is half), so recorded cost never runs low.
  "google:gemini-3.8-flash": noWriteFee(1.5, 7.5, 0.15, "2026-11-16"),
  "google:gemini-3.5-flash-lite": noWriteFee(0.3, 2.5, 0.03, "2026-11-16"),
};

export const modelKey = (ref: ModelRef): string => `${ref.provider}:${ref.model}`;

/**
 * Ollama has no per-token price: local models run on your hardware, Ollama Cloud is a flat plan.
 * One zero price covers every Ollama model, so any `ollama:<model>` works without a table row.
 * It has no eval date, so production still refuses it until `pnpm ai:eval` passes.
 */
export const OLLAMA_PRICE: Price = {
  inputPerM: 0,
  outputPerM: 0,
  cacheWritePerM: 0,
  cacheReadPerM: 0,
  verifiedOn: "2026-11-16",
  evalPassedOn: null,
};

export function priceFor(ref: ModelRef): Price | null {
  if (ref.provider === "ollama") return OLLAMA_PRICE;
  return PRICES[modelKey(ref)] ?? null;
}

/** Parses "anthropic:claude-haiku-5-5" or "ollama:qwen3:8b" (the model keeps its own colons). Returns null for unknown providers or empty models. */
export function parseModelRef(value: string): ModelRef | null {
  const [provider, ...rest] = value.trim().split(":");
  const model = rest.join(":");
  if (!model || !(SUPPORTED_PROVIDERS as readonly string[]).includes(provider ?? "")) return null;
  return { provider: provider as ProviderName, model };
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/**
 * Cost in micro-USD (1e-6 USD). A price "per million tokens" equals micro-USD per token.
 * `inputTokens` is the total input, including cached reads and writes.
 */
export function costMicros(usage: TokenUsage, price: Price): number {
  const uncached = Math.max(0, usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens);
  return Math.round(
    uncached * price.inputPerM +
      usage.cacheWriteTokens * price.cacheWritePerM +
      usage.cacheReadTokens * price.cacheReadPerM +
      usage.outputTokens * price.outputPerM,
  );
}

/** Rough token estimate for budgeting before a call (about 4 characters per token). */
export const estimateTokens = (chars: number): number => Math.ceil(chars / 4);

/** Public names for the privacy page. It lists exactly the enabled providers (G07). */
export const PROVIDER_LABELS: Record<ProviderName, string> = {
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini API)",
  ollama: "Ollama (self-hosted or Ollama Cloud)",
  xai: "xAI (Grok)",
};

export function providerList(allowed: readonly ProviderName[]): string {
  return allowed.map((p) => PROVIDER_LABELS[p]).join(", ");
}
