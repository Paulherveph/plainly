import { describe, expect, it } from "vitest";
import { buildCalendar } from "./activity";

const TODAY = "2026-11-17"; // a Tuesday

describe("activity calendar", () => {
  it("has 53 Monday-first weeks that end on today's week", () => {
    const cal = buildCalendar([], TODAY);
    expect(cal.weeks).toHaveLength(53);
    expect(cal.weeks.every((w) => w.length === 7)).toBe(true);
    const last = cal.weeks.at(-1) ?? [];
    expect(last[0]?.day).toBe("2026-11-16"); // Monday
    expect(last[1]?.day).toBe(TODAY);
    expect(last[2]?.future).toBe(true);
    expect(cal.total).toBe(0);
    expect(cal.currentStreak).toBe(0);
  });

  it("adds documents and questions, and scales levels by the busiest day", () => {
    const cal = buildCalendar(
      [
        { day: "2026-11-10", analyses: 1, questions: 0 },
        { day: "2026-11-12", analyses: 2, questions: 6 },
      ],
      TODAY,
    );
    const cells = cal.weeks.flat();
    expect(cells.find((c) => c.day === "2026-11-12")).toMatchObject({ count: 8, level: 4 });
    expect(cells.find((c) => c.day === "2026-11-10")).toMatchObject({ count: 1, level: 1 });
    expect(cal).toMatchObject({ total: 9, analyses: 3, questions: 6, activeDays: 2 });
  });

  it("counts streaks, and today being empty does not break the current one", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-14", "2026-11-15", "2026-11-16"].map(
      (day) => ({ day, analyses: 1, questions: 0 }),
    );
    const cal = buildCalendar(days, TODAY);
    expect(cal.longestStreak).toBe(3);
    expect(cal.currentStreak).toBe(3);
    expect(buildCalendar(days.slice(0, 3), TODAY).currentStreak).toBe(0);
  });

  it("marks where each month starts for the labels", () => {
    const cal = buildCalendar([], TODAY);
    expect(cal.months.at(-1)).toMatchObject({ month: 10 }); // November
    expect(cal.months.length).toBeGreaterThanOrEqual(12);
  });
});
