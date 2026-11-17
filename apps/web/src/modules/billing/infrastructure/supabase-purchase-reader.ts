import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { PurchaseReader } from "../application/ports";
import type { Purchase } from "../domain/receipt";

/** Reads the session user's newest live subscription and newest pack grant (RLS: own rows only). */
export class SupabasePurchaseReader implements PurchaseReader {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async latest(): Promise<Result<Purchase | null, AppError>> {
    const [sub, pack] = await Promise.all([
      this.db
        .from("subscriptions")
        .select("id, plan_id, current_period_start, current_period_end")
        .in("status", ["active", "trialing", "past_due"])
        .order("current_period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.db
        .from("credit_ledger")
        .select("id, delta, created_at")
        .eq("reason", "pack")
        .gt("delta", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (sub.error || pack.error) return err({ kind: "db_failed" });
    const plan: Purchase | null = sub.data && {
      kind: "plan",
      reference: sub.data.id,
      planId: sub.data.plan_id,
      periodStart: sub.data.current_period_start,
      periodEnd: sub.data.current_period_end,
    };
    const packPurchase: Purchase | null = pack.data && {
      kind: "pack",
      reference: String(pack.data.id),
      credits: pack.data.delta,
      purchasedAt: pack.data.created_at,
    };
    if (!plan || !packPurchase) return ok(plan ?? packPurchase);
    return ok(packPurchase.purchasedAt > plan.periodStart ? packPurchase : plan);
  }
}
