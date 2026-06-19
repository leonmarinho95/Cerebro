// sw.js — Service worker mínimo (app shell cache).
// Estratégia: cache-first para os arquivos estáticos locais do app.
// O SDK do Firebase e as fontes vêm de CDN e são tratados pela rede/cache do
// navegador; a persistência de dados do Firestore já é offline-first.

const CACHE = "cerebro-shell-v2";
const SHELL = [
  "./index.html",
  "./css/app.css",
  "./manifest.json",
  "./js/main.js",
  "./js/router.js",
  "./js/auth.js",
  "./js/firebase.js",
  "./js/firebase-config.js",
  "./js/lib/dates.js",
  "./js/lib/util.js",
  "./js/lib/icons.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Só intercepta requisições same-origin (arquivos locais do app).
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
