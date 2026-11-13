# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Context7 before using any library API. Playwright MCP for every UI change (screenshots at 375, 768, 1440 px). Humanizer MCP for user-facing copy. Supabase MCP is read-only; schema changes go through migrations.
- Stage work follows `docs/ROADMAP.md`; a stage is done when `docs/QUALITY_GATE.md` passes. Max 3 fix cycles per item, then `docs/BLOCKERS.md`.
- ECC plugin: `planner` and `architect` use Opus only for S2 and S4. Pass `model: sonnet` for other stages. Never edit plugin files. See `docs/ECC_INVENTORY.md`.
- Commit locally with Conventional Commits. No push and no deploy until the owner says so.
