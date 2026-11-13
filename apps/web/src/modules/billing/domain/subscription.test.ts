import { describe, expect, it } from "vitest";
import { applyEvent, type BillingEvent, type Subscription } from "./subscription";

const activated: BillingEvent = {
  type: "subscription.activated",
  eventId: "e1",
  occurredAt: "2026-11-01T00:00:00Z",
  userId: "u",
  planId: "pro_month",
  subscriptionId: "s",
  customerId: "c",
  periodStart: "2026-11-01T00:00:00Z",
  periodEnd: "2026-12-01T00:00:00Z",
};

describe("subscription state machine", () => {
  it("F07: activation gives an active plan", () => {
    expect(applyEvent(null, activated)?.status).toBe("active");
  });

  it("F10: a failed payment moves to past_due with a grace start", () => {
    const active = applyEvent(null, activated) as Subscription;
    const pastDue = applyEvent(active, {
      type: "subscription.payment_failed",
      eventId: "e2",
      occurredAt: "2026-12-01T01:00:00Z",
      subscriptionId: "s",
    });
    expect(pastDue).toMatchObject({ status: "past_due", pastDueSince: "2026-12-01T01:00:00Z" });
  });

  it("F11: cancel keeps access until the period ends", () => {
    const active = applyEvent(null, activated) as Subscription;
    const cancelled = applyEvent(active, {
      type: "subscription.canceled",
      eventId: "e3",
      occurredAt: "2026-11-10T00:00:00Z",
      subscriptionId: "s",
      atPeriodEnd: true,
    });
    expect(cancelled).toMatchObject({ status: "canceled", currentPeriodEnd: "2026-12-01T00:00:00Z" });
  });

  it("F09: an older event never overwrites a newer state", () => {
    const active = applyEvent(null, { ...activated, occurredAt: "2026-11-05T00:00:00Z" }) as Subscription;
    expect(
      applyEvent(active, { type: "subscription.payment_failed", eventId: "old", occurredAt: "2026-11-02T00:00:00Z", subscriptionId: "s" }),
    ).toBeNull();
  });
});
