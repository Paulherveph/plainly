"use client";

import { cn } from "cn";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Muted, inline motion video rendered from media/videos/ (public/videos/<name>.{webm,mp4,webp}).
 * Loads nothing until it is near the viewport, plays only while visible, and never autoplays
 * with reduced motion (the poster stays). Longer clips get a pause button (WCAG 2.2.2).
 * `themed` swaps between the dark and -light renders with the site theme.
 * `cycles` stops after N plays and rests on the last frame (for small decorative loops).
 */
export type LoopVideoHandle = { seek: (t: number) => void };

type Props = {
  name: string;
  /** Accessible description. Without one the video is decorative and hidden from assistive tech. */
  label?: string;
  themed?: boolean;
  cycles?: number;
  controls?: boolean;
  className?: string;
  onTime?: (t: number) => void;
  ref?: React.Ref<LoopVideoHandle>;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** With `themed`, two videos exist and CSS hides one: act on the one that is displayed. */
const shown = (root: HTMLElement | null) =>
  [...(root?.querySelectorAll("video") ?? [])].find((v) => v.offsetParent !== null) ?? null;

export function LoopVideo({
  name,
  label,
  themed = false,
  cycles,
  controls = false,
  className,
  onTime,
  ref,
}: Props) {
  const t = useTranslations("Video");
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false); // the viewer pressed pause
  const plays = useRef(0);

  useImperativeHandle(ref, () => ({
    seek(time) {
      const v = shown(root.current);
      if (!v) return;
      v.currentTime = time;
      if (!paused && !reducedMotion()) v.play().catch(() => {});
    },
  }));

  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        const v = shown(el);
        if (!v) return;
        if (visible && !paused && (cycles == null || plays.current < cycles)) {
          v.preload = "auto";
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [paused, cycles]);

  function toggle() {
    const v = shown(root.current);
    if (!v) return;
    setPaused(!v.paused);
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  const video = (suffix: string, extra?: string) => (
    <video
      key={suffix}
      muted
      playsInline
      loop={cycles == null}
      preload="none"
      disablePictureInPicture
      tabIndex={-1}
      poster={`/videos/${name}${suffix}.webp`}
      aria-label={label}
      className={cn("block h-auto w-full", extra)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
      onEnded={(e) => {
        plays.current += 1;
        if (cycles != null && plays.current < cycles) e.currentTarget.play().catch(() => {});
      }}
    >
      <source src={`/videos/${name}${suffix}.webm`} type="video/webm" />
      <source src={`/videos/${name}${suffix}.mp4`} type="video/mp4" />
    </video>
  );

  return (
    <div ref={root} className={cn("relative", className)}>
      <div aria-hidden={label ? undefined : true}>
        {themed ? [video("", "hidden dark:block"), video("-light", "dark:hidden")] : video("")}
      </div>
      {controls ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("pause") : t("play")}
          className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full border border-line-strong bg-background/80 text-foreground backdrop-blur-md transition-transform duration-150 hover:scale-105 active:scale-95 [&_svg]:size-4"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      ) : null}
    </div>
  );
}
