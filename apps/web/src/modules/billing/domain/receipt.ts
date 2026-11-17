/**
 * The receipt for the signed-in user's latest purchase. Provider-agnostic: it is built from our own
 * subscription row or pack ledger entry and the plans table, never from data the browser sent.
 */

/** A purchase as the database records it. Packs keep only their credit count, not their id. */
export type Purchase =
  | { kind: "plan"; reference: string; planId: string; periodStart: string; periodEnd: string }
  | { kind: "pack"; reference: string; credits: number; purchasedAt: string };

export type ReceiptPlan = {
  id: string;
  kind: string;
  priceCents: number;
  currency: string;
  interval: string;
  credits: number;
};

export type Receipt = {
  number: string;
  issuedAt: string;
  productId: string;
  kind: "plan" | "pack";
  interval: "month" | "year" | "once";
  credits: number;
  amountCents: number;
  currency: string;
  periodEnd: string | null;
  /** Fake billing: no card was charged. */
  demo: boolean;
};

/** "PL-20261117-3F9A1C": the date plus the end of the record id, stable for the same purchase. */
export function receiptNumber(reference: string, issuedAt: string): string {
  const tail = reference
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();
  return `PL-${issuedAt.slice(0, 10).replaceAll("-", "")}-${tail}`;
}

export function buildReceipt(purchase: Purchase, plans: ReceiptPlan[], demo: boolean): Receipt | null {
  const plan =
    purchase.kind === "plan"
      ? plans.find((p) => p.id === purchase.planId)
      : (plans.find((p) => p.kind === "pack" && p.credits === purchase.credits) ??
        plans.find((p) => p.kind === "pack"));
  if (!plan) return null;
  const issuedAt = purchase.kind === "plan" ? purchase.periodStart : purchase.purchasedAt;
  const interval = plan.interval === "month" || plan.interval === "year" ? plan.interval : "once";
  return {
    number: receiptNumber(purchase.reference, issuedAt),
    issuedAt,
    productId: plan.id,
    kind: purchase.kind,
    interval,
    credits: purchase.kind === "pack" ? purchase.credits : plan.credits,
    amountCents: plan.priceCents,
    currency: plan.currency,
    periodEnd: purchase.kind === "plan" ? purchase.periodEnd : null,
    demo,
  };
}
