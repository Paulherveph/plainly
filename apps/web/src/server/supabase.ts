import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/shared/config/env";
import type { Database } from "@/shared/lib/db-types";

export type Supabase = Awaited<ReturnType<typeof createSupabase>>;

/** Per-request Supabase client acting as the signed-in (or anonymous) user. RLS applies. */
export async function createSupabase() {
  // Session reads touch the clock (JWT expiry, quota day). Opt out of the runtime prerender
  // before that, or Cache Components flags the time read as an unstable value.
  await connection();
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
          }
        },
      },
    },
  );
}

export type SessionUser = { id: string; isAnonymous: boolean; email: string | null };

/** Reads and verifies the session (getClaims checks the JWT signature). */
export async function getSessionUser(supabase: Supabase): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const claims = data.claims;
  return {
    id: claims.sub,
    isAnonymous: claims.is_anonymous === true,
    email: typeof claims.email === "string" && claims.email.length > 0 ? claims.email : null,
  };
}
