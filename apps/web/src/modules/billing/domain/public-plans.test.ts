import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PLANS, yearlySavingPercent } from "./public-plans";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "..", "..", "supabase", "migrations", name), "utf8");

describe("public plan facts match the seed", () => {
  it("uses the same numbers as the plans migrations", () => {
    const base = migration("20261114300000_credits_billing.sql");
    const v2 = migration("20261114500000_plans_max.sql");
    const { free, pro, max, guest, pack } = PUBLIC_PLANS;
    expect(base).toContain(`'{"credits":${guest.credits},"maxPages":${guest.maxPages},`);
    expect(base).toContain(
      `'{"credits":${free.credits},"maxPages":${free.maxPages},"maxBytes":${free.maxMb * 1048576},"retentionDays":${free.retentionDays},`,
    );
    expect(base).toContain(`('pro_month', 'Pro', 'subscription', ${pro.priceMonthCents}, 'month'`);
    expect(base).toContain(
      `'{"credits":${pro.credits},"maxPages":${pro.maxPages},"maxBytes":${pro.maxMb * 1048576},"retentionDays":${pro.retentionDays},"deepChat":true,"allLocales":true,"concurrency":${pro.concurrency},`,
    );
    expect(v2).toContain(`price_cents = ${pro.priceYearCents} where id = 'pro_year'`);
    expect(base).toContain(`('max_month', 'Max', 'subscription', ${max.priceMonthCents}, 'month'`);
    expect(v2).toContain("active = true, name = 'Max' where id = 'max_month'");
    expect(v2).toContain(`('max_year', 'Max (yearly)', 'subscription', ${max.priceYearCents}, 'year'`);
    expect(v2).toContain(
      `'{"credits":${max.credits},"maxPages":${max.maxPages},"maxBytes":${max.maxMb * 1048576},"retentionDays":${max.retentionDays},"deepChat":true,"allLocales":true,"concurrency":${max.concurrency},`,
    );
    expect(base).toContain(`'pack', ${pack.priceCents}, 'once', 10, true, '{"credits":${pack.credits}}'`);
  });

  it("yearly plans are two months free", () => {
    expect(yearlySavingPercent(PUBLIC_PLANS.pro)).toBe(17);
    expect(yearlySavingPercent(PUBLIC_PLANS.max)).toBe(17);
  });
});
