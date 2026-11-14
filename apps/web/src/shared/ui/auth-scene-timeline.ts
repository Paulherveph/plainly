/**
 * The auth scene story, as pure numbers (docs/DESIGN.md: clarity coming out of noise).
 * Threads and paper fragments drift, pull together into one frosted sheet (sign in) or a stack of three
 * cards (sign up), one line glows, then everything eases back to the start, so the loop has no seam.
 *
 * Scene space: y from -1 (bottom) to 1 (top), x scaled by the aspect ratio. The lower third stays empty.
 */
export type SceneVariant = "signin" | "signup";

export const LOOP_S = 9;
export const LOWER_THIRD_TOP = -1 / 3;
/** Index of the line that glows for a moment once the sheet is formed. */
export const GLOW_LINE = 2;

export type Phase = { gather: number; glow: number; noise: number };
export type Rect = { cx: number; cy: number; w: number; h: number };
export type Line = { x0: number; x1: number; y: number; weight: number };

type Timing = {
  /** Gather starts and ends (fractions of the loop). */
  g0: number;
  g1: number;
  /** Release starts; it always ends at the loop end. */
  r0: number;
  /** Glow window. */
  w0: number;
  w1: number;
  /** Turbulence before the sheet forms. */
  noise: number;
  ease: (t: number) => number;
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const progress = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

const TIMING: Record<SceneVariant, Timing> = {
  // Calm and slow: a long, soft gather.
  signin: { g0: 0.16, g1: 0.5, r0: 0.78, w0: 0.56, w1: 0.74, noise: 0.3, ease: easeInOutCubic },
  // A noisy storm that snaps into place.
  signup: { g0: 0.22, g1: 0.33, r0: 0.78, w0: 0.44, w1: 0.68, noise: 1, ease: easeOutQuint },
};

export function phase(seconds: number, variant: SceneVariant): Phase {
  const tm = TIMING[variant];
  const u = (((seconds % LOOP_S) + LOOP_S) % LOOP_S) / LOOP_S;
  const gather = u < tm.r0 ? tm.ease(progress(u, tm.g0, tm.g1)) : 1 - easeInOutSine(progress(u, tm.r0, 1));
  const w = progress(u, tm.w0, tm.w1);
  const glow = w > 0 && w < 1 ? Math.sin(Math.PI * w) ** 2 : 0;
  return { gather, glow, noise: tm.noise * (1 - gather) };
}

/** Back to front. Every sheet ends above the lower third. */
export function sheets(variant: SceneVariant): Rect[] {
  if (variant === "signin") return [{ cx: 0, cy: 0.3, w: 0.74, h: 0.98 }];
  return [
    { cx: 0, cy: 0.52, w: 0.56, h: 0.6 },
    { cx: 0, cy: 0.42, w: 0.65, h: 0.64 },
    { cx: 0, cy: 0.3, w: 0.74, h: 0.7 },
  ];
}

// A short heading line, then body lines of varied length, like a real page.
const LENGTHS = [0.48, 1, 0.9, 1, 0.66, 0.94, 0.42];

export function sheetLines(rect: Rect, count = LENGTHS.length): Line[] {
  const padX = rect.w * 0.13;
  const top = rect.cy + rect.h / 2 - rect.h * 0.17;
  const bottom = rect.cy - rect.h / 2 + rect.h * 0.15;
  const left = rect.cx - rect.w / 2 + padX;
  const full = rect.w - padX * 2;
  return Array.from({ length: count }, (_, i) => ({
    x0: left,
    x1: left + full * (LENGTHS[i % LENGTHS.length] ?? 1),
    y: count === 1 ? top : top - ((top - bottom) * i) / (count - 1),
    weight: i === 0 ? 1.6 : 1,
  }));
}
