import { z } from "zod";

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

const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const ServerEnv = PublicEnv.extend({
  SUPABASE_SECRET_KEY: optional(z.string().min(1)),
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  AI_MODEL_ANALYSIS: z.string().min(1).default("claude-sonnet-5-5"),
  AI_MODEL_FAST: z.string().min(1).default("claude-haiku-5-5"),
  USE_FAKE_AI: bool,
  CRON_SECRET: optional(z.string().min(16)),
}).refine((e) => e.USE_FAKE_AI || e.ANTHROPIC_API_KEY, {
  message: "Set ANTHROPIC_API_KEY, or USE_FAKE_AI=true for local work and tests.",
  path: ["ANTHROPIC_API_KEY"],
});

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
