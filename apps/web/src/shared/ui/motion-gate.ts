/**
 * Shared checks for the WebGL effects (hero orb, auth scene). See docs/HERO.md, "Performance and fallbacks".
 * Client only: every function touches `window` or `navigator`.
 */

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
  getBattery?: () => Promise<{ charging: boolean; level: number }>;
};

/** False for reduced motion, data saver, low-power devices and software-only WebGL: those get a static image. */
export function canRunWebGL(): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|software/i.test(renderer);
  } catch {
    return false;
  }
}

/** Battery saver is not exposed everywhere; a discharging battery under 20% is the closest signal. */
export async function onBatterySaver(): Promise<boolean> {
  try {
    const battery = await (navigator as NavigatorHints).getBattery?.();
    return battery ? !battery.charging && battery.level < 0.2 : false;
  } catch {
    return false;
  }
}

/** Starts after the page is idle so the effect never competes with first paint or input. */
export function whenIdle(run: () => void): () => void {
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 1200);
  return () => window.clearTimeout(id);
}

/**
 * Setting up a canvas (GL context, shaders, particle buffers) is one long main-thread task. It waits for the
 * `load` event plus `settleMs`, so it never lands in the window where the page is still becoming interactive.
 */
export function whenSettled(run: () => void, settleMs = 3000): () => void {
  let cancelIdle = () => {};
  let timer = 0;
  const start = () => {
    timer = window.setTimeout(() => {
      cancelIdle = whenIdle(run);
    }, settleMs);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    window.removeEventListener("load", start);
    window.clearTimeout(timer);
    cancelIdle();
  };
}
