/* Service Worker — الإصدار يتغير تلقائياً مع تغيّر ملفات الواجهة. لا يمس localStorage ولا كاش الملفات m1-files. */
const VERSION = "bf8f4f38", SHELL = "shell-" + VERSION, FILES = "m1-files";
const PRECACHE = ["./", "index.html", "subjects-data.js", "manifest.webmanifest", "offline.html", "assets/css/app.css", "assets/js/app.js", "assets/icons/icon-192.png", "assets/icons/icon-512.png"];
const abs = p => new URL(p, self.registration.scope).href;
self.addEventListener("install", e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function slice(req, res) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") || ""); if (!m) return res;
  const buf = await res.arrayBuffer(), s = +m[1], e = m[2] ? +m[2] : buf.byteLength - 1;
  return new Response(buf.slice(s, e + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream", "Content-Range": `bytes ${s}-${e}/${buf.byteLength}`, "Content-Length": String(e - s + 1) } });
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const files = await caches.open(FILES), hit = await files.match(req.url);
    if (hit) return req.headers.has("range") ? slice(req, hit) : hit;
    const shell = await caches.open(SHELL), inShell = req.mode === "navigate" || PRECACHE.some(p => abs(p) === req.url);
    if (!inShell) return fetch(req);
    const key = req.mode === "navigate" ? abs("./") : req;
    const cached = await shell.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) shell.put(key, r.clone()); return r; });
    if (cached) { net.catch(() => {}); return cached; }
    try { return await net; } catch (_) { return (await shell.match(abs("offline.html"))) || Response.error(); }
  })());
});
