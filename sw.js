self.addEventListener('install', (e) => {
  console.log('SW instalado');
});

self.addEventListener('fetch', (e) => {
  // Necesario para que Chrome habilite el modo App
});