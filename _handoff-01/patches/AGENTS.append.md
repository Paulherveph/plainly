## Handoff 01 rules

- **Monorepo.** The app lives in `apps/web`. Shared infra (`supabase/`, `docs/`, `.github/`) stays at the root. Do not add `packages/*` until a second consumer exists.
- **Tokens are money.** Every AI call goes through `AiGateway`. Never call a provider SDK directly from a use case. Every call has a profile, a max input budget, a `maxOutputTokens`, and writes an `ai_usage` row. See `docs/TOKEN_ECONOMY.md`.
- **Provider-agnostic.** No provider name or model ID in domain or application code. Models come from `AI_PROFILE_*` env. New models must pass `pnpm ai:eval` before production use.
- **Credits.** User-facing limits are credits and entitlements (`docs/PRICING.md`). Check entitlements in the application layer, never in UI only.
- **Never block reading.** Paywalls stop new AI actions only. Existing results always stay readable.
- **Quality gate.** A stage is done only when `docs/QUALITY_GATE.md` passes for it. Max 3 fix cycles per failing item, then write `docs/BLOCKERS.md` and ask. Never weaken a test or threshold.
- **Use cases are tests.** Each case in `docs/USE_CASES.md` maps to a unit, e2e or eval test. Add the test id next to the case when implemented.
- **Copy.** All strings in `messages/{en,fr,zh}.json`, key parity enforced by a test. Humanizer pass on marketing and empty-state copy.
