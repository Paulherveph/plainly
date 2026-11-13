import { describe, expect, it } from "vitest";
import type { ChatTurn } from "../application/ports";
import { formatSummary, normalizeQuestion, parseSummary, planHistory } from "./history";

const turns = (n: number): ChatTurn[] =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }));

describe("history trimming (C08)", () => {
  it("sends short conversations whole", () => {
    expect(planHistory(turns(10), null)).toEqual({ recent: turns(10), older: [], needsRefresh: false });
  });

  it("keeps the last 6 turns and asks for a summary of the rest above 10", () => {
    const plan = planHistory(turns(14), null);
    expect(plan.recent).toHaveLength(6);
    expect(plan.older).toHaveLength(8);
    expect(plan.needsRefresh).toBe(true);
  });

  it("refreshes the summary only every few turns, so cost stays flat", () => {
    expect(planHistory(turns(14), { covered: 6, text: "s" }).needsRefresh).toBe(false);
    expect(planHistory(turns(16), { covered: 6, text: "s" }).needsRefresh).toBe(true);
  });

  it("round-trips the stored summary", () => {
    expect(parseSummary(formatSummary({ covered: 8, text: "a|b" }))).toEqual({ covered: 8, text: "a|b" });
    expect(parseSummary("nonsense")).toBeNull();
  });
});

describe("question dedup (C09)", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(normalizeQuestion("When is rent due?")).toBe(normalizeQuestion("  when is RENT due  "));
  });
});
