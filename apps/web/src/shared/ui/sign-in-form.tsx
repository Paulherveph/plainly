"use client";

import { ArrowLeftIcon, CheckIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type AuthStep,
  type CodePurpose,
  continueWithGoogle,
  resendCodeAction,
  sendResetAction,
  signInAction,
  signUpAction,
  verifyCodeAction,
} from "@/server/actions/auth";
import { safeNext } from "@/shared/lib/safe-next";
import { Button } from "./button";
import { CodeInput } from "./code-input";
import { Input } from "./input";
import { Turnstile, turnstileSiteKey } from "./turnstile";

export type AuthMode = "signin" | "signup";

type Step =
  | { kind: "credentials" }
  | { kind: "forgot" }
  | { kind: "code"; email: string; purpose: CodePurpose }
  | { kind: "done" };

const ERRORS: Record<string, string> = {
  invalid_email: "invalidEmail",
  invalid_password: "invalidPassword",
  invalid_credentials: "invalidCredentials",
  email_exists: "emailExists",
  invalid_code: "invalidCode",
  expired_code: "expiredCode",
  rate_limited: "rateLimited",
  captcha_failed: "captchaFailed",
  needs_captcha: "captchaFailed",
  failed: "failed",
};

const RESEND_S = 60;
const COOLDOWN_S = 60;
const MIN_PASSWORD = 8;

/** Seconds left until `until` (ms timestamp), ticking once per second. */
function useCountdown(until: number): number {
  // 0 until the effect runs: the clock is never read during prerender.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return now ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

const fieldClass =
  "h-12 rounded-xl border-line-strong bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] pl-11 text-[15px] md:text-[15px]";

type FieldProps = { id: string; className: string; "aria-invalid"?: true; "aria-describedby"?: string };

/** A labelled input with a leading icon. The label is visually hidden; the placeholder repeats it. */
function Field({
  id,
  icon,
  label,
  invalid,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  invalid?: boolean;
  children: (props: FieldProps) => React.ReactNode;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 text-faint [&_svg]:size-4">
        {icon}
      </span>
      {children({
        id,
        className: fieldClass,
        ...(invalid ? { "aria-invalid": true as const, "aria-describedby": "signin-error" } : {}),
      })}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  label,
  autoComplete,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
}) {
  const t = useTranslations("Auth");
  const [shown, setShown] = useState(false);
  return (
    <Field id={id} icon={<LockIcon />} label={label} invalid={invalid}>
      {(props) => (
        <>
          <Input
            {...props}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            placeholder={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${props.className} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? t("hidePassword") : t("showPassword")}
            aria-pressed={shown}
            className="-translate-y-1/2 absolute top-1/2 right-2 grid size-8 place-items-center rounded-lg text-faint transition-colors hover:text-foreground"
          >
            {shown ? (
              <EyeOffIcon className="size-4" aria-hidden="true" />
            ) : (
              <EyeIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </>
      )}
    </Field>
  );
}

/**
 * Sign in and sign up (docs/AUTH.md): email + password, or Google. A new account gets a 6-digit code by email;
 * entering it approves the account. Forgot password works the same way: code, then a new password.
 * States: idle, sending, code entry, verifying, success, error, rate limited.
 * `onModeChange` renders the sign-in / sign-up switch inside the form (the dialog); the page has its own.
 */
export function SignInForm({
  mode,
  onModeChange,
  next,
  onDone,
}: {
  mode: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  next?: string | "from-url";
  onDone?: () => void;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  // Turnstile tokens are single use: bumping this renders a fresh widget.
  const [captchaRound, setCaptchaRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [pending, start] = useTransition();
  const siteKey = turnstileSiteKey();
  const resendIn = useCountdown(resendAt);
  const blockedFor = useCountdown(blockedUntil);

  // Switching between sign in and sign up keeps what was typed, but not a stale error.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on purpose when the mode changes.
  useEffect(() => {
    setError(null);
  }, [mode]);

  const fail = (kind: string) => {
    if (kind === "rate_limited") setBlockedUntil(Date.now() + COOLDOWN_S * 1000);
    setError(t(ERRORS[kind] ?? "failed"));
  };
  const takeCaptcha = () => {
    const token = captcha;
    setCaptcha(null);
    setCaptchaRound((n) => n + 1);
    return token;
  };
  const goTo = (to: Step) => {
    setStep(to);
    setError(null);
  };
  // The sign-in page returns to where the user came from (validated); the modal stays on the page.
  const target = () =>
    next === "from-url"
      ? safeNext(new URLSearchParams(window.location.search).get("next"), `/${locale}/documents`)
      : next;

  function finish(merged: number) {
    setStep({ kind: "done" });
    toast.success(merged > 0 ? t("merged", { count: merged }) : t("signedIn"));
    onDone?.();
    const to = target();
    if (to) router.push(to);
    router.refresh();
  }

  function after(res: { ok: true; value: AuthStep } | { ok: false; error: { kind: string } }) {
    if (!res.ok) return fail(res.error.kind);
    if (res.value.next === "done") return finish(res.value.merged);
    setStep({ kind: "code", email: email.trim().toLowerCase(), purpose: res.value.purpose });
    setCode("");
    setResendAt(Date.now() + RESEND_S * 1000);
  }

  function submitCredentials() {
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD) return fail("invalid_password");
    start(async () => {
      const captchaToken = takeCaptcha();
      after(
        mode === "signup"
          ? await signUpAction({ email, password, locale, captchaToken })
          : await signInAction({ email, password, captchaToken }),
      );
    });
  }

  function submitForgot() {
    setError(null);
    start(async () => after(await sendResetAction({ email, captchaToken: takeCaptcha() })));
  }

  function verify(value: string) {
    if (step.kind !== "code" || value.length !== 6) return;
    const recovery = step.purpose === "recovery";
    if (recovery && newPassword.length < MIN_PASSWORD) return fail("invalid_password");
    const pw = recovery ? newPassword : step.purpose === "upgrade" ? password : undefined;
    setError(null);
    start(async () => {
      const res = await verifyCodeAction({
        email: step.email,
        code: value,
        purpose: step.purpose,
        password: pw,
      });
      if (!res.ok) {
        setCode("");
        return fail(res.error.kind);
      }
      finish(res.value.merged);
    });
  }

  function resend() {
    if (step.kind !== "code") return;
    setError(null);
    start(async () => {
      const res = await resendCodeAction({
        email: step.email,
        purpose: step.purpose,
        captchaToken: takeCaptcha(),
      });
      if (!res.ok) return fail(res.error.kind);
      setResendAt(Date.now() + RESEND_S * 1000);
    });
  }

  function google() {
    start(async () => {
      const res = await continueWithGoogle(locale, target() ?? window.location.pathname);
      if (!res.ok) fail(res.error.kind);
    });
  }

  const blocked = blockedFor > 0;
  const errorBox = error ? (
    <p id="signin-error" role="alert" className="text-critical text-sm">
      {blocked ? t("rateLimitedFor", { seconds: blockedFor }) : error}
    </p>
  ) : null;
  const captchaWidget = (
    <Turnstile
      key={captchaRound}
      siteKey={siteKey}
      action="email_auth"
      onToken={setCaptcha}
      onError={() => setCaptcha(null)}
    />
  );
  const needsCaptcha = Boolean(siteKey) && !captcha;
  const backButton = (to: Step, label: string) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      className="inline-flex items-center gap-1.5 rounded-md text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
  const emailField = (
    <Field id={`${uid}-email`} icon={<MailIcon />} label={t("email")} invalid={Boolean(error)}>
      {(props) => (
        <Input
          {...props}
          type="email"
          autoComplete="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
    </Field>
  );

  if (step.kind === "done") {
    return (
      <output className="grid justify-items-center gap-3 py-6 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-text">
          <CheckIcon className="size-5" aria-hidden="true" />
        </div>
        <p className="font-medium">{t("doneTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("doneBody")}</p>
      </output>
    );
  }

  if (step.kind === "code") {
    const recovery = step.purpose === "recovery";
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
        className="grid gap-4"
        noValidate
      >
        <div className="grid gap-1">
          <p className="font-medium">{t(recovery ? "resetTitle" : "confirmTitle")}</p>
          <p className="text-muted-foreground text-sm">
            {t.rich(recovery ? "resetCodeSent" : "codeSent", {
              email: step.email,
              b: (chunks) => <b className="text-foreground">{chunks}</b>,
            })}
          </p>
        </div>
        <span id={`${uid}-code`} className="sr-only">
          {t("codeLabel")}
        </span>
        <CodeInput
          labelId={`${uid}-code`}
          digitLabel={(n) => t("digit", { n })}
          value={code}
          onChange={setCode}
          // A reset also needs the new password, so it waits for the button.
          onComplete={recovery ? undefined : verify}
          invalid={Boolean(error)}
          describedBy={error ? "signin-error" : undefined}
          disabled={pending || blocked}
        />
        {recovery ? (
          <PasswordInput
            id={`${uid}-new-password`}
            value={newPassword}
            onChange={setNewPassword}
            label={t("newPassword")}
            autoComplete="new-password"
            invalid={Boolean(error)}
          />
        ) : null}
        {errorBox}
        <Button type="submit" variant="brand" size="lg" disabled={pending || blocked || code.length !== 6}>
          {pending ? t("verifying") : t(recovery ? "savePassword" : "verify")}
        </Button>
        <div className="flex items-center justify-between gap-3 text-sm">
          {backButton(recovery ? { kind: "forgot" } : { kind: "credentials" }, t("useOtherEmail"))}
          {resendIn > 0 ? (
            <span className="text-faint tabular-nums">{t("resendIn", { seconds: resendIn })}</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={pending || blocked || needsCaptcha}
              className="rounded-md font-medium text-brand-text hover:underline disabled:opacity-45"
            >
              {t("resend")}
            </button>
          )}
        </div>
        {resendIn === 0 ? captchaWidget : null}
      </form>
    );
  }

  if (step.kind === "forgot") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitForgot();
        }}
        className="grid gap-3"
        noValidate
      >
        <div className="mb-1 grid gap-1">
          <p className="font-medium">{t("resetTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("resetBody")}</p>
        </div>
        {emailField}
        {captchaWidget}
        {errorBox}
        <Button type="submit" variant="brand" size="lg" disabled={pending || blocked || needsCaptcha}>
          {pending ? t("sending") : t("sendResetCode")}
        </Button>
        <div>{backButton({ kind: "credentials" }, t("backToSignIn"))}</div>
      </form>
    );
  }

  const signup = mode === "signup";
  return (
    <div className="grid gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitCredentials();
        }}
        className="grid gap-3"
        noValidate
      >
        {emailField}
        <PasswordInput
          id={`${uid}-password`}
          value={password}
          onChange={setPassword}
          label={t("password")}
          autoComplete={signup ? "new-password" : "current-password"}
          invalid={Boolean(error)}
        />
        {signup ? (
          <p className="-mt-1 px-1 text-faint text-xs">{t("passwordHint")}</p>
        ) : (
          <button
            type="button"
            onClick={() => goTo({ kind: "forgot" })}
            className="-mt-1 justify-self-end rounded-md text-muted-foreground text-sm hover:text-foreground"
          >
            {t("forgot")}
          </button>
        )}
        {captchaWidget}
        {errorBox}
        <Button type="submit" variant="brand" size="lg" disabled={pending || blocked || needsCaptcha}>
          {pending ? t(signup ? "creating" : "signingIn") : t(signup ? "createAccountCta" : "signIn")}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-faint text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {t("or")}
      </div>
      <Button variant="outline" size="lg" className="w-full" onClick={google} disabled={pending}>
        <GoogleMark />
        {t("google")}
      </Button>
      {signup ? <p className="text-center text-faint text-xs leading-relaxed">{t("terms")}</p> : null}
      {onModeChange ? (
        <p className="text-center text-muted-foreground text-sm">
          {signup ? t("haveAccount") : t("noAccount")}{" "}
          <button
            type="button"
            onClick={() => onModeChange(signup ? "signin" : "signup")}
            className="rounded-sm font-medium text-brand-text hover:underline"
          >
            {signup ? t("signInLink") : t("createOne")}
          </button>
        </p>
      ) : null}
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
