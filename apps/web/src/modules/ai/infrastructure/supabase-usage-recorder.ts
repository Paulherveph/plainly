import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import { logError } from "@/shared/lib/log";
import type { UsageRecorder, UsageRow } from "../application/ports";

/**
 * Session mode: writes through `record_ai_usage()`, which takes user_id from the JWT.
 * Service mode (scripts, jobs without a session): inserts directly with the service key.
 */
export class SupabaseUsageRecorder implements UsageRecorder {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly mode: "session" | "service" = "session",
  ) {}

  async record(row: UsageRow): Promise<void> {
    const { error } =
      this.mode === "session"
        ? await this.db.rpc("record_ai_usage", {
            p_document_id: row.documentId as string,
            p_request_id: row.requestId,
            p_profile: row.profile,
            p_provider: row.provider,
            p_model: row.model,
            p_input_tokens: row.inputTokens,
            p_cache_read_tokens: row.cacheReadTokens,
            p_cache_write_tokens: row.cacheWriteTokens,
            p_output_tokens: row.outputTokens,
            p_cost_micros_usd: row.costMicros,
            p_latency_ms: row.latencyMs,
            p_status: row.status,
            p_error_kind: row.errorKind as string,
          })
        : await this.db.from("ai_usage").insert({
            user_id: row.userId,
            document_id: row.documentId,
            request_id: row.requestId,
            profile: row.profile,
            provider: row.provider,
            model: row.model,
            input_tokens: row.inputTokens,
            cache_read_tokens: row.cacheReadTokens,
            cache_write_tokens: row.cacheWriteTokens,
            output_tokens: row.outputTokens,
            cost_micros_usd: row.costMicros,
            latency_ms: row.latencyMs,
            status: row.status,
            error_kind: row.errorKind,
          });
    if (error) logError("ai_usage.insert_failed", { code: error.code, requestId: row.requestId });
  }

  async spendTodayMicros(): Promise<number> {
    const { data, error } = await this.db.rpc("ai_spend_today");
    if (error) {
      logError("ai_usage.spend_failed", { code: error.code });
      return 0;
    }
    return Number(data ?? 0);
  }
}
