import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import type { CreditBalance, CreditStore, LedgerEntry } from "../application/ports";

/** Session-bound: the SQL functions act for auth.uid(), never for an id from the client. */
export class SupabaseCreditStore implements CreditStore {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async balance(): Promise<Result<CreditBalance, AppError>> {
    const { data, error } = await this.db.rpc("my_credits").maybeSingle();
    if (error || !data) return err({ kind: "db_failed" });
    return ok({
      planId: data.plan_id ?? "guest",
      planCredits: data.plan_credits ?? 0,
      packCredits: data.pack_credits ?? 0,
      planTotal: data.plan_total ?? 0,
      periodEnd: data.period_end,
      lowNudged: data.low_nudged !== null && data.low_nudged === data.period_key,
      emailVerified: data.email_verified === true,
    });
  }

  async reserve(amount: number, key: string) {
    const { data, error } = await this.db
      .rpc("reserve_credits", { p_amount: amount, p_key: key })
      .maybeSingle();
    if (error || !data) {
      logError("credits.reserve_failed", { code: error?.code ?? "none" });
      return err({ kind: "db_failed" as const });
    }
    return ok({ holdId: data.hold_id, available: data.available ?? 0 });
  }

  async settle(holdId: string, amount: number) {
    const { error } = await this.db.rpc("settle_credits", { p_hold: holdId, p_final: amount });
    if (error) logError("credits.settle_failed", { code: error.code });
  }

  async release(holdId: string) {
    const { error } = await this.db.rpc("release_credits", { p_hold: holdId });
    if (error) logError("credits.release_failed", { code: error.code });
  }

  async ledger(limit: number): Promise<Result<LedgerEntry[], AppError>> {
    const { data, error } = await this.db
      .from("credit_ledger")
      .select("delta, bucket, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return err({ kind: "db_failed" });
    return ok(
      (data ?? []).map((r) => ({
        delta: r.delta,
        bucket: r.bucket === "pack" ? "pack" : "plan",
        reason: r.reason,
        createdAt: r.created_at,
      })),
    );
  }

  async markLowNudged() {
    await this.db.rpc("mark_low_nudged");
  }
}
