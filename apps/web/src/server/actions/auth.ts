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
import { mergeRememberedGuest, rememberGuest } from "../guest-merge";
import { captchaRequired, verifyTurnstile } from "../turnstile";

export type AuthError =
  | { kind: "invalid_email" }
  | { kind: "invalid_code" }
  | { kind: "expired_code" }
  | { kind: "rate_limited" }
  | { kind: "captcha_failed" }
  | { kind: "needs_captcha" }
  | { kind: "failed" };

const Locale = z.enum(routing.locales).catch("en");
const Email = z.email().max(254);
const Code = z.string().regex(/^\d{6}$/);

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
  log("auth.guest_created", { ok: !error });
  return error ? err(mapError(error.code)) : ok(null);
}

export type CodeMode = "upgrade" | "signin";

/**
 * E03: email one-time code. A guest attaches the email to the same user (keeps documents).
 * If the email already has an account (E06), the guest is remembered and merged after sign-in.
 */
export async function sendCodeAction(input: {
  email: string;
  locale: string;
  captchaToken: string | null;
}): Promise<Result<{ mode: CodeMode }, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  if (!email.success) return err({ kind: "invalid_email" });
  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  const locale = Locale.parse(input.locale);

  if (user?.isAnonymous) {
    const { error } = await supabase.auth.updateUser({ email: email.data, data: { locale } });
    if (!error) return ok({ mode: "upgrade" });
    if (error.code !== "email_exists") return err(mapError(error.code));
    await rememberGuest(user.id);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: true,
      captchaToken: input.captchaToken ?? undefined,
      data: { locale },
    },
  });
  log("auth.code_sent", { ok: !error, upgrade: false });
  return error ? err(mapError(error.code)) : ok({ mode: "signin" });
}

/** E03/E04: checks the 6-digit code. Supabase limits attempts per code and per IP. */
export async function verifyCodeAction(input: {
  email: string;
  code: string;
  mode: CodeMode;
}): Promise<Result<{ merged: number }, AuthError>> {
  const email = Email.safeParse(input.email.trim().toLowerCase());
  const code = Code.safeParse(input.code.trim());
  if (!email.success) return err({ kind: "invalid_email" });
  if (!code.success) return err({ kind: "invalid_code" });
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: input.mode === "upgrade" ? "email_change" : "email",
  });
  if (error || !data.user) {
    log("auth.code_failed", { code: error?.code ?? "none" });
    if (error?.code === "otp_expired") return err({ kind: "expired_code" });
    if (error?.status === 429) return err({ kind: "rate_limited" });
    return err({ kind: "invalid_code" });
  }
  // G08: signing up or in accepts the current Terms and Privacy versions (shown under the form).
  await supabase.rpc("accept_legal", { p_terms: LEGAL_VERSIONS.terms, p_privacy: LEGAL_VERSIONS.privacy });
  const merged = await mergeRememberedGuest(data.user.id);
  return ok({ merged });
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
