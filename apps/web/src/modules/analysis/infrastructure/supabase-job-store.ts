import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import { err, ok } from "@/shared/lib/result";
import type { JobStore } from "../application/ports";

const STALE_MS = 10 * 60_000;

/** Jobs table: one running job per document and locale; a stale one (crashed instance) is replaced. */
export class SupabaseJobStore implements JobStore {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async start(input: Parameters<JobStore["start"]>[0]) {
    const { data: running, error: readError } = await this.db
      .from("jobs")
      .select("id, updated_at")
      .eq("document_id", input.documentId)
      .eq("kind", input.kind)
      .eq("locale", input.locale)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) return err({ kind: "db_failed" as const });
    if (running && Date.now() - new Date(running.updated_at).getTime() < STALE_MS) return ok(null);
    if (running) await this.finish(running.id, "failed", "stale");

    const { data, error } = await this.db
      .from("jobs")
      .insert({
        user_id: input.userId,
        document_id: input.documentId,
        kind: input.kind,
        locale: input.locale,
        idempotency_key: `${input.kind}:${input.documentId}:${input.locale}:${input.requestId}`,
        request_id: input.requestId,
      })
      .select("id")
      .single();
    if (error) return error.code === "23505" ? ok(null) : err({ kind: "db_failed" as const });
    return ok({ id: data.id });
  }

  async finish(id: string, status: "done" | "failed" | "aborted", errorKind?: string) {
    await this.db
      .from("jobs")
      .update({ status, error_kind: errorKind?.slice(0, 40) ?? null, updated_at: new Date().toISOString() })
      .eq("id", id);
  }
}
