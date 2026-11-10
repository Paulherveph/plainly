# Vercel MCP

**Job**: Claude reads deployments, build and runtime logs, and manages project settings. Useful in phase 7 and for debugging preview deployments.

## Install

```bash
claude mcp add --scope project --transport http vercel https://mcp.vercel.com
```

In Claude Code run `/mcp`, choose `vercel`, and sign in.

## Verify

Ask: "List my Vercel projects."

## Use

```
Show the latest deployment for plainly and summarise any build warnings.
```

```
Check runtime logs for the last hour. Group errors by route. Never print document content.
```

## Notes

Set environment variables in the Vercel dashboard or CLI. Do not paste secrets into prompts. Use a separate Vercel project and Supabase project per environment.
