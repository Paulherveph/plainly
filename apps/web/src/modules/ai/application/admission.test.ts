import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdmission, resetSpendCache } from "./admission";
import type { FlagStore } from "./ports";

function setup(opts: {
  spendUsd: number;
  tier?: "guest" | "free" | "paid";
  perMinute?: number;
  running?: number;
}) {
  const flags = new Map<string, unknown>();
  const store: FlagStore = {
    get: async (k) => flags.get(k),
    all: async () => flags,
    set: async (k, v) => void flags.set(k, v),
  };
  const mailer = { send: vi.fn(async () => ({ ok: true as const, value: null })) };
  const admission = makeAdmission({
    usage: { record: async () => {}, spendTodayMicros: async () => opts.spendUsd * 1_000_000 },
    activity: {
      recent: async () => ({ requestsLastMinute: opts.perMinute ?? 0, runningAnalyses: opts.running ?? 0 }),
    },
    tiers: { tier: async () => ({ tier: opts.tier ?? "free", maxConcurrentAnalyses: 1 }) },
    flags: store,
    mailer,
    alertTo: "ops@example.com",
    budgetUsd: 5,
    today: () => "2026-11-14",
  });
  return { admission, mailer };
}

describe("admission (F16, I02, A19)", () => {
  beforeEach(() => resetSpendCache());

  it("routes Free to the cheaper variant at 80% and alerts once", async () => {
    const { admission, mailer } = setup({ spendUsd: 4.2 });
    expect(await admission.admit({ userId: "u", action: "analysis" })).toEqual({
      ok: true,
      value: { degraded: true },
    });
    await admission.admit({ userId: "u", action: "chat" });
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it("pauses Free at 100% with no charge, keeps paid users going", async () => {
    expect(await setup({ spendUsd: 5 }).admission.admit({ userId: "u", action: "analysis" })).toEqual({
      ok: false,
      error: { kind: "capacity" },
    });
    resetSpendCache();
    expect(
      (await setup({ spendUsd: 5, tier: "paid" }).admission.admit({ userId: "u", action: "analysis" })).ok,
    ).toBe(true);
  });

  it("pauses deep chat at 80%", async () => {
    const res = await setup({ spendUsd: 4.5 }).admission.admit({ userId: "u", action: "chat_deep" });
    expect(res).toEqual({ ok: false, error: { kind: "capacity" } });
  });

  it("limits requests per minute and concurrent analyses", async () => {
    expect(
      await setup({ spendUsd: 0, perMinute: 20 }).admission.admit({ userId: "u", action: "chat" }),
    ).toEqual({
      ok: false,
      error: { kind: "rate_limited" },
    });
    expect(
      await setup({ spendUsd: 0, running: 1 }).admission.admit({ userId: "u", action: "analysis" }),
    ).toEqual({
      ok: false,
      error: { kind: "concurrency", limit: 1 },
    });
  });
});
