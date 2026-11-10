import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { QuotaService } from "../application/ports";
import type { QuotaKind, QuotaStatus } from "../domain/quota";

export class SupabaseQuotaService implements QuotaService {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async consume(kind: QuotaKind): Promise<Result<QuotaStatus, AppError>> {
    const { data, error } = await this.db.rpc("consume_quota", { p_kind: kind }).single();
    if (error || !data) return err({ kind: "db_failed" });
    if (data.used === null) return err({ kind: "quota_exceeded", limit: data.quota });
    return ok({ used: data.used, limit: data.quota, remaining: data.quota - data.used });
  }

  async refund(kind: QuotaKind): Promise<void> {
    await this.db.rpc("refund_quota", { p_kind: kind });
  }

  async status(kind: QuotaKind): Promise<Result<QuotaStatus, AppError>> {
    const [limitRes, usageRes] = await Promise.all([
      this.db.rpc("quota_limit", { p_kind: kind }),
      this.db
        .from("usage")
        .select("analyses, chats")
        .eq("day", new Date().toISOString().slice(0, 10))
        .maybeSingle(),
    ]);
    if (limitRes.error || usageRes.error || typeof limitRes.data !== "number")
      return err({ kind: "db_failed" });
    const used = (kind === "analysis" ? usageRes.data?.analyses : usageRes.data?.chats) ?? 0;
    return ok({ used, limit: limitRes.data, remaining: Math.max(0, limitRes.data - used) });
  }
}
