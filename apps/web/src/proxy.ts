import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/server/supabase-proxy";
import { routing } from "@/shared/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/auth/");
  const response = isApi ? NextResponse.next({ request }) : handleI18nRouting(request);
  // Refreshes the session only. Guests are created on their first action, after Turnstile (E01).
  return updateSession(request, response);
}

export const config = {
  // Everything except Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
