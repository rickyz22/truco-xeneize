const CACHE_NAME = "truco-v80";
const RUNTIME_CACHE = "truco-runtime-v80";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./fosforo.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icono.png",
  "./btn-jugar.png",
  "./btn-config.png",
  "./inicio.jpg",
  "./pelota.jpg",
  "./flor.png",
  "./flor-boca.png",
  "./flor-blanca.png",
  "./fondo-boca.jpg",
  "./fondo-river.jpg",
  "./fondo-racing.jpg",
  "./fondo-rojo.jpg",
  "./fondo-sanlorenzo.jpg",
  "./fondo-diego.jpg",
  "./fondo-clasico.png",
  "./fonts/Rajdhani-Medium.woff2",
  "./fonts/Rajdhani-SemiBold.woff2",
  "./fonts/Rajdhani-Bold.woff2",
];

const isSameOrigin = (request) =>
  new URL(request.url).origin === self.location.origin;
const isImageRequest = (request) => request.destination === "image";

self.addEventListener("install", (event) => {
  // No llamamos self.skipWaiting() aqui: el nuevo SW debe esperar
  // en estado 'waiting' hasta que el usuario toque el banner de actualizacion.
  // El skipWaiting() se dispara solo desde el handler de 'message'
  // cuando el usuario presiona el boton 'Actualizar'.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  if (isImageRequest(request)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches
      .match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request)),
  );
});
