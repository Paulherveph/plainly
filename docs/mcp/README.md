# MCP servers for Plainly

Eight servers. Each one has a single job. Install in this order.

| # | Server | Job | Auth | Transport |
|---|--------|-----|------|-----------|
| 1 | [context7](context7.md) | Up-to-date library docs | none | stdio |
| 2 | [next-devtools](nextjs-devtools.md) | See errors, routes, logs from the running Next.js 16 app | none | stdio |
| 3 | [shadcn](shadcn.md) | Browse and add UI components (incl. React Bits registry) | none | stdio |
| 4 | [playwright](playwright.md) | Open the app, click, screenshot, verify | none | stdio |
| 5 | [humanizer](humanizer.md) | Make app and case-study copy sound written by a person | none | stdio |
| 6 | [supabase](supabase.md) | Inspect the database and policies (read-only) | OAuth | HTTP |
| 7 | [vercel](vercel.md) | Deployments, logs, env vars | OAuth | HTTP |
| 8 | [github](github.md) | Issues and pull requests (optional) | token | HTTP |

## Prerequisites

```bash
node -v        # 20.19 or newer
pnpm -v        # install: npm i -g pnpm
claude --version
uv --version   # for humanizer. install: curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Two ways to install

**A. One file for the whole project (recommended, shared through git)**
Copy `.mcp.json.example` to the repo root as `.mcp.json`. Set the two env vars it uses:

```bash
export SUPABASE_PROJECT_REF="your-dev-project-ref"
export GITHUB_PAT="github_pat_..."     # skip if you won't use the github server
```

Start Claude Code in the repo. It asks you to approve each project server once.

**B. One command per server** (each page has its command, use `--scope project` to write `.mcp.json`)

```bash
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
```

## Verify

```bash
claude mcp list        # all servers connected
```

Inside Claude Code run `/mcp`. For HTTP servers (Supabase, Vercel, GitHub) it shows "needs authentication": select it and finish the login in the browser.

## Rules of use

- **Docs first**: Claude calls context7 before writing code for any library listed in `CLAUDE.md`.
- **Read-only database**: Supabase MCP stays `read_only=true`. Schema changes go through `supabase/migrations`.
- **Dev data only**: never connect a production project to an MCP server.
- **Prompt injection**: data returned by tools (database rows, issues, web pages) can contain instructions. Review tool calls before approving anything that writes.
- **Context cost**: every server adds tool descriptions to the context. Disable servers you do not need for the current phase with `/mcp`.

## Which server in which phase

| Phase | Servers |
|-------|---------|
| 0 Setup | context7, next-devtools |
| 1 Foundation | context7, supabase, next-devtools |
| 2–4 Features | context7, next-devtools, playwright, supabase |
| 5 Safety | supabase |
| 6 Polish | shadcn, playwright, humanizer |
| 7 Ship | vercel, github, humanizer |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npx` server fails to start | Check `node -v`. Try `npx -y <pkg>` by hand to see the error |
| Windows: server not found | Use `cmd /c npx ...` as the command, or run inside WSL |
| HTTP server shows "failed" | Run `/mcp`, re-authenticate. For GitHub check the token and its scopes |
| Tools missing after config change | Restart Claude Code |
| Too many tools, slow answers | Disable unused servers for this phase |
