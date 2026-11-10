# Prompts for Claude Code

Paste one per phase. Start a fresh session between phases (`/clear`) so context stays clean.
Each prompt assumes `CLAUDE.md`, `PRD.md` and `docs/` are in the repo.

---

## Kickoff (once)

```
Read CLAUDE.md, PRD.md, docs/ARCHITECTURE.md and docs/DESIGN.md.
Then, before writing code, use Context7 to confirm current setup steps for: Next.js 16,
Tailwind CSS v4, shadcn/ui, next-intl, @supabase/ssr, the Vercel AI SDK, and Zod 4.
Give me a 10-line plan for Phase 0 and Phase 1 and list any version conflicts you found.
Do not install anything until I say go.
```

## Phase 0 — Setup (45 min)

```
Go. Create the Next.js 16 app in this folder with TypeScript strict, Tailwind v4, pnpm, Biome.
Add shadcn/ui, Vitest, Playwright, dependency-cruiser and the folder structure from docs/ARCHITECTURE.md.
Create src/shared/config/env.ts (Zod), .env.example, the `pnpm check` script, and a GitHub Actions workflow
that runs it. Add the dependency rule to .dependency-cruiser.cjs. Make `pnpm check` pass on the empty app.
Commit as chore: bootstrap.
```

## Phase 1 — Foundation (1 h)

```
Implement: next-intl with en, fr, zh and locale routing; proxy.ts for session refresh and locale;
Supabase client helpers with @supabase/ssr; anonymous sign-in on first visit; design tokens from
docs/DESIGN.md as CSS variables; app shell with header, locale switch and theme toggle.
Create the first Supabase migration for all tables in PRD section 8 with RLS policies and add
SQL tests proving a user cannot read another user's rows.
Verify with Playwright MCP at 375 and 1440 px.
```

## Phase 2 — Analysis (2 h)

```
Build the documents and analysis modules following docs/ARCHITECTURE.md exactly.
1) domain: Analysis schema (PRD 7.3) and verifyCitations() with unit tests.
2) application: uploadDocument, analyzeDocument, ports.
3) infrastructure: SupabaseDocumentRepository, SupabaseFileStore, FakeAnalyzer, AnthropicAnalyzer.
4) ui: DropZone, sample-document picker (3 samples in /samples), AnalysisView that streams section by section,
   CitationChip with a side sheet.
Use Context7 for the current AI SDK structured-output streaming API before writing AnthropicAnalyzer.
Add an E2E test for "analyse a sample" using USE_FAKE_AI=true.
```

## Phase 3 — Chat (1 h)

```
Build the chat module. Route handler /api/chat streams answers grounded in the document only,
with citations that pass the same verification as analysis. No tools. Document text is data inside delimiters.
UI: message list, streaming, stop button, retry, citation chips that scroll the preview to the page.
Add unit tests for the grounding refusal ("I can't find that in this document").
```

## Phase 4 — Deadlines (45 min)

```
Build the deadlines module: derive rows from analysis.actions with dueOn, page /deadlines with
sorted list, overdue state, mark done, and toIcs() export (single and all). Unit-test toIcs with
fixed dates and time zones. Keep it simple, no reminders.
```

## Phase 5 — Safety (45 min)

```
Implement quota (guest 5/day, member 20/day) via the usage table and a SQL function called inside a
transaction. Add the delete-everything action, 30-day expiry (Supabase scheduled job or Vercel Cron),
and a Privacy page. Add a security review checklist to docs/SECURITY.md and verify each item.
Use Supabase MCP in read-only mode to inspect policies; apply changes only via migrations.
```

## Phase 6 — Landing and polish (1.5 h)

```
Build the landing page per docs/DESIGN.md. Add the React Bits background (lazy, mobile particle count,
static fallback). Use shadcn MCP for components. Write all copy in en, fr, zh in messages/*.json,
then run every user-facing string through the humanizer MCP and show me a before/after table.
Run Lighthouse via Playwright and fix anything under target. Verify at 375, 768, 1440.
```

## Phase 7 — Ship (1 h)

```
Prepare release: README with GIF placeholder, architecture diagram (Mermaid), stack, run and test instructions;
evals/ with 10 documents and `pnpm eval`; docs/DECISIONS.md with 5 ADRs; deploy to Vercel with Vercel MCP,
set env vars, check logs. Then draft the case study for my portfolio following PRD section 13,
in en, fr, zh, and run it through the humanizer.
```

---

## Reusable prompts

**Review**
```
Review the last commit as a senior engineer. Check the dependency rule, error handling, accessibility,
leaks of document content in logs, and missing tests. List problems by severity. Do not fix yet.
```

**Visual pass**
```
Open the page with Playwright MCP at 375, 768, 1440. Screenshot each. List spacing, contrast, alignment and
motion issues against docs/DESIGN.md. Fix them, then screenshot again.
```

**Humanize copy**
```
Take these strings from messages/en.json. Run them through the humanizer MCP. Keep meaning and length.
Return a table: before, after, what changed. Do not apply until I approve.
```

**Demo video (Prompt Motion)**
```
I picked this prompt from prompt-motion.com: <paste>. Adapt it to Plainly: dark UI, accent #9478FF,
show: drop a lease, summary streams in, a deadline gets highlighted, a citation opens the source page.
20 seconds, 1080p, no music. Output the project files and the render command.
```
