import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { makeAdmission, resetSpendCache } from "@/modules/ai/application/admission";
import { FakeAiGateway } from "@/modules/ai/infrastructure/fake-ai-gateway";
import { SupabaseActivityReader } from "@/modules/ai/infrastructure/supabase-activity-reader";
import { SupabaseUsageRecorder } from "@/modules/ai/infrastructure/supabase-usage-recorder";
import { makeEntitlements } from "@/modules/billing/application/entitlement-service";
import { SupabaseCreditStore } from "@/modules/billing/infrastructure/supabase-credit-store";
import { SupabasePlanRepository } from "@/modules/billing/infrastructure/supabase-plan-repository";
import { SupabaseDocumentRepository } from "@/modules/documents/infrastructure/supabase-document-repository";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import type { Database } from "@/shared/lib/db-types";
import { draftFor } from "../infrastructure/fake-analyzer";
import { GatewayAnalyzer } from "../infrastructure/gateway-analyzer";
import { SupabaseAnalysisCache } from "../infrastructure/supabase-analysis-cache";
import { SupabaseAnalysisRepository } from "../infrastructure/supabase-analysis-repository";
import { SupabaseJobStore } from "../infrastructure/supabase-job-store";
import { makeAnalyzeDocument } from "./analyze-document";

/**
 * Drills (docs/SCALING.md section 8, QUALITY_GATE S2/S6) against local Supabase, 0 tokens:
 * - provider outage: the primary fails, the fallback answers, one ai_usage row per attempt, charged once
 * - budget: over the daily budget, analyses return `capacity` and nothing is reserved
 */
const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54325";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE = process.env.SUPABASE_SECRET_KEY ?? "";
const PAGES = ["The Tenant shall pay a security deposit of €1,700 no later than 20 November 2026. ".repeat(3)];

describe("drills", () => {
  const admin = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
  const db = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  let userId = "";

  beforeAll(async () => {
    const email = `drill-${Date.now()}@test.local`;
    const password = `pw-${crypto.randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("no user");
    userId = created.data.user.id;
    const signedIn = await db.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
  });

  async function newDocument(): Promise<string> {
    const id = crypto.randomUUID();
    const res = await new SupabaseDocumentRepository(db).create({
      id,
      userId,
      title: "Drill",
      mediaType: "text/plain",
      storagePath: `${userId}/${id}/original.txt`,
      pageCount: 1,
      pages: PAGES,
      visionPages: [],
      contentHash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64),
      sampleId: null,
      retentionDays: 30,
    });
    if (!res.ok) throw new Error(res.error.kind);
    return id;
  }

  function analyzer(budgetUsd: number, failPrimary: boolean) {
    const usage = new SupabaseUsageRecorder(db, "session");
    const gateway = new FakeAiGateway(
      (call) =>
        call.task === "classify"
          ? { value: { official: true, language: "en" } }
          : { value: draftFor(PAGES, "en") },
      { usage, models: ["primary", "secondary"], script: failPrimary ? { failModels: new Set(["primary"]) } : undefined },
    );
    const entitlements = makeEntitlements({ plans: new SupabasePlanRepository(db), credits: new SupabaseCreditStore(db) });
    const admission = makeAdmission({
      usage,
      activity: new SupabaseActivityReader(db),
      tiers: entitlements.tiers,
      flags: { get: async () => undefined, all: async () => new Map(), set: async () => {} },
      mailer: null,
      alertTo: null,
      budgetUsd,
    });
    return makeAnalyzeDocument({
      documents: new SupabaseDocumentRepository(db),
      files: new SupabaseFileStore(db),
      analyses: new SupabaseAnalysisRepository(db),
      analyzer: new GatewayAnalyzer(gateway),
      cache: new SupabaseAnalysisCache(db),
      samples: { analysis: async () => null },
      jobs: new SupabaseJobStore(db),
      credits: entitlements.credits,
      admission,
      profileVersion: "drill",
      translateCredits: entitlements.translateCredits,
      hash: async (s) => s,
    });
  }

  it("outage: the fallback answers, every attempt is metered, credits are charged once", async () => {
    resetSpendCache();
    const documentId = await newDocument();
    const requestId = `drill-${crypto.randomUUID()}`;
    const outcome = await analyzer(1000, true)({ userId, documentId, locale: "en", requestId });
    expect(outcome.ok && outcome.value.kind).toBe("stream");
    if (!outcome.ok || outcome.value.kind !== "stream") return;
    for await (const _ of outcome.value.partials) {
      // drain
    }
    const done = await outcome.value.done;
    expect(done.ok && done.value.model).toBe("secondary");

    const rows = await admin.from("ai_usage").select("model, status, profile").eq("request_id", requestId);
    const analyze = (rows.data ?? []).filter((r) => r.profile === "analysis");
    expect(analyze.map((r) => [r.model, r.status])).toEqual([
      ["primary", "failed"],
      ["secondary", "ok"],
    ]);
    const holds = await admin.from("credit_holds").select("status").eq("user_id", userId).eq("status", "settled");
    expect(holds.data?.length).toBe(1);
  });

  it("budget: above the daily budget a Free user gets `capacity` and nothing is reserved", async () => {
    resetSpendCache();
    await admin.from("ai_usage").insert({
      user_id: null,
      request_id: `drill-spend-${Date.now()}`,
      profile: "analysis",
      provider: "fake",
      model: "spend",
      cost_micros_usd: 2_000_000,
      status: "ok",
    });
    const before = await admin.from("credit_holds").select("id", { count: "exact", head: true }).eq("user_id", userId);
    const documentId = await newDocument();
    const outcome = await analyzer(1, false)({ userId, documentId, locale: "en", requestId: `drill-${crypto.randomUUID()}` });
    expect(outcome).toEqual({ ok: false, error: { kind: "capacity" } });
    const after = await admin.from("credit_holds").select("id", { count: "exact", head: true }).eq("user_id", userId);
    expect(after.count).toBe(before.count);
  });
});
