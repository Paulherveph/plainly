# Accounts (Stage S3)

Goal: Claude-like experience. A visitor tries the product in seconds, then signs up without losing anything.

## 1. Identity model
- **Guest**: Supabase anonymous user, created on first action (not on page view), protected by Cloudflare Turnstile (Supabase Auth supports captcha for anonymous sign-ins and sign-ups; confirm the setting with Context7).
- **Member**: email or Google. A guest becomes a member **in place** so the user id and all documents stay.
- One table `profiles(user_id pk, display_name, locale, theme, plan_id, created_at, deleted_at)` created by trigger on `auth.users`.

## 2. Sign-in methods (v1)
1. **Google** (OAuth).
2. **Email one-time code** (6 digits) as the default email method. It works across devices and in-app browsers, where magic links often fail. Keep the magic link as a secondary option if simple.
No password in v1. Passkeys are a later improvement.

## 3. Flows

**Guest to member (same device)**
- Email: `updateUser({ email })` then verify code, which keeps the anonymous user id.
- Google: `linkIdentity({ provider: "google" })`. Requires manual identity linking to be enabled in Supabase Auth settings. Verify with Context7.

**Email or Google already belongs to another account (conflict)**
1. Before redirecting, store the guest id in a short-lived httpOnly signed cookie.
2. The user signs in to the existing account.
3. The server action `mergeGuestIntoUser` verifies the cookie signature, confirms the guest has no verified identity, then calls a SQL function `merge_guest(guest_id, user_id)` (security definer, one transaction) that moves documents, analyses, messages, deadlines, and credit entries, then deletes the guest user.
4. Show "We added your 2 documents to your account".

**Returning member**: sign in, redirected to the page they came from (validated relative path only, no open redirect).

**Sign out**: clears the session. If the user was a guest with data, warn that data will be lost unless they save their work.

## 4. Pages and UI
- `/[locale]/sign-in` (single page for sign in and sign up), modal version opened by "Save your work" and by paywalls. States: idle, sending, code entry, success, error, rate limited.
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
All cases in `USE_CASES.md` group E pass. Auth E2E uses Supabase local with Inbucket for emails (code read from the local mailbox).
