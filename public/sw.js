// Minimal offline-shell service worker.
//
// The app's data layer already falls back to localStorage when fetches fail;
// what it couldn't survive before was the page itself failing to load with no
// signal (e.g. at the riverbank). This worker keeps the last-known app shell
// - the HTML plus the hashed JS/CSS/font chunks it references - cached so the
// installed PWA opens offline, where the localStorage data cache then takes
// over.
//
// Strategy:
// - navigations: network-first, falling back to the cached shell offline
// - /_next/static/: cache-first (content-hashed, immutable)
// - other same-origin static files: network-first with cache fallback
// - /api/: never intercepted - the client handles its own fallbacks and a
//   stale-while-offline API response here would defeat its freshness logic

const SHELL_CACHE = "severnwatch-shell-v1";
const STATIC_CACHE = "severnwatch-static-v1";
// Old hashed chunks accumulate across deploys (each has a new URL); keep the
// static cache bounded rather than growing forever.
const STATIC_CACHE_MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache keys are returned oldest-first, so delete from the front.
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

async function putInCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  if (cacheName === STATIC_CACHE) {
    await trimCache(cacheName, STATIC_CACHE_MAX_ENTRIES);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(putInCache(SHELL_CACHE, "/", response.clone()));
          }
          return response;
        })
        // respondWith rejects on undefined, so a miss must still resolve to
        // a Response - that surfaces the browser's own offline page.
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              event.waitUntil(
                putInCache(STATIC_CACHE, request, response.clone())
              );
            }
            return response;
          })
      )
    );
    return;
  }

  // Fonts, icons, manifest: prefer fresh, fall back to cache offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          event.waitUntil(putInCache(STATIC_CACHE, request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? Response.error()))
  );
});
