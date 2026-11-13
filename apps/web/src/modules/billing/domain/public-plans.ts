/**
 * Plan facts shown on static marketing pages (no database read at build time). They must match the
 * `plans` seed in supabase/migrations/20261114300000_credits_billing.sql; a test checks the pairing.
 */
export const PUBLIC_PLANS = {
  guest: { credits: 8, maxPages: 5 },
  free: { credits: 24, maxPages: 10 },
  pro: { priceMonthCents: 1200, priceYearCents: 9900, credits: 400, maxPages: 40 },
  pack: { priceCents: 500, credits: 200 },
} as const;
