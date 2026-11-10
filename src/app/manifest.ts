import type { MetadataRoute } from "next";

/** Makes Plainly installable on desktop and mobile (see ADR "Installable PWA instead of native apps"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plainly",
    short_name: "Plainly",
    description: "Paperwork, in plain language.",
    id: "/",
    start_url: "/en/documents",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
