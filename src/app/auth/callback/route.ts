import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabase, type Supabase } from "@/server/supabase";

const FALLBACK = "/en/documents";

/** Only same-site paths, never `//evil.com`. */
function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : FALLBACK;
}

async function completeSignIn(supabase: Supabase, params: URLSearchParams): Promise<boolean> {
  const code = params.get("code");
  if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type) return !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  return false;
}

/** Finishes OAuth, magic-link and email-change flows, then returns to the app. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = new URL(safeNext(params.get("next")), request.nextUrl.origin);
  const signedIn = await completeSignIn(await createSupabase(), params);
  if (!signedIn) target.searchParams.set("auth", "failed");
  return NextResponse.redirect(target);
}
