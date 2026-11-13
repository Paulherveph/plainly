# Deploy (Vercel + Supabase)

Prepared in S0. Nothing is deployed yet.

## Topology
One Vercel project. **Root Directory** = `apps/web`. "Include source files outside of the Root Directory" stays enabled (the pnpm lockfile lives at the repo root).

## Project settings
- Framework: Next.js. Install: `pnpm install --frozen-lockfile`. Build: `pnpm build`. Node 22.
- Region: the one closest to the Supabase project region.

## Skip unchanged builds
`docs/`, `supabase/` and `assets/` are not workspaces, so Vercel's automatic skip counts them as global changes. `apps/web/vercel.json` sets an explicit rule:

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ../../package.json"
```

Exit 0 skips the build, exit 1 builds. It runs from `apps/web`. `package.json` at the root is included because it carries `packageManager`.

Dry run (scratch branch, three throwaway commits, run from `apps/web`): see the results table below.

| Commit touches | Expected | Result |
|---|---|---|
| `docs/` only | 0 (skip) | see S0 gate report |
| `apps/web/` | 1 (build) | see S0 gate report |
| `pnpm-lock.yaml` | 1 (build) | see S0 gate report |
| `supabase/` or `assets/` only | 0 (skip) | see S0 gate report |

If the clone is shallow and `HEAD^` is missing, the command fails and Vercel builds. That is the safe default.

## Environment variables
Names and scope: `apps/web/.env.example` and `apps/web/src/shared/config/env.ts`. Preview and Production use different Supabase projects. Secrets are server-only. Only `NEXT_PUBLIC_*` reach the client.

## Cron
`apps/web/vercel.json` runs `/api/cron/expire` daily at 03:17 UTC.

## Database
Migrations live in `supabase/migrations/` and are applied with the Supabase CLI from the repo root, never from Vercel.

## Rollback
Vercel: promote the previous deployment (Instant Rollback). Database: write a new forward migration; never edit an applied one.

## Troubleshooting
- Server Actions read `samples/*.pdf` through `process.cwd()`. Check on the first preview deploy that the PDFs are traced into the function.
- Next warns about several lockfiles: remove stray lockfiles in parent folders, or set `turbopack.root`.
