import { describe, expect, it } from "vitest";
import { LOOP_S, LOWER_THIRD_TOP, phase, sheetLines, sheets } from "./auth-scene-timeline";

describe("auth scene timeline", () => {
  for (const variant of ["signin", "signup"] as const) {
    it(`${variant}: loops with no seam`, () => {
      const a = phase(0, variant);
      const b = phase(LOOP_S, variant);
      const c = phase(LOOP_S - 0.001, variant);
      expect(b).toEqual(a);
      expect(Math.abs(c.gather - a.gather)).toBeLessThan(0.01);
      expect(Math.abs(c.noise - a.noise)).toBeLessThan(0.01);
      expect(Math.abs(c.glow - a.glow)).toBeLessThan(0.01);
    });

    it(`${variant}: drifts, gathers into a clean sheet, then lets go`, () => {
      const samples = Array.from({ length: 900 }, (_, i) => phase((i / 900) * LOOP_S, variant));
      expect(Math.min(...samples.map((s) => s.gather))).toBe(0);
      expect(Math.max(...samples.map((s) => s.gather))).toBeCloseTo(1, 5);
      // One line glows only while the sheet is fully formed.
      for (const s of samples) if (s.glow > 0.01) expect(s.gather).toBeGreaterThan(0.99);
      for (const s of samples) {
        expect(s.gather).toBeGreaterThanOrEqual(0);
        expect(s.gather).toBeLessThanOrEqual(1);
      }
    });

    it(`${variant}: keeps the lower third empty for the title`, () => {
      for (const rect of sheets(variant)) expect(rect.cy - rect.h / 2).toBeGreaterThan(LOWER_THIRD_TOP);
    });

    it(`${variant}: lines sit inside their sheet`, () => {
      for (const rect of sheets(variant)) {
        for (const line of sheetLines(rect)) {
          expect(line.y).toBeLessThan(rect.cy + rect.h / 2);
          expect(line.y).toBeGreaterThan(rect.cy - rect.h / 2);
          expect(line.x0).toBeGreaterThan(rect.cx - rect.w / 2);
          expect(line.x1).toBeLessThan(rect.cx + rect.w / 2);
        }
      }
    });
  }

  it("signup starts as a noisier storm than signin", () => {
    expect(phase(0, "signup").noise).toBeGreaterThan(phase(0, "signin").noise);
  });

  it("signin forms one sheet, signup a stack of three cards", () => {
    expect(sheets("signin")).toHaveLength(1);
    expect(sheets("signup")).toHaveLength(3);
  });

  it("signup snaps: it gathers in less time than signin", () => {
    const window = (v: "signin" | "signup") => {
      const ts = Array.from({ length: 900 }, (_, i) => (i / 900) * LOOP_S);
      const start = ts.find((t) => phase(t, v).gather > 0.02) ?? 0;
      const end = ts.find((t) => phase(t, v).gather > 0.98) ?? 0;
      return end - start;
    };
    expect(window("signup")).toBeLessThan(window("signin"));
  });
});
