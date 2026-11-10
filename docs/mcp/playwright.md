# Playwright MCP

**Job**: Claude opens a real browser, navigates your app, clicks, fills forms, reads the page and takes screenshots. This is how it checks its own UI work.

## Install

```bash
claude mcp add --scope project playwright -- npx @playwright/mcp@latest
npx playwright install chromium
```

Manual config:

```json
{ "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
```

## Verify

Run `pnpm dev`, then ask: "Open http://localhost:3000 and take a screenshot."

## Use

```
Open http://localhost:3000/en. Screenshot at 375x812, 768x1024 and 1440x900.
Compare with docs/DESIGN.md and list every issue. Fix and re-check.
```

```
Walk the happy path: click "Try a sample", wait for the analysis, open a citation, ask a question.
Report any console error or failed network request.
```

## Notes

Use it for exploration. Keep the repeatable checks as real Playwright tests in `e2e/` with `USE_FAKE_AI=true`.
