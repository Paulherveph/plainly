/**
 * HMAC-signed short-lived values (for example the guest id carried across a sign-in redirect).
 * Format: base64url(payload).base64url(hmac). Never put secrets or content in the payload.
 */
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signValue(value: string, secret: string, ttlSeconds: number, now = Date.now()): Promise<string> {
  const payload = enc.encode(JSON.stringify({ v: value, exp: Math.floor(now / 1000) + ttlSeconds }));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), payload));
  return `${b64url(payload)}.${b64url(sig)}`;
}

export async function verifyValue(token: string | undefined, secret: string, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  try {
    const payload = fromB64url(p);
    const valid = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(s), payload);
    if (!valid) return null;
    const { v, exp } = JSON.parse(new TextDecoder().decode(payload)) as { v: string; exp: number };
    return exp * 1000 > now ? v : null;
  } catch {
    return null;
  }
}
