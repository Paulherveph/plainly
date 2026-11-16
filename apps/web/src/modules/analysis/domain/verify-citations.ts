import type { Analysis, Cite } from "./analysis";
import { quoteSupportsDate } from "./due-date";

/** Shorter quotes match almost anything, so they can't prove a claim. */
export const MIN_QUOTE_KEY_LENGTH = 6;

/** A hyphen (any dash, incl. full-width) that ends a line: PDF line-break hyphenation. */
const LINE_BREAK_HYPHEN = /[-\u2010-\u2015\u2212\uFE63\uFF0D]\s*\n\s*/g;

/** One character of the comparison key (may be empty or longer than one unit). */
function keyChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code < 128) return /[\s*_`]/.test(ch) ? "" : ch.toLowerCase();
  return ch
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00AD\s*_`]/g, "")
    .toLowerCase();
}

export type IndexedKey = {
  /** The comparison key. */
  key: string;
  /** For each key unit, where its source character starts and ends in the text. */
  start: number[];
  end: number[];
};

/**
 * Comparison key with a map back to the source text: Unicode-normalised (NFKC), lower case,
 * typographic quotes and dashes unified, line-break hyphenation, soft hyphens, Markdown
 * emphasis (* _ `) and all whitespace removed. Verification and highlighting both use it,
 * so any quote that verifies can also be shown on the page.
 */
export function indexedKey(text: string): IndexedKey {
  const skip = new Uint8Array(text.length);
  for (const m of text.matchAll(LINE_BREAK_HYPHEN)) skip.fill(1, m.index, m.index + m[0].length);
  let key = "";
  const start: number[] = [];
  const end: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 0);
    const next = i + ch.length;
    if (!skip[i]) {
      const k = keyChar(ch);
      key += k;
      for (let u = 0; u < k.length; u++) {
        start.push(i);
        end.push(next);
      }
    }
    i = next;
  }
  return { key, start, end };
}

/** The comparison key alone (see indexedKey). */
export function matchKey(text: string): string {
  return indexedKey(text).key;
}

/** Returns the 1-based page where the quote appears, or null. */
export function locateQuote(quote: string, pages: readonly string[]): number | null {
  const key = matchKey(quote);
  if (key.length < MIN_QUOTE_KEY_LENGTH) return null;
  const index = pages.findIndex((page) => matchKey(page).includes(key));
  return index === -1 ? null : index + 1;
}

/** A verified cite, with the page corrected if the model got it wrong; null if the quote isn't in the text. */
export function verifyCite(cite: Cite, pages: readonly string[]): Cite | null {
  const key = matchKey(cite.quote);
  if (key.length < MIN_QUOTE_KEY_LENGTH) return null;
  const claimed = cite.page !== null ? pages[cite.page - 1] : undefined;
  if (claimed !== undefined && matchKey(claimed).includes(key)) return cite;
  const found = locateQuote(cite.quote, pages);
  return found === null ? null : { ...cite, page: found };
}

/**
 * Keeps only facts, actions and watch-outs whose quote exists in the document text.
 * An action keeps its due date only if its quote shows that date; otherwise the quote
 * becomes the rule ("within 30 days of arrival") and the reader picks the date.
 * Returns a new analysis and the number of dropped claims (logged, never the content).
 */
export function verifyCitations(
  analysis: Analysis,
  pages: readonly string[],
): { analysis: Analysis; dropped: number } {
  let dropped = 0;
  function keep<T extends { cite: Cite }>(items: readonly T[]): T[] {
    const kept: T[] = [];
    for (const item of items) {
      const cite = verifyCite(item.cite, pages);
      if (cite) kept.push({ ...item, cite });
      else dropped++;
    }
    return kept;
  }
  const verified: Analysis = {
    ...analysis,
    keyFacts: keep(analysis.keyFacts),
    actions: keep(analysis.actions).map((a) =>
      a.dueOn && !quoteSupportsDate(a.dueOn, a.cite.quote)
        ? { ...a, dueOn: null, dueRule: a.dueRule ?? a.cite.quote.slice(0, 200) }
        : a,
    ),
    watchOuts: keep(analysis.watchOuts),
  };
  return { analysis: verified, dropped };
}
