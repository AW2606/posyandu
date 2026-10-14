// Cache sederhana agar aplikasi bisa dibuka tanpa internet setelah kunjungan pertama.
const CACHE = 'posyandu-v1'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest'])))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return
  // jaringan dulu supaya versi baru langsung terpakai; cadangan dari cache saat offline
  e.respondWith(
    fetch(r)
      .then((res) => {
        const salin = res.clone()
        caches.open(CACHE).then((c) => c.put(r, salin))
        return res
      })
      .catch(() => caches.match(r).then((m) => m || caches.match('./'))),
  )
})
