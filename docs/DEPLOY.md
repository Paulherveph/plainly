# Deploy (Vercel + Supabase)

Prepared in S0. Nothing is deployed yet.

## Topology
One Vercel project. **Root Directory** = `apps/web`. "Include source files outside of the Root Directory" stays enabled (the pnpm lockfile lives at the repo root).

## Project settings
- Framework: Next.js. Install: `pnpm install --frozen-lockfile`. Build: `pnpm build`. Node 22.
- Region: the one closest to the Supabase project region.

## Skip unchanged builds
`docs/`, `supabase/` and `assets/` are not workspaces, so Vercel's automatic skip counts them as global changes. `apps/web/vercel.json` sets an explicit rule:

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ../../package.json"
```

Exit 0 skips the build, exit 1 builds. It runs from `apps/web`. `package.json` at the root is included because it carries `packageManager`.

Dry run on 2026-11-14 (detached HEAD, five throwaway commits, `bash -c "<cmd>"` from `apps/web`):

| Commit touches | Expected | Result |
|---|---|---|
| `docs/` only | 0 (skip) | 0 (skip) |
| `apps/web/` | 1 (build) | 1 (build) |
| `pnpm-lock.yaml` | 1 (build) | 1 (build) |
| `supabase/` or `assets/` only | 0 (skip) | 0 (skip) |

If the clone is shallow and `HEAD^` is missing, the command fails and Vercel builds. That is the safe default.

## Environment variables
Names and scope: `apps/web/.env.example` and `apps/web/src/shared/config/env.ts`. Preview and Production use different Supabase projects. Secrets are server-only. Only `NEXT_PUBLIC_*` reach the client.

## Cron
`apps/web/vercel.json` runs `/api/cron/expire` daily at 03:17 UTC.

## Database
Migrations live in `supabase/migrations/` and are applied with the Supabase CLI from the repo root, never from Vercel.

## Rollback
Vercel: promote the previous deployment (Instant Rollback). Database: write a new forward migration; never edit an applied one.

## Troubleshooting
- Server Actions read `samples/*.pdf` through `process.cwd()`. Check on the first preview deploy that the PDFs are traced into the function.
- Next warns about several lockfiles: remove stray lockfiles in parent folders, or set `turbopack.root`.

## Supabase Auth settings for production (S3)

Apply these in the Supabase dashboard of the **production** project (and the preview project). Claude Code does not change them.

| Where | Setting | Value |
|---|---|---|
| Authentication → Sign In / Providers → Anonymous | Allow anonymous sign-ins | On |
| Authentication → Sign In / Providers → Email | Enable email provider | On |
| | Confirm email | On (email verification gates monthly credits) |
| | Email OTP length | 6 |
| | Email OTP expiration | 3600 seconds |
| | Secure email change | Off (a guest has no previous address to confirm) |
| Authentication → Sign In / Providers → Google | Enabled | On, with the Google OAuth client id and secret |
| | Skip nonce check | Off in production |
| Authentication → Sign In / Providers → (top) | Allow manual linking | On (`linkIdentity` for guests) |
| Authentication → Attack Protection → Captcha | Provider | Turnstile, secret = the Turnstile secret key |
| Authentication → Rate Limits | Emails sent per hour | 30 (with custom SMTP) |
| | Sign-ups and sign-ins per 5 min per IP | 30 |
| | Token verifications per 5 min per IP | 30 |
| | Anonymous sign-ins per hour per IP | 30 |
| Authentication → URL Configuration | Site URL | `https://<your domain>` |
| | Redirect URLs | `https://<your domain>/auth/callback`, `https://*-<team>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback` |
| Authentication → Emails → SMTP | Custom SMTP | Resend: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender `Plainly <hello@your-domain>` |
| Authentication → Emails → Templates | Magic link, Confirm signup, Change email | Paste `supabase/templates/code.html` into each, subject "Your Plainly code" |

Resend domain: add the SPF, DKIM and DMARC records Resend shows for the sending domain, and wait for "Verified" before switching SMTP.

Google Cloud console: OAuth client of type Web, authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, consent screen with the app name, logo, privacy and terms URLs.

Cloudflare Turnstile: one widget for the production hostname (and one for previews). `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` go to Vercel; the same secret goes into the Supabase captcha setting.

Admin access: add your user id to `public.admins` once, with the SQL editor: `insert into public.admins (user_id) values ('<your user id>');`

## Production launch checklist (S7)

Nothing here has been run. Work through it in order. Each step says who does it. Do not deploy until every box above "Deploy" is ticked.

### 1. Accounts and plans (owner)
- [ ] Vercel **Pro** plan: Hobby is non-commercial, and `/api/analysis` needs `maxDuration = 300`.
- [ ] Supabase **Pro** project for production, in the region closest to the Vercel region. A separate project for previews.
- [ ] Custom domain on Vercel, HTTPS on. Use the same domain in `NEXT_PUBLIC_SITE_URL`.
- [ ] Anthropic Console: an **API key** (a claude.ai or Claude Code subscription does not include API access), prepaid credit, a monthly spend limit, separate keys for preview and production.
- [ ] Resend: domain verified (SPF, DKIM, DMARC records added), API key created.
- [ ] Cloudflare Turnstile: widget for the production hostname (and one for previews).
- [ ] Sentry (optional): a project, DSN copied.
- [ ] Billing provider: not chosen yet. Production runs with `BILLING_PROVIDER=fake` and **no paid checkout** until S5. The pricing page buttons then lead to the simulator, which is 404 in production, so hide paid buttons or finish S5 before announcing prices.

### 2. Database (owner, from the repo root)
- [ ] `supabase link --project-ref <prod ref>`
- [ ] `supabase db push`: applies every migration in `supabase/migrations/`.
- [ ] Supabase advisors: `supabase db advisors` (security and performance), and fix anything critical.
- [ ] Add yourself as admin: `insert into public.admins (user_id) values ('<your user id>');`
- [ ] Backups: confirm daily backups are on (Pro), then run the restore drill in `docs/RUNBOOK.md`.

### 3. Supabase Auth settings
Apply the table in "Supabase Auth settings for production (S3)" above: anonymous sign-ins, email OTP, Google, manual linking, Turnstile captcha, rate limits, redirect URLs, Resend SMTP, the code template.

### 4. Environment variables (Vercel → Project → Settings → Environment Variables)
`P` = Production, `V` = Preview. Server-only unless the name starts with `NEXT_PUBLIC_`.

| Name | Scope | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | P, V | `https://<domain>` (preview: leave unset or the preview URL) |
| `NEXT_PUBLIC_SUPABASE_URL` | P, V | Project URL (different projects for P and V) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | P, V | Publishable key |
| `SUPABASE_SECRET_KEY` | P, V | Secret key (retention, guest merge, account deletion, flags, webhooks) |
| `ANTHROPIC_API_KEY` | P, V | Separate keys per environment |
| `AI_PROVIDERS_ALLOWED` | P, V | `anthropic` |
| `AI_PROFILE_ANALYSIS` | P, V | `anthropic:claude-sonnet-5-5` |
| `AI_PROFILE_CHAT` | P, V | `anthropic:claude-haiku-5-5,anthropic:claude-sonnet-5-5` |
| `AI_PROFILE_CHAT_DEEP` | P, V | `anthropic:claude-sonnet-5-5` |
| `AI_PROFILE_FAST` | P, V | `anthropic:claude-haiku-5-5` |
| `AI_PROFILE_TRANSLATE` | P, V | `anthropic:claude-haiku-5-5` |
| `AI_DAILY_BUDGET_USD` | P, V | Start at `5`, raise after `pnpm ai:report` |
| `AI_ALLOW_UNVERIFIED_MODELS` | P | `false` once `pnpm ai:eval` has passed and `evalPassedOn` is set in `pricing.ts`; until then `true` |
| `USE_FAKE_AI` | P, V | `false` (`true` only for load tests on a preview) |
| `RESEND_API_KEY` | P, V | Resend key |
| `EMAIL_FROM` | P, V | `Plainly <hello@<domain>>` |
| `ALERT_EMAIL` | P | Where budget alerts go |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | P, V | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | P, V | Turnstile secret (also in Supabase captcha settings) |
| `GUEST_MERGE_SECRET` | P, V | 32+ random characters (`openssl rand -base64 48`) |
| `BILLING_PROVIDER` | P, V | `fake` until S5 |
| `BILLING_WEBHOOK_SECRET` | P, V | 32+ random characters (S5: the provider's signing secret) |
| `ALLOW_FAKE_BILLING` | none | Never set outside E2E |
| `CRON_SECRET` | P | 32+ random characters (Vercel Cron sends it) |
| `SENTRY_DSN` | P | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | P | Optional, same project |
| `NEXT_PUBLIC_OPERATOR` | P | Company or sole-proprietor name and country (footer and Terms). Required before charging |

### 5. Before the first deploy (Claude Code, on request)
- [ ] `supabase db reset && pnpm db:types`: regenerates `apps/web/src/shared/lib/db-types.ts` for the new tables.
- [ ] `pnpm check`, `pnpm test:db`, `pnpm test:int`, `pnpm e2e` all green.
- [ ] `pnpm ai:samples --model anthropic:claude-sonnet-5-5`, then commit `apps/web/samples/analyses/*.json` (samples then cost 0 tokens).
- [ ] `pnpm ai:eval --model anthropic:claude-sonnet-5-5` and `--model anthropic:claude-haiku-5-5 --profile chat`: thresholds met, `evalPassedOn` set.
- [ ] Humanizer pass on the new marketing, pricing and legal copy in three locales.
- [ ] `pnpm lighthouse` on `/`, `/en/documents`, `/en/pricing`, `/en/account`.
- [ ] Fresh-reviewer gate reports in `docs/gate-reports/S2..S7.md`.

### 6. Deploy (owner says "deploy")
- [ ] Merge the stage branches into `main` and push. Vercel builds `apps/web`.
- [ ] `pnpm smoke https://<domain>`: every check passes.
- [ ] Sign up with a real email, analyze a sample and an uploaded PDF, ask a question, export your data.
- [ ] `/admin`: cost and requests appear. `pnpm ai:report --days 1 --update-baseline` once real traffic exists.

### 7. Monitoring
- [ ] Uptime check (Better Stack, UptimeRobot or Vercel) on `https://<domain>/api/health` every minute, alerting by email.
- [ ] Alert test: point the uptime check at a wrong path for one cycle and confirm the email arrives. Lower `AI_DAILY_BUDGET_USD` on a preview to trigger the 80% budget email, then restore it.
- [ ] Sentry alert rule: a new issue sends an email.

### 8. Rollback
- App: Vercel → Deployments → previous deployment → **Instant Rollback**. Test it once right after launch.
- Database: never edit an applied migration. Write a forward migration that undoes the change, `supabase db push`.
- AI emergency: `/admin` → turn AI off (`ai_enabled = false`). Reading keeps working and nobody is charged.
- Data loss: restore from the daily backup (restore drill in `docs/RUNBOOK.md`).

### 9. Soft launch
- [ ] Invite a small group (10 to 20 people), with a feedback address.
- [ ] Watch `/admin` and `pnpm ai:report` daily for the first week. Fix list in `docs/BLOCKERS.md` or issues.
- [ ] Revisit `AI_DAILY_BUDGET_USD`, the free tier size and plan prices after one week of measured cost.
