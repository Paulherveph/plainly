import { z } from "zod";
import {
  type ModelRef,
  type ProviderName,
  parseModelRef,
  priceFor,
  SUPPORTED_PROVIDERS,
} from "@/modules/ai/domain/pricing";

/**
 * The only place that reads process.env.
 * Public values are read with literal `process.env.NEXT_PUBLIC_*` access so Next.js can inline them.
 */

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

/** Empty strings (e.g. `KEY=` in .env or an exported blank variable) count as unset. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/** "anthropic:claude-sonnet-5-5,anthropic:claude-haiku-5-5" -> ordered fallback list. */
const profile = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value, ctx): ModelRef[] => {
      const refs = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => {
          const ref = parseModelRef(v);
          if (!ref) ctx.addIssue({ code: "custom", message: `Unknown provider in "${v}"` });
          else if (!priceFor(ref))
            ctx.addIssue({ code: "custom", message: `No price entry for "${v}" in ai/pricing.ts` });
          return ref;
        })
        .filter((r): r is ModelRef => r !== null);
      if (refs.length === 0) ctx.addIssue({ code: "custom", message: "A profile needs at least one model" });
      return refs;
    });

const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  /** Shown in the footer and the Terms: who operates Plainly (company or sole proprietor). */
  NEXT_PUBLIC_OPERATOR: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(200).optional()),
});

/** Where a default local Ollama install listens. */
export const OLLAMA_LOCAL_URL = "http://localhost:11434/v1";

const PROFILE_KEYS = [
  "AI_PROFILE_ANALYSIS",
  "AI_PROFILE_CHAT",
  "AI_PROFILE_CHAT_DEEP",
  "AI_PROFILE_FAST",
  "AI_PROFILE_TRANSLATE",
] as const;

/**
 * `AI_MODEL=ollama:llama3.2:3b` fills every AI_PROFILE_* left unset, so one line switches models.
 * An unset AI_PROVIDERS_ALLOWED defaults to the providers the profiles use.
 */
function withAiModel(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const env: Record<string, unknown> = { ...input };
  const model = typeof env.AI_MODEL === "string" ? env.AI_MODEL.trim() : "";
  if (model) for (const key of PROFILE_KEYS) if (!env[key]) env[key] = model;
  if (!env.AI_PROVIDERS_ALLOWED) {
    const used = PROFILE_KEYS.flatMap((key) => (typeof env[key] === "string" ? env[key].split(",") : []))
      .map((ref) => ref.trim().split(":")[0])
      .filter(Boolean);
    if (used.length > 0) env.AI_PROVIDERS_ALLOWED = [...new Set(used)].join(",");
  }
  return env;
}

const ServerEnvSchema = PublicEnv.extend({
  SUPABASE_SECRET_KEY: optional(z.string().min(1)),
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  /** Gemini API key from Google AI Studio. */
  GEMINI_API_KEY: optional(z.string().min(1)),
  /** Grok API key from the xAI console. */
  XAI_API_KEY: optional(z.string().min(1)),
  /** Local Ollama by default. Ollama Cloud: https://ollama.com/v1 plus OLLAMA_API_KEY. */
  OLLAMA_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().default(OLLAMA_LOCAL_URL)),
  OLLAMA_API_KEY: optional(z.string().min(1)),
  /** One model for every profile, e.g. "ollama:llama3.2:3b". AI_PROFILE_* still override it. */
  AI_MODEL: optional(z.string().min(1)),
  AI_PROVIDERS_ALLOWED: z
    .string()
    .default("anthropic")
    .transform((v) =>
      v
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(SUPPORTED_PROVIDERS)).min(1)),
  AI_PROFILE_ANALYSIS: profile("anthropic:claude-sonnet-5-5"),
  AI_PROFILE_CHAT: profile("anthropic:claude-haiku-5-5,anthropic:claude-sonnet-5-5"),
  AI_PROFILE_CHAT_DEEP: profile("anthropic:claude-sonnet-5-5"),
  AI_PROFILE_FAST: profile("anthropic:claude-haiku-5-5"),
  AI_PROFILE_TRANSLATE: profile("anthropic:claude-haiku-5-5"),
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(5),
  /** Overrides the per-profile AI timeouts. Raise it for slow local models (e.g. 600000). */
  AI_TIMEOUT_MS: optional(z.coerce.number().int().positive()),
  AI_ALLOW_UNVERIFIED_MODELS: bool,
  USE_FAKE_AI: bool,
  /** Demo only: show the 6-digit sign-up code on screen instead of emailing it (docs/TEST_ACCOUNTS.md). */
  DEMO_SHOW_CODES: bool,
  CRON_SECRET: optional(z.string().min(16)),
  RESEND_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(3)),
  ALERT_EMAIL: optional(z.email()),
  TURNSTILE_SECRET_KEY: optional(z.string().min(1)),
  GUEST_MERGE_SECRET: optional(z.string().min(32)),
  BILLING_PROVIDER: z.enum(["fake"]).default("fake"),
  BILLING_WEBHOOK_SECRET: optional(z.string().min(16)),
  /** Lets the fake-billing simulator run under `next start` (E2E only). Never set in production. */
  ALLOW_FAKE_BILLING: bool,
  SENTRY_DSN: optional(z.url()),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})
  .superRefine((e, ctx) => {
    if (e.USE_FAKE_AI) return;
    const used = new Set(allProfileModels(e).map((ref) => ref.provider));
    for (const provider of used) {
      const missing = missingCredential(provider, e);
      if (missing)
        ctx.addIssue({
          code: "custom",
          message: `Set ${missing} for the ${provider} models in AI_MODEL / AI_PROFILE_*, or USE_FAKE_AI=true for local work and tests.`,
          path: [missing],
        });
    }
  })
  .refine((e) => allProfileModels(e).every((ref) => e.AI_PROVIDERS_ALLOWED.includes(ref.provider)), {
    message: "A profile uses a provider that is not in AI_PROVIDERS_ALLOWED.",
    path: ["AI_PROVIDERS_ALLOWED"],
  })
  .refine(
    (e) =>
      e.USE_FAKE_AI ||
      e.AI_ALLOW_UNVERIFIED_MODELS ||
      e.NODE_ENV !== "production" ||
      allProfileModels(e).every((ref) => priceFor(ref)?.evalPassedOn),
    {
      message: "A production profile uses a model with no passing `pnpm ai:eval` run (see ai/pricing.ts).",
      path: ["AI_ALLOW_UNVERIFIED_MODELS"],
    },
  );

export const ServerEnv = z.preprocess(withAiModel, ServerEnvSchema);

type ProviderEnv = {
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  XAI_API_KEY?: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_API_KEY?: string;
};

/** The env variable a provider still needs, or null when it is ready. */
function missingCredential(provider: ProviderName, e: ProviderEnv): string | null {
  switch (provider) {
    case "anthropic":
      return e.ANTHROPIC_API_KEY ? null : "ANTHROPIC_API_KEY";
    case "google":
      return e.GEMINI_API_KEY ? null : "GEMINI_API_KEY";
    case "xai":
      return e.XAI_API_KEY ? null : "XAI_API_KEY";
    case "ollama":
      // Local Ollama needs no key; Ollama Cloud does.
      return new URL(e.OLLAMA_BASE_URL).hostname.endsWith("ollama.com") && !e.OLLAMA_API_KEY
        ? "OLLAMA_API_KEY"
        : null;
  }
}

export type ProviderSettings = Partial<Record<ProviderName, { apiKey?: string; baseURL?: string }>>;

/** Connection settings for every provider, in the shape the AI gateway takes. */
export function providerSettings(e: ProviderEnv): ProviderSettings {
  return {
    anthropic: { apiKey: e.ANTHROPIC_API_KEY },
    google: { apiKey: e.GEMINI_API_KEY },
    xai: { apiKey: e.XAI_API_KEY },
    ollama: { baseURL: e.OLLAMA_BASE_URL, apiKey: e.OLLAMA_API_KEY },
  };
}

function allProfileModels(e: {
  AI_PROFILE_ANALYSIS: ModelRef[];
  AI_PROFILE_CHAT: ModelRef[];
  AI_PROFILE_CHAT_DEEP: ModelRef[];
  AI_PROFILE_FAST: ModelRef[];
  AI_PROFILE_TRANSLATE: ModelRef[];
}): ModelRef[] {
  return [
    ...e.AI_PROFILE_ANALYSIS,
    ...e.AI_PROFILE_CHAT,
    ...e.AI_PROFILE_CHAT_DEEP,
    ...e.AI_PROFILE_FAST,
    ...e.AI_PROFILE_TRANSLATE,
  ];
}

export type PublicEnv = z.infer<typeof PublicEnv>;
export type ServerEnv = z.infer<typeof ServerEnv>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

let cachedPublic: PublicEnv | undefined;
export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = PublicEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_OPERATOR: process.env.NEXT_PUBLIC_OPERATOR,
  });
  if (!parsed.success) throw new Error(`Invalid public env: ${format(parsed.error)}`);
  cachedPublic = parsed.data;
  return cachedPublic;
}

let cachedServer: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not run in the browser");
  if (cachedServer) return cachedServer;
  // An empty ANTHROPIC_BASE_URL (some shells export one) makes @ai-sdk/anthropic throw on import.
  if (process.env.ANTHROPIC_BASE_URL === "") delete process.env.ANTHROPIC_BASE_URL;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) throw new Error(`Invalid server env: ${format(parsed.error)}`);
  cachedServer = parsed.data;
  return cachedServer;
}
