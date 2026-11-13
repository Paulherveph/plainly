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
