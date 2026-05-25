// Thunder Subtitle Service Worker — minimal PWA shell
// Only exists to satisfy Chrome's PWA install requirement.
// No fetch interception, no caching — all requests go through the browser normally.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
