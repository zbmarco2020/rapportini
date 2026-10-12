// Service worker: rende l'applicazione installabile e la apre anche senza connessione.
// I dati (rapportini, foto, note vocali) li gestisce localdb.js con la sua copia sul telefono.
const VERSIONE = "rapportini-v1";
const APP = ["./", "index.html", "localdb.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/logo.jpg"];
const ESTERNI = ["https://cdnjs.cloudflare.com/",
  "https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const proprio = url.origin === location.origin;
  const esterno = ESTERNI.some(p => req.url.startsWith(p));
  if (url.pathname.startsWith("/api/")) return;
  if (!proprio && !esterno) return; // le chiamate al server non passano dalla cache
  if (proprio) {
    // prima la rete, così gli aggiornamenti arrivano subito; senza rete la copia salvata
    e.respondWith(fetch(req).then(r => {
      const copia = r.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); return r;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  } else {
    // librerie e caratteri: prima la copia salvata
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); return res;
    })));
  }
});
