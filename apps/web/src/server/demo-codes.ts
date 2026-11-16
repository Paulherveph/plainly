import "server-only";
import { type DemoCodeError, makeIssueDemoCode } from "@/modules/accounts/application/demo-codes";
import { SupabaseDemoCodeAuth } from "@/modules/accounts/infrastructure/supabase-demo-codes";
import { publicEnv, serverEnv } from "@/shared/config/env";
import { err, type Result } from "@/shared/lib/result";
import { createSupabaseAdmin } from "./supabase-admin";

/**
 * Demo codes (docs/TEST_ACCOUNTS.md): show the sign-up code on screen instead of emailing it.
 * On only with DEMO_SHOW_CODES=true and the Supabase secret key. To remove the feature, see the guide.
 */
export function demoCodesEnabled(): boolean {
  const env = serverEnv();
  return env.DEMO_SHOW_CODES && Boolean(env.SUPABASE_SECRET_KEY);
}

export async function issueDemoCode(input: {
  email: string;
  password: string;
  locale: string;
}): Promise<Result<{ code: string }, DemoCodeError>> {
  const admin = createSupabaseAdmin();
  if (!admin) return err({ kind: "failed" });
  const env = publicEnv();
  const auth = new SupabaseDemoCodeAuth(
    admin,
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return makeIssueDemoCode(auth)(input);
}
