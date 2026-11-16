import "server-only";
import type { BillingProvider } from "@/modules/billing/application/ports";
import { FakeBillingProvider } from "@/modules/billing/infrastructure/fake-billing-provider";
import { SupabaseBillingStore } from "@/modules/billing/infrastructure/supabase-billing-store";
import { publicEnv, serverEnv } from "@/shared/config/env";
import { createSupabaseAdmin } from "./supabase-admin";

/** Composition for billing. S5 adds the one real provider here, chosen by BILLING_PROVIDER. */
export function billingStore() {
  const admin = createSupabaseAdmin();
  return admin ? new SupabaseBillingStore(admin) : null;
}

export function billingProvider(): BillingProvider &
  Partial<Pick<FakeBillingProvider, "sign" | "readSession">> {
  const env = serverEnv();
  const secret = env.BILLING_WEBHOOK_SECRET ?? "local-fake-billing-secret-not-for-production";
  return new FakeBillingProvider(secret, publicEnv().NEXT_PUBLIC_SITE_URL, billingStore() ?? undefined);
}

/** The dev-only simulator exists only with fake billing, outside production unless explicitly allowed (E2E). */
export function simulatorEnabled(): boolean {
  const env = serverEnv();
  return env.BILLING_PROVIDER === "fake" && (env.NODE_ENV !== "production" || env.ALLOW_FAKE_BILLING);
}
