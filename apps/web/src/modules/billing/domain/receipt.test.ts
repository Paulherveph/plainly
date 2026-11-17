import { describe, expect, it } from "vitest";
import { buildReceipt, type ReceiptPlan, receiptNumber } from "./receipt";

const PLANS: ReceiptPlan[] = [
  {
    id: "pro_month",
    kind: "subscription",
    priceCents: 1200,
    currency: "usd",
    interval: "month",
    credits: 400,
  },
  { id: "pack_200", kind: "pack", priceCents: 500, currency: "usd", interval: "once", credits: 200 },
];

describe("receipt", () => {
  it("numbers a receipt from the date and the record id", () => {
    expect(receiptNumber("6f1c2a9e-0000-4000-8000-00000a3f9a1c", "2026-11-17T09:30:00Z")).toBe(
      "PL-20261117-3F9A1C",
    );
  });

  it("builds a plan receipt from the subscription and the plans table", () => {
    const receipt = buildReceipt(
      {
        kind: "plan",
        reference: "sub-abc123",
        planId: "pro_month",
        periodStart: "2026-11-17T09:30:00Z",
        periodEnd: "2026-12-17T09:30:00Z",
      },
      PLANS,
      true,
    );
    expect(receipt).toMatchObject({
      productId: "pro_month",
      interval: "month",
      credits: 400,
      amountCents: 1200,
      currency: "usd",
      periodEnd: "2026-12-17T09:30:00Z",
      demo: true,
    });
  });

  it("finds the pack by its credits, and returns null for an unknown plan", () => {
    const pack = buildReceipt(
      { kind: "pack", reference: "42", credits: 200, purchasedAt: "2026-11-17T09:30:00Z" },
      PLANS,
      false,
    );
    expect(pack).toMatchObject({
      productId: "pack_200",
      interval: "once",
      amountCents: 500,
      periodEnd: null,
    });
    expect(
      buildReceipt(
        { kind: "plan", reference: "x", planId: "gone", periodStart: "", periodEnd: "" },
        PLANS,
        true,
      ),
    ).toBeNull();
  });
});
