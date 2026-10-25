// ARCK service worker: network-first for pages/scripts (so updates arrive), cache fallback for offline use.
const CACHE = 'arck-v1';
const SHELL = ['./', 'index.html', 'studio.html', 'viewer.html', 'tools.html', 'learn.html', 'guide.html', 'shapes.html', 'structures.html', 'components.html', 'item.html', 'css/theme.css', 'css/pages.css', 'css/site.css', 'css/studio.css', 'assets/img/logo-small.png', 'assets/img/favicon-32.png', 'vendor/three/build/three.module.js', 'vendor/three/build/three.core.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
});
