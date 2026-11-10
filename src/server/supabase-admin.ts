import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/shared/config/env";
import type { Database } from "@/shared/lib/db-types";

/** Bypasses RLS. Only for the retention job, never for anything a user triggers. */
export function createSupabaseAdmin() {
  const key = serverEnv().SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
