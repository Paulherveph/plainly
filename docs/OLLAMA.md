# Run Plainly with Ollama

Ollama runs AI models on your own machine. Plainly can use it for analysis and chat, so you can test with real documents without an API key. Document text stays on your computer.

Expect it to be slower than a hosted model, and less thorough. It works well for trying the product. For production quality, use Claude ([AI providers](AI_PROVIDERS.md)).

**Contents**
[Install](#1-install) · [Start](#2-start) · [Check it's running](#3-check-its-running) · [Models](#4-models) · [Connect Plainly](#5-connect-plainly) · [Longer documents](#6-longer-documents) · [Ollama Cloud](#7-ollama-cloud) · [Switch to Claude](#8-switch-to-claude-later) · [Troubleshooting](#9-troubleshooting)

---

## 1. Install

| OS | Command |
|---|---|
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |
| macOS | `brew install ollama`, or download the app from [ollama.com/download](https://ollama.com/download) |
| Windows | `winget install Ollama.Ollama`, or download the installer from [ollama.com/download](https://ollama.com/download) |

Check the install:

```bash
ollama --version
```

## 2. Start

**Linux** (installed as a system service)

```bash
sudo systemctl start ollama        # start now
sudo systemctl enable ollama       # start at every boot (optional)
sudo systemctl status ollama       # see if it's running
```

**macOS and Windows**

Open the Ollama app. It runs in the menu bar / system tray. Or start it from a terminal:

```bash
ollama serve
```

Leave that terminal open while you use Plainly.

## 3. Check it's running

```bash
# macOS / Linux
curl http://localhost:11434/api/version
```

```powershell
# Windows (PowerShell)
Invoke-RestMethod http://localhost:11434/api/version
```

You should get something like `{"version":"0.40.16"}`. "Connection refused" means Ollama isn't running: go back to step 2.

## 4. Models

```bash
ollama list                  # models on this machine (use the NAME column in Plainly)
ollama pull <name>           # download a model, e.g. ollama pull llama3.2:3b
ollama show <name>           # size, context length, capabilities (look for "vision")
ollama ps                    # models in memory right now, and whether they use the CPU or the GPU
ollama rm <name>             # delete a model you no longer need
```

Pick a model your memory can hold. As a rough guide for the common 4-bit downloads:

| Model size | Memory it needs (RAM, or GPU VRAM) |
|---|---|
| 1–3B parameters | about 4 GB |
| 7–8B | about 8 GB |
| 12–14B | about 16 GB |
| 30B and up | 32 GB or more |

Bigger models give better results but run slower. If `ollama ps` shows `100% CPU`, your GPU isn't being used: answers will take minutes, not seconds.

### Images and scans

Most Ollama models read **text only**, including `llama3.2:3b`. With them, a photo or a scanned PDF fails with "The current AI model can't read images or scans". Text PDFs, Word, Excel and text files work with any model.

Some models do read images. `ollama show <name>` lists **vision** for them. Checked on ollama.com on 2026-11-16:

| Where it runs | Model (`AI_MODEL=ollama:…`) | Memory | Notes |
|---|---|---|---|
| Local | `gemma3:4b` | ~4 GB | Smallest that reads images (`gemma3:1b` and `270m` are text only) |
| Local | `qwen3-vl:4b` / `qwen3-vl:8b` | ~4 / ~8 GB | Strong on printed documents |
| Local | `gemma3:12b` / `gemma3:27b` | ~10 / ~20 GB | Better, needs a big GPU |
| Ollama Cloud | `qwen3-vl:235b-cloud` | none (runs on Ollama's servers) | Large vision model, needs `OLLAMA_API_KEY` |
| Ollama Cloud | other models tagged both *cloud* and *vision* on [ollama.com/search?c=vision](https://ollama.com/search?c=vision) | none | e.g. `gemma4` cloud tags |

So: **local works** if you pull a vision model and have the memory, and **cloud works** with a vision-tagged cloud model. Small local vision models still misread small print. For reliable results on photos and scans, use Claude, Gemini or Grok ([AI providers](AI_PROVIDERS.md#ready-to-use-claude-gemini-grok)): all three read images.

## 5. Connect Plainly

In `apps/web/.env.local`, set these three lines. The model name must match `ollama list` exactly, including the part after the colon:

```bash
USE_FAKE_AI=false
AI_MODEL=ollama:llama3.2:3b     # "ollama:" + a NAME from `ollama list`
AI_TIMEOUT_MS=600000            # 10 minutes; local models are slow
```

Restart the dev server (`Ctrl+C`, then `pnpm dev`). Open a document: the analysis now comes from your model.

**Switch to another model:** `ollama pull <name>`, change `AI_MODEL`, restart `pnpm dev`. That's all.

**Try a model before using it in the app:**

```bash
pnpm ai:try --model ollama:llama3.2:3b --file apps/web/samples/lease.pdf
```

It prints whether the output matched the schema, how many quotes checked out, tokens and time.

## 6. Longer documents

By default, Ollama gives a model a small working memory (its "context"), often 4,096 tokens, about 3 pages. Longer documents get cut off without warning, and the analysis misses whatever was cut. Raise it once. 16384 is a good start; more context uses more memory.

**Linux**

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_CONTEXT_LENGTH=16384"\n' | sudo tee /etc/systemd/system/ollama.service.d/context.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

**macOS** (then quit and reopen the Ollama app)

```bash
launchctl setenv OLLAMA_CONTEXT_LENGTH 16384
```

**Windows** (PowerShell, then quit Ollama from the tray and open it again)

```powershell
setx OLLAMA_CONTEXT_LENGTH 16384
```

After the next analysis, `ollama ps` shows the new size in the `CONTEXT` column.

## 7. Ollama Cloud

The same models, running on Ollama's servers. Create an API key in your Ollama account, then:

```bash
USE_FAKE_AI=false
AI_MODEL=ollama:<cloud model name>
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_API_KEY=<your key>
```

With Ollama Cloud, document text goes to Ollama's servers. The Privacy page lists Ollama automatically when it is enabled.

## 8. Switch to Claude later

When you have an Anthropic API key:

```bash
ANTHROPIC_API_KEY=<your key>
AI_MODEL=anthropic:claude-sonnet-5-5
```

Gemini (`GEMINI_API_KEY`, `AI_MODEL=google:gemini-3.8-flash`) and Grok (`XAI_API_KEY`, `AI_MODEL=xai:grok-4.7`) work the same way.

To keep Ollama as a fallback when Claude is down, list both: `AI_PROFILE_ANALYSIS=anthropic:claude-sonnet-5-5,ollama:llama3.2:3b`. See [AI providers](AI_PROVIDERS.md) for profiles and fallbacks.

## 9. Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| "The AI service is unavailable right now" | Ollama isn't running, or the model name is wrong | Run step 3. Compare `AI_MODEL` with `ollama list`, tag included |
| `Invalid server env: … OLLAMA_API_KEY` | `OLLAMA_BASE_URL` points to ollama.com without a key | Set `OLLAMA_API_KEY`, or remove `OLLAMA_BASE_URL` to go back to local |
| "The current AI model can't read images or scans" | The model has no vision | Use a text PDF, or pull a model whose `ollama show` lists vision |
| Analysis takes many minutes, `ollama ps` shows `100% CPU` | No GPU in use, or the model is too big for it | Use a smaller model, or install your GPU driver |
| "The analysis didn't finish" after about 10 minutes | The model is slower than `AI_TIMEOUT_MS` | Raise `AI_TIMEOUT_MS`, or use a smaller model |
| The analysis misses things near the end of long files | The context is too small | [Raise the context length](#6-longer-documents) |
| "I couldn't find a quote… so I won't guess" in chat | Small models often answer without the quote Plainly requires | Rephrase the question, or use a bigger model |
| The computer slows down or freezes | Not enough memory | Close other apps, or use a smaller model |
