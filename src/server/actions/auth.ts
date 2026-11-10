"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabase, getSessionUser } from "@/server/supabase";
import { publicEnv } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";
import { err, ok, type Result } from "@/shared/lib/result";

type AuthError = { kind: "invalid_email" } | { kind: "failed" };

const Locale = z.enum(routing.locales);

function callbackUrl(locale: string): string {
  const next = `/${Locale.catch("en").parse(locale)}/documents`;
  return `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Guests keep their data: Google is linked to the anonymous user instead of creating a new one. */
export async function continueWithGoogle(locale: string): Promise<Result<never, AuthError>> {
  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  const options = { redirectTo: callbackUrl(locale) };
  const { data, error } = user?.isAnonymous
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error || !data.url) return err({ kind: "failed" });
  redirect(data.url);
}

/** Magic link. For a guest, attaching the email upgrades the same user once the link is clicked. */
export async function sendMagicLink(locale: string, email: string): Promise<Result<null, AuthError>> {
  const parsed = z.email().max(254).safeParse(email.trim());
  if (!parsed.success) return err({ kind: "invalid_email" });

  const supabase = await createSupabase();
  const user = await getSessionUser(supabase);
  const emailRedirectTo = callbackUrl(locale);
  const { error } = user?.isAnonymous
    ? await supabase.auth.updateUser({ email: parsed.data }, { emailRedirectTo })
    : await supabase.auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo } });
  return error ? err({ kind: "failed" }) : ok(null);
}
