import { describe, expect, it } from "vitest";
import type { Analysis } from "./analysis";
import { locateQuote, matchKey, verifyCitations, verifyCite } from "./verify-citations";

const PAGES = [
  "§2 Rent. The monthly rent is €850, payable on or before the 5th day of each month.\n§4 Deposit. The Tenant shall pay a security deposit of €1,700 no later than 20 November 2026.",
  "§9 Pets. No animals may be kept without the prior written consent of the Land-\nlord.\n§10 Access with at least 24 hours’ notice.",
  "第三条 租金每月850欧元，于每月5日前支付。",
];

const base: Analysis = {
  documentType: "Lease",
  language: "en",
  summary: "A lease.",
  keyFacts: [],
  actions: [],
  watchOuts: [],
  glossary: [{ term: "Deposit", plain: "Money paid upfront." }],
};

describe("matchKey", () => {
  it("ignores case, whitespace and typographic quotes", () => {
    expect(matchKey("The  Monthly\nRENT’s")).toBe(matchKey("the monthly rent's"));
  });
  it("normalises full-width characters (NFKC)", () => {
    expect(matchKey("８５０")).toBe(matchKey("850"));
  });
});

describe("locateQuote", () => {
  it("finds an exact quote on its page", () => {
    expect(locateQuote("security deposit of €1,700 no later than 20 November 2026", PAGES)).toBe(1);
  });
  it("survives line breaks and hyphenation from PDF extraction", () => {
    expect(locateQuote("prior written consent of the Landlord", PAGES)).toBe(2);
  });
  it("matches curly vs straight apostrophes", () => {
    expect(locateQuote("at least 24 hours' notice", PAGES)).toBe(2);
  });
  it("works with Chinese text", () => {
    expect(locateQuote("租金每月850欧元", PAGES)).toBe(3);
  });
  it("returns null for an invented quote", () => {
    expect(locateQuote("the landlord pays all utilities", PAGES)).toBeNull();
  });
  it("rejects quotes too short to prove anything", () => {
    expect(locateQuote("the", PAGES)).toBeNull();
    expect(locateQuote("   ", PAGES)).toBeNull();
  });
});

describe("verifyCite", () => {
  it("keeps the page when the quote is on it", () => {
    expect(verifyCite({ page: 1, quote: "The monthly rent is €850" }, PAGES)).toEqual({
      page: 1,
      quote: "The monthly rent is €850",
    });
  });
  it("corrects a wrong page number instead of dropping a real quote", () => {
    expect(verifyCite({ page: 3, quote: "The monthly rent is €850" }, PAGES)?.page).toBe(1);
  });
  it("returns null when the quote is nowhere", () => {
    expect(verifyCite({ page: 1, quote: "rent is €999 per week" }, PAGES)).toBeNull();
  });
});

describe("verifyCitations", () => {
  const analysis: Analysis = {
    ...base,
    keyFacts: [
      { label: "Rent", value: "€850", cite: { page: 1, quote: "The monthly rent is €850" } },
      { label: "Parking", value: "Included", cite: { page: 1, quote: "Parking is included in the rent" } },
    ],
    actions: [
      {
        title: "Pay deposit",
        detail: "€1,700",
        dueOn: "2026-11-20",
        cite: { page: 1, quote: "no later than 20 November 2026" },
      },
      {
        title: "Invented",
        detail: "x",
        dueOn: "2026-12-24",
        cite: { page: 2, quote: "pay a Christmas bonus by 24 December" },
      },
    ],
    watchOuts: [
      {
        severity: "caution",
        title: "Pets",
        explanation: "Ask first.",
        cite: { page: 2, quote: "prior written consent of the Landlord" },
      },
    ],
  };

  it("drops claims whose quote is not in the document and counts them", () => {
    const { analysis: verified, dropped } = verifyCitations(analysis, PAGES);
    expect(dropped).toBe(2);
    expect(verified.keyFacts.map((f) => f.label)).toEqual(["Rent"]);
    expect(verified.actions.map((a) => a.title)).toEqual(["Pay deposit"]);
    expect(verified.watchOuts).toHaveLength(1);
  });

  it("keeps fields without citations untouched", () => {
    const { analysis: verified } = verifyCitations(analysis, PAGES);
    expect(verified.summary).toBe(analysis.summary);
    expect(verified.glossary).toEqual(analysis.glossary);
  });

  it("drops everything cited when there is no text to check against", () => {
    const { analysis: verified, dropped } = verifyCitations(analysis, []);
    expect(dropped).toBe(5);
    expect(verified.keyFacts).toEqual([]);
  });

  it("does not mutate the input", () => {
    const copy = structuredClone(analysis);
    verifyCitations(analysis, PAGES);
    expect(analysis).toEqual(copy);
  });
});
