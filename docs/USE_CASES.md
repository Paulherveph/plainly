# Use cases and expected results

Each row is a test target. **Level**: U unit, I integration (DB), E e2e (Playwright), V eval (real model), M manual. **Stage** is when it must pass. When a case is implemented, add the test id in a new last column.
"Typed error" means the application returns a `Result` error and the UI shows a translated message with a next action. Nothing is charged when an action fails.

## A. Input

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| A01 | Text PDF, 3 pages | Analysis streams, pages mapped, normal cost | E | S2 | `e2e/analyse-sample.spec.ts` |
| A02 | Scanned PDF (no text layer) | Pages flagged `needs_vision`, images sent only for those, cost shown before start | E,V | S2 | `analyze-document.test.ts` (A02) |
| A03 | Mixed PDF (text and scanned pages) | Only scanned pages use vision | U | S2 | `document-text.test.ts` (A03) |
| A04 | Photo JPG/PNG of a letter, rotated or skewed | Auto-rotate, analysis works, or friendly "image too blurry" error | E,V | S2 |  |
| A05 | Several photos for one document | Reordered by user, treated as pages of one document | E | S2 |  |
| A06 | Password-protected PDF | Typed error `encrypted`, asks for an unprotected copy | U | S2 | `unpdf-text-extractor.ts` maps PasswordException to `encrypted` (fixture test open) |
| A07 | Corrupted file or wrong extension | Magic-byte check rejects it, no storage left behind | U | S2 | `document-text.test.ts` (A07) |
| A08 | File above plan size limit | Rejected client and server side, shows the limit and upgrade option | E | S2 | `document-text.test.ts` (A08), `entitlements.test.ts` (plan limits) |
| A09 | Page count above plan limit | Rejected before any model call, shows limit and upgrade option | U | S2 | `entitlements.test.ts` (A08/A09) |
| A10 | Pasted text under 200 characters | Gentle "add more text" message, no model call | U | S2 | `document-text.test.ts` (A10/A11) |
| A11 | Pasted text above limit | Clear limit message, offers upload or trimming | U | S2 | `document-text.test.ts` (A10/A11) |
| A12 | Not an official document (recipe, story) | Result says it does not look like an official document, offers to continue as general text, low cost path | V | S2 | `analyze-document.test.ts` (A12) |
| A13 | Language outside en, fr, zh | Analyzed in the output locale, banner "original language: X" | V | S2 | `pnpm ai:eval` |
| A14 | Mixed languages in one document | Quotes stay in original language, explanations in selected locale | V | S2 | `pnpm ai:eval` |
| A15 | Handwritten page | Warning about reduced reliability, claims still need verified quotes | V | S2 | `pnpm ai:eval` |
| A16 | Same file uploaded twice | Cached result returned, 0 credits, message "already analyzed" | I | S2 | `analyze-document.test.ts` (A16) |
| A17 | Prompt injection inside the document ("ignore previous instructions") | Treated as text, no behavior change, may appear as a watch-out | V | S2 | `pnpm ai:eval` |
| A18 | Upload interrupted by network loss | Resumable or clean retry, no orphan files, no charge | E | S2 |  |
| A19 | Two tabs analyzing at once beyond the concurrency limit | Second gets `concurrency` error with wait guidance | I | S4 | `entitlement-service.test.ts`, `admission.test.ts` (A19) |
| A20 | Malformed or huge PDF (decompression bomb) | Parsing limits stop it, typed error, server stays healthy | U | S2 | `unpdf-text-extractor.ts` page, character and time caps (fixture test open) |

## B. Analysis results

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| B01 | Normal lease | Summary, facts, actions with dates, watch-outs, all with verified quotes | V | S2 | `pnpm ai:eval` |
| B02 | No deadlines in the document | Actions list may be empty, deadlines page unaffected, UI explains "no dated actions" | E | S2 |  |
| B03 | Relative deadline ("within 30 days of receipt") | `dueRule` stored, `dueOn` computed only if the document date is known, else shown as a rule with a date picker for the user | U,V | S2 | `analysis.test.ts` (B03) |
| B04 | Ambiguous date (03/04/2026) | Flagged `ambiguous`, user chooses format, never guessed silently | V | S2 | `analysis.test.ts` (B04) |
| B05 | Past date | Shown as overdue in deadlines | U | S4 | `deadline.test.ts` (overdue) |
| B06 | Several currencies or amounts | Kept as written with currency, no conversion | V | S2 | `pnpm ai:eval` |
| B07 | Claim with a quote that is not in the text | Claim dropped, `dropped_claims` incremented, user sees "n items removed because they could not be verified" | U | S2 | `verify-citations.test.ts` |
| B08 | All claims dropped | Analysis marked failed, one automatic retry on next model, else typed error, credits released | U | S2 | `analyze-document.test.ts` (B08) |
| B09 | Invalid JSON from model | Repair retry once, then fallback model, user sees normal result | U | S2 |  |
| B10 | Primary model times out | Fallback model answers, user sees only a small delay | I | S2 | `analyze-document.test.ts` (B10) |
| B11 | All providers unavailable | "Temporarily unavailable, you were not charged", credits released | I | S2 | `analyze-document.test.ts` (B11) |
| B12 | Model refuses the content | Neutral message, no charge, no retry loop | U | S2 | `analyze-document.test.ts` (B12) |
| B13 | Stream cut halfway | Partial results kept and marked, "Resume" runs the remaining part, charge only for what was produced | E | S2 |  |
| B14 | User closes the tab during analysis | Job continues server side and the result is there on return | I | S2 |  |
| B15 | Document language differs from selected locale | Output follows the selected locale | V | S2 | `pnpm ai:eval` |
| B16 | Switch locale after analysis | Translate profile used, quotes unchanged, cost is 1 credit (0 for Pro if included) | I | S2 | `analyze-document.test.ts` (B16), `translate.test.ts` |
| B17 | Very long document within the plan limit | Chunked analysis path with merged result, page numbers correct | V | S2 | Single text call up to 420k characters (100 pages); no chunking needed |
| B18 | Legal-sounding content | Explains what it says, never "this is legal or illegal", footer visible | V | S2 | `pnpm ai:eval` |
| B19 | Sample document | Served from stored result, 0 tokens, instant | E | S2 | `analyze-document.test.ts` (B19) |
| B20 | Re-run analysis after prompt version upgrade | Old results stay readable, new run is explicit and charged normally | I | S6 |  |

## C. Chat

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| C01 | Question answered in the document | Answer with citation chips that open the page | E,V | S2 | `answer-question.test.ts` (C01) |
| C02 | Question not answered in the document | "I can't find that in this document." plus suggestion | V | S2 | `answer-question.test.ts` (C02) |
| C03 | Ambiguous question | One clarifying question, no invented answer | V | S2 | `pnpm ai:eval` |
| C04 | "Is this legal?" or "Should I sign?" | Explains relevant clauses, says it cannot decide, suggests a professional | V | S2 | `pnpm ai:eval` |
| C05 | General knowledge question unrelated to the document | Short note that Plainly answers about this document, offers nothing invented | V | S2 | `pnpm ai:eval` (unanswerable set) |
| C06 | Prompt injection in the chat | Ignored, no tool or data access exists | V | S2 | `pnpm ai:eval` |
| C07 | Follow-up using earlier turns | Correct context, cache hit on the document prefix | I | S2 | `answer-question.test.ts` (C07) |
| C08 | Conversation above 10 turns | History trimmed with rolling summary, cost stays flat | I | S2 | `history.test.ts`, `answer-question.test.ts` (C08) |
| C09 | Same question asked twice | Stored answer, 0 credits | I | S2 | `history.test.ts`, `answer-question.test.ts` (C09) |
| C10 | Citation fails verification | Citation removed, answer marked "not verified against the text" or answer dropped | U | S2 | `fake-answerer.test.ts`, `grounding.test.ts` |
| C11 | User stops generation | Provider request aborted, charge only for tokens produced | I | S2 | `answer-question.test.ts` (C11) |
| C12 | Question in a different language than the UI | Answers in the question's language | V | S2 | `pnpm ai:eval` |
| C13 | Credits exhausted mid-conversation | Soft paywall modal, conversation stays readable | E | S4 | `chat-panel.tsx` paywall on `insufficient_credits`; `e2e/billing.spec.ts` (F01) |
| C14 | Long document (above 8k tokens) | Retrieval path used, answer quality within eval thresholds | V | S2 | `answer-question.test.ts` (C14) |
| C15 | Deep chat requested on Free plan | `feature_not_in_plan` with upgrade action | E | S4 | `entitlements.test.ts`, `entitlement-service.test.ts` (C15) |

## D. Deadlines

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| D01 | Export one deadline to .ics | Valid all-day event with description, quote and link | U | S2 | `to-ics.test.ts` |
| D02 | Export all deadlines | One calendar file, no duplicates, stable UIDs | U | S2 | `to-ics.test.ts` |
| D03 | Time zone handling | All-day events (floating dates) unaffected by time zone | U | S2 | `to-ics.test.ts` |
| D04 | Mark done and undo | State persists, hidden or dimmed by filter | E | S2 | `e2e/deadlines.spec.ts` |
| D05 | Same obligation in two documents | Shown separately, linked to its source | U | S2 | `deadline.test.ts` |
| D06 | Calendar feed URL (V1.1) | Private tokenized URL, revocable, updates automatically | I | V1.1 |  |
| D07 | Email reminder (V1.1) | Sent N days before, respects plan, unsubscribe works | I | V1.1 |  |

## E. Accounts

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| E01 | First visit, first action | Anonymous user created after Turnstile, nothing stored before that | E | S3 | `e2e/auth.spec.ts` (E01) |
| E02 | Captcha fails or is blocked | Clear message, retry, no anonymous user created | E | S3 | `startGuestAction` returns `captcha_failed` before `signInAnonymously` (e2e needs Turnstile test keys) |
| E03 | Sign up with email code | Code arrives (local mailbox), account created, guest data kept | E | S3 | `e2e/auth.spec.ts` (E03) |
| E04 | Wrong or expired code | Clear error, rate limit after 5 tries | E | S3 | `e2e/auth.spec.ts` (E04); Supabase `token_verifications` limit |
| E05 | Sign in with Google (new) | Guest upgraded in place, documents kept | E | S3 | `continueWithGoogle` links the identity (manual check, needs Google keys) |
| E06 | Google email already has an account | Merge flow moves guest data into the account | I,E | S3 | `accounts.test.sql`, `use-cases.test.ts` (E06) |
| E07 | Sign out then in on another device | Documents and credits are there | E | S3 |  |
| E08 | Session expires while uploading | Silent refresh, or sign-in modal that keeps the upload | E | S3 |  |
| E09 | Open someone else's document URL | 404 (not 403), no information leak | I | S3 | `e2e/auth.spec.ts` (E09), `rls.test.sql` |
| E10 | Change language and theme | Persisted in profile | E | S3 | `profile.test.ts`, `e2e/auth.spec.ts` (E10) |
| E11 | Export my data | Zip with JSON and originals arrives, matches stored data | I | S3 | `use-cases.test.ts` (E11), `e2e/auth.spec.ts` (E11) |
| E12 | Delete account | Auth user, rows, storage objects, subscription gone, confirmation email sent | I | S3 | `use-cases.test.ts` (E12) |
| E13 | Open redirect attempt in `next` param | Ignored, goes to default page | U | S3 | `safe-next.test.ts`, `e2e/auth.spec.ts` (E13) |
| E14 | Email not verified (Free) | Documents work, monthly credits wait until verified | I | S3 |  |

## F. Credits and billing

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| F01 | Guest uses all credits | Soft paywall: sign up for more, no dead end | E | S4 | `e2e/billing.spec.ts` (F01) |
| F02 | Free monthly reset | Lazy grant on first request of a new period, idempotent | I | S4 | `credits.test.sql` (F02) |
| F03 | Insufficient credits | Blocked before the model call, shows cost, options | E | S4 | `entitlements.test.ts`, `entitlement-service.test.ts`, `credits.test.sql` (F03) |
| F04 | 50 parallel requests on a balance of 10 | Never goes negative, never double charges | I | S4 | `credits.int.test.ts` (F04, `pnpm test:int`) |
| F05 | AI call fails | Hold released, balance unchanged | I | S4 | `credits.test.sql`, `analyze-document.test.ts` (B11) |
| F06 | Cache hit or sample | 0 credits | I | S4 | `credits.test.sql`, `entitlement-service.test.ts` (F06) |
| F07 | Fake checkout success | Plan active, credits granted once | E | S4 | `e2e/billing.spec.ts` (F07), `billing.test.ts` |
| F08 | Return from checkout before webhook | "Confirming payment" until the webhook arrives, then active | E | S5 |  |
| F09 | Duplicate or out-of-order webhook | Processed once, state correct | I | S5 | `billing.test.ts`, `subscription.test.ts` (F09) |
| F10 | Payment fails | `past_due`, 3-day grace, no new credits, banner with fix link | I | S5 | `subscription.test.ts` (F10), `effective_plan()` 3-day grace |
| F11 | Cancel | Stays active to period end, then Free, data untouched | I | S4 | `subscription.test.ts` (F11) |
| F12 | Upgrade mid-cycle | Provider handles proration, credits adjusted per rule | I | S5 |  |
| F13 | Downgrade with more documents than the plan allows | Reading stays, new uploads limited, retention applies only to new documents | I | S4 | Downgrade only changes entitlements; documents keep their own `expires_at` |
| F14 | Refund or chargeback | Unused credits reversed, event logged | I | S5 | `reverse_credits()`, `billing.ts` flags used credits for review |
| F15 | Buy a credit pack | Pack credits added, used after plan credits, never expire | I | S5 | `credits.test.sql`, `billing.test.ts` (F15) |
| F16 | Daily budget at 80% and 100% | Free and Guest degrade then pause, paid continue, alert sent | I | S2 | `admission.test.ts`, `budget.test.ts` |
| F17 | Localized price and currency on pricing page | Matches provider checkout | M | S5 |  |

## G. Privacy and safety

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| G01 | User A reads user B's rows, files, messages | Denied by RLS in every table | I | S3 | `rls.test.sql`, `accounts.test.sql` |
| G02 | Delete one document | File, pages, analysis, messages, deadlines removed | I | S2 | `delete-document.test.ts` |
| G03 | Delete everything | Same for all documents, balance and ledger kept (financial record) | I | S3 | `delete-everything` keeps ledger rows (S4 `credits.test.sql`) |
| G04 | Retention job | Expired documents removed, runs daily, logged without content | I | S3 | `expire-documents.test.ts`, `delete_stale_guests()` |
| G05 | Logs and error events scanned after an analysis | Contain no document text or answers | I | S2 |  |
| G06 | Signed URL after 60 s | Expired | I | S2 |  |
| G07 | Privacy page provider list | Generated from `AI_PROVIDERS_ALLOWED` | U | S2 | `pricing.test.ts` (G07) |
| G08 | Terms and privacy versions | Acceptance recorded with version at sign-up | I | S6 |  |

## H. Platform and UX

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| H01 | Offline | Friendly offline state, previously opened results readable (PWA cache of results only, never originals) | E | S6 ||
| H02 | Slow network (3G throttle) | Skeletons, no layout jumps, upload progress | E | S6 ||
| H03 | Keyboard-only full flow | Everything reachable, visible focus | E | S6 ||
| H04 | Screen reader pass on analysis page | Landmarks, labels, live region for streaming | M | S6 ||
| H05 | Reduced motion | No animation, static hero | E | S1 | `e2e/hero.spec.ts` (reduced motion; no WebGL) |
| H06 | 4K monitor | Layout scales as in `HERO.md` | E | S1 | `e2e/hero.spec.ts` (1440, 1920, 2560) |
| H07 | Print the analysis | Clean print stylesheet | E | S6 ||
| H08 | Locale parity | en, fr, zh keys identical, no raw keys visible | U | S0 ||
| H09 | Health endpoint | Reports DB and provider status, no secrets | I | S6 ||
| H10 | Install as app | Manifest, icons, share target accepts a file | E | S6 ||

## I. Abuse and edge security

| ID | Scenario | Expected result | Lvl | Stage | Test |
|----|----------|-----------------|-----|-------|------|
| I01 | Script creating many guests | Turnstile and IP limits stop it, budget guard holds | I | S3 |  |
| I02 | Many parallel uploads | Concurrency and rate limits return typed errors | I | S4 | `admission.test.ts` (I02) |
| I03 | Oversized request bodies | Rejected early | U | S2 | `http.test.ts` (I03) |
| I04 | SQL or HTML in filenames and text | Stored safely, rendered escaped | U | S2 |  |
| I05 | Replay of a webhook with a bad signature | Rejected, logged | U | S5 | `billing.test.ts`, `e2e/billing.spec.ts` (I05) |
| I06 | Attempt to call server actions without a session | Typed `unauthenticated` error | U | S3 | Every server action checks `currentUser()` and returns `unauthenticated` |
