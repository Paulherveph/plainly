import { z } from "zod";
import type { Analysis } from "./analysis";

/**
 * What the translate profile receives and returns: every reader-facing field, never the quotes.
 * Quotes stay in the document's language, so they still verify after translation.
 */
export const Translatable = z.object({
  documentType: z.string(),
  summary: z.string(),
  keyFacts: z.array(z.object({ label: z.string(), value: z.string() })),
  actions: z.array(z.object({ title: z.string(), detail: z.string(), dueRule: z.string().nullable() })),
  watchOuts: z.array(z.object({ title: z.string(), explanation: z.string() })),
  glossary: z.array(z.object({ term: z.string(), plain: z.string() })),
});
export type Translatable = z.infer<typeof Translatable>;

export function stripQuotes(a: Analysis): Translatable {
  return {
    documentType: a.documentType,
    summary: a.summary,
    keyFacts: a.keyFacts.map(({ label, value }) => ({ label, value })),
    actions: a.actions.map(({ title, detail, dueRule }) => ({ title, detail, dueRule })),
    watchOuts: a.watchOuts.map(({ title, explanation }) => ({ title, explanation })),
    glossary: a.glossary,
  };
}

/** Puts the translated text back around the original quotes. Null if the shape changed. */
export function restoreQuotes(source: Analysis, t: Translatable): Analysis | null {
  if (
    t.keyFacts.length !== source.keyFacts.length ||
    t.actions.length !== source.actions.length ||
    t.watchOuts.length !== source.watchOuts.length ||
    t.glossary.length !== source.glossary.length
  )
    return null;
  return {
    ...source,
    documentType: t.documentType.slice(0, 60),
    summary: t.summary.slice(0, 600),
    keyFacts: source.keyFacts.map((f, i) => ({ ...f, ...pick(t.keyFacts[i], ["label", "value"]) })),
    actions: source.actions.map((a, i) => ({ ...a, ...pick(t.actions[i], ["title", "detail", "dueRule"]) })),
    watchOuts: source.watchOuts.map((w, i) => ({ ...w, ...pick(t.watchOuts[i], ["title", "explanation"]) })),
    glossary: t.glossary,
  };
}

function pick<T extends object, K extends keyof T>(obj: T | undefined, keys: K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  if (!obj) return out;
  for (const k of keys) out[k] = obj[k];
  return out;
}
