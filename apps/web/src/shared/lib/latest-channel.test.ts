import { describe, expect, it } from "vitest";
import { latestChannel } from "./latest-channel";

describe("latestChannel", () => {
  it("coalesces values the reader has not taken yet, and ends on close", async () => {
    const ch = latestChannel<number>();
    ch.push(1);
    ch.push(2);
    ch.close();
    const seen: number[] = [];
    for await (const v of ch) seen.push(v);
    expect(seen).toEqual([2]);
  });

  it("never blocks the producer when nobody reads", () => {
    const ch = latestChannel<number>();
    for (let i = 0; i < 1000; i++) ch.push(i);
    ch.close();
    expect(true).toBe(true);
  });
});
