import { describe, expect, it } from "vitest";
import { dateAsWritten, quoteSupportsDate } from "./due-date";

describe("quoteSupportsDate", () => {
  it.each([
    ["2026-11-20", "no later than 20 November 2026"],
    ["2027-01-20", "Pay Spring 2027 tuition instalment (or confirm scholarship offset) 20 January 2027"],
    ["2026-12-24", "pay a Christmas bonus by 24 December"],
    ["2027-01-13", "soit jusqu'au 13 janvier 2027"],
    ["2027-02-28", "avant le 28 févr. 2027"],
    ["2027-01-20", "请于2027年1月20日前缴费"],
    ["2026-11-25", "Pay by: 25/11/2026"],
  ])("accepts %s from %j", (iso, quote) => {
    expect(quoteSupportsDate(iso, quote)).toBe(true);
  });

  it.each([
    ["2026-11-30", "within 30 days of your arrival in the People's Republic of China"],
    ["2026-01-20", "20 January 2027"],
    ["2027-03-15", "Pay the remaining balance"],
    ["2027-05-10", "10 days after the notice"],
    ["not-a-date", "1 January 2027"],
  ])("rejects %s from %j", (iso, quote) => {
    expect(quoteSupportsDate(iso, quote)).toBe(false);
  });
});

describe("dateAsWritten", () => {
  it("returns the date token as the document writes it", () => {
    expect(dateAsWritten("Submit residence permit materials 03/04/2027")).toBe("03/04/2027");
    expect(dateAsWritten("due 4.3.27")).toBe("4.3.27");
    expect(dateAsWritten("within 30 days")).toBeNull();
  });
});
