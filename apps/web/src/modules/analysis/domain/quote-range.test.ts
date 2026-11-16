import { describe, expect, it } from "vitest";
import { findQuoteRange, reflowPage } from "./quote-range";
import { locateQuote } from "./verify-citations";

const PAGE =
  "§9 Pets. No animals may be kept without the prior written consent of\nthe Land-\nlord. Tenant’s duties.";

function slice(page: string, quote: string) {
  const r = findQuoteRange(page, quote);
  return r ? page.slice(r.start, r.end) : null;
}

describe("findQuoteRange", () => {
  it("finds a quote across a line break", () => {
    expect(slice(PAGE, "prior written consent of the")).toBe("prior written consent of\nthe");
  });
  it("finds a quote across a hyphenated line break", () => {
    expect(slice(PAGE, "the Landlord")).toBe("the Land-\nlord");
  });
  it("is case-insensitive and apostrophe-tolerant", () => {
    expect(slice(PAGE, "tenant's duties")).toBe("Tenant’s duties");
  });
  it("escapes regex characters and returns null when absent", () => {
    expect(slice("Price (€850) per month", "(€850)")).toBe("(€850)");
    expect(findQuoteRange(PAGE, "parking included")).toBeNull();
    expect(findQuoteRange(PAGE, "   ")).toBeNull();
  });
});

describe("findQuoteRange: anything that verifies can be highlighted", () => {
  it.each([
    // The crash from the field: a hyphen became an invalid escape under the `u` flag.
    ["for a twelve-month period", "Runs for a twelve-month period.", "for a twelve-month period"],
    ["03/04/2027 — submit", "Deadline: 03/04/2027 — submit materials", "03/04/2027 — submit"],
    ['the "Service"', "called the “Service” here", "the “Service”"],
    [
      "Frais de tenue de compte : 4,50 EUR",
      "1. **Frais de tenue de compte** : 4,50 EUR par mois",
      "Frais de tenue de compte** : 4,50 EUR",
    ],
    ["4,50EUR", "un montant de 4,50 EUR sera prélevé", "4,50 EUR"],
    ["Rent: 850", "Ｒｅｎｔ: 850 per month", "Ｒｅｎｔ: 850"],
    ["(a) [b] {c} ^$ |?*+.", "x (a) [b] {c} ^$ |?*+. y", "(a) [b] {c} ^$ |?*+."],
  ])("%j", (quote, page, expected) => {
    expect(slice(page, quote)).toBe(expected);
  });

  it("highlights every quote that verifyCitations would keep", () => {
    const pages = [
      PAGE,
      "第三条 租金每月850欧元，于每月5日前支付。",
      "Pay by: 25/11/2026 — no later than 20 November 2026.",
    ];
    const quotes = [
      "prior written consent of the Landlord",
      "租金每月850欧元",
      "25/11/2026 — no later",
      "Tenant's duties",
    ];
    for (const quote of quotes) {
      const page = locateQuote(quote, pages);
      expect(page, quote).not.toBeNull();
      expect(findQuoteRange(pages[(page ?? 1) - 1] ?? "", quote), quote).not.toBeNull();
    }
  });
});

describe("reflowPage", () => {
  it("joins mid-sentence breaks but keeps headings, clauses and sentence ends", () => {
    const raw =
      "RESIDENTIAL LEASE\nThis is made between A (the\nTenant) and B.\n§1 Term. Runs for a period of\ntwelve months.\n§2 Rent. The Land-\nlord gets paid.";
    expect(reflowPage(raw)).toBe(
      "RESIDENTIAL LEASE\nThis is made between A (the Tenant) and B.\n§1 Term. Runs for a period of twelve months.\n§2 Rent. The Landlord gets paid.",
    );
  });
});
