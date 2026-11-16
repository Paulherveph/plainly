import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileStore } from "@/modules/documents/application/ports";
import type { Database } from "@/shared/lib/db-types";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";
import type { AccountDataReader } from "../application/ports";

/** Tables included in an export. Each is read through the session client, so RLS scopes it. */
const TABLES = ["profiles", "documents", "analyses", "messages", "deadlines", "ai_usage"] as const;

export class SupabaseAccountData implements AccountDataReader {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly files: FileStore,
    private readonly extraTables: readonly string[] = [],
  ) {}

  async tables(userId: string): Promise<Result<Record<string, unknown[]>, AppError>> {
    const out: Record<string, unknown[]> = {};
    for (const table of [...TABLES, ...this.extraTables]) {
      const { data, error } = await this.db
        .from(table as (typeof TABLES)[number])
        .select("*")
        .eq("user_id", userId)
        .limit(10_000);
      if (error) return err({ kind: "db_failed" });
      out[table] = data ?? [];
    }
    return ok(out);
  }

  async originals(userId: string): Promise<Result<{ path: string; bytes: Uint8Array }[], AppError>> {
    const { data, error } = await this.db.from("documents").select("id, storage_path").eq("user_id", userId);
    if (error) return err({ kind: "db_failed" });
    const out: { path: string; bytes: Uint8Array }[] = [];
    for (const row of data ?? []) {
      const file = await this.files.read(row.storage_path);
      if (!file.ok) continue;
      out.push({
        path: `${row.id}/${row.storage_path.split("/").pop() ?? "original"}`,
        bytes: file.value.bytes,
      });
    }
    return ok(out);
  }
}
