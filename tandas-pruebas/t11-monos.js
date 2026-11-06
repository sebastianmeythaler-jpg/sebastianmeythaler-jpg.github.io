// «Mono»: pulsa cosas al azar durante cientos de pasos (con semilla fija, repetible) y vigila que nada se rompa.
const { T, invariants } = require('./lib');
const SKIP = /st-reset|st-export|st-import|wl-import|sc-cam|sc-gal|st-restore|st-install|st-test-push/;
async function mono(ctx, seed, steps, o = {}) {
  const { p, h, env, ok } = ctx; await h.start(); const ids = await h.S(() => S.R.filter(r => r.i.length).map(r => r.id)); let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (o.preload) { for (let i = 0; i < 4; i++) { const id = ids[Math.floor(rnd() * ids.length)]; await h.addPlan(id, 1 + Math.floor(rnd() * 3)); } await h.S(() => { S.nivel = 4; S.apiKey = 'k'; for (const n of Object.keys(S.P).slice(0, 20)) S.stock[n] = 300; S.log.push({ ts: Date.now(), t: 'cena', n: 'x', c: 1 }); save(); render(); }); }
  const log = [];
  for (let i = 0; i < steps; i++) {
    const act = await p.evaluate(r => {
      const vis = e => e.offsetParent !== null || e.closest('dialog[open]'); const openD = document.querySelector('dialog[open]'); const scope = openD || document;
      const els = [...scope.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=file]):not([type=hidden]), select:not([disabled]), summary')].filter(e => vis(e) && e.getBoundingClientRect().width > 0 && (openD || !e.closest('dialog')));
      if (!els.length) return null; const e = els[Math.floor(r * els.length)]; const id = e.id ? '#' + e.id : e.dataset.act ? `[data-act=${e.dataset.act}]` : e.tagName.toLowerCase(); const idx = els.indexOf(e);
      return { idx, tag: e.tagName, type: e.type, id: e.id || '', act: e.dataset.act || '', txt: (e.innerText || e.value || '').slice(0, 25), name: id };
    }, rnd());
    if (!act) { await h.closeAll(); continue; } if (SKIP.test(act.id)) continue; log.push(`${act.tag}:${act.name}:${act.txt}`);
    try {
      await p.evaluate(({ idx, r1, r2 }) => {
        const vis = e => e.offsetParent !== null || e.closest('dialog[open]'); const openD = document.querySelector('dialog[open]'); const scope = openD || document;
        const els = [...scope.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=file]):not([type=hidden]), select:not([disabled]), summary')].filter(e => vis(e) && e.getBoundingClientRect().width > 0 && (openD || !e.closest('dialog'))); const e = els[idx]; if (!e) return;
        if (e.tagName === 'SELECT') { e.selectedIndex = Math.floor(r1 * e.options.length); e.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (e.tagName === 'INPUT' && e.type === 'checkbox') e.click();
        else if (e.tagName === 'INPUT' && e.type === 'number') { e.value = String([0, 1, 2, 5, 10, 99, 1000, -3][Math.floor(r1 * 8)]); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'search' || !e.type)) { e.value = ['', 'arroz', 'zzz', 'ñandú', '😀', 'a'.repeat(50)][Math.floor(r1 * 6)]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (e.tagName === 'INPUT' && e.type === 'time') { e.value = '07:30'; e.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (e.tagName === 'INPUT' && e.type === 'date') { e.value = '2026-11-0' + (1 + Math.floor(r1 * 9)); e.dispatchEvent(new Event('change', { bubbles: true })); }
        else e.click();
      }, { idx: act.idx, r1: rnd(), r2: rnd() });
    } catch (e) { log.push('(error en el paso: ' + e.message.split('\n')[0] + ')'); }
    await p.waitForTimeout(25);
    if (env.errors.length || i % 25 === 24) { const bad = await invariants(env); if (bad.length) { ok(false, `Paso ${i + 1} (semilla ${seed}) tras «${log.slice(-4).join(' → ')}»: ${bad[0]}`); env.errors.length = 0; return; } }
  }
  if (process.env.MONO_INFO) console.log('\n' + seed + ': ' + log.length + ' acciones, ' + new Set(log.map(l => l.split(':').slice(0, 2).join(':'))).size + ' botones distintos; ej.: ' + [...new Set(log.map(l => l.split(':').slice(1, 3).join(':')))].slice(0, 25).join(' | '));
  ok(true, '');
}
T('Mono · 300 pulsaciones al azar desde cero (semilla 1)', async c => mono(c, 1, 300), undefined);
T('Mono · 300 pulsaciones al azar con la app llena (semilla 2)', async c => mono(c, 2, 300, { preload: true }));
T('Mono · 300 pulsaciones al azar con la app llena (semilla 3)', async c => mono(c, 3, 300, { preload: true }));
T('Mono · 300 pulsaciones al azar con la app llena (semilla 4)', async c => mono(c, 4, 300, { preload: true }));
