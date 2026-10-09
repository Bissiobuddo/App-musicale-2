// Service worker: rende l'app disponibile offline.
// Aumenta VERSION ad ogni rilascio per aggiornare la cache.
const VERSION = 'armonia-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'js/app.js', 'js/theory.js', 'js/audio.js', 'js/ui.js', 'js/voicings.js',
  'js/views/home.js', 'js/views/chords.js', 'js/views/triads.js', 'js/views/intervals.js',
  'js/views/scales.js', 'js/views/inversions.js', 'js/views/progressions.js',
  'js/views/circle.js', 'js/views/tuner.js', 'js/views/metronome.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rete prima (per avere sempre l'ultima versione), cache se offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
