/**
 * RFC 5545 calendar for all-day deadlines. Dates are "floating" (no time zone):
 * 20 November stays 20 November wherever the calendar is opened.
 * All arithmetic is done in UTC so the server's zone never shifts a day.
 */
export type IcsEvent = { uid: string; dueOn: string; title: string; description?: string };

export function toIcs(events: readonly IcsEvent[], options: { now: Date; calendarName?: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plainly//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "Plainly deadlines")}`,
  ];
  const stamp = utcStamp(options.now);
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@plainly`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(e.dueOn)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(e.dueOn))}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** YYYY-MM-DD + 1 day, in UTC (handles month ends, leap years, year ends). */
export function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, ";").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded with CRLF + space, never splitting a UTF-8 character. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
