/* TRACE service worker: lets the installed app open without a connection.
 *
 * Every app file is answered from this device's saved copy straight away and
 * refreshed from the network in the background. A new version therefore
 * reaches people the next time they open TRACE, and TRACE offers a reload as
 * soon as it notices one. Requests to other sites (the Supabase database)
 * are never cached here.
 */
const CACHE = "trace-app-v2";
const APP_FILES = [
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/theme.css",
  "./css/workspace.css",
  "./css/teo-import.css",
  "./css/v42.css",
  "./css/shared.css",
  "./img/trace-logo.png",
  "./img/first-army.png",
  "./img/icons/apple-touch-icon.png",
  "./img/icons/favicon-32.png",
  "./img/icons/favicon.svg",
  "./img/icons/icon-192.png",
  "./img/icons/icon-512.png",
  "./img/icons/icon-maskable-512.png",
  "./js/pwa.js",
  "./js/shared/config.js",
  "./js/shared/boot.js",
  "./js/shared/sync.js",
  "./js/shared/accounts.js",
  "./js/vendor/supabase-2.117.2.js",
  "./js/data/builtin-teos.js",
  "./js/core.js",
  "./js/word-export.js",
  "./js/workspace.js",
  "./js/units-events.js",
  "./js/teo-import.js",
  "./js/evaluation-flow.js",
  "./js/aar-print.js",
  "./js/reports.js",
  "./js/vendor/jszip-3.10.1.min.js",
  "./templates/exsum-template.docx",
  "./templates/faar-template.pptx",
  "./js/backup-guard.js",
];
const PAGE = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(APP_FILES.map((f) => new Request(f, { cache: "reload" }))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

let announceTimer = 0;
function announceUpdate() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(async () => {
    for (const client of await self.clients.matchAll({ type: "window" }))
      client.postMessage({ type: "trace-update" });
  }, 1500);
}
// Images rarely change and are not worth comparing byte by byte.
const comparable = (res) =>
  /text|javascript|json|css/.test(res.headers.get("content-type") || "");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Every page load is the same single page; the #part never reaches the network.
  const key = req.mode === "navigate" ? PAGE : url.origin + url.pathname;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key);
      // Read the saved copy now: once it is handed to the page its body can't be read again.
      const savedText =
        cached && comparable(cached) ? cached.clone().text() : null;
      const refresh = fetch(key, { cache: "no-cache" })
        .then(async (res) => {
          if (!res.ok || res.type !== "basic") return res;
          const changed =
            savedText &&
            comparable(res) &&
            (await savedText) !== (await res.clone().text());
          await cache.put(key, res.clone());
          if (changed) announceUpdate();
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (
        (await refresh) ||
        new Response(
          "TRACE is offline and this file has not been saved on this device yet.",
          {
            status: 503,
            headers: { "content-type": "text/plain" },
          },
        )
      );
    })(),
  );
});
