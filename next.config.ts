import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP. The browser never talks to Supabase or Anthropic directly (all calls are server-side),
 * so connect-src stays 'self'. Inline scripts are allowed for the Next.js bootstrap and the
 * theme script; a nonce would force every page to render dynamically (see docs/SECURITY.md).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * The original-file route is shown inside our own preview panel, so it may be framed by
 * same-origin pages only. Later rules override earlier ones for the same header key.
 */
const originalFileHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/documents/:id/original", headers: originalFileHeaders },
    ];
  },
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
