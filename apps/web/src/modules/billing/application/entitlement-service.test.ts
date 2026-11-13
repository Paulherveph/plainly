import { describe, expect, it, vi } from "vitest";
import { ok } from "@/shared/lib/result";
import { Entitlements } from "../domain/entitlements";
import { makeEntitlements, shouldNudge } from "./entitlement-service";
import type { CreditStore, PlanReader } from "./ports";

function setup(planId: string, ent: Partial<Entitlements>, available: number, holdId: string | null = "h") {
  const plans: PlanReader = {
    myPlan: async () => ok({ planId, entitlements: Entitlements.parse({ credits: 24, ...ent }), emailVerified: true }),
    listPlans: async () => ok([]),
  };
  const credits: CreditStore = {
    balance: async () =>
      ok({ planId, planCredits: available, packCredits: 0, planTotal: 24, periodEnd: null, lowNudged: false, emailVerified: true }),
    reserve: vi.fn(async () => ok({ holdId, available })),
    settle: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    ledger: async () => ok([]),
    markLowNudged: async () => {},
  };
  return { service: makeEntitlements({ plans, credits }), credits };
}

describe("EntitlementService", () => {
  it("F03: a reservation without enough credits is a typed error with the cost", async () => {
    const { service } = setup("free", {}, 2, null);
    expect(await service.credits.reserve({ userId: "u", amount: 5, key: "k" })).toEqual({
      ok: false,
      error: { kind: "insufficient_credits", needed: 5, available: 2 },
    });
  });

  it("F06: a 0-credit action never touches the ledger", async () => {
    const { service, credits } = setup("free", {}, 0);
    expect(await service.credits.reserve({ userId: "u", amount: 0, key: "k" })).toEqual(ok({ holdId: null }));
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it("A19/I02: concurrency comes from the plan", async () => {
    expect(await setup("pro_month", { concurrency: 3 }, 100).service.tiers.tier("u")).toEqual({
      tier: "paid",
      maxConcurrentAnalyses: 3,
    });
  });

  it("C15: deep chat needs a plan that includes it", async () => {
    expect((await setup("free", { deepChat: false }, 24).service.canUseDeepChat()).ok).toBe(false);
    expect((await setup("pro_month", { deepChat: true }, 24).service.canUseDeepChat()).ok).toBe(true);
  });

  it("nudges at 20% left, once per period", () => {
    const b = { planId: "free", planCredits: 4, packCredits: 0, planTotal: 24, periodEnd: null, lowNudged: false, emailVerified: true };
    expect(shouldNudge(b)).toBe(true);
    expect(shouldNudge({ ...b, lowNudged: true })).toBe(false);
    expect(shouldNudge({ ...b, planCredits: 10 })).toBe(false);
  });
});
