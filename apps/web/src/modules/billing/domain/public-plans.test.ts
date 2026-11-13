import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PLANS } from "./public-plans";

describe("public plan facts match the seed", () => {
  it("uses the same numbers as the plans migration", () => {
    const sql = readFileSync(
      join(process.cwd(), "..", "..", "supabase", "migrations", "20261114300000_credits_billing.sql"),
      "utf8",
    );
    expect(sql).toContain(`'{"credits":${PUBLIC_PLANS.guest.credits},"maxPages":${PUBLIC_PLANS.guest.maxPages},`);
    expect(sql).toContain(`'{"credits":${PUBLIC_PLANS.free.credits},"maxPages":${PUBLIC_PLANS.free.maxPages},`);
    expect(sql).toContain(`('pro_month', 'Pro', 'subscription', ${PUBLIC_PLANS.pro.priceMonthCents}, 'month'`);
    expect(sql).toContain(`('pro_year', 'Pro (yearly)', 'subscription', ${PUBLIC_PLANS.pro.priceYearCents}, 'year'`);
    expect(sql).toContain(`'pack', ${PUBLIC_PLANS.pack.priceCents}, 'once', 10, true, '{"credits":${PUBLIC_PLANS.pack.credits}}'`);
  });
});
