/** How the hero orb scales down on weak devices (docs/HERO.md, "Performance and fallbacks"). */
export type OrbTier = "high" | "mid" | "low" | "static";

const TIER_PARTICLES = { high: 17000, mid: 8000, low: 4000 } as const;

/** 0 for the static tier: no particles are drawn. */
export function particleCount(tier: OrbTier): number {
  return tier === "static" ? 0 : TIER_PARTICLES[tier];
}

const TIER_ORDER: readonly OrbTier[] = ["high", "mid", "low", "static"];

/** Desktop 17 000, laptop with an integrated GPU 8 000, mobile 4 000. `canRun` is false for reduced motion, no WebGL, save-data and software renderers. */
export function pickOrbTier(input: { width: number; cores: number; canRun: boolean }): OrbTier {
  if (!input.canRun) return "static";
  if (input.width < 768) return "low";
  return input.cores < 8 ? "mid" : "high";
}

/** One way only: a step back up would rebuild the particles and hitch again. */
export function stepDown(tier: OrbTier): OrbTier {
  const next = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
  return next ?? "static";
}

const WINDOW_MS = 2000;
const SLOW_FRAME_MS = 20;

/**
 * Feed it one timestamp per frame. It returns true once, at the end of a 2 second window
 * whose median frame time is above 20 ms. The median ignores a few long frames (tab switch, GC).
 */
export function createFrameWatch() {
  let windowStart: number | null = null;
  let last = 0;
  let deltas: number[] = [];

  return {
    push(now: number): boolean {
      if (windowStart === null) {
        windowStart = now;
        last = now;
        return false;
      }
      deltas.push(now - last);
      last = now;
      if (now - windowStart < WINDOW_MS) return false;
      const sorted = [...deltas].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      windowStart = now;
      deltas = [];
      return median > SLOW_FRAME_MS;
    },
  };
}
