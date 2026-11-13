import { describe, expect, it } from "vitest";
import { createFrameWatch, particleCount, pickOrbTier, stepDown } from "./orb-quality";

describe("pickOrbTier", () => {
  const base = { width: 1440, cores: 8, canRun: true };

  it("is static when the device cannot or should not run WebGL", () => {
    expect(pickOrbTier({ ...base, canRun: false })).toBe("static");
  });

  it("picks 17 000 particles on a desktop, 8 000 on fewer cores, 4 000 on a phone", () => {
    expect(particleCount(pickOrbTier(base))).toBe(17000);
    expect(particleCount(pickOrbTier({ ...base, cores: 4 }))).toBe(8000);
    expect(particleCount(pickOrbTier({ ...base, width: 390 }))).toBe(4000);
  });

  it("treats the 768 px breakpoint as desktop", () => {
    expect(pickOrbTier({ ...base, width: 767 })).toBe("low");
    expect(pickOrbTier({ ...base, width: 768 })).toBe("high");
  });
});

describe("stepDown", () => {
  it("goes high, mid, low, static and stays there", () => {
    expect(stepDown("high")).toBe("mid");
    expect(stepDown("mid")).toBe("low");
    expect(stepDown("low")).toBe("static");
    expect(stepDown("static")).toBe("static");
  });
});

describe("createFrameWatch", () => {
  function run(frameMs: number, frames: number, watch = createFrameWatch()) {
    let slow = false;
    for (let i = 0; i <= frames; i++) slow = watch.push(i * frameMs) || slow;
    return slow;
  }

  it("stays quiet at 60 fps", () => {
    expect(run(16.7, 300)).toBe(false);
  });

  it("reports slow when the median frame stays above 20 ms for 2 seconds", () => {
    expect(run(33, 100)).toBe(true);
  });

  it("does not report before 2 seconds have passed", () => {
    expect(run(33, 50)).toBe(false);
  });

  it("ignores a few long frames, such as a tab switch", () => {
    const watch = createFrameWatch();
    let now = 0;
    let slow = false;
    for (let i = 0; i < 150; i++) {
      now += i % 10 === 0 ? 120 : 14;
      slow = watch.push(now) || slow;
    }
    expect(slow).toBe(false);
  });
});
