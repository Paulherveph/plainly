import { indexedKey } from "./verify-citations";

/**
 * Finds a quote in the original page text for highlighting. Uses the same comparison
 * key as verification, so every verified quote can be highlighted. No RegExp is built
 * from the quote, so no character in it can break the search.
 */
export function findQuoteRange(page: string, quote: string): { start: number; end: number } | null {
  const needle = indexedKey(quote).key;
  if (needle.length === 0) return null;
  const hay = indexedKey(page);
  const at = hay.key.indexOf(needle);
  if (at === -1) return null;
  return { start: hay.start[at] ?? 0, end: hay.end[at + needle.length - 1] ?? page.length };
}

/**
 * For display only: joins the hard line breaks PDF extraction leaves inside sentences.
 * A break is kept after sentence punctuation, after an all-caps heading, or before a § / numbered clause.
 */
export function reflowPage(text: string): string {
  const lines = text.split("\n");
  let out = "";
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (i === 0) {
      out = line;
      return;
    }
    const prev = lines[i - 1]?.trim() ?? "";
    const keepBreak =
      prev === "" ||
      line === "" ||
      /[.:;!?。：；]$/.test(prev) ||
      (/^[^a-z]+$/.test(prev) && /[A-Z]/.test(prev)) ||
      /^(§|\d+[.)]|[-•*]\s)/.test(line);
    if (keepBreak) out += `\n${line}`;
    else if (prev.endsWith("-")) out = `${out.slice(0, -1)}${line}`;
    else out += ` ${line}`;
  });
  return out;
}
