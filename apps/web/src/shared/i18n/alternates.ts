import { routing } from "./routing";

/** Canonical + hreflang links for a public page path (without locale), e.g. "" or "/privacy". */
export function alternatesFor(locale: string, path: string) {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l === "zh" ? "zh-CN" : l, `/${l}${path}`])),
      "x-default": `/en${path}`,
    },
  };
}
