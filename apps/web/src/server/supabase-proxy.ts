import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/shared/config/env";

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes the Supabase session on every request. Cookies are copied onto whatever response
 * next-intl produced (rewrite, redirect or next). It never creates users: a guest is created on
 * the first action, after Turnstile (docs/AUTH.md, E01).
 */
export async function updateSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const env = publicEnv();
  const jar: CookieToSet[] = [];
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const c of cookiesToSet) {
            request.cookies.set(c.name, c.value);
            jar.push(c);
          }
          cacheHeaders = headers ?? {};
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims (Supabase SSR guidance).
  const { data } = await supabase.auth.getClaims();

  // E09: another user's (or a made-up) document is a real 404. Pages stream with a 200 under Cache
  // Components, so the check has to run here, before the response starts. RLS limits the lookup
  // to the caller's own rows; it reads the id only.
  let final = response;
  const [, locale = "en", documentId] = DOCUMENT_PAGE.exec(request.nextUrl.pathname) ?? [];
  if (documentId && (await isMissingDocument(supabase, data?.claims?.sub, documentId))) {
    final = notFoundResponse(request, locale);
  }

  for (const { name, value, options } of jar) final.cookies.set(name, value, options);
  for (const [k, v] of Object.entries(cacheHeaders)) final.headers.set(k, v);
  return final;
}

const DOCUMENT_PAGE =
  /^\/([a-z]{2})\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * True only when we know the caller has no such document: signed out, or the lookup found no row.
 * A database error falls through, and the page's own ownership check decides.
 */
async function isMissingDocument(
  supabase: ReturnType<typeof createServerClient>,
  userId: unknown,
  documentId: string,
): Promise<boolean> {
  if (typeof userId !== "string") return true;
  const { data, error } = await supabase.from("documents").select("id").eq("id", documentId).maybeSingle();
  return !error && data === null;
}

/** Serves the localized not-found page with a 404 status (no route matches the rewrite target). */
export function notFoundResponse(request: NextRequest, locale: string): NextResponse {
  return NextResponse.rewrite(new URL(`/${locale}/not-found`, request.url));
}
