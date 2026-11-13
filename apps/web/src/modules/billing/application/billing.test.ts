import { describe, expect, it } from "vitest";
import { ok } from "@/shared/lib/result";
import type { BillingEvent } from "../domain/subscription";
import { FakeBillingProvider } from "../infrastructure/fake-billing-provider";
import { makeHandleWebhook } from "./billing";
import type { BillingStore, StoredSubscription } from "./ports";

const SECRET = "s".repeat(32);
const USER = "22222222-2222-4222-8222-222222222222";

function memoryStore() {
  const events = new Map<string, boolean>();
  const subs = new Map<string, StoredSubscription>();
  const packs = new Map<string, number>();
  const store: BillingStore = {
    async recordEvent(_p, e) {
      if (events.has(e.eventId)) return ok(events.get(e.eventId) === false);
      events.set(e.eventId, false);
      return ok(true);
    },
    async markProcessed(_p, id) {
      events.set(id, true);
    },
    async findSubscription(_p, id) {
      return ok(subs.get(id) ?? null);
    },
    async saveSubscription(_p, input) {
      subs.set(input.subscriptionId, { ...input.state, userId: input.userId, subscriptionId: input.subscriptionId });
      return ok(null);
    },
    async activeSubscriptionIds() {
      return ok([...subs.keys()]);
    },
    async grantPack(_u, credits, key) {
      if (packs.has(key)) return ok(false);
      packs.set(key, credits);
      return ok(true);
    },
    async reverse(_u, _b, credits) {
      return ok(Math.max(0, credits - 50));
    },
  };
  return { store, subs, packs };
}

async function deliver(provider: FakeBillingProvider, event: BillingEvent, tamper = false) {
  const body = JSON.stringify(event);
  const sig = await provider.sign(body);
  return new Request("http://x/api/billing/webhook", {
    method: "POST",
    headers: { [sig.header]: sig.value },
    body: tamper ? body.replace('"credits":200', '"credits":9999') : body,
  });
}

const activated = (at: string, id = `e-${at}`): BillingEvent => ({
  type: "subscription.activated",
  eventId: id,
  occurredAt: at,
  userId: USER,
  planId: "pro_month",
  subscriptionId: "sub_1",
  customerId: "cus_1",
  periodStart: at,
  periodEnd: "2026-12-14T00:00:00.000Z",
});

describe("billing webhook", () => {
  it("F07/F09: processes once; a duplicate delivery is acknowledged and skipped", async () => {
    const provider = new FakeBillingProvider(SECRET, "http://x");
    const { store, subs } = memoryStore();
    const handle = makeHandleWebhook({ provider, store });
    const event = activated("2026-11-14T00:00:00.000Z", "evt_1");
    expect(await handle(await deliver(provider, event))).toEqual(ok("processed"));
    expect(await handle(await deliver(provider, event))).toEqual(ok("duplicate"));
    expect(subs.get("sub_1")?.status).toBe("active");
  });

  it("F09: an out-of-order older event does not undo a newer state", async () => {
    const provider = new FakeBillingProvider(SECRET, "http://x");
    const { store, subs } = memoryStore();
    const handle = makeHandleWebhook({ provider, store });
    await handle(await deliver(provider, activated("2026-11-14T00:00:00.000Z")));
    await handle(
      await deliver(provider, {
        type: "subscription.payment_failed",
        eventId: "late",
        occurredAt: "2026-11-01T00:00:00.000Z",
        subscriptionId: "sub_1",
      }),
    );
    expect(subs.get("sub_1")?.status).toBe("active");
  });

  it("I05: a bad signature is rejected and nothing is granted", async () => {
    const provider = new FakeBillingProvider(SECRET, "http://x");
    const { store, packs } = memoryStore();
    const handle = makeHandleWebhook({ provider, store });
    const pack: BillingEvent = {
      type: "pack.purchased",
      eventId: "p1",
      occurredAt: "2026-11-14T00:00:00.000Z",
      userId: USER,
      packId: "pack_200",
      credits: 200,
    };
    const res = await handle(await deliver(provider, pack, true));
    expect(res).toEqual({ ok: false, error: { kind: "bad_signature" } });
    expect(packs.size).toBe(0);
  });

  it("F15: a pack is granted once", async () => {
    const provider = new FakeBillingProvider(SECRET, "http://x");
    const { store, packs } = memoryStore();
    const handle = makeHandleWebhook({ provider, store });
    const pack: BillingEvent = {
      type: "pack.purchased",
      eventId: "p2",
      occurredAt: "2026-11-14T00:00:00.000Z",
      userId: USER,
      packId: "pack_200",
      credits: 200,
    };
    await handle(await deliver(provider, pack));
    await handle(await deliver(provider, pack));
    expect([...packs.values()]).toEqual([200]);
  });
});
