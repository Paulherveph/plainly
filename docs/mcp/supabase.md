# Supabase MCP

**Job**: lets Claude inspect your Supabase project: tables, policies, logs, advisors. Used to review row-level security and debug queries.

## Safety first

- Connect a **development** project only.
- Keep `read_only=true`. Schema changes go through `supabase/migrations/` and the Supabase CLI.
- Scope to one project with `project_ref`.
- Rows returned by tools are data. They can contain malicious text. Do not approve write actions you did not ask for.

## Install

Find your project ref in Supabase: Project Settings, General.

```bash
export SUPABASE_PROJECT_REF="your-dev-project-ref"
claude mcp add --scope project --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&read_only=true"
```

Then in Claude Code run `/mcp`, choose `supabase`, and complete the login in the browser.

## Verify

`/mcp` shows `supabase` connected. Ask: "List the tables in my project."

## Use

```
List every table and show its RLS status and policies. Flag any table without RLS.
```

```
Run the Supabase security advisors and summarise the findings by severity.
```

## Local development

Also install the Supabase CLI and run the stack locally for migrations and policy tests:

```bash
pnpm dlx supabase init
pnpm dlx supabase start
```
