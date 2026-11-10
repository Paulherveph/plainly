import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/server/supabase-proxy";
import { routing } from "@/shared/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/** App pages need a user; marketing pages must not create one (crawlers, rate limits). */
const APP_PATH = /^\/(en|fr|zh)\/(documents|deadlines)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/auth/");
  const response = isApi ? NextResponse.next({ request }) : handleI18nRouting(request);
  return updateSession(request, response, { ensureUser: APP_PATH.test(pathname) });
}

export const config = {
  // Everything except Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
