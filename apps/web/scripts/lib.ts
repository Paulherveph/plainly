/**
 * Shared setup for the AI CLI scripts. Run with tsx and the react-server condition, so
 * `server-only` resolves to an empty module:  tsx --conditions=react-server scripts/<name>.ts
 * Scripts read .env.local themselves; they are not part of the app bundle.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Profile, UsageRecorder, UsageRow } from "@/modules/ai/application/ports";
import { type ModelRef, parseModelRef, priceFor } from "@/modules/ai/domain/pricing";
import { AiSdkGateway, createGatewayState } from "@/modules/ai/infrastructure/ai-sdk-gateway";
import { noFlags } from "@/modules/ai/infrastructure/supabase-flag-store";
import { SupabaseUsageRecorder } from "@/modules/ai/infrastructure/supabase-usage-recorder";
import type { Database } from "@/shared/lib/db-types";

const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value) return value;
  if (fallback !== undefined) return fallback;
  console.error(`Missing --${name}`);
  process.exit(2);
}

export function modelArg(): ModelRef {
  const ref = parseModelRef(arg("model"));
  if (!ref) {
    console.error("--model must be provider:model with a supported provider (see ai/pricing.ts)");
    process.exit(2);
  }
  if (!priceFor(ref)) {
    console.error(`No price entry for ${ref.provider}:${ref.model}. Add it to ai/pricing.ts first.`);
    process.exit(2);
  }
  return ref;
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient<Database>(url, key, { auth: { persistSession: false } }) : null;
}

/** Collects rows in memory and, when a service key is set, also writes them to ai_usage. */
export function recorder(): UsageRecorder & { rows: UsageRow[] } {
  const admin = adminClient();
  const db = admin ? new SupabaseUsageRecorder(admin, "service") : null;
  const rows: UsageRow[] = [];
  return {
    rows,
    async record(row) {
      rows.push(row);
      await db?.record(row);
    },
    spendTodayMicros: async () => 0,
  };
}

/** A gateway where every profile resolves to the one model under test. */
export function gatewayFor(model: ModelRef, usage: UsageRecorder) {
  const profiles = Object.fromEntries(
    (["analysis", "chat", "chat_deep", "fast", "translate"] as Profile[]).map((p) => [p, [model]]),
  ) as Record<Profile, ModelRef[]>;
  return new AiSdkGateway({
    state: createGatewayState(),
    profiles,
    allowed: [model.provider],
    keys: { anthropic: process.env.ANTHROPIC_API_KEY },
    usage,
    flags: noFlags as never,
  });
}

export const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;
