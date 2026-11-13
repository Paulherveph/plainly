import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { mergeRememberedGuest, rememberGuest } from "@/server/guest-merge";
import { createSupabase, getSessionUser, type Supabase } from "@/server/supabase";
import { log } from "@/shared/lib/log";
import { safeNext } from "@/shared/lib/safe-next";

async function completeSignIn(supabase: Supabase, params: URLSearchParams): Promise<boolean> {
  const code = params.get("code");
  if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type) return !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  return false;
}

/**
 * Finishes OAuth, email-link and email-change flows, then returns to the app (same-site paths only).
 * E06: when Google is already linked to another account, the guest is remembered, the user signs in
 * to that account, and the guest's documents are merged into it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const target = new URL(next, request.nextUrl.origin);
  const supabase = await createSupabase();

  if (params.get("error_code") === "identity_already_exists") {
    const guest = await getSessionUser(supabase);
    if (guest?.isAnonymous) {
      await rememberGuest(guest.id);
      const { data } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (data?.url) return NextResponse.redirect(data.url);
    }
  }

  const signedIn = await completeSignIn(supabase, params);
  if (!signedIn) {
    target.searchParams.set("auth", "failed");
    return NextResponse.redirect(target);
  }
  const user = await getSessionUser(supabase);
  const merged = user && !user.isAnonymous ? await mergeRememberedGuest(user.id) : 0;
  log("auth.callback", { ok: true, merged });
  if (merged > 0) target.searchParams.set("merged", String(merged));
  return NextResponse.redirect(target);
}
