self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const branded = url.pathname.startsWith("/assets/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/favicon.ico";
  if (!branded) return;
  event.respondWith(fetch(event.request));
});
