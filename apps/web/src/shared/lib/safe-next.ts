/** Default page after sign-in when no valid return path is given. */
export const DEFAULT_NEXT = "/en/documents";

/**
 * E13: only same-site relative paths. Rejects absolute URLs, protocol-relative `//host`,
 * backslash tricks (`/\host`), and control characters browsers strip.
 */
export function safeNext(value: string | null | undefined, fallback = DEFAULT_NEXT): string {
  if (!value || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://plainly.invalid");
    if (url.origin !== "https://plainly.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
