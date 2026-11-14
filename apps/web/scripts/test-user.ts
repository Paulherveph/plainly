/**
 * The shared local test user (docs/AUTH.md, "Local test user"). Local Supabase only.
 *
 *   pnpm test-user create            create the user from .env.test-user (written on first run), not approved
 *   pnpm test-user approve           approve the account (ticks profiles.approved, same as entering the emailed code)
 *   pnpm test-user reset             delete the user and its files, create it again and approve it (fresh credits)
 *   pnpm test-user plan free|pro|max switch the plan (writes a "manual" subscription row)
 *   pnpm test-user status            approved?, plan, credits
 *
 * Credentials live in apps/web/.env.test-user, which git ignores (.env*). Never commit them or put them in a
 * migration. After `supabase db reset`, run `create` again.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
for (const file of [".env.local", ".env.test-user"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const PLANS = { free: null, pro: "pro_month", max: "max_month" } as const;
type PlanName = keyof typeof PLANS;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url))
  fail(`Refusing to run: ${url || "no Supabase URL"} is not local.`);
if (!key) fail("SUPABASE_SECRET_KEY is missing from .env.local.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Reads the credentials, or writes new ones the first time. */
function credentials(): { email: string; password: string } {
  let email = process.env.TEST_USER_EMAIL;
  let password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    email = "tester@plainly.local";
    password = `Pl-${randomBytes(9).toString("base64url")}`;
    writeFileSync(
      join(root, ".env.test-user"),
      [
        "# Shared local test user (docs/AUTH.md). Git-ignored. Do not commit.",
        "# Recreate after a db reset: pnpm test-user create",
        `TEST_USER_EMAIL=${email}`,
        `TEST_USER_PASSWORD=${password}`,
        "",
      ].join("\n"),
    );
    process.env.TEST_USER_EMAIL = email;
    process.env.TEST_USER_PASSWORD = password;
    console.log("Wrote apps/web/.env.test-user");
  }
  return { email, password };
}

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

async function requireUser() {
  const { email } = credentials();
  const user = await findUser(email);
  if (!user) fail(`${email} does not exist. Run: pnpm test-user create`);
  return user;
}

async function status() {
  const user = await requireUser();
  const { data: plan } = await admin.rpc("effective_plan", { p_user: user.id });
  await admin.rpc("grant_period_credits", { p_user: user.id });
  const { data: balance } = await admin
    .from("credit_balances")
    .select("plan_credits, pack_credits")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log(`email     ${user.email}`);
  console.log(`approved  ${user.email_confirmed_at ? `yes (${user.email_confirmed_at})` : "no"}`);
  console.log(`plan      ${plan ?? "unknown"}`);
  console.log(
    `credits   ${balance ? `${balance.plan_credits} plan + ${balance.pack_credits} pack` : "none yet"}`,
  );
}

async function create() {
  const { email, password } = credentials();
  if (await findUser(email)) {
    console.log(`${email} already exists.`);
    return status();
  }
  // Not approved: the owner approves it (or `pnpm test-user approve`). Signing in first sends a code.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { locale: "en" },
  });
  if (error) fail(error.message);
  console.log(`Created ${email} (not approved).`);
  await status();
}

/** The same checkbox the owner ticks in Studio; a trigger confirms the email in auth.users. */
async function approve() {
  const user = await requireUser();
  const { error } = await admin.from("profiles").update({ approved: true }).eq("user_id", user.id);
  if (error) fail(error.message);
  console.log(`Approved ${user.email}.`);
  await status();
}

/** For when the credits run out: a brand new, approved account with the same credentials. */
async function reset() {
  const { email } = credentials();
  const user = await findUser(email);
  if (user) {
    const { data: docs } = await admin.from("documents").select("storage_path").eq("user_id", user.id);
    const paths = (docs ?? []).map((d) => d.storage_path as string);
    if (paths.length > 0) await admin.storage.from("documents").remove(paths);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) fail(error.message);
    console.log(`Deleted ${email} and ${paths.length} file(s).`);
  }
  await create();
  await approve();
}

/** Free = no active subscription. Pro or Max = one active "manual" subscription for 30 days. */
async function setPlan(name: string | undefined) {
  if (!name || !(name in PLANS)) fail("Usage: pnpm test-user plan free|pro|max");
  const user = await requireUser();
  const planId = PLANS[name as PlanName];
  const now = new Date().toISOString();
  // End any other subscription first, so the plan asked for is the one that applies.
  await admin
    .from("subscriptions")
    .update({ status: "canceled", current_period_end: now, updated_at: now })
    .eq("user_id", user.id)
    .neq("provider", "manual");
  if (planId === null) {
    await admin.from("subscriptions").delete().eq("user_id", user.id).eq("provider", "manual");
  } else {
    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan_id: planId,
        status: "active",
        provider: "manual",
        provider_subscription_id: `manual-${user.id}`,
        current_period_start: now,
        current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        cancel_at_period_end: false,
        past_due_since: null,
        updated_at: now,
      },
      { onConflict: "provider,provider_subscription_id" },
    );
    if (error) fail(error.message);
  }
  console.log(`Plan set to ${name}.`);
  await status();
}

const [command, value] = process.argv.slice(2);
const commands: Record<string, () => Promise<void>> = {
  create,
  approve,
  reset,
  status,
  plan: () => setPlan(value),
};
const run = command ? commands[command] : undefined;
if (!run) fail("Usage: pnpm test-user create | approve | reset | plan free|pro|max | status");
run().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
