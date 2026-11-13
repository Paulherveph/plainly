import { createClient } from "@supabase/supabase-js";
import { providerHealth } from "@/server/ai";
import { publicEnv, serverEnv } from "@/shared/config/env";
import type { Database } from "@/shared/lib/db-types";

/**
 * H09: uptime check. Database reachability and provider circuit state. No secrets, no user data,
 * no paid provider call (the circuit breaker reflects real traffic).
 */
export async function GET() {
  const started = Date.now();
  const env = publicEnv();
  const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await db.from("plans").select("id").limit(1);
  const providers = providerHealth();
  const ok = !error && providers.some((p) => p.state !== "disabled");
  const body = {
    status: ok ? "ok" : "degraded",
    db: error ? "down" : "ok",
    providers,
    ai: serverEnv().USE_FAKE_AI ? "fake" : "live",
    billing: serverEnv().BILLING_PROVIDER,
    ms: Date.now() - started,
  };
  return Response.json(body, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
