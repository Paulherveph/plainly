import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Entitlements } from "../domain/entitlements";
import type { Purchase } from "../domain/receipt";
import type { BillingEvent, Subscription } from "../domain/subscription";

export type CreditBalance = {
  planId: string;
  planCredits: number;
  packCredits: number;
  /** Credits granted per period on this plan (for the meter). */
  planTotal: number;
  periodEnd: string | null;
  /** The low-credit nudge was already shown this period. */
  lowNudged: boolean;
  emailVerified: boolean;
};

export type LedgerEntry = { delta: number; bucket: "plan" | "pack"; reason: string; createdAt: string };

/** The session user's credits. All writes go through SQL functions with idempotency keys. */
export interface CreditStore {
  balance(): Promise<Result<CreditBalance, AppError>>;
  reserve(
    amount: number,
    key: string,
  ): Promise<Result<{ holdId: string | null; available: number }, AppError>>;
  settle(holdId: string, amount: number): Promise<void>;
  release(holdId: string): Promise<void>;
  ledger(limit: number): Promise<Result<LedgerEntry[], AppError>>;
  markLowNudged(): Promise<void>;
}

export type PlanRow = {
  id: string;
  name: string;
  kind: "guest" | "free" | "subscription" | "pack";
  priceCents: number;
  currency: string;
  interval: "none" | "month" | "year" | "once";
  entitlements: Entitlements;
};

export interface PlanReader {
  /** The session user's effective plan (subscription, else Free or Guest). */
  myPlan(): Promise<Result<{ planId: string; entitlements: Entitlements; emailVerified: boolean }, AppError>>;
  listPlans(): Promise<Result<PlanRow[], AppError>>;
}

export type BillingError = { kind: "billing_failed" } | { kind: "bad_signature" } | { kind: "bad_event" };

/** docs/PRICING.md section 6. One real adapter is added in S5; FakeBillingProvider until then. */
export interface BillingProvider {
  readonly name: string;
  createCheckout(input: {
    userId: string;
    planId?: string;
    packId?: string;
    locale: "en" | "fr" | "zh";
    returnUrl: string;
  }): Promise<Result<{ url: string }, BillingError>>;
  createPortalSession(input: {
    userId: string;
    locale: "en" | "fr" | "zh";
    returnUrl: string;
  }): Promise<Result<{ url: string }, BillingError>>;
  /** Verifies the signature, then parses the provider payload into our event type. */
  parseWebhook(req: Request): Promise<Result<{ event: BillingEvent; raw: unknown }, BillingError>>;
  cancelSubscription(subscriptionId: string): Promise<Result<null, BillingError>>;
}

export type StoredSubscription = Subscription & { userId: string | null; subscriptionId: string };

/** Service-role persistence for webhooks (no session in a webhook). */
export interface BillingStore {
  /** Inserts the event by provider id; false when it was already recorded (duplicate delivery). */
  recordEvent(provider: string, event: BillingEvent, raw: unknown): Promise<Result<boolean, AppError>>;
  markProcessed(provider: string, eventId: string): Promise<void>;
  findSubscription(
    provider: string,
    subscriptionId: string,
  ): Promise<Result<StoredSubscription | null, AppError>>;
  saveSubscription(
    provider: string,
    input: { userId: string | null; subscriptionId: string; customerId: string | null; state: Subscription },
  ): Promise<Result<null, AppError>>;
  activeSubscriptionIds(userId: string): Promise<Result<string[], AppError>>;
  grantPack(userId: string, credits: number, key: string): Promise<Result<boolean, AppError>>;
  reverse(
    userId: string,
    bucket: "plan" | "pack",
    credits: number,
    key: string,
  ): Promise<Result<number, AppError>>;
}

/** The session user's latest purchase (RLS: own rows only), for the success page and the receipt. */
export interface PurchaseReader {
  latest(): Promise<Result<Purchase | null, AppError>>;
}
