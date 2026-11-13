import { afterEach, describe, expect, it } from "vitest";
import { escapeText, fold, nextDay, toIcs } from "./to-ics";

const NOW = new Date("2026-11-11T09:30:15.123Z");
const event = {
  uid: "d-1",
  dueOn: "2026-11-20",
  title: "Pay the security deposit",
  description: "€1,700; by transfer",
};

describe("toIcs", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("writes one all-day event with the exact date", () => {
    expect(toIcs([event], { now: NOW })).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Plainly//Deadlines//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Plainly deadlines",
        "BEGIN:VEVENT",
        "UID:d-1@plainly",
        "DTSTAMP:20261111T093015Z",
        "DTSTART;VALUE=DATE:20261120",
        "DTEND;VALUE=DATE:20261121",
        "SUMMARY:Pay the security deposit",
        "DESCRIPTION:€1\\,700; by transfer",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });

  it.each([
    "UTC",
    "Pacific/Kiritimati",
    "Pacific/Pago_Pago",
    "Asia/Shanghai",
    "America/Los_Angeles",
  ])("never shifts the day in time zone %s", (tz) => {
    process.env.TZ = tz;
    const ics = toIcs([{ uid: "x", dueOn: "2026-12-31", title: "Year end" }], { now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("DTSTAMP:20261111T093015Z");
  });

  it("exports several events in order, with CRLF line endings only", () => {
    const ics = toIcs([event, { uid: "d-2", dueOn: "2026-12-01", title: "Send proof of insurance" }], {
      now: NOW,
      calendarName: "Lease, Lyon",
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:Lease\\, Lyon");
    expect(ics.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("produces an empty but valid calendar", () => {
    expect(toIcs([], { now: NOW })).toMatch(/^BEGIN:VCALENDAR[\s\S]*END:VCALENDAR\r\n$/);
  });
});

describe("helpers", () => {
  it("adds a day across month ends and leap years", () => {
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
    expect(nextDay("2027-02-28")).toBe("2027-03-01");
    expect(nextDay("2026-01-31")).toBe("2026-02-01");
  });
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b;c\\\\d\\ne");
  });
  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const folded = fold(`SUMMARY:${"押金".repeat(30)}`);
    for (const line of folded.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replaceAll("\r\n ", "")).toBe(`SUMMARY:${"押金".repeat(30)}`);
  });
});
