"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

const CrystalizedBall = dynamic(() => import("./crystalized-ball"), {
  ssr: false,
  loading: () => <StaticOrb />,
});

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Static fallback for reduced motion, data saver, low-power devices and software-only WebGL. */
function canRunWebGL(): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
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

/** Starts after the page is idle so the effect never competes with first paint or input. */
function whenIdle(run: () => void): () => void {
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 1200);
  return () => window.clearTimeout(id);
}

/**
 * The one hero effect (docs/DESIGN.md): React Bits "Crystalized Ball", nebula preset.
 * Loaded lazily after idle, mounted only when in view, 17k particles on desktop and 4k on mobile.
 */
export function HeroOrb() {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [mobile, setMobile] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    const cancel = whenIdle(() => {
      if (!canRunWebGL()) return;
      setMobile(matchMedia("(max-width: 767px)").matches);
      io = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
          setLive(true);
          io?.disconnect();
        }
      });
      io.observe(el);
    });
    return () => {
      cancel();
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="relative size-full">
      {live ? (
        <CrystalizedBall
          preset="nebula"
          color="#9478FF"
          theme={resolvedTheme === "light" ? "light" : "dark"}
          particleCount={mobile ? 4000 : 17000}
          size={0.78}
          interactive={!mobile}
        />
      ) : (
        <StaticOrb />
      )}
    </div>
  );
}

function StaticOrb() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="aspect-square w-[62%] rounded-full bg-[radial-gradient(circle_at_50%_38%,rgb(201_189_255/0.55),rgb(148_120_255/0.28)_42%,rgb(148_120_255/0.06)_66%,transparent_72%)] shadow-[0_0_120px_20px_rgb(148_120_255/0.18)]" />
    </div>
  );
}
