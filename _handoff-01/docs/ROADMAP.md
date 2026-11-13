# Roadmap

Each stage ends with its gate in `QUALITY_GATE.md`. Do not start the next stage before the gate passes.

## Launch track

| Stage | Name | Why now | Main deliverables | Rough size |
|-------|------|---------|-------------------|------------|
| S0 | Monorepo and hygiene | Cheap now, expensive later | `apps/web`, root scripts, CI paths, Vercel config, merged AGENTS/CLAUDE, docs | Half a day |
| S1 | Hero and landing | Biggest visible quality jump for the lowest effort | Responsive orb as stage, fluid container and type, landing fixes, SEO files | 1 day |
| S2 | Token economy and AI layer | Everything else depends on cost control | AiGateway, profiles, fallback, text-first pipeline, caching, retrieval, metering, budget guard, `ai:try`, `ai:eval`, precomputed samples | 2 to 3 days |
| S3 | Accounts | Needed before limits and money | Turnstile, email code, Google, guest upgrade and merge, account page, export, delete | 1.5 days |
| S4 | Credits and plans (fake billing) | Product and UX complete before real money | Ledger, entitlements, pricing page, credit meter, paywall modals, fake billing | 2 days |
| S5 | Live billing | Only after the owner picks a provider | One real adapter, webhooks, portal, invoices | 1 to 2 days |
| S6 | Hardening and legal | Trust | Terms, privacy, Sentry, health, load and outage drills, PWA polish, print, runbook, compliance | 2 days |
| S7 | Soft launch | Learn from real users | Production deploy, smoke tests, monitoring, invite a small group, fix list | 1 day |

## After launch (each is its own stage with a gate; order by user feedback)

**V1.1 Retention**
- Deadline reminders by email and a private calendar feed (ICS subscription). Turns Plainly from a one-time tool into one you return to.
- Library search across all documents (text search, filters, tags).
- Compare two versions of a document: deterministic text diff first, then the model explains only the changed parts (cheap and very useful for leases and contracts).

**V1.2 Power features**
- Draft a reply or request (extension, clarification, complaint) grounded in the document, with a clear "review before sending" step. Credits apply.
- Side-by-side view: original clause next to its plain-language version.
- Email-in: forward a message to a personal address and it is analyzed (abuse controls required).
- Mobile capture polish: multi-page camera scan with edge detection.

**V2 Platform**
- Public API and API keys with usage billing.
- A Plainly MCP server so Claude and other agents can analyze documents through your service. Strong portfolio piece.
- Workspaces (families, small teams), shared documents with expiry and revocation, audit log.

**V3 Scale**
- Move to the tiers in `SCALING.md` when a measured trigger fires.

## Decision log
Create `docs/DECISIONS.md` and add a short entry (context, decision, consequences) for: monorepo layout, text-first pipeline, credits model, provider choice for billing, queue choice, any new dependency above 50 KB.
