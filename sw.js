/* ClipForge AI service worker — app-shell caching for PWA install + offline.
   It never intercepts or stores user video content. */
const CACHE = 'clipforge-v2'
// Scope-relative shell so the SW works on a root domain AND under a
// subpath (e.g. GitHub Pages /clipforge-ai/)
const SCOPE = self.registration.scope
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(
  (p) => SCOPE + p,
)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Page navigations: network first, fall back to the cached shell (offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(SCOPE + 'index.html')),
    )
    return
  }

  // Static engine/model-helper files from the pinned CDNs: cache-first so
  // repeat visits (and offline sessions) don't re-download them.
  const cdnCacheable =
    url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com'
  if (cdnCacheable) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
            return res
          }),
      ),
    )
    return
  }

  // Same-origin assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
            return res
          })
          .catch(() => hit)
        return hit || network
      }),
    )
  }
  // Everything else (including Hugging Face model downloads, which the AI
  // library caches itself) goes straight to the network.
})
