"use client";

import { cn } from "cn";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { SceneVariant } from "./auth-scene-timeline";
import { canRunWebGL, onBatterySaver, whenSettled } from "./motion-gate";
import { createFrameWatch, type OrbTier, pickOrbTier, stepDown } from "./orb-quality";

const AuthSceneGL = dynamic(() => import("./auth-scene-gl"), { ssr: false });

/** Thread points per tier. Thin threads cost less than the hero orb, so the counts are lower. */
const SCENE_POINTS = { high: 9000, mid: 5000, low: 2500 } as const;

/** Dev and capture only: `?scene=4.2` draws one still frame at 4.2 s with no idle wait. */
function freezeFromUrl(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get("scene");
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The auth page media card: violet threads and paper fragments that pull together into a clean sheet
 * (docs/DESIGN.md, clarity out of noise). Same rules as the hero (docs/HERO.md): loads after the page settles,
 * mounts in view, steps down on slow frames, static poster for reduced motion, save-data and weak devices.
 * Decorative only (aria-hidden). The form next to it stays the LCP element.
 */
export function AuthScene({ variant, className }: { variant: SceneVariant; className?: string }) {
  const [tier, setTier] = useState<OrbTier | null>(null);
  const [freezeAt, setFreezeAt] = useState<number | undefined>(undefined);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const freeze = freezeFromUrl();
    if (freeze !== undefined) {
      setFreezeAt(freeze);
      setTier("high");
      return;
    }
    let cancelled = false;
    const cancel = whenSettled(async () => {
      const canRun = canRunWebGL() && !(await onBatterySaver());
      if (cancelled) return;
      setTier(pickOrbTier({ width: window.innerWidth, cores: navigator.hardwareConcurrency ?? 8, canRun }));
    }, 600);
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  const running = tier !== null && tier !== "static";
  useEffect(() => {
    if (!running || freezeAt !== undefined) return;
    const watch = createFrameWatch();
    let raf = 0;
    const tick = (now: number) => {
      if (!document.hidden && watch.push(now)) setTier((t) => (t ? stepDown(t) : t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, freezeAt]);

  return (
    <div
      aria-hidden="true"
      data-testid="auth-scene"
      data-tier={tier ?? "pending"}
      data-variant={variant}
      className={cn("relative isolate overflow-hidden bg-[#07070a]", className)}
    >
      {/* Server placeholder: a CSS glow, never an LCP candidate. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_30%,rgb(148_120_255/0.16),transparent_70%)]" />
      {tier === "static" ? (
        <div
          data-testid="auth-scene-poster"
          className={cn(
            "absolute inset-0 bg-cover bg-top",
            variant === "signin"
              ? "bg-[url(/images/auth-scene-signin.webp)]"
              : "bg-[url(/images/auth-scene-signup.webp)]",
          )}
        />
      ) : null}
      {running ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            shown ? "opacity-100" : "opacity-0",
          )}
        >
          <AuthSceneGL
            key={variant}
            variant={variant}
            count={SCENE_POINTS[tier]}
            freezeAt={freezeAt}
            onReady={() => setShown(true)}
          />
        </div>
      ) : null}
      {/* Keeps the lower part dark so the title holds 4.5:1 on every frame. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#07070a] via-[#07070a]/85 to-transparent" />
      <div className="pointer-events-none absolute inset-0 hidden rounded-[inherit] ring-1 ring-white/[0.07] ring-inset lg:block" />
    </div>
  );
}
