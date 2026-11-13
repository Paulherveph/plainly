/** Where the visitor is, so the install section can show the one set of steps that applies. */
export type InstallTarget = "ios" | "android" | "desktop-chromium" | "desktop-safari" | "other";

export function installTarget(userAgent: string, opts: { touchPoints?: number } = {}): InstallTarget {
  const ua = userAgent;
  const isMac = /Macintosh/.test(ua);
  // iPadOS 13+ reports a desktop Mac UA; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (isMac && (opts.touchPoints ?? 0) > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "other";
  if (/Chrome\/|Edg\//.test(ua)) return "desktop-chromium";
  if (isMac && /Version\/[\d.]+ Safari/.test(ua)) return "desktop-safari";
  return "other";
}
