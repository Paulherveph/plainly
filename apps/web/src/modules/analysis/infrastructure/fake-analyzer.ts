import type { AnalysisDraft, OutputLocale, PartialAnalysis } from "../domain/analysis";
import { FIXTURES } from "./fake-fixtures";

/**
 * Deterministic analysis for the fake AI gateway (tests, E2E, load tests; USE_FAKE_AI=true).
 * Partials stream like the real model: summary a few words at a time, then one item at a time.
 */
export function fakeAnalysisPartials(draft: AnalysisDraft): PartialAnalysis[] {
  const out: PartialAnalysis[] = [];
  const words = draft.summary.split(/(?<=\s)/);
  const current: PartialAnalysis = { documentType: draft.documentType, language: draft.language, summary: "" };
  for (let i = 0; i < words.length; i += 3) {
    current.summary = words.slice(0, i + 3).join("");
    out.push(structuredClone(current));
  }
  for (const key of ["keyFacts", "actions", "watchOuts", "glossary"] as const) {
    const list: unknown[] = [];
    (current as Record<string, unknown>)[key] = list;
    for (const item of draft[key]) {
      list.push(item);
      out.push(structuredClone(current));
    }
  }
  return out;
}

export function draftFor(pages: string[], locale: OutputLocale): AnalysisDraft {
  const text = pages.join("\n");
  const fixture = FIXTURES.find((f) => text.includes(f.marker));
  if (fixture) return { ...fixture.draft, summary: fixture.summary[locale] };
  return genericDraft(pages);
}

/** For any other text: quote its own sentences so every claim verifies. */
function genericDraft(pages: string[]): AnalysisDraft {
  const sentences = pages.flatMap((page, i) =>
    page
      .split(/(?<=[.!?。])\s+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length >= 20)
      .map((s) => ({ page: i + 1, text: s.slice(0, 200) })),
  );
  const pick = sentences.slice(0, 3);
  return {
    documentType: "Document",
    language: "other",
    summary:
      pick
        .map((s) => s.text)
        .join(" ")
        .slice(0, 590) || "This document has little readable text.",
    keyFacts: pick.map((s, i) => ({
      label: `Point ${i + 1}`,
      value: s.text.slice(0, 80),
      cite: { page: s.page, quote: s.text },
    })),
    actions: [],
    watchOuts: [],
    glossary: [],
  };
}
