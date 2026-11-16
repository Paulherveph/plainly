import { z } from "zod";
import { err, ok } from "@/shared/lib/result";
import { signValue, verifyValue } from "@/shared/lib/signed-value";
import type { BillingProvider, BillingStore } from "../application/ports";
import type { BillingEvent } from "../domain/subscription";

const SIGNATURE_HEADER = "x-fake-billing-signature";

const Event: z.ZodType<BillingEvent> = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["subscription.activated", "subscription.renewed", "subscription.updated"]),
    eventId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    userId: z.uuid(),
    planId: z.string().min(1),
    subscriptionId: z.string().min(1),
    customerId: z.string().nullable(),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("subscription.payment_failed"),
    eventId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    subscriptionId: z.string().min(1),
  }),
  z.object({
    type: z.literal("subscription.canceled"),
    eventId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    subscriptionId: z.string().min(1),
    atPeriodEnd: z.boolean(),
  }),
  z.object({
    type: z.literal("pack.purchased"),
    eventId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    userId: z.uuid(),
    packId: z.string().min(1),
    credits: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("payment.refunded"),
    eventId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    userId: z.uuid(),
    bucket: z.enum(["plan", "pack"]),
    credits: z.number().int().nonnegative(),
  }),
]);

/** What the simulator page receives in its signed `session` parameter. */
export const CheckoutSession = z.object({
  userId: z.uuid(),
  productId: z.string(),
  kind: z.enum(["plan", "pack", "portal"]),
  returnUrl: z.string(),
});
export type CheckoutSession = z.infer<typeof CheckoutSession>;

/**
 * S4 billing without real money. Checkout opens a dev-only simulator page; the simulator posts
 * HMAC-signed events to /api/billing/webhook exactly like a provider would (docs/PRICING.md 6).
 */
export class FakeBillingProvider implements BillingProvider {
  readonly name = "fake";

  constructor(
    private readonly secret: string,
    private readonly siteUrl: string,
    private readonly store?: BillingStore,
  ) {}

  private async sessionUrl(locale: string, session: CheckoutSession): Promise<string> {
    const token = await signValue(JSON.stringify(session), this.secret, 30 * 60);
    return `${this.siteUrl}/${locale}/dev/billing?session=${encodeURIComponent(token)}`;
  }

  async createCheckout(input: Parameters<BillingProvider["createCheckout"]>[0]) {
    const productId = input.planId ?? input.packId;
    if (!productId) return err({ kind: "billing_failed" as const });
    const kind = input.packId ? "pack" : "plan";
    return ok({
      url: await this.sessionUrl(input.locale, {
        userId: input.userId,
        productId,
        kind,
        returnUrl: input.returnUrl,
      }),
    });
  }

  async createPortalSession(input: Parameters<BillingProvider["createPortalSession"]>[0]) {
    return ok({
      url: await this.sessionUrl(input.locale, {
        userId: input.userId,
        productId: "",
        kind: "portal",
        returnUrl: input.returnUrl,
      }),
    });
  }

  async parseWebhook(req: Request) {
    const body = await req.text();
    const signature = req.headers.get(SIGNATURE_HEADER) ?? "";
    // I05: the signature carries an HMAC of the exact body; replays with another body fail.
    const signed = await verifyValue(signature, this.secret);
    if (signed === null || signed !== (await digest(body))) return err({ kind: "bad_signature" as const });
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return err({ kind: "bad_event" as const });
    }
    const event = Event.safeParse(raw);
    return event.success ? ok({ event: event.data, raw }) : err({ kind: "bad_event" as const });
  }

  async cancelSubscription(subscriptionId: string) {
    if (!this.store) return ok(null);
    const current = await this.store.findSubscription(this.name, subscriptionId);
    if (!current.ok || !current.value) return ok(null);
    const now = new Date().toISOString();
    await this.store.saveSubscription(this.name, {
      userId: current.value.userId,
      subscriptionId,
      customerId: null,
      state: { ...current.value, status: "canceled", currentPeriodEnd: now, lastEventAt: now },
    });
    return ok(null);
  }

  /** Used by the simulator (and tests) to sign an event like the provider would. */
  async sign(body: string): Promise<{ header: string; value: string }> {
    return { header: SIGNATURE_HEADER, value: await signValue(await digest(body), this.secret, 5 * 60) };
  }

  async readSession(token: string): Promise<CheckoutSession | null> {
    const json = await verifyValue(token, this.secret);
    if (!json) return null;
    const parsed = CheckoutSession.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  }
}

async function digest(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
