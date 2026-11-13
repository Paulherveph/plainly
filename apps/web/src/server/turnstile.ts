import "server-only";
import { serverEnv } from "@/shared/config/env";

/**
 * Verifies a Turnstile token with Cloudflare when a secret is configured. Supabase also checks
 * the token when captcha is enabled for the project; this keeps the app safe if it is not.
 * Without a secret (local work) the check passes.
 */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = serverEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export const captchaRequired = () => Boolean(serverEnv().TURNSTILE_SECRET_KEY);
