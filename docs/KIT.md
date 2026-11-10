# Plainly — project kit

> Understand any document in plain language. What it says, what you must do, and by when.

This folder is everything Claude Code needs to build **Plainly** cleanly and fast.

## Read order

| # | File | Purpose |
|---|------|---------|
| 1 | `PRD.md` | What we build, why, scope, AI design, data model, roadmap |
| 2 | `CLAUDE.md` | Rules Claude Code follows on every task. Copy it to the repo root |
| 3 | `docs/ARCHITECTURE.md` | Layers, folder tree, dependency rule, code examples |
| 4 | `docs/DESIGN.md` | Visual system, motion rules, React Bits / Prompt Motion usage |
| 5 | `docs/mcp/README.md` | The 8 MCP servers, install order, `.mcp.json` |
| 6 | `docs/PROMPTS.md` | Copy-paste prompts, one per build phase |

## Run order for today

1. Create the repo, copy this kit into it (`CLAUDE.md` at the root, the rest under `docs/`, `PRD.md` at the root).
2. Install the MCP servers (`docs/mcp/README.md`, about 20 minutes).
3. Open Claude Code in the repo and paste the **Kickoff prompt** from `docs/PROMPTS.md`.
4. Work phase by phase. Commit after each phase.
