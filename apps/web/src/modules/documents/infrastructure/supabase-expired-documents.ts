import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { ExpiredDocuments } from "../application/ports";

/** Must be given the service (secret key) client. Only used by the retention job. */
export class SupabaseExpiredDocuments implements ExpiredDocuments {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async listExpired(
    before: Date,
    limit: number,
  ): Promise<Result<{ id: string; storagePath: string }[], AppError>> {
    const { data, error } = await this.admin
      .from("documents")
      .select("id, storage_path")
      .lt("expires_at", before.toISOString())
      .limit(limit);
    if (error) return err({ kind: "db_failed" });
    return ok(data.map((d) => ({ id: d.id, storagePath: d.storage_path })));
  }

  async deleteByIds(ids: readonly string[]): Promise<Result<null, AppError>> {
    const { error } = await this.admin
      .from("documents")
      .delete()
      .in("id", [...ids]);
    return error ? err({ kind: "db_failed" }) : ok(null);
  }
}
