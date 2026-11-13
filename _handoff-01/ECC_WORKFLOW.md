# ECC workflow (use with handoff 01)

ECC (`ecc@ecc`, source `affaan-m/ECC`) is installed as a Claude Code plugin. It is large: its README lists 71 agents, 314 skills and about 98 commands. Loading all of that costs context and usage on every session, so we use a small, chosen subset.

This file adds to `INSTRUCTIONS.md`. It does not replace anything in it.

## 0. Do this before S0 (10 minutes, report the results)

1. **Verify the source.** Run `/plugin marketplace list`. The `ecc` marketplace must point to `github.com/affaan-m/ECC`. ECC's own docs warn that third-party re-uploads can contain malware. If the source is anything else, stop and tell the owner.
2. **Verify what installed.** Run `/plugin list ecc@ecc`, `/agents` and `/help`. Write the real agent names, skill names and command names into `docs/ECC_INVENTORY.md`. Use only names that appear there. The names in this file come from ECC's README and may differ in the installed version. Plugin commands are namespaced, for example `/ecc:plan`.
3. **Do not install ECC a second way.** One install method only (ECC's README says layering installs duplicates skills, commands and hooks). Do not run `npx ecc-universal setup` and do not copy hooks into `settings.json`.
4. **Read the hooks before trusting them.** Find the plugin's `hooks/hooks.json` in the plugin cache and list every hook: event, what it runs, what it reads or writes. Hooks run scripts automatically with the owner's permissions, and this machine holds API keys in `.env.local`. Save the list in `docs/ECC_INVENTORY.md`. Flag any hook that sends data off the machine, edits files without being asked, commits, pushes, or blocks commands. Propose what to keep. Do not change anything until the owner agrees.
5. **Measure the cost.** Run `/context` (built in) and the ECC context-budget command if present. Record how much context the plugin uses before any work starts. If it is above 15% of the window, propose which agents or skills to disable for this project.
6. **Check models.** Look at each agent's `model` setting. Report which ones force the most expensive model. The owner is on Claude Pro, where Opus drains the usage limit fast.

## 1. Precedence when instructions conflict
1. The owner's messages.
2. `AGENTS.md` and `docs/QUALITY_GATE.md`.
3. The rest of the handoff docs.
4. ECC defaults (its agents, skills, commands, hooks).

If an ECC hook or skill pushes against a rule above (for example its own coverage target, commit behavior, or a hook that blocks a command the gate needs), keep our rule, write the conflict in `docs/ECC_INVENTORY.md`, and tell the owner. Never edit the plugin to win.

## 2. What to use, and when

Agents run in their own context, so use them to keep the main session small and to get independent reviews.

| Need | Use | Notes |
|------|-----|-------|
| Plan a stage before coding | `planner` agent (`/ecc:plan`) | Feed it the stage doc. Plan must list the gate items it will satisfy |
| Check module boundaries and ports | `architect` agent | Run before S2 coding and again after. It reviews against `AGENTS.md` dependency rule |
| Domain logic with tests first | `tdd-guide` agent, `tdd-workflow` skill | Use for `verifyCitations`, credit math, cost formula, ICS export, merge logic |
| Independent review at each gate | `code-reviewer`, `security-reviewer`, `database-reviewer` agents | They do not know our rubric. Give each `docs/QUALITY_GATE.md` and the stage scope. Their findings feed the score |
| SQL, RLS, migrations | `database-reviewer` agent | Required for S2, S3, S4 migrations |
| Auth, webhooks, prompt injection, logging leaks | `security-reviewer` agent, `security-review` skill | Required for S2, S3, S5, S6 |
| Playwright tests | `e2e-runner` agent, `e2e-testing` skill | Use alongside Playwright MCP |
| Broken build or types | `build-error-resolver` agent | Counts toward the 3-cycle limit |
| Dead code and unused deps | `refactor-cleaner` agent | After S0 and before S7 |
| Keep docs in step with code | `doc-updater` agent | End of each stage |
| Library API lookups | `search-first` skill, Context7 MCP | If `docs-lookup` wraps Context7, use one of them per question, not both |
| TypeScript review | the TypeScript reviewer agent if listed | Check the exact name in the inventory |

Do not use: `/multi-*` commands (need another runtime), `/astra-review` (sends your diff to OpenAI), language packs for Go, Java, Rust, Python and similar, the `chrome-devtools` connector (Playwright MCP already covers it, and every extra MCP costs context). Keep total MCP servers under 10.

## 3. Stage mapping

| Stage | Plan | Build help | Gate reviewers |
|-------|------|------------|----------------|
| S0 | planner | build-error-resolver, refactor-cleaner | code-reviewer |
| S1 | planner | Playwright MCP, e2e-runner | code-reviewer |
| S2 | planner, architect | tdd-guide, security-review skill | code-reviewer, security-reviewer, database-reviewer |
| S3 | planner | e2e-runner | security-reviewer, database-reviewer |
| S4 | planner, architect | tdd-guide (credit math, concurrency) | database-reviewer, security-reviewer, code-reviewer |
| S5 | planner | security-review skill | security-reviewer, code-reviewer |
| S6 | planner | doc-updater, e2e-runner | security-reviewer, code-reviewer |
| S7 | planner | doc-updater | code-reviewer |

Each reviewer returns findings only. They do not fix. The author fixes, then the same reviewer re-checks (that re-check counts as one fix cycle).

## 4. Session discipline (saves usage)
- One stage per session. `/clear` between stages. The files carry the memory: `docs/gate-reports/`, `docs/BLOCKERS.md`, `docs/DECISIONS.md`. Prefer them over ECC's session-save commands, which are an option for very long stages.
- Check `/context` at the start of every stage and after any big read. Above 60%, summarize into a file and `/clear`.
- Use the cheaper model for routine implementation and the strongest model for planning, architecture and final review. For example `/model` to Sonnet while building, Opus for the plan and the gate. If an `opusplan` style option exists in `/model`, use it.
- Run independent read-only reviews in parallel. Do not run parallel agents that edit the same files.
- Do not load ECC rules (`rules/common` and language packs) for now. They are always-in-context, and `AGENTS.md` already holds our rules. Revisit at S2 only if Claude Code keeps drifting from the architecture, and then add `common` plus the TypeScript pack only.
- Auto mode is on. Keep the standing rules: no push, no deploy, no real-money API calls without a budget cap, never print `.env.local`.

## 5. Add-on prompts

**Before every stage**
```
Read the stage doc and docs/ECC_WORKFLOW.md section 3. Use the planner agent to produce a plan that lists which
gate items each step satisfies. Show me the plan in 10 lines, then start.
```

**At every gate**
```
Run the gate. Start code-reviewer, security-reviewer and database-reviewer (those that apply to this stage per
docs/ECC_WORKFLOW.md) in parallel, each with docs/QUALITY_GATE.md and the stage scope, findings only.
Merge their findings into docs/gate-reports/<stage>.md and score with the rubric. Fix, re-run, max 3 cycles.
```

**Context check**
```
Run /context. If usage is above 60%, write a handoff note to docs/gate-reports/_session.md with what is done,
what is next, and open questions, then tell me to /clear.
```
