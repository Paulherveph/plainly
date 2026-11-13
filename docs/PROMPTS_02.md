# Prompts for Claude Code (handoff 01)

Start each stage in a fresh session (`/clear`). The first prompt starts everything. Later prompts continue stage by stage.

## Start (paste once)

```
A folder named _handoff-01 is at the repo root. Read _handoff-01/INSTRUCTIONS.md completely and follow it.
First audit the repo against section 3 and show me a short list of differences between the instructions and
what you find in the code. Then apply section 1 (docs and patches) and execute stage S0 only.
Follow docs/QUALITY_GATE.md: max 3 fix cycles per failing item, then write docs/BLOCKERS.md and ask me.
Do not push and do not deploy.
```

## S1 Hero and landing
```
Stage S1. Read docs/HERO.md and docs/QUALITY_GATE.md. Implement the hero upgrade and landing fixes.
Use Playwright MCP at 390, 768, 1280, 1440, 1920 and 2560 px. Use Context7 for React Bits and Motion APIs.
Run the gate with a fresh reviewer subagent, fix, re-score. Report in the standard format.
```

## S2 Token economy and AI layer
```
Stage S2. Read docs/TOKEN_ECONOMY.md, docs/AI_PROVIDERS.md, docs/USE_CASES.md (groups A, B, C, D, F16, G02, G05, G06, G07, I03, I04) and docs/QUALITY_GATE.md.
Implement in this order, committing after each step:
1) env.ts with AI_PROFILE_* and provider keys, pricing.ts with verified prices, ai_usage migration.
2) AiGateway port, AiSdkGateway adapter (fallback, circuit breaker, caps, metering), FakeAiGateway.
3) Text-first extraction, scanned-page detection, analysis_cache, document_pages with search.
4) Analysis use case with classification, verification, persistence, resumable job, abort propagation.
5) Chat with retrieval, prompt caching, history trimming, answer dedup.
6) Locale translation via the translate profile. Precomputed samples.
7) Budget guard and feature_flags.
8) Scripts ai:try, ai:eval, ai:report. Expand evals to 10 documents + 10 unanswerable questions.
Turn each use case into a test and put the test id in USE_CASES.md.
I have set ANTHROPIC_API_KEY in .env.local. Run ai:eval on the configured models, then report the measured cost per analysis and per chat message.
Gate with a fresh reviewer. Max 3 fix cycles per item.
```

## S3 Accounts
```
Stage S3. Read docs/AUTH.md, USE_CASES.md groups E, G01, G03, G04, I01, I06, and QUALITY_GATE.md.
Use Supabase local with Inbucket for auth emails in tests. Use Context7 for current Supabase Auth APIs
(anonymous sign-in, linkIdentity, captcha, OTP). Implement everything in AUTH.md, including the guest merge function with SQL tests.
Do not change production Supabase settings yourself: write the exact dashboard settings I must change in docs/DEPLOY.md.
Gate with a fresh reviewer.
```

## S4 Credits and plans
```
Stage S4. Read docs/PRICING.md sections 1 to 6, USE_CASES.md groups C13, C15, F, I02, and QUALITY_GATE.md.
Implement ledger and SQL functions with concurrency tests, EntitlementService, plans seed, pricing page,
credit meter, paywall modals, account Plan tab, FakeBillingProvider with a dev-only simulator page.
Run the three locales through the humanizer MCP for all new copy and show me a before/after table.
Gate with a fresh reviewer.
```

## S5 Live billing (only after I tell you the provider)
```
Stage S5. Provider: <NAME>. Read docs/PRICING.md sections 6 to 8. Implement only this provider adapter with its
sandbox, webhooks, portal and invoices. Use Context7 and the provider's official docs for current APIs.
Prove duplicate, out-of-order and bad-signature webhooks. Gate with a fresh reviewer.
```

## S6 Hardening and legal
```
Stage S6. Read docs/SCALING.md sections 5 to 8, USE_CASES.md groups G08, H, and QUALITY_GATE.md.
Implement Terms and updated Privacy in three locales (humanizer pass), Sentry with scrubbing and a test,
/api/health, /admin read-only page, PWA offline results, print view, load test with FakeAiGateway,
provider outage and budget drills, docs/RUNBOOK.md and docs/COMPLIANCE.md. Gate with a fresh reviewer.
```

## S7 Soft launch
```
Stage S7. Prepare the production checklist in docs/DEPLOY.md, write the smoke test script, and list every
environment variable and dashboard setting I must apply. Do not deploy. Wait for me to say "deploy".
```

## Helpers

**Stuck**
```
You have hit the 3-cycle limit. Write docs/BLOCKERS.md with: the failing item, evidence, what you tried,
your best hypothesis, two options with trade-offs. Then stop and ask me.
```

**Fresh reviewer** (run as a subagent)
```
You are an independent reviewer. Read only docs/QUALITY_GATE.md, the stage scope in docs/ROADMAP.md and the repo.
Run the commands, inspect the screenshots, score each area with evidence, list hard blockers. Do not fix anything.
Output the gate report format.
```

**Cost review**
```
Run pnpm ai:report. Show median tokens and cost per analysis and per chat message, cache hit rate, fallback rate,
and the implied margin per plan from credits.config.ts. Propose changes if any plan has margin under 3x.
```
