const CACHE_NAME = 'truco-v44';
const urlsToCache = [
  './',
  'index.html',
  'style.css?v=43',
  'script.js?v=43',
  'manifest.json',
  'fosforo.png',
  'icono.png',
  'inicio.jpg',
  'fondo-boca.jpg',
  'fondo-river.jpg',
  'fondo-racing.jpg',
  'fondo-rojo.jpg',
  'fondo-sanlorenzo.jpg',
  'fondo-clasico.png',
  'marco-madera.png',
  'fondo-diego.jpg',
  'btn-jugar.png',
  'btn-config.png',
  'pelota.jpg',
  'flor.png',
  'flor-blanca.png',
  'flor-boca.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forces the waiting Service Worker to become active immediately
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Takes control of the page immediately
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