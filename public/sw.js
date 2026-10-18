const CACHE_NAME = "hallschat-pwa-v50-circular-icon-structure";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest?v=14", /pwa-launch-icon.svg?v=6];
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


self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "" }; }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "HallsChat";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new alert.",
    tag: typeof payload.tag === "string" ? payload.tag : "hallschat-alert",
    icon: "/crown-chat-app-icon.svg?v=8",
    badge: "/crown-chat-app-icon.svg?v=8",
    requireInteraction: payload.type === "incoming-call",
    renotify: payload.type === "incoming-call",
    vibrate: payload.type === "incoming-call" ? [350, 180, 350, 180, 700] : [180, 100, 180],
    data: {
      url: typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/notifications",
      type: typeof payload.type === "string" ? payload.type : "alert",
      callId: typeof payload.callId === "string" ? payload.callId : "",
      callerId: typeof payload.callerId === "string" ? payload.callerId : "",
      kind: typeof payload.kind === "string" ? payload.kind : ""
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url;
  const url = typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/notifications";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
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
