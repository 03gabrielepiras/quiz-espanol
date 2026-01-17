/*
  Service Worker (PWA)
  Obiettivi:
  - Stabilità su iOS (Safari standalone) e Android
  - Offline per le risorse dell'app
  - Evitare il classico bug: fallback di index.html anche per JS/CSS (rompe l'app con "Unexpected token <")
  - Gestire querystring (es. quiz.js?v=...) con ignoreSearch
*/

'use strict';

const CACHE_NAME = 'espanol-pwa-v5';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './quiz.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === '' && request.headers.get('accept')?.includes('text/html'));
}

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 1) Navigazioni: network-first, fallback a index.html
  if (isNavigationRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // aggiorna cache della shell (utile su iOS)
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) Risorse statiche SAME-ORIGIN: cache-first (con ignoreSearch per ?v=...)
  if (isSameOrigin(req.url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          // cache solo risposte OK e basic (evita edge-case iOS)
          if (resp && resp.ok && resp.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, resp.clone()).catch(() => {});
          }
          return resp;
        } catch {
          // niente fallback HTML per JS/CSS/immagini: restituiamo errore
          return Response.error();
        }
      })()
    );
    return;
  }

  // 3) Cross-origin (es. Firebase CDN): lascia passare (niente caching e niente fallback)
  // Questo evita che, in caso di errore rete, tu serva index.html al posto di uno script CDN.
});
