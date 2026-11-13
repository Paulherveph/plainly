/** Who is asking, for budget decisions. Paid users keep working longer. */
export type Tier = "guest" | "free" | "paid";

export type BudgetState = "ok" | "degrade" | "capacity";

/**
 * TOKEN_ECONOMY section 7. At 80% Guest and Free go to the cheaper variant and deep chat pauses;
 * at 100% they stop; paid users continue until 150%.
 */
export function budgetState(spendMicros: number, budgetUsd: number, tier: Tier): BudgetState {
  const ratio = spendMicros / (budgetUsd * 1_000_000);
  if (tier === "paid") return ratio >= 1.5 ? "capacity" : "ok";
  if (ratio >= 1) return "capacity";
  if (ratio >= 0.8) return "degrade";
  return "ok";
}

/** Alert thresholds crossed (0.8 and 1.0), each sent at most once per UTC day. */
export function alertLevel(spendMicros: number, budgetUsd: number): 80 | 100 | null {
  const ratio = spendMicros / (budgetUsd * 1_000_000);
  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return 80;
  return null;
}

export const RATE_LIMIT_PER_MINUTE = 20;
