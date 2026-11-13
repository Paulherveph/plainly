/**
 * Provider prices per million tokens, in USD. One row per "provider:model".
 * Fill only from the provider's pricing page (never from memory) and update `verifiedOn`.
 * A model without a row is rejected by the env validator, so cost is never recorded as zero.
 */
export const SUPPORTED_PROVIDERS = ["anthropic"] as const;
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

export const PRICES: Readonly<Record<string, Price>> = {
  // Source: Anthropic model table (claude-api reference, cached 2026-11-03).
  "anthropic:claude-opus-5-5": anthropic(4, 20, 0.2, "2026-11-03"),
  "anthropic:claude-sonnet-5-5": anthropic(2, 10, 0.1, "2026-11-03"),
  "anthropic:claude-haiku-5-5": anthropic(0.1, 0.5, 0.01, "2026-11-03"),
};

export const modelKey = (ref: ModelRef): string => `${ref.provider}:${ref.model}`;

export function priceFor(ref: ModelRef): Price | null {
  return PRICES[modelKey(ref)] ?? null;
}

/** Parses "anthropic:claude-haiku-5-5". Returns null for unknown providers or empty models. */
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

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

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
};

export function providerList(allowed: readonly ProviderName[]): string {
  return allowed.map((p) => PROVIDER_LABELS[p]).join(", ");
}
