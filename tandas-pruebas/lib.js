// Arnés de pruebas de Tandas: abre la app en un móvil virtual, pulsa botones de verdad y comprueba el resultado.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + (process.env.TANDAS_DIR ? path.resolve(process.env.TANDAS_DIR, 'index.html') : path.resolve(__dirname, '../tandas/index.html'));
const START = new Date('2026-11-07T10:00:00+01:00'); // sábado
const WORKER = 'https://tandas.sebastian-meythaler.workers.dev';
const tests = [];
const T = (name, fn, opts) => tests.push({ name, fn, opts });

async function newEnv(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, acceptDownloads: true, serviceWorkers: 'block', timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.clock.install({ time: opts.start || START });
  const p = await ctx.newPage(); p.setDefaultTimeout(3000);
  const env = { ctx, p, errors: [], forced: {}, nextTicket: null, chat: [], offline: false, aiCalls: [], push: [], fails: [], passes: 0 };
  p.on('pageerror', e => env.errors.push('JS: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource|net::|API 5/.test(m.text())) env.errors.push('consola: ' + m.text().slice(0, 200)); });
  p.on('dialog', d => { env.errors.push('diálogo del navegador: ' + d.message()); d.dismiss(); });
  await p.route('https://fonts.**', r => r.abort());
  const ai = async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204 });
    if (env.offline) return r.abort('internetdisconnected');
    const body = JSON.parse(r.request().postData() || '{}'); env.aiCalls.push(body);
    if (body.tool_choice && body.tool_choice.name === 'registrar_ticket' && env.truncate) return r.fulfill({ json: { stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 'x', name: 'registrar_ticket', input: { tienda: 'X', lineas: [] } }] } });
    if (body.tool_choice && body.tool_choice.name === 'registrar_ticket') return r.fulfill({ json: { content: [{ type: 'tool_use', id: 'x', name: 'registrar_ticket', input: env.nextTicket }] } });
    if (body.tool_choice && body.tool_choice.name && env.forced[body.tool_choice.name]) return r.fulfill({ json: { content: [{ type: 'tool_use', id: 'f', name: body.tool_choice.name, input: env.forced[body.tool_choice.name] }] } });
    const last = body.messages[body.messages.length - 1];
    if (typeof last.content === 'string') { const q = env.chat.shift(); if (q && q.tools) return r.fulfill({ json: { content: q.tools.map((u, i) => ({ type: 'tool_use', id: 'c' + i + Date.now(), name: u.tool, input: u.input })) } }); if (q && q.error) return r.fulfill({ status: 500, json: { error: { message: q.error } } }); return r.fulfill({ json: { content: [{ type: 'text', text: (q && q.text) || 'Vale.' }] } }); }
    const q2 = env.chat[0] && !env.chat[0].tools && !env.chat[0].error ? env.chat.shift() : null; return r.fulfill({ json: { content: [{ type: 'text', text: (q2 && q2.text) || 'Hecho.' }] } });
  };
  await p.route('https://api.anthropic.com/**', ai); await p.route(WORKER + '/ia', ai);
  await p.route(WORKER + '/comunidad/**', r => env.offline ? r.abort() : r.fulfill({ json: { ok: true, precios: {}, nombres: {} } }));
  await p.route(WORKER + '/push/**', r => { env.push.push(r.request().url()); r.fulfill({ json: { ok: true, id: '0'.repeat(64) } }); });
  return env;
}

// utilidades que usan los tests
function helpers(env) {
  const { p } = env; const h = {};
  h.S = (f, a) => p.evaluate(f, a);
  h.load = async (state) => { await p.goto(APP); if (state) { await p.evaluate(s => { localStorage.setItem('tandas-v1', s); }, JSON.stringify(state)); await p.reload(); } await p.waitForTimeout(250); };
  h.welcome = async (name = 'Prueba', o = {}) => {
    await p.fill('#wl-name', name); if (o.budget) await p.fill('#wl-budget', String(o.budget)); if (o.per) await p.selectOption('#wl-per', o.per);
    if (o.big) await p.check('#wl-big'); if (o.region) await p.selectOption('#wl-region', o.region);
    if (!o.remind) await p.uncheck('#wl-remind').catch(() => {}); await p.click('#wl-go'); await p.waitForTimeout(150);
  };
  h.start = async (o = {}) => { await h.load(); await h.welcome(o.name || 'Prueba', o); await h.closeAll(); };
  h.closeAll = async () => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); };
  h.toast = () => p.locator('#toasts').innerText().catch(() => '');
  h.view = async v => { await p.evaluate(v => { setView(v); }, v); await p.waitForTimeout(60); };
  h.tab = async v => { await p.locator(`.tab[data-view=${v}]`).click(); await p.waitForTimeout(80); };
  // recetas del catálogo
  h.pick = (o = {}) => p.evaluate(o => { const m = r => r.i.length && (!o.tipo || r.tipos[0] === o.tipo) && (o.tanda === undefined || !!r.tanda === o.tanda) && (!o.maxIng || r.i.length <= o.maxIng); const r = S.R.filter(m).sort((a, b) => (o.cheap ? perRacion(a, false) - perRacion(b, false) : 0))[o.n || 0]; return r ? { id: r.id, n: r.n, rac: r.rac, tanda: !!r.tanda } : null; }, o);
  h.addPlan = (rid, veces = 1, extra = {}) => p.evaluate(a => { if (!S.mine.includes(a.rid)) S.mine.push(a.rid); const it = { k: S.seq++, rid: a.rid, veces: a.veces, opc: false, ...a.extra }; S.plan.push(it); save(); render(); return it.k; }, { rid, veces, extra });
  // despensa llena para un plato (sin pasar por tickets)
  h.stockFor = (rid, veces = 1) => p.evaluate(a => { const r = byId(a.rid); const e = eq(); for (const [n, q, o] of r.i) { if (isC(n)) { S.stock[n] = Math.max(S.stock[n] || 0, 1); S.since[n] = Date.now(); continue; } S.stock[n] = r2((S.stock[n] || 0) + q / r.rac * a.veces * e * 1.05 + 0.001); } save(); render(); }, { rid, veces });
  h.chatSay = async (text, queue) => { if (queue) env.chat.push(...queue); await p.fill('#chat-text', text); await p.click('#chat-form button[type=submit]'); await p.waitForFunction(() => !aiBusy, null, { timeout: 5000 }); await p.waitForTimeout(100); };
  h.openAI = async () => { await p.evaluate(() => { S.apiKey = S.apiKey || 'sk-ant-test'; save(); }); await p.locator('#btn-ai').click(); await p.waitForSelector('#chat-text'); };
  h.scanFile = async () => { const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }), p.locator('#sc-cam').click()]); await fc.setFiles(path.resolve(__dirname, 'ticket.png')); };
  // añade a «mi recetario» pulsando de verdad: Explorar → buscar el plato → «+ A mi recetario» → volver a Mi recetario
  h.exploreAdd = async (r) => { await p.click('#seg-explore'); await h.search(r.n); await p.locator(`[data-act=mine][data-id="${r.id}"]`).first().click(); await h.search(''); await p.click('#seg-mine'); await p.waitForTimeout(80); };
  h.search = async q => { await p.fill('#rsearch', q); await p.waitForTimeout(350); };
  // ticket «de papel» con lo que pide la Lista (como si la IA lo leyera bien)
  h.ticketFromList = (o = {}) => p.evaluate(o => { const rows = shop(S.plan).rows.filter(x => x.packs > 0); const lineas = rows.map(x => ({ desc: x.n.toUpperCase().slice(0, 20), uds: x.packs, importe: Math.round(x.packs * x.p.p * 100) / 100, producto: x.n, cantidad_inventario: x.packs * x.p.q, tipo: 'De la lista', grupo: null })); lineas.push(...(o.extras || [])); const total = Math.round(lineas.reduce((a, l) => a + l.importe, 0) * 100) / 100; const d = new Date(); return { tienda: o.tienda || 'Mercadona', fecha: o.fecha || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, total: o.total != null ? o.total : total, lineas }; }, o);
  h.scan = async (ticket) => { env.nextTicket = ticket; await p.evaluate(() => { if (!S.apiKey && !S.code) { S.apiKey = 'sk-ant-test'; save(); } }); await p.locator('#btn-scan').click(); await h.scanFile(); await p.waitForSelector('#rv-save', { timeout: 5000 }); };
  h.approx = (a, b, d = 0.02) => Math.abs(a - b) <= d;
  return h;
}

// comprobaciones que se hacen SIEMPRE al acabar cada prueba
async function invariants(env) {
  const { p } = env; const out = [];
  const r = await p.evaluate(() => {
    const o = []; const txt = document.body.innerText;
    const bad = txt.match(/.{0,40}(NaN|undefined|Infinity|\[object|null €|null \$).{0,30}/); if (bad) o.push('Texto raro en pantalla: ' + bad[0].replace(/\s+/g, ' '));
    if (document.documentElement.scrollWidth > window.innerWidth + 2) o.push('Desborde horizontal: ' + document.documentElement.scrollWidth + 'px');
    if (typeof S === 'undefined') return o;
    for (const [n, q] of Object.entries(S.stock || {})) { if (!(q > 0) || !isFinite(q)) o.push('Stock inválido ' + n + '=' + q); if (!S.P[n]) o.push('Stock sin producto ' + n); }
    for (const [n, q] of Object.entries(S.hstock || {})) if (!(q > 0) || !isFinite(q)) o.push('Stock de hogar inválido ' + n + '=' + q);
    for (const x of S.log || []) if (!isFinite(x.c) || x.c < 0) o.push('Coste inválido en «Lo que comes»: ' + x.n);
    for (const it of S.plan || []) { if (!byId(it.rid)) o.push('Plato sin receta ' + it.rid); if (leftOf(it) < 0) o.push('Raciones negativas'); if (!(it.veces >= 1)) o.push('Plato con veces<1'); }
    const ks = (S.plan || []).map(i => i.k); if (new Set(ks).size !== ks.length) o.push('Platos de la semana con id repetido');
    for (const t of S.tickets || []) { if (!isFinite(t.total)) o.push('Ticket con total inválido'); const sum = (t.lineas || []).reduce((a, l) => a + (Number(l.importe) || 0), 0); if (!t.est && Math.abs(sum - t.total) > 0.05 && !t.quick) { /* los tickets guardados con diferencia se permiten */ } }
    for (const id of S.mine || []) if (!byId(id)) o.push('Receta de «mi recetario» inexistente ' + id);
    if (!isFinite(S.budget) || S.budget < 0) o.push('Presupuesto inválido ' + S.budget);
    if (typeof calcMonth === 'function') { updateMonths(); for (const [k, m] of Object.entries(S.months || {})) { const c = calcMonth(k); if (Math.abs(c.comida + c.extras - (m.comida + m.extras)) > 0.01) o.push('Historial ' + k + ' no cuadra con tickets'); } }
    const sc = document.querySelector('#s-compra'); if (sc && /NaN|undefined/.test(sc.textContent)) o.push('Cuadro «Te falta comprar» roto');
    return o;
  }).catch(e => ['No se pudo revisar el estado: ' + e.message]);
  out.push(...r); out.push(...env.errors); return out;
}

async function run(filter, o = {}) {
  const browser = await chromium.launch(); const t0 = Date.now(); const todo = tests.filter(t => (!filter || t.name.toLowerCase().includes(filter.toLowerCase())) && !(o.rapido && /^Mono/.test(t.name))); const results = new Array(todo.length);
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const i = next++; const t = todo[i]; const env = await newEnv(browser, t.opts); const h = helpers(env); const fails = [];
      const ctx = { p: env.p, env, h, ok: (c, m) => { if (!c) fails.push(m); else env.passes++; }, eq: (a, b, m) => { const same = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.011 : JSON.stringify(a) === JSON.stringify(b); if (!same) fails.push(`${m} (esperado ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`); else env.passes++; } };
      try { await t.fn(ctx); } catch (e) { fails.push('Se rompió a mitad: ' + e.message.split('\n')[0]); try { await env.p.screenshot({ path: path.resolve(__dirname, 'fallos', t.name.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '.png') }); } catch (e2) {} }
      if (!t.noInvariants) fails.push(...await invariants(env));
      results[i] = { name: t.name, fails, checks: env.passes }; await env.ctx.close(); process.stdout.write(fails.length ? 'F' : '.');
    }
  }
  await Promise.all(Array.from({ length: o.workers || 4 }, worker));
  await browser.close();
  const bad = results.filter(r => r.fails.length);
  console.log(`\n\n${results.length - bad.length}/${results.length} pruebas bien · ${results.reduce((a, r) => a + r.checks, 0)} comprobaciones · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const r of bad) { console.log('\n✗ ' + r.name); r.fails.forEach(f => console.log('    - ' + f)); }
  return bad.length;
}
module.exports = { T, run, tests, invariants };
