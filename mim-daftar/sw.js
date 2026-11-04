/* =====================================================================
   МИМ Дафтар — service worker: lets the app OPEN without internet.
   It keeps a copy of the app files (HTML, CSS, JS, fonts) on the phone.
   The data itself is kept by js/db.js.

   ⚠️ When you change any file and upload a new version, change the
   number in VERSION below (v3 → v4). Then phones get the new files.
   ===================================================================== */
const VERSION = "mim-daftar-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/i18n.js",
  "./js/db.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(APP_FILES.map((url) => cache.add(url).catch((e) => console.warn("Not cached:", url, e))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Try the internet first (so updates arrive), fall back to the saved copy. */
async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") return cache.match("./index.html");
    throw e;
  }
}

/** Saved copy first (fonts, library never change). */
async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch database / login requests — db.js handles offline data itself.
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;
  if (url.origin === self.location.origin) { event.respondWith(networkFirst(req)); return; }
  if (/fonts\.(googleapis|gstatic)\.com$|cdn\.jsdelivr\.net$/.test(url.hostname)) { event.respondWith(cacheFirst(req)); }
});
