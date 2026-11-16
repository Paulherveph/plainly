import { z } from "zod";
import { type ModelRef, parseModelRef, priceFor, SUPPORTED_PROVIDERS } from "@/modules/ai/domain/pricing";

/**
 * The only place that reads process.env.
 * Public values are read with literal `process.env.NEXT_PUBLIC_*` access so Next.js can inline them.
 */

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

/** Empty strings (e.g. `KEY=` in .env or an exported blank variable) count as unset. */
const optional = (schema: z.ZodString) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

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

const ServerEnv = PublicEnv.extend({
  SUPABASE_SECRET_KEY: optional(z.string().min(1)),
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
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
  AI_ALLOW_UNVERIFIED_MODELS: bool,
  USE_FAKE_AI: bool,
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
  .refine((e) => e.USE_FAKE_AI || e.ANTHROPIC_API_KEY, {
    message: "Set ANTHROPIC_API_KEY, or USE_FAKE_AI=true for local work and tests.",
    path: ["ANTHROPIC_API_KEY"],
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
