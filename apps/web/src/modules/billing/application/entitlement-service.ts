import type { TierReader } from "@/modules/ai/application/admission";
import type { CreditPort } from "@/modules/analysis/application/ports";
import type { UploadLimits } from "@/modules/documents/application/upload-document";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import { CREDIT_COSTS, LOW_CREDIT_RATIO } from "../domain/credits.config";
import { type Action, checkAction, type Entitlements, extraLocaleCost, tierOf } from "../domain/entitlements";
import type { CreditBalance, CreditStore, PlanReader } from "./ports";

/**
 * EntitlementService (docs/PRICING.md section 4): the one place every use case asks
 * "may this user do this, and what does it cost". It also implements the credit port
 * (reserve, settle, release) so no use case can skip a reservation.
 */
export function makeEntitlements(deps: { plans: PlanReader; credits: CreditStore }) {
  async function plan(): Promise<Result<{ planId: string; entitlements: Entitlements }, AppError>> {
    return deps.plans.myPlan();
  }

  async function check(action: Action): Promise<Result<{ planId: string; entitlements: Entitlements }, AppError>> {
    const p = await plan();
    if (!p.ok) return p;
    const needsBalance = action.kind !== "upload";
    let available = 0;
    if (needsBalance) {
      const balance = await deps.credits.balance();
      if (!balance.ok) return balance;
      available = balance.value.planCredits + balance.value.packCredits;
    }
    const allowed = checkAction(action, p.value.entitlements, available);
    return allowed.ok ? p : allowed;
  }

  const credits: CreditPort = {
    async reserve({ amount, key }) {
      if (amount === 0) return ok({ holdId: null });
      const res = await deps.credits.reserve(amount, key);
      if (!res.ok) return res;
      if (!res.value.holdId) return err({ kind: "insufficient_credits", needed: amount, available: res.value.available });
      return ok({ holdId: res.value.holdId });
    },
    async settle(holdId, amount) {
      if (holdId) await deps.credits.settle(holdId, amount);
    },
    async release(holdId) {
      if (holdId) await deps.credits.release(holdId);
    },
  };

  const tiers: TierReader = {
    async tier() {
      const p = await plan();
      if (!p.ok) return { tier: "guest", maxConcurrentAnalyses: 1 };
      return { tier: tierOf(p.value.planId), maxConcurrentAnalyses: p.value.entitlements.concurrency };
    },
  };

  return {
    check,
    credits,
    tiers,
    /** A08/A09: plan limits before anything is stored. */
    async uploadLimits(input: { pages: number; bytes: number }): Promise<Result<UploadLimits, AppError>> {
      const res = await check({ kind: "upload", ...input });
      if (!res.ok) return res;
      const e = res.value.entitlements;
      return ok({ maxPages: e.maxPages, maxBytes: e.maxBytes, retentionDays: e.retentionDays });
    },
    /** C15: deep chat only on plans that include it. */
    async canUseDeepChat(): Promise<Result<null, AppError>> {
      const res = await check({ kind: "chat", deep: true, credits: 0 });
      return res.ok ? ok(null) : res;
    },
    /** B16: 1 credit for an extra locale, 0 on plans with all locales. */
    async translateCredits(): Promise<number> {
      const p = await plan();
      return p.ok ? extraLocaleCost(p.value.entitlements, CREDIT_COSTS.extraLocale) : CREDIT_COSTS.extraLocale;
    },
    balance: () => deps.credits.balance(),
  };
}

export type EntitlementService = ReturnType<typeof makeEntitlements>;

/** Low-credit nudge: 20% or less left of this period's plan credits, once per period. */
export function shouldNudge(b: CreditBalance): boolean {
  if (b.lowNudged || b.planTotal === 0) return false;
  return b.planCredits + b.packCredits <= b.planTotal * LOW_CREDIT_RATIO;
}
