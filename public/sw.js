const CACHE_NAME = "hallschat-pwa-v32";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest?v=5", "/crown-chat.svg?v=9"];
const CACHEABLE_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico", ".woff", ".woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Do not block installation if an optional shell asset is unavailable.
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("hallschat-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Always prefer the deployed page. Use the cached shell only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match("/index.html")) || (await caches.match("/"))
      )
    );
    return;
  }

  // Cache static files only; Vite's built JS/CSS assets use hashed filenames.
  const isStaticAsset = CACHEABLE_EXTENSIONS.some((extension) =>
    url.pathname.endsWith(extension)
  );
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
