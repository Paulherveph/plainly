# Next.js DevTools MCP

**Job**: connects Claude to your running `next dev` (Next.js 16+). Claude reads build and runtime errors, logs and the route list from the live server instead of guessing.

## Requirements

Node 20.19 or newer. Next.js 16 or newer for the runtime tools (they use the `/_next/mcp` endpoint built into the dev server).

## Install

```bash
claude mcp add --scope project next-devtools -- npx -y next-devtools-mcp@latest
```

Manual config:

```json
{ "mcpServers": { "next-devtools": { "command": "npx", "args": ["-y", "next-devtools-mcp@latest"] } } }
```

## Verify

```bash
pnpm dev          # keep it running in another terminal
claude mcp list
```

Then ask: "Next Devtools, what's in the development server logs?"

## Use

```
Next Devtools: are there any build or runtime errors right now? Fix them.
```

```
Next Devtools: list the routes of this app and tell me which ones are dynamic.
```

## Notes

- Version 0.4 of the package was reworked. Older tutorials mention tools like `upgrade_nextjs_16` that no longer exist. To upgrade an older app use `npx @next/codemod@latest upgrade latest`.
- Telemetry can be disabled with `NEXT_TELEMETRY_DISABLED=1`.
