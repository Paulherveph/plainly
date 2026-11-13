import { describe, expect, it } from "vitest";
import { type AnalysisDraft, toAnalysis } from "./analysis";

const draft: AnalysisDraft = {
  documentType: "Lease",
  language: "fr",
  summary: "x".repeat(700),
  keyFacts: [],
  actions: [
    { title: " Pay ", detail: "d", dueOn: "2026-11-20", cite: { page: 1, quote: "q" } },
    { title: "Bad date", detail: "d", dueOn: "20/11/2026", cite: { page: 0, quote: "q" } },
    { title: "No date", detail: "d", dueOn: null, cite: { page: null, quote: "q" } },
  ],
  watchOuts: [
    { severity: "info", title: "i", explanation: "e", cite: { page: 1, quote: "q" } },
    { severity: "critical", title: "c", explanation: "e", cite: { page: 1, quote: "q" } },
    { severity: "caution", title: "w", explanation: "e", cite: { page: 1, quote: "q" } },
  ],
  glossary: [],
};

describe("toAnalysis", () => {
  const a = toAnalysis(draft);
  it("clamps the summary to 600 characters", () => expect(a.summary.length).toBe(600));
  it("keeps valid ISO dates and drops others (never guesses)", () => {
    expect(a.actions.map((x) => x.dueOn)).toEqual(["2026-11-20", null, null]);
  });
  it("trims text and nulls invalid page numbers", () => {
    expect(a.actions[0]?.title).toBe("Pay");
    expect(a.actions[1]?.cite.page).toBeNull();
  });
  it("sorts watch-outs from critical to info", () => {
    expect(a.watchOuts.map((w) => w.severity)).toEqual(["critical", "caution", "info"]);
  });
});

describe("deadline rules and caps", () => {
  const base: AnalysisDraft = { ...draft, actions: [], watchOuts: [] };

  it("B03: keeps a relative deadline as a rule without inventing a date", () => {
    const a = toAnalysis({
      ...base,
      actions: [
        { title: "Reply", detail: "d", dueOn: null, dueRule: "within 30 days of receipt", cite: { page: 1, quote: "q" } },
      ],
    });
    expect(a.actions[0]).toMatchObject({ dueOn: null, dueRule: "within 30 days of receipt", dateAmbiguous: false });
  });

  it("B04: an ambiguous date is flagged and never stored as a date", () => {
    const a = toAnalysis({
      ...base,
      actions: [
        { title: "Pay", detail: "d", dueOn: "2026-04-03", dateAmbiguous: true, dueRule: "03/04/2026", cite: { page: 1, quote: "q" } },
      ],
    });
    expect(a.actions[0]).toMatchObject({ dueOn: null, dateAmbiguous: true, dueRule: "03/04/2026" });
  });

  it("caps the lists (output is the expensive side)", () => {
    const fact = { label: "l", value: "v", cite: { page: 1, quote: "q" } };
    const a = toAnalysis({ ...base, keyFacts: Array.from({ length: 12 }, () => fact) });
    expect(a.keyFacts).toHaveLength(8);
  });
});
