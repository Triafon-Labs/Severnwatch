// Bump this whenever the app shell changes shape enough that a returning
// visitor should not be served anything from the previous one. The activate
// handler below deletes every `severnwatch-` cache that isn't the current
// version, so a bump is what actually evicts the old entries - most of which
// are hashed `/_next/static/` assets that nothing will ever request again.
const CACHE_VERSION = "severnwatch-v2";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("severnwatch-") && key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data endpoints: always try the network first so readings stay current,
  // falling back to the last cached response only when offline.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets never change content under a given URL, so serve from
  // cache when present and only hit the network on a cache miss.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (pages, icons, manifest): try the network, keep a cached
  // copy for offline fallback.
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
