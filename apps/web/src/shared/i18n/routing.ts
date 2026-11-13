import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
  // Each public page sets its own canonical and hreflang metadata (alternates.ts). The middleware's Link header
  // would add a second, different set (x-default pointing at "/").
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
