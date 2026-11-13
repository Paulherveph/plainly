/** Subscription state machine (docs/PRICING.md section 6). Pure, so every transition is testable. */
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type Subscription = {
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  pastDueSince: string | null;
  /** Time of the provider event that produced this state (out-of-order protection). */
  lastEventAt: string | null;
};

export type BillingEvent =
  | {
      type: "subscription.activated" | "subscription.renewed" | "subscription.updated";
      eventId: string;
      occurredAt: string;
      userId: string;
      planId: string;
      subscriptionId: string;
      customerId: string | null;
      periodStart: string;
      periodEnd: string;
    }
  | { type: "subscription.payment_failed"; eventId: string; occurredAt: string; subscriptionId: string }
  | {
      type: "subscription.canceled";
      eventId: string;
      occurredAt: string;
      subscriptionId: string;
      /** true: keeps access to the end of the period (F11); false: ends now. */
      atPeriodEnd: boolean;
    }
  | { type: "pack.purchased"; eventId: string; occurredAt: string; userId: string; packId: string; credits: number }
  | {
      type: "payment.refunded";
      eventId: string;
      occurredAt: string;
      userId: string;
      /** What was refunded: a pack (its credits) or the current plan period. */
      bucket: "pack" | "plan";
      credits: number;
    };

/**
 * Applies one event to the current state. An event older than the last one applied is ignored
 * (F09: out-of-order delivery). Returns null when nothing changes.
 */
export function applyEvent(current: Subscription | null, event: BillingEvent): Subscription | null {
  if (event.type === "pack.purchased" || event.type === "payment.refunded") return null;
  if (current?.lastEventAt && current.lastEventAt > event.occurredAt) return null;

  switch (event.type) {
    case "subscription.activated":
    case "subscription.renewed":
    case "subscription.updated":
      return {
        planId: event.planId,
        status: "active",
        currentPeriodStart: event.periodStart,
        currentPeriodEnd: event.periodEnd,
        cancelAtPeriodEnd: current?.cancelAtPeriodEnd === true && event.type === "subscription.updated",
        pastDueSince: null,
        lastEventAt: event.occurredAt,
      };
    case "subscription.payment_failed":
      if (!current) return null;
      // F10: 3-day grace (enforced in effective_plan), no new credits while past_due.
      return {
        ...current,
        status: "past_due",
        pastDueSince: current.pastDueSince ?? event.occurredAt,
        lastEventAt: event.occurredAt,
      };
    case "subscription.canceled":
      if (!current) return null;
      return event.atPeriodEnd
        ? { ...current, cancelAtPeriodEnd: true, status: "canceled", lastEventAt: event.occurredAt }
        : {
            ...current,
            status: "canceled",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: event.occurredAt,
            lastEventAt: event.occurredAt,
          };
  }
}
