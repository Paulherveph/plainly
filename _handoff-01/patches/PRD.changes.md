# PRD changes (apply to PRD.md, bump to v1.1)

1. **Section 4 Non-goals.** Remove "Payments". Replace with: "Teams, public API and native apps are out of scope until after launch (see `docs/ROADMAP.md`)."
2. **Section 6 F7 Auth.** Replace with: "Anonymous by default. Sign up and sign in with Google or email (magic link or one-time code). Guest data is kept on upgrade, and merged if the email already has an account. Account page with usage, plan, export and delete. See `docs/AUTH.md`."
3. **Section 6 F10 Limits.** Replace with: "Credits and plan entitlements (Guest, Free, Pro, credit packs). See `docs/PRICING.md`."
4. **New P0 features:** F15 Multi-provider AI with fallback and cost metering. F16 Pricing page and upgrade flow. F17 Terms of Service page.
5. **Section 7.1 Models.** Replace the model table with profiles (`analysis`, `chat`, `fast`, `translate`) configured by `AI_PROFILE_*`. Reference `docs/AI_PROVIDERS.md`.
6. **Section 7.2 Pipeline.** Replace with the text-first route: extract text, route scanned pages to vision, cache, retrieve pages for chat. Reference `docs/TOKEN_ECONOMY.md`. Samples are precomputed and cost zero tokens.
7. **Section 7.3 Schema.** Add `documentDate: z.iso.date().nullable()` and, on actions, `dueRule: z.string().max(120).nullable()` (for relative deadlines such as "within 30 days of receipt"). Cap array sizes: keyFacts 8, actions 8, watchOuts 6, glossary generated on demand.
8. **Section 8 Data model.** Add: `profiles`, `plans`, `subscriptions`, `credit_ledger` (append-only), `ai_usage`, `document_pages` (page text + tsvector for retrieval), `analysis_cache`. All with RLS. Update the Privacy page to say page text is stored and deleted with the document.
9. **Section 9 Stack.** Add: Cloudflare Turnstile, Resend (auth and reminder emails), a Merchant-of-Record billing provider behind a `BillingProvider` port, pnpm workspace (`apps/web`).
10. **Section 11 Roadmap.** Replace with the stages in `docs/ROADMAP.md`.
11. **Section 12 Launch checklist.** Replace with the launch gate in `docs/QUALITY_GATE.md`.
