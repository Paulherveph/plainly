import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import { logError } from "@/shared/lib/log";
import type { ActivityReader } from "../application/ports";
import type { ActivityDay } from "../domain/activity";

/** Reads my_activity() through the session (RLS: the caller's own rows only). */
export class SupabaseActivityReader implements ActivityReader {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async lastYear(): Promise<ActivityDay[]> {
    const { data, error } = await this.db.rpc("my_activity", { p_days: 371 });
    // A missing function (migration not applied yet) shows an empty graph, never a broken page.
    if (error) {
      logError("account.activity_failed", { code: error.code });
      return [];
    }
    return (data ?? []).map((d) => ({ day: d.day, analyses: d.analyses, questions: d.questions }));
  }
}
