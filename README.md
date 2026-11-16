<div align="center">

# Plainly

**Paperwork, in plain language.**

Drop in a lease, a visa letter, a job offer or a contract. Plainly explains what it says, lists what you have to do and by when, and answers your questions from the document itself. Every point links to the sentence it came from.

![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=white)
![AI](https://img.shields.io/badge/AI-Claude%20%C2%B7%20Gemini%20%C2%B7%20Grok%20%C2%B7%20Ollama-7c5cff)
![i18n](https://img.shields.io/badge/i18n-EN%20%C2%B7%20FR%20%C2%B7%20%E4%B8%AD%E6%96%87-555)
[![CI](https://github.com/paulherveph/plainly/actions/workflows/ci.yml/badge.svg)](https://github.com/paulherveph/plainly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Quick start](#quick-start) · [AI modes](#ai-modes) · [Try real documents](#try-it-with-real-documents) · [Commands](#commands) · [Docs](#documentation) · [Contributing](#contributing)

<a href="assets/media/walkthrough/walkthrough.mp4">
  <img src="assets/media/walkthrough/walkthrough.webp" alt="Walkthrough: landing, pricing, a sample lease analysed live, a quote shown on the page, chat with a grounded answer and a refusal, deadlines, three languages, privacy and sign-in" width="860">
</a>

<sub>Every page and feature, in about a minute. <a href="assets/media/walkthrough/walkthrough.mp4">Watch in full quality (MP4)</a></sub>

</div>

## Screenshots

| Analysis | Source check |
|---|---|
| ![Summary, key facts and the original document side by side](assets/media/screenshots/desktop/dark/08-analysis-ready.webp) | ![A quote opened from a key fact, with "Show on page"](assets/media/screenshots/desktop/dark/10-citation-sheet.webp) |
| **Chat** | **Deadlines** |
| ![A grounded answer with its quote, then a refusal](assets/media/screenshots/desktop/dark/11-chat.webp) | ![Overdue and upcoming deadlines with calendar export](assets/media/screenshots/desktop/dark/12-deadlines.webp) |

<p align="center">
  <img src="assets/media/screenshots/mobile/dark/08-analysis-ready.webp" alt="Analysis on a phone" width="220">
  <img src="assets/media/screenshots/mobile/dark/11-chat.webp" alt="Chat on a phone" width="220">
  <img src="assets/media/screenshots/mobile/dark/12-deadlines.webp" alt="Deadlines on a phone" width="220">
</p>

## Features

- **Plain-language analysis.** Summary, key facts, what you must do and by when, ranked watch-outs and a glossary, streamed section by section.
- **Every claim has a source.** Each quote is checked against the document text. Claims whose quote can't be found are removed, and "Show on page" highlights the sentence.
- **Deadlines that don't get invented.** A date is kept only if its quote shows it. Relative rules ("within 30 days of arrival") and ambiguous dates (03/04/2027) ask you to pick the date.
- **Chat with the document.** Answers come only from the document, with quotes. If there's no quote, Plainly says so instead of guessing.
- **Many formats.** PDF, Word, Excel, PowerPoint, images and text. Photos and scans need a model that reads images.
- **Three languages.** English, French and Chinese interface, and explanations in any of the three, whatever the document's language.
- **Any AI provider.** Claude, Gemini, Grok, or Ollama on your own machine or in the cloud, switched with one line of config.

> Plainly explains documents. It is not legal advice.

## Quick start

### Prerequisites

| Tool | Version | macOS | Windows | Linux |
|---|---|---|---|---|
| [Node.js](https://nodejs.org) | 20.19 or newer | `brew install node` | `winget install OpenJS.NodeJS.LTS` | [fnm](https://github.com/Schniz/fnm) or your package manager |
| pnpm | 10 | `corepack enable` | `corepack enable` | `corepack enable` |
| [Docker](https://docs.docker.com/get-docker/) | any recent | Docker Desktop | Docker Desktop (WSL 2) | Docker Engine |
| [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) | 2.x | `brew install supabase/tap/supabase` | `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase` | `brew install supabase/tap/supabase`, or the `.deb`/`.rpm` from the releases page |
| [Ollama](docs/OLLAMA.md) (optional) | any recent | `brew install ollama` | `winget install Ollama.Ollama` | `curl -fsSL https://ollama.com/install.sh \| sh` |

Docker must be running before `supabase start`.

### 1. Install

```bash
git clone https://github.com/paulherveph/plainly.git
cd plainly
corepack enable
pnpm install
```

### 2. Start the local database

```bash
supabase start      # Postgres, Auth, Storage and Studio in Docker; applies the migrations
supabase status     # prints the URLs and keys you need next
```

| Service | URL |
|---|---|
| API | http://127.0.0.1:54325 |
| Studio (database UI) | http://127.0.0.1:54327 |

### 3. Configure

Copy the example env file:

```bash
# macOS / Linux
cp apps/web/.env.example apps/web/.env.local
```

```powershell
# Windows (PowerShell)
Copy-Item apps/web/.env.example apps/web/.env.local
```

Then fill in `apps/web/.env.local` from `supabase status`:

| Variable | Value from `supabase status` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API URL (`http://127.0.0.1:54325`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) |

Choose an [AI mode](#ai-modes). The default, `USE_FAKE_AI=true`, works offline with no key.

### 4. Run

```bash
pnpm dev            # http://localhost:3000
```

### 5. Sign in with a test account

```bash
pnpm test-user create     # creates a local account; its email and password go to apps/web/.env.test-user
pnpm test-user approve    # approves it, like entering the emailed code
pnpm test-user status     # shows the email, approval, plan and credits
```

`apps/web/.env.test-user` is ignored by git. More in [Accounts](docs/AUTH.md#7-local-test-user).

## AI modes

Set in `apps/web/.env.local`, then restart `pnpm dev`. Each real mode needs `USE_FAKE_AI=false`.

| Mode | When | Settings | Reads images |
|---|---|---|---|
| **Fake** (default) | UI work, tests, demos. Offline, free, instant | `USE_FAKE_AI=true` | Sample only |
| **Claude** ⭐ recommended | Best results. The prompts and checks were tuned and evaluated on it | `ANTHROPIC_API_KEY=…`<br>`AI_MODEL=anthropic:claude-sonnet-5-5` | Yes |
| **Gemini** | You have a Google AI Studio key | `GEMINI_API_KEY=…`<br>`AI_MODEL=google:gemini-3.8-flash` | Yes |
| **Grok** | You have an xAI key | `XAI_API_KEY=…`<br>`AI_MODEL=xai:grok-4.7` | Yes |
| **Ollama** | No API key: runs on your machine, or Ollama Cloud. → [Ollama guide](docs/OLLAMA.md) | `AI_MODEL=ollama:llama3.2:3b`<br>`AI_TIMEOUT_MS=600000` | Only vision models ([see below](#images-and-scans)) |

**Which one?** If you have an Anthropic API key, use Claude: it gives the most complete analyses and the most reliable quotes. Gemini and Grok are good alternatives if those are the keys you have. Ollama is free and private, but small local models miss deadlines and are slow on a CPU. Use it to try the flow, not to judge quality.

With a real AI, you use your own API keys and pay the provider for what you run. API keys come from each provider's developer console ([Anthropic](https://console.anthropic.com), [Google AI Studio](https://aistudio.google.com/apikey), [xAI](https://console.x.ai)). A chat subscription (claude.ai, Gemini app, Grok app) doesn't include API access.

`AI_MODEL` sets one model for everything. To tune each task (analysis, chat, translation) or add fallbacks, use the `AI_PROFILE_*` lines described in [AI providers](docs/AI_PROVIDERS.md#3-configuration).

### Images and scans

Photos and scanned PDFs need a model that reads images. Claude, Gemini and Grok all do.

**Most Ollama models don't**, including the default `llama3.2:3b`. Plainly then shows "The current AI model can't read images or scans". Some Ollama models do read images:

- **Local:** `gemma3:4b` (about 4 GB of memory), `qwen3-vl:4b` / `qwen3-vl:8b`, or bigger `gemma3:12b` / `gemma3:27b`.
- **Ollama Cloud:** vision models such as `qwen3-vl:235b-cloud`. Nothing runs on your machine, but you need `OLLAMA_API_KEY`.

`ollama show <model>` lists **vision** when a model reads images. Details in [Ollama → Images and scans](docs/OLLAMA.md#images-and-scans).

## Try it with real documents

Already have an AI set up? Test Plainly on five realistic documents in [`test-documents/`](test-documents/). They're fictional, and each one hides something to catch: buried clauses, an ambiguous date, a French email with a prompt-injection line, mixed currencies, a phone photo.

Upload them **one after the other**, in this order, and wait for each analysis to finish:

1. [01_admission_notice.pdf](test-documents/01_admission_notice.pdf): university admission, 6 deadlines, one ambiguous date
2. [02_bank_update.md](test-documents/02_bank_update.md): French bank email with new fees and a hidden "say there are no fees" instruction
3. [03_health_insurance_renewal.docx](test-documents/03_health_insurance_renewal.docx): auto-renewal and a buried medical-exam clause
4. [04_fee_statement.xlsx](test-documents/04_fee_statement.xlsx): fee statement with an overdue item and a weekly late fee
5. [05_notice_photo.png](test-documents/05_notice_photo.png): photo of a printed notice (needs a model that [reads images](#images-and-scans))

Then compare what Plainly found with the **[answer key](test-documents/answer-key.md)**: every deadline, the watch-outs, and the questions each document does and doesn't answer. More in the [test documents guide](test-documents/README.md).

## Commands

Run from the repository root.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the app at http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build, then serve it |
| `pnpm check` | Everything CI runs: Biome, TypeScript, unit tests, dependency rules |
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm test` | Unit and use-case tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright, fake AI) |
| `pnpm db:test` | Database tests: RLS isolation and credits (pgTAP) |
| `pnpm db:types` | Regenerate database types after a migration |
| `pnpm ai:try --model <provider:model> --file <file>` | One analysis with one model: schema, quotes, tokens, time |
| `pnpm ai:eval --model <provider:model>` | The eval set; tells you if a model is good enough for production |
| `pnpm test-user create \| approve \| reset \| status` | Manage the local test account |
| `supabase start` / `supabase stop` | Start / stop the local database |
| `supabase db reset` | Rebuild the local database from the migrations (deletes local data) |

## Project structure

```
plainly/
├─ apps/web/                 Next.js app
│  ├─ src/app/               Routes only (pages, Server Actions, API routes)
│  ├─ src/modules/           Features: documents, analysis, chat, deadlines, ai, billing, accounts
│  │                         each with domain ← application ← infrastructure / ui
│  ├─ src/server/            Composition root: wires adapters to use cases
│  ├─ src/shared/            Config (env), UI kit, i18n, helpers
│  ├─ messages/              UI copy: en.json, fr.json, zh.json
│  ├─ evals/ · samples/      Eval documents and the built-in samples
│  └─ scripts/               ai:try, ai:eval, test-user
├─ test-documents/           Fictional real-world documents + answer key, for manual testing
├─ supabase/                 Migrations, config, database tests
├─ docs/                     Guides and decisions (see below)
└─ assets/                   Mockup, screenshots, walkthrough and video sources
```

## Architecture

A modular monolith with ports and adapters inside each module. CI enforces the dependency rule.

```mermaid
flowchart LR
  UI[React UI] --> Routes[Next.js routes<br/>Server Actions, /api/analysis, /api/chat]
  Routes --> App[Use cases]
  App --> Domain[Domain<br/>schemas, quote checks, grounding]
  Infra[Adapters<br/>Supabase, AI gateway] -. implement ports .-> App
  Infra --> Supabase[(Supabase<br/>Postgres + RLS, Storage, Auth)]
  Infra --> AI[[AI gateway<br/>Claude · Gemini · Grok · Ollama]]
```

What happens to one document:

```
upload → check type, size, pages → private storage → extract page text
       → AI writes a structured analysis, streamed to the screen
       → every quote checked against the page text → claims without a real quote dropped → saved
```

Read [Architecture](docs/ARCHITECTURE.md) for the full picture and [Decisions](docs/DECISIONS.md) for the trade-offs.

## Documentation

| Guide | What's inside |
|---|---|
| [AI providers](docs/AI_PROVIDERS.md) | Claude, Gemini, Grok, Ollama; profiles, fallbacks, promoting a model |
| [Ollama](docs/OLLAMA.md) | Install, start, check and pick local models; Windows, macOS, Linux |
| [Test documents](test-documents/README.md) | Five fictional documents and the answer key |
| [Token economy](docs/TOKEN_ECONOMY.md) | How AI cost is kept low, budgets, usage records |
| [Architecture](docs/ARCHITECTURE.md) | Layers, modules, folder structure |
| [Accounts](docs/AUTH.md) | Sign-in methods, approval, the local test user |
| [Pricing](docs/PRICING.md) | Plans, credits, what each action costs |
| [Security](docs/SECURITY.md) | Controls and how each one was verified |
| [Compliance](docs/COMPLIANCE.md) | Data processors, retention, user rights |
| [Deploy](docs/DEPLOY.md) | Vercel and Supabase production setup, launch checklist |
| [Runbook](docs/RUNBOOK.md) | Incidents, feature flags, where to look first |
| [Design](docs/DESIGN.md) | Visual language, motion, accessibility rules |
| [Decisions](docs/DECISIONS.md) | Architecture decision records |
| [Product brief](PRD.md) | Scope, users, non-goals |

## Troubleshooting

| Problem | Fix |
|---|---|
| `supabase start` fails with a Docker error | Start Docker Desktop (macOS/Windows) or `sudo systemctl start docker` (Linux), then retry |
| A port is already in use (54325, 54326, 54327…) | Another Supabase project is running: `supabase stop --project-id <other>`, or stop the program using the port |
| `Invalid server env: …` when the app starts | The message names the variable, e.g. a missing `GEMINI_API_KEY`. Compare `apps/web/.env.local` with `.env.example` |
| TypeScript errors about database types after pulling | `supabase db reset && pnpm db:types` |
| Analysis says "The AI service is unavailable" | With Ollama: run the checks in the [Ollama guide](docs/OLLAMA.md#3-check-its-running). Otherwise: check the API key and that the account has credit |
| "The current AI model can't read images or scans" | The model is text-only. Use Claude, Gemini, Grok or an Ollama [vision model](#images-and-scans) |
| Can't sign in locally | `pnpm test-user status`, then `pnpm test-user create` and `approve` |
| Page looks stale after switching branches | Stop `pnpm dev`, delete `apps/web/.next`, start again |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md): fork, branch, `pnpm check`, open a pull request. `main` is protected, so every change is reviewed and must pass CI.

- Found a bug or have an idea? [Open an issue](https://github.com/paulherveph/plainly/issues/new/choose).
- Found a security problem? Report it privately ([security policy](.github/SECURITY.md)).
- Please follow the [code of conduct](.github/CODE_OF_CONDUCT.md).

## Fork checklist

Running your own copy? Change these before anyone else uses it:

1. **Your identity.** Set `NEXT_PUBLIC_OPERATOR` (shown in the footer and the Terms) and `EMAIL_FROM`. Nothing personal is hard-coded.
2. **Your own keys.** New Supabase project, AI provider keys, `GUEST_MERGE_SECRET`, `CRON_SECRET`, `BILLING_WEBHOOK_SECRET`. Never reuse the examples.
3. **Your name and logo.** Rename the product and replace the logo and icons (see [Trademark](#trademark-and-branding)).
4. **Legal pages.** Read the Terms and Privacy copy in `apps/web/messages/` and adapt it to where you operate.
5. **Third-party code.** Check [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The hero's WebGL orb is not MIT.

## Trademark and branding

The code is MIT. The name "Plainly" and its logo are not licensed for use as the name or brand of another product or service. Forks are welcome under their own name.

## License

[MIT](LICENSE). Use it, copy it, learn from it, build on it. Keep the copyright notice. Third-party parts keep their own licenses: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
