/*
 * Plainly service worker (H01). Caches pages you opened (results, deadlines, library) and static
 * assets, so they stay readable offline. Never caches original files or any API response: document
 * originals stay on the server, and AI calls always go to the network.
 */
const VERSION = "plainly-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE = "/offline.html";
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSETS).then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Result pages, the library and deadlines: readable offline after a first visit. */
const isAppPage = (url) => /^\/(en|fr|zh)\/(documents(\/[0-9a-f-]{36})?|deadlines)\/?$/.test(url.pathname);
const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || /\.(?:svg|png|webp|woff2|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses, originals, auth flows or the billing simulator.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.includes("/dev/")) return;

  if (request.mode === "navigate" && isAppPage(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      trim(cache);
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? (await caches.match(OFFLINE));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(key);
}

/* Signing out, deleting everything or deleting the account clears cached pages. */
self.addEventListener("message", (event) => {
  if (event.data === "clear") event.waitUntil(caches.delete(PAGES));
});
