# Credits, plans and billing (Stages S4 and S5)

## 1. Principles
- Users see **credits**, not tokens. A credit is a unit of work (`TOKEN_ECONOMY.md` section 5).
- **Never block reading.** A paywall stops new AI actions. Old documents, analyses, deadlines and export stay available on every plan.
- **Plans are data.** Adding or changing a tier is a row in `plans`, not a code change.
- The free tier is the marketing budget. It is capped by the global budget guard.

## 2. Plans (starting hypotheses, calibrate after S2)

The pricing page sells three plans: **Free, Pro and Max**. Guest is the no-account trial. It keeps its own limits in the `plans` table, but it has no pricing card and is never marketed as a plan: a guest who wants more is asked to create a free account.

| | Guest (trial, not on the page) | Free | Pro | Max |
|---|---|---|---|---|
| Price | 0 | 0 | $12 per month, or $120 per year | $39 per month, or $390 per year |
| Plan ids | `guest` | `free` | `pro_month`, `pro_year` | `max_month`, `max_year` |
| Credits | 8, once | 24 per month | 400 per month | 1500 per month |
| Max pages per document | 5 | 10 | 40 | 100 |
| Max file size | 5 MB | 10 MB | 20 MB | 30 MB |
| Retention | 7 days | 30 days | 180 days | 365 days |
| Deep chat | no | no | yes | yes |
| Locales per analysis | 1 | 1 | all | all |
| Deadline reminders by email (V1.1) | no | no | yes | yes |
| Concurrent analyses | 1 | 1 | 3 | 5 |
| Support | none | docs | email | priority email |
| Credit packs | no | yes | yes | yes |

Packs: 200 credits for about $5, never expire. Yearly plans are 10 × the monthly price (two months free), shown as "Save 17%". Price display uses the billing provider's localized pricing where available.

**Why these prices.** Pro at $12 sits under the usual $15–20 for single-purpose AI tools, and 400 credits covers about 60 typical analyses (a 5-page document uses 3 credits) plus questions. Max at $39 is about 3.3 × Pro for 3.75 × the credits, longer documents, a year of retention and 5 parallel analyses, so it rewards heavy users without undercutting Pro. Both must still pass the cost rule: `price per credit ≥ 3 × cost per credit`. Pro is $0.030 per credit, Max $0.026. Check both against `pnpm ai:report` before charging, and adjust here, in `PUBLIC_PLANS` and in a new migration together.

**Teams and Enterprise** are a PRD non-goal. The page says "Need more than Max? Write to us" instead of showing a fourth card. Revisit only if those emails show real demand.

**Source of truth.** Rows in `plans` (seed `20261114300000_credits_billing.sql`, then `20261114500000_plans_max.sql`, which activates Max, adds `max_year` and sets `pro_year` to $120). Static marketing pages read `PUBLIC_PLANS` in `modules/billing/domain/public-plans.ts`, and `public-plans.test.ts` fails if the two drift.

## 3. Data model (all tables with RLS; ledger and events are server-write only)

```
plans            id, name, price_cents, interval, entitlements jsonb, active
subscriptions    id, user_id, plan_id, status (active|past_due|canceled|trialing),
                 provider, provider_customer_id, provider_subscription_id,
                 current_period_start, current_period_end, cancel_at_period_end
credit_balances  user_id pk, plan_credits int check (>=0), pack_credits int check (>=0), period_end
credit_ledger    id, user_id, delta int, bucket (plan|pack), reason, ref_type, ref_id,
                 idempotency_key unique, created_at          -- append-only
billing_events   id, provider, provider_event_id unique, type, payload jsonb, processed_at
feature_flags    key pk, value jsonb, updated_at
```

SQL functions (security definer, called only from server code):
- `reserve_credits(user, amount, key)` locks the balance row, checks funds, inserts a hold, returns hold id. Plan credits are used first, then pack credits.
- `settle_credits(hold, final_amount)` converts the hold into a charge, refunds the difference.
- `release_credits(hold)` for failures.
- `grant_period_credits(user)` idempotent per period (lazy: runs on first request of a new period, no cron).
- Every function writes a ledger row with an idempotency key, so a retried request never charges twice.

## 4. Entitlements check
One application service, `EntitlementService.check(userId, action, params)`, returns `allowed` or a typed reason (`insufficient_credits`, `page_limit`, `file_too_large`, `feature_not_in_plan`, `concurrency`, `capacity`). The UI shows the reason with the right upgrade or top-up action. The same service is called by every use case. UI checks are only for display.

## 5. UX (match the quality of Claude and OpenAI)
- **Pricing page** `/[locale]/pricing` (`modules/billing/ui/pricing-plans.tsx`), top to bottom:
  1. Title and one-line credit explanation.
  2. Monthly / Yearly switch with "Save 17%" in the accent color. It changes both paid cards, and yearly shows the monthly equivalent plus "$120 billed yearly".
  3. Three equal cards: Free, Pro (highlighted with a brand hairline and soft glow, no "popular" badge) and Max. Each card has a line glyph that grows with the plan, its name, a one-line tagline, a large price with "USD / month" and the billing line, one full-width CTA, "No commitment · Cancel anytime" under paid CTAs, and below a divider "Everything in Free, plus:" (or "in Pro") with a short checklist.
  4. Footnotes: credits reset monthly and use varies, prices in USD plus tax, "Need more than Max? Write to us".
  5. Credit pack line, the full comparison table (Free, Pro, Max), and the FAQ (credits, refunds, data, cancel anytime, running out).
- **Home page teaser**: free credits per month, Pro's monthly price and "reading is always free", with a link to compare plans.
- **Credits meter** in the header: small ring plus number, tooltip with reset date.
- **Before an action**: show the cost ("This will use 5 credits") for analyses above 5 credits. Never surprise.
- **Soft paywall modal** when blocked: what happened, what it costs, three choices (wait for reset with date, buy a pack, upgrade). Never a dead end.
- **Low credits** nudge at 20% left (once per period).
- **Success state** after checkout: confetti-free, calm confirmation, credits updated, link to continue where they were.
- **Billing portal** link in Account, provided by the billing provider.
- Currency, tax and invoices are displayed by the provider's checkout.

## 6. Billing port

```ts
interface BillingProvider {
  createCheckout(input: { userId: string; planId?: string; packId?: string; locale: Locale; returnUrl: string }): Promise<Result<{ url: string }, BillingError>>;
  createPortalSession(input: { userId: string; returnUrl: string }): Promise<Result<{ url: string }, BillingError>>;
  parseWebhook(req: Request): Promise<Result<BillingEvent, BillingError>>; // verifies signature
}
```
Adapters: `FakeBillingProvider` (S4: local page that simulates success, failure, past due, cancel, refund), and one real adapter in S5.

Webhook rules: verify signature, store in `billing_events` by provider event id (unique), process idempotently, respond fast, never trust the browser return URL to grant anything. The success page polls the subscription status until the webhook lands (show "Confirming your payment").

State machine: `active` → `past_due` (3 day grace, no new credits) → `canceled`. Cancel keeps access to the period end. Downgrade removes entitlements at period end, never deletes data. Refund or chargeback reverses the credit grant if unused credits remain; otherwise flags the account for review.

## 7. Provider choice (S5, owner decides)
Because you sell software to people in many countries, a **Merchant of Record** (the provider is the legal seller and handles VAT, sales tax and chargebacks) is the simplest start. Candidates: Paddle, Polar, Lemon Squeezy (owned by Stripe). Typical fee is about 4 to 5% plus a fixed amount per transaction; verify current fees on each site. Stripe direct is cheaper but you must handle tax and need a supported country and entity.

**Before choosing, check that your own country or residence is supported for payouts.** Supported seller lists differ per provider and change. I could not confirm Cameroon from the pages I read, and the platform clock suggests you may currently be in China. Check each provider's supported-countries page for the country where your bank account and tax residence are. Paddle also reviews your business before approval.

Claude Code: do not start S5 until the owner states the provider, then implement only that adapter. Test with the provider's sandbox. Also ask the owner for Alipay and WeChat Pay and mobile money availability as a later regional step.

## 8. Legal minimum before charging
Terms of Service, Privacy page updated, refund policy, company or sole-proprietor details in the footer, age requirement (16 or older), and a clear "not legal advice" notice. Vercel Hobby is for non-commercial use, so move to a Pro plan before charging.
