"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthScene } from "./auth-scene";
import type { SceneVariant } from "./auth-scene-timeline";
import { SignInForm } from "./sign-in-form";

/**
 * The parts of the auth page that follow `?mode=signup`. The toggle rewrites the URL with
 * `history.replaceState` (Next.js keeps `useSearchParams` in sync), so there is no navigation: the page
 * template does not remount and the form keeps what the user typed.
 */
function useMode(): SceneVariant {
  return useSearchParams().get("mode") === "signup" ? "signup" : "signin";
}

export function AuthTitle() {
  const t = useTranslations("Auth");
  const mode = useMode();
  return (
    <AuthHeading
      title={t(mode === "signup" ? "createAccount" : "welcomeBack")}
      sub={t(mode === "signup" ? "signupSub" : "signinSub")}
    />
  );
}

export function AuthHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center lg:text-left">
      <h1 className="text-balance font-semibold text-[2rem] leading-tight tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
    </div>
  );
}

/** The page form follows `?mode`. Its Suspense fallback is the same form in sign-in mode (static HTML, LCP). */
export function AuthModeForm() {
  return <SignInForm mode={useMode()} next="from-url" />;
}

export function AuthModeScene({ className }: { className?: string }) {
  return <AuthScene variant={useMode()} className={className} />;
}

export function AuthModeSwitch() {
  const t = useTranslations("Auth");
  const params = useSearchParams();
  const pathname = usePathname();
  const mode = useMode();
  const next = new URLSearchParams(params.toString());
  if (mode === "signup") next.delete("mode");
  else next.set("mode", "signup");
  const query = next.toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <p className="mt-8 text-center text-muted-foreground text-sm">
      {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
      <a
        href={href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          window.history.replaceState(null, "", href);
        }}
        className="rounded-sm font-medium text-brand-text hover:underline"
      >
        {mode === "signup" ? t("signInLink") : t("createOne")}
      </a>
    </p>
  );
}
