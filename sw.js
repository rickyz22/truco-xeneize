const CACHE_NAME = 'truco-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/fosforo.png',
  '/icono.png',
  '/inicio.jpg',
  '/fondo-boca.jpg',
  '/fondo-river.jpg',
  '/fondo-racing.jpg',
  '/fondo-rojo.jpg',
  '/fondo-sanlorenzo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});