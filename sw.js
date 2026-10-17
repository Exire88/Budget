/* Hvor gikk pengene? – lagrer appen på enheten slik at den virker uten nett.
   Bankfiler går aldri gjennom her: de leses direkte i appen og sendes ikke noe sted. */
const VERSION = 'hgp-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];
// Excel-leseren hentes ved installasjon, så .xlsx-filer også kan åpnes uten nett.
const EXTERNAL = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
const RUNTIME_HOSTS = /^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    for (const url of EXTERNAL) {
      try { await cache.put(url, await fetch(url, { mode: 'no-cors' })); } catch (e) { /* hentes neste gang appen er på nett */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Selve appen: prøv nett først for å få oppdateringer, bruk lagret versjon uten nett.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Ikoner, Excel-leser og skrifter: bruk lagret kopi, hent og lagre ellers.
  if (url.origin === self.location.origin || RUNTIME_HOSTS.test(url.hostname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          const cache = await caches.open(VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
  }
});
