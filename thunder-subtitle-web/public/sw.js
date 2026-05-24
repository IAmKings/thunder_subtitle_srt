// Thunder Subtitle Service Worker
// Cache key — bump on every sw.js change to force cache cleanup
const CACHE_NAME = "thunder-subtitle-v2";

// Resources to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
];

// Install: pre-cache + skip waiting (activate immediately, don't wait for old tabs to close)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Pre-cache failure is non-fatal — pages still load from network
      });
    })
  );
});

// Activate: clean old caches + claim all clients (take control without page reload)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: cache-first strategy for static assets, network-first for API
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!event.request.url.startsWith("http")) return;

  // API/WebSocket requests: bypass cache, pass through directly
  if (event.request.url.includes("/api/") || event.request.url.includes("/ws/")) {
    return;  // Let browser handle normally — no caching
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

