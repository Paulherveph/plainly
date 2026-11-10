# Security review checklist

Last verified: 2026-11-11, on the local stack (`supabase start`, Next.js 16.4 production build).
Each item says how it was checked, so anyone can re-run it.

Legend: ✅ verified · ⚠️ accepted trade-off (documented) · ⏳ to do before public launch

## Data access

| # | Control | Status | How it was verified |
|---|---------|--------|---------------------|
| 1 | RLS enabled on every table (`documents`, `analyses`, `messages`, `deadlines`, `usage`) | ✅ | `select tablename, rowsecurity from pg_tables where schemaname='public'` → all `t`; 17 policies |
| 2 | A user cannot read, change, delete or attach rows to another user's data | ✅ | `supabase/tests/rls.test.sql` (pgTAP, 17 assertions) via `supabase test db` |
| 3 | Child rows (analyses, messages, deadlines) must point at a document the user owns | ✅ | `owns_document()` in insert/update policies; pgTAP "cannot attach a message/analysis to someone else's document" |
| 4 | `anon` role has no table privileges | ✅ | `information_schema.role_table_grants` → no rows for `anon`; pgTAP "anon role has no table access" |
| 5 | `usage` is not writable directly; quota only through `consume_quota()` | ✅ | grant is `select` only; pgTAP "usage is not writable directly" |
| 6 | Quota cannot be exceeded by concurrent requests | ✅ | single conditional `UPDATE … where analyses < limit` (row lock); `supabase/tests/quota.test.sql` |
| 7 | `security definer` functions pin `search_path = ''` | ✅ | `pg_proc.proconfig` for `consume_quota`, `refund_quota`, `owns_document` |
| 8 | Storage bucket is private, 10 MB, PDF/PNG/JPG/text only | ✅ | `storage.buckets` → `public = f`, `file_size_limit = 10485760` |
| 9 | Storage paths are scoped to `{user_id}/…` | ✅ | storage policies on `storage.objects`; pgTAP "cannot upload into another user's folder" |
| 10 | Original files are only reachable through 60-second signed URLs | ✅ | `SIGNED_URL_SECONDS = 60` in `documents/application/queries.ts`; only the owner can request one |
| 11 | Every server read goes through the session-bound client, so RLS applies | ✅ | `server/container.ts` builds all adapters from `createSupabase()`; the service client exists only in `server/retention.ts` |
| 12 | The service (secret) key is used only by the retention job and never reaches the browser | ✅ | `grep -r sb_secret_ .next/static` → nothing; `supabase-admin.ts` imports `server-only` |

## Input and AI

| # | Control | Status | How it was verified |
|---|---------|--------|---------------------|
| 13 | Upload type, size and page count validated on the server (and again by the bucket) | ✅ | `documents/domain/document.test.ts`; e2e "unsupported files are rejected" |
| 14 | All request bodies and query strings are parsed with Zod | ✅ | `api/analysis`, `api/chat`, `api/deadlines/ics`, all Server Actions; e2e "API routes reject bad input" |
| 15 | Model output is parsed with Zod before use | ✅ | `AnalysisDraft` / `ChatDraft` `safeParse` in the adapters; `Analysis.parse` in `toAnalysis` |
| 16 | Document text is data in delimiters; the system prompt says never to follow it | ✅ | `analysis/infrastructure/prompts.ts`, `chat/infrastructure/anthropic-answerer.ts` |
| 17 | Chat has no tools and no network access | ✅ | `streamText` is called without `tools`; the answerer port has no tool surface |
| 18 | Every claim is backed by a quote that exists in the text, or it is dropped | ✅ | `verify-citations.test.ts`, `grounding.test.ts` (incl. invented quotes and smuggled instructions); e2e checks the dropped "parking" claim |
| 19 | Chat history comes from the database, never from the client | ✅ | `api/chat/route.ts` keeps only the latest user question; `answerQuestion` loads history |
| 20 | Dates are only kept when valid ISO dates stated in the document | ✅ | `toAnalysis` + `analysis.test.ts`; the prompt forbids inferring dates |

## Privacy

| # | Control | Status | How it was verified |
|---|---------|--------|---------------------|
| 21 | Document content never goes into logs or error messages | ✅ | `shared/lib/log.ts` is the only logger; every call passes ids, counts and error kinds (grep of `log(` fields); no `console.*` elsewhere |
| 22 | Document titles are not put in page metadata or URLs | ✅ | `documents/[id]/page.tsx` uses a generic title and `robots: noindex`; URLs carry only UUIDs |
| 23 | "Delete everything now" removes files and rows | ✅ | `deleteEverything` (files first, then rows with cascade); e2e "delete everything removes the guest's documents" |
| 24 | Automatic deletion after 30 days | ✅ | `/api/cron/expire` (Vercel Cron, daily, Bearer `CRON_SECRET`, constant-time compare). Verified locally: back-dated a document → `{"deleted":1}`, file 404s, children gone. Unit test `expire-documents.test.ts` |
| 25 | Cron endpoint rejects missing or wrong tokens | ✅ | `curl` without/with a wrong token → 401; e2e |
| 26 | Marketing pages never create users (no anonymous sign-up from crawlers) | ✅ | `proxy.ts` signs in anonymously only on `/documents` and `/deadlines`; verified with curl (no `sb-` cookie on `/en`) |

## Transport and browser

| # | Control | Status | How it was verified |
|---|---------|--------|---------------------|
| 27 | Security headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, COOP | ✅ | `next.config.ts`; e2e "security headers are set" |
| 28 | CSP: `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'` | ✅ | the browser never calls Supabase or Anthropic directly, so no third-party origins are allowed |
| 29 | CSP allows `'unsafe-inline'` scripts | ⚠️ | Needed for the Next.js bootstrap and the theme script. A nonce-based CSP would force every page to render dynamically and lose the prerendered shell. Mitigated: no `dangerouslySetInnerHTML`, React escapes all output, no third-party scripts. Revisit if the app adds user-generated HTML |
| 30 | Session cookies are httpOnly, same-site, managed by `@supabase/ssr`; JWTs verified with `getClaims()` | ✅ | `server/supabase.ts`, `server/supabase-proxy.ts` |
| 31 | `x-powered-by` removed | ✅ | `poweredByHeader: false`; e2e |
| 32 | Auth redirects only to same-site paths | ✅ | `safeNext()` in `app/auth/callback/route.ts` rejects `//host` and absolute URLs |

## Before public launch

| # | Item | Status |
|---|------|--------|
| 33 | Enable CAPTCHA (Turnstile) for anonymous sign-ins in the hosted Supabase project; keep its rate limit at 30/hour per IP | ⏳ |
| 34 | Configure the Google OAuth provider and SMTP for magic links in the hosted project | ⏳ |
| 35 | Clean up anonymous users older than 30 days (`delete from auth.users where is_anonymous and created_at < now() - interval '30 days'`), e.g. as a `pg_cron` job | ⏳ |
| 36 | Set `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` as Vercel environment variables (never `NEXT_PUBLIC_`) | ⏳ |
| 37 | Run `supabase db advisors` (security) against the hosted project | ⏳ |

## Re-run everything

```bash
supabase test db   # RLS + quota (24 assertions)
pnpm check         # biome, tsc, vitest, dependency rule
pnpm e2e           # fake AI, desktop + mobile
```
