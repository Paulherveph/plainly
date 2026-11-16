import { impliedMargin, MIN_MARGIN } from "@/modules/billing/domain/credits.config";
import { PUBLIC_PLANS } from "@/modules/billing/domain/public-plans";

/**
 * Implied margin per plan from measured cost (docs/TOKEN_ECONOMY.md section 5):
 * price per credit must be at least 3 times the provider cost per credit.
 */
export function impliedMargins(analysisCostUsd: number, chatCostUsd: number): string[] {
  if (analysisCostUsd === 0 && chatCostUsd === 0) return ["No measured cost yet: run some analyses first."];
  // A 5-page analysis costs 3 credits; a chat message costs 1. Take the worse of the two.
  const perCredit = Math.max(analysisCostUsd / 3, chatCostUsd);
  const plans = [
    {
      id: "pro_month",
      priceCents: PUBLIC_PLANS.pro.priceMonthCents,
      interval: "month" as const,
      credits: PUBLIC_PLANS.pro.credits,
    },
    {
      id: "pro_year",
      priceCents: PUBLIC_PLANS.pro.priceYearCents,
      interval: "year" as const,
      credits: PUBLIC_PLANS.pro.credits,
    },
    {
      id: "pack_200",
      priceCents: PUBLIC_PLANS.pack.priceCents,
      interval: "once" as const,
      credits: PUBLIC_PLANS.pack.credits,
    },
  ];
  const lines = [`Provider cost per credit: $${perCredit.toFixed(4)}`];
  for (const p of plans) {
    const m = impliedMargin(p, perCredit);
    lines.push(
      `${p.id}: ${m.toFixed(1)}x ${m < MIN_MARGIN ? "(UNDER 3x: change price, caps or models)" : "(ok)"}`,
    );
  }
  return lines;
}
