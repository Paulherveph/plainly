# Architecture

**Style**: modular monolith, feature modules, ports and adapters (hexagonal) inside each module.
One deployable, clear boundaries, easy to test.

## 1. The dependency rule

```
domain  ◀──  application  ◀──  infrastructure
                 ▲                    
                 └────────────  ui / app (routes)
```

- `domain`: pure TypeScript. Entities, value objects, rules. No imports from frameworks, no I/O.
- `application`: use cases and **ports** (interfaces). Imports only `domain`.
- `infrastructure`: **adapters** that implement ports (Supabase, Anthropic). Imports `application` and `domain`.
- `ui` and `src/app`: call use cases through the container. Never import infrastructure directly.

Enforced in CI by `dependency-cruiser` (`pnpm arch`). A violation fails the build.

## 2. Folder tree

The app lives in `apps/web/`. Paths below `apps/web/` are relative to it. Shared infra stays at the repo root.

```
apps/web/
├─ src/
│  ├─ app/                          # Routing only. Thin. No business logic
│  │  ├─ [locale]/
│  │  │  ├─ (marketing)/page.tsx
│  │  │  └─ (app)/
│  │  │     ├─ documents/page.tsx
│  │  │     ├─ documents/[id]/page.tsx
│  │  │     └─ deadlines/page.tsx
│  │  └─ api/chat/route.ts          # Streaming endpoint
│  ├─ proxy.ts                      # Next.js 16 request interception (auth refresh, locale)
│  ├─ modules/
│  │  ├─ documents/
│  │  │  ├─ domain/                 # Document, DocumentStatus, limits
│  │  │  ├─ application/            # uploadDocument, deleteDocument, ports.ts
│  │  │  ├─ infrastructure/         # SupabaseDocumentRepository, SupabaseFileStore
│  │  │  └─ ui/                     # DropZone, DocumentList
│  │  ├─ analysis/
│  │  │  ├─ domain/                 # Analysis schema, verifyCitations()
│  │  │  ├─ application/            # analyzeDocument, ports.ts (DocumentAnalyzer)
│  │  │  ├─ infrastructure/         # AnthropicAnalyzer, FakeAnalyzer
│  │  │  └─ ui/                     # AnalysisView, CitationChip
│  │  ├─ chat/                      # same four folders
│  │  ├─ deadlines/                 # same four folders (+ toIcs())
│  │  └─ quota/                     # same four folders
│  ├─ shared/
│  │  ├─ ui/                        # shadcn components, design tokens
│  │  ├─ lib/                       # result.ts, errors.ts, id.ts, dates.ts
│  │  ├─ config/env.ts              # Zod-validated env, the only place that reads process.env
│  │  └─ i18n/                      # next-intl setup
│  ├─ server/
│  │  └─ container.ts               # Composition root: wires adapters to ports
├─ messages/{en,fr,zh}.json
├─ e2e/                          # Playwright
├─ evals/                        # sample documents + scoring
├─ samples/                      # built-in sample PDFs
└─ public/
   ├─ videos/                    # Rendered MP4 + WebM + poster per video
   ├─ images/                    # Device-frame screenshots for the install section
   └─ icons/                     # PWA icons (manifest: src/app/manifest.ts)
supabase/migrations/             # SQL, applied with the Supabase CLI
assets/                          # Design sources, not shipped code
├─ mockup/                       # Clickable HTML mockup made before implementation
├─ images-mockup/                # Reference images
└─ media/                        # Marketing assets, built from the real app
   ├─ capture.ts                 # Screenshots of every screen (desktop/mobile, dark/light)
   ├─ screenshots/               # WebP shots committed; PNG masters in raw/ (gitignored)
   ├─ videos/                    # One HTML file per video, driven by seek(t) (lib/engine.js)
   ├─ render.mjs                 # Frame-by-frame render → apps/web/public/videos/ (site) or out/ (social)
   └─ icons.mjs                  # Favicon / PWA icons from apps/web/src/app/icon.svg
docs/
```

## 3. Ports and adapters, by example

**Port** (`modules/analysis/application/ports.ts`)

```ts
import type { Result } from "@/shared/lib/result";
import type { Analysis } from "../domain/analysis";

export interface DocumentAnalyzer {
  analyze(input: {
    file: { bytes: Uint8Array; mediaType: string };
    locale: "en" | "fr" | "zh";
  }): AsyncIterable<Partial<Analysis>> & { final(): Promise<Result<Analysis, AnalyzeError>> };
}
```

**Use case** (`modules/analysis/application/analyze-document.ts`)

```ts
export const makeAnalyzeDocument = (deps: {
  documents: DocumentRepository;
  files: FileStore;
  analyzer: DocumentAnalyzer;
  quota: QuotaService;
  clock: Clock;
}) => async (cmd: { userId: string; documentId: string; locale: Locale }) => {
  const allowed = await deps.quota.consume(cmd.userId, "analysis");
  if (!allowed.ok) return allowed;                       // typed error, no throw

  const doc = await deps.documents.getOwned(cmd.userId, cmd.documentId);
  if (!doc.ok) return doc;

  const file = await deps.files.read(doc.value.storagePath);
  if (!file.ok) return file;

  const run = deps.analyzer.analyze({ file: file.value, locale: cmd.locale });
  // verify citations against extracted text, drop failures, persist, return
};
```

**Adapters**: `AnthropicAnalyzer` (production), `FakeAnalyzer` (tests and E2E, deterministic, free).

**Composition root** (`server/container.ts`)

```ts
export const container = () => ({
  analyzeDocument: makeAnalyzeDocument({
    documents: new SupabaseDocumentRepository(supabase()),
    files: new SupabaseFileStore(supabase()),
    analyzer: env.USE_FAKE_AI ? new FakeAnalyzer() : new AnthropicAnalyzer(model()),
    quota: new SupabaseQuotaService(supabase()),
    clock: systemClock,
  }),
});
```

## 4. Conventions

- **Result type**: `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`. Errors are small tagged unions (`{ kind: "quota_exceeded" }`).
- **Validation**: Zod schemas live in `domain`. Infrastructure parses model output and DB rows with them.
- **Server Actions** for mutations (upload, delete, upgrade). **Route Handler** only for streaming (`/api/chat`, and analysis stream if needed).
- **Data fetching**: Server Components call use cases directly. Use Cache Components (`"use cache"`) only for public, non-user data like sample documents and landing content.
- **State on the client**: URL first, then React state. No global store.
- **Naming**: files `kebab-case.ts`, components `PascalCase`, use cases `verbNoun`, ports named by capability, adapters prefixed by technology.
- **Tests**:
  - `domain`: unit tests, no mocks.
  - `application`: unit tests with in-memory fakes.
  - `infrastructure`: a few integration tests against local Supabase.
  - `e2e`: Playwright happy paths with `USE_FAKE_AI=true`.

## 5. Security boundaries

| Boundary | Control |
|----------|---------|
| Browser ⇄ app | Supabase session cookie via `@supabase/ssr`, CSP, same-site cookies |
| App ⇄ DB | RLS on every table, policies tested in `supabase/tests` |
| App ⇄ Storage | Private bucket, 60 s signed URLs |
| App ⇄ Model | Document as data in delimiters, no tools for chat, size and page caps |
| Logs | Request id and error kinds only. Never content |

## 6. `pnpm` scripts

```
dev        next dev
build      next build
check      biome check . (root) + typecheck, vitest, arch (apps/web)
arch       depcruise src --config .dependency-cruiser.cjs
eval       vitest run evals
e2e        playwright test
db:types   supabase gen types typescript --local > apps/web/src/shared/lib/db-types.ts
```

### Keeping types in sync

`apps/web/src/shared/lib/db-types.ts` is generated from the local database. Never edit it by hand. Biome ignores it on purpose.

**After every migration**, in the same commit:

```bash
supabase migration up      # or `supabase db reset` for a clean slate
pnpm db:types
pnpm check
```

If you skip this, the type check fails with errors like `Argument of type '"is_admin"' is not assignable to parameter of type '"consume_quota" | ...'` or `Property 'x' does not exist on type 'never'`: the code calls a function or column the stale file does not know. The fix is to regenerate, not to add casts.

The Supabase workflow regenerates the file and fails on any diff. When it fails, run the three commands above and commit the result. CI pins the Supabase CLI version, because `gen types` output can change between versions. When you upgrade the local CLI (`supabase --version`), bump `version:` in `.github/workflows/supabase.yml` in the same commit.

**A wall of type errors after a dependency upgrade.** Regenerate the database types first: stale DB types produce most of the noise and hide the real errors. Then fix what is left at its source, checking the installed library types (`node_modules/<pkg>/**/*.d.ts`) or Context7. Never use `any` or `@ts-expect-error`. Breaking changes seen so far:

| Upgrade | Symptom | Fix |
|---|---|---|
| Sentry 11 | `sendDefaultPii` does not exist | Replaced by `dataCollection`, whose defaults collect bodies, headers and AI inputs. We pass `SENTRY_DATA_COLLECTION` from `shared/lib/scrub.ts`, which turns every category off. Never drop it. |
| Sentry 11 | `User.id` is `string \| number` | The `ScrubbableEvent` type in `scrub.ts` follows Sentry's shape. |
| Zod 4 | `ZodEmail`/`ZodURL` not assignable to `ZodString` | Helpers take `z.ZodType`, not `z.ZodString`. |
| TypeScript 5.7+ | `Uint8Array<ArrayBufferLike>` not assignable to `BodyInit` | Type the bytes as `Uint8Array<ArrayBuffer>` where they are produced (ports included). Don't copy them. |
| unpdf 2 / pdf.js 5 | `isEvalSupported` unknown | Removed upstream, since pdf.js no longer uses `eval`. Drop the option. |

Add a row whenever an upgrade breaks something new.
