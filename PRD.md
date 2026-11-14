# Plainly — Product Requirements Document

**Version** 1.1 · **Owner** Paul Hervé Tatieze · **Status** Ready to build
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
- Teams, public API and native apps are out of scope until after launch (see `docs/ROADMAP.md`). Sharing and email notifications stay out of the MVP.
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
| F1 | **Input** | Upload PDF, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), image (PNG, JPG, WebP) or text file (size and page limits per plan), or paste text. Drag and drop, paste from clipboard, progress, clear errors for unsupported or oversized files |
| F2 | **Sample documents** | 3 built-in samples (lease, visa notice, job offer) analysable with one click, no upload |
| F3 | **Analysis** | Streams structured sections. Includes summary, key facts, actions, watch-outs, glossary. Output language selectable (en, fr, zh) |
| F4 | **Source proof** | Each fact, action and watch-out shows page and quote. Quotes that fail verification against the document text are removed, and a count of removed claims is logged |
| F5 | **Ask the document** | Streaming chat. Answers only from the document. If not found, says so. Citations are clickable and highlight the source |
| F6 | **Deadlines** | Dated actions collected on `/deadlines`, sorted, with overdue state. Export one or all as `.ics` |
| F7 | **Auth** | Anonymous by default. Sign up and sign in with Google or email (magic link or one-time code). Guest data is kept on upgrade, and merged if the email already has an account. Account page with usage, plan, export and delete. See `docs/AUTH.md` |
| F8 | **Privacy** | Private storage, row-level security, signed URLs, "Delete everything now" button, automatic deletion after 30 days |
| F9 | **i18n** | UI in en, fr, zh. Locale in the URL |
| F10 | **Limits** | Credits and plan entitlements (Free, Pro, Max and credit packs, plus a no-account Guest trial). See `docs/PRICING.md` |
| F15 | **Multi-provider AI** | Fallback across providers and cost metering. See `docs/AI_PROVIDERS.md` |
| F16 | **Pricing page and upgrade flow** | See `docs/PRICING.md` |
| F17 | **Terms of Service page** | en, fr, zh |

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

Models are configured as profiles (`analysis`, `chat`, `fast`, `translate`) through `AI_PROFILE_*` env vars, each a comma-separated `provider:model` list in fallback order. No provider name or model ID appears in domain or application code. See `docs/AI_PROVIDERS.md`.

### 7.2 Pipeline

Text-first route: extract text, route scanned pages to vision, cache the result, retrieve pages for chat. Samples are precomputed and cost zero tokens. See `docs/TOKEN_ECONOMY.md`.

### 7.3 Output schema (Zod 4)

```ts
const Cite = z.object({
  page: z.number().int().positive().nullable(),
  quote: z.string().max(240),
});

export const Analysis = z.object({
  documentType: z.string(),
  documentDate: z.iso.date().nullable(),
  language: z.enum(["en", "fr", "zh", "other"]),
  summary: z.string().max(600),
  keyFacts: z.array(z.object({ label: z.string(), value: z.string(), cite: Cite })),
  actions: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    dueOn: z.iso.date().nullable(),
    dueRule: z.string().max(120).nullable(), // relative deadlines, e.g. "within 30 days of receipt"
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

Array caps: keyFacts 8, actions 8, watchOuts 6. Glossary is generated on demand.

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

Added by Handoff 01, all with RLS: `profiles`, `plans`, `subscriptions`, `credit_ledger` (append-only), `ai_usage`, `document_pages` (page text + tsvector for retrieval), `analysis_cache`. Page text is stored and deleted with the document; the Privacy page says so.

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
| Bot protection | Cloudflare Turnstile | |
| Email | Resend | Auth and reminder emails |
| Billing | Merchant-of-Record provider behind a `BillingProvider` port | `docs/PRICING.md` |
| Package manager | pnpm workspace (`apps/web`) | Node 20.19 or newer |

Keep an up-to-date `docs/DECISIONS.md` (short ADRs) for each choice that surprised you.

## 10. Non-functional requirements

- **Performance**: landing LCP under 2.0 s on mid-range mobile. The WebGL hero loads lazily and has a static fallback.
- **Accessibility**: WCAG 2.2 AA. Keyboard complete. Reduced motion respected. Lighthouse a11y 100.
- **Security**: RLS on all tables. Server-only secrets. Rate limit by quota table. Strict CSP. Signed URLs expire in 60 s.
- **Privacy**: no document content in logs or analytics. Clear retention statement in the footer and in a Privacy page.
- **Reliability**: every async state has loading, empty, error, retry.
- **Observability**: structured logs with request id, no content. Vercel Analytics for page views only.

## 11. Roadmap

Stages S0 to S7 with a gate each: see `docs/ROADMAP.md`.

## 12. Launch checklist

See the launch gate in `docs/QUALITY_GATE.md`.

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

---

**Changelog**
- 1.1 — Handoff 01: payments and accounts in scope, credits and plans, multi-provider AI profiles, text-first pipeline, new tables, monorepo, staged roadmap and launch gate.
