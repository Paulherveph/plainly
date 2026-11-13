# ECC inventory

Audit date: 2026-11-14. Read from disk, not from `/plugin` output (Claude Code cannot run its own slash commands).
Re-check with `/plugin list ecc@ecc`, `/agents` and `/context` after restarting Claude Code.

## Source

| Item | Value |
|---|---|
| Marketplace `ecc` | `git` → `https://github.com/affaan-m/ECC.git` (official) |
| Plugin | `ecc@ecc` v2.2.3, commit `d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`, user scope |
| Install path | `~/.claude/plugins/cache/ecc/ecc/2.2.3` (78 MB) |
| Install methods | Plugin only. No `npx ecc-universal`, no hooks copied into `settings.json` |
| Plugin MCP | `plugin.json` declares `mcpServers: {}`; repo `.mcp.json` lists `chrome-devtools` (not wanted, see ECC_WORKFLOW §2) |
| Loaded in the 2026-11-14 audit session? | **No.** The session started before the install; no ECC agent, skill or hook was active. Restart needed |

## Workflow names checked against the install

| Name in ECC_WORKFLOW.md | Installed? | Model |
|---|---|---|
| `planner` agent, `/ecc:plan` | yes | **opus** |
| `architect` | yes | **opus** |
| `tdd-guide`, `code-reviewer`, `security-reviewer`, `database-reviewer`, `e2e-runner`, `build-error-resolver`, `refactor-cleaner` | yes | sonnet |
| `typescript-reviewer` (the TypeScript reviewer) | yes | sonnet |
| `doc-updater` | yes | haiku |
| skills `tdd-workflow`, `e2e-testing`, `security-review`, `search-first`, `context-budget` | yes | — |
| `docs-lookup` | agent (haiku), not a skill | haiku |
| context-budget **command** | no; it is a skill (`context-budget`) | — |
| `/ecc:astra-review`, `/ecc:multi-*` (5) | present, do not use | — |

Agents forcing Opus: `architect`, `planner`, `spec-miner`, `healthcare-reviewer`. Only the first two are in our workflow.

## Hooks (`hooks/hooks.json`, profile `standard`, `hooks_enabled: true`)

Every hook runs `node` with the owner's permissions. None makes a network call to a third party. Flags: **NET** network, **EDIT** edits project files, **BLOCK** can deny a tool call, **DISK** writes under `~/.claude`.

| Event | Hook id | What it does | Flags | Proposal |
|---|---|---|---|---|
| PreToolUse Bash | `pre:bash:block-no-verify` | Denies `git commit/push … --no-verify` | BLOCK | Keep (matches QUALITY_GATE: never skip checks) |
| PreToolUse Bash | `pre:bash:auto-tmux-dev` | Rewrites `pnpm dev` etc. to run detached in tmux | rewrites command | Keep if tmux installed; otherwise harmless fallback |
| PreToolUse Bash | `pre:bash:tmux-reminder`, `pre:bash:git-push-reminder` | Print reminders | — | Keep |
| PreToolUse Bash | `pre:bash:commit-quality` | Lints staged files before `git commit`, exit 2 on failure | BLOCK | Keep; our `pnpm check` is stricter anyway |
| PreToolUse Bash/Edit/Write | `pre:*:gateguard-fact-force` | Denies the **first** edit of each file until it was searched/read this turn; always gates secrets, auth, migrations, CI | BLOCK | Keep for S2+ (auth, migrations). Costs one extra turn per new file during S0 |
| PreToolUse Write | `pre:write:doc-file-warning` | Warns on non-standard doc files | — | Keep |
| PreToolUse Edit/Write | `pre:edit-write:suggest-compact` | Suggests compaction | — | Keep |
| PreToolUse * + PostToolUse * | `pre:observe` and `post:observe:continuous-learning` (metadata calls it `pre:observe:continuous-learning`, but the scripts check these two IDs) | Logs every tool input/output (secret-scrubbed) to `~/.claude/homunculus/…/observations.jsonl` | DISK | **Disabled** (project settings). Tool output includes uploaded document text (CLAUDE.md rule 7) |
| PostToolUse * | `post:session-activity-tracker` | Appends a 220-char summary of every tool output to `~/.claude/metrics/tool-usage.jsonl` | DISK | **Disabled** (project settings), same leak as observe |
| PreToolUse * | `pre:governance-capture` | No-op unless `ECC_GOVERNANCE_CAPTURE=1` | DISK | Keep off |
| PreToolUse Edit/Write | `pre:config-protection` | Denies edits to `biome.json(c)`, eslint/prettier/ruff/stylelint configs | BLOCK | **Conflict with S0**: monorepo move must touch `biome.json`. **Disabled for S0 only** in `.claude/settings.local.json` (git-ignored). Delete that file after S0 |
| PreToolUse mcp__* / PostToolUseFailure mcp__* | `pre/post:mcp-health-check` | Probes configured MCP servers (HTTP to their own URLs), blocks calls to unhealthy ones | NET (MCP URLs only), BLOCK | Keep |
| PreToolUse * / UserPromptSubmit / Stop | `*:hookify-runtime` | Evaluates project-local Hookify rules (none exist here) | — | Keep (inert) |
| PreCompact | `pre:compact` | Saves state before compaction | DISK | Keep |
| SessionStart | `session:start` | Injects up to 8000 chars of previous-session context and learned instincts | DISK, context cost | Keep, but this is a recurring context cost |
| SessionStart / Stop | `plan-canvas-sessions`, `plan-canvas-pending` | Plan Canvas; HTTP to `127.0.0.1` only | NET (loopback) | Keep (inert) |
| PostToolUse * (sync + async dispatchers) | quality-gate, design-quality-check, edit accumulator, console warn, observe, metrics, context monitor, bash audit/cost log, pr-created, build-complete | Mostly warnings and local logs | DISK | Keep except observe (see above) |
| PostToolUseFailure Skill | `post:skill:track` | Local telemetry file | DISK | Keep |
| Stop | `stop:format-typecheck` | Runs `biome check --write` + `tsc` on files edited this turn | **EDIT** | Keep: same tools as `pnpm check`. Note it edits files unasked |
| Stop | `stop:check-console-log` | Warns on `console.log` | — | Keep |
| Stop | `stop:session-end`, `stop:evaluate-session` | Writes session summary to `~/.claude/sessions…`: last 10 user prompts (200 chars each), tool names, edited file paths. No tool output | DISK | Keep. Don't paste real document text into prompts |
| PostToolUse Bash | `post:bash:command-log-audit`, `post:bash:command-log-cost` | Appends Bash command text (not output) to `~/.claude/bash-commands.log` | DISK | Keep |
| Stop | `stop:cost-tracker` | Appends token/cost metrics to `~/.claude/metrics/costs.jsonl` | DISK | Keep (useful for S2 cost evidence) |
| Stop | `stop:desktop-notify` | macOS/WSL notification or terminal OSC 9 | — | Keep |
| SessionEnd | `session:end:marker` | Marker only | — | Keep |

Continuous-learning **observer** (background `claude` process that would send observations to the API) is `enabled: false` in `skills/continuous-learning-v2/config.json`. No hook commits or pushes.

## Context cost (estimate, before any work)

Sum of frontmatter `description` fields: agents 71 ≈ 3.7k tokens, commands 98 ≈ 3.5k tokens, skills 314 ≈ 24.2k tokens.
Upper bound ≈ **31k tokens** plus up to 2k from the SessionStart injection. Claude Code truncates long skill listings, so the real figure is lower. Confirm with `/context` after restart.

## Conflicts with our rules

1. `pre:config-protection` blocks `biome.json` edits needed by S0 (precedence: QUALITY_GATE/our stage scope wins).
2. The observe hooks (`pre:observe`, `post:observe:continuous-learning`) and `post:session-activity-tracker` persist tool output that can include user document text (CLAUDE.md rule 7).
3. Repo `.mcp.json` ships `chrome-devtools`; ECC_WORKFLOW §2 says not to use it.

## Owner decisions (2026-11-14)

1. **Hooks.** Disable switch: env `ECC_DISABLED_HOOKS` (comma-separated, case-insensitive), read by `scripts/lib/hook-flags.js`.
   - `.claude/settings.json` (committed): `pre:observe,post:observe:continuous-learning,post:session-activity-tracker`.
   - `.claude/settings.local.json` (git-ignored, S0 only): the same three plus `pre:config-protection`. A local `env` key replaces the project one, so it repeats all IDs.
   - Verified on 2026-11-14 by running `run-with-flags.js` with a `biome.json` Edit payload: with no env, exit 2 "BLOCKED"; with the local value, exit 0. `isHookEnabled` returns false for the three observe/activity IDs under the project value.
   - **After S0:** delete `.claude/settings.local.json`, restart, and show that an edit to `biome.json` is blocked again.
2. **Restart** after these settings exist; the owner runs `/context`, `/mcp`, `/agents`. Target ≤ 15% context; above that, trim language-pack skills.
3. **Models.** `planner`/`architect` use Opus only for S2 and S4. For the other stages, pass `model: sonnet` when calling the agent. Never edit plugin files. Main session: build on Sonnet; Opus for the S2 plan and final reviews.
4. **S0 commit order.** First commit is pure `git mv`, no content edits. Path and config fixes go in the second commit.

## Full name lists (v2.2.3)

### Agents (71) with model

`a11y-architect` (sonnet), `agent-evaluator` (sonnet), `architect` (opus), `bengali-reviewer` (sonnet), `build-error-resolver` (sonnet), `chief-of-staff` (sonnet), `code-architect` (sonnet), `code-explorer` (sonnet), `code-reviewer` (sonnet), `code-simplifier` (sonnet), `comment-analyzer` (haiku), `commit-reviewer` (sonnet), `conversation-analyzer` (haiku), `cpp-build-resolver` (sonnet), `cpp-reviewer` (sonnet), `csharp-reviewer` (sonnet), `dart-build-resolver` (sonnet), `database-reviewer` (sonnet), `django-build-resolver` (sonnet), `django-reviewer` (sonnet), `doc-updater` (haiku), `docs-lookup` (haiku), `e2e-runner` (sonnet), `fastapi-reviewer` (sonnet), `flutter-reviewer` (sonnet), `fsharp-reviewer` (sonnet), `gan-evaluator` (sonnet), `gan-generator` (sonnet), `gan-planner` (sonnet), `go-build-resolver` (sonnet), `go-reviewer` (sonnet), `harmonyos-app-resolver` (sonnet), `harness-optimizer` (sonnet), `healthcare-reviewer` (opus), `homelab-architect` (sonnet), `java-build-resolver` (sonnet), `java-reviewer` (sonnet), `kotlin-build-resolver` (sonnet), `kotlin-reviewer` (sonnet), `loop-operator` (sonnet), `marketing-agent` (sonnet), `mle-reviewer` (sonnet), `network-architect` (sonnet), `network-config-reviewer` (sonnet), `network-troubleshooter` (sonnet), `opensource-forker` (haiku), `opensource-packager` (haiku), `opensource-sanitizer` (sonnet), `performance-optimizer` (sonnet), `php-reviewer` (sonnet), `planner` (opus), `pr-test-analyzer` (sonnet), `python-reviewer` (sonnet), `pytorch-build-resolver` (sonnet), `rag-pipeline-reviewer` (sonnet), `react-build-resolver` (sonnet), `react-reviewer` (sonnet), `refactor-cleaner` (sonnet), `ruby-reviewer` (sonnet), `rust-build-resolver` (sonnet), `rust-reviewer` (sonnet), `security-reviewer` (sonnet), `seo-specialist` (sonnet), `silent-failure-hunter` (sonnet), `spec-miner` (opus), `swift-build-resolver` (sonnet), `swift-reviewer` (sonnet), `tdd-guide` (sonnet), `type-design-analyzer` (sonnet), `typescript-reviewer` (sonnet), `vue-reviewer` (sonnet)

### Commands (98)

`/ecc:aside`, `/ecc:astra-review`, `/ecc:auto-update`, `/ecc:build-fix`, `/ecc:checkpoint`, `/ecc:code-review`, `/ecc:cost-report`, `/ecc:cpp-build`, `/ecc:cpp-review`, `/ecc:cpp-test`, `/ecc:ecc-guide`, `/ecc:epic-claim`, `/ecc:epic-decompose`, `/ecc:epic-publish`, `/ecc:epic-review`, `/ecc:epic-sync`, `/ecc:epic-unblock`, `/ecc:epic-validate`, `/ecc:evolve`, `/ecc:fastapi-review`, `/ecc:feature-dev`, `/ecc:flutter-build`, `/ecc:flutter-review`, `/ecc:flutter-test`, `/ecc:gan-build`, `/ecc:gan-design`, `/ecc:go-build`, `/ecc:go-review`, `/ecc:go-test`, `/ecc:gradle-build`, `/ecc:harness-audit`, `/ecc:hookify-configure`, `/ecc:hookify-help`, `/ecc:hookify-list`, `/ecc:hookify`, `/ecc:instinct-export`, `/ecc:instinct-import`, `/ecc:instinct-status`, `/ecc:issue-review`, `/ecc:jira`, `/ecc:kotlin-build`, `/ecc:kotlin-review`, `/ecc:kotlin-test`, `/ecc:learn-eval`, `/ecc:learn`, `/ecc:loop-start`, `/ecc:loop-status`, `/ecc:marketing-campaign`, `/ecc:model-route`, `/ecc:multi-backend`, `/ecc:multi-execute`, `/ecc:multi-frontend`, `/ecc:multi-plan`, `/ecc:multi-workflow`, `/ecc:orch-add-feature`, `/ecc:orch-build-mvp`, `/ecc:orch-change-feature`, `/ecc:orch-fix-defect`, `/ecc:orch-refine-code`, `/ecc:orch-review`, `/ecc:plan-canvas`, `/ecc:plan-prd`, `/ecc:plan`, `/ecc:pm2`, `/ecc:pr`, `/ecc:project-init`, `/ecc:projects`, `/ecc:promote`, `/ecc:prp-commit`, `/ecc:prp-implement`, `/ecc:prp-plan`, `/ecc:prp-pr`, `/ecc:prp-prd`, `/ecc:prune`, `/ecc:python-review`, `/ecc:quality-gate`, `/ecc:react-build`, `/ecc:react-review`, `/ecc:react-test`, `/ecc:refactor-clean`, `/ecc:resume-session`, `/ecc:review-pr`, `/ecc:rust-build`, `/ecc:rust-review`, `/ecc:rust-test`, `/ecc:santa-loop`, `/ecc:save-session`, `/ecc:security-scan`, `/ecc:sessions`, `/ecc:setup-pm`, `/ecc:skill-create`, `/ecc:skill-health`, `/ecc:skill-host-compat`, `/ecc:test-coverage`, `/ecc:token-card`, `/ecc:update-codemaps`, `/ecc:update-docs`, `/ecc:vue-review`

### Skills (314)

`accessibility`, `agent-architecture-audit`, `agent-eval`, `agent-harness-construction`, `agent-introspection-debugging`, `agent-payment-x402`, `agent-runtime-gateway-smoke-test`, `agent-security-hardening`, `agent-self-evaluation`, `agent-sort`, `agentic-engineering`, `agentic-os`, `ai-first-engineering`, `ai-regression-testing`, `android-clean-architecture`, `angular-developer`, `api-connector-builder`, `api-design`, `architecture-decision-records`, `article-writing`, `automation-audit-ops`, `autonomous-agent-harness`, `autonomous-loops`, `backend-patterns`, `benchmark`, `benchmark-methodology`, `benchmark-optimization-loop`, `bengali-nlp`, `blender-motion-state-inspection`, `blueprint`, `brand-discovery`, `brand-voice`, `brownfield-retrospective`, `browser-qa`, `bun-runtime`, `canary-watch`, `carrier-relationship-management`, `change-impact`, `cisco-ios-patterns`, `ck`, `claude-devfleet`, `click-path-audit`, `clickhouse-io`, `code-tour`, `codebase-onboarding`, `codehealth-mcp`, `coding-standards`, `competitive-platform-analysis`, `competitive-report-structure`, `compose-multiplatform-patterns`, `config-gc`, `configure-ecc`, `connections-optimizer`, `content-engine`, `content-hash-cache-pattern`, `context-and-decisions`, `context-budget`, `continuous-agent-loop`, `continuous-learning`, `continuous-learning-v2`, `contract-first`, `conventional-commit-review`, `cost-aware-llm-pipeline`, `cost-tracking`, `council`, `council-multi-model`, `counterparty-channel-discipline`, `cpp-coding-standards`, `cpp-testing`, `crosspost`, `csharp-testing`, `customer-billing-ops`, `customs-trade-compliance`, `dart-flutter-patterns`, `dashboard-builder`, `data-scraper-agent`, `data-throughput-accelerator`, `database-migrations`, `deep-research`, `deepseek-harness-setup`, `defi-amm-security`, `delivery-gate`, `deployment-patterns`, `design-system`, `dev-team`, `django-celery`, `django-patterns`, `django-security`, `django-tdd`, `django-verification`, `dmux-workflows`, `docker-patterns`, `docs-governance`, `documentation-lookup`, `dotnet-patterns`, `dynamic-workflow-mode`, `e2e-testing`, `ecc-guide`, `ecc-recipes`, `ecc-tools-cost-audit`, `email-ops`, `energy-procurement`, `enterprise-agent-ops`, `error-handling`, `esign-field-placement`, `eval-harness`, `evm-token-decimals`, `exa-search`, `fal-ai-media`, `fastapi-patterns`, `finance-billing-ops`, `flox-environments`, `flutter-dart-code-review`, `foundation-models-on-device`, `frontend-a11y`, `frontend-design-direction`, `frontend-patterns`, `frontend-slides`, `fsharp-testing`, `gan-style-harness`, `gateguard`, `generating-python-installer`, `git-workflow`, `github-ops`, `golang-patterns`, `golang-testing`, `google-workspace-ops`, `growth-log`, `healthcare-cdss-patterns`, `healthcare-emr-patterns`, `healthcare-eval-harness`, `healthcare-phi-compliance`, `hermes-imports`, `hexagonal-architecture`, `hipaa-compliance`, `homelab-network-readiness`, `homelab-network-setup`, `homelab-pihole-dns`, `homelab-vlan-segmentation`, `homelab-wireguard-vpn`, `hookify-rules`, `i18n-sync`, `inherit-legacy-style`, `intent-driven-development`, `inventory-demand-planning`, `investor-materials`, `investor-outreach`, `ios-icon-gen`, `issue-review`, `iterative-retrieval`, `ito-baskets`, `ito-compute`, `ito-inference`, `ito-training`, `java-coding-standards`, `jira-integration`, `jpa-patterns`, `knowledge-ops`, `kotlin-coroutines-flows`, `kotlin-exposed-patterns`, `kotlin-ktor-patterns`, `kotlin-patterns`, `kotlin-testing`, `kubernetes-patterns`, `laravel-patterns`, `laravel-plugin-discovery`, `laravel-security`, `laravel-tdd`, `laravel-verification`, `latency-critical-systems`, `lead-intelligence`, `liquid-glass-design`, `living-docs-governance`, `llm-trading-agent-security`, `logistics-exception-management`, `loop-design-check`, `mailtrap-email-integration`, `make-interfaces-feel-better`, `manim-video`, `market-research`, `marketing-campaign`, `master-agreement-generator`, `mcp-dependency-review`, `mcp-server-patterns`, `messages-ops`, `ml-adoption-playbook`, `mle-workflow`, `module-governance`, `module-regression`, `motion-advanced`, `motion-foundations`, `motion-patterns`, `mybatis-patterns`, `mysql-patterns`, `nanoclaw-repl`, `nasiko-control-plane`, `nestjs-patterns`, `netmiko-ssh-automation`, `network-bgp-diagnostics`, `network-config-validation`, `network-interface-health`, `nextjs-turbopack`, `nodejs-keccak256`, `nutrient-document-processing`, `nuxt4-patterns`, `openclaw-persona-forge`, `opensource-pipeline`, `operator-approval-loop`, `orch-add-feature`, `orch-build-mvp`, `orch-change-feature`, `orch-fix-defect`, `orch-pipeline`, `orch-refine-code`, `osint-investigation`, `parallel-execution-optimizer`, `perl-patterns`, `perl-security`, `perl-testing`, `plan-canvas`, `plan-orchestrate`, `plankton-code-quality`, `postgres-patterns`, `prediction-market-oracle-research`, `prediction-market-risk-review`, `prisma-patterns`, `product-capability`, `product-lens`, `production-audit`, `production-scheduling`, `project-flow-ops`, `prompt-caching-strategy`, `prompt-optimizer`, `python-patterns`, `python-testing`, `pytorch-patterns`, `quality-nonconformance`, `quarkus-patterns`, `quarkus-security`, `quarkus-tdd`, `quarkus-verification`, `rails-patterns`, `ralphinho-rfc-pipeline`, `react-native-patterns`, `react-patterns`, `react-performance`, `react-testing`, `recsys-pipeline-architect`, `recursive-decision-ledger`, `redis-patterns`, `regex-vs-llm-structured-text`, `remotion-video-creation`, `repo-scan`, `research-ops`, `returns-reverse-logistics`, `rules-distill`, `rust-patterns`, `rust-testing`, `safety-guard`, `santa-method`, `scientific-db-pubmed-database`, `scientific-db-uspto-database`, `scientific-pkg-gget`, `scientific-thinking-literature-review`, `scientific-thinking-scholar-evaluation`, `search-first`, `security-bounty-hunter`, `security-review`, `security-scan`, `seo`, `skill-comply`, `skill-host-compat`, `skill-scout`, `skill-stocktake`, `social-graph-ranker`, `social-publisher`, `springboot-patterns`, `springboot-security`, `springboot-tdd`, `springboot-verification`, `story-lifecycle`, `strategic-compact`, `swift-actor-persistence`, `swift-concurrency-6-2`, `swift-protocol-di-testing`, `swiftui-patterns`, `taste`, `taste-application`, `taste-distillation`, `tasteforge-video`, `tdd-workflow`, `team-agent-orchestration`, `team-builder`, `terminal-opener`, `terminal-ops`, `test-collaboration`, `tinystruct-patterns`, `token-budget-advisor`, `token-card`, `typescript-patterns`, `ui-demo`, `ui-to-vue`, `uncloud`, `unified-memory`, `unified-notifications-ops`, `verification-loop`, `video-editing`, `videodb`, `visa-doc-translate`, `vite-patterns`, `vue-patterns`, `windows-desktop-e2e`, `workspace-surface-audit`, `x-api`
