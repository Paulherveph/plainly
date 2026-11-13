"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Button } from "./button";

/**
 * Bordered so it reads as a button. The new theme grows as a circle from the toggle
 * (View Transitions API); without support or with reduced motion it switches instantly.
 * Both icons render and CSS picks one, so there is no hydration flash. The label depends on the
 * stored theme, which the server can't know: it uses the server's (dark) label until hydrated.
 */
const noop = () => () => {};
export function ThemeToggle() {
  const t = useTranslations("Nav");
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const isDark = !hydrated || resolvedTheme !== "light";

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = isDark ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) return apply();

    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("theme-vt");
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
    vt.finished.finally(() => root.classList.remove("theme-vt"));
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t("themeLight") : t("themeDark")}
      data-testid="theme-toggle"
      className="text-foreground hover:border-brand/50"
    >
      <SunIcon className="hidden animate-icon-in dark:block" />
      <MoonIcon className="animate-icon-in dark:hidden" />
    </Button>
  );
}
