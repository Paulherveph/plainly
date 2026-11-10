# Decisions

Short ADRs for choices a reviewer might question. Newest last.

## ADR 1 — Claude reads the file; no OCR, no RAG

**Context.** Documents are short (20 pages max) and visual: tables, stamps, scans.
**Decision.** Send the original PDF or image to Claude as a file part. Extract page text with `unpdf` only to verify quotes and ground the chat. Images, which have no text layer, are transcribed once by the fast model, and only for verification.
**Why.** No embedding store, chunking or retrieval tuning to maintain, and the model sees the real layout. Page caps keep the cost bounded.
**Cost.** Every chat turn resends the document. The document block is marked for prompt caching, so repeat turns are cheap.

## ADR 2 — Trust comes from quote verification, and failed claims are dropped

**Context.** A plausible invented deadline is worse than no answer.
**Decision.** Every fact, action, watch-out and chat answer carries a verbatim quote. `verifyCitations()` normalises Unicode, case, whitespace, apostrophes and hyphenated line breaks, then checks the quote against the page text. A wrong page number is corrected; a missing quote drops the claim. A chat answer with no verified quote becomes "I can't find that in this document." Only the count of dropped claims is logged.
**Why.** It is deterministic, cheap, testable without a model, and easy to explain to a user ("1 claim was removed").
**Trade-off.** A correct claim with a paraphrased quote is lost. Evals track the pass rate (98% on the baseline).

## ADR 3 — Ports and adapters, with fake adapters as first-class citizens

**Context.** AI output is non-deterministic and costs money. Tests and demos must be free and repeatable.
**Decision.** Use cases depend on ports (`DocumentAnalyzer`, `DocumentAnswerer`, `FileStore`, …). Each AI port has an Anthropic adapter and a deterministic Fake adapter, selected in the composition root by `USE_FAKE_AI`. The rule `domain ← application ← infrastructure/ui` is enforced by dependency-cruiser in `pnpm check`.
**Why.** Use cases are unit-tested with in-memory fakes, E2E runs in CI without an API key, and swapping a model or provider touches one file.

## ADR 4 — Anonymous first, and only where it's needed

**Context.** Visitors should try the product in seconds, but crawlers and link previews should not create accounts.
**Decision.** `proxy.ts` signs a visitor in anonymously only on the first request to an app page (`/documents`, `/deadlines`), then redirects to the same URL so Server Components see the new cookie. Google and magic link upgrade the same user (`linkIdentity`, `updateUser`), so nothing is lost. Guests get 5 analyses a day, members 20, enforced by an atomic SQL function.
**Trade-off.** Anonymous users accumulate. Cleanup after 30 days is listed in `docs/SECURITY.md` as a pre-launch task.

## ADR 5 — Cache Components with streamed, request-time islands

**Context.** Next.js 16 Cache Components prerender a static shell; reading cookies or the URL outside `<Suspense>` fails the build.
**Decision.** The layout, header and marketing pages are static. Everything that reads the session (library, quota, analysis, deadlines, the account button) and URL-dependent client hooks (active nav link, locale switch) sit behind `<Suspense>` with matching skeletons. Analysis streams from a Route Handler as NDJSON (partial, then verified final); chat uses the AI SDK UI message stream with a `data-citations` part. Mutations are Server Actions.
**Why.** Pages show their shell instantly, and only personal data waits for the request.
**Consequence.** The CSP allows inline scripts, because a nonce would make every page dynamic. See `docs/SECURITY.md` #29.

## ADR 6 — An installable web app instead of native apps

**Context.** Users asked for a desktop and a mobile app, but the PRD lists a mobile app as a non-goal.
**Decision.** Make Plainly a PWA: `src/app/manifest.ts`, icons, standalone display. The landing install section has Desktop and Mobile buttons. They open the browser's own install prompt where one exists (Chrome, Edge, Android), and otherwise show the exact steps for the visitor's device (iOS Add to Home Screen, Safari Add to Dock, Firefox fallback). `installTarget()` is a pure, tested UA helper.
**Why.** It opens in its own window with its own icon on every platform, with no second codebase, no store review and no update channel. The non-goal stands.
**Trade-off.** No offline mode and no push notifications. Neither is needed while every analysis runs on the server.

## ADR 7 — Motion videos are rendered files, not live animations

**Context.** The landing and the empty states use motion videos built from the `z.md` prompts.
**Decision.** Each video is one HTML file whose frames are a pure function of time (`seek(t)`). `media/render.mjs` renders it frame by frame to MP4 and WebM with a poster, and the site embeds them muted, lazily and only in view.
**Why.** The pages ship no animation runtime, which keeps the single hero effect rule (DESIGN §2) and the Lighthouse budget. The same source renders the 16:9 and 9:16 social cuts, and any frame can be re-rendered exactly.
**Trade-off.** Video text is English only. Changing a video means re-rendering it (about a minute each).

