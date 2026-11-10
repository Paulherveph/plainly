import type { MetadataRoute } from "next";
import { publicEnv } from "@/shared/config/env";
import { routing } from "@/shared/i18n/routing";

/** Public pages only. Documents and deadlines are private. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return ["", "/privacy"].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${site}/${l}${path}`])) },
    })),
  );
}
