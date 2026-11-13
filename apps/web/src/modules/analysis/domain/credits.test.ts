import { describe, expect, it } from "vitest";
import { analysisCredits } from "./credits";

describe("analysisCredits", () => {
  it("follows 1 + 2 x ceil(pages / 5) plus 2 x ceil(scanned / 5)", () => {
    expect(analysisCredits(3, 0)).toBe(3);
    expect(analysisCredits(5, 0)).toBe(3);
    expect(analysisCredits(6, 0)).toBe(5);
    expect(analysisCredits(5, 5)).toBe(5);
    expect(analysisCredits(10, 1)).toBe(7);
  });
});
