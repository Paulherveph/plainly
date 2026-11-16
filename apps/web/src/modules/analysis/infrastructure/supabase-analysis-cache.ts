import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/db-types";
import { logError } from "@/shared/lib/log";
import type { AnalysisCache } from "../application/ports";
import { Analysis } from "../domain/analysis";

/** Per-user cache (RLS): one user's upload never reveals that another user has the same file. */
export class SupabaseAnalysisCache implements AnalysisCache {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async get(key: string) {
    const { data } = await this.db
      .from("analysis_cache")
      .select("result, model, dropped")
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    const analysis = Analysis.safeParse(data.result);
    return analysis.success ? { analysis: analysis.data, dropped: data.dropped, model: data.model } : null;
  }

  async put(key: string, value: { analysis: Analysis; dropped: number; model: string }) {
    const { error } = await this.db.from("analysis_cache").upsert(
      {
        cache_key: key,
        result: value.analysis as unknown as Json,
        model: value.model,
        dropped: value.dropped,
      },
      { onConflict: "user_id,cache_key" },
    );
    if (error) logError("analysis_cache.put_failed", { code: error.code });
  }
}
