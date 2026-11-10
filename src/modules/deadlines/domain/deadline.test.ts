import { describe, expect, it } from "vitest";
import type { Analysis } from "@/modules/analysis/domain/analysis";
import { type Deadline, daysFrom, deriveDeadlines, groupDeadlines, isOverdue } from "./deadline";

const analysis = {
  actions: [
    {
      title: "Pay deposit",
      detail: "€1,700",
      dueOn: "2026-11-20",
      cite: { page: 1, quote: "deposit by 20 November" },
    },
    { title: "Pay rent monthly", detail: "", dueOn: null, cite: { page: 1, quote: "each month" } },
  ],
} as unknown as Analysis;

const d = (id: string, dueOn: string, done = false): Deadline => ({
  id,
  documentId: "doc",
  documentTitle: "Lease",
  label: id,
  detail: null,
  dueOn,
  quote: "q",
  page: 1,
  done,
});

describe("deadlines", () => {
  it("derives rows only from actions with a stated date", () => {
    expect(deriveDeadlines(analysis)).toEqual([
      {
        label: "Pay deposit",
        detail: "€1,700",
        dueOn: "2026-11-20",
        quote: "deposit by 20 November",
        page: 1,
      },
    ]);
  });

  it("marks past, unfinished deadlines as overdue (today is not overdue)", () => {
    expect(isOverdue(d("a", "2026-11-10"), "2026-11-11")).toBe(true);
    expect(isOverdue(d("a", "2026-11-11"), "2026-11-11")).toBe(false);
    expect(isOverdue(d("a", "2026-11-10", true), "2026-11-11")).toBe(false);
  });

  it("groups and sorts soonest first", () => {
    const g = groupDeadlines(
      [
        d("late", "2026-12-01"),
        d("past", "2026-11-05"),
        d("soon", "2026-11-20"),
        d("ok", "2026-11-01", true),
      ],
      "2026-11-11",
    );
    expect(g.overdue.map((x) => x.id)).toEqual(["past"]);
    expect(g.upcoming.map((x) => x.id)).toEqual(["soon", "late"]);
    expect(g.done.map((x) => x.id)).toEqual(["ok"]);
  });

  it("counts whole days", () => {
    expect(daysFrom("2026-11-11", "2026-11-20")).toBe(9);
    expect(daysFrom("2026-11-11", "2026-11-05")).toBe(-6);
    expect(daysFrom("2026-03-28", "2026-03-30")).toBe(2);
  });
});
