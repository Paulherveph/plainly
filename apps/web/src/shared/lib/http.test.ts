import { describe, expect, it } from "vitest";
import { errorDetail, httpStatus, readJson } from "./http";

describe("http helpers", () => {
  it("I03: rejects oversized bodies before parsing", async () => {
    const big = new Request("http://x", { method: "POST", body: JSON.stringify({ a: "x".repeat(5000) }) });
    expect(await readJson(big, 1000)).toBeNull();
    const ok = new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(await readJson(ok, 1000)).toEqual({ a: 1 });
  });

  it("maps typed errors to statuses and keeps only numbers and kinds in details", () => {
    expect(httpStatus("insufficient_credits")).toBe(402);
    expect(httpStatus("capacity")).toBe(503);
    expect(errorDetail({ kind: "insufficient_credits", needed: 5, available: 2 })).toEqual({ needed: 5, available: 2 });
  });
});
