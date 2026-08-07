/* Service worker de la PWA "Cierre Ruta".
 * Solo cachea el "cascarón" (esta página, el manifiesto y los íconos) para que
 * el ícono abra al instante aunque la señal esté débil. NO cachea la app de
 * Apps Script (es de otro origen y sus respuestas son opacas): esa siempre va
 * a la red, igual que hoy. El offline real de los datos es una fase posterior.
 */
const CACHE = 'cierre-ruta-shell-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Todo lo que no sea de nuestro propio hosting (Apps Script, MapLibre, etc.)
  // pasa directo a la red sin que el SW lo toque.
  if (url.origin !== self.location.origin) return;

  // Navegación (abrir la app): red primero, y si no hay señal cae al cascarón
  // cacheado para que al menos abra la pantalla de carga.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }

  // Recursos propios (íconos, manifiesto): caché primero, red de respaldo.
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
