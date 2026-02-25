/**
 * Expense-me Service Worker
 *
 * Strategy overview
 * ─────────────────
 * /api/*          → Network-only   (never cache API responses)
 * /*.html + /     → Network-first  (always try to fetch the freshest shell)
 * /assets/*       → Cache-first    (hashed filenames = safe to cache forever)
 * everything else → Stale-while-revalidate
 *
 * A new CACHE_VERSION causes all old caches to be deleted on activation.
 *
 * NOTE:  Bump CACHE_VERSION whenever you deploy significant changes so that
 *        existing users get the fresh assets immediately.
 */

const CACHE_VERSION = "v3";
const STATIC_CACHE = `expense-me-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `expense-me-runtime-${CACHE_VERSION}`;

// Assets to pre-cache during install (the app shell)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/favicon.png",
];

// ── Install: pre-cache the shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: delete stale caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: respond from cache / network ──────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API calls
  if (url.pathname.startsWith("/api/")) return;

  // Hashed assets (/assets/*): cache-first, cache forever
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // HTML / navigation: network-first, fall back to cached /index.html for SPA
  if (
    request.mode === "navigate" ||
    request.headers.get("Accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match("/index.html")),
        ),
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        return cached ?? networkFetch;
      }),
    ),
  );
});
