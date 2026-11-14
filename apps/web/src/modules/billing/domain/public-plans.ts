/**
 * Plan facts shown on static marketing pages (no database read at build time). They must match the
 * `plans` seed in supabase/migrations (20261114300000_credits_billing.sql, then 20261114500000_plans_max.sql);
 * a test checks the pairing. Guest is the no-account trial: it has limits but no pricing card.
 */
export const PUBLIC_PLANS = {
  guest: { credits: 8, maxPages: 5 },
  free: { credits: 24, maxPages: 10, maxMb: 10, retentionDays: 30, concurrency: 1 },
  pro: {
    priceMonthCents: 1200,
    priceYearCents: 12000,
    credits: 400,
    maxPages: 40,
    maxMb: 20,
    retentionDays: 180,
    concurrency: 3,
  },
  max: {
    priceMonthCents: 3900,
    priceYearCents: 39000,
    credits: 1500,
    maxPages: 100,
    maxMb: 30,
    retentionDays: 365,
    concurrency: 5,
  },
  pack: { priceCents: 500, credits: 200 },
} as const;

/** Yearly price is ten months; the page shows the saving as a whole percentage. */
export function yearlySavingPercent(plan: { priceMonthCents: number; priceYearCents: number }): number {
  return Math.round((1 - plan.priceYearCents / (plan.priceMonthCents * 12)) * 100);
}
