import type { AppError } from "@/shared/lib/errors";
import { log, logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { buildReceipt, type Receipt } from "../domain/receipt";
import { applyEvent } from "../domain/subscription";
import type { BillingError, BillingProvider, BillingStore, PlanReader, PurchaseReader } from "./ports";

/** Starts a checkout for a plan or a pack. Paid plans need an account (not a guest). */
export function makeStartCheckout(deps: { provider: BillingProvider; plans: PlanReader }) {
  return async (input: {
    userId: string;
    isAnonymous: boolean;
    productId: string;
    locale: "en" | "fr" | "zh";
    returnUrl: string;
  }): Promise<Result<{ url: string }, AppError | BillingError>> => {
    if (input.isAnonymous) return err({ kind: "unauthenticated" });
    const plans = await deps.plans.listPlans();
    if (!plans.ok) return plans;
    const product = plans.value.find((p) => p.id === input.productId);
    if (!product || (product.kind !== "subscription" && product.kind !== "pack"))
      return err({ kind: "not_found" });
    if (product.kind === "pack") {
      const mine = await deps.plans.myPlan();
      if (!mine.ok) return mine;
      if (!mine.value.entitlements.packs)
        return err({ kind: "feature_not_in_plan", feature: "credit_packs" });
    }
    return deps.provider.createCheckout({
      userId: input.userId,
      ...(product.kind === "pack" ? { packId: product.id } : { planId: product.id }),
      locale: input.locale,
      returnUrl: input.returnUrl,
    });
  };
}

/**
 * Webhook rules: verify the signature, store the event by provider id (unique), process it once,
 * answer fast, never grant from the browser return URL. Duplicates are acknowledged and skipped.
 */
export function makeHandleWebhook(deps: { provider: BillingProvider; store: BillingStore }) {
  return async (req: Request): Promise<Result<"processed" | "duplicate", AppError | BillingError>> => {
    const parsed = await deps.provider.parseWebhook(req);
    if (!parsed.ok) {
      logError("billing.webhook_rejected", { kind: parsed.error.kind });
      return parsed;
    }
    const { event, raw } = parsed.value;
    const fresh = await deps.store.recordEvent(deps.provider.name, event, raw);
    if (!fresh.ok) return fresh;
    if (!fresh.value) return ok("duplicate");

    const done = await process(event);
    if (!done.ok) return done;
    await deps.store.markProcessed(deps.provider.name, event.eventId);
    log("billing.event", { type: event.type });
    return ok("processed");
  };

  async function process(event: Parameters<typeof applyEvent>[1]): Promise<Result<null, AppError>> {
    switch (event.type) {
      case "pack.purchased": {
        const granted = await deps.store.grantPack(event.userId, event.credits, event.eventId);
        return granted.ok ? ok(null) : granted;
      }
      case "payment.refunded": {
        const left = await deps.store.reverse(event.userId, event.bucket, event.credits, event.eventId);
        if (!left.ok) return left;
        // Credits already used cannot be taken back: flag the account for a manual review.
        if (left.value > 0) logError("billing.refund_needs_review", { credits: left.value });
        return ok(null);
      }
      default: {
        const current = await deps.store.findSubscription(deps.provider.name, event.subscriptionId);
        if (!current.ok) return current;
        const next = applyEvent(current.value, event);
        if (!next) return ok(null);
        const userId = "userId" in event ? event.userId : (current.value?.userId ?? null);
        const customerId = "customerId" in event ? event.customerId : null;
        return deps.store.saveSubscription(deps.provider.name, {
          userId,
          subscriptionId: event.subscriptionId,
          customerId,
          state: next,
        });
      }
    }
  }
}

/** E12: cancel every live subscription before the account is deleted. */
export function makeCancelForDeletion(deps: { provider: BillingProvider; store: BillingStore }) {
  return async (userId: string): Promise<Result<null, AppError>> => {
    const ids = await deps.store.activeSubscriptionIds(userId);
    if (!ids.ok) return ids;
    for (const id of ids.value) {
      const res = await deps.provider.cancelSubscription(id);
      if (!res.ok) return err({ kind: "db_failed" });
    }
    return ok(null);
  };
}

/** The receipt for the user's latest plan or pack, from our records only. Null before any purchase. */
export function makeLatestReceipt(deps: { purchases: PurchaseReader; plans: PlanReader; demo: boolean }) {
  return async (): Promise<Result<Receipt | null, AppError>> => {
    const [purchase, plans] = await Promise.all([deps.purchases.latest(), deps.plans.listPlans()]);
    if (!purchase.ok) return purchase;
    if (!plans.ok) return plans;
    if (!purchase.value) return ok(null);
    const rows = plans.value.map((p) => ({ ...p, credits: p.entitlements.credits }));
    return ok(buildReceipt(purchase.value, rows, deps.demo));
  };
}
