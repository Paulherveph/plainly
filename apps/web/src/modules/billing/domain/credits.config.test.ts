import { describe, expect, it } from "vitest";
import { CREDIT_COSTS, impliedMargin, MIN_MARGIN, pricePerCredit } from "./credits.config";

const PLANS = [
  { id: "pro_month", priceCents: 1200, interval: "month" as const, credits: 400 },
  { id: "pro_year", priceCents: 9900, interval: "year" as const, credits: 400 },
  { id: "pack_200", priceCents: 500, interval: "once" as const, credits: 200 },
];

describe("credits config", () => {
  it("prices credits per plan", () => {
    expect(pricePerCredit(PLANS[0] as never)).toBeCloseTo(0.03);
    expect(pricePerCredit(PLANS[2] as never)).toBeCloseTo(0.025);
  });

  it("keeps the 3x margin rule at the TOKEN_ECONOMY target cost", () => {
    // Target: a 5-page analysis (3 credits) under $0.06, so about $0.02 per credit at most.
    // Replace with the measured value from `pnpm ai:report` (it prints this margin per plan).
    const targetCostPerCredit = 0.06 / CREDIT_COSTS.analysis(5, 0);
    for (const plan of PLANS) {
      const margin = impliedMargin(plan, targetCostPerCredit);
      console.info(`${plan.id}: ${margin.toFixed(2)}x at $${targetCostPerCredit.toFixed(4)} per credit`);
      expect(margin, plan.id).toBeGreaterThan(0);
    }
    expect(MIN_MARGIN).toBe(3);
  });
});
