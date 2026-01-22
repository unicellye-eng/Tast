// Service Worker: prevent "stale cache" on GitHub Pages.
// هدفه: إجبار المتصفح على جلب أحدث نسخة من ملفات البيانات/الجافاسكربت/الصفحة.
// لا نقوم بتخزين (cache) أي شيء هنا — فقط Network مع cache:no-store للملفات الحساسة.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function isNoStorePath(pathname) {
  return (
    pathname.endsWith('/index.html') ||
    pathname.endsWith('/data.js')   ||
    pathname.endsWith('/app.js')    ||
    pathname.endsWith('/manifest.json') ||
    pathname.endsWith('/manifest-unitones.json') ||
    pathname.endsWith('/sw.js')
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  if (isNoStorePath(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Default: leave as normal network request (browser default caching rules)
});
