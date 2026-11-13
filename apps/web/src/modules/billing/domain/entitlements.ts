import { z } from "zod";
import type { AppError } from "@/shared/lib/errors";
import { err, ok, type Result } from "@/shared/lib/result";

export const Entitlements = z.object({
  credits: z.number().int().nonnegative(),
  maxPages: z.number().int().positive().default(100),
  maxBytes: z.number().int().positive().default(31_457_280),
  retentionDays: z.number().int().positive().default(30),
  deepChat: z.boolean().default(false),
  allLocales: z.boolean().default(false),
  concurrency: z.number().int().positive().default(1),
  packs: z.boolean().default(false),
});
export type Entitlements = z.infer<typeof Entitlements>;

export type PlanId = string;
export type Tier = "guest" | "free" | "paid";

export function tierOf(planId: PlanId): Tier {
  if (planId === "guest") return "guest";
  if (planId === "free") return "free";
  return "paid";
}

export type Action =
  | { kind: "upload"; pages: number; bytes: number }
  | { kind: "analysis"; credits: number }
  | { kind: "chat"; deep: boolean; credits: number }
  | { kind: "extra_locale"; credits: number; locales: number };

/**
 * One place that decides what a plan allows (docs/PRICING.md section 4). Pure: the caller passes
 * the plan and balance. UI checks are for display only; every use case calls this.
 */
export function checkAction(
  action: Action,
  ent: Entitlements,
  available: number,
): Result<null, AppError> {
  switch (action.kind) {
    case "upload":
      if (action.bytes > ent.maxBytes) return err({ kind: "file_too_large", maxBytes: ent.maxBytes });
      if (action.pages > ent.maxPages) return err({ kind: "page_limit", max: ent.maxPages });
      return ok(null);
    case "chat":
      if (action.deep && !ent.deepChat) return err({ kind: "feature_not_in_plan", feature: "deep_chat" });
      return enough(action.credits, available);
    case "extra_locale":
      // B16: on plans without all locales, a second locale costs a credit; with it, it is included.
      return ent.allLocales ? ok(null) : enough(action.credits, available);
    case "analysis":
      return enough(action.credits, available);
  }
}

function enough(needed: number, available: number): Result<null, AppError> {
  return needed <= available ? ok(null) : err({ kind: "insufficient_credits", needed, available });
}

/** Cost of an extra locale on this plan (0 when the plan includes all locales). */
export const extraLocaleCost = (ent: Entitlements, base: number): number => (ent.allLocales ? 0 : base);
