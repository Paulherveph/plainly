"use client";

import { MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type CodeMode, continueWithGoogle, sendCodeAction, verifyCodeAction } from "@/server/actions/auth";
import { safeNext } from "@/shared/lib/safe-next";
import { Button } from "./button";
import { Input } from "./input";
import { Turnstile, turnstileSiteKey } from "./turnstile";

type Step = { kind: "email" } | { kind: "code"; email: string; mode: CodeMode };

const ERRORS: Record<string, string> = {
  invalid_email: "invalidEmail",
  invalid_code: "invalidCode",
  expired_code: "expiredCode",
  rate_limited: "rateLimited",
  captcha_failed: "captchaFailed",
  needs_captcha: "captchaFailed",
  failed: "failed",
};

/**
 * One form for sign in and sign up (docs/AUTH.md): Google, or a 6-digit email code.
 * States: idle, sending, code entry, success, error, rate limited.
 */
export function SignInForm({ next, onDone }: { next?: string | "from-url"; onDone?: () => void }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const siteKey = turnstileSiteKey();

  const fail = (kind: string) => setError(t(ERRORS[kind] ?? "failed"));
  // The sign-in page returns to where the user came from (validated); the modal stays on the page.
  const target = () =>
    next === "from-url"
      ? safeNext(new URLSearchParams(window.location.search).get("next"), `/${locale}/documents`)
      : next;

  function google() {
    start(async () => {
      const res = await continueWithGoogle(locale, target() ?? window.location.pathname);
      if (!res.ok) fail(res.error.kind);
    });
  }

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await sendCodeAction({ email, locale, captchaToken: captcha });
      if (res.ok) {
        setStep({ kind: "code", email: email.trim(), mode: res.value.mode });
        setCode("");
      } else fail(res.error.kind);
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    setError(null);
    start(async () => {
      const res = await verifyCodeAction({ email: step.email, code, mode: step.mode });
      if (!res.ok) return fail(res.error.kind);
      toast.success(res.value.merged > 0 ? t("merged", { count: res.value.merged }) : t("signedIn"));
      onDone?.();
      const to = target();
      if (to) router.push(to);
      router.refresh();
    });
  }

  if (step.kind === "code") {
    return (
      <form onSubmit={verify} className="grid gap-3" noValidate>
        <p className="text-muted-foreground text-sm">{t("codeSent", { email: step.email })}</p>
        <label htmlFor="signin-code" className="font-medium text-sm">
          {t("codeLabel")}
        </label>
        <Input
          id="signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signin-error" : undefined}
          className="h-11 text-center font-mono text-lg tracking-[0.4em]"
        />
        {error ? (
          <p id="signin-error" role="alert" className="text-critical text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
          {pending ? t("verifying") : t("verify")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep({ kind: "email" })}>
          {t("useOtherEmail")}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      <Button variant="outline" size="lg" className="w-full" onClick={google} disabled={pending}>
        <GoogleMark />
        {t("google")}
      </Button>
      <div className="flex items-center gap-3 text-faint text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {t("or")}
      </div>
      <form onSubmit={sendCode} className="grid gap-2.5" noValidate>
        <label htmlFor="signin-email" className="sr-only">
          {t("email")}
        </label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signin-error" : undefined}
          className="h-11"
        />
        <Turnstile siteKey={siteKey} action="email_code" onToken={setCaptcha} onError={() => setCaptcha(null)} />
        {error ? (
          <p id="signin-error" role="alert" className="text-critical text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || (Boolean(siteKey) && !captcha)}>
          <MailIcon />
          {pending ? t("sending") : t("sendCode")}
        </Button>
      </form>
      <p className="text-faint text-xs">{t("terms")}</p>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-4.5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
