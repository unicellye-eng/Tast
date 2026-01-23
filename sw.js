/* sw.js (مُحدّث) — كاش ذكي + تحديث فوري للبيانات
   الفكرة:
   - HTML / CSS / JS: Network First (لضمان أن التحديثات تظهر بسرعة)
   - بيانات Google Sheet (opensheet.elk.sh): Network First مع fallback للكاش
   - الصور/الصوت: Cache First (تسريع) + يتم حفظ ما يفتحه المستخدم فقط (لن يحمل 3000 ملف دفعة واحدة)
*/

const VERSION = "v4-auto"; // غيّر الرقم عند أي تعديل جديد (v4, v5...)
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// ضع هنا الملفات الأساسية التي تريدها تعمل حتى بدون إنترنت
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./register-sw.js",
  "./sheet-config.js",
  "./data.js",
  "./manifest.json",
  "./manifest-unitones.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // احذف كاش الإصدارات القديمة
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// أداة بسيطة: محاولة شبكة مع مهلة (للبيانات)
async function fetchWithTimeout(request, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: "no-store" });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// Network First: للـHTML وملفات البيانات (حتى لا تبقى نسخة قديمة)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request);
    // خزّن نسخة ناجحة
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // fallback للكاش
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Cache First: للصور والصوت (سرعة) — مع fallback للشبكة
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // نتعامل فقط مع GET
  if (req.method !== "GET") return;

  // 1) بيانات الإكسل (JSON) من opensheet: Network First
  if (url.hostname === "opensheet.elk.sh") {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // 2) صفحات الموقع (HTML): Network First (لمنع بقاء نسخة قديمة)
  if (req.mode === "navigate" || (req.destination === "document")) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }

  // 3) ملفات CSS/JS: Network First (تحديث سريع)
  if (req.destination === "script" || req.destination === "style") {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }

  // 4) صور + صوت: Cache First (تسريع)
  if (req.destination === "image" || req.destination === "audio") {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 5) باقي الملفات: جرّب الكاش ثم الشبكة
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      const response = await fetch(req);
      if (response && response.ok) cache.put(req, response.clone());
      return response;
    })()
  );
});

// زر تنظيف الكاش (اختياري): يمكن استدعاؤه من الصفحة إذا أردت لاحقًا
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        // بعد المسح، حدث كل الصفحات
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((c) => c.navigate(c.url));
      })()
    );
  }
});
// Allow the page to trigger immediate activation of a new worker
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


