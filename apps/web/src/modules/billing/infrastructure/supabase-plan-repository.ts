import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { PlanReader, PlanRow } from "../application/ports";
import { Entitlements } from "../domain/entitlements";

const KINDS = ["guest", "free", "subscription", "pack"] as const;
const INTERVALS = ["none", "month", "year", "once"] as const;

export class SupabasePlanRepository implements PlanReader {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async myPlan() {
    const { data, error } = await this.db.rpc("my_plan").maybeSingle();
    if (error || !data) return err({ kind: "db_failed" as const });
    const entitlements = Entitlements.safeParse(data.entitlements);
    if (!entitlements.success) return err({ kind: "db_failed" as const });
    return ok({ planId: data.plan_id, entitlements: entitlements.data, emailVerified: data.email_verified === true });
  }

  async listPlans(): Promise<Result<PlanRow[], AppError>> {
    const { data, error } = await this.db.from("plans").select("*").eq("active", true).order("sort");
    if (error) return err({ kind: "db_failed" });
    const rows: PlanRow[] = [];
    for (const r of data ?? []) {
      const ent = Entitlements.safeParse(r.entitlements);
      const kind = KINDS.find((k) => k === r.kind);
      const interval = INTERVALS.find((i) => i === r.interval);
      if (!ent.success || !kind || !interval) continue;
      rows.push({
        id: r.id,
        name: r.name,
        kind,
        priceCents: r.price_cents,
        currency: r.currency,
        interval,
        entitlements: ent.data,
      });
    }
    return ok(rows);
  }
}
