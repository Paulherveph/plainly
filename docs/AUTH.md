# Accounts (Stage S3)

Goal: Claude-like experience. A visitor tries the product in seconds, then signs up without losing anything.

## 1. Identity model
- **Guest**: Supabase anonymous user, created on first action (not on page view), protected by Cloudflare Turnstile (Supabase Auth supports captcha for anonymous sign-ins and sign-ups; confirm the setting with Context7).
- **Member**: email or Google. A guest becomes a member **in place** so the user id and all documents stay.
- One table `profiles(user_id pk, display_name, locale, theme, plan_id, created_at, deleted_at)` created by trigger on `auth.users`.

## 2. Sign-in methods
1. **Email + password** (8 characters minimum).
2. **Google** (OAuth).

A new email account must be **approved** before it can sign in: Supabase emails a 6-digit code, and entering it sets `auth.users.email_confirmed_at`. That timestamp is the only approval flag (no copy in `profiles`). It also gates Free monthly credits (E14). Passkeys are a later improvement.

## 3. Flows

**Sign up**: email + password → code by email → the code approves the account and signs in.

**Sign in**: email + password. If the account was never approved, a fresh code is sent and the code step opens.

**Forgot password**: email → code → new password, in one step after the code.

**Guest to member (same device)**
- Email: `updateUser({ email })` sends a code; after the code, the password is set on the same user, so the anonymous user id is kept.
- Google: `linkIdentity({ provider: "google" })`. Requires manual identity linking to be enabled in Supabase Auth settings. Verify with Context7.

**Email or Google already belongs to another account (conflict)**
1. Before redirecting, store the guest id in a short-lived httpOnly signed cookie.
2. The user signs in to the existing account.
3. The server action `mergeGuestIntoUser` verifies the cookie signature, confirms the guest has no verified identity, then calls a SQL function `merge_guest(guest_id, user_id)` (security definer, one transaction) that moves documents, analyses, messages, deadlines, and credit entries, then deletes the guest user.
4. Show "We added your 2 documents to your account".

**Returning member**: sign in, redirected to the page they came from (validated relative path only, no open redirect).

**Sign out**: clears the session. If the user was a guest with data, warn that data will be lost unless they save their work.

## 4. Pages and UI
- `/[locale]/sign-in` (single page; `?mode=signup` for sign up), reached from the header "Sign in" link. Modal version opened by "Save your work" (guests) and by paywalls; it opens on sign up. States: idle, sending, code entry, success, error, rate limited.
- Server actions in `src/server/actions/auth.ts`: `signUpAction`, `signInAction`, `verifyCodeAction`, `resendCodeAction`, `sendResetAction`, `continueWithGoogle`.
- `/[locale]/account` with tabs: **Profile** (name, language, theme), **Plan and usage** (plan, credits left, next reset, usage chart, ledger), **Privacy** (export all data as a zip of JSON plus originals, delete account), **Security** (connected identities, sign out of other devices).
- Delete account: type-to-confirm, deletes storage objects, database rows (cascade), auth user, and cancels the subscription. Sends a confirmation email.

## 5. Security requirements
- Auth is checked in server code at the data access point (use cases receive `userId`), not only in `proxy.ts`. `proxy.ts` refreshes the session and handles locale.
- Cookies: httpOnly, secure, sameSite lax. Redirect targets allow-listed.
- Custom SMTP (Resend) for auth emails. Supabase default email is for testing only and is heavily rate limited. Configure SPF, DKIM, DMARC on the sending domain. Auth email templates in en, fr, zh.
- Rate limits: code requests 5 per hour per email and per IP; verify attempts 5 per code. Use Supabase's limits plus Turnstile.
- OAuth redirect URLs set exactly per environment (localhost, preview wildcard, production).
- Email verification required before a Free member gets monthly credits (prevents farming with fake emails).
- Admin rights never come from a client claim. Admin is a row in `admins(user_id)` checked server-side.

## 6. Acceptance
All cases in `USE_CASES.md` group E pass. Auth E2E uses Supabase local with Mailpit for emails (code read from the local mailbox, http://127.0.0.1:54328).

## 7. Local test user
One shared account for manual and agent testing. Its credentials are in `apps/web/.env.test-user` (git-ignored, never committed, never in a migration).

```
pnpm test-user create            # creates it if missing (e.g. after `supabase db reset`), NOT approved
pnpm test-user approve           # approve it (same effect as entering the emailed code)
pnpm test-user reset             # credits used up? delete it with its files, create it again, approve it
pnpm test-user plan free|pro|max # switch plan (writes a "manual" row in subscriptions)
pnpm test-user status            # approved?, plan, credits
```

**Approve any user by hand:** Studio (http://127.0.0.1:54327) → Table editor → `profiles` → tick `approved`. Unticking it un-approves. No SQL needed.

- `profiles.email` and `profiles.approved` mirror `auth.users` (`email`, `email_confirmed_at`) through triggers, both ways, so they never disagree. Entering the emailed code ticks `approved`. Ticking it sets `email_confirmed_at`. A guest (no email) can't be approved.
- Users can't approve themselves: they may only update `display_name`, `locale` and `theme` on their profile.
- The view `user_overview` shows each user's email, approved, guest, plan, credits and document count on one row (service role and Studio only).

The plan comes from `subscriptions` (`effective_plan()`), not from `profiles.plan_id`. Switching plan changes limits at once, but credits already granted this month stay (the real billing rule: no claw-back mid-period). For a fresh Free balance, run `reset`. The script refuses to run against a non-local Supabase URL.
