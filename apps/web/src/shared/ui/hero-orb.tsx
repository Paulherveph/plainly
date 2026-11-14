"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { canRunWebGL, onBatterySaver, whenSettled } from "./motion-gate";
import { createFrameWatch, type OrbTier, particleCount, pickOrbTier, stepDown } from "./orb-quality";

const CrystalizedBall = dynamic(() => import("./crystalized-ball"), {
  ssr: false,
  loading: () => <StaticOrb />,
});

const MAX_TILT_DEG = 6;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * The one hero effect (docs/DESIGN.md): React Bits "Crystalized Ball", nebula preset.
 * Loaded lazily after idle, mounted only when in view. Scroll only changes parameters:
 * the orb goes from chaotic to calm as the page moves, and the section's `--calm` variable
 * (0 to 1) sharpens the product preview. The pointer tilts the orb by at most 6 degrees.
 */
export function HeroOrb() {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [tier, setTier] = useState<OrbTier>("static");
  // True once the idle check has run. Until then, and for visitors who get the live orb, no image is fetched.
  const [decided, setDecided] = useState(false);
  const [calm, setCalm] = useState(0);
  const { resolvedTheme } = useTheme();

  // Decide the tier after idle, then mount the canvas once the orb is in view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | undefined;
    let cancelled = false;
    const cancel = whenSettled(async () => {
      const canRun = canRunWebGL() && !(await onBatterySaver());
      if (cancelled) return;
      const next = pickOrbTier({
        width: window.innerWidth,
        cores: navigator.hardwareConcurrency ?? 8,
        canRun,
      });
      setDecided(true);
      if (next === "static") return;
      setTier(next);
      io = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
          setLive(true);
          io?.disconnect();
        }
      });
      io.observe(el);
    });
    return () => {
      cancelled = true;
      cancel();
      io?.disconnect();
    };
  }, []);

  // Watch frame times while the canvas runs and step down one tier when it stays slow.
  const running = live && tier !== "static";
  useEffect(() => {
    if (!running) return;
    const watch = createFrameWatch();
    let raf = 0;
    const tick = (now: number) => {
      if (!document.hidden && watch.push(now)) setTier(stepDown);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Scroll drives calm (0 chaotic, 1 calm). Pointer tilts the orb. Neither runs without motion.
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    if (!el || !section || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let tilt = { x: 0, y: 0 };

    const paint = () => {
      raf = 0;
      const progress = clamp01(window.scrollY / (window.innerHeight * 0.8));
      section.style.setProperty("--calm", progress.toFixed(2));
      setCalm(Math.round(progress * 20) / 20);
      el.style.transform = `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tilt = {
        x: (e.clientX / window.innerWidth - 0.5) * 2 * MAX_TILT_DEG,
        y: (0.5 - e.clientY / window.innerHeight) * 2 * MAX_TILT_DEG,
      };
      schedule();
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="hero-orb"
      data-tier={running ? tier : "static"}
      aria-hidden="true"
      className="relative size-full will-change-transform"
    >
      <div className="pointer-events-none absolute -inset-[18%] bg-[radial-gradient(closest-side,var(--brand-glow),transparent)] opacity-70" />
      <div className="absolute inset-0 [mask-image:radial-gradient(closest-side,#000_68%,transparent)]">
        {running ? (
          <CrystalizedBall
            preset="nebula"
            color="#9478FF"
            theme={resolvedTheme === "light" ? "light" : "dark"}
            particleCount={particleCount(tier)}
            size={0.9}
            interactive={tier === "high"}
            crackle={lerp(0.85, 0.15, calm)}
            sway={lerp(0.5, 0.12, calm)}
            twinkle={lerp(0.6, 0.15, calm)}
          />
        ) : (
          <StaticOrb image={decided && tier === "static"} />
        )}
      </div>
    </div>
  );
}

/**
 * The server renders a CSS gradient: it is not an LCP candidate, so the headline stays the LCP element
 * (docs/HERO.md). When the client has decided a fallback is needed (reduced motion, no GPU, save-data,
 * slow frames), a render of the real orb (assets/media/hero-orb.ts) fades in over it. It is a CSS
 * background so only the rule that matches the theme is fetched.
 */
function StaticOrb({ image = false }: { image?: boolean }) {
  return (
    <div data-testid="hero-static" className="absolute inset-0 grid place-items-center">
      <div className="aspect-square w-[80%] rounded-full bg-[radial-gradient(circle_at_50%_38%,rgb(201_189_255/0.5),rgb(148_120_255/0.25)_42%,rgb(148_120_255/0.05)_66%,transparent_72%)]" />
      {image ? (
        <div
          data-testid="hero-static-image"
          className="absolute inset-0 bg-[url(/images/hero-orb-light.webp)] bg-contain bg-center bg-no-repeat dark:bg-[url(/images/hero-orb-dark.webp)]"
        />
      ) : null}
    </div>
  );
}
