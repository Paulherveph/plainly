import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/db-types";
import type { DemoCodeAuth, ProbeResult } from "../application/demo-codes";

/** Demo codes on Supabase (docs/TEST_ACCOUNTS.md). The admin calls never send an email. */
export class SupabaseDemoCodeAuth implements DemoCodeAuth {
  constructor(
    private readonly admin: SupabaseClient<Database>,
    private readonly url: string,
    private readonly publishableKey: string,
  ) {}

  async createUnconfirmed(email: string, password: string, locale: string) {
    const { error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { locale },
    });
    if (!error) return "created" as const;
    return error.code === "email_exists" || error.code === "user_already_exists"
      ? ("exists" as const)
      : ("failed" as const);
  }

  async probe(email: string, password: string): Promise<ProbeResult> {
    // A throwaway client: no cookies are read or written, so the visitor's own session is untouched.
    const client = createClient(this.url, this.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) {
      await client.auth.signOut({ scope: "local" });
      return "confirmed";
    }
    if (error.code === "email_not_confirmed") return "unconfirmed";
    if (error.code === "invalid_credentials") return "invalid";
    return error.status === 429 ? "rate_limited" : "failed";
  }

  async signupCode(email: string, password: string) {
    const { data, error } = await this.admin.auth.admin.generateLink({ type: "signup", email, password });
    return error ? null : (data.properties?.email_otp ?? null);
  }
}
