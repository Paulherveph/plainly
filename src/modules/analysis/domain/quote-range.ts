const LINE_BREAK_HYPHEN = "(?:-\\s*\\n\\s*)?";

function charPattern(char: string): string {
  if (char === "'" || char === "’") return "['’]";
  return char.replace(/[.*+?^${}()|[\]-]/g, "\\$&");
}

/**
 * Finds a quote in the original page text for highlighting. Tolerates the same
 * differences as verification, for display: case, runs of whitespace,
 * hyphenated line breaks and typographic apostrophes.
 */
export function findQuoteRange(page: string, quote: string): { start: number; end: number } | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words.map((w) => [...w].map(charPattern).join(LINE_BREAK_HYPHEN)).join("\\s+");
  const match = new RegExp(pattern, "iu").exec(page);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
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
