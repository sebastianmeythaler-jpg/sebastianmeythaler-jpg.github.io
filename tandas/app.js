'use strict';
/* Tandas · app de cocina por tandas, despensa y gasto por ración.
   Todo se guarda en este dispositivo (localStorage). La IA usa la clave de API del usuario. */

const KEY = 'tandas-v1';
const VERSION = '0.5 · 1 nov';
const MODELS = [['claude-haiku-5-5', 'Haiku (rápido y económico)'], ['claude-sonnet-5-5', 'Sonnet (más preciso)']];
const EXTRA_GROUPS = ['Dulces y antojos', 'Desayunos', 'Fiambres para clase', 'Salsas', 'Bebidas', 'Otros'];
const MEALS = [['desayuno', 'Desayunos', 'var(--mid)'], ['almuerzo', 'Almuerzos', 'var(--accent)'], ['cena', 'Cenas', 'var(--blue)']];
const FILTERS = [['desayuno', 'Desayuno'], ['almuerzo', 'Almuerzo'], ['cena', 'Cena'], ['postre', 'Postre'], ['bebida', 'Bebidas']];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = v => (v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const r2 = v => Math.round(v * 100) / 100;

/* ---------- Estado ---------- */
let S = load();
function load() {
  const seed = JSON.parse(JSON.stringify(window.SEED));
  const ui = { view: 'recetas', seg: 'mine', filter: [], onlyTanda: false, openHow: [], detailsOpen: false, apiKey: '', model: MODELS[0][0], chat: [] };
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s) return Object.assign(seed, ui);
  for (const k in ui) if (s[k] === undefined) s[k] = ui[k];
  for (const k in seed) if (s[k] === undefined) s[k] = seed[k];
  // Las versiones nuevas de la app añaden productos y recetas sin tocar lo tuyo
  for (const k in seed.P) if (!s.P[k]) s.P[k] = seed.P[k];
  for (const r of seed.R) if (!s.R.find(x => x.id === r.id)) s.R.push(r);
  for (const k in seed.STEPS) if (!s.STEPS[k]) s.STEPS[k] = seed.STEPS[k];
  for (const k in seed.K) if (s.K[k] === undefined) s.K[k] = seed.K[k];
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en este dispositivo'); } }

/* ---------- Cálculos ---------- */
const byId = id => S.R.find(r => r.id === id);
const eq = () => S.adults + 0.5 * S.kids;
const mealOf = r => ['desayuno', 'almuerzo', 'cena'].find(t => r.tipos.includes(t)) || null;
const leftOf = it => it.veces - (it.comidos || 0);
const optNames = r => r.i.filter(x => x[2]).map(x => x[0].toLowerCase());
const catOf = n => S.CATS.findIndex(c => c.items.includes(n));

function fmtQ(q, u) {
  if (u === 'g') return q >= 1000 ? (q / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' kg' : Math.round(q) + ' g';
  if (u === 'ml') return q >= 1000 ? (q / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' L' : Math.round(q) + ' ml';
  return (Math.round(q * 4) / 4).toLocaleString('es-ES') + ' ud';
}
function perRacion(r, opc) { let c = 0; for (const [n, q, o] of r.i) { if (o && !opc) continue; const p = S.P[n]; if (p) c += (q / r.rac) * (p.p / p.q); } return c; }
function kcal(r, opc) { let k = 0; for (const [n, q, o] of r.i) { if (o && !opc) continue; k += (q / r.rac) * (S.K[n] || 0); } return Math.round(k / 10) * 10; }
function needs(plan) {
  const m = new Map(); const e = eq();
  for (const it of plan) {
    if (it.cocinado) continue; const r = byId(it.rid); if (!r) continue;
    for (const [n, q, o] of r.i) { if (o && !it.opc) continue; m.set(n, (m.get(n) || 0) + q / r.rac * it.veces * e); }
  }
  return m;
}
function shop(plan) {
  const m = needs(plan); const rows = []; let total = 0, consumo = 0, sobra = 0;
  for (const [n, need] of m) {
    const p = S.P[n]; if (!p) continue;
    const have = S.stock[n] || 0; const toBuy = Math.max(0, need - have);
    const packs = toBuy > 1e-6 ? Math.ceil(toBuy / p.q - 1e-9) : 0; const cost = packs * p.p;
    consumo += need * p.p / p.q; total += cost; if (packs) sobra += (packs * p.q - toBuy) * p.p / p.q;
    rows.push({ n, need, have, packs, cost, p });
  }
  rows.sort((a, b) => (a.packs === 0) - (b.packs === 0) || b.cost - a.cost);
  return { rows, total, consumo, sobra };
}
function coverage(r, veces, opc, excludeK) {
  const e = eq(); const reserved = needs(S.plan.filter(p => p.k !== excludeK));
  return r.i.filter(([, , o]) => !o || opc).map(([n, q, o]) => {
    const need = q / r.rac * veces * e; const avail = Math.max(0, (S.stock[n] || 0) - (reserved.get(n) || 0));
    return { n, need, ok: avail + 1e-6 >= need, miss: Math.max(0, need - avail), o };
  });
}
function maxPlatos(r, opc, excludeK) {
  const reserved = needs(S.plan.filter(p => p.k !== excludeK)); const e = eq(); let m = Infinity;
  for (const [n, q, o] of r.i) { if (o && !opc) continue; const per = q / r.rac * e; const avail = Math.max(0, (S.stock[n] || 0) - (reserved.get(n) || 0)); m = Math.min(m, Math.floor(avail / per + 1e-6)); }
  return m;
}
function subsFor(n) {
  const g = S.SUBS.find(s => s.includes(n)); if (!g) return [];
  const need = needs(S.plan);
  return g.filter(x => x !== n && S.P[x]).map(x => ({ n: x, spare: (S.stock[x] || 0) - (need.get(x) || 0) })).filter(x => x.spare > 1e-6);
}
function subText(n, miss) {
  const s = subsFor(n); if (!s.length) return null; const u = S.P[n].u;
  const same = s.filter(x => S.P[x.n].u === u); const other = s.filter(x => S.P[x.n].u !== u);
  let left = miss; const parts = []; const used = new Set();
  for (const x of same) { if (left <= 1e-6) break; const take = Math.min(x.spare, left); parts.push(`${fmtQ(take, u)} de <b>${esc(x.n)}</b>`); used.add(x.n); left -= take; }
  const alts = same.filter(x => !used.has(x.n) && x.spare + 1e-6 >= miss).concat(other).slice(0, 1).map(x => `<b>${esc(x.n)}</b> (tienes ${fmtQ(x.spare, S.P[x.n].u)} libres)`);
  if (!parts.length) return alts.length ? `usa ${alts[0]}` : null;
  let t = `usa ${parts.join(' + ')}`;
  if (left > 1e-6) t += ` y solo te faltarían ${fmtQ(left, u)}`;
  if (alts.length) t += `, o bien ${alts[0]}`;
  return t;
}
function cookable() {
  const st = { ...S.stock }; const e = eq(); const target = S.target;
  const cnt = { desayuno: 0, almuerzo: 0, cena: 0 }; const by = {};
  const canOne = r => r.i.length && r.i.every(([n, q, o]) => o || (st[n] || 0) + 1e-6 >= q / r.rac * e);
  const capOf = r => { let m = Infinity; for (const [n, q, o] of r.i) { if (o) continue; m = Math.min(m, (st[n] || 0) / (q / r.rac * e)); } return m; };
  let moved = true;
  while (moved) {
    moved = false;
    for (const t of ['almuerzo', 'cena', 'desayuno']) {
      if (cnt[t] >= target[t]) continue;
      const c = S.R.filter(r => S.mine.includes(r.id) && mealOf(r) === t && canOne(r)).sort((a, b) => capOf(b) - capOf(a))[0];
      if (!c) continue;
      for (const [n, q, o] of c.i) { if (!o) st[n] -= q / c.rac * e; }
      cnt[t]++; by[c.id] = (by[c.id] || 0) + 1; moved = true;
    }
  }
  return { cnt, by };
}
function weekRange(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const start = new Date(x); start.setDate(x.getDate() - ((x.getDay() - S.weekStart + 7) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return { start, end };
}
const dmy = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' });
function weekTickets() { const { start, end } = weekRange(); return S.tickets.filter(t => { const d = new Date(t.fecha + 'T12:00'); return d >= start && d < end; }); }
function spentInfo() {
  const tk = weekTickets(); let planned = 0, extras = 0; const groups = {};
  for (const t of tk) for (const l of t.lineas) {
    if (l.tipo === 'Extra') { extras += l.importe; const g = l.grupo || 'Otros'; (groups[g] = groups[g] || []).push(l); } else planned += l.importe;
  }
  const spent = tk.reduce((a, t) => a + t.total, 0);
  return { tk, planned, extras, groups, spent };
}
function level(pct) { return pct >= 0.99 ? 'lv-over' : pct >= 0.8 ? 'lv-high' : pct >= 0.6 ? 'lv-mid' : 'lv-ok'; }
function deduct(r, platos, opc) {
  const e = eq();
  for (const [n, q, o] of r.i) { if (o && !opc) continue; const left = (S.stock[n] || 0) - q / r.rac * platos * e; if (left > 1e-6) S.stock[n] = r2(left); else delete S.stock[n]; }
}

/* ---------- Render: cabecera ---------- */
function renderHeader() {
  const now = new Date();
  $('#hoy').textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
  const si = spentInfo(); const pend = shop(S.plan).total; const total = si.spent + pend;
  const pct = S.budget > 0 ? total / S.budget : 2; const lv = level(pct); const left = S.budget - total;
  const scale = Math.max(total, S.budget) || 1; const { start, end } = weekRange(); const endShow = new Date(end); endShow.setDate(end.getDate() - 1);
  const { cnt } = cookable(); const tot = S.target.desayuno + S.target.almuerzo + S.target.cena; const got = cnt.desayuno + cnt.almuerzo + cnt.cena;
  const pillTxt = lv === 'lv-over' ? (left < 0 ? 'Te pasas ' + eur(-left) : 'Al límite') : 'Quedan ' + eur(left);
  const sm = $('#summary'); sm.className = 'summary ' + lv; sm.setAttribute('aria-expanded', S.detailsOpen);
  sm.innerHTML = `
    <div class="sum-row"><span class="small muted">Semana del ${dmy(start)} al ${dmy(endShow)}</span><span class="pill lv"><i></i>${pillTxt}</span></div>
    <div class="sum-row"><span class="sum-big">${eur(total)} <span>/ ${eur(S.budget)}</span></span><svg class="caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></div>
    <div class="seg" role="img" aria-label="Lo planificado ${eur(si.planned)}, extras ${eur(si.extras)}, falta comprar ${eur(pend)}">
      ${si.planned > 0 ? `<i style="width:${si.planned / scale * 100}%;background:var(--accent)"></i>` : ''}${si.extras > 0 ? `<i style="width:${si.extras / scale * 100}%;background:var(--warn)"></i>` : ''}${pend > 0 ? `<i style="width:${pend / scale * 100}%;background:var(--mid)"></i>` : ''}
    </div>
    <div class="seg-legend"><span><i style="background:var(--accent)"></i>Planificado ${eur(si.planned)}</span><span><i style="background:var(--warn)"></i>Extras ${eur(si.extras)}</span>${pend > 0 ? `<span><i style="background:var(--mid)"></i>Por comprar ${eur(pend)}</span>` : ''}</div>
    <div class="sum-row small"><span><b>${got}/${tot}</b> comidas cubiertas con lo que tienes</span><span class="muted">${got < tot ? 'ver detalle' : 'semana cubierta'}</span></div>`;
  const det = $('#details'); det.hidden = !S.detailsOpen; if (S.detailsOpen) det.innerHTML = renderDetails(si, pend);
}
function renderDetails(si, pend) {
  const sh = shop(S.plan); const buy = sh.rows.filter(x => x.packs);
  const without = si.spent - si.extras + pend;
  const dishesFor = n => S.plan.filter(p => { const r = byId(p.rid); return r && !p.cocinado && r.i.some(x => x[0] === n && (!x[2] || p.opc)); }).map(p => byId(p.rid).n);
  const groups = Object.entries(si.groups).map(([g, ls]) => [g, ls, ls.reduce((a, l) => a + l.importe, 0)]).sort((a, b) => b[2] - a[2]);
  const { cnt, by } = cookable();
  const ideas = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${esc(byId(id).n)} ×${n}`).join(' · ');
  return `
  <section class="panel" aria-label="En qué se va">
    <h3>¿En qué se va?</h3>
    ${si.extras > 0 ? `<div class="tip">Sin los extras fuera de lista habrías gastado <b>${eur(without)}</b>: ${without <= S.budget ? `${eur(S.budget - without)} por debajo del presupuesto` : `aún ${eur(without - S.budget)} por encima`}.</div>` : `<div class="tip">Esta semana no hay extras fuera de lista.</div>`}
    ${groups.map(([g, ls, t]) => `<div class="grp"><div class="gh"><span>${esc(g)}</span><span class="num">${eur(t)}</span></div>${ls.map(l => `<div class="gi"><span>${esc(l.desc)}${l.uds > 1 ? ' ×' + l.uds : ''}</span><span class="num">${eur(l.importe)}</span></div>`).join('')}</div>`).join('')}
    ${buy.length ? `<div class="grp"><div class="gh"><span>Falta comprar para tu semana</span><span class="num">${eur(pend)}</span></div>${buy.map(x => { const miss = x.need - x.have; const sub = subText(x.n, miss); return `<div class="gi"><span>${esc(x.n)} para ${dishesFor(x.n).map(esc).join(', ')}: ${sub ? `en vez de comprar ${fmtQ(miss, x.p.u)}, ${sub}` : `faltan ${fmtQ(miss, x.p.u)}`}</span><span class="num">${eur(x.cost)}</span></div>`; }).join('')}</div>` : ''}
  </section>
  <section class="panel" aria-label="Comidas cubiertas">
    <h3>Comidas que puedes cocinar con lo de casa</h3>
    <div class="meals3">${MEALS.map(([k, l, c]) => `<div class="meal"><span>${l}</span><b>${cnt[k]}<small>/${S.target[k]}</small></b><div class="ln"><i style="width:${S.target[k] ? Math.min(100, cnt[k] / S.target[k] * 100) : 0}%;background:${c}"></i></div></div>`).join('')}</div>
    ${ideas ? `<p class="small muted" style="margin:0">Por ejemplo: ${ideas}</p>` : ''}
  </section>
  <section class="panel" aria-label="Tickets de la semana">
    <h3>Tickets de la semana</h3>
    ${si.tk.length ? si.tk.map(t => `<div class="tk"><span>${new Date(t.fecha + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${esc(t.tienda)}</span><span class="num">${eur(t.total)} <button type="button" class="link" data-act="del-ticket" data-id="${t.id}" aria-label="Borrar ticket">✕</button></span></div>`).join('') : '<p class="small muted" style="margin:0">Aún no hay tickets esta semana. Usa el botón central para escanear uno.</p>'}
  </section>`;
}

/* ---------- Render: recetas ---------- */
function haveLine(r, it) {
  if (!r.i.length) return `<div class="have ok">✓ Siempre disponible · 0 €</div>`;
  if (it && it.cocinado) return `<div class="have ok">✓ Ya cocinado · te quedan ${leftOf(it)} ${leftOf(it) === 1 ? 'plato' : 'platos'}</div>`;
  const opc = it ? it.opc : false; const k = it ? it.k : null; const want = it ? it.veces : 1; const max = maxPlatos(r, opc, k);
  const pl = n => n === 1 ? 'plato' : 'platos';
  if (max >= want) return `<div class="have ok">✓ Tienes en casa para ${max} ${pl(max)}${it ? ` · llevas ${it.veces}` : ''}</div>`;
  const miss = coverage(r, want, opc, k).filter(x => !x.ok && !x.o);
  const head = it ? `Con lo de casa llegas a ${max} de ${want}. ` : '';
  return `<div class="have miss"><span>${head}${miss.map(x => { const sub = subText(x.n, x.miss); return sub ? `En vez de ${esc(x.n)}, ${sub}` : `Te falta ${esc(x.n)} ${fmtQ(x.miss, S.P[x.n].u)}`; }).join('; ')}</span></div>`;
}
function howTo(r, key, veces, k) {
  const open = S.openHow.includes(key); const e = eq(); const mult = veces * e / r.rac; const raciones = veces * e;
  const cov = coverage(r, veces, true, k);
  return `<details class="how" data-how="${key}" ${open ? 'open' : ''}><summary>Ingredientes y pasos</summary><div class="how-body">
    ${r.i.length ? `<h4>Ingredientes · ${raciones.toLocaleString('es-ES')} ${raciones === 1 ? 'ración' : 'raciones'}</h4>
    <ul>${r.i.map(([n, q, o]) => { const c = cov.find(x => x.n === n); const st = c ? (c.ok ? '<span class="st ok">en casa</span>' : `<span class="st miss">falta ${fmtQ(c.miss, S.P[n].u)}</span>`) : ''; return `<li><span>${esc(n)}${o ? ' <span class="muted">(opcional)</span>' : ''} ${st}</span><span class="num">${fmtQ(q * mult, S.P[n] ? S.P[n].u : 'ud')}</span></li>`; }).join('')}</ul>` : ''}
    <h4>Pasos</h4><ol>${(S.STEPS[r.id] || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></details>`;
}
function recipeCard(r, explore) {
  const it = S.plan.find(p => p.rid === r.id); const hasOpc = r.i.some(x => x[2]);
  const base = shop(S.plan).total; const spent = spentInfo().spent;
  let impact = '';
  if (!explore && r.i.length && !(it && it.cocinado)) {
    const trial = it ? S.plan.map(p => p === it ? { ...p, veces: p.veces + 1 } : p) : S.plan.concat([{ k: -1, rid: r.id, veces: 1, opc: false }]);
    const after = shop(trial).total; const d = after - base; const left = S.budget - spent - after;
    if (d > 0.005) impact = `<div class="impact">${it ? 'Un plato más' : 'Añadirlo'} sube la compra ${eur(d)} · ${left >= 0 ? 'te quedarían ' + eur(left) : 'te pasarías ' + eur(-left)}</div>`;
  }
  let ctrl = '';
  if (explore) ctrl = `<button type="button" class="btn small" data-act="mine" data-id="${r.id}">+ A mi recetario</button>`;
  else if (!r.i.length) ctrl = '';
  else if (it && it.cocinado) ctrl = `<span class="tag acc">Cocinado · quedan ${leftOf(it)}</span>`;
  else ctrl = `<span class="stepper" role="group" aria-label="Platos de ${esc(r.n)}"><button type="button" ${it ? `data-act="veces" data-k="${it.k}" data-d="-1"` : 'disabled'} aria-label="Un plato menos">−</button><b>${it ? it.veces : 0}</b><button type="button" class="plus" ${it ? `data-act="veces" data-k="${it.k}" data-d="1"` : `data-act="addone" data-id="${r.id}"`} aria-label="Un plato más">+</button></span>`;
  return `<article class="card">
    <div class="card-head"><h3>${esc(r.n)}</h3>${explore ? '' : `<button type="button" class="link" data-act="unmine" data-id="${r.id}">Quitar</button>`}</div>
    <div class="meta">${r.tipos.map(t => `<span class="tag">${t[0].toUpperCase() + t.slice(1)}</span>`).join('')}${r.tanda ? '<span class="tag acc">Apta para tanda</span>' : ''}${hasOpc ? `<span class="tag">+ ${esc(optNames(r).join(' y '))} opc.</span>` : ''}</div>
    <div class="cost"><div class="price">${eur(perRacion(r, false))}<small>por ración · ${kcal(r, false)} kcal</small></div>${ctrl}</div>
    ${it && !explore ? `<div class="small muted">En tu semana: ${it.veces} ${it.veces === 1 ? 'plato' : 'platos'} · ≈ ${eur(perRacion(r, it.opc) * it.veces * eq())}</div>` : ''}
    ${haveLine(r, explore ? null : it)}
    ${impact}
    ${howTo(r, (explore ? 'e-' : 'r-') + r.id, it && !explore ? it.veces : 1, it && !explore ? it.k : null)}
  </article>`;
}
function renderRecetas() {
  $('#seg-mine').setAttribute('aria-pressed', S.seg === 'mine'); $('#seg-explore').setAttribute('aria-pressed', S.seg === 'explore');
  $('#filters').innerHTML = `<button type="button" class="chip" data-act="filter" data-f="" aria-pressed="${S.filter.length === 0}">Todas</button>` + FILTERS.map(([k, l]) => `<button type="button" class="chip" data-act="filter" data-f="${k}" aria-pressed="${S.filter.includes(k)}">${l}</button>`).join('');
  $('#only-tanda').checked = S.onlyTanda;
  const explore = S.seg === 'explore';
  const list = S.R.filter(r => (explore ? !S.mine.includes(r.id) : S.mine.includes(r.id)) && (S.filter.length === 0 || r.tipos.some(t => S.filter.includes(t))) && (!S.onlyTanda || r.tanda));
  const el = $('#recipe-list');
  if (!list.length) { el.innerHTML = `<div class="empty">${explore ? 'No hay más recetas con este filtro.' : 'Ninguna receta de tu recetario encaja. Añade más desde Explorar.'}</div>`; return; }
  if (!explore) { el.innerHTML = list.map(r => recipeCard(r, false)).join(''); return; }
  const groups = [['desayuno', 'Desayunos'], ['almuerzo', 'Almuerzos'], ['cena', 'Cenas'], ['bebida', 'Bebidas'], ['postre', 'Postres']];
  el.innerHTML = groups.map(([t, l]) => { const rs = list.filter(r => r.tipos[0] === t); return rs.length ? `<h2 style="font-size:17px;margin-top:6px">${l}</h2>` + rs.map(r => recipeCard(r, true)).join('') : ''; }).join('');
}

/* ---------- Render: semana, lista, despensa ---------- */
function renderSemana() {
  const s = shop(S.plan); const e = eq();
  $('#s-consumo').textContent = eur(s.consumo); $('#s-compra').textContent = eur(s.total); $('#s-sobra').textContent = eur(s.sobra);
  const el = $('#plan-list');
  if (!S.plan.length) { el.innerHTML = '<div class="empty">Tu semana está vacía. Añade platos con el botón + del recetario.</div>'; return; }
  el.innerHTML = S.plan.map(it => {
    const r = byId(it.rid); if (!r) return ''; const pr = perRacion(r, it.opc); const hasOpc = r.i.some(x => x[2]);
    return `<article class="card">
      <div class="card-head"><div><h3>${esc(r.n)}</h3><div class="small muted">${it.veces} ${it.veces === 1 ? 'plato' : 'platos'} · ${eur(pr)} y ${kcal(r, it.opc)} kcal por ración</div></div><span class="price">${eur(pr * it.veces * e)}</span></div>
      <div class="meta" style="align-items:center;gap:10px">
        ${it.cocinado ? `<span class="tag acc">Cocinado · quedan ${leftOf(it)}</span>` : `<span class="stepper"><button type="button" data-act="veces" data-k="${it.k}" data-d="-1" aria-label="Un plato menos">−</button><b>${it.veces}</b><button type="button" class="plus" data-act="veces" data-k="${it.k}" data-d="1" aria-label="Un plato más">+</button></span>
        ${hasOpc ? `<label class="toggle"><input type="checkbox" data-act="opc" data-k="${it.k}" ${it.opc ? 'checked' : ''}> Con ${esc(optNames(r).join(' y '))}</label>` : ''}`}
      </div>
      <div class="meta" style="gap:8px">
        ${it.cocinado ? '' : `<button type="button" class="btn small ghost" data-act="cook" data-k="${it.k}">Ya lo cociné</button>`}
        ${mealOf(r) ? `<button type="button" class="btn small" data-act="eat" data-k="${it.k}">Comí 1</button>` : ''}
        <button type="button" class="link" data-act="remove" data-k="${it.k}">Quitar</button>
      </div>
      ${haveLine(r, it)}
      ${howTo(r, 'p-' + it.k, it.veces, it.k)}
    </article>`;
  }).join('');
}
function renderLista() {
  const s = shop(S.plan); const el = $('#shop-list');
  if (!s.rows.length) { el.innerHTML = '<div class="empty" style="border:0">La lista se llena cuando añades platos a tu semana.</div>'; return; }
  el.innerHTML = s.rows.map((x, i) => {
    const done = x.packs === 0; const miss = x.need - x.have; const sub = done ? null : subText(x.n, miss);
    return `<div class="row ${done ? 'done' : ''}">
      <input type="checkbox" id="sl-${i}" data-act="have" data-n="${esc(x.n)}" data-need="${x.need}" ${done ? 'checked' : ''} aria-label="Ya lo tengo: ${esc(x.n)}">
      <label for="sl-${i}"><div class="n">${esc(x.n)}</div><div class="d">Necesitas ${fmtQ(x.need, x.p.u)}${x.have ? ` · en casa ${fmtQ(x.have, x.p.u)}` : ''}${x.packs ? ` · compra ${x.packs} × ${esc(x.p.f)}` : ' · no hace falta comprar'}</div>${sub ? `<div class="d" style="color:var(--ok)">Para ahorrar: ${sub}</div>` : ''}</label>
      <div class="p num">${x.p.t ? '' : '≈ '}${eur(x.cost)}</div></div>`;
  }).join('') + `<div class="foot"><span>Total a pagar</span><span class="num">≈ ${eur(s.total)}</span></div>`;
}
function renderDespensa() {
  const items = Object.entries(S.stock).filter(([n, q]) => S.P[n] && q > 0); const reserved = needs(S.plan);
  const sel = S.invSel && S.P[S.invSel] ? S.invSel : Object.keys(S.P)[0]; const sp = S.P[sel]; let total = 0;
  let html = `<div class="add-row"><select class="sel" id="inv-prod" aria-label="Producto">${S.CATS.map(c => `<optgroup label="${esc(c.name)}">${c.items.filter(n => S.P[n]).sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>
    <input class="qty" id="inv-qty" type="number" min="0" inputmode="decimal" value="${sp.u === 'ud' ? 1 : sp.q}" aria-label="Cantidad"><span class="muted small" id="inv-unit">${sp.u}</span>
    <button type="button" class="btn small" data-act="inv-add">Añadir</button></div>`;
  S.CATS.forEach((c, ci) => {
    const rows = items.filter(([n]) => catOf(n) === ci).sort((a, b) => a[0].localeCompare(b[0], 'es')); if (!rows.length) return;
    html += `<div class="inv-g"><i style="background:${['var(--accent)', 'var(--mid)', 'var(--ok)', 'var(--blue)', 'var(--warn)', 'var(--muted)'][ci % 6]}"></i>${esc(c.name)}</div>`;
    for (const [n, q] of rows) {
      const p = S.P[n]; const v = q * p.p / p.q; total += v; const rs = reserved.get(n);
      html += `<div class="inv-r"><span>${esc(n)}</span><span class="q"><input class="qty" type="number" min="0" inputmode="decimal" value="${r2(q)}" data-act="stock" data-n="${esc(n)}" aria-label="Cantidad de ${esc(n)}">${p.u}</span><span class="num small">${eur(v)}</span>${rs ? `<span class="res">Tu semana usa ${fmtQ(Math.min(q, rs), p.u)} · libre ${fmtQ(Math.max(0, q - rs), p.u)}${rs > q + 1e-6 ? ' · no alcanza' : ''}</span>` : ''}</div>`;
    }
  });
  html += `<div class="foot"><span>Valor en casa</span><span class="num">≈ ${eur(total)}</span></div>`;
  $('#inv-list').innerHTML = html;
}
function setView(v) {
  S.view = v;
  for (const b of document.querySelectorAll('.nav .tab')) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== 'v-' + v;
}
function render() { renderHeader(); renderRecetas(); renderSemana(); renderLista(); renderDespensa(); setView(S.view); save(); }

/* ---------- Acciones ---------- */
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
function eatOne(it) {
  const r = byId(it.rid); const t = mealOf(r);
  if (it.cocinado) it.comidos = (it.comidos || 0) + 1; else { deduct(r, 1, it.opc); it.veces -= 1; }
  if (t) S.eaten[t] = (S.eaten[t] || 0) + 1;
  if (leftOf(it) <= 0) S.plan = S.plan.filter(p => p !== it);
}
function cook(it) { const r = byId(it.rid); deduct(r, it.veces, it.opc); it.cocinado = true; it.comidos = it.comidos || 0; }

document.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.id === 'summary') { S.detailsOpen = !S.detailsOpen; renderHeader(); save(); return; }
  if (b.id === 'btn-settings') return openSettings();
  if (b.id === 'btn-scan') return openScan();
  if (b.id === 'btn-ai') return openAI();
  if (b.dataset.view) { setView(b.dataset.view); save(); window.scrollTo({ top: 0 }); return; }
  if (b.id === 'seg-mine' || b.id === 'seg-explore') { S.seg = b.id === 'seg-mine' ? 'mine' : 'explore'; render(); return; }
  const a = b.dataset.act; if (!a) return;
  const it = b.dataset.k !== undefined ? S.plan.find(p => String(p.k) === b.dataset.k) : null;
  if (a === 'filter') { const f = b.dataset.f; S.filter = f === '' ? [] : (S.filter.includes(f) ? S.filter.filter(x => x !== f) : S.filter.concat(f)); }
  else if (a === 'addone') S.plan.push({ k: S.seq++, rid: b.dataset.id, veces: 1, opc: false });
  else if (a === 'veces' && it) { const nv = Math.min(30, it.veces + Number(b.dataset.d)); if (nv < 1) S.plan = S.plan.filter(p => p !== it); else it.veces = nv; }
  else if (a === 'remove' && it) S.plan = S.plan.filter(p => p !== it);
  else if (a === 'cook' && it) { cook(it); toast('Cocinado: ' + byId(it.rid).n + '. Despensa actualizada'); }
  else if (a === 'eat' && it) { eatOne(it); toast('Anotado: 1 ración de ' + byId(it.rid).n); }
  else if (a === 'mine') { if (!S.mine.includes(b.dataset.id)) S.mine.push(b.dataset.id); toast(byId(b.dataset.id).n + ' añadida a tu recetario'); }
  else if (a === 'unmine') { S.mine = S.mine.filter(x => x !== b.dataset.id); toast(byId(b.dataset.id).n + ' movida a Explorar'); }
  else if (a === 'inv-add') { const n = $('#inv-prod').value; const q = Number($('#inv-qty').value) || 0; if (!S.P[n] || q <= 0) return toast('Indica una cantidad mayor que 0'); S.stock[n] = r2((S.stock[n] || 0) + q); S.invSel = n; toast(`Añadido: ${fmtQ(q, S.P[n].u)} de ${n}`); }
  else if (a === 'del-ticket') { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Borrar?'; return; } S.tickets = S.tickets.filter(t => t.id !== b.dataset.id); toast('Ticket borrado. La despensa no se ha tocado'); }
  else return;
  render();
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'only-tanda') S.onlyTanda = t.checked;
  else if (t.id === 'inv-prod') { S.invSel = t.value; const p = S.P[t.value]; $('#inv-unit').textContent = p.u; $('#inv-qty').value = p.u === 'ud' ? 1 : p.q; save(); return; }
  else if (t.dataset.act === 'opc') { const it = S.plan.find(p => String(p.k) === t.dataset.k); if (it) it.opc = t.checked; }
  else if (t.dataset.act === 'have') { const n = t.dataset.n; if (t.checked) S.stock[n] = Math.max(S.stock[n] || 0, Number(t.dataset.need)); else delete S.stock[n]; }
  else if (t.dataset.act === 'stock') { const n = t.dataset.n; const v = Math.max(0, Number(t.value) || 0); if (v > 0) S.stock[n] = v; else delete S.stock[n]; }
  else return;
  render();
});
document.addEventListener('toggle', ev => {
  const d = ev.target; if (!d.dataset || !d.dataset.how) return; const set = new Set(S.openHow); d.open ? set.add(d.dataset.how) : set.delete(d.dataset.how); S.openHow = [...set]; save();
}, true);

/* ---------- Ajustes ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
function openSettings() {
  const el = $('#settings-in');
  el.innerHTML = `
    <div class="sheet-head"><h2>Ajustes</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <div class="grid2">
      <label class="field">Presupuesto semanal (€)<input id="st-budget" type="number" min="0" inputmode="decimal" value="${S.budget}"></label>
      <label class="field">La semana empieza el<select id="st-week">${DAYS.map((d, i) => `<option value="${i}" ${i === S.weekStart ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field">Adultos<input id="st-adults" type="number" min="1" max="8" value="${S.adults}"></label>
      <label class="field">Niños (½ ración)<input id="st-kids" type="number" min="0" max="8" value="${S.kids}"></label>
    </div>
    <p class="small muted" style="margin:0">Comidas a cubrir por semana</p>
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">${MEALS.map(([k, l]) => `<label class="field">${l}<input id="st-t-${k}" type="number" min="0" max="21" value="${S.target[k]}"></label>`).join('')}</div>
    <h3 style="font-size:16px;margin-top:6px">Inteligencia artificial</h3>
    <label class="field">Clave de API de Anthropic<input id="st-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(S.apiKey)}"></label>
    <label class="field">Modelo<select id="st-model">${MODELS.map(([v, l]) => `<option value="${v}" ${v === S.model ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="small muted" style="margin:0">La clave se guarda solo en este móvil. Pon un límite de gasto mensual en console.anthropic.com.</p>
    <h3 style="font-size:16px;margin-top:6px">Tus datos</h3>
    <div class="grid2">
      <button type="button" class="btn ghost" id="st-export">Exportar copia</button>
      <button type="button" class="btn ghost" id="st-import">Importar copia</button>
    </div>
    ${installEvt ? '<button type="button" class="btn wide" id="st-install">Instalar en el móvil</button>' : ''}
    <button type="button" class="btn wide" id="st-save">Guardar</button>
    <button type="button" class="link" id="st-reset" style="justify-self:center">Borrar todos los datos</button>
    <p class="muted small" style="text-align:center;margin:0">Versión ${VERSION}</p>`;
  $('#dlg-settings').showModal();
}
$('#dlg-settings').addEventListener('click', async ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.close !== undefined) return $('#dlg-settings').close();
  if (b.id === 'st-save') {
    S.budget = Math.max(0, Number($('#st-budget').value) || 0); S.weekStart = Number($('#st-week').value);
    S.adults = Math.max(1, Math.round(Number($('#st-adults').value) || 1)); S.kids = Math.max(0, Math.round(Number($('#st-kids').value) || 0));
    for (const [k] of MEALS) S.target[k] = Math.max(0, Math.round(Number($('#st-t-' + k).value) || 0));
    S.apiKey = $('#st-key').value.trim(); S.model = $('#st-model').value;
    $('#dlg-settings').close(); render(); toast('Ajustes guardados');
  } else if (b.id === 'st-export') {
    const data = { ...S, apiKey: '' }; const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tandas-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia descargada (sin tu clave de API)');
  } else if (b.id === 'st-import') $('#file-backup').click();
  else if (b.id === 'st-install' && installEvt) { installEvt.prompt(); installEvt = null; }
  else if (b.id === 'st-reset') {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Pulsa otra vez para borrarlo todo'; return; }
    localStorage.removeItem(KEY); S = load(); S.apiKey = ''; $('#dlg-settings').close(); render(); toast('Datos borrados');
  }
});
$('#file-backup').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d.P || !d.R || !d.stock) throw new Error(); const key = S.apiKey; localStorage.setItem(KEY, JSON.stringify(d)); S = load(); S.apiKey = key; $('#dlg-settings').close(); render(); toast('Copia importada'); }
  catch (e) { toast('Ese archivo no es una copia válida de Tandas'); }
});

/* ---------- IA: llamada a la API ---------- */
async function claude(body) {
  if (!S.apiKey) throw new Error('Falta la clave de API. Añádela en Ajustes.');
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: S.model, max_tokens: 2000, ...body })
    });
  } catch (e) { throw new Error('Sin conexión con la IA. Revisa tu internet.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data && data.error && data.error.message || '';
    if (res.status === 401) throw new Error('La clave de API no es válida. Revísala en Ajustes.');
    if (res.status === 429) throw new Error('Demasiadas peticiones o límite de gasto alcanzado. Prueba en un rato.');
    if (res.status === 404 && /model/i.test(m)) throw new Error('El modelo elegido no está disponible. Cambia de modelo en Ajustes.');
    console.error('API', res.status, m);
    if (res.status >= 500 || res.status === 529) throw new Error('La IA está saturada ahora mismo. Prueba en un minuto.');
    throw new Error('No he podido responder esta vez. Vuelve a intentarlo.');
  }
  return data;
}
function catalogText() { return Object.entries(S.P).map(([n, p]) => `${n} | ${p.u} | ${p.f} (${p.q} ${p.u})`).join('\n'); }

/* ---------- Escanear ticket ---------- */
let RV = null;
function openScan() {
  $('#scan-in').innerHTML = `
    <div class="sheet-head"><h2>Escanear ticket</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <p class="lead">Haz una foto al ticket o elige una de la galería. ${S.apiKey ? 'La IA lo leerá y podrás revisarlo antes de guardar.' : 'Para leerlo automáticamente añade tu clave de API en Ajustes; mientras, puedes apuntarlo a mano.'}</p>
    <button type="button" class="btn wide" id="sc-cam">Hacer foto</button>
    <button type="button" class="btn ghost wide" id="sc-gal">Elegir de la galería</button>
    <button type="button" class="link" id="sc-manual" style="justify-self:center">Apuntarlo a mano</button>`;
  $('#dlg-scan').showModal();
}
async function fileToJpeg(file) {
  const img = await createImageBitmap(file); const max = 1600; const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
async function readTicket(file) {
  $('#scan-in').innerHTML = `<div class="sheet-head"><h2>Leyendo el ticket…</h2></div><p class="lead" style="display:flex;gap:10px;align-items:center"><span class="spinner"></span>Esto tarda unos segundos.</p>`;
  try {
    const b64 = await fileToJpeg(file);
    const plan = [...needs(S.plan).keys()];
    const tool = {
      name: 'registrar_ticket', description: 'Registra las líneas de un ticket de compra de supermercado.',
      input_schema: {
        type: 'object', required: ['tienda', 'fecha', 'total', 'lineas'], properties: {
          tienda: { type: 'string' }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, total: { type: 'number', description: 'Total pagado en euros' },
          lineas: {
            type: 'array', items: {
              type: 'object', required: ['desc', 'uds', 'importe', 'producto', 'cantidad_inventario', 'tipo'], properties: {
                desc: { type: 'string', description: 'Texto de la línea tal como aparece' },
                uds: { type: 'number', description: 'Unidades o paquetes comprados' },
                importe: { type: 'number', description: 'Importe total de la línea en euros' },
                producto: { type: ['string', 'null'], description: 'Nombre EXACTO del catálogo o null si no encaja' },
                cantidad_inventario: { type: 'number', description: 'Cantidad que entra a la despensa en la unidad del producto del catálogo (g, ml o ud). 0 si producto es null' },
                tipo: { type: 'string', enum: ['De la lista', 'Extra'] },
                grupo: { type: ['string', 'null'], enum: EXTRA_GROUPS.concat([null]) }
              }
            }
          }
        }
      }
    };
    const prompt = `Lee este ticket. Hoy es ${new Date().toISOString().slice(0, 10)}.
Catálogo de productos (nombre | unidad | formato):
${catalogText()}

Equivalencias aprendidas (texto del ticket → producto): ${JSON.stringify(S.alias)}
Productos que hacen falta para el menú de la semana: ${plan.join(', ') || 'ninguno'}

Reglas:
- Una línea por producto del ticket; ignora IVA, tarjeta y totales parciales. Si el ticket está en otra moneda, usa el importe en euros.
- producto: el nombre exacto del catálogo si es claramente ese producto; si no, null.
- cantidad_inventario: uds × tamaño del formato del catálogo, en su unidad (ejemplo: 2 paquetes de quinoa de 250 g = 500). Para fruta al peso usa el peso o las unidades según la unidad del catálogo.
- tipo: "De la lista" si es comida básica de cocinar o un producto del catálogo usado en recetas; "Extra" si es dulce, capricho, snack o bebida no planificada. Si es Extra, elige grupo.`;
    const data = await claude({ tools: [tool], tool_choice: { type: 'tool', name: 'registrar_ticket' }, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] });
    const tu = (data.content || []).find(c => c.type === 'tool_use'); if (!tu) throw new Error('La IA no devolvió el ticket. Prueba con otra foto.');
    const x = tu.input;
    RV = { tienda: x.tienda || '', fecha: (x.fecha || '').slice(0, 10) || new Date().toISOString().slice(0, 10), total: Number(x.total) || 0, lineas: (x.lineas || []).map(l => ({ desc: l.desc || '', uds: Number(l.uds) || 1, importe: Number(l.importe) || 0, producto: S.P[l.producto] ? l.producto : '', inv: Number(l.cantidad_inventario) || 0, tipo: l.tipo === 'Extra' ? 'Extra' : 'De la lista', grupo: l.grupo || 'Otros' })) };
    renderReview();
  } catch (e) {
    $('#scan-in').innerHTML = `<div class="sheet-head"><h2>No se pudo leer</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div><div class="check bad">${esc(e.message)}</div><button type="button" class="btn ghost wide" id="sc-manual">Apuntarlo a mano</button>`;
  }
}
function prodOptions(sel) { return `<option value="">— Solo gasto —</option><option value="__new">＋ Crear producto nuevo</option>` + Object.keys(S.P).sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join(''); }
function renderReview() {
  const sum = RV.lineas.reduce((a, l) => a + (Number(l.importe) || 0), 0); const diff = r2(RV.total - sum);
  $('#scan-in').innerHTML = `
    <div class="sheet-head"><h2>Revisa el ticket</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <div class="grid2"><label class="field">Tienda<input data-rv="tienda" value="${esc(RV.tienda)}"></label><label class="field">Fecha<input type="date" data-rv="fecha" value="${esc(RV.fecha)}"></label></div>
    <label class="field">Total pagado (€)<input type="number" step="0.01" inputmode="decimal" data-rv="total" value="${RV.total}"></label>
    <div class="check ${Math.abs(diff) < 0.02 ? 'ok' : 'bad'}">${Math.abs(diff) < 0.02 ? `✓ Las líneas suman ${eur(sum)}, cuadra con el total` : `Las líneas suman ${eur(sum)}; diferencia de ${eur(diff)} con el total`}</div>
    ${RV.lineas.map((l, i) => { const p = S.P[l.producto]; return `<div class="rv">
      <div class="rv-top"><input data-i="${i}" data-f="desc" value="${esc(l.desc)}" aria-label="Descripción"><button type="button" class="icon-btn" data-rvdel="${i}" aria-label="Quitar línea" style="width:36px;height:36px">✕</button></div>
      <div class="rv-grid">
        <label>Producto<select data-i="${i}" data-f="producto">${prodOptions(l.producto)}</select></label>
        <label>Importe (€)<input type="number" step="0.01" inputmode="decimal" data-i="${i}" data-f="importe" value="${l.importe}"></label>
        <label>Unidades<input type="number" min="0" step="1" data-i="${i}" data-f="uds" value="${l.uds}"></label>
        <label>A la despensa (${p ? p.u : '—'})<input type="number" min="0" inputmode="decimal" data-i="${i}" data-f="inv" value="${l.inv}" ${p ? '' : 'disabled'}></label>
        <label>Tipo<select data-i="${i}" data-f="tipo"><option ${l.tipo === 'De la lista' ? 'selected' : ''}>De la lista</option><option ${l.tipo === 'Extra' ? 'selected' : ''}>Extra</option></select></label>
        ${l.tipo === 'Extra' ? `<label>Grupo<select data-i="${i}" data-f="grupo">${EXTRA_GROUPS.map(g => `<option ${g === l.grupo ? 'selected' : ''}>${g}</option>`).join('')}</select></label>` : ''}
      </div></div>`; }).join('')}
    <button type="button" class="btn ghost wide" id="rv-add">+ Añadir línea</button>
    <button type="button" class="btn wide" id="rv-save">Guardar ticket y actualizar despensa</button>`;
}
function saveReview() {
  const id = 't' + Date.now(); const lineas = [];
  for (const l of RV.lineas) {
    if (!l.desc && !l.importe) continue;
    let prod = l.producto || null;
    if (prod === '__new') {
      prod = l.desc.trim().toLowerCase().replace(/^./, c => c.toUpperCase());
      if (!S.P[prod]) { S.P[prod] = { f: 'Unidad', p: r2((l.importe || 0) / (l.uds || 1)), q: 1, u: 'ud', t: 1 }; S.CATS[S.CATS.length - 1].items.push(prod); }
      l.inv = l.inv || l.uds || 1;
    }
    if (prod && S.P[prod]) {
      if (l.inv > 0) S.stock[prod] = r2((S.stock[prod] || 0) + Number(l.inv));
      if (l.uds > 0 && l.importe > 0 && S.P[prod].q && l.inv > 0) { const packs = l.inv / S.P[prod].q; if (packs > 0) { S.P[prod].p = r2(l.importe / packs); S.P[prod].t = 1; } }
      S.alias[l.desc.toUpperCase()] = prod;
    }
    lineas.push({ desc: l.desc, producto: prod, uds: Number(l.uds) || 1, importe: r2(Number(l.importe) || 0), tipo: l.tipo, grupo: l.tipo === 'Extra' ? l.grupo : null });
  }
  S.tickets.push({ id, fecha: RV.fecha, tienda: RV.tienda || 'Tienda', total: r2(Number(RV.total) || lineas.reduce((a, l) => a + l.importe, 0)), lineas });
  RV = null; $('#dlg-scan').close(); render(); toast('Ticket guardado. Despensa y presupuesto actualizados');
}
$('#dlg-scan').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.close !== undefined) { RV = null; return $('#dlg-scan').close(); }
  if (b.id === 'sc-cam') $('#file-cam').click();
  else if (b.id === 'sc-gal') $('#file-gal').click();
  else if (b.id === 'sc-manual') { RV = { tienda: '', fecha: new Date().toISOString().slice(0, 10), total: 0, lineas: [{ desc: '', uds: 1, importe: 0, producto: '', inv: 0, tipo: 'De la lista', grupo: 'Otros' }] }; renderReview(); }
  else if (b.dataset.rvdel !== undefined) { RV.lineas.splice(Number(b.dataset.rvdel), 1); renderReview(); }
  else if (b.id === 'rv-add') { RV.lineas.push({ desc: '', uds: 1, importe: 0, producto: '', inv: 0, tipo: 'De la lista', grupo: 'Otros' }); renderReview(); }
  else if (b.id === 'rv-save') saveReview();
});
$('#dlg-scan').addEventListener('change', ev => {
  const t = ev.target; if (!RV) return;
  if (t.dataset.rv) { RV[t.dataset.rv] = t.dataset.rv === 'total' ? Number(t.value) || 0 : t.value; if (t.dataset.rv === 'total') renderReview(); return; }
  if (t.dataset.i === undefined) return;
  const l = RV.lineas[Number(t.dataset.i)]; const f = t.dataset.f; const num = ['importe', 'uds', 'inv'].includes(f);
  l[f] = num ? Number(t.value) || 0 : t.value;
  if (f === 'producto' && S.P[l.producto]) l.inv = (l.uds || 1) * S.P[l.producto].q;
  if (f === 'uds' && S.P[l.producto]) l.inv = (l.uds || 1) * S.P[l.producto].q;
  if (['producto', 'tipo', 'importe', 'uds'].includes(f)) renderReview();
});
for (const id of ['#file-cam', '#file-gal']) $(id).addEventListener('change', ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (!S.apiKey) { RV = { tienda: '', fecha: new Date().toISOString().slice(0, 10), total: 0, lineas: [{ desc: '', uds: 1, importe: 0, producto: '', inv: 0, tipo: 'De la lista', grupo: 'Otros' }] }; renderReview(); toast('Sin clave de API: apúntalo a mano'); return; }
  readTicket(f);
});

/* ---------- Asistente ---------- */
const AI_TOOLS = [
  { name: 'ajustar_despensa', description: 'Cambia la cantidad de un producto de la despensa.', input_schema: { type: 'object', required: ['producto', 'cantidad', 'modo'], properties: { producto: { type: 'string', description: 'Nombre exacto del catálogo' }, cantidad: { type: 'number', description: 'En la unidad del producto (g, ml o ud)' }, modo: { type: 'string', enum: ['sumar', 'restar', 'fijar'] } } } },
  { name: 'crear_producto', description: 'Crea un producto nuevo en el catálogo.', input_schema: { type: 'object', required: ['nombre', 'unidad', 'formato', 'precio', 'cantidad_formato', 'categoria'], properties: { nombre: { type: 'string' }, unidad: { type: 'string', enum: ['g', 'ml', 'ud'] }, formato: { type: 'string', description: 'Ej.: Paquete 500 g' }, precio: { type: 'number', description: 'Precio del formato en euros' }, cantidad_formato: { type: 'number' }, categoria: { type: 'string' }, cantidad_en_casa: { type: 'number' } } } },
  { name: 'anadir_a_semana', description: 'Añade platos de una receta al menú de la semana.', input_schema: { type: 'object', required: ['receta_id', 'platos'], properties: { receta_id: { type: 'string' }, platos: { type: 'integer', minimum: 1 } } } },
  { name: 'quitar_de_semana', description: 'Quita una receta del menú de la semana.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' } } } },
  { name: 'anotar_comida', description: 'Anota que el usuario se comió raciones de una receta. Descuenta de lo cocinado o, si era al momento, de la despensa.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' }, raciones: { type: 'integer', minimum: 1 } } } },
  { name: 'marcar_cocinado', description: 'Marca como cocinada la tanda de una receta de la semana y descuenta sus ingredientes.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' } } } },
  { name: 'cambiar_presupuesto', description: 'Cambia el presupuesto semanal.', input_schema: { type: 'object', required: ['euros'], properties: { euros: { type: 'number' } } } },
  { name: 'gestionar_recetario', description: 'Añade o quita una receta de "Mi recetario".', input_schema: { type: 'object', required: ['receta_id', 'accion'], properties: { receta_id: { type: 'string' }, accion: { type: 'string', enum: ['anadir', 'quitar'] } } } },
  { name: 'crear_receta', description: 'Crea una receta nueva con ingredientes del catálogo y la añade a Mi recetario.', input_schema: { type: 'object', required: ['nombre', 'tipos', 'raciones', 'apta_tanda', 'ingredientes', 'pasos'], properties: { nombre: { type: 'string' }, tipos: { type: 'array', items: { type: 'string', enum: ['desayuno', 'almuerzo', 'cena', 'postre', 'bebida'] } }, raciones: { type: 'integer', minimum: 1 }, apta_tanda: { type: 'boolean' }, ingredientes: { type: 'array', items: { type: 'object', required: ['producto', 'cantidad'], properties: { producto: { type: 'string' }, cantidad: { type: 'number', description: 'Para toda la receta, en la unidad del producto' }, opcional: { type: 'boolean' }, kcal_por_unidad: { type: 'number' } } } }, pasos: { type: 'array', items: { type: 'string' } } } } }
];
function runTool(name, x) {
  const findR = id => byId(id) || S.R.find(r => r.n.toLowerCase() === String(id).toLowerCase());
  if (name === 'ajustar_despensa') {
    const p = S.P[x.producto]; if (!p) return `Error: "${x.producto}" no está en el catálogo.`;
    const cur = S.stock[x.producto] || 0; const v = x.modo === 'sumar' ? cur + x.cantidad : x.modo === 'restar' ? cur - x.cantidad : x.cantidad;
    if (v > 1e-6) S.stock[x.producto] = r2(v); else delete S.stock[x.producto];
    return `OK. ${x.producto}: ${fmtQ(Math.max(0, v), p.u)} en casa.`;
  }
  if (name === 'crear_producto') {
    if (S.P[x.nombre]) return `Ya existe "${x.nombre}".`;
    S.P[x.nombre] = { f: x.formato, p: r2(x.precio), q: x.cantidad_formato || 1, u: x.unidad, t: 0 };
    const ci = S.CATS.findIndex(c => c.name.toLowerCase() === String(x.categoria).toLowerCase()); (S.CATS[ci >= 0 ? ci : S.CATS.length - 1]).items.push(x.nombre);
    if (x.cantidad_en_casa > 0) S.stock[x.nombre] = x.cantidad_en_casa;
    return `OK. Producto "${x.nombre}" creado.`;
  }
  if (name === 'anadir_a_semana') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; const it = S.plan.find(p => p.rid === r.id && !p.cocinado); if (it) it.veces += x.platos; else S.plan.push({ k: S.seq++, rid: r.id, veces: x.platos, opc: false }); if (!S.mine.includes(r.id)) S.mine.push(r.id); return `OK. ${r.n}: +${x.platos} platos en la semana.`; }
  if (name === 'quitar_de_semana') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; S.plan = S.plan.filter(p => p.rid !== r.id); return `OK. ${r.n} quitada de la semana.`; }
  if (name === 'anotar_comida') {
    const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; const n = x.raciones || 1;
    for (let i = 0; i < n; i++) { const it = S.plan.find(p => p.rid === r.id); if (it) eatOne(it); else { deduct(r, 1, false); const t = mealOf(r); if (t) S.eaten[t] = (S.eaten[t] || 0) + 1; } }
    return `OK. Anotadas ${n} raciones de ${r.n}.`;
  }
  if (name === 'marcar_cocinado') { const r = findR(x.receta_id); const it = r && S.plan.find(p => p.rid === r.id && !p.cocinado); if (!it) return 'Error: esa receta no está pendiente en la semana.'; cook(it); return `OK. ${r.n} cocinado; despensa descontada.`; }
  if (name === 'cambiar_presupuesto') { S.budget = Math.max(0, x.euros); return `OK. Presupuesto: ${eur(S.budget)}.`; }
  if (name === 'gestionar_recetario') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; if (x.accion === 'anadir') { if (!S.mine.includes(r.id)) S.mine.push(r.id); } else S.mine = S.mine.filter(i => i !== r.id); return `OK. ${r.n} ${x.accion === 'anadir' ? 'añadida a' : 'quitada de'} Mi recetario.`; }
  if (name === 'crear_receta') {
    const bad = x.ingredientes.filter(g => !S.P[g.producto]).map(g => g.producto); if (bad.length) return `Error: estos productos no existen en el catálogo: ${bad.join(', ')}. Créalos primero con crear_producto.`;
    let id = x.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'receta'; while (byId(id)) id += '-2';
    S.R.push({ id, n: x.nombre, tipos: x.tipos, rac: x.raciones, tanda: x.apta_tanda ? 1 : 0, i: x.ingredientes.map(g => g.opcional ? [g.producto, g.cantidad, 1] : [g.producto, g.cantidad]) });
    for (const g of x.ingredientes) if (g.kcal_por_unidad && S.K[g.producto] === undefined) S.K[g.producto] = g.kcal_por_unidad;
    S.STEPS[id] = x.pasos; S.mine.push(id); return `OK. Receta "${x.nombre}" creada con id ${id}.`;
  }
  return 'Herramienta desconocida.';
}
function aiContext() {
  const stock = Object.entries(S.stock).map(([n, q]) => `${n}: ${fmtQ(q, S.P[n] ? S.P[n].u : 'ud')}`).join('; ');
  const plan = S.plan.map(p => `${byId(p.rid).n} [${p.rid}] ×${p.veces}${p.cocinado ? ` (cocinado, quedan ${leftOf(p)})` : ''}`).join('; ') || 'vacío';
  const recs = S.R.map(r => `${r.id}: ${r.n} (${r.tipos.join('/')}${S.mine.includes(r.id) ? ', en Mi recetario' : ''})`).join('\n');
  const si = spentInfo(); const pend = shop(S.plan).total;
  return `Eres el asistente de la app Tandas: llevas la despensa, el menú y el gasto en comida de Sebas, que vive en Jaén.
Cómo hablas:
- Como un colega español que le echa una mano en la cocina: natural, cercano, de tú. Nada de tono de robot ni de atención al cliente.
- Corto: una o dos frases. Si hiciste un cambio, di qué cambiaste y cuánto queda, y ya. Ejemplo: "Hecho, te quedan 190 g de champiñones y he quitado un poco de mostaza y de barbacoa."
- Texto plano. Prohibido usar asteriscos, almohadillas, negritas, listas con guiones, emojis o tablas: la app no los muestra bien.
- No empieces con "¡Claro!", "¡Perfecto!", "Entendido" ni similares, no repitas lo que te ha dicho, no expliques qué herramientas usas y no ofrezcas más ayuda al final.
- Si algo es ambiguo, haz la suposición más razonable (por ejemplo, "un poco" de una salsa son unos 10 g) y menciónala de pasada.
Usa siempre los nombres exactos del catálogo y los id de receta en las herramientas, pero al hablar usa nombres normales.
Hoy: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
Presupuesto semanal: ${eur(S.budget)}. Gastado esta semana: ${eur(si.spent)} (extras ${eur(si.extras)}). Falta comprar para el menú: ${eur(pend)}. Comensales: ${S.adults} adultos, ${S.kids} niños.
Despensa: ${stock || 'vacía'}.
Menú de la semana: ${plan}.
Catálogo (nombre | unidad | formato):
${catalogText()}
Recetas (id: nombre):
${recs}`;
}
function renderAI(busy) {
  const msgs = S.chat.slice(-40);
  $('#ai-in').innerHTML = `
    <div class="sheet-head"><h2>Asistente</h2><div class="head-actions">${msgs.length ? '<button type="button" class="btn ghost small" data-clear>Borrar chat</button>' : ''}<button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div></div>
    ${S.apiKey ? '' : '<div class="check bad">Añade tu clave de API en Ajustes para usar el asistente.</div>'}
    <div class="chat" id="chat" aria-live="polite">${msgs.length ? msgs.filter(m => !isErr(m)).map(m => `<div class="msg ${m.r}">${esc(m.r === 'a' ? plain(m.t) : m.t)}</div>`).join('') : '<div class="msg a">Hola, Sebas. Dime qué has comido, qué te sobró o qué quieres cocinar y lo apunto por ti.</div>'}${busy ? '<div class="msg a"><span class="spinner"></span></div>' : ''}</div>
    <div class="sugs">${['Me comí 2 griegos de limón', '¿Qué ceno hoy con lo que tengo?', 'Sobró medio paquete de queso rallado', 'Añade 3 tomates a la despensa'].map(s => `<button type="button" class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="chat-in" id="chat-form"><input id="chat-text" autocomplete="off" placeholder="Escribe aquí…" aria-label="Mensaje"><button type="submit" class="btn" ${busy ? 'disabled' : ''}>Enviar</button></form>`;
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
}
function plain(t) { return t.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/\n{3,}/g, '\n\n').trim(); }
function isErr(m) { return m.r === 'a' && /^La IA respondió con un error/.test(m.t); }
function openAI() { renderAI(false); $('#dlg-ai').showModal(); }
let aiBusy = false;
async function sendAI(text) {
  if (!text.trim() || aiBusy) return;
  S.chat.push({ r: 'u', t: text.trim() }); aiBusy = true; renderAI(true); save();
  const history = [];
  for (const m of S.chat.filter(m => (m.r === 'u' || m.r === 'a') && !isErr(m)).slice(-12)) {
    const role = m.r === 'u' ? 'user' : 'assistant'; const last = history[history.length - 1];
    if (last && last.role === role) last.content += '\n' + m.t; else history.push({ role, content: m.t });
  }
  while (history.length && history[0].role !== 'user') history.shift();
  try {
    const messages = history; let loops = 0;
    const system = aiContext(); // fijo durante toda la respuesta: si cambia, la API rechaza los bloques de razonamiento
    while (loops++ < 6) {
      let data;
      try { data = await claude({ system, tools: AI_TOOLS, messages }); }
      catch (e) {
        if (!/thinking|signature/i.test(e.message)) throw e;
        for (const m of messages) if (Array.isArray(m.content)) m.content = m.content.filter(c => c.type !== 'thinking' && c.type !== 'redacted_thinking');
        data = await claude({ system, tools: AI_TOOLS, messages });
      }
      const content = data.content || []; const uses = content.filter(c => c.type === 'tool_use');
      const txt = content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (!uses.length) { if (txt) S.chat.push({ r: 'a', t: txt }); break; }
      messages.push({ role: 'assistant', content });
      const results = uses.map(u => { let out; try { out = runTool(u.name, u.input || {}); } catch (e) { out = 'Error: ' + e.message; } if (out.startsWith('OK')) S.chat.push({ r: 't', t: '✓ ' + out.slice(4) }); return { type: 'tool_result', tool_use_id: u.id, content: out }; });
      messages.push({ role: 'user', content: results });
      render();
    }
  } catch (e) { S.chat.push({ r: 'e', t: e.message }); }
  aiBusy = false; render(); renderAI(false);
}
$('#dlg-ai').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.close !== undefined) return $('#dlg-ai').close();
  if (b.dataset.clear !== undefined) { S.chat = []; save(); return renderAI(false); }
  if (b.dataset.sug) sendAI(b.dataset.sug);
});
$('#dlg-ai').addEventListener('submit', ev => { ev.preventDefault(); const i = $('#chat-text'); const v = i.value; i.value = ''; sendAI(v); });
for (const d of ['#dlg-settings', '#dlg-scan', '#dlg-ai']) $(d).addEventListener('click', ev => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

/* ---------- Arranque ---------- */
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
