import { describe, expect, it } from "vitest";
import { alertLevel, budgetState } from "./budget";

const usd = (n: number) => n * 1_000_000;

describe("budget guard (F16)", () => {
  it("degrades Guest and Free at 80% and stops them at 100%", () => {
    expect(budgetState(usd(3.9), 5, "free")).toBe("ok");
    expect(budgetState(usd(4), 5, "guest")).toBe("degrade");
    expect(budgetState(usd(5), 5, "free")).toBe("capacity");
  });

  it("lets paid users continue until 150%", () => {
    expect(budgetState(usd(5), 5, "paid")).toBe("ok");
    expect(budgetState(usd(7.5), 5, "paid")).toBe("capacity");
  });

  it("alerts at 80% and 100%", () => {
    expect(alertLevel(usd(3), 5)).toBeNull();
    expect(alertLevel(usd(4.2), 5)).toBe(80);
    expect(alertLevel(usd(6), 5)).toBe(100);
  });
});
