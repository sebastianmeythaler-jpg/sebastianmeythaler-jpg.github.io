/* Service worker de Tandas: la app funciona sin conexión y se actualiza sola cuando hay internet. */
const CACHE = 'tandas-v12';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'tandas-state').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.anthropic.com') return; // la IA siempre va directa
  if (url.origin === location.origin) {
    // Primero la red (para recibir mejoras), si no hay conexión, la copia guardada
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});

/* Recordatorios con la app cerrada (Chrome Android con la app instalada; el móvil decide la frecuencia) */
const REM = [
  ['desayuno', 'No te olvides de la comida más importante del día, prepárate tu desayuno'],
  ['almuerzo', 'No te olvides de almorzar, es importante para tu salud'],
  ['cena', 'No te olvides de cenar, también es importante para que duermas bien!']
];
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
async function remindFromSW() {
  const c = await caches.open('tandas-state'); const r = await c.match('state'); if (!r) return;
  const { remind, log, push } = await r.json(); if (!remind || !remind.on || push) return;
  const sr = await c.match('swsent'); const swsent = sr ? await sr.json() : {};
  const now = new Date();
  for (const [t, msg] of REM) {
    const [h, m] = String(remind[t] || '').split(':').map(Number); if (isNaN(h)) continue;
    const at = new Date(now); at.setHours(h, m || 0, 0, 0);
    const ate = (log || []).some(x => x.t === t && dayKey(new Date(x.ts)) === dayKey(now));
    const sent = (remind.sent || {})[t] === dayKey(now) || swsent[t] === dayKey(now);
    if (now >= at && now - at < 3 * 36e5 && !ate && !sent) {
      swsent[t] = dayKey(now);
      await self.registration.showNotification('Tandas', { body: msg, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tandas-' + t });
    }
  }
  await c.put('swsent', new Response(JSON.stringify(swsent)));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'tandas-recordatorio') e.waitUntil(remindFromSW()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});

/* Recordatorios enviados por el servidor (push): llegan aunque la app esté cerrada, también en iPhone */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tandas', { body: d.body || '', tag: d.tag || 'tandas', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
});
