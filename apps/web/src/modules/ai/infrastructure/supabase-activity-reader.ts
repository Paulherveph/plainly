import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { ActivityReader } from "../application/admission";

/** Counts for the current session user (the RPC reads auth.uid(), never a client value). */
export class SupabaseActivityReader implements ActivityReader {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async recent(): Promise<{ requestsLastMinute: number; runningAnalyses: number }> {
    const { data } = await this.db.rpc("my_recent_activity").maybeSingle();
    return {
      requestsLastMinute: data?.requests_last_minute ?? 0,
      runningAnalyses: data?.running_analyses ?? 0,
    };
  }
}
