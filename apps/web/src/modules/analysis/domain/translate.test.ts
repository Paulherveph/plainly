import { describe, expect, it } from "vitest";
import type { Analysis } from "./analysis";
import { restoreQuotes, stripQuotes } from "./translate";

const source: Analysis = {
  documentType: "Lease",
  language: "fr",
  summary: "A lease.",
  keyFacts: [{ label: "Rent", value: "850 EUR", cite: { page: 1, quote: "Le loyer est de 850 euros" } }],
  actions: [
    {
      title: "Pay",
      detail: "Monthly",
      dueOn: "2026-03-01",
      dueRule: null,
      dateAmbiguous: false,
      cite: { page: 1, quote: "payable le 1er" },
    },
  ],
  watchOuts: [],
  glossary: [],
};

describe("translation keeps quotes (B16)", () => {
  it("never sends quotes to the model", () => {
    expect(JSON.stringify(stripQuotes(source))).not.toContain("Le loyer est de 850 euros");
  });

  it("restores the original quotes, pages and dates around translated text", () => {
    const t = stripQuotes(source);
    const translated = restoreQuotes(source, {
      ...t,
      summary: "Un bail.",
      keyFacts: [{ label: "Loyer", value: "850 EUR" }],
      actions: [{ title: "Payer", detail: "Chaque mois", dueRule: null }],
    });
    expect(translated?.keyFacts[0]).toEqual({
      label: "Loyer",
      value: "850 EUR",
      cite: source.keyFacts[0]?.cite,
    });
    expect(translated?.actions[0]?.dueOn).toBe("2026-03-01");
  });

  it("rejects a translation that changed the number of items", () => {
    expect(restoreQuotes(source, { ...stripQuotes(source), keyFacts: [] })).toBeNull();
  });
});
