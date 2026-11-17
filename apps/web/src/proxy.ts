import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { billingProvider, simulatorEnabled } from "@/server/billing";
import { notFoundResponse, updateSession } from "@/server/supabase-proxy";
import { routing } from "@/shared/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const simulator = BILLING_SIMULATOR.exec(pathname);
  if (simulator && !(await validSimulatorSession(request)))
    return notFoundResponse(request, simulator[1] ?? "en");
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/auth/");
  const response = isApi ? NextResponse.next({ request }) : handleI18nRouting(request);
  // Refreshes the session and 404s documents the user does not own (E09). Guests are created on
  // their first action, after Turnstile (E01).
  return updateSession(request, response);
}

const BILLING_SIMULATOR = /^\/([a-z]{2})\/checkout$/;

/** The fake checkout is a real 404 unless fake billing is on and the signed session is valid. */
async function validSimulatorSession(request: NextRequest): Promise<boolean> {
  const token = request.nextUrl.searchParams.get("session");
  const provider = billingProvider();
  if (!simulatorEnabled() || !token || !provider.readSession) return false;
  return (await provider.readSession(token)) !== null;
}

export const config = {
  // Everything except Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
