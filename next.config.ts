import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Uploads are capped at 10 MB in the domain; leave room for multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  // Built-in sample PDFs are read from disk by the documents Server Action.
  outputFileTracingIncludes: { "/**": ["./samples/*.pdf"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");
export default withNextIntl(nextConfig);
