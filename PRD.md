# Plainly — Product Requirements Document

**Version** 1.0 · **Owner** Paul Hervé Tatieze · **Status** Ready to build
**Tagline** Understand any document in plain language.

---

## 1. Summary

Plainly takes a confusing document (a visa letter, a lease, an offer, a bank notice, a contract) and returns:

1. A plain-language summary
2. The key facts
3. What you must do, with deadlines
4. Things to watch out for, ranked by severity
5. A chat that answers questions **from the document only**, with quotes as proof

Output can be read in English, French or Chinese, whatever language the original is in.

## 2. Why this project

| For the portfolio | For you |
|---|---|
| Real AI in the core, not a chat wrapper: structured output, source verification, guardrails, cost control | You deal with admin paperwork across Cameroon and China. You will use it |
| Visible architecture: ports and adapters, typed errors, fake adapters for tests | Not daily, but every time a letter lands you will open it, like your Ph90 site |
| Anyone can test it in 10 seconds with a sample document, no signup | Reuses your skills: Next.js, Supabase, i18n (EN/FR/ZH) |
| Clear case study: problem, constraints, decisions, results | Teaches you applied AI: prompts, schemas, evals |

## 3. Users and problems

- **Primary**: people reading documents they do not fully understand, often in a second language (students, expats, freelancers, tenants).
- **Problem**: dense language, hidden deadlines, unclear obligations, no one to ask.
- **Secondary**: recruiters and engineers reviewing your portfolio. They need a fast, safe way to try it.

## 4. Goals and non-goals

**Goals**
- First useful result in under 30 seconds from upload.
- Every claim traceable to a quote in the document.
- Works on mobile. Accessible. Fast.
- Clean architecture a senior engineer can read in 10 minutes.

**Non-goals (KISS, do not build)**
- Legal advice or verdicts. Plainly explains, it does not decide.
- OCR pipeline, vector database, RAG infrastructure (Claude reads PDFs and images natively; documents are capped).
- Payments, teams, sharing, email notifications, native apps.
- Editing or signing documents.

## 5. Core flow

```
Landing ─▶ Try sample / Upload / Paste ─▶ Analysis (streams in) ─▶ Ask questions
                                                   └──▶ Deadlines ─▶ Export .ics
```

Guests are signed in anonymously (Supabase anonymous auth) so they can try it at once. They can upgrade with Google or a magic link to keep their documents.

## 6. Features and acceptance criteria

### P0 — must ship (MVP)

| ID | Feature | Acceptance criteria |
|----|---------|---------------------|
| F1 | **Input** | Upload PDF, PNG, JPG (max 10 MB, max 20 pages) or paste text. Drag and drop, paste from clipboard, progress, clear errors for unsupported or oversized files |
| F2 | **Sample documents** | 3 built-in samples (lease, visa notice, job offer) analysable with one click, no upload |
| F3 | **Analysis** | Streams structured sections. Includes summary, key facts, actions, watch-outs, glossary. Output language selectable (en, fr, zh) |
| F4 | **Source proof** | Each fact, action and watch-out shows page and quote. Quotes that fail verification against the document text are removed, and a count of removed claims is logged |
| F5 | **Ask the document** | Streaming chat. Answers only from the document. If not found, says so. Citations are clickable and highlight the source |
| F6 | **Deadlines** | Dated actions collected on `/deadlines`, sorted, with overdue state. Export one or all as `.ics` |
| F7 | **Auth** | Anonymous by default. Upgrade with Google or magic link without losing data |
| F8 | **Privacy** | Private storage, row-level security, signed URLs, "Delete everything now" button, automatic deletion after 30 days |
| F9 | **i18n** | UI in en, fr, zh. Locale in the URL |
| F10 | **Limits** | Daily quota (guest 5, member 20 analyses). Friendly message when reached |

### P1 — should ship

- F11 Library page with search by title and filter by document type.
- F12 "Explain like I'm new" toggle (simpler wording) on the summary.
- F13 Print-friendly view of the analysis.
- F14 Shareable showreel video on the landing page (see `docs/DESIGN.md`).

### P2 — later

- Compare two versions of a document.
- Reminder emails before deadlines.
- Browser extension.

## 7. AI design

### 7.1 Models

| Task | Model (env-configurable) | Why |
|------|--------------------------|-----|
| Analysis, chat | `claude-sonnet-5-5` | Strong reading and reasoning at fair cost |
| Title, document type, language detection | `claude-haiku-5-5` | Fast and cheap |

Model IDs live in env (`AI_MODEL_ANALYSIS`, `AI_MODEL_FAST`). Check current IDs with Context7 or the Anthropic docs before release.

### 7.2 Pipeline

```
upload ─▶ validate (type, size, pages) ─▶ store (private bucket)
       ─▶ extract text server-side (for quote verification only)
       ─▶ Claude reads the original file natively ─▶ structured output (Zod schema)
       ─▶ verify each quote against extracted text ─▶ persist ─▶ stream to UI
```

Use the Vercel AI SDK for streaming structured output. Verify the exact API names with Context7, they have changed between major versions.

### 7.3 Output schema (Zod 4)

```ts
const Cite = z.object({
  page: z.number().int().positive().nullable(),
  quote: z.string().max(240),
});

export const Analysis = z.object({
  documentType: z.string(),
  language: z.enum(["en", "fr", "zh", "other"]),
  summary: z.string().max(600),
  keyFacts: z.array(z.object({ label: z.string(), value: z.string(), cite: Cite })),
  actions: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    dueOn: z.iso.date().nullable(),
    cite: Cite,
  })),
  watchOuts: z.array(z.object({
    severity: z.enum(["info", "caution", "critical"]),
    title: z.string(),
    explanation: z.string(),
    cite: Cite,
  })),
  glossary: z.array(z.object({ term: z.string(), plain: z.string() })),
});
```

### 7.4 Guardrails

- **Not legal advice.** Fixed footer on every analysis. Prompt forbids verdicts like "this is illegal".
- **Prompt injection.** Document text is data. System prompt says so. Chat has no tools and no network access.
- **Grounding.** If the answer is not in the document, the model must say "I can't find that in this document."
- **Verification.** Quote substring check after normalising whitespace and case. Failed claims are dropped.
- **Dates.** The model returns ISO dates only when the document states them. It never guesses.
- **Cost.** Page cap, size cap, daily quota, one analysis per document per locale (cached), prompt caching on the document in chat if the provider supports it.

### 7.5 Evals (small, real)

`evals/` holds 10 sample documents with expected facts and deadlines. A Vitest suite scores recall of expected deadlines and the quote-verification pass rate. Run with `pnpm eval`. Show the score in the case study.

## 8. Data model (Postgres, RLS on every table)

```
documents   id, user_id, title, kind, source_lang, storage_path, page_count,
            status (uploaded|analyzing|ready|failed), created_at, expires_at
analyses    id, document_id, locale, result jsonb, model, dropped_claims int, created_at
messages    id, document_id, role, parts jsonb, created_at
deadlines   id, document_id, user_id, label, due_on date, quote, page, done bool
usage       user_id, day date, analyses int, chats int, PRIMARY KEY (user_id, day)
```

Policy pattern: `user_id = (select auth.uid())` for select, insert, update, delete.
Storage bucket `documents` is private, path `{user_id}/{document_id}/original.ext`.
Migrations live in `supabase/migrations/` and are applied with the Supabase CLI, never by hand through MCP.

## 9. Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16, App Router, Turbopack, Cache Components | `proxy.ts` replaces `middleware.ts` |
| Language | TypeScript (strict) | `noUncheckedIndexedAccess` on |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Motion | |
| Effects | React Bits components (copy-paste) | One hero effect only |
| AI | Vercel AI SDK + `@ai-sdk/anthropic` | Claude Sonnet and Haiku |
| Backend | Supabase: Postgres, Auth (anonymous + Google + magic link), Storage | `@supabase/ssr` |
| Validation | Zod 4 | env, input, model output |
| i18n | next-intl | en, fr, zh |
| PDF text | `unpdf` | Only for quote verification |
| Quality | Biome, Vitest, Playwright, dependency-cruiser | `pnpm check` runs all |
| Hosting | Vercel | Preview per PR |
| Package manager | pnpm | Node 20.19 or newer |

Keep an up-to-date `docs/DECISIONS.md` (short ADRs) for each choice that surprised you.

## 10. Non-functional requirements

- **Performance**: landing LCP under 2.0 s on mid-range mobile. The WebGL hero loads lazily and has a static fallback.
- **Accessibility**: WCAG 2.2 AA. Keyboard complete. Reduced motion respected. Lighthouse a11y 100.
- **Security**: RLS on all tables. Server-only secrets. Rate limit by quota table. Strict CSP. Signed URLs expire in 60 s.
- **Privacy**: no document content in logs or analytics. Clear retention statement in the footer and in a Privacy page.
- **Reliability**: every async state has loading, empty, error, retry.
- **Observability**: structured logs with request id, no content. Vercel Analytics for page views only.

## 11. Roadmap

Walking skeleton today. Polished MVP in about 2 days of focused work.

| Phase | Time | Outcome | Done when |
|-------|------|---------|-----------|
| 0 Setup | 45 min | Repo, MCP, CI, env, Supabase project | `pnpm check` passes on an empty app |
| 1 Foundation | 1 h | Layout, i18n, auth (anonymous), design tokens | Guest lands on the app shell |
| 2 Analysis | 2 h | Upload, analyze a sample, streamed result with proof | F1–F4 acceptance passes |
| 3 Chat | 1 h | Ask the document with citations | F5 passes |
| 4 Deadlines | 45 min | List, overdue, `.ics` | F6 passes |
| 5 Safety | 45 min | RLS tests, quota, delete, retention | F8, F10 pass |
| 6 Landing and polish | 1.5 h | Hero, motion, empty states, copy pass | Lighthouse targets met |
| 7 Ship | 1 h | Deploy, README, evals, case study, portfolio entry | Live URL, public repo |

## 12. Launch checklist

- [ ] Live on Vercel with a custom subdomain
- [ ] A visitor can analyse a sample with zero signup
- [ ] README has a 20-second GIF, architecture diagram, stack, how to run, how to test
- [ ] E2E happy path green in CI (uses `FakeAnalyzer`, no API cost)
- [ ] Evals score published in the README
- [ ] Privacy page and "not legal advice" visible
- [ ] Case study added to paulherveph.vercel.app in en, fr, zh

## 13. Portfolio case study outline

1. **Problem**: paperwork in a second language is stressful and risky.
2. **Constraints**: privacy, cost, trust in AI output.
3. **Key decisions**: native document reading instead of a RAG stack, quote verification, ports and adapters, fake adapter for tests.
4. **Result**: demo video, eval score, Lighthouse scores, lines of code per layer.
5. **What I would do next.**

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Model invents a deadline | Quote verification, ISO dates only when stated, evals |
| Users upload very sensitive data | Private storage, 30-day deletion, delete button, honest privacy page |
| API cost spikes | Caps, quota, caching, cheap model for small tasks |
| Scope creep | Non-goals list. Anything new goes to P2 |
| Visitors test with real documents and fear leaks | Prominent samples, plain privacy statement |
