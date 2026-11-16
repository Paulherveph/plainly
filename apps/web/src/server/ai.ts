import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeAdmission, type TierReader } from "@/modules/ai/application/admission";
import type { AiGateway, Profile } from "@/modules/ai/application/ports";
import { modelKey } from "@/modules/ai/domain/pricing";
import { AiSdkGateway, createGatewayState } from "@/modules/ai/infrastructure/ai-sdk-gateway";
import { FakeAiGateway } from "@/modules/ai/infrastructure/fake-ai-gateway";
import { SupabaseActivityReader } from "@/modules/ai/infrastructure/supabase-activity-reader";
import { SupabaseFlagStore } from "@/modules/ai/infrastructure/supabase-flag-store";
import { SupabaseUsageRecorder } from "@/modules/ai/infrastructure/supabase-usage-recorder";
import { providerSettings, serverEnv } from "@/shared/config/env";
import type { Database } from "@/shared/lib/db-types";
import { fakeResponder } from "./fake-ai";
import { ResendMailer } from "./resend-mailer";
import { createSupabaseAdmin } from "./supabase-admin";

/** Circuit breaker and loaded providers live for the whole server instance. */
const state = createGatewayState();
let gatewayForHealth: AiSdkGateway | null = null;

export function aiProfiles(): Record<Profile, ReturnType<typeof serverEnv>["AI_PROFILE_ANALYSIS"]> {
  const env = serverEnv();
  return {
    analysis: env.AI_PROFILE_ANALYSIS,
    chat: env.AI_PROFILE_CHAT,
    chat_deep: env.AI_PROFILE_CHAT_DEEP,
    fast: env.AI_PROFILE_FAST,
    translate: env.AI_PROFILE_TRANSLATE,
  };
}

/** Changes when the analysis models change, so cached results never mix models. */
export function profileVersion(): string {
  return serverEnv().USE_FAKE_AI ? "fake" : aiProfiles().analysis.map(modelKey).join(",");
}

export function flagStore() {
  return new SupabaseFlagStore(createSupabaseAdmin());
}

/** The gateway for one request; metering goes through the caller's session (RLS). */
export function aiGateway(session: SupabaseClient<Database>): AiGateway {
  const env = serverEnv();
  const usage = new SupabaseUsageRecorder(session, "session");
  if (env.USE_FAKE_AI) return new FakeAiGateway(fakeResponder, { usage, stepMs: 20 });
  const gateway = new AiSdkGateway({
    state,
    profiles: aiProfiles(),
    allowed: env.AI_PROVIDERS_ALLOWED,
    providers: providerSettings(env),
    timeoutMs: env.AI_TIMEOUT_MS,
    usage,
    flags: flagStore(),
  });
  gatewayForHealth = gateway;
  return gateway;
}

export function providerHealth() {
  return (
    gatewayForHealth?.health() ??
    serverEnv().AI_PROVIDERS_ALLOWED.map((provider) => ({ provider, state: "ok" as const }))
  );
}

export function admission(session: SupabaseClient<Database>, tiers: TierReader) {
  const env = serverEnv();
  return makeAdmission({
    usage: new SupabaseUsageRecorder(session, "session"),
    activity: new SupabaseActivityReader(session),
    tiers,
    flags: flagStore(),
    mailer:
      env.RESEND_API_KEY && env.EMAIL_FROM ? new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM) : null,
    alertTo: env.ALERT_EMAIL ?? null,
    budgetUsd: env.AI_DAILY_BUDGET_USD,
  });
}
