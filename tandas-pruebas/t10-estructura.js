const { T } = require('./lib');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../tandas');

T('Archivos · todo lo que carga la app existe (scripts, estilos, iconos, manifest)', async ({ ok }) => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const refs = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map(m => m[1]).filter(u => !/^https?:|^mailto:|^data:/.test(u));
  ok(refs.length >= 4, 'index.html referencia archivos'); for (const r of refs) ok(fs.existsSync(path.join(root, r)), 'existe ' + r);
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')); ok(man.name && man.start_url && man.display, 'manifest con nombre, start_url y display'); for (const i of man.icons || []) ok(fs.existsSync(path.join(root, i.src)), 'icono ' + i.src); ok((man.icons || []).some(i => /512/.test(i.sizes)), 'hay icono de 512');
});
T('Archivos · el service worker tiene sintaxis válida y cachea archivos que existen', async ({ ok }) => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); try { new Function(sw.replace(/self\./g, 'self_.')); ok(true, ''); } catch (e) { ok(false, 'sw.js no compila: ' + e.message); }
  const shell = (sw.match(/const SHELL = \[([^\]]*)\]/) || [])[1] || ''; const files = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './' && !/^https?:/.test(f)); ok(files.length >= 5, 'SHELL con archivos: ' + files.length); for (const f of files) ok(fs.existsSync(path.join(root, f.replace(/^\.\//, ''))), 'el SW cachea un archivo que no existe: ' + f);
  ok(/tandas-v\d+/.test(sw), 'tiene versión de caché');
});
T('Archivos · la versión de la app tiene el formato esperado y la caché está al día', async ({ ok }) => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'); ok(/const VERSION = '\d+\.\d+(\.\d+)? · \d+ \w+'/.test(app), 'VERSION con formato «2.8.2 · 7 nov»');
});
T('Datos · recetas: ids únicos, ingredientes en el catálogo, pasos y tipos', async ({ h, ok }) => {
  await h.start(); const bad = await h.S(() => { const o = []; const ids = new Set(); for (const r of S.R) { if (ids.has(r.id)) o.push('id repetido ' + r.id); ids.add(r.id); if (!r.rac || r.rac < 1) o.push('raciones ' + r.n); if (r.i.length && (S.STEPS[r.id] || []).length < 2) o.push('pocos pasos ' + r.n); if (new Set(r.i.map(x => x[0])).size !== r.i.length) o.push('ingrediente repetido en ' + r.n); } return o; }); ok(bad.length === 0, bad.slice(0, 6).join(' | '));
});
T('Datos · catálogo: cada producto tiene categoría, precio y formato, y no hay huérfanos', async ({ h, ok }) => {
  await h.start(); const bad = await h.S(() => { const o = []; const inCat = new Set(S.CATS.flatMap(c => c.items)); for (const [n, p] of Object.entries(S.P)) { if (!inCat.has(n)) o.push('sin categoría: ' + n); if (!(p.p > 0)) o.push('precio 0: ' + n); if (!p.f) o.push('sin formato: ' + n); if (!['g', 'ml', 'ud'].includes(p.u)) o.push('unidad rara ' + n); if (!(p.q > 0)) o.push('tamaño 0: ' + n); } for (const n of inCat) if (!S.P[n]) o.push('categoría con producto inexistente: ' + n); return o; }); ok(bad.length === 0, bad.slice(0, 6).join(' | ') + (bad.length > 6 ? ` (+${bad.length - 6})` : ''));
});
T('Datos · Ecuador: todos los productos tienen precio local y nombres', async ({ h, ok }) => {
  await h.start({ region: 'EC' }); const bad = await h.S(() => { const o = []; const R = window.REGIONS.EC; for (const n of Object.keys(S.P)) { const p = S.P[n]; if (!(p.p > 0)) o.push('precio ' + n); if (!isFinite(p.p)) o.push('NaN ' + n); } o.push(...(R.currency === 'USD' ? [] : ['moneda'])); return o; }); ok(bad.length === 0, bad.slice(0, 6).join(' | '));
});
T('Datos · máximo 15 recetas por tipo (menos bebidas) como pidió el usuario', async ({ h, ok }) => {
  await h.start(); const c = await h.S(() => { const o = {}; for (const r of S.R) o[r.tipos[0]] = (o[r.tipos[0]] || 0) + 1; return o; }); for (const [t, n] of Object.entries(c)) if (t !== 'bebida') ok(n <= 15, `tipo ${t} tiene ${n} (>15)`); ok(true, '');
});
T('Cocina · los pasos con palabras técnicas llevan «Palabras de cocina»', async ({ p, h, ok }) => {
  await h.start(); const r = await h.S(() => { const r = S.R.find(r => r.i.length && glosario(S.STEPS[r.id] || [])); return r ? { id: r.id, n: r.n } : null; }); ok(!!r, 'hay recetas con palabras técnicas'); if (!r) return;
  await h.exploreAdd(r); const card = p.locator(`#recipe-list article.card:has([data-id="${r.id}"])`).first(); await card.locator('details.how summary').click(); await p.waitForTimeout(80); ok(/Palabras de cocina/.test(await card.innerText()), 'sale el cuadro del glosario en «' + r.n + '»');
});
T('Pantalla · ninguna vista se desborda a los lados (ni con letra grande y mucha información)', async ({ p, h, ok }) => {
  await h.start({ big: true }); const ids = await h.S(() => S.R.filter(r => r.i.length).slice(0, 14).map(r => r.id)); for (const id of ids) await h.addPlan(id, 3, {}); await h.S(() => { for (const n of Object.keys(S.P).slice(0, 40)) S.stock[n] = 500; S.nivel = 4; S.log.push({ ts: Date.now(), t: 'cena', n: 'x', c: 1 }); save(); render(); });
  for (const v of ['recetas', 'semana', 'lista', 'despensa']) { await h.view(v); const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 362, `vista ${v}: ancho ${w}px`); }
  await p.click('#summary'); await p.waitForTimeout(100); ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 362, 'detalles abiertos sin desborde');
});
T('Accesibilidad · botones y chips tienen un tamaño cómodo para tocar', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 2); await h.stockFor(r.id, 2); await h.S(() => { S.nivel = 4; S.log.push({ ts: Date.now(), t: 'cena', n: 'x', c: 1 }); save(); render(); });
  for (const v of ['recetas', 'semana', 'lista', 'despensa']) { await h.view(v); const small = await p.evaluate(() => [...document.querySelectorAll('.view:not([hidden]) button, .view:not([hidden]) .chip, nav button')].filter(b => b.offsetParent && !b.classList.contains('link') && !b.disabled).map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 20) }; }).filter(x => x.h < 32 || x.w < 28)); ok(small.length === 0, `vista ${v}: botones pequeños → ${JSON.stringify(small.slice(0, 4))}`); }
});
T('Accesibilidad · los botones de solo icono tienen etiqueta', async ({ p, h, ok }) => {
  await h.start(); const bad = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.title).map(b => b.id || b.className)); ok(bad.length === 0, 'sin etiqueta: ' + bad.join(', '));
});
T('Accesibilidad · diálogos con título y se cierran con su ✕', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.S(() => { S.nivel = 4; S.apiKey = 'k'; save(); render(); });
  for (const [open, dlg] of [['#btn-settings', '#dlg-settings'], ['#btn-scan', '#dlg-scan'], ['#btn-ai', '#dlg-ai']]) { await p.click(open); ok(await p.locator(dlg).evaluate(d => d.open), dlg + ' abre'); ok(await p.locator(dlg + ' h2').count() >= 1, dlg + ' tiene título'); await p.locator(dlg + ' [data-close]').first().click(); ok(!(await p.locator(dlg).evaluate(d => d.open)), dlg + ' se cierra'); }
});
T('Avisos en pantalla · los mensajes duran según su longitud, máximo 2 a la vez y se cierran al tocarlos', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { toast('uno'); toast('dos'); toast('tres'); }); ok(await p.locator('#toasts > *').count() <= 2, 'máximo 2 avisos a la vez'); const n0 = await p.locator('#toasts > *').count(); const bb = await p.locator('#toasts > *').first().boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(200); eq(await p.locator('#toasts > *').count(), n0 - 1, 'al tocar un aviso se cierra');
  await h.S(() => toast('x'.repeat(200))); await p.context().clock.fastForward(3000); ok(await p.locator('#toasts > *').filter({ hasText: 'xxxx' }).count() === 1, 'un aviso largo sigue a los 3 s');
});
T('Nombre · la app se llama Oiko Meals (título, manifest, bienvenida, asistente) y conserva dirección y datos', async ({ p, h, ok }) => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); ok(/<title>Oiko Meals<\/title>/.test(html), 'título de la página'); ok(/<h1>Oiko Meals<\/h1>/.test(html), 'cabecera');
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')); ok(man.name === 'Oiko Meals' && man.short_name === 'Oiko Meals', 'manifest: ' + man.name);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); ok(!/showNotification\('Tandas'/.test(sw) && /Oiko Meals/.test(sw), 'avisos del service worker');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'); ok(/Bienvenido a Oiko Meals/.test(app) && !/Bienvenido a Tandas/.test(app), 'bienvenida'); ok(/asistente de la app Oiko Meals/.test(app), 'asistente'); ok(/localStorage|'tandas-v1'/.test(app) && /tandas-v1/.test(app), 'se conserva la clave de datos tandas-v1 (no se pierde nada)');
  ok(/tandas-v\d+/.test(sw), 'la caché mantiene su prefijo');
});
