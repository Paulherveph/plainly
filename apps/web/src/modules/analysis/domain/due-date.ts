/**
 * Grounding for deadlines: a due date counts only if its own quote shows it.
 * A model that turns "within 30 days of arrival" into a calendar date is guessing (B03).
 */

/** Month stems in English and French, Jan..Dec. Chinese dates use digits (2027年1月20日). */
const MONTHS: readonly (readonly string[])[] = [
  ["jan", "janv"],
  ["feb", "fév", "fev"],
  ["mar"],
  ["apr", "avr"],
  ["may", "mai"],
  ["jun", "juin"],
  ["jul", "juil"],
  ["aug", "aoû", "aou"],
  ["sep"],
  ["oct"],
  ["nov"],
  ["dec", "déc"],
];

/** True when the quote states the ISO date's day and month (and, if it names a year, the same year). */
export function quoteSupportsDate(iso: string, quote: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return false;
  const text = quote.normalize("NFKC").toLowerCase();
  const numbers = (text.match(/\d+/g) ?? []).map(Number);
  if (!numbers.includes(day)) return false;
  const years = numbers.filter((n) => n >= 1900 && n <= 2200);
  if (years.length > 0 && !years.includes(year)) return false;
  const names = MONTHS[month - 1] ?? [];
  return numbers.includes(month) || names.some((n) => new RegExp(`(^|[^\\p{L}])${n}`, "u").test(text));
}

/** The date exactly as the document writes it ("03/04/2027"), if the quote holds one. */
export function dateAsWritten(quote: string): string | null {
  return quote.match(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/)?.[0] ?? null;
}
