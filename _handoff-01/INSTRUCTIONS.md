# Handoff 01 — Instructions for Claude Code

You are receiving this folder at the repo root: `_handoff-01/`.
Execute it end to end, then delete the folder (last step). Do not ask the owner to do manual file work.

## 0. Ground rules (read first)

1. **Do not push to GitHub and do not deploy** until the owner says so. Commit locally only.
2. **Audit before changing.** Read `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `package.json`, the tree, and run `pnpm check`. The owner described the repo from screenshots, so verify every claim in section 3 against the code. Report differences instead of assuming.
3. **Work in stages** (`docs/ROADMAP.md`). A stage is finished only when its gate in `docs/QUALITY_GATE.md` passes. Do not start the next stage before that.
4. **Iteration cap.** For each failing gate item, try at most **3 fix cycles**. If it still fails, write the evidence in `docs/BLOCKERS.md` (what failed, what you tried, your hypothesis, what you need) and stop to ask. Never lower a threshold, delete a test, or skip a check to pass a gate.
5. **Use the MCP servers.** Context7 before using any library API. Playwright MCP for every UI change. Humanizer MCP for user-facing copy. Supabase MCP read-only; schema changes only by migration.
6. **KISS.** Every new dependency gets a one-line reason in its commit message.
7. **Secrets** never enter the repo, the client bundle, logs or prompts. Env names are in section 4.
8. One commit per logical step, Conventional Commits.

## 1. Apply the files in this folder

| Source in `_handoff-01/` | Destination | Action |
|---|---|---|
| `docs/*.md` | `docs/` | Copy. If a file with the same name exists, merge, keep project-specific facts |
| `patches/AGENTS.append.md` | `AGENTS.md` | Append under a new "Handoff 01 rules" heading, de-duplicate with existing rules |
| `patches/PRD.changes.md` | `PRD.md` | Apply each change, bump version to 1.1, add a changelog line at the bottom |

Then make `CLAUDE.md` a thin file: `@AGENTS.md` plus Claude-Code-only notes (MCP usage, workflow). `AGENTS.md` is the single source of truth for project rules.

Commit: `docs: add handoff 01 documentation`.

## 2. Execute stages in this order (start with S0)

Detailed scope, deliverables and gates are in `docs/ROADMAP.md`. Prompts per stage are in `docs/PROMPTS_02.md`.

| Stage | Name | Doc to follow |
|---|---|---|
| S0 | Monorepo restructure and repo hygiene | `docs/MONOREPO.md` |
| S1 | Hero and landing upgrade (parallel quick win) | `docs/HERO.md` |
| S2 | Token economy and multi-provider AI layer | `docs/TOKEN_ECONOMY.md`, `docs/AI_PROVIDERS.md` |
| S3 | Accounts: sign up, sign in, account page | `docs/AUTH.md` |
| S4 | Credits, plans, paywall UX (fake billing) | `docs/PRICING.md` |
| S5 | Live billing | `docs/PRICING.md` section 7 (only after the owner confirms the provider) |
| S6 | Production hardening and legal pages | `docs/SCALING.md`, `docs/QUALITY_GATE.md` |
| S7 | Soft launch | `docs/QUALITY_GATE.md` launch gate |

Every stage must satisfy the relevant cases in `docs/USE_CASES.md`. Turn those cases into tests (unit, e2e or eval, as the "Level" column says).

## 3. Findings to verify and fix (from the owner's screenshots)

| # | Finding | Action |
|---|---------|--------|
| 1 | Final landing CTA card shows a flat purple rectangle with a black square or a "p.1 · §4" chip. It looks unfinished | Inspect the media component. Fix, or remove it. Decide with Playwright screenshots |
| 2 | "See it work" clips contain text too small to read inside small frames | Crop and zoom each clip to one region, or replace with a static annotated screenshot |
| 3 | The site container is about 1120 px. On 2560 px and 4K screens everything feels small | See `docs/HERO.md`, fluid container and type scale |
| 4 | Hero orb is small and decorative | See `docs/HERO.md` |
| 5 | Privacy page names "Anthropic Claude" as the only provider | Generate the provider list from the enabled providers (`AI_PROVIDERS_ALLOWED`) |
| 6 | No Terms of Service, no cookie/consent policy page | Add Terms page (en, fr, zh) before billing goes live. Add consent banner only if non-essential cookies or analytics are used |
| 7 | `AGENTS.md` and `CLAUDE.md` both exist | Merge as described in section 1 |
| 8 | Root folders `mockup`, `images-mockup`, `media` | Classify: deployed assets go to `apps/web/public`, design sources go to `assets/`. Large binaries: check size, consider Git LFS or exclude |
| 9 | i18n completeness | Add a test that fails when `en`, `fr`, `zh` message keys differ |
| 10 | Landing nav shows app links to visitors | Keep, but add a "Pricing" link after S4 |
| 11 | SEO and sharing | Add per-locale metadata, `hreflang`, OG image, `sitemap.xml`, `robots.txt` |
| 12 | Vercel Hobby plan is for non-commercial use | Before charging money use a Pro plan. Note it in `docs/SCALING.md` launch checklist |

## 4. Environment variables

Add to `.env.example` (no real values) and to `src/shared/config/env.ts` (Zod, server-only unless prefixed `NEXT_PUBLIC_`). Replace the old `AI_MODEL_ANALYSIS` and `AI_MODEL_FAST`.

```
# Providers (set only the ones you use)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
XAI_API_KEY=
AI_PROVIDERS_ALLOWED=anthropic

# Model profiles: comma-separated "provider:model" in fallback order
AI_PROFILE_ANALYSIS=anthropic:claude-sonnet-5-5
AI_PROFILE_CHAT=anthropic:claude-sonnet-5-5
AI_PROFILE_FAST=anthropic:claude-haiku-5-5
AI_PROFILE_TRANSLATE=anthropic:claude-haiku-5-5

# Safety rails
AI_DAILY_BUDGET_USD=5
AI_ALLOW_UNVERIFIED_MODELS=false
USE_FAKE_AI=false

# Bot protection (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Billing (S4 uses "fake", S5 switches)
BILLING_PROVIDER=fake
BILLING_WEBHOOK_SECRET=
```

**Important for the owner (tell them in your final report):** a Claude Pro subscription pays for claude.ai and Claude Code. The app's runtime AI calls need an **API key** from the Anthropic Console with prepaid credit. The same is true for ChatGPT, Grok and Gemini: their chat subscriptions do not include API access. Set a monthly spend limit in each console.

## 5. Final report format

When a stage ends, output exactly:

```
Stage: S?  Status: PASSED | BLOCKED
Gate score: xx/100 (blockers: n)
What shipped: 3–6 bullets
Evidence: commands run, test counts, Lighthouse scores, screenshots paths
Cost evidence (S2+): tokens and USD per analysis / per chat message, cache hit rate
Open risks: bullets
Next: one line
```

## 6. Cleanup (last step)

After S7 or when the owner says handoff 01 is complete: delete `_handoff-01/` in its own commit `chore: remove handoff 01 folder`. Keep everything that was copied into `docs/`.
