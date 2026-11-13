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
