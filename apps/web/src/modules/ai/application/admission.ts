import type { AppError } from "@/shared/lib/errors";
import { logError } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { alertLevel, budgetState, RATE_LIMIT_PER_MINUTE, type Tier } from "../domain/budget";
import type { FlagStore, Mailer, UsageRecorder } from "./ports";

export type AdmissionAction = "analysis" | "chat" | "chat_deep" | "translate";

export interface ActivityReader {
  recent(userId: string): Promise<{ requestsLastMinute: number; runningAnalyses: number }>;
}

/** Plan facts the guard needs (S4 entitlements provide them). */
export interface TierReader {
  tier(userId: string): Promise<{ tier: Tier; maxConcurrentAnalyses: number }>;
}

const SPEND_TTL_MS = 30_000;
let spendCache: { at: number; micros: number } | null = null;

/**
 * Checked before any model call: per-user rate and concurrency, then the global daily budget.
 * Returns whether to route to the cheaper model variant.
 */
export function makeAdmission(deps: {
  usage: UsageRecorder;
  activity: ActivityReader;
  tiers: TierReader;
  flags: FlagStore;
  mailer: Mailer | null;
  alertTo: string | null;
  budgetUsd: number;
  today?: () => string;
}) {
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  async function spend(): Promise<number> {
    if (spendCache && Date.now() - spendCache.at < SPEND_TTL_MS) return spendCache.micros;
    const micros = await deps.usage.spendTodayMicros();
    spendCache = { at: Date.now(), micros };
    return micros;
  }

  async function alert(micros: number): Promise<void> {
    const level = alertLevel(micros, deps.budgetUsd);
    if (!level || !deps.mailer || !deps.alertTo) return;
    const key = `budget_alert:${today()}:${level}`;
    if (await deps.flags.get(key)) return;
    await deps.flags.set(key, true);
    const sent = await deps.mailer.send({
      to: deps.alertTo,
      subject: `Plainly AI budget at ${level}%`,
      text: `Spend today: $${(micros / 1_000_000).toFixed(2)} of $${deps.budgetUsd.toFixed(2)}. ${
        level === 100
          ? "Guest and Free analyses are paused until tomorrow (UTC)."
          : "Guest and Free use the cheaper model."
      }`,
    });
    if (!sent.ok) logError("budget.alert_failed", { level });
  }

  return {
    async admit(input: {
      userId: string;
      action: AdmissionAction;
    }): Promise<Result<{ degraded: boolean }, AppError>> {
      const [{ tier, maxConcurrentAnalyses }, activity] = await Promise.all([
        deps.tiers.tier(input.userId),
        deps.activity.recent(input.userId),
      ]);
      if (activity.requestsLastMinute >= RATE_LIMIT_PER_MINUTE) return err({ kind: "rate_limited" });
      if (input.action === "analysis" && activity.runningAnalyses >= maxConcurrentAnalyses)
        return err({ kind: "concurrency", limit: maxConcurrentAnalyses });

      const micros = await spend();
      await alert(micros);
      const state = budgetState(micros, deps.budgetUsd, tier);
      if (state === "capacity") return err({ kind: "capacity" });
      if (state === "degrade" && input.action === "chat_deep") return err({ kind: "capacity" });
      return ok({ degraded: state === "degrade" });
    },
  };
}

/** For tests and drills: forget the cached spend. */
export function resetSpendCache(): void {
  spendCache = null;
}
