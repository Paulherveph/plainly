# Gate report: open-source release prep

Branch `chore/open-source`, 2026-11-16. Scope: `docs/OPEN_SOURCE_PREP.md` sections 1–6. Nothing pushed, no GitHub setting changed.

## 1. Secrets and private data

| Check | Result |
|---|---|
| gitleaks (Docker, full history, 63 commits, redacted) | **0 findings** |
| Pattern search over history: `sk-ant-`, `xai-`, `AIza`, `BEGIN PRIVATE KEY`, `postgres://`, `sb_secret_…` | 1 hit, a placeholder (`sk-ant-...` in `docs/mcp/humanizer.md`); `service_role` hits are the database role name |
| Tracked env files | `apps/web/.env.example` only, placeholder values |
| Home paths, real emails, phone numbers in tracked files | 0 (emails are `example.com`, `test.local`, `.test`) |
| Owner name | `PRD.md` line 3 (kept, owner's choice) |
| Commit author email | Personal address on every commit (kept, owner's choice: no history rewrite) |
| Fixtures (`samples/`, `evals/`, `e2e/`, `test-documents/`) | All fictional |
| Gate-report screenshots | App UI with empty forms only |
| Security review (fresh-context agent) | No critical or high findings. Fixed: checkout `persist-credentials: false`, narrower document guard, `supabase/snippets/` ignored. Confirmed: proxy 404 reveals nothing about other users' documents, simulator HMAC uses WebCrypto verify |

Real-document guard: `scripts/check-files.mjs` runs first in `pnpm check` (so in CI). It fails on any PDF, image, Office, zip or email file outside the allowed folders, and site/design folders accept images only. `.gitignore` adds `private-docs/`, `local-test-docs/`, `supabase/snippets/`, `.claude/settings.local.json`, `*.local`.

## 2. Licenses

| Item | License | Action |
|---|---|---|
| Plainly | MIT (`LICENSE`, standard text, "Copyright (c) 2026 paulherveph") | kept as is |
| npm production deps (434) | MIT 354, Apache-2.0 31, ISC 14, BSD 11, BlueOak 7, others below | no blocker |
| `@img/sharp-libvips-*` | LGPL-3.0-or-later | prebuilt native lib, not modified or bundled; noted |
| `jszip` | MIT or GPL-3.0 | used under MIT |
| `sentry` | FSL-1.1-Apache-2.0 | dependency only; noted |
| `crystalized-ball.tsx` | React Bits, **MIT + Commons Clause v1.0** | documented in `THIRD_PARTY_NOTICES.md`; **open question** |
| shadcn/ui primitives | MIT | noted |
| `assets/images-mockup/` (11 files) | none (third-party marketing images) | **untracked and git-ignored**, kept on disk; still in history (**open question**) |

## 3–5. Files created or changed

- New: `THIRD_PARTY_NOTICES.md`, `scripts/check-files.mjs`, this report.
- README: real-AI costs note, fork checklist, trademark section, notices link.
- CONTRIBUTING (AGENTS.md rules, no real documents, dependency reason), SECURITY (5-day reply, no live testing or DoS, no bounty, other deployments out of scope), CODEOWNERS (sensitive paths named).
- CI: one workflow; actions pinned to commit SHAs; `persist-credentials: false`; timeouts; cancel-in-progress on PRs only; `db` job merged in (runs on every PR); dependency review on PRs; `ci-gate` job (the only required check). `supabase.yml` removed. actionlint clean.
- `walkthrough.webp` re-encoded to 4.9 MB (no tracked file over 5 MB).
- e2e: credential filling made hydration-safe (E04 flaked once on mobile).

Identity: nothing personal is hard-coded; the operator shown in the footer and Terms is `NEXT_PUBLIC_OPERATOR` (empty by default), so a separate `site.ts` was not added.

## 6. Verification

| Check | Result |
|---|---|
| `pnpm check` (document guard, Biome, tsc, 245 unit tests, dependency rules) | pass |
| `pnpm build` (production, as run by the e2e job) | pass |
| `pnpm e2e` | 90 passed, 1 flaky (fixed, auth suite 20/20 after), 15 skipped by design |
| Database: lint, 51 pgTAP tests, types drift | pass |
| gitleaks re-run on the final commit | 0 findings |

## Open questions for the owner

1. **React Bits orb**: the Commons Clause forbids redistributing the component itself, and a public repo does. Options: (a) keep it and accept the notice, (b) remove it and ship the static orb, (c) write an own orb. It is also in history.
2. **Mood-board images in history**: untracked now, but the first push publishes the old commits. Only a history rewrite or a fresh single-commit history removes them.
3. **Internal working docs**: `_handoff-01/`, `docs/PROMPTS*.md`, `docs/ECC_INVENTORY.md`, `docs/BLOCKERS.md`, `.claude/settings.json`, `CLAUDE.md`, `AGENTS.md`. No secrets; keep public (shows how it was built) or remove.
