import type { Analysis, Cite } from "./analysis";
import { quoteSupportsDate } from "./due-date";

/** Shorter quotes match almost anything, so they can't prove a claim. */
export const MIN_QUOTE_KEY_LENGTH = 6;

/**
 * Comparison key: Unicode-normalised (NFKC), lower case, typographic quotes unified,
 * line-break hyphenation removed, Markdown emphasis (* _ `) removed, all whitespace removed.
 */
export function matchKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚ʼ′]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/­/g, "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
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
