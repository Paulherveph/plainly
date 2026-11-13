# Runbook

What to do when something goes wrong in production. Every switch below works without a redeploy.

## Where to look first
- `GET /api/health`: database and provider circuit state. A 503 means the database is down or every provider is disabled.
- `/[locale]/admin` (admins only): AI cost today against the budget, failed attempts, fallbacks, active subscriptions, flags.
- Sentry: error types, routes and stack traces. Events are scrubbed (no document text, prompts, answers, cookies or emails).
- Vercel logs: JSON lines with an event name, ids and error kinds only (`shared/lib/log.ts`).
- `pnpm ai:report --days 1`: cost per analysis and per chat message, cache hit rate, fallback rate, margin per plan.

## Flags (`feature_flags`, applied within 30 s)
Set them on `/admin`, or with SQL as the service role: `insert into feature_flags (key, value) values (...) on conflict (key) do update set value = excluded.value, updated_at = now();`

| Key | Value | Effect |
|---|---|---|
| `ai_enabled` | `false` | Every new AI call returns `capacity` ("We are at capacity today"). Reading keeps working. Nobody is charged. |
| `provider_disabled:<name>` | `true` | Skip that provider. Requests go to the next model in each profile. |
| `profile_override:<profile>` | `"anthropic:claude-haiku-5-5"` | Replace a profile's model list (comma-separated, fallback order). Only models with a price row are used. |
| `budget_alert:<date>:<80\|100>` | `true` | Written by the budget guard so each alert email is sent once a day. Delete it to resend. |

## Incidents

**A provider is down or slow (B10, B11)**
1. Check `/admin`: failed attempts rising, provider `degraded` or `disabled`.
2. The gateway already falls back and marks the provider degraded for 60 s. If the profile has a second model, nothing else is needed.
3. If every model in a profile is on the failing provider, set `profile_override:<profile>` to a model on another provider (it needs a price row, a passing `ai:eval`, and its key in Vercel).
4. Users see "Temporarily unavailable, you were not charged". Holds are released automatically.

**AI spend spikes**
1. `/admin` shows cost today. The budget guard degrades Guest and Free at 80% and pauses them at 100%. Paid plans continue until 150%.
2. To stop everything now: `ai_enabled = false`.
3. Find the cause with `pnpm ai:report --days 1` (fallback storms, cache misses) and in `ai_usage` grouped by `user_id` (abuse).

**Abuse: many guests, scripted uploads (I01)**
1. Confirm captcha is on in Supabase Auth and the Turnstile keys are set.
2. Lower the anonymous sign-in rate limit in Supabase Auth.
3. Per-user limits are already enforced: 20 requests per minute, plan concurrency.

**Billing webhooks failing**
1. Look for `billing.webhook_rejected` in the logs. `bad_signature` means the secret is wrong; `bad_event` means the payload changed.
2. Events are stored by provider id: fix the cause, then replay from the provider dashboard. Duplicates are skipped.
3. `billing.refund_needs_review` means a refund came after the credits were used. Check the account by hand.

**Database restore drill (do it once before launch, then every quarter)**
1. Supabase → Database → Backups: note the latest daily backup time.
2. Restore it into a new project (or use point-in-time recovery on Pro).
3. Point a preview deployment at it (`NEXT_PUBLIC_SUPABASE_URL`, keys) and run `node scripts/smoke.mjs <preview url>`.
4. Write the date, the restore time and any problems in the log below.

## Drills (before launch)
- Outage and budget: `pnpm test:int` runs `drills.int.test.ts` against local Supabase. A failing primary model falls back, one `ai_usage` row is written per attempt, and credits are charged once. With the budget exceeded, analyses return `capacity` and nothing is reserved.
- Live fallback (costs a few cents): on a preview, set `provider_disabled:anthropic`, run one analysis, confirm the "Temporarily unavailable, you were not charged" message and an unchanged balance, then remove the flag.
- Load: `k6 run load/k6.js` against a preview with `USE_FAKE_AI=true`. Targets: p95 under 800 ms for pages, no 5xx.

## Log
| Date | What | Result |
|---|---|---|
| | | |
