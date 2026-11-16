# Test accounts

How to get a working account to try Plainly, locally or on a deployed copy, and how to change its plan and credits.

**Contents**
[Local test user](#1-local-test-user) · [Live demo: codes on screen](#2-live-demo-codes-on-screen) · [Hosted Supabase: manage any account](#3-hosted-supabase-manage-any-account) · [Turn demo codes off or remove them](#4-turn-demo-codes-off-or-remove-them)

---

## 1. Local test user

One shared account for trying the app on your machine. It needs the local database running (`supabase start`).

```bash
pnpm test-user create            # creates the account, not confirmed yet
pnpm test-user approve           # confirms it, like entering the emailed code
pnpm test-user status            # email, confirmed?, plan, credits
pnpm test-user plan pro          # switch plan: free | pro | max
pnpm test-user credits 500       # add credits (1-10000), kept until used
pnpm test-user reset             # start over: delete it with its files, create it again, confirm it
```

The first run writes the email and a random password to **`apps/web/.env.test-user`**. Sign in with those.

**Kept safe:**
- `apps/web/.env.test-user` matches `.env*` in `.gitignore`, so git never sees it. Don't copy it into a commit, an issue or a migration.
- The script refuses to run against a Supabase URL that isn't `localhost` or `127.0.0.1`, so it can't touch a real deployment by mistake.

**What each command changes:**

| Command | Effect |
|---|---|
| `plan pro` / `plan max` | An active 30-day subscription, the same thing a real purchase creates |
| `plan free` | Removes it |
| `credits <n>` | Adds credits like a bought pack. They show as "pack" credits and are used after the monthly ones |
| `reset` | A fresh account with a full Free balance (monthly credits already granted aren't taken back when you switch plans) |

To confirm any other local account, open Studio (http://127.0.0.1:54327) → Table editor → `profiles` → tick `approved`.

## 2. Live demo: codes on screen

A new account needs a 6-digit code to confirm its email. A deployment with no email service set up can't send it. For a demo, turn on **demo codes**:

```bash
DEMO_SHOW_CODES=true   # in Vercel (or .env.local), server-only
```

After sign-up, the code appears in a small message with a **Copy** button:
- Copy it and paste it into the boxes. The message closes once copied.
- Closed it without copying? Click **Send a new code** right away; there's no wait, because no email is sent.
- Signing in to an account that was never confirmed shows a new code the same way.
- A guest who signs up keeps the documents they opened.

**What demo codes do not change:**
- A code is shown only for a brand-new account, or for an unconfirmed account when the right password was typed.
- A confirmed account never gets one. A wrong password gets "This email already has an account".
- Password resets never show a code; they always go by email.
- Turnstile still applies when it's configured.

**The code shows but "doesn't match"?** Your Supabase project issues codes longer than 6 digits. Set Supabase → Authentication → Sign In / Providers → Email → **Email OTP Length = 6** (local `supabase/config.toml` already uses 6).

**What they do change:** anyone can create an account with an address they don't own, because nothing proves the inbox exists. That's fine for a demo. For a real product, set up email instead (Resend SMTP, [Deploy](DEPLOY.md)) and turn demo codes off.

## 3. Hosted Supabase: manage any account

On a deployed copy, `pnpm test-user` refuses to run. Do it in the Supabase dashboard of that project → **SQL Editor**. Replace `you@example.com` in each snippet.

**Confirm an account** (same as entering the code):

```sql
update public.profiles set approved = true
where user_id = (select id from auth.users where email = 'you@example.com');
```

**Switch to Pro for 30 days** (use `'max_month'` for Max):

```sql
insert into public.subscriptions (user_id, plan_id, status, provider, provider_subscription_id,
  current_period_start, current_period_end, cancel_at_period_end)
select id, 'pro_month', 'active', 'manual', 'manual-' || id, now(), now() + interval '30 days', false
from auth.users where email = 'you@example.com'
on conflict (provider, provider_subscription_id) do update
  set plan_id = excluded.plan_id, status = 'active', current_period_start = now(),
      current_period_end = excluded.current_period_end, updated_at = now();
```

**Back to Free:**

```sql
delete from public.subscriptions
where provider = 'manual' and user_id = (select id from auth.users where email = 'you@example.com');
```

**Add 500 credits:**

```sql
select public.grant_pack_credits(
  (select id from auth.users where email = 'you@example.com'), 500, 'admin:' || now()::text);
```

Each snippet was checked against the migrations in `supabase/migrations/`.

## 4. Turn demo codes off or remove them

**Off:** set `DEMO_SHOW_CODES=false` (or delete the variable) and redeploy. Sign-up goes back to emailed codes, with nothing else to change.

**Remove the feature from your fork:**
1. Delete these files:
   - `apps/web/src/modules/accounts/application/demo-codes.ts` and `demo-codes.test.ts`
   - `apps/web/src/modules/accounts/infrastructure/supabase-demo-codes.ts`
   - `apps/web/src/server/demo-codes.ts`
   - `apps/web/src/shared/ui/demo-code-toast.tsx`
   - `apps/web/e2e/demo-codes.spec.ts`
2. In `apps/web/src/server/actions/auth.ts`, delete `demoSignupCode` and the three blocks marked `demo-codes`, then the `demoCode` field of `AuthStep`.
3. In `apps/web/src/shared/ui/sign-in-form.tsx`, replace `showCode(...)` with `setResendAt(Date.now() + RESEND_S * 1000)`, and drop the `password` passed to `resendCodeAction` and the `dismissDemoCode()` calls.
4. Remove `DEMO_SHOW_CODES` from `env.ts` and `.env.example`, the `demo` project and second web server from `playwright.config.ts`, and the `demoCode*` keys from `messages/{en,fr,zh}.json`.
5. Run `pnpm check`. TypeScript points to anything left over.
