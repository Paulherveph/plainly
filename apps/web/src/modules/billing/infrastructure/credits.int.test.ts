import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/shared/lib/db-types";

/**
 * F04: 50 parallel reservations on a balance of 10 never overspend and never double charge.
 * Runs against local Supabase: `supabase start`, then `pnpm test:int`.
 */
const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54325";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE = process.env.SUPABASE_SECRET_KEY ?? "";

describe("credit functions under concurrency (F04)", () => {
  const admin = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
  const user = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  let userId = "";

  beforeAll(async () => {
    const email = `credits-${Date.now()}@test.local`;
    const password = `pw-${crypto.randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("no user");
    userId = created.data.user.id;
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    // Free plan grants 24; spend 14 so exactly 10 are left.
    const first = await user.rpc("reserve_credits", { p_amount: 14, p_key: `setup-${userId}` }).single();
    expect(first.error).toBeNull();
    await user.rpc("settle_credits", { p_hold: first.data?.hold_id as string, p_final: 14 });
  });

  it("50 parallel reservations of 1 credit on a balance of 10: exactly 10 succeed", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        user.rpc("reserve_credits", { p_amount: 1, p_key: `p-${userId}-${i}` }).single(),
      ),
    );
    const holds = results.filter((r) => r.data?.hold_id).length;
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(holds).toBe(10);
    const balance = await admin
      .from("credit_balances")
      .select("plan_credits, pack_credits")
      .eq("user_id", userId)
      .single();
    expect((balance.data?.plan_credits ?? -1) + (balance.data?.pack_credits ?? -1)).toBe(0);
  });

  it("the same idempotency key from 20 parallel retries charges once", async () => {
    await admin.rpc("grant_pack_credits", { p_user: userId, p_credits: 5, p_key: `int-${userId}` });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        user.rpc("reserve_credits", { p_amount: 3, p_key: `same-${userId}` }).single(),
      ),
    );
    const ids = new Set(results.map((r) => r.data?.hold_id).filter(Boolean));
    expect(ids.size).toBe(1);
    const balance = await admin.from("credit_balances").select("pack_credits").eq("user_id", userId).single();
    expect(balance.data?.pack_credits).toBe(2);
  });

  it("the ledger always sums to the balance", async () => {
    const ledger = await admin.from("credit_ledger").select("delta").eq("user_id", userId);
    const balance = await admin
      .from("credit_balances")
      .select("plan_credits, pack_credits")
      .eq("user_id", userId)
      .single();
    const sum = (ledger.data ?? []).reduce((n, r) => n + r.delta, 0);
    expect(sum).toBe((balance.data?.plan_credits ?? 0) + (balance.data?.pack_credits ?? 0));
  });
});
