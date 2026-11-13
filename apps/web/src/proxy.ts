import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/server/supabase-proxy";
import { routing } from "@/shared/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/** App pages need a user; marketing pages must not create one (crawlers, rate limits). */
const APP_PATH = /^\/(en|fr|zh)\/(documents|deadlines)(\/|$)/;

/**
 * The landing header prefetches app paths. Each prefetch would sign in its own guest and set its own
 * cookie, and a late response could replace the session of a guest that already created a document.
 * Only real navigations create a guest. Browsers mark router fetches (prefetch, RSC) with
 * `Sec-Fetch-Mode: cors`; a missing header (curl, old clients) counts as a navigation.
 */
function isNavigation(request: NextRequest): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  return mode === null || mode === "navigate";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/auth/");
  const response = isApi ? NextResponse.next({ request }) : handleI18nRouting(request);
  return updateSession(request, response, { ensureUser: APP_PATH.test(pathname) && isNavigation(request) });
}

export const config = {
  // Everything except Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
