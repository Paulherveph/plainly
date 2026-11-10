# Context7

**Job**: gives Claude current documentation for the exact library version you use, so it stops guessing outdated APIs. Essential here: Next.js 16, Tailwind v4, AI SDK and Supabase have all changed recently.

## Install

```bash
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
```

Manual config (`.mcp.json`):

```json
{ "mcpServers": { "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } } }
```

## Verify

`claude mcp list` shows `context7` connected. In Claude Code: `/mcp` lists its tools.

## Use

Add "use context7" to a prompt, or rely on the rule in `CLAUDE.md`.

```
Use context7 to check the current way to stream structured output with the Vercel AI SDK,
then implement AnthropicAnalyzer.
```

```
Use context7: how do I protect routes in Next.js 16 with proxy.ts and Supabase SSR cookies?
```

## Notes

A free API key raises rate limits. Optional. Without it the server still works.
