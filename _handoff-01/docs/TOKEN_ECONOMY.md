# Token economy

Goal: the best answer per token. Tokens are the main cost of this product, so cost control is a feature, designed in, measured, and visible to the user as credits.

## 1. Principles
1. **Read once, reuse many times.** Process a document once. Everything after (chat, translation, glossary) reuses stored results.
2. **Text before pixels.** Text costs a fraction of images or whole PDF pages. Use vision only for pages that need it.
3. **Cheapest model that passes the eval.** Each task has a profile. Upgrade a profile only if the eval proves the cheap model fails.
4. **Output is the expensive side.** Cap output length per task, use compact schemas, never ask for essays.
5. **Never spend on what is already known.** Samples, repeated uploads, repeated questions.
6. **Reserve, call, settle.** Check credits and budget before the call. Charge for the real result. Fail means free.
7. **Measure every call.** If a call is not in `ai_usage`, it did not happen.

## 2. Where the tokens go

| Action | Input | Output | Notes |
|--------|-------|--------|-------|
| Analysis | whole document + instructions | structured JSON | The big one. Dominated by output size and page count |
| Chat message | question + context + history | short answer | Context dominates. Fix with retrieval and caching |
| Locale translation | analysis JSON (about 1 to 2k tokens) | JSON again | Cheap model, no document re-read |
| Classification | first 1.5k characters | 20 tokens | Cheap model |
| Glossary | analysis only | short | On demand |

## 3. Techniques, by impact

| # | Technique | How | Expected effect |
|---|-----------|-----|-----------------|
| 1 | **Precomputed samples** | Three samples analysed once at build time and stored as JSON in `apps/web/samples` | Landing and "try a sample" cost 0 tokens. Biggest win for visitors |
| 2 | **Text-first extraction** | `unpdf` extracts text per page. If a page has fewer than about 40 characters per 1000 px² or looks scanned, mark it `needs_vision`. Send text for normal pages, page images for scanned ones, and only those | Several times cheaper than sending whole PDFs |
| 3 | **Content-hash cache** | `analysis_cache` keyed by `sha256(normalized_text) + locale + analysis_version + profile_version`, scoped per user. Re-upload of the same file returns the stored result for 0 credits | Removes duplicate spend |
| 4 | **Translate, do not re-analyze** | New locale = translate the JSON fields (not quotes) with the `translate` profile | Roughly 5 to 10 times cheaper than a second analysis |
| 5 | **Prompt caching** | Put the stable prefix first (instructions, then document text) and mark a cache breakpoint. Chat follow-ups reuse it. Anthropic prices: cache write 1.25x input (5 minute lifetime), cache read 0.1x input. Other providers cache automatically with their own discounts | Follow-up questions pay about a tenth for the document part |
| 6 | **Page retrieval for long documents** | Store `document_pages` with a text search index. For chat on documents above about 8k tokens, send the analysis summary plus the top 3 to 5 matching pages instead of everything. Smaller documents are sent whole and cached | Chat cost stays flat as documents grow |
| 7 | **Right-sized models** | `fast` for classification, translation and simple chat. `analysis` for the analysis. `deep` chat only on request | Most calls run on the cheap tier |
| 8 | **Output caps and compact schema** | `maxOutputTokens` per profile. Array caps in the Zod schema (keyFacts 8, actions 8, watchOuts 6). Quote max 240 characters. No free-form prose besides the 600-character summary | Directly cuts the expensive side |
| 9 | **Abort propagation** | When the user stops or closes the stream, abort the provider request | Stops paying for output nobody reads |
| 10 | **Question dedup** | Normalize and hash chat questions per document. An identical question returns the stored answer for 0 credits | Small, free |
| 11 | **History trimming** | Keep the last 6 turns plus a rolling summary (fast profile) above 10 turns | Chat cost does not grow with conversation length |
| 12 | **Early rejection** | Before any model call: file type, page cap, size cap, text length, "is there readable text", quota, budget, captcha | Spam and junk cost 0 tokens |
| 13 | **Batch for background work** | Any non-interactive job (reminder text, re-analysis after a prompt upgrade) uses the provider batch API where available (Anthropic batch is about half price) | Later, when such jobs exist |

Do not build: embeddings, a vector database, or an agent loop. Page-level text search is enough and costs nothing in tokens.

## 4. Pipeline with cost gates

```
upload
 ├─ validate (type by magic bytes, size, pages)            [0 tokens]
 ├─ extract text per page, detect scanned pages             [0 tokens]
 ├─ hash → cache lookup                                     [hit: done, 0 credits]
 ├─ estimate cost → check credits + daily budget → reserve  [fail: friendly message, 0 tokens]
 ├─ classify type + language with `fast` (first 1.5k chars) [tiny]
 ├─ analyze with `analysis` (text + scanned page images)    [main cost]
 ├─ verify quotes against extracted text, drop failures     [0 tokens]
 ├─ persist, settle credits from real usage, write ai_usage
 └─ stream sections to the UI as they validate
```

## 5. Credit costs (starting values, calibrate after measuring)

| Action | Credits |
|--------|---------|
| Analysis | `1 + 2 × ceil(pages / 5)`, plus `2 × ceil(scannedPages / 5)` |
| Chat message (fast) | 1 |
| Chat message (deep) | 3 |
| Extra locale | 1 |
| Cache hit, sample, failed call | 0 |

Calibration rule: `price per credit ≥ 3 × measured provider cost per credit`. Keep every constant in one file, `modules/billing/domain/credits.config.ts`, with a unit test that prints the implied margin from the last 7 days of `ai_usage`.

## 6. Metering

`ai_usage` (append-only): `id, user_id, document_id, request_id, profile, provider, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_micros_usd, credits_charged, latency_ms, status (ok|failed|aborted|cache_hit), error_kind, created_at`.

Cost formula:
```
cost = (input - cacheRead - cacheWrite) * pIn
     + cacheWrite * pIn * 1.25         // Anthropic 5-minute write
     + cacheRead  * pIn * 0.10
     + output * pOut
```
`ai/pricing.ts` holds prices per model with a `verifiedOn` date. A unit test fails if any configured model has no price entry, so cost is never recorded as zero. Fetch current prices from each provider's pricing page before filling the table. Do not use remembered prices.

Never store prompts, document text or answers in `ai_usage` or in logs.

## 7. Budget guard
- `AI_DAILY_BUDGET_USD` is a global cap computed from `ai_usage` (cached 30 s).
- At 80%: Guest and Free users are routed to the cheaper profile variant and deep chat is paused.
- At 100%: new analyses for Guest and Free show "We are at capacity today, try again tomorrow" with no charge. Paid users continue until 150%.
- Alert (email via Resend) at 80% and 100%.
- Per-user cap: no more than 3 concurrent analyses and 20 requests per minute.

## 8. Gateway sketch (the only place that talks to providers)

```ts
// modules/ai/application/ports.ts
export type Profile = "analysis" | "chat" | "chat_deep" | "fast" | "translate";

export interface AiGateway {
  generateObject<T>(args: {
    profile: Profile; schema: z.ZodType<T>; system: string; input: AiInput;
    maxOutputTokens: number; requestId: string; userId: string; signal?: AbortSignal;
  }): Promise<Result<{ value: T; usage: Usage }, AiError>>;

  streamText(args: { /* same shape, returns stream + usage promise */ }): AiStream;
}
```
Implementation: `AiSdkGateway` (infrastructure) resolves `AI_PROFILE_*` to an ordered model list, applies fallback (see `AI_PROVIDERS.md`), sets cache breakpoints, enforces caps, records `ai_usage`, and converts provider errors into the `AiError` union. Domain and use cases never import a provider package. `FakeAiGateway` is used for tests and E2E.

## 9. Targets (set the real numbers after Stage S2 measurement)
- Median analysis of a 5-page text PDF: under $0.06. Report the real value.
- Median chat message after the first: under $0.01. Cache hit rate on follow-ups above 70%.
- Scanned 5-page document: report separately.
- 0 tokens spent on: samples, duplicate uploads, rejected files, quota failures.
- `pnpm ai:report` prints these figures from `ai_usage` and fails CI if cost per analysis grows more than 25% against the stored baseline.

## 10. Anti-patterns
Sending whole PDFs by default. One huge system prompt per task. Re-analyzing to change language. Streaming without abort. Retrying a failing call more than once on the same model. Logging prompts "just for debugging". Letting the UI decide what is free.
