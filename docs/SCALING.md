# Scaling path and architecture decisions

## 1. Decision
**A modular monolith now, with seams that make extraction mechanical later.** Microservices solve organizational and extreme-scale problems. For one developer they add cost, latency, deployment complexity and failure modes with no benefit. What matters is that the cost of splitting later is low.

## 2. The seams (build these now, they are cheap)
1. **Modules own their data.** Each module has its own tables. No cross-module SQL joins. Modules talk through application-level interfaces and ids. If `analysis` needs a document, it asks `documents` through a port.
2. **Ports for everything external**: `AiGateway`, `BillingProvider`, `FileStore`, `Mailer`, `JobQueue`, `Clock`. Adapters can change without touching use cases.
3. **`JobQueue` port** with an in-process adapter today. Long work (analysis, imports, reminders) is expressed as a job with an id, status and idempotency key, stored in a `jobs` table. Moving to a real queue later changes one adapter.
4. **Idempotency keys** on every mutation that costs money or sends something.
5. **Outbox table** `outbox_events(id, type, payload, created_at, processed_at)`. Modules write domain events in the same transaction as their change (for example `document.analyzed`, `subscription.activated`). Today a simple handler consumes them. Later a broker does.
6. **Stateless app**: no in-memory state that matters (the circuit breaker is advisory). Everything durable is in Postgres or storage.
7. **Request id** on every log line, every `ai_usage` row, and every job.
8. **Versioned boundary**: server actions and route handlers call use cases; a future public API (`/api/v1`) calls the same use cases.
9. **Config by environment**, feature flags in the database.
10. **Dependency rule enforced in CI** (`pnpm arch`), including "no module imports another module's infrastructure".

## 3. Scale ladder

| Tier | Trigger (any of) | What you change | Roughly costs |
|------|------------------|-----------------|---------------|
| T0 (now) | Under about 2k monthly active users | Vercel Pro, Supabase Pro, one region, in-process jobs | Fixed low |
| T1 | Analyses regularly exceed function duration, or retries get messy, or over about 2k MAU | Real queue and worker: add `apps/worker` consuming `jobs` (Inngest, Trigger.dev, or Supabase queues; pick by price then). The web app only enqueues | Low |
| T2 | Over about 20k MAU, DB CPU above 60%, or storage egress high | Connection pooler everywhere, read replica for library and search, CDN for signed assets, partition `ai_usage` by month, archive old rows | Medium |
| T3 | Over about 100k MAU, or enterprise customers | Extract `analysis` as a service (it already has ports and a job interface), add org accounts, SSO, audit log, regional data residency, dedicated search (OpenSearch or Typesense) if needed | High |
| T4 | Millions of users | Event streaming for the outbox, per-region deployments, multi-provider AI with committed-spend contracts, self-hosted extraction, dedicated GPU or distilled models for the cheap tier | Very high, funded by revenue |

Extract a service only when a measured trigger fires, never to look sophisticated.

## 4. Real bottlenecks, in order
1. **AI cost** and provider rate limits. Handled by `TOKEN_ECONOMY.md`, multi-provider fallback, queue with backoff.
2. **Abuse** of free usage. Turnstile, email verification, budget guard, per-IP and per-device limits.
3. **Function duration** for long documents. Jobs, persisted results, resumable UI.
4. **Postgres connections and CPU.** Pooler, indexes, RLS policies using `(select auth.uid())`.
5. **Storage egress.** Short-lived signed URLs, thumbnails, no re-downloads.

## 5. Observability (from day one, without content)
- Structured logs with request id, user id hash, error kinds. No document text, no prompts, no answers.
- Sentry (or equivalent) with a `beforeSend` scrubber and `sendDefaultPii: false`.
- Product metrics from your own tables: analyses per day, cost per analysis, cache hit rate, fallback rate by provider, conversion Free to Pro, credits used per plan, p50 and p95 latency.
- `/admin` page (admin only): cost today, error rate, provider health, flags. Read-only except flags.
- Uptime check on `/api/health` (checks DB and a cheap provider ping, no document data).

## 6. Security and compliance baseline
RLS on all tables and SQL tests for cross-user denial. Strict CSP. File type by magic bytes, size and page caps, PDF parsed in a constrained server context (no JavaScript execution), EXIF stripped from images. Signed URLs expire in 60 s. Secrets only on the server. Dependency audit in CI. Backups: Supabase daily backups plus a restore drill documented in `docs/RUNBOOK.md`. Data export and deletion (privacy rights). Document `docs/COMPLIANCE.md`: data map, processors (Supabase, Vercel, AI providers, billing, email), retention, how to answer a deletion request.

## 7. Money decisions to take early
- Keep cost per active user visible. If paid users cost more than about 40% of their revenue, change prices, caps or models before growing.
- Free tier size is a budget line, not a feature. Revisit monthly.
- Use annual plans and packs to bring cash forward.
- Do not pre-pay for infrastructure you cannot measure yet.

## 8. Launch checklist additions (S6, S7)
Vercel Pro plan, custom domain, backups verified, restore tested, Sentry live, budget guard tested by forcing a low budget, load test (k6 or Artillery, 50 concurrent users against `FakeAiGateway`), provider outage drill (disable primary via flag, confirm fallback and no user charge), runbook written.
