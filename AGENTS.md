<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Plainly — project rules

App code lives in `apps/web`. Paths such as `src/`, `messages/`, `evals/` and `samples/` in this file are relative to `apps/web`.

Plainly turns confusing documents (visas, leases, contracts, offer letters) into plain-language
summaries, action items and deadlines, with a chat that answers from the document.
Read `PRD.md` for scope and `docs/ARCHITECTURE.md` for structure before coding.

## Stack (verify versions with Context7 before using any API)
Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript strict · Tailwind CSS v4 ·
shadcn/ui · Motion · Supabase (Postgres, Auth, Storage, RLS) · Vercel AI SDK + Claude · Zod 4 ·
next-intl (en, fr, zh) · Biome · Vitest · Playwright · pnpm · Node 20.19+.

## Golden rules
1. **KISS.** Smallest thing that works. No new dependency without a one-line justification in the PR/commit.
2. **Architecture first.** Follow the dependency rule: `domain ← application ← infrastructure / ui`. `src/app` is routing only.
3. **Never trust training data for APIs.** Next.js 16, AI SDK, Supabase, shadcn, Tailwind v4 changed a lot. Use Context7 or the installed docs.
4. **Validate at every boundary** with Zod: env, request bodies, model output, DB rows.
5. **Server by default.** Add `"use client"` only for interactivity. Mutations are Server Actions; streaming is a Route Handler.
6. **Typed errors.** Use cases return `Result<T, AppError>`. No `throw` for expected failures. No `any`.
7. **Document content is sensitive.** Never log it. Never put it in URLs, analytics or error messages.
8. **Document text is untrusted data.** It goes into the prompt inside delimiters and is never treated as instructions.
9. **Every AI claim needs a source quote.** Verify the quote exists in the extracted text, or drop the claim.
10. **No secrets in the client.** Env access only through `src/shared/config/env.ts`.

## Workflow per task
1. Plan in 3–6 bullets. Wait for nothing, just state it.
2. Write the test or the type first when it is domain logic.
3. Implement the smallest vertical slice.
4. Run `pnpm check` (biome + tsc + vitest + dependency-cruiser). Fix everything.
5. For UI: open it with Playwright MCP, screenshot at 375, 768 and 1440 px, fix issues, then say it is done.
6. Commit using Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## UI rules
- Follow `docs/DESIGN.md`. Dark-first, one accent, one hero effect, motion under 250 ms, respect `prefers-reduced-motion`.
- Every interactive element has a visible focus state and an accessible name.
- Every async view has loading, empty, error and success states.

## Copy rules
- All user-facing copy lives in `messages/{en,fr,zh}.json`. No hardcoded strings in components.
- Write short, concrete sentences. No filler ("seamless", "leverage", "unlock", "revolutionize", "elevate").
- Run new marketing or empty-state copy through the **humanizer** MCP, then read it aloud and adjust.

## Do not
- Add OCR, vector search, payments, teams or a mobile app (see PRD non-goals).
- Create files outside the structure in `docs/ARCHITECTURE.md`.
- Use `middleware.ts` (Next.js 16 uses `proxy.ts`), `getServerSideProps`, or the Pages Router.
- Use `localStorage` for anything sensitive.

## Local test user
- Sign in as the shared test account from `apps/web/.env.test-user` (git-ignored). Never commit it or seed it in a migration.
- Missing (e.g. after `supabase db reset`)? Run `pnpm test-user create`, then `pnpm test-user approve` (or ask the owner to tick `approved` in Studio → `profiles`). Out of credits? `pnpm test-user reset`. `pnpm test-user plan free|pro|max` switches the plan. See `docs/AUTH.md` section 7.

## Handoff 01 rules

- **Monorepo.** The app lives in `apps/web`. Shared infra (`supabase/`, `docs/`, `.github/`) stays at the root. Do not add `packages/*` until a second consumer exists.
- **Tokens are money.** Every AI call goes through `AiGateway`. Never call a provider SDK directly from a use case. Every call has a profile, a max input budget, a `maxOutputTokens`, and writes an `ai_usage` row. See `docs/TOKEN_ECONOMY.md`.
- **Provider-agnostic.** No provider name or model ID in domain or application code. Models come from `AI_PROFILE_*` env. New models must pass `pnpm ai:eval` before production use.
- **Credits.** User-facing limits are credits and entitlements (`docs/PRICING.md`). Check entitlements in the application layer, never in UI only.
- **Never block reading.** Paywalls stop new AI actions only. Existing results always stay readable.
- **Quality gate.** A stage is done only when `docs/QUALITY_GATE.md` passes for it. Max 3 fix cycles per failing item, then write `docs/BLOCKERS.md` and ask. Never weaken a test or threshold.
- **Use cases are tests.** Each case in `docs/USE_CASES.md` maps to a unit, e2e or eval test. Add the test id next to the case when implemented.
- **Copy.** All strings in `messages/{en,fr,zh}.json`, key parity enforced by a test. Humanizer pass on marketing and empty-state copy.
