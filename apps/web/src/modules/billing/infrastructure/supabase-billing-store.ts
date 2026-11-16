import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/db-types";
import { err, ok } from "@/shared/lib/result";
import type { BillingStore, StoredSubscription } from "../application/ports";
import type { BillingEvent, Subscription, SubscriptionStatus } from "../domain/subscription";

const STATUSES: SubscriptionStatus[] = ["active", "past_due", "canceled", "trialing"];

/** Service-role store for webhooks. */
export class SupabaseBillingStore implements BillingStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async recordEvent(provider: string, event: BillingEvent, raw: unknown) {
    const { error } = await this.admin.from("billing_events").insert({
      provider,
      provider_event_id: event.eventId,
      type: event.type,
      occurred_at: event.occurredAt,
      payload: raw as Json,
    });
    if (!error) return ok(true);
    if (error.code === "23505") {
      // Recorded before: process again only if the earlier delivery did not finish.
      const { data } = await this.admin
        .from("billing_events")
        .select("processed_at")
        .eq("provider", provider)
        .eq("provider_event_id", event.eventId)
        .maybeSingle();
      return ok(data?.processed_at === null);
    }
    return err({ kind: "db_failed" as const });
  }

  async markProcessed(provider: string, eventId: string) {
    await this.admin
      .from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("provider_event_id", eventId);
  }

  async findSubscription(provider: string, subscriptionId: string) {
    const { data, error } = await this.admin
      .from("subscriptions")
      .select("*")
      .eq("provider", provider)
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    if (error) return err({ kind: "db_failed" as const });
    if (!data) return ok(null);
    const status = STATUSES.find((s) => s === data.status) ?? "canceled";
    const sub: StoredSubscription = {
      userId: data.user_id,
      subscriptionId: data.provider_subscription_id,
      planId: data.plan_id,
      status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      pastDueSince: data.past_due_since,
      lastEventAt: data.last_event_at,
    };
    return ok(sub);
  }

  async saveSubscription(
    provider: string,
    input: { userId: string | null; subscriptionId: string; customerId: string | null; state: Subscription },
  ) {
    const s = input.state;
    const { error } = await this.admin.from("subscriptions").upsert(
      {
        user_id: input.userId,
        provider,
        provider_subscription_id: input.subscriptionId,
        ...(input.customerId ? { provider_customer_id: input.customerId } : {}),
        plan_id: s.planId,
        status: s.status,
        current_period_start: s.currentPeriodStart,
        current_period_end: s.currentPeriodEnd,
        cancel_at_period_end: s.cancelAtPeriodEnd,
        past_due_since: s.pastDueSince,
        last_event_at: s.lastEventAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_subscription_id" },
    );
    return error ? err({ kind: "db_failed" as const }) : ok(null);
  }

  async activeSubscriptionIds(userId: string) {
    const { data, error } = await this.admin
      .from("subscriptions")
      .select("provider_subscription_id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"]);
    return error
      ? err({ kind: "db_failed" as const })
      : ok((data ?? []).map((r) => r.provider_subscription_id));
  }

  async grantPack(userId: string, credits: number, key: string) {
    const { data, error } = await this.admin.rpc("grant_pack_credits", {
      p_user: userId,
      p_credits: credits,
      p_key: key,
    });
    return error ? err({ kind: "db_failed" as const }) : ok(data === true);
  }

  async reverse(userId: string, bucket: "plan" | "pack", credits: number, key: string) {
    const { data, error } = await this.admin.rpc("reverse_credits", {
      p_user: userId,
      p_bucket: bucket,
      p_credits: credits,
      p_key: key,
    });
    return error ? err({ kind: "db_failed" as const }) : ok(Number(data ?? 0));
  }
}
