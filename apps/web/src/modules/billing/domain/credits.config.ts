import { analysisCredits } from "@/modules/analysis/domain/credits";

/**
 * Every credit constant in one place (docs/TOKEN_ECONOMY.md section 5). Calibrate after measuring:
 * price per credit must be at least 3 times the measured provider cost per credit.
 */
export const CREDIT_COSTS = {
  analysis: analysisCredits,
  chat: 1,
  chatDeep: 3,
  extraLocale: 1,
  /** Cache hits, samples and failed calls. */
  free: 0,
} as const;

export const MIN_MARGIN = 3;
/** Show the cost before starting when an analysis costs more than this. */
export const CONFIRM_ABOVE = 5;
/** Low-credit nudge at 20% left, once per period. */
export const LOW_CREDIT_RATIO = 0.2;

export type PlanPrice = { id: string; priceCents: number; interval: "month" | "year" | "once"; credits: number };

/** Revenue per credit for a paid plan or pack (a yearly plan grants credits monthly). */
export function pricePerCredit(p: PlanPrice): number {
  const months = p.interval === "year" ? 12 : 1;
  return p.priceCents / 100 / (p.credits * months);
}

/** Implied margin: revenue per credit divided by provider cost per credit. */
export function impliedMargin(p: PlanPrice, costPerCreditUsd: number): number {
  return costPerCreditUsd > 0 ? pricePerCredit(p) / costPerCreditUsd : Number.POSITIVE_INFINITY;
}
