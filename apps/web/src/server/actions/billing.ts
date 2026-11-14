"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CreditBalance } from "@/modules/billing/application/ports";
import { shouldNudge } from "@/modules/billing/application/entitlement-service";
import { billingProvider, simulatorEnabled } from "@/server/billing";
import { container } from "@/server/container";
import { publicEnv } from "@/shared/config/env";
import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { safeNext } from "@/shared/lib/safe-next";

const Locale = z.enum(["en", "fr", "zh"]).catch("en");

/** Credits for the meter and the paywall (the SQL grants lazily on read). */
export async function getCreditsAction(): Promise<Result<CreditBalance & { nudge: boolean }, AppError>> {
  const c = await container();
  if (!(await c.currentUser())) return err({ kind: "unauthenticated" });
  const balance = await c.entitlements.balance();
  return balance.ok ? ok({ ...balance.value, nudge: shouldNudge(balance.value) }) : balance;
}

export async function markLowNudgedAction(): Promise<void> {
  const c = await container();
  if (await c.currentUser()) await c.markLowNudged();
}

/** Opens the provider checkout for a plan or a pack. Guests sign in first (paid plans need an account). */
export async function checkoutAction(input: { productId: string; locale: string; back?: string }): Promise<Result<never, AppError>> {
  const locale = Locale.parse(input.locale);
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/pricing`)}`);
  }
  const back = safeNext(input.back, `/${locale}/documents`);
  const returnUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/${locale}/billing/success?next=${encodeURIComponent(back)}`;
  const res = await c.startCheckout({
    userId: user.id,
    isAnonymous: user.isAnonymous,
    productId: z.string().max(40).parse(input.productId),
    locale,
    returnUrl,
  });
  log("billing.checkout", { ok: res.ok, product: input.productId });
  if (!res.ok) return err(res.error.kind === "billing_failed" ? { kind: "db_failed" } : (res.error as AppError));
  redirect(res.value.url);
}

/** The provider's billing portal (invoices, payment method, cancel). */
export async function portalAction(input: { locale: string }): Promise<Result<never, AppError>> {
  const locale = Locale.parse(input.locale);
  const c = await container();
  const user = await c.currentUser();
  if (!user || user.isAnonymous) return err({ kind: "unauthenticated" });
  const res = await c.openPortal({
    userId: user.id,
    locale,
    returnUrl: `${publicEnv().NEXT_PUBLIC_SITE_URL}/${locale}/account`,
  });
  if (!res.ok) return err({ kind: "db_failed" });
  redirect(res.value.url);
}

const SimEvent = z.enum(["success", "renewal", "payment_failed", "cancel", "cancel_now", "refund"]);

/**
 * Dev-only fake billing: builds a provider-like event, signs it, and posts it to our own webhook,
 * so the real webhook path (signature, idempotency, state machine) is what runs.
 */
export async function simulateBillingAction(input: { session: string; event: string }): Promise<Result<{ next: string }, AppError>> {
  if (!simulatorEnabled()) return err({ kind: "not_found" });
  const provider = billingProvider();
  const session = provider.readSession ? await provider.readSession(input.session) : null;
  const kind = SimEvent.safeParse(input.event);
  if (!session || !kind.success) return err({ kind: "invalid_input", reason: "empty" });

  const now = new Date();
  const at = now.toISOString();
  const end = new Date(now.getTime() + (session.productId.endsWith("_year") ? 365 : 30) * 86_400_000).toISOString();
  const subscriptionId = `fake_sub_${session.userId}`;
  const eventId = `fake_evt_${crypto.randomUUID()}`;
  const plans = await (await container()).plans();
  const pack = plans.ok ? plans.value.find((p) => p.id === session.productId && p.kind === "pack") : undefined;

  const event =
    kind.data === "success" && pack
      ? { type: "pack.purchased", eventId, occurredAt: at, userId: session.userId, packId: pack.id, credits: pack.entitlements.credits }
      : kind.data === "success" || kind.data === "renewal"
        ? {
            type: kind.data === "success" ? "subscription.activated" : "subscription.renewed",
            eventId,
            occurredAt: at,
            userId: session.userId,
            planId: session.productId || "pro_month",
            subscriptionId,
            customerId: `fake_cus_${session.userId}`,
            periodStart: at,
            periodEnd: end,
          }
        : kind.data === "payment_failed"
          ? { type: "subscription.payment_failed", eventId, occurredAt: at, subscriptionId }
          : kind.data === "refund"
            ? { type: "payment.refunded", eventId, occurredAt: at, userId: session.userId, bucket: pack ? "pack" : "plan", credits: pack?.entitlements.credits ?? 400 }
            : { type: "subscription.canceled", eventId, occurredAt: at, subscriptionId, atPeriodEnd: kind.data === "cancel" };

  const body = JSON.stringify(event);
  const sig = provider.sign ? await provider.sign(body) : null;
  const res = await fetch(`${publicEnv().NEXT_PUBLIC_SITE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(sig ? { [sig.header]: sig.value } : {}) },
    body,
  });
  if (!res.ok) return err({ kind: "db_failed" });
  return ok({ next: session.returnUrl });
}
