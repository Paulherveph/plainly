import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/shared/config/env";

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes the Supabase session on every request, and signs guests in anonymously
 * the first time they open an app page. Cookies are copied onto whatever response
 * next-intl produced (rewrite, redirect or next).
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
  { ensureUser }: { ensureUser: boolean },
): Promise<NextResponse> {
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

  let final = response;
  if (!data?.claims && ensureUser && request.method === "GET") {
    const { error } = await supabase.auth.signInAnonymously();
    // Redirect to the same URL so Server Components see the new session cookie.
    if (!error) final = NextResponse.redirect(request.nextUrl, { status: 307 });
  }

  for (const { name, value, options } of jar) final.cookies.set(name, value, options);
  for (const [k, v] of Object.entries(cacheHeaders)) final.headers.set(k, v);
  return final;
}
