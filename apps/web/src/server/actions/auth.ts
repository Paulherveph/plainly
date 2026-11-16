"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabase, getSessionUser } from "@/server/supabase";
import { publicEnv } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";
import { LEGAL_VERSIONS } from "@/shared/lib/legal";
import { log } from "@/shared/lib/log";
import { err, ok, type Result } from "@/shared/lib/result";
import { safeNext } from "@/shared/lib/safe-next";
import { demoCodesEnabled, issueDemoCode } from "../demo-codes";
import { mergeRememberedGuest, rememberGuest } from "../guest-merge";
import { captchaRequired, verifyTurnstile } from "../turnstile";

export type AuthError =
  | { kind: "invalid_email" }
  | { kind: "invalid_password" }
  | { kind: "invalid_credentials" }
  | { kind: "email_exists" }
  | { kind: "invalid_code" }
  | { kind: "expired_code" }
  | { kind: "rate_limited" }
  | { kind: "captcha_failed" }
  | { kind: "needs_captcha" }
  | { kind: "guest_disabled" }
  | { kind: "failed" };

const Locale = z.enum(routing.locales).catch("en");
const Email = z.email().max(254);
const Code = z.string().regex(/^\d{6}$/);
/** Matches `minimum_password_length` in supabase/config.toml. bcrypt reads at most 72 bytes. */
const Password = z.string().min(8).max(72);

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}

function callbackUrl(locale: string, next?: string): string {
  const target = safeNext(next, `/${Locale.parse(locale)}/documents`);
  return `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(target)}`;
}

function mapError(code: string | undefined): AuthError {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return { kind: "rate_limited" };
    case "captcha_failed":
      return { kind: "captcha_failed" };
    case "otp_expired":
      return { kind: "expired_code" };
    case "invalid_credentials":
      return { kind: "invalid_credentials" };
    case "weak_password":
      return { kind: "invalid_password" };
    case "email_exists":
    case "user_already_exists":
      return { kind: "email_exists" };
    case "anonymous_provider_disabled":
      return { kind: "guest_disabled" };
    default:
      return { kind: "failed" };
  }
}

/**
 * E01/E02: the first action creates an anonymous user, after Turnstile. Nothing is stored before.
 * Safe to call again: an existing session is kept.
 */
export async function startGuestAction(captchaToken: string | null): Promise<Result<null, AuthError>> {
  const supabase = await createSupabase();
  if (await getSessionUser(supabase)) return ok(null);
  if (captchaRequired() && !captchaToken) return err({ kind: "needs_captcha" });
  if (!(await verifyTurnstile(captchaToken, await clientIp()))) return err({ kind: "captcha_failed" });
  const { error } = await supabase.auth.signInAnonymously({
    options: captchaToken ? { captchaToken } : undefined,
  });
  log("auth.guest_created", { ok: !error, code: error?.code ?? "none" });
  return error ? err(mapError(error.code)) : ok(null);
}

/**
 * What a 6-digit code is for. The code never signs anyone in on its own: it approves the email.
 * signup: confirms a new account. upgrade: confirms the email a guest attached. recovery: lets the user set a new password.
 */
export type CodePurpose = "signup" | "upgrade" | "recovery";

/** `demoCode` is set only in demo mode (DEMO_SHOW_CODES): the code is shown on screen instead of emailed. */
export type AuthStep =
  | { next: "code"; purpose: CodePurpose; demoCode?: string }
  | { next: "done"; merged: number };

/**
 * demo-codes: the sign-up code goes back to the browser instead of by email (docs/TEST_ACCOUNTS.md).
 * Supabase does not check a captcha on this path, so Turnstile is checked here, unless the caller just passed
 * Supabase's own check (sign-in with a captcha token).
 */
async function demoSignupCode(input: {
  email: string;
  password: string;
  locale: string;
  captchaToken: string | null;
  captchaChecked?: boolean;
}): Promise<Result<AuthStep, AuthError>> {
  if (!input.captchaChecked) {
    if (captchaRequired() && !input.captchaToken) return err({ kind: "needs_captcha" });
    if (!(await verifyTurnstile(input.captchaToken, await clientIp())))
      return err({ kind: "captcha_failed" });
  }
  const res = await issueDemoCode({ email: input.email, password: input.password, locale: input.locale });
  log("auth.demo_code", { ok: res.ok, error: res.ok ? "none" : res.error.kind });
  return res.ok ? ok({ next: "code", purpose: "signup", demoCode: res.value.code }) : err(res.error);
}

/** After any successful sign-in: record the accepted Terms and Privacy versions (G08), then merge a remembered guest. */
async function finishSignIn(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string,
): Promise<number> {
  await supabase.rpc("accept_legal", { p_terms: LEGAL_VERSIONS.terms, p_privacy: LEGAL_VERSIONS.privacy });
  return mergeRememberedGuest(userId);
}

/**
 * E03: create an account with email and password. Supabase emails a 6-digit code; the account is approved
 * (`email_confirmed_at`) once the code is entered. A guest keeps the same user id and its documents.
 */
export async function signUpAction(input: {
  email: string;
  password: string;
  locale: string;
  captchaToken: string | null;
}): Promise<Result<AuthStep, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  if (!email.success) return err({ kind: "invalid_email" });
  if (!Password.safeParse(input.password).success) return err({ kind: "invalid_password" });
  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  const locale = Locale.parse(input.locale);

  // demo-codes: a guest is remembered, signs up as a new account, and its documents are merged after the code.
  if (demoCodesEnabled()) {
    if (user?.isAnonymous) await rememberGuest(user.id);
    return demoSignupCode({ ...input, email: email.data, locale });
  }

  if (user?.isAnonymous) {
    // The password is set once the code proves the email (verifyCodeAction, purpose "upgrade").
    const { error } = await supabase.auth.updateUser({ email: email.data, data: { locale } });
    log("auth.signup", { ok: !error, upgrade: true });
    if (error) return err(mapError(error.code));
    return ok({ next: "code", purpose: "upgrade" });
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: input.password,
    options: { data: { locale }, captchaToken: input.captchaToken ?? undefined },
  });
  log("auth.signup", { ok: !error, upgrade: false });
  if (error) return err(mapError(error.code));
  // With email confirmation on, Supabase answers an existing email with a user that has no identities.
  if (data.user && data.user.identities?.length === 0) return err({ kind: "email_exists" });
  if (data.session && data.user)
    return ok({ next: "done", merged: await finishSignIn(supabase, data.user.id) });
  return ok({ next: "code", purpose: "signup" });
}

/**
 * E04: sign in with email and password. An account that was never approved gets a fresh code instead.
 * A guest who signs in to an existing account is remembered and merged (E06).
 */
export async function signInAction(input: {
  email: string;
  password: string;
  captchaToken: string | null;
}): Promise<Result<AuthStep, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  if (!email.success) return err({ kind: "invalid_email" });
  if (!input.password) return err({ kind: "invalid_credentials" });
  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  if (user?.isAnonymous) await rememberGuest(user.id);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: input.password,
    options: { captchaToken: input.captchaToken ?? undefined },
  });
  log("auth.signin", { ok: !error, code: error?.code ?? "none" });
  if (error?.code === "email_not_confirmed") {
    // demo-codes: the password was just proven, so the code can be shown instead of emailed.
    if (demoCodesEnabled())
      return demoSignupCode({
        email: email.data,
        password: input.password,
        locale: "en",
        captchaToken: null,
        captchaChecked: true,
      });
    const resent = await supabase.auth.resend({ type: "signup", email: email.data });
    return resent.error ? err(mapError(resent.error.code)) : ok({ next: "code", purpose: "signup" });
  }
  if (error || !data.user) return err(mapError(error?.code));
  return ok({ next: "done", merged: await finishSignIn(supabase, data.user.id) });
}

/** Forgot password: emails a 6-digit code. The answer is the same whether or not the email has an account. */
export async function sendResetAction(input: {
  email: string;
  captchaToken: string | null;
}): Promise<Result<AuthStep, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  if (!email.success) return err({ kind: "invalid_email" });
  const supabase = await createSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    captchaToken: input.captchaToken ?? undefined,
  });
  log("auth.reset_sent", { ok: !error });
  return error ? err(mapError(error.code)) : ok({ next: "code", purpose: "recovery" });
}

/** Sends the code for the current step again. In demo mode a sign-up code comes back instead (needs the password). */
export async function resendCodeAction(input: {
  email: string;
  purpose: CodePurpose;
  captchaToken: string | null;
  password?: string;
}): Promise<Result<{ demoCode?: string }, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  if (!email.success) return err({ kind: "invalid_email" });
  // demo-codes: never for a password reset, which keeps the email path.
  if (input.purpose === "signup" && demoCodesEnabled()) {
    if (!input.password) return err({ kind: "invalid_credentials" });
    const res = await demoSignupCode({
      email: email.data,
      password: input.password,
      locale: "en",
      captchaToken: input.captchaToken,
    });
    if (!res.ok) return res;
    return ok({ demoCode: res.value.next === "code" ? res.value.demoCode : undefined });
  }
  const supabase = await createSupabase();
  const captchaToken = input.captchaToken ?? undefined;
  const { error } =
    input.purpose === "recovery"
      ? await supabase.auth.resetPasswordForEmail(email.data, { captchaToken })
      : await supabase.auth.resend({
          type: input.purpose === "upgrade" ? "email_change" : "signup",
          email: email.data,
          options: { captchaToken },
        });
  return error ? err(mapError(error.code)) : ok({});
}

/**
 * Checks the 6-digit code (Supabase limits attempts per code and per IP). A valid code approves the email and
 * signs the user in. For a guest upgrade or a reset, the password is then set on the same user.
 */
export async function verifyCodeAction(input: {
  email: string;
  code: string;
  purpose: CodePurpose;
  password?: string;
}): Promise<Result<{ merged: number }, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  const code = Code.safeParse(input.code.trim());
  if (!email.success) return err({ kind: "invalid_email" });
  if (!code.success) return err({ kind: "invalid_code" });
  const needsPassword = input.purpose !== "signup";
  const password = Password.safeParse(input.password ?? "");
  if (needsPassword && !password.success) return err({ kind: "invalid_password" });

  const supabase = await createSupabase();
  const type = input.purpose === "upgrade" ? "email_change" : input.purpose;
  const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type });
  if (error || !data.user) {
    log("auth.code_failed", { code: error?.code ?? "none" });
    if (error?.status === 429) return err({ kind: "rate_limited" });
    // Supabase answers a wrong code and an expired one the same way (otp_expired), so the message covers both.
    return err({ kind: "invalid_code" });
  }
  if (needsPassword && password.success) {
    const set = await supabase.auth.updateUser({ password: password.data });
    // Reusing the old password on a reset is fine: the user is signed in either way.
    if (set.error && set.error.code !== "same_password") return err(mapError(set.error.code));
  }
  return ok({ merged: await finishSignIn(supabase, data.user.id) });
}

/** E05: Google. A guest links the identity to the same user; a conflict is handled in the callback. */
export async function continueWithGoogle(locale: string, next?: string): Promise<Result<never, AuthError>> {
  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  const options = { redirectTo: callbackUrl(locale, next) };
  const { data, error } = user?.isAnonymous
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error || !data.url) return err({ kind: "failed" });
  redirect(data.url);
}

/** Signs out this device, or every other device ("others"). */
export async function signOutAction(scope: "local" | "others" = "local"): Promise<Result<null, AuthError>> {
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signOut({ scope });
  return error ? err({ kind: "failed" }) : ok(null);
}
