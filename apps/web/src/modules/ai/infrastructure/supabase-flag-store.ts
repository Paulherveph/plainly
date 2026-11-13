import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/db-types";
import { logError } from "@/shared/lib/log";
import type { FlagReader, FlagStore } from "../application/ports";

const TTL_MS = 30_000;
let cache: { at: number; flags: Map<string, unknown> } | null = null;

/**
 * `feature_flags` through the service client, cached 30 s per server instance.
 * Without a service key there are no flags (everything on, nothing disabled).
 */
export class SupabaseFlagStore implements FlagStore {
  constructor(private readonly admin: SupabaseClient<Database> | null) {}

  async get(key: string): Promise<unknown> {
    return (await this.all()).get(key);
  }

  async all(): Promise<Map<string, unknown>> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.flags;
    const flags = new Map<string, unknown>();
    if (this.admin) {
      const { data, error } = await this.admin.from("feature_flags").select("key, value");
      if (error) logError("flags.read_failed", { code: error.code });
      for (const row of data ?? []) flags.set(row.key, row.value);
    }
    cache = { at: Date.now(), flags };
    return flags;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.admin) return;
    const { error } = await this.admin
      .from("feature_flags")
      .upsert({ key, value: value as Json, updated_at: new Date().toISOString() });
    if (error) logError("flags.write_failed", { code: error.code });
    cache = null;
  }
}

export const noFlags: FlagReader = { get: async () => undefined };
