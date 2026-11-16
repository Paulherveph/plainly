# Multi-provider AI layer

Goal: switch or add a model (Claude, OpenAI, Gemini, Grok, others) by changing configuration, never code, and survive a provider outage without the user noticing.

## 1. Why this is easy here
The pipeline is **text-first** (`TOKEN_ECONOMY.md`). Every provider reads text. Only scanned pages need images, and all four major providers accept images. So the product does not depend on any vendor-specific document feature.

## 2. Packages
Use the Vercel AI SDK (`ai`) with provider packages: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/xai`. Install only the providers listed in `AI_PROVIDERS_ALLOWED`. Check names and versions with Context7 first. Any OpenAI-compatible provider can be added with the OpenAI-compatible package and a base URL.

Optional later: Vercel AI Gateway as one more adapter (single key, routing). It is not needed to start.

## 3. Configuration
```
AI_PROVIDERS_ALLOWED=anthropic,openai
AI_PROFILE_ANALYSIS=anthropic:claude-sonnet-5-5,openai:<model>,google:<model>
AI_PROFILE_CHAT=anthropic:claude-haiku-5-5,openai:<model>
AI_PROFILE_CHAT_DEEP=anthropic:claude-sonnet-5-5
AI_PROFILE_FAST=anthropic:claude-haiku-5-5,google:<model>
AI_PROFILE_TRANSLATE=anthropic:claude-haiku-5-5,google:<model>
```
- A profile is an ordered fallback list. First is primary.
- Replace `<model>` with real IDs from each provider's documentation. Do not guess IDs. The env validator rejects unknown providers and any model without a price entry in `ai/pricing.ts`.
- `AI_ALLOW_UNVERIFIED_MODELS=false` in production blocks any model that has no recorded eval run (see section 6).

### Ollama (local or cloud)
One provider id, `ollama`, for both. Ollama serves an OpenAI-compatible API, wired through `@ai-sdk/openai-compatible`. Model ids keep their own colons: `ollama:qwen3:8b`.

| | Local | Ollama Cloud |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` (default) | `https://ollama.com/v1` |
| `OLLAMA_API_KEY` | not needed | required (the env check fails without it) |

```
USE_FAKE_AI=false
AI_MODEL=ollama:llama3.2:3b   # any name from `ollama list`; fills every AI_PROFILE_* left unset
AI_TIMEOUT_MS=600000          # local models are slow; overrides the per-profile timeouts
```
Switch models: `ollama pull <name>`, change `AI_MODEL`, restart `pnpm dev`. `AI_PROVIDERS_ALLOWED` defaults to the providers the profiles use; set it to make an explicit allow-list.
- **Cost:** one zero price (`OLLAMA_PRICE`) covers every Ollama model, so no table row per model. `ai_usage` still records tokens. Production refuses it like any model without an eval, unless `AI_ALLOW_UNVERIFIED_MODELS=true`.
- **Context length:** Ollama cuts long prompts without warning when its context window is small. Raise it once: `sudo systemctl edit ollama`, add `[Service]` + `Environment="OLLAMA_CONTEXT_LENGTH=16384"`, then `sudo systemctl restart ollama`. Size it to your memory: more context uses more VRAM/RAM.
- **Scanned PDFs** need a vision model that accepts PDF/image input. With a text-only model, transcription fails with the normal "unavailable" error. Text PDFs and office files work.
- **Mixing with a paid key later:** `AI_PROVIDERS_ALLOWED=anthropic,ollama` and `AI_PROFILE_ANALYSIS=anthropic:claude-sonnet-5-5,ollama:<model>` keeps Ollama as the fallback.
- Smoke test: `pnpm ai:try --model ollama:<model> --file samples/lease.pdf`.

## 4. Fallback behavior

| Error kind | Action |
|------------|--------|
| Rate limit (429), overloaded, 5xx, network, timeout | Next model in the list immediately. Mark provider degraded for 60 s (in-memory circuit breaker per instance) |
| Invalid structured output | Retry once on the same model with the validation error appended. If it fails again, next model |
| Content refusal | No fallback. Return a typed `refused` error, user sees a neutral message, no charge |
| Auth or billing error (401/402/403) | Disable that provider for this instance, alert, next model |
| Context too long | Switch to retrieval path or reject with a clear page-limit message. No fallback |
| All models failed | `AiError.unavailable`. User sees "Temporarily unavailable, you were not charged". Release the reserved credits |

Rules: at most 2 fallbacks per request, total wall time capped, abort signals respected. Record every attempt in `ai_usage` with its status, so you can see provider reliability and cost per provider.

## 5. Runtime switches without redeploy
Table `feature_flags(key, value jsonb, updated_at)` read by the server with a 30 s cache. Keys: `ai_enabled`, `provider_disabled:<name>`, `profile_override:<profile>`. Edited only by an admin (service role, SQL or a small admin route guarded by your account). This is the emergency lever when a provider fails or a model misbehaves.

## 6. Try and verify any model
Create two CLI scripts in `apps/web/scripts/` (run with `tsx`):

```
pnpm ai:try   --profile analysis --model xai:<model> --file apps/web/samples/lease.pdf [--locale fr]
```
Runs one analysis, prints: schema valid, quote verification pass rate, tokens, cost, latency, and the result.

```
pnpm ai:eval  --profile analysis --model openai:<model>
```
Runs the eval set (`evals/`, 10 documents with expected facts and deadlines) plus 10 unanswerable chat questions. Writes `apps/web/evals/results/<date>-<provider>-<model>.json`.

**Promotion thresholds** for a model to enter a production profile:

| Metric | Threshold |
|--------|-----------|
| Schema valid on first try | at least 98% |
| Quote verification pass rate | at least 95% |
| Deadline recall on eval set | at least 90% |
| Invented deadlines (date without supporting quote) | 0 |
| Correct refusals on unanswerable questions | at least 90% |
| Cost per eval analysis | within the profile budget |

Chat and fast profiles use a relaxed schema threshold (95%) but the same grounding thresholds.

## 7. Adding a provider (checklist)
1. Install the package (reason in the commit message). 2. Add to the provider map in `ai-sdk-gateway.ts`. 3. Add prices with `verifiedOn`. 4. Add env key to `env.ts` and `.env.example`. 5. Run `pnpm ai:eval`. 6. Add the model to a profile. 7. Update the privacy page (it lists enabled providers automatically from config). 8. Add the provider to the data processing list in `docs/COMPLIANCE.md`.

## 8. Credentials and money
- Subscriptions to claude.ai, ChatGPT, Grok or Gemini do **not** include API access. Each provider needs an API key from its developer console with prepaid credit or billing enabled.
- Set a monthly spend limit in each console. Keep keys only in Vercel and local `.env.local`.
- Use a separate key for development and production.

## 9. Privacy implications
Every enabled provider receives document text. Before enabling one, check its data-use and retention terms (API data is normally not used for training, but verify per provider) and list it on the Privacy page. The Privacy page must never claim a provider that is not enabled, and must list every one that is.
