import type { MetadataRoute } from "next";
import { publicEnv } from "@/shared/config/env";

export default function robots(): MetadataRoute.Robots {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: ["/en", "/fr", "/zh"],
      disallow: ["/api/", "/auth/", "/*/documents", "/*/deadlines"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
