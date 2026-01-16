// Service Worker (anti-cache issues)
// Version bump to force update + smarter strategy (network-first for html/css/js)
const CACHE_NAME = "quiz-espanol-pwa-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./quiz.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))
    ))
  );
  self.clients.claim();
});

function isCoreRequest(url) {
  return url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/quiz.js") ||
    url.pathname.endsWith("/manifest.webmanifest");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Network-first for core files (prevents stale JS/CSS)
  if (isCoreRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for everything else (images, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
