# Monorepo: `apps/web` (Stage S0)

## Verdict
Yes, move the app into `apps/web`. It costs about an hour now and it gives you: a clean Vercel root directory, a place for a second deployable later (worker, docs site, admin), and a repo where infrastructure and documentation are not mixed with app code.

**Do not add Turborepo, `packages/*` or microservices yet.** One app does not need an orchestrator. Add them when a trigger in `SCALING.md` fires.

## Target tree

```
plainly/
├─ apps/
│  └─ web/                      # The only deployable today
│     ├─ src/  messages/  public/  e2e/  evals/  samples/
│     ├─ next.config.ts  tsconfig.json  vitest.config.mts  playwright.config.ts
│     ├─ components.json  vercel.json  .dependency-cruiser.cjs
│     ├─ .env.example  .env.local          # gitignored local file moves here
│     └─ package.json                      # name: "@plainly/web"
├─ supabase/                    # migrations, seed, SQL tests (CLI runs from root)
├─ docs/                        # product and engineering docs
├─ assets/                      # design sources: mockup, images-mockup, media originals
├─ .github/workflows/
├─ package.json                 # private, root scripts only
├─ pnpm-workspace.yaml          # packages: ["apps/*"]
├─ biome.json                   # one lint/format config for the repo
├─ AGENTS.md  CLAUDE.md  PRD.md  README.md
└─ .gitignore  .mcp.json.example
```

## Steps
1. Create a branch `chore/monorepo`. Use `git mv` for every move so history survives.
2. Move into `apps/web/`: `src`, `messages`, `public`, `e2e`, `evals`, `samples`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `playwright.config.ts`, `components.json`, `vercel.json`, `.dependency-cruiser.cjs`, `.env.example`, `package.json`, and the app part of `pnpm-lock` stays at root (pnpm manages it). Move `.env.local` with plain `mv` (it is not tracked).
3. Root `pnpm-workspace.yaml`: `packages: ["apps/*"]` (keep existing `onlyBuiltDependencies` or similar fields from the current file).
4. Root `package.json` (private, no dependencies except tooling shared by all):
   ```json
   {
     "name": "plainly",
     "private": true,
     "packageManager": "pnpm@<keep current>",
     "scripts": {
       "dev": "pnpm --filter @plainly/web dev",
       "build": "pnpm --filter @plainly/web build",
       "check": "biome check . && pnpm --filter @plainly/web check",
       "e2e": "pnpm --filter @plainly/web e2e",
       "db:types": "supabase gen types typescript --local > apps/web/src/shared/lib/db-types.ts"
     }
   }
   ```
5. Fix paths: tsconfig `paths`, Tailwind/shadcn paths in `components.json`, Vitest and Playwright base dirs, dependency-cruiser `src` path, any script that references `./src`, `./samples`, `./evals`, `./messages`.
6. Classify the loose root folders: `mockup`, `images-mockup`, `media`. Anything the app serves goes to `apps/web/public/`. Design sources go to `assets/`. If a file is larger than 5 MB, say so in the report and propose Git LFS or exclusion. Do not delete without listing it first.
7. Update `.github/workflows/*` with `paths` filters so web checks run only for `apps/web/**`, `pnpm-lock.yaml`, root config; add a separate job for `supabase/**` (migration lint and SQL tests).
8. Run from the repo root: `pnpm install`, `pnpm check`, `pnpm build`, `pnpm e2e`. All must pass.

## Vercel configuration (do not deploy yet, just prepare)
- Project setting **Root Directory** = `apps/web`. "Include source files outside of the Root Directory" stays enabled (pnpm lockfile lives at root).
- **Skip unchanged builds.** Vercel's automatic monorepo skip works for pnpm workspaces, but its docs say files that are not part of the workspace definition count as global changes and trigger all projects. `docs/` and `supabase/` are not workspaces, so rely on an explicit rule instead. In `apps/web/vercel.json`:
  ```json
  { "ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ../../pnpm-lock.yaml ../../pnpm-workspace.yaml" }
  ```
  Exit code 0 means skip, 1 means build. Verify the relative paths with three test commits on a preview branch: docs-only (must skip), `apps/web` change (must build), lockfile change (must build). Document the result in `docs/DEPLOY.md`.
- Write `docs/DEPLOY.md`: project settings, env var list per environment (Preview and Production use different Supabase projects), region close to the Supabase region, how to roll back.

## Acceptance
- `git log --follow` works on moved files.
- Root commands pass. `apps/web` runs standalone with `pnpm --filter @plainly/web dev`.
- A docs-only commit does not trigger a build (proved with `ignoreCommand` dry run `bash -c '<command>'; echo $?`).
- No absolute or `../../` imports inside `apps/web/src`.
