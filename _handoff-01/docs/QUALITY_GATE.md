# Quality gate

"98% as good as the big platforms" cannot be measured by feeling. This file turns it into numbers. A stage passes only when **score ≥ 98/100 and zero blockers**.

## 1. Rules of the loop
1. Build the stage. Run the checks. Score it with the rubric.
2. Anything below target: fix and re-run. **Maximum 3 fix cycles per failing item.**
3. Still failing after 3 cycles: write `docs/BLOCKERS.md` (item, evidence, what you tried, your hypothesis, what you need from the owner) and stop. This is not a failure. It protects the owner's usage limits and prevents silent corner-cutting.
4. **Never** weaken a test, lower a threshold, skip a check, mark something as "not applicable" without a written reason, or delete a failing case to pass the gate.
5. Scoring is done by a **fresh reviewer** (a subagent or a new session) that reads only this file, the stage scope, and the repo, not the author's reasoning. The author fixes, the reviewer re-scores.
6. Write the result to `docs/gate-reports/<stage>.md` with evidence (command output, screenshot paths, numbers).

## 2. Hard blockers (any one = stage fails, score is irrelevant)
- A table without RLS, or a cross-user read/write that succeeds in the SQL tests.
- Document text, prompts, answers or secrets found in logs, analytics, Sentry events, URLs or `ai_usage`.
- A provider SDK imported outside `infrastructure`, or a model ID hardcoded outside env.
- A paid action that can run without a credit reservation, or charge twice for one request.
- A deadline or fact shown without a verified quote.
- `pnpm check` or the E2E suite failing.
- An unhandled error shown to the user as a raw message or blank screen.
- Missing translation keys between en, fr, zh.
- Accessibility: keyboard trap, missing focus state, or contrast failure on primary flows.

## 3. Rubric (100 points)

| Area | Pts | What is measured |
|------|-----|------------------|
| Functional correctness | 25 | Every relevant case in `USE_CASES.md` passes as an automated test. Score = 25 × (passed / total relevant) |
| Security and privacy | 20 | RLS tests, authorization tests, no-content-in-logs test, CSP, rate limits, deletion and export work |
| AI quality and cost | 20 | Eval thresholds met (`AI_PROVIDERS.md` section 6), cost targets met (`TOKEN_ECONOMY.md` section 9), cache and abort behavior verified |
| UX and design | 15 | Screenshot review at 390, 768, 1440, 1920 px against `DESIGN.md`. Every state present: loading, empty, error, success, offline |
| Performance and accessibility | 10 | Lighthouse (mobile) performance ≥ 90, accessibility 100, best practices ≥ 95, SEO ≥ 95. No layout shift above 0.05 |
| Reliability and operations | 10 | Provider fallback drill, budget guard drill, health endpoint, error tracking, runbook entries |

Partial credit is allowed inside an area, but a hard blocker overrides everything.

## 4. Commands (each stage must keep these green)
```
pnpm check              # biome, tsc, unit tests, dependency rules, i18n key parity
pnpm e2e                # Playwright, FakeAiGateway, FakeBillingProvider
pnpm test:db            # SQL tests (RLS, credit functions, merge function)
pnpm ai:eval            # only when AI code or prompts changed (real models, costs money)
pnpm lighthouse         # script running Lighthouse on /, /documents, /pricing, /account
pnpm ai:report          # cost and cache figures from ai_usage
```

## 5. Per-stage gate items

**S0** Root commands pass. Docs-only commit skips the deploy build (dry run). Moved files keep history. No dead folders at root.
**S1** Hero acceptance criteria in `HERO.md`. Lighthouse targets. Fallback verified with reduced motion and WebGL disabled.
**S2** Gateway is the only AI entry. Fallback drill passes (primary disabled by flag, request succeeds on the second model, one `ai_usage` row per attempt). Samples cost 0 tokens. Cache hit on re-upload. Locale switch uses translate profile. Abort stops billing. Eval thresholds met on the configured primary models. Cost report produced.
**S3** All group E cases. Guest to member keeps data. Conflict merge works. Delete account removes everything (verified by SQL). Auth emails arrive in en, fr, zh (local mailbox in tests).
**S4** All group F cases against `FakeBillingProvider`. Credit functions pass concurrency tests (50 parallel reservations never overspend). Pricing page and paywall flows in three locales. Failed AI call leaves the balance unchanged.
**S5** Provider sandbox end to end: purchase, renewal, cancel, refund, payment failure. Webhook duplicate and out-of-order tests. Tax and invoice links visible.
**S6** Terms, Privacy, Cookie notice if needed. Sentry scrubbing test. Load test and outage drills recorded. Runbook and compliance docs present. Lighthouse on all main pages.
**S7** Production smoke test script passes against the live URL. Rollback tested. Monitoring alerts received in a test.

## 6. Report template (`docs/gate-reports/<stage>.md`)
```
Stage / date / commit
Score by area (table) and total
Hard blockers: none | list
Evidence: command outputs, test counts, Lighthouse JSON paths, screenshot paths
Cost evidence (S2+): median tokens and USD per analysis, per chat message, cache hit rate, fallback rate
Deviations from the docs and why
Open risks
Reviewer: fresh session id or subagent name
```
