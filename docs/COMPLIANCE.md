# Compliance

Plainly handles private documents. This file lists what is stored, where, for how long, who processes it, and how to answer a privacy request. Keep it in sync with the Privacy page (`/[locale]/privacy`) and `AI_PROVIDERS_ALLOWED`.

## Data map

| Data | Where | Why | Retention |
|---|---|---|---|
| Original files | Supabase Storage, private bucket `documents`, path `{user_id}/{document_id}/original.*` | Show the original, transcribe scanned pages | Plan retention (Guest 7 days, Free 30, Pro 180, Max 365), or until the user deletes |
| Extracted page text | `documents.extracted_text`, `document_pages` | Analysis, quote verification, chat retrieval | Same as the file (cascade) |
| Analyses, chat messages, deadlines | `analyses`, `messages`, `deadlines` | The product | Same as the document (cascade) |
| Analysis cache | `analysis_cache` (per user) | Free re-uploads | Until the account is deleted |
| AI metering | `ai_usage`: ids, profile, model, token counts, cost, status | Cost control, budget guard | Kept for cost reports; prune rows older than 13 months by hand (not automated yet). `user_id` becomes null when the account is deleted |
| Credits | `credit_balances`, `credit_holds`, `credit_ledger` | Billing | The ledger is a financial record: kept, with `user_id` null after deletion |
| Subscriptions, billing events | `subscriptions`, `billing_events` | Billing | 10 years (tax), without document data |
| Account | Supabase Auth (`auth.users`), `profiles`, `legal_acceptances` | Sign-in, preferences, consent records | Until the account is deleted |
| Logs | Vercel | Operations | Vercel's default retention. Ids and error kinds only, never content |
| Error events | Sentry (optional) | Debugging | 30 days. Scrubbed by `shared/lib/scrub.ts` |

Never stored anywhere: prompts, model answers outside `messages`, document text in logs, analytics or error events.

## Processors

| Processor | Role | Data it receives |
|---|---|---|
| Supabase | Database, storage, authentication | Everything in the data map |
| Vercel | Hosting, cron | Requests, logs (no content) |
| AI providers in `AI_PROVIDERS_ALLOWED` (supported: Anthropic, Ollama) | Analysis, chat, translation | Document text and questions, per request. Business API terms: no training on customer data. Check each provider's retention terms before enabling it. Local Ollama sends nothing to a third party; Ollama Cloud makes Ollama Inc. a processor |
| Cloudflare Turnstile | Bot check before a guest is created | Browser signals, IP |
| Resend | Sign-in codes, account and alert emails | Email address, email text (no document content) |
| Billing provider (S5, not chosen yet) | Payments, tax, invoices | Email, country, payment details (never seen by Plainly) |
| Sentry (optional) | Error tracking | Scrubbed error events |

Adding a provider: update this table, the Privacy page copy and `AI_PROVIDERS.md` section 7 first.

## Requests

- **Access or export:** the user downloads a zip from Account → Privacy (`/api/account/export`): every table row they own as JSON, plus their original files. For a request by email, sign in as the user is not possible: ask them to use the button, or run the same export with the service role and send it to the account email only.
- **Deletion:** Account → Privacy → Delete account. This cancels the subscription, removes storage objects, then deletes the auth user (rows cascade; ledger and metering keep no identity). A confirmation email is sent. By email: verify the request comes from the account email, then do the same from the Supabase dashboard (Storage folder, then Auth user).
- **Correction:** name, language and theme on the Profile tab. Document content cannot be edited; the user deletes and re-uploads.
- Answer within 30 days. Log each request (date, type, completed) outside the database.

## Legal pages and consent
- Terms and Privacy carry a version (`shared/lib/legal.ts`). Signing in records acceptance in `legal_acceptances` (G08).
- Age: 16 or older (Terms).
- Cookies: only strictly necessary ones (session, guest merge, locale). No analytics or ad cookies, so no consent banner. If analytics are ever added, add a banner first.
- Not legal advice: stated in the Terms, under every analysis, and in chat answers about legality.

## Before charging money
Vercel Pro plan (Hobby is non-commercial), the operator's name in `NEXT_PUBLIC_OPERATOR` (footer and Terms), the refund policy in the Terms (14 days, unused credits), and the billing provider's merchant-of-record terms accepted.
