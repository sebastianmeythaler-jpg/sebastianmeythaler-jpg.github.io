'use strict';
/* Tandas · app de cocina por tandas, despensa y gasto por ración.
   Todo se guarda en este dispositivo (localStorage). La IA usa la clave de API del usuario. */

const KEY = 'tandas-v1';
const VERSION = '2.0 · 4 nov';
// Servidor intermedio que paga la IA para los invitados (Cloudflare Worker). Vacío = solo clave propia.
const PROXY = 'https://tandas.sebastian-meythaler.workers.dev/';
// Clave pública para las notificaciones push (la privada solo está en el servidor)
const VAPID_PUBLIC = 'BK6wCotgiH0r1SD907MJtCYOtXbIHCXuTNfP3VEgr3F-W3zLJC3G6pTVGyqG_AW1JU_BxZOogqmggS4El7cRorA';
const aiReady = () => !!(S.apiKey || (PROXY && S.code));
const MODELS = [['claude-sonnet-5-5', 'Sonnet (más preciso, recomendado)'], ['claude-haiku-5-5', 'Haiku (más rápido y económico)']];
const EXTRA_GROUPS = ['Dulces y antojos', 'Desayunos', 'Fiambres para clase', 'Salsas', 'Bebidas', 'Otros'];
const MEALS = [['desayuno', 'Desayunos', 'var(--mid)'], ['almuerzo', 'Almuerzos', 'var(--accent)'], ['cena', 'Cenas', 'var(--blue)']];
const FILTERS = [['desayuno', 'Desayuno'], ['almuerzo', 'Almuerzo'], ['cena', 'Cena'], ['snack', 'Snacks'], ['postre', 'Postre'], ['bebida', 'Bebidas']];
// Especias y sazonadores: se cuentan por botes (ud), no por gramos, y no se descuentan al cocinar
const CONS_DEFAULT = ['Sal de ajo', 'Pimienta negra', 'Ajo en polvo', 'Cebolla en polvo', 'Comino molido', 'Pimentón dulce', 'Pimentón de la Vera dulce', 'Cayena', 'Romero', 'Cúrcuma', 'Albahaca'];
const CONS_DAYS = 28;
const NEWCATS = [
  ['Proteínas', ['Pechuga de pollo', 'Pavo en tacos', 'Carne de cerdo picada', 'Salchichas', 'Morcilla de arroz', 'Tocino / bacon', 'Salami en lonchas', 'Chorizo en lonchas', 'Jamón cocido', 'Jamón serrano']],
  ['Lácteos y huevos', ['Huevos L', 'Leche desnatada', 'Queso en lonchas', 'Queso rallado', 'Griego de limón']],
  ['Pan y tortillas', ['Pan campesino', 'Pan de hamburguesa', 'Pan de molde integral', 'Tortillas de avena', 'Mini tortillas']],
  ['Pasta, cereales y legumbres', ['Quinoa', 'Pasta integral', 'Macarrones', 'Copos de avena', 'Lentejas', 'Garbanzos cocidos', 'Alubias rojas cocidas']],
  ['Verduras', ['Cebolla', 'Tomate', 'Champiñones', 'Aguacate']],
  ['Frutas', ['Plátano', 'Limón', 'Naranja', 'Frutas congeladas']],
  ['Salsas', ['Salsa allioli', 'Salsa barbacoa', 'Mostaza', 'Kétchup', 'Tomate frito', 'Salsa sweet chili', 'Salsa de soja']],
  ['Especias y condimentos', CONS_DEFAULT.slice()],
  ['Aceites y básicos', ['Aceite de oliva', 'Aceite de girasol', 'Harina de trigo', 'Azúcar', 'Impulsor', 'Bicarbonato', 'Vinagre de manzana', 'Miel']],
  ['Dulces y snacks', ['Galletas de canela', 'Barritas para clase', 'Crema de cacao y avellana', 'Mermelada']],
  ['Bebidas', ['Café soluble']],
  ['Otros', []]
];
const OLDCATS = { 'Proteínas': 'Proteínas', 'Lácteos y huevos': 'Lácteos y huevos', 'Cereales, pan y legumbres': 'Pasta, cereales y legumbres', 'Salsas y condimentos': 'Salsas', 'Frutas y verduras': 'Verduras', 'Básicos': 'Aceites y básicos' };
const CAT_COLORS = ['var(--accent)', 'var(--mid)', 'var(--high)', 'var(--ok)', 'var(--ok)', 'var(--warn)', 'var(--blue)', 'var(--dim)', 'var(--muted)', 'var(--mid)', 'var(--blue)', 'var(--dim)'];
// Productos del hogar (no comestibles): van aparte de la comida y no cuentan en su presupuesto
const HCATS = ['Aseo personal', 'Limpieza', 'Cocina y hogar', 'Otros'];
const HSEED = {
  'Pasta de dientes': ['Aseo personal', 'Tubo 75 ml', 1.2], 'Cepillo de dientes': ['Aseo personal', 'Pack 2', 1.5], 'Champú': ['Aseo personal', 'Bote 400 ml', 1.5],
  'Gel de ducha': ['Aseo personal', 'Bote 750 ml', 1.3], 'Desodorante': ['Aseo personal', 'Spray 200 ml', 1.6], 'Papel higiénico': ['Aseo personal', 'Pack 12 rollos', 4.2],
  'Maquinillas de afeitar': ['Aseo personal', 'Pack 4', 2.5], 'Jabón de manos': ['Aseo personal', 'Dosificador 500 ml', 1.1],
  'Lavavajillas a mano': ['Limpieza', 'Botella 750 ml', 1.3], 'Estropajos y esponjas': ['Limpieza', 'Pack 3', 1], 'Detergente de ropa': ['Limpieza', 'Botella ~40 lavados', 5.5],
  'Suavizante': ['Limpieza', 'Botella ~60 lavados', 2], 'Lejía': ['Limpieza', 'Botella 2 L', 1.1], 'Limpiador multiusos': ['Limpieza', 'Spray 750 ml', 1.5], 'Fregasuelos': ['Limpieza', 'Botella 1,5 L', 1.6],
  'Fundas de basura': ['Cocina y hogar', 'Rollo 15 uds', 1.3], 'Papel de cocina': ['Cocina y hogar', 'Pack 2 rollos', 1.9], 'Papel de aluminio': ['Cocina y hogar', 'Rollo 30 m', 1.6],
  'Film transparente': ['Cocina y hogar', 'Rollo 30 m', 1.2], 'Servilletas': ['Cocina y hogar', 'Paquete 100 uds', 1], 'Bolsas de congelar': ['Cocina y hogar', 'Caja 30 uds', 1.4], 'Pilas': ['Otros', 'Pack 4', 3]
};
function ensureHome(s) {
  s.HP = s.HP || {}; s.hstock = s.hstock || {}; s.hwant = s.hwant || {}; s.homeCat = s.homeCat || '';
  for (const n in HSEED) if (!s.HP[n]) s.HP[n] = { cat: HSEED[n][0], f: HSEED[n][1], p: HSEED[n][2], t: 0 };
}
const THEMES = [['grafito', 'Grafito (oscuro)'], ['confianza', 'Confianza (azul, claro)'], ['fresco', 'Fresco (verde, claro)']];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REG = () => (window.REGIONS || {})[S && S.region] || { name: 'España', currency: 'EUR', locale: 'es-ES' };
const eur = v => (v || 0).toLocaleString(REG().locale, { style: 'currency', currency: REG().currency });
const SYM = () => REG().currency === 'USD' ? '$' : '€';
function applyRegion(code) {
  S.region = code; const R = (window.REGIONS[code] || {}).P;
  const base = window.SEED.P;
  for (const n in S.P) {
    const src = R && R[n] ? { f: R[n][0], p: R[n][1], q: R[n][2] } : base[n]; if (!src) continue;
    if (S.P[n].c) Object.assign(S.P[n], { f: src.f, p: src.p, g: src.c ? src.g : src.q, q: 1 }); else Object.assign(S.P[n], { f: src.f, p: src.p, q: src.q });
  }
}
const r2 = v => Math.round(v * 100) / 100;
const isC = n => !!(S.P[n] && S.P[n].c);
const ucost = p => p.c ? p.p / (p.g || 1) : p.p / p.q;           // precio por unidad de receta (g/ml para consumibles)
const rU = n => { const p = S.P[n]; return p ? (p.c ? (p.gu || 'g') : p.u) : 'ud'; };
function lastTicketDate(s, n) { let d = 0; for (const t of s.tickets || []) if ((t.lineas || []).some(l => l.producto === n)) d = Math.max(d, new Date(t.fecha + 'T12:00').getTime()); return d; }
function markCons(s) {
  s.since = s.since || {}; s.snz = s.snz || {}; s.want = s.want || {};
  for (const n of CONS_DEFAULT) {
    const p = s.P[n]; if (!p || p.c) continue;
    const g = p.u === 'ud' ? (p.g || 1) : p.q;
    Object.assign(p, { c: 1, g, gu: p.u === 'ml' ? 'ml' : 'g', u: 'ud', q: 1 });
    if ((s.stock || {})[n] > 0) s.stock[n] = Math.max(1, Math.ceil(s.stock[n] / g - 1e-9));
  }
  for (const n in s.P) if (s.P[n].c && (s.stock || {})[n] > 0 && !s.since[n]) s.since[n] = lastTicketDate(s, n) || Date.now();
}
function placeCats(s) {
  const inCat = new Set((s.CATS || []).flatMap(c => c.items));
  for (const n in s.P) {
    if (inCat.has(n)) continue;
    const want = s.P[n].c ? 'Especias y condimentos' : (s.P[n].cat || 'Otros');
    const c = s.CATS.find(x => x.name === want) || s.CATS.find(x => x.name === 'Otros') || s.CATS[s.CATS.length - 1];
    c.items.push(n); inCat.add(n);
  }
}
function buildCats(s) {
  const cats = NEWCATS.map(([name, items]) => ({ name, items: items.filter(n => s.P[n]) }));
  const known = new Set(cats.flatMap(c => c.items));
  for (const n in s.P) {
    if (known.has(n)) continue;
    const old = (s.CATS || []).find(c => c.items.includes(n)); const target = s.P[n].c ? 'Especias y condimentos' : s.P[n].cat && NEWCATS.some(c => c[0] === s.P[n].cat) ? s.P[n].cat : (old && (OLDCATS[old.name] || (NEWCATS.some(c => c[0] === old.name) ? old.name : null))) || 'Otros';
    cats.find(c => c.name === target).items.push(n); known.add(n);
  }
  s.CATS = cats; s.catsV = 2;
}

/* ---------- Estado ---------- */
let S = load(); S.rq = '';
function load() {
  const seed = JSON.parse(JSON.stringify(window.SEED));
  const LIB = window.LIBRARY || { P: {}, K: {}, R: [], STEPS: {} }; // 300 recetas en Explorar
  for (const k in LIB.P) if (!seed.P[k]) seed.P[k] = JSON.parse(JSON.stringify(LIB.P[k]));
  for (const k in LIB.K) if (seed.K[k] === undefined) seed.K[k] = LIB.K[k];
  for (const r of LIB.R) if (!seed.R.find(x => x.id === r.id)) seed.R.push(JSON.parse(JSON.stringify(r)));
  Object.assign(seed.STEPS, LIB.STEPS);
  const ui = { view: 'recetas', seg: 'explore', filter: [], onlyTanda: false, openHow: [], detailsOpen: false, apiKey: '', code: '', name: '', region: 'ES', theme: 'grafito', snacks: [], habits: [], modelV: 1, invCat: '', invSeg: 'food', enjoyPopup: true, log: [], remind: { on: false, desayuno: '09:00', almuerzo: '14:00', cena: '22:00', sent: {} }, model: MODELS[0][0], chat: [] };
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  markCons(seed); buildCats(seed); placeCats(seed); ensureHome(seed);
  if (!s) return Object.assign(seed, ui);
  const needCats = s.catsV !== 2; const needModel = !s.modelV;
  for (const k in ui) if (s[k] === undefined) s[k] = ui[k];
  s.remind = Object.assign({}, ui.remind, s.remind); s.remind.sent = s.remind.sent || {};
  for (const k in seed) if (s[k] === undefined) s[k] = seed[k];
  // Las versiones nuevas de la app añaden productos y recetas sin tocar lo tuyo
  for (const k in seed.P) if (!s.P[k]) s.P[k] = seed.P[k];
  for (const r of seed.R) if (!s.R.find(x => x.id === r.id)) s.R.push(r);
  for (const k in seed.STEPS) if (!s.STEPS[k]) s.STEPS[k] = seed.STEPS[k];
  for (const k in seed.K) if (s.K[k] === undefined) s.K[k] = seed.K[k];
  markCons(s); if (needCats) buildCats(s); placeCats(s); ensureHome(s);
  if (needModel) { s.model = 'claude-sonnet-5-5'; s.modelV = 1; }
  s.habits = s.habits || [];
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); if (S.remind && S.remind.on) mirrorState(); } catch (e) { toast('No se pudo guardar en este dispositivo'); } }

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
function perRacion(r, opc) { let c = 0; for (const [n, q, o] of r.i) { if (o && !opc) continue; const p = S.P[n]; if (p) c += (q / r.rac) * ucost(p); } return c; }
// Fuera de la vista por ahora: la app se centra en gasto, despensa y compra. Poner a true para volver a mostrar las calorías.
const SHOW_KCAL = false;
const kcalTxt = (r, opc) => SHOW_KCAL ? ` · ${kcal(r, opc)} kcal` : '';
function kcal(r, opc) { let k = 0; for (const [n, q, o] of r.i) { if (o && !opc) continue; k += (q / r.rac) * (S.K[n] || 0); } return Math.round(k / 10) * 10; }
function needs(plan) {
  const m = new Map(); const e = eq();
  for (const it of plan) {
    if (it.cocinado) continue; const r = byId(it.rid); if (!r) continue;
    for (const [n, q, o] of r.i) { if (o && !it.opc) continue; if (isC(n)) continue; m.set(n, (m.get(n) || 0) + q / r.rac * it.veces * e); }
  }
  return m;
}
function needsC(plan) {
  const set = new Set();
  for (const it of plan) { if (it.cocinado) continue; const r = byId(it.rid); if (!r) continue; for (const [n, , o] of r.i) if (isC(n) && (!o || it.opc)) set.add(n); }
  for (const n in S.want || {}) if (S.want[n] && S.P[n]) set.add(n);
  return set;
}
function consDue() {
  const now = Date.now();
  return Object.keys(S.P).filter(n => isC(n) && (S.stock[n] || 0) > 0 && S.since[n] && now - S.since[n] >= CONS_DAYS * 864e5 && !(S.snz[n] > now));
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
  for (const n of needsC(plan)) {
    const p = S.P[n]; if ((S.stock[n] || 0) > 0 && !S.want[n]) { rows.push({ n, need: 1, have: S.stock[n], packs: 0, cost: 0, p, cons: true }); continue; }
    total += p.p; consumo += p.p; rows.push({ n, need: 1, have: 0, packs: 1, cost: p.p, p, cons: true });
  }
  rows.sort((a, b) => (a.packs === 0) - (b.packs === 0) || b.cost - a.cost);
  return { rows, total, consumo, sobra };
}
function coverage(r, veces, opc, excludeK) {
  const e = eq(); const reserved = needs(S.plan.filter(p => p.k !== excludeK));
  return r.i.filter(([, , o]) => !o || opc).map(([n, q, o]) => {
    if (isC(n)) { const ok = (S.stock[n] || 0) > 0; return { n, need: 1, ok, miss: ok ? 0 : 1, o, c: true }; }
    const need = q / r.rac * veces * e; const avail = Math.max(0, (S.stock[n] || 0) - (reserved.get(n) || 0));
    return { n, need, ok: avail + 1e-6 >= need, miss: Math.max(0, need - avail), o };
  });
}
// ¿Se puede cocinar/comer `platos` de este plato con lo que hay en la despensa? (sustitutos válidos; especias no bloquean)
function canMake(it, platos) {
  const r = byId(it.rid); if (!r || !r.i.length) return true;
  return coverage(r, platos, it.opc, it.k).every(x => x.ok || x.c || subText(x.n, x.miss));
}
function maxMake(it, want) { let m = 0; while (m < want && canMake(it, m + 1)) m++; return m; }
function maxPlatos(r, opc, excludeK) {
  const reserved = needs(S.plan.filter(p => p.k !== excludeK)); const e = eq(); let m = Infinity;
  for (const [n, q, o] of r.i) { if (o && !opc) continue; if (isC(n)) continue; const per = q / r.rac * e; const avail = Math.max(0, (S.stock[n] || 0) - (reserved.get(n) || 0)); m = Math.min(m, Math.floor(avail / per + 1e-6)); }
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
  const canOne = r => r.i.length && r.i.every(([n, q, o]) => o || isC(n) || (st[n] || 0) + 1e-6 >= q / r.rac * e);
  const capOf = r => { let m = Infinity; for (const [n, q, o] of r.i) { if (o || isC(n)) continue; m = Math.min(m, (st[n] || 0) / (q / r.rac * e)); } return m; };
  let moved = true;
  while (moved) {
    moved = false;
    for (const t of ['almuerzo', 'cena', 'desayuno']) {
      if (cnt[t] >= target[t]) continue;
      const c = S.R.filter(r => S.mine.includes(r.id) && mealOf(r) === t && canOne(r)).sort((a, b) => capOf(b) - capOf(a))[0];
      if (!c) continue;
      for (const [n, q, o] of c.i) { if (!o && !isC(n)) st[n] -= q / c.rac * e; }
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
  const tk = weekTickets(); let planned = 0, extras = 0, home = 0; const groups = {};
  for (const t of tk) for (const l of t.lineas) {
    if (l.tipo === 'Hogar') { home += l.importe; continue; }
    if (l.tipo === 'Extra') { extras += l.importe; const g = l.grupo || 'Otros'; (groups[g] = groups[g] || []).push(l); } else planned += l.importe;
  }
  const spent = tk.reduce((a, t) => a + t.total, 0) - home;
  return { tk, planned, extras, groups, spent, home };
}
function level(pct) { return pct >= 0.99 ? 'lv-over' : pct >= 0.8 ? 'lv-high' : pct >= 0.6 ? 'lv-mid' : 'lv-ok'; }
// Descuenta de la despensa lo que gasta un plato. Si falta un ingrediente, tira de sus sustitutos (misma unidad)
// sin tocar lo que reservan otros platos de la semana. Devuelve qué se sustituyó y qué faltó.
function deduct(r, platos, opc, exclude) {
  const e = eq(); const used = [], missing = []; let cost = 0, full = 0;
  const reserved = needs(S.plan.filter(p => p !== exclude));
  const take = (n, amt) => { const left = (S.stock[n] || 0) - amt; if (left > 1e-6) S.stock[n] = r2(left); else delete S.stock[n]; };
  for (const [n, q, o] of r.i) {
    if (o && !opc) continue; if (!S.P[n]) continue;
    const need = q / r.rac * platos * e; const uc = ucost(S.P[n]); full += need * uc;
    if (isC(n)) { cost += need * uc; continue; }
    const have = S.stock[n] || 0; const own = Math.min(have, need); take(n, own); cost += own * uc;
    let short = need - own; if (short <= 1e-6) continue;
    const g = S.SUBS.find(x => x.includes(n)) || []; const u = S.P[n].u;
    for (const sb of g) {
      if (sb === n || !S.P[sb] || S.P[sb].u !== u) continue;
      const spare = (S.stock[sb] || 0) - (reserved.get(sb) || 0); if (spare <= 1e-6) continue;
      const t = Math.min(spare, short); take(sb, t); cost += t * ucost(S.P[sb]); short -= t; used.push(`${fmtQ(t, u)} de ${sb} en vez de ${n}`);
      if (short <= 1e-6) break;
    }
    if (short > 1e-6) missing.push(`${n} (${fmtQ(short, u)})`);
  }
  return { used, missing, cost: r2(cost), full: r2(full) };
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
    ${si.home > 0 ? `<div class="tip">Además gastaste <b>${eur(si.home)}</b> en cosas para casa (aseo, limpieza…). No cuenta en el presupuesto de comida; lo tienes en Despensa → Hogar.</div>` : ''}
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
    ${si.tk.length ? si.tk.map(t => `<div class="tk"><span>${new Date(t.fecha + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${esc(t.tienda)}</span><span class="num">${t.est ? '≈ ' : ''}${eur(t.total)} <button type="button" class="link" data-act="del-ticket" data-id="${t.id}" aria-label="Borrar ticket">✕</button></span></div>`).join('') : '<p class="small muted" style="margin:0">Aún no hay tickets esta semana. Usa el botón central para escanear uno.</p>'}
  </section>`;
}

/* ---------- Render: recetas ---------- */
function haveLine(r, it) {
  if (!r.i.length) return `<div class="have ok">✓ Siempre disponible · ${eur(0)}</div>`;
  if (it && it.cocinado) return `<div class="have ok">✓ Ya cocinado · te quedan ${leftOf(it)} ${leftOf(it) === 1 ? 'plato' : 'platos'}</div>`;
  const opc = it ? it.opc : false; const k = it ? it.k : null; const want = it ? it.veces : 1; const max = maxPlatos(r, opc, k);
  const pl = n => n === 1 ? 'plato' : 'platos';
  if (max >= want) return `<div class="have ok">✓ Tienes en casa para ${max} ${pl(max)}${it ? ` · llevas ${it.veces}` : ''}</div>`;
  const miss = coverage(r, want, opc, k).filter(x => !x.ok && !x.o && !x.c);
  const head = it ? `Con lo de casa llegas a ${max} de ${want}. ` : '';
  return `<div class="have miss"><span>${head}${miss.map(x => { const sub = subText(x.n, x.miss); return sub ? `En vez de ${esc(x.n)}, ${sub}` : `Te falta ${esc(x.n)} ${fmtQ(x.miss, S.P[x.n].u)}`; }).join('; ')}</span></div>`;
}
function howTo(r, key, veces, k) {
  const open = S.openHow.includes(key); const e = eq(); const mult = veces * e / r.rac; const raciones = veces * e;
  const cov = coverage(r, veces, true, k);
  return `<details class="how" data-how="${key}" ${open ? 'open' : ''}><summary>Ingredientes y pasos</summary><div class="how-body">
    ${r.i.length ? `<h4>Ingredientes · ${raciones.toLocaleString('es-ES')} ${raciones === 1 ? 'ración' : 'raciones'}</h4>
    <ul>${r.i.map(([n, q, o]) => { const c = cov.find(x => x.n === n); const st = c ? (c.ok ? '<span class="st ok">en casa</span>' : `<span class="st miss">${c.c ? 'falta 1 bote' : 'falta ' + fmtQ(c.miss, S.P[n].u)}</span>`) : ''; return `<li><span>${esc(n)}${o ? ' <span class="muted">(opcional)</span>' : ''} ${st}</span><span class="num">${fmtQ(q * mult, rU(n))}</span></li>`; }).join('')}</ul>` : ''}
    <h4>Pasos</h4><ol>${(S.STEPS[r.id] || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></details>`;
}
function recipeCard(r, explore) {
  const it = S.plan.find(p => p.rid === r.id && !p.cocinado); const cookedIt = S.plan.find(p => p.rid === r.id && p.cocinado); const hasOpc = r.i.some(x => x[2]);
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
  else ctrl = `<span class="stepper" role="group" aria-label="Platos de ${esc(r.n)}"><button type="button" ${it ? `data-act="veces" data-k="${it.k}" data-d="-1"` : 'disabled'} aria-label="Un plato menos">−</button><b>${it ? it.veces : 0}</b><button type="button" class="plus" ${it ? `data-act="veces" data-k="${it.k}" data-d="1"` : `data-act="addone" data-id="${r.id}"`} aria-label="Un plato más">+</button></span>`;
  return `<article class="card">
    <div class="card-head"><h3>${esc(r.n)}</h3>${explore ? '' : `<button type="button" class="link" data-act="unmine" data-id="${r.id}">Quitar</button>`}</div>
    <div class="meta">${r.tipos.map(t => `<span class="tag">${t[0].toUpperCase() + t.slice(1)}</span>`).join('')}${r.tanda ? '<span class="tag acc">Apta para tanda</span>' : ''}${cookedIt ? `<span class="tag acc">Cocinado · quedan ${leftOf(cookedIt)}</span>` : ''}${hasOpc ? `<span class="tag">+ ${esc(optNames(r).join(' y '))} opc.</span>` : ''}</div>
    <div class="cost"><div class="price">${eur(perRacion(r, false))}<small>por ración${kcalTxt(r, false)}</small></div>${ctrl}</div>
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
  const qn = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const q = qn(S.rq || '');
  const list = S.R.filter(r => (explore ? !S.mine.includes(r.id) : S.mine.includes(r.id)) && (S.filter.length === 0 || r.tipos.some(t => S.filter.includes(t))) && (!S.onlyTanda || r.tanda) && (!q || qn(r.n).includes(q) || qn(locText(r.n)).includes(q) || r.i.some(x => qn(x[0]).includes(q) || qn(locText(x[0])).includes(q))));
  const el = $('#recipe-list');
  if (!list.length) { el.innerHTML = `<div class="empty">${S.filter.includes('snack') ? 'Aún no hay snacks preparados en el recetario: pronto añadiremos ideas. Mientras, cuéntale al asistente tu snack y lo guarda, o apunta lo que piques desde la pestaña Semana.' : explore ? 'No hay más recetas con este filtro.' : (S.mine.length ? 'Ninguna receta de tu recetario encaja con el filtro. Añade más desde Explorar.' : 'Tu recetario está vacío. Entra en Explorar y añade los platos que quieras cocinar.')}</div>`; return; }
  if (!explore) { el.innerHTML = list.length ? list.map(r => recipeCard(r, false)).join('') : `<div class="empty">${S.mine.length ? 'Ninguna receta de tu recetario coincide con el filtro.' : 'Tu recetario está vacío. Entra en Explorar y añade los platos que quieras cocinar.'}</div>`; return; }
  const groups = [['desayuno', 'Desayunos'], ['almuerzo', 'Almuerzos'], ['cena', 'Cenas'], ['snack', 'Snacks'], ['bebida', 'Bebidas'], ['postre', 'Postres']];
  const open = S.openGroups || []; const auto = q || S.filter.length === 1;
  el.innerHTML = groups.map(([t, l]) => { const rs = list.filter(r => r.tipos[0] === t); if (!rs.length) return ''; const isOpen = auto || open.includes(t);
    return `<details class="rgroup" data-group="${t}" ${isOpen ? 'open' : ''}><summary><span>${l}</span><span class="cnt">${rs.length}</span></summary>${isOpen ? rs.slice(0, S['more_' + t] || 30).map(r => recipeCard(r, true)).join('') + (rs.length > (S['more_' + t] || 30) ? `<button type="button" class="btn ghost wide" data-act="more" data-t="${t}">Ver más (${rs.length - (S['more_' + t] || 30)})</button>` : '') : ''}</details>`; }).join('');
}

/* ---------- Render: semana, lista, despensa ---------- */
const eatN = {};
function snackDefault(n) { const p = S.P[n]; return !p ? 1 : p.u === 'ud' ? 1 : p.u === 'ml' ? 200 : 30; }
// Solo lo que tiene sentido picar entre horas: dulces/snacks, fruta, yogur, o lo que el ticket marcó como snack. Nunca aceite, harina, especias…
const SNACK_CATS = ['Dulces y snacks', 'Frutas'];
function isSnack(n) {
  const p = S.P[n]; if (!p || isC(n)) return false; if (p.snack) return true;
  const c = (S.CATS || []).find(x => x.items.includes(n)); return !!c && SNACK_CATS.includes(c.name) || n === 'Griego de limón';
}
function renderSnacks() {
  const el = $('#snack-box'); if (!el) return;
  const inStock = Object.keys(S.stock).filter(n => S.stock[n] > 0 && isSnack(n)).sort((a, b) => a.localeCompare(b, 'es'));
  const { start, end } = weekRange(); const week = (S.snacks || []).filter(x => x.ts >= start.getTime() && x.ts < end.getTime());
  const sel = S.snackSel && inStock.includes(S.snackSel) ? S.snackSel : inStock[0]; const total = week.reduce((a, x) => a + x.c, 0);
  el.innerHTML = `<div class="card-head"><div><h3>Snacks y picoteo</h3><div class="small muted">Apunta lo que piques entre horas: se descuenta de la despensa.</div></div><span class="price">${eur(total)}<small>esta semana</small></span></div>
    ${inStock.length ? `<div class="add-row"><select class="sel" id="sn-prod" aria-label="Producto">${S.CATS.map(c => { const its = c.items.filter(n => inStock.includes(n)); return its.length ? `<optgroup label="${esc(c.name)}">${its.map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>
      <input class="qty" id="sn-qty" type="number" min="0" inputmode="decimal" value="${snackDefault(sel)}" aria-label="Cantidad"><span class="muted small" id="sn-unit">${S.P[sel].u}</span>
      <button type="button" class="btn small" data-act="snack-add">Me lo comí</button></div>` : '<p class="small muted" style="margin:0">Cuando tengas galletas, barritas, dulces o fruta en la despensa podrás apuntarlos aquí.</p>'}
    ${week.length ? `<ul class="snack-list">${week.slice().reverse().slice(0, 8).map(x => `<li><span>${new Date(x.ts).toLocaleDateString('es-ES', { weekday: 'short' })} · ${esc(x.n)} <span class="muted">${fmtQ(x.q, S.P[x.n] ? S.P[x.n].u : 'ud')}</span></span><span class="num">${eur(x.c)}</span></li>`).join('')}</ul>` : ''}`;
}
function eatSnack(n, q) {
  const p = S.P[n]; if (!p || !(q > 0)) return null; const have = S.stock[n] || 0; const used = Math.min(q, have || q);
  const left = have - q; if (left > 1e-6) S.stock[n] = r2(left); else delete S.stock[n];
  const c = r2(used * ucost(p)); S.snacks = (S.snacks || []).filter(x => Date.now() - x.ts < 60 * 864e5); S.snacks.push({ ts: Date.now(), n, q, c });
  logMeal('snack', `${n} (${fmtQ(q, p.u)})`, c); return c;
}
const MEAL_LABEL = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena', snack: 'Snack' };
function stockValue() { return Object.keys(S.stock).filter(n => S.P[n] && !isC(n)).reduce((a, n) => a + S.stock[n] * ucost(S.P[n]), 0); }
function renderEaten() {
  const { start, end } = weekRange(); const week = (S.log || []).filter(x => x.ts >= start.getTime() && x.ts < end.getTime());
  const total = week.reduce((a, x) => a + (x.c || 0), 0);
  $('#s-consumo').textContent = eur(total);
  const btn = $('#btn-eaten'); btn.setAttribute('aria-expanded', S.eatenOpen ? 'true' : 'false');
  const el = $('#eaten-panel'); el.hidden = !S.eatenOpen; if (!S.eatenOpen) return;
  if (!week.length) { el.innerHTML = '<div class="empty" style="border:0">Aún no has anotado nada esta semana. Pulsa «Comí» en un plato o apunta un snack y aparecerá aquí.</div>'; return; }
  const days = new Map();
  for (const x of week.slice().sort((a, b) => b.ts - a.ts)) {
    const d = new Date(x.ts); const key = dayKey(d); if (!days.has(key)) days.set(key, { d, rows: [] });
    const rows = days.get(key).rows; const same = rows.find(r => r.t === x.t && r.n === x.n);
    if (same) { same.k++; same.c += x.c || 0; } else rows.push({ t: x.t, n: x.n, k: 1, c: x.c || 0 });
  }
  el.innerHTML = `<div class="gh" style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px"><span>Lo que has comido esta semana</span><span class="num">${eur(total)}</span></div>` +
    [...days.values()].map(({ d, rows }) => `<div class="eat-day"><div class="eat-dh">${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/^./, c => c.toUpperCase())}</div>${rows.map(r => `<div class="eat-r"><span class="tag">${MEAL_LABEL[r.t] || r.t}</span><span class="eat-n">${r.n ? esc(r.n) : '<span class="muted">sin detalle</span>'}${r.k > 1 ? ` <b>×${r.k}</b>` : ''}</span><span class="num small">${eur(r.c)}</span></div>`).join('')}</div>`).join('') +
    `<p class="small muted" style="margin:8px 0 0">Solo cuenta lo que sale de tu despensa, al precio de lo que compraste. ${total > spentInfo().spent + 0.005 ? `De lo comido, ${eur(total - spentInfo().spent)} salía de cosas que ya tenías de antes (no cuentan como gasto de esta semana). ` : `Lo que ya has comprado y aún no te has comido (≈ ${eur(stockValue())}) está en la despensa, por eso lo gastado en la semana es mayor. `}${week.some(x => !x.n) ? 'Lo anotado antes de esta versión sale sin detalle.' : ''}</p>`;
}
function renderSemana() {
  renderSnacks();
  const s = shop(S.plan); const e = eq();
  renderEaten();
  $('#s-compra').textContent = eur(s.total); $('#s-sobra').textContent = eur(s.sobra);
  const el = $('#plan-list');
  if (!S.plan.length) { el.innerHTML = '<div class="empty">Tu semana está vacía. Añade platos con el botón + del recetario.</div>'; return; }
  el.innerHTML = S.plan.map(it => {
    const r = byId(it.rid); if (!r) return ''; const pr = perRacion(r, it.opc); const hasOpc = r.i.some(x => x[2]);
    return `<article class="card">
      <div class="card-head"><div><h3>${esc(r.n)}</h3><div class="small muted">${it.veces} ${it.veces === 1 ? 'plato' : 'platos'} · ${eur(pr)} por ración${kcalTxt(r, it.opc)}</div></div><span class="price">${eur(pr * it.veces * e)}</span></div>
      <div class="meta" style="align-items:center;gap:10px">
        ${it.cocinado ? `<span class="tag acc">Cocinado · quedan ${leftOf(it)}</span>` : `<span class="stepper"><button type="button" data-act="veces" data-k="${it.k}" data-d="-1" aria-label="Un plato menos">−</button><b>${it.veces}</b><button type="button" class="plus" data-act="veces" data-k="${it.k}" data-d="1" aria-label="Un plato más">+</button></span>
        ${hasOpc ? `<label class="toggle"><input type="checkbox" data-act="opc" data-k="${it.k}" ${it.opc ? 'checked' : ''}> Con ${esc(optNames(r).join(' y '))}</label>` : ''}`}
      </div>
      <div class="meta" style="gap:8px">
        ${!it.cocinado && !canMake(it, 1) ? '<span class="small muted" style="flex:1">Aún no lo tienes: marca en Lista lo que falta para poder cocinarlo o comerlo.</span>' : ''}
        ${it.cocinado || !canMake(it, it.veces) ? '' : `<button type="button" class="btn small ghost" data-act="cook" data-k="${it.k}">Ya lo cociné</button>`}
        ${(mealOf(r) || r.tipos.includes('snack')) && (it.cocinado || canMake(it, 1)) ? (() => { const mx = Math.max(1, leftOf(it)); const n = Math.min(eatN[it.k] || 1, mx); return `<span class="stepper sm"><button type="button" data-act="eatn" data-k="${it.k}" data-d="-1" aria-label="Una ración menos" ${n <= 1 ? 'disabled' : ''}>−</button><b>${n}</b><button type="button" data-act="eatn" data-k="${it.k}" data-d="1" aria-label="Una ración más" ${n >= mx ? 'disabled' : ''}>+</button></span><button type="button" class="btn small" data-act="eat" data-k="${it.k}" data-n="${n}">Comí ${n}</button>`; })() : ''}
        <button type="button" class="link" data-act="remove" data-k="${it.k}">Quitar</button>
      </div>
      ${haveLine(r, it)}
      ${howTo(r, 'p-' + it.k, it.veces, it.k)}
    </article>`;
  }).join('');
}
function consBox() {
  const due = consDue(); if (!due.length) return '';
  return `<div class="cons-box"><div class="gh"><span>Revisa tus especias</span><span class="small muted">las compraste hace más de 4 semanas</span></div>${due.map(n => { const p = S.P[n]; const wk = Math.floor((Date.now() - S.since[n]) / (7 * 864e5)); return `<div class="cons-r"><div><div class="n">${esc(n)}</div><div class="d">${S.stock[n]} ${S.stock[n] === 1 ? 'bote' : 'botes'} de ${p.g} ${p.gu || 'g'} · hace ${wk} semanas · reponer ≈ ${eur(p.p)}</div></div>
    <div class="cons-a"><button type="button" class="btn small ghost" data-act="cons-snz" data-n="${esc(n)}">Aún tengo, avísame la siguiente compra</button><button type="button" class="btn small" data-act="cons-out" data-n="${esc(n)}">Se acabó, a la lista</button></div></div>`; }).join('')}</div>`;
}
function homeBox() {
  const ws = Object.keys(S.hwant).filter(n => S.hwant[n] && S.HP[n]); if (!ws.length) return '';
  const tot = ws.reduce((a, n) => a + (S.HP[n].p || 0), 0);
  return `<div class="cons-box home-box"><div class="gh"><span>Para casa</span><span class="num">≈ ${eur(tot)}</span></div>${ws.map(n => `<div class="cons-r" style="grid-template-columns:1fr auto;align-items:center"><div><div class="n">${esc(n)}</div><div class="d">${esc(S.HP[n].cat)} · ${esc(S.HP[n].f)}${S.HP[n].p ? ' · ≈ ' + eur(S.HP[n].p) : ''}</div></div><button type="button" class="btn small ghost" data-act="hbuy" data-n="${esc(n)}">Comprado</button></div>`).join('')}<div class="d small muted">No suma al presupuesto de comida.</div></div>`;
}
function renderLista() {
  const s = shop(S.plan); const el = $('#shop-list'); const cb = consBox() + homeBox();
  if (!s.rows.length) { el.innerHTML = cb + '<div class="empty" style="border:0">La lista se llena cuando añades platos a tu semana.</div>'; return; }
  el.innerHTML = cb + s.rows.map((x, i) => {
    const done = x.packs === 0; const inCart = !done && !!(S.cart || {})[x.n]; const miss = x.need - x.have; const sub = done ? null : subText(x.n, miss);
    return `<div class="row ${done || inCart ? 'done' : ''}">
      <input type="checkbox" id="sl-${i}" data-act="cart" data-n="${esc(x.n)}" ${done || inCart ? 'checked' : ''} ${done ? 'disabled' : ''} aria-label="${done ? 'Ya lo tienes' : 'En el carro'}: ${esc(x.n)}">
      <label for="sl-${i}"><div class="n">${esc(x.n)}</div><div class="d">${x.cons ? (x.packs ? `${S.want[x.n] ? 'Se te acabó' : 'Lo usa tu semana y no tienes'} · compra 1 × ${esc(x.p.f)}` : `Especia · tienes ${x.have} ${x.have === 1 ? 'bote' : 'botes'}, no hace falta comprar`) : `Necesitas ${fmtQ(x.need, x.p.u)}${x.have ? ` · en casa ${fmtQ(x.have, x.p.u)}` : ''}${x.packs ? ` · compra ${x.packs} × ${esc(x.p.f)}` : ' · no hace falta comprar'}`}</div>${sub ? `<div class="d" style="color:var(--ok)">Para ahorrar: ${sub}</div>` : ''}</label>
      <div class="p num">${x.p.t ? '' : '≈ '}${eur(x.cost)}</div></div>`;
  }).join('') + `<div class="foot"><span>Total a pagar</span><span class="num">≈ ${eur(s.total)}</span></div>` +
  (s.rows.some(x => x.packs && (S.cart || {})[x.n]) ? `<div class="cart-note"><p class="small muted" style="margin:0">Marcar solo lo pone en el carro. La despensa y el gasto se actualizan al escanear el ticket (o con el botón de abajo, con precio estimado).</p><button type="button" class="btn small ghost" data-act="cart-stock">No tengo ticket: pasar lo marcado a la despensa</button></div>` : '');
}
function renderHogar() {
  const all = Object.keys(S.HP); const have = all.filter(n => (S.hstock[n] || 0) > 0);
  const cat = HCATS.includes(S.homeCat) ? S.homeCat : '';
  const counts = HCATS.map(c => have.filter(n => S.HP[n].cat === c).length);
  let html = `<div class="inv-sum"><b>${have.length}</b> ${have.length === 1 ? 'producto' : 'productos'} de casa · se separan solos al escanear el ticket</div>
    <div class="chips inv-chips"><button type="button" class="chip" data-act="home-cat" data-c="" aria-pressed="${!cat}">Todo · ${have.length}</button>${HCATS.map((c, i) => `<button type="button" class="chip" data-act="home-cat" data-c="${esc(c)}" aria-pressed="${cat === c}">${esc(c)} · ${counts[i]}</button>`).join('')}</div>
    <div class="add-row"><input class="sel" id="h-name" list="h-names" placeholder="Producto (p. ej. champú)" aria-label="Producto de casa"><datalist id="h-names">${all.sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <select class="sel" id="h-cat" aria-label="Categoría" style="flex:0 1 140px">${HCATS.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <input class="qty" id="h-qty" type="number" min="1" step="1" value="1" aria-label="Cantidad"><button type="button" class="btn small" data-act="home-add">Añadir</button></div>`;
  HCATS.forEach((c, ci) => {
    if (cat && c !== cat) return;
    const rows = all.filter(n => S.HP[n].cat === c && ((S.hstock[n] || 0) > 0 || S.hwant[n])).sort((a, b) => a.localeCompare(b, 'es')); if (!rows.length) return;
    html += `<div class="inv-g"><i style="background:${CAT_COLORS[(ci * 3) % CAT_COLORS.length]}"></i>${esc(c)}<span class="cnt">${rows.filter(n => (S.hstock[n] || 0) > 0).length}</span></div>`;
    for (const n of rows) {
      const q = S.hstock[n] || 0; const h = S.HP[n];
      html += `<div class="inv-r"><span>${esc(n)}</span><span class="q"><input class="qty" type="number" min="0" step="1" inputmode="numeric" value="${q}" data-act="hstock" data-n="${esc(n)}" aria-label="Cantidad de ${esc(n)}">ud</span><span class="num small">${eur(q * h.p)}</span>
        <span class="res">${esc(h.f)}${S.hwant[n] ? ' · <b style="color:var(--warn)">en la lista de compra</b>' : q > 0 ? ` · <button type="button" class="link" data-act="home-out" data-n="${esc(n)}">Se acabó, a la lista</button>` : ''}</span></div>`;
    }
  });
  if (!have.length && !Object.keys(S.hwant).length) html += '<div class="empty" style="border:0">Aún no hay nada de casa. Escanea un ticket con champú, detergente, fundas… y aparecerá aquí, o añádelo arriba.</div>';
  $('#inv-list').innerHTML = html;
}
function renderDespensa() {
  $('#seg-food').setAttribute('aria-pressed', S.invSeg !== 'home'); $('#seg-home').setAttribute('aria-pressed', S.invSeg === 'home');
  $('#desp-lead').textContent = S.invSeg === 'home' ? 'Aseo personal, limpieza y cosas de casa. No cuentan en tu presupuesto de comida.' : 'Lo que tienes en casa para comer. Cambia cantidades a mano, añade productos o díselo al asistente.';
  if (S.invSeg === 'home') return renderHogar();
  const items = Object.entries(S.stock).filter(([n, q]) => S.P[n] && q > 0); const reserved = needs(S.plan);
  const sel = S.invSel && S.P[S.invSel] ? S.invSel : Object.keys(S.P)[0]; const sp = S.P[sel]; let total = 0;
  const counts = S.CATS.map((c, ci) => items.filter(([n]) => catOf(n) === ci).length);
  const cat = S.invCat && S.CATS.some(c => c.name === S.invCat) ? S.invCat : '';
  let html = `<div class="inv-sum"><b>${items.length}</b> ${items.length === 1 ? 'producto' : 'productos'} en casa · ${counts.filter(Boolean).length} categorías</div>
    ${items.length ? '<button type="button" class="btn wide ghost" data-act="ideas" style="margin-bottom:10px">¿Qué cocino con lo que tengo?</button>' : ''}
    <div class="chips inv-chips"><button type="button" class="chip" data-act="inv-cat" data-c="" aria-pressed="${!cat}">Todo · ${items.length}</button>${S.CATS.map((c, ci) => counts[ci] ? `<button type="button" class="chip" data-act="inv-cat" data-c="${esc(c.name)}" aria-pressed="${cat === c.name}">${esc(c.name)} · ${counts[ci]}</button>` : '').join('')}</div>
    <div class="add-row"><select class="sel" id="inv-prod" aria-label="Producto">${S.CATS.map(c => c.items.filter(n => S.P[n]).length ? `<optgroup label="${esc(c.name)}">${c.items.filter(n => S.P[n]).sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>` : '').join('')}</select>
    <input class="qty" id="inv-qty" type="number" min="0" inputmode="decimal" value="${sp.u === 'ud' ? 1 : sp.q}" aria-label="Cantidad"><span class="muted small" id="inv-unit">${sp.u}</span>
    <button type="button" class="btn small" data-act="inv-add">Añadir</button></div>`;
  S.CATS.forEach((c, ci) => {
    if (cat && c.name !== cat) return;
    const rows = items.filter(([n]) => catOf(n) === ci).sort((a, b) => a[0].localeCompare(b[0], 'es')); if (!rows.length) return;
    html += `<div class="inv-g"><i style="background:${CAT_COLORS[ci % CAT_COLORS.length]}"></i>${esc(c.name)}<span class="cnt">${rows.length}</span></div>`;
    for (const [n, q] of rows) {
      const p = S.P[n]; const v = q * p.p / p.q; total += v; const rs = reserved.get(n);
      const extra = p.c ? `<span class="res">${q === 1 ? 'bote' : 'botes'} de ${p.g} ${p.gu || 'g'}${S.since[n] ? ` · desde hace ${Math.max(0, Math.floor((Date.now() - S.since[n]) / (7 * 864e5)))} sem.` : ''}</span>` : rs ? `<span class="res">Tu semana usa ${fmtQ(Math.min(q, rs), p.u)} · libre ${fmtQ(Math.max(0, q - rs), p.u)}${rs > q + 1e-6 ? ' · no alcanza' : ''}</span>` : '';
      html += `<div class="inv-r"><span>${esc(n)}</span><span class="q"><input class="qty" type="number" min="0" step="${p.u === 'ud' ? 1 : 'any'}" inputmode="decimal" value="${r2(q)}" data-act="stock" data-n="${esc(n)}" aria-label="Cantidad de ${esc(n)}">${p.u}</span><span class="num small">${eur(v)}</span>${extra}</div>`;
    }
  });
  if (!items.length) html += '<div class="empty" style="border:0">Tu despensa está vacía. Añade productos arriba o escanea un ticket.</div>';
  html += `<div class="foot"><span>Valor en casa${cat ? ' · ' + esc(cat) : ''}</span><span class="num">≈ ${eur(total)}</span></div>`;
  $('#inv-list').innerHTML = html;
}
function setView(v) {
  S.view = v;
  for (const b of document.querySelectorAll('.nav .tab')) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== 'v-' + v;
}
/* ---------- Niveles: la app se va abriendo según lo que haces (nunca se vuelve a cerrar) ----------
   1 Recetas + Semana · 2 +Lista y escáner (ya hay un plato en la semana) · 3 +Despensa (ya hay compra o stock)
   4 +Snacks, «Lo que comes» y asistente (ya has cocinado o comido algo) */
const NIVELES = { 2: 'Lista y escáner de tickets', 3: 'Despensa', 4: 'Snacks, lo que comes y asistente' };
function calcNivel() {
  let n = 1;
  if (S.plan.length || S.tickets.length) n = 2;
  if (S.tickets.length || Object.keys(S.stock).length) n = Math.max(n, 3);
  if ((S.log || []).length || S.plan.some(p => p.cocinado)) n = 4;
  return n;
}
function applyNivel() {
  const prev = S.nivel || 0; const n = Math.max(prev, calcNivel());
  if (n > prev) { S.nivel = n; if (prev) toast('Desbloqueado: ' + NIVELES[n]); }
  const show = { lista: n >= 2, despensa: n >= 3 };
  document.querySelector('.tab[data-view=lista]').hidden = !show.lista;
  document.querySelector('.tab[data-view=despensa]').hidden = !show.despensa;
  $('#btn-scan').hidden = n < 2; $('#btn-ai').hidden = n < 4;
  $('#snack-box').hidden = n < 4; $('#btn-eaten').hidden = n < 4; if (n < 4) $('#eaten-panel').hidden = true;
  $('.stats').style.gridTemplateColumns = `repeat(${n < 4 ? 2 : 3},minmax(0,1fr))`;
  $('.nav .wrap').style.gridTemplateColumns = `repeat(${2 + (n >= 2 ? 2 : 0) + (n >= 3 ? 1 : 0)},minmax(0,1fr))`;
  if (S.view === 'lista' && !show.lista || S.view === 'despensa' && !show.despensa) S.view = 'recetas';
  const g = n === 1 && !S.mine.length ? 'Paso 1 · Entra en «Explorar» y pulsa «+ A mi recetario» en los platos que quieras cocinar.'
    : n === 1 ? 'Paso 2 · En «Mi recetario» pulsa el botón + de un plato para llevarlo a tu Semana. Con eso se abre el siguiente paso.'
    : n === 2 && !S.tickets.length ? 'Paso 3 · En Lista ves qué te falta comprar. Al comprar, escanea el ticket (botón naranja) para apuntar el gasto y llenar la despensa.'
    : n === 3 ? 'Paso 4 · Cuando cocines o te comas un plato, márcalo en Semana: la despensa se descuenta sola.' : '';
  $('#guia').textContent = g; $('#guia').hidden = !g;
}
function render() { applyNivel(); renderHeader(); renderRecetas(); renderSemana(); renderLista(); renderDespensa(); setView(S.view); save(); }

/* ---------- Acciones ---------- */
function toast(msg) { let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); } const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 3500); }
function eatOne(it) {
  const r = byId(it.rid); const t = mealOf(r) || (r.tipos.includes('snack') ? 'snack' : null);
  const wasCooked = !!it.cocinado;
  if (it.cocinado) it.comidos = (it.comidos || 0) + 1; else { lastDeduct = deduct(r, 1, it.opc, it); it.veces -= 1; }
  if (t && t !== 'snack') S.eaten[t] = (S.eaten[t] || 0) + 1;
  logMeal(t, r.n, wasCooked ? perRacion(r, it.opc) * eq() * (it.cov == null ? 1 : it.cov) : lastDeduct.cost);
  if (leftOf(it) <= 0) S.plan = S.plan.filter(p => p !== it);
}
function logMeal(t, n, c) {
  S.log = (S.log || []).filter(x => Date.now() - x.ts < 60 * 864e5); S.log.push({ ts: Date.now(), t: t || mealByHour(), n: n || '', c: r2(c || 0), v: 2 });
  if (S.pushId && t && PROXY) pushPost('push/comi', { id: S.pushId, comida: t }).catch(() => {});
}
function mealByHour(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return h >= 5 && h < 11.5 ? 'desayuno' : h < 16.5 ? 'almuerzo' : h < 19.5 ? 'merienda' : 'cena'; }
function enjoyed(n, r) {
  if (S.enjoyPopup === false) return toast(`Anotado: ${n} ${n === 1 ? 'ración' : 'raciones'} de ${r.n}`);
  const m = mealByHour();
  $('#pop-in').innerHTML = `<div class="pop-emoji" aria-hidden="true">🍽️</div><h2>¡Que aproveche${S.name ? ', ' + esc(S.name) : ''}!</h2><p>Espero que hayas disfrutado tu ${m}.</p><p class="small muted">Anotado: ${n} ${n === 1 ? 'ración' : 'raciones'} de ${esc(r.n)}.</p><button type="button" class="btn wide" data-close>Gracias</button><label class="toggle" style="justify-content:center"><input type="checkbox" id="pop-off"> No volver a mostrar</label>`;
  $('#dlg-pop').showModal();
}
let lastDeduct = null;
function cook(it) { const r = byId(it.rid); const d = deduct(r, it.veces, it.opc, it); it.cov = d.full > 0 ? d.cost / d.full : 1; it.cocinado = true; it.comidos = it.comidos || 0; return d; }
function deductMsg(d) { if (!d) return ''; const parts = []; if (d.used.length) parts.push('Usé ' + d.used.join(', ')); if (d.missing.length) parts.push('No tenías ' + d.missing.join(', ') + ': no lo compraste, así que no cuenta en lo que comes'); return parts.join('. '); }

document.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.id === 'summary') { S.detailsOpen = !S.detailsOpen; renderHeader(); save(); return; }
  if (b.id === 'btn-settings') return openSettings();
  if (b.id === 'btn-scan') return openScan();
  if (b.id === 'btn-ai') return openAI();
  if (b.dataset.view) { setView(b.dataset.view); save(); window.scrollTo({ top: 0 }); return; }
  if (b.id === 'btn-eaten') { S.eatenOpen = !S.eatenOpen; renderEaten(); save(); return; }
  if (b.id === 'seg-food' || b.id === 'seg-home') { S.invSeg = b.id === 'seg-home' ? 'home' : 'food'; render(); return; }
  if (b.id === 'seg-mine' || b.id === 'seg-explore') { S.seg = b.id === 'seg-mine' ? 'mine' : 'explore'; render(); return; }
  const a = b.dataset.act; if (!a) return;
  const it = b.dataset.k !== undefined ? S.plan.find(p => String(p.k) === b.dataset.k) : null;
  if (a === 'filter') { const f = b.dataset.f; S.filter = f === '' ? [] : (S.filter.includes(f) ? S.filter.filter(x => x !== f) : S.filter.concat(f)); }
  else if (a === 'addone') S.plan.push({ k: S.seq++, rid: b.dataset.id, veces: 1, opc: false });
  else if (a === 'veces' && it) { const nv = Math.min(30, it.veces + Number(b.dataset.d)); if (nv < 1) S.plan = S.plan.filter(p => p !== it); else it.veces = nv; }
  else if (a === 'remove' && it) { if (it.cocinado && leftOf(it) > 0 && b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = `¿Quitar? Se pierden ${leftOf(it)} raciones cocinadas`; return; } S.plan = S.plan.filter(p => p !== it); }
  else if (a === 'cook' && it) { if (!canMake(it, it.veces)) return toast('Te faltan ingredientes: primero cómpralos desde la Lista'); const m = deductMsg(cook(it)); toast('Cocinado: ' + byId(it.rid).n + '. ' + (m || 'Despensa actualizada')); }
  else if (a === 'eatn' && it) { eatN[it.k] = Math.max(1, Math.min(Math.max(1, leftOf(it)), (eatN[it.k] || 1) + Number(b.dataset.d))); renderSemana(); return; }
  else if (a === 'eat' && it) {
    const r = byId(it.rid); let n = Math.max(1, Math.min(Number(b.dataset.n) || 1, Math.max(1, leftOf(it))));
    if (!it.cocinado) { n = Math.min(n, maxMake(it, n)); if (n < 1) return toast('Te faltan ingredientes: primero cómpralos desde la Lista'); }
    lastDeduct = null; const msgs = [];
    for (let i = 0; i < n && S.plan.includes(it); i++) { eatOne(it); const m = deductMsg(lastDeduct); if (m) msgs.push(m); lastDeduct = null; }
    delete eatN[it.k]; render(); if (msgs.length) toast(msgs[msgs.length - 1]); return enjoyed(n, r);
  }
  else if (a === 'ideas') { IDEAS = null; renderIdeas(); $('#dlg-ideas').showModal(); return; }
  else if (a === 'mine') { if (!S.mine.includes(b.dataset.id)) S.mine.push(b.dataset.id); toast(byId(b.dataset.id).n + ' añadida a tu recetario'); }
  else if (a === 'unmine') { S.mine = S.mine.filter(x => x !== b.dataset.id); toast(byId(b.dataset.id).n + ' movida a Explorar'); }
  else if (a === 'more') { S['more_' + b.dataset.t] = (S['more_' + b.dataset.t] || 30) + 30; renderRecetas(); return; }
  else if (a === 'snack-add') { const n = $('#sn-prod').value; const q = Number($('#sn-qty').value) || 0; if (!S.P[n] || q <= 0) return toast('Indica una cantidad mayor que 0'); S.snackSel = n; const c = eatSnack(n, q); toast(`Anotado: ${fmtQ(q, S.P[n].u)} de ${n} (${eur(c)})`); }
  else if (a === 'cart-stock') {
    const rows = shop(S.plan).rows.filter(x => x.packs && (S.cart || {})[x.n]); let n = 0; const lineas = [];
    for (const x of rows) {
      const inv = r2(x.packs * x.p.q);
      S.stock[x.n] = r2((S.stock[x.n] || 0) + inv); if (isC(x.n)) { S.since[x.n] = Date.now(); delete S.want[x.n]; delete S.snz[x.n]; } delete S.cart[x.n]; n++;
      lineas.push({ desc: x.n, producto: x.n, inv, uds: x.packs, importe: r2(x.packs * x.p.p), tipo: 'De la lista', grupo: null });
    }
    if (lineas.length) {
      const d = new Date(); const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      S.tickets.push({ id: 't' + Date.now(), fecha, tienda: 'Sin ticket (estimado)', est: true, total: r2(lineas.reduce((a, l) => a + l.importe, 0)), lineas });
    }
    toast(`${n} ${n === 1 ? 'producto pasado' : 'productos pasados'} a la despensa. Gasto apuntado con el precio estimado`);
  }
  else if (a === 'cons-snz') { S.snz[b.dataset.n] = weekRange().end.getTime(); toast('Vale, te lo vuelvo a recordar en la próxima compra'); }
  else if (a === 'cons-out') { const n = b.dataset.n; delete S.stock[n]; S.want[n] = 1; delete S.snz[n]; toast(`${n} añadido a la lista`); }
  else if (a === 'inv-cat') { S.invCat = b.dataset.c; }
  else if (a === 'home-cat') { S.homeCat = b.dataset.c; }
  else if (a === 'home-out') { const n = b.dataset.n; delete S.hstock[n]; S.hwant[n] = 1; toast(`${n} añadido a la lista`); }
  else if (a === 'home-add') { const n = $('#h-name').value.trim().replace(/^./, c => c.toUpperCase()); const q = Math.max(1, Math.round(Number($('#h-qty').value) || 1)); if (!n) return toast('Escribe el producto'); if (!S.HP[n]) S.HP[n] = { cat: $('#h-cat').value, f: 'Unidad', p: 0, t: 0 }; S.hstock[n] = (S.hstock[n] || 0) + q; delete S.hwant[n]; toast(`Añadido: ${q} × ${n}`); }
  else if (a === 'hbuy') { const n = b.dataset.n; S.hstock[n] = (S.hstock[n] || 0) + 1; delete S.hwant[n]; toast(`${n}: marcado como comprado`); }
  else if (a === 'inv-add') { const n = $('#inv-prod').value; const q = Number($('#inv-qty').value) || 0; if (!S.P[n] || q <= 0) return toast('Indica una cantidad mayor que 0'); S.stock[n] = r2((S.stock[n] || 0) + q); if (isC(n)) { S.since[n] = Date.now(); delete S.want[n]; delete S.snz[n]; } S.invSel = n; toast(`Añadido: ${fmtQ(q, S.P[n].u)} de ${n}`); }
  else if (a === 'del-ticket') { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Borrar?'; return; } const tk = S.tickets.find(t => t.id === b.dataset.id); let undone = 0;
    for (const l of (tk && tk.lineas) || []) {
      if (l.producto && l.inv > 0 && S.P[l.producto]) { const v = (S.stock[l.producto] || 0) - l.inv; if (v > 1e-6) S.stock[l.producto] = r2(v); else delete S.stock[l.producto]; undone++; }
      if (l.hogar && l.uds > 0) { const v = (S.hstock[l.hogar] || 0) - l.uds; if (v > 0) S.hstock[l.hogar] = v; else delete S.hstock[l.hogar]; undone++; }
    }
    S.tickets = S.tickets.filter(t => t.id !== b.dataset.id); toast(undone ? 'Ticket borrado. También he quitado de la despensa lo que había metido' : 'Ticket borrado. La despensa no se ha tocado (era un ticket antiguo)'); }
  else return;
  render();
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'only-tanda') S.onlyTanda = t.checked;
  else if (t.id === 'sn-prod') { S.snackSel = t.value; $('#sn-unit').textContent = S.P[t.value].u; $('#sn-qty').value = snackDefault(t.value); save(); return; }
  else if (t.id === 'inv-prod') { S.invSel = t.value; const p = S.P[t.value]; $('#inv-unit').textContent = p.u; $('#inv-qty').value = p.u === 'ud' ? 1 : p.q; save(); return; }
  else if (t.dataset.act === 'opc') { const it = S.plan.find(p => String(p.k) === t.dataset.k); if (it) it.opc = t.checked; }
  else if (t.dataset.act === 'cart') { S.cart = S.cart || {}; if (t.checked) S.cart[t.dataset.n] = 1; else delete S.cart[t.dataset.n]; }
  else if (t.dataset.act === 'have') { const n = t.dataset.n; if (t.checked) { S.stock[n] = Math.max(S.stock[n] || 0, Number(t.dataset.need)); if (isC(n)) { S.since[n] = Date.now(); delete S.want[n]; delete S.snz[n]; } } else delete S.stock[n]; }
  else if (t.dataset.act === 'hstock') { const n = t.dataset.n; const v = Math.max(0, Math.round(Number(t.value) || 0)); if (v > 0) { S.hstock[n] = v; delete S.hwant[n]; } else delete S.hstock[n]; }
  else if (t.dataset.act === 'stock') { const n = t.dataset.n; const v = Math.max(0, Number(t.value) || 0); if (isC(n) && v > (S.stock[n] || 0)) { S.since[n] = Date.now(); delete S.snz[n]; } if (v > 0) S.stock[n] = v; else delete S.stock[n]; }
  else return;
  render();
});
document.addEventListener('toggle', ev => {
  const g = ev.target; if (g.dataset && g.dataset.group) { const set = new Set(S.openGroups || []); const was = set.has(g.dataset.group); g.open ? set.add(g.dataset.group) : set.delete(g.dataset.group); S.openGroups = [...set]; save(); if (g.open && !was && !g.querySelector('article')) renderRecetas(); return; }
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
      <label class="field">Tu nombre<input id="st-name" autocomplete="given-name" maxlength="30" value="${esc(S.name)}"></label>
      <label class="field">País y moneda<select id="st-region">${Object.entries(window.REGIONS).map(([k, r]) => `<option value="${k}" ${k === S.region ? 'selected' : ''}>${r.name} (${r.currency === 'USD' ? '$' : '€'})</option>`).join('')}</select></label>
    </div>
    <div class="grid2">
      <label class="field">Presupuesto semanal (${SYM()})<input id="st-budget" type="number" min="0" inputmode="decimal" value="${S.budget}"></label>
      <label class="field">La semana empieza el<select id="st-week">${DAYS.map((d, i) => `<option value="${i}" ${i === S.weekStart ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field">Adultos<input id="st-adults" type="number" min="1" max="8" value="${S.adults}"></label>
      <label class="field">Niños (½ ración)<input id="st-kids" type="number" min="0" max="8" value="${S.kids}"></label>
    </div>
    <p class="small muted" style="margin:0">Comidas a cubrir por semana</p>
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">${MEALS.map(([k, l]) => `<label class="field">${l}<input id="st-t-${k}" type="number" min="0" max="21" value="${S.target[k]}"></label>`).join('')}</div>
    <label class="field">Estilo de la app<select id="st-theme">${THEMES.map(([v, l]) => `<option value="${v}" ${v === (S.theme || 'grafito') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <h3 style="font-size:16px;margin-top:6px">Avisos</h3>
    <label class="toggle"><input type="checkbox" id="st-enjoy" ${S.enjoyPopup !== false ? 'checked' : ''}> Mensaje de «que aproveche» al anotar lo que comes</label>
    <label class="toggle"><input type="checkbox" id="st-remind" ${S.remind.on ? 'checked' : ''}> Recordarme comer si no he anotado la comida</label>
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">${REM.map(([k, , l]) => `<label class="field">${l}<input id="st-r-${k}" type="time" value="${S.remind[k]}"></label>`).join('')}</div>
    <p class="small muted" style="margin:0">Te avisa a esas horas solo si aún no has pulsado «Comí» en esa comida. ${S.pushId ? 'Los avisos llegan aunque la app esté cerrada.' : PROXY ? 'Para que lleguen con la app cerrada, pon tu código de invitación. En iPhone, la app tiene que estar añadida a la pantalla de inicio.' : 'Con la app cerrada, el móvil decide cuándo la deja comprobar, así que algún aviso puede llegar con retraso.'}</p>
    ${S.pushId ? '<button type="button" class="btn ghost small" id="st-test-push" style="justify-self:start">Enviarme un aviso de prueba</button>' : ''}
    <h3 style="font-size:16px;margin-top:6px">Inteligencia artificial</h3>
    ${PROXY ? `<label class="field">Código de invitación<input id="st-code" autocomplete="off" autocapitalize="none" placeholder="El que te pasaron con el enlace" value="${esc(S.code)}"></label>` : ''}
    <label class="field">${PROXY ? 'Clave de API propia (opcional)' : 'Clave de API de Anthropic'}<input id="st-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(S.apiKey)}"></label>
    <label class="field">Modelo<select id="st-model">${MODELS.map(([v, l]) => `<option value="${v}" ${v === S.model ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="small muted" style="margin:0">${PROXY ? 'Con el código de invitación no necesitas nada más. Si pones una clave propia, se usa esa y se guarda solo en este móvil.' : 'La clave se guarda solo en este móvil. Pon un límite de gasto mensual en console.anthropic.com.'}</p>
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
    S.enjoyPopup = $('#st-enjoy').checked; S.theme = $('#st-theme').value; applyTheme();
    const wasOn = S.remind.on, oldT = REM.map(([k]) => S.remind[k]).join(); S.remind.on = $('#st-remind').checked; for (const [k] of REM) S.remind[k] = $('#st-r-' + k).value || S.remind[k];
    if (S.remind.on && (!wasOn || oldT !== REM.map(([k]) => S.remind[k]).join())) enableReminders(); else if (!S.remind.on && wasOn) disablePush();
    const reg = $('#st-region').value; if (reg !== S.region) { applyRegion(reg); S.cname = {}; S.lname = {}; syncCommunity(true); buildLoc(); toast(`Precios y nombres de ${REG().name}`); setTimeout(() => localize(document.body), 0); }
    S.apiKey = $('#st-key').value.trim(); S.name = $('#st-name').value.trim(); if ($('#st-code')) S.code = $('#st-code').value.trim();
    if (S.remind.on && wasOn && !S.pushId && canPush()) enableReminders(); S.model = $('#st-model').value;
    $('#dlg-settings').close(); render(); toast('Ajustes guardados');
  } else if (b.id === 'st-export') {
    const data = { ...S, apiKey: '', code: '' }; const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tandas-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia descargada (sin tu clave de API)');
  } else if (b.id === 'st-import') $('#file-backup').click();
  else if (b.id === 'st-test-push') { try { const r = await pushPost('push/prueba', { id: S.pushId }); toast(r.ok ? 'Aviso enviado: te llegará en unos segundos' : 'No llegó el aviso. Desactiva y activa los recordatorios'); } catch (e) { toast('Sin conexión con el servidor'); } }
  else if (b.id === 'st-install' && installEvt) { installEvt.prompt(); installEvt = null; }
  else if (b.id === 'st-reset') {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Pulsa otra vez para borrarlo todo'; return; }
    localStorage.removeItem(KEY); S = load(); $('#dlg-settings').close(); render(); toast('Datos borrados');
  }
});
$('#file-backup').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d.P || !d.R || !d.stock) throw new Error(); const keep = { apiKey: S.apiKey, code: S.code, name: S.name }; localStorage.setItem(KEY, JSON.stringify(d)); S = load(); S.apiKey = keep.apiKey; S.code = keep.code; if (!S.name) S.name = keep.name; save(); $('#dlg-settings').close(); render(); toast('Copia importada'); }
  catch (e) { toast('Ese archivo no es una copia válida de Tandas'); }
});

/* ---------- IA: llamada a la API ---------- */
async function claude(body) {
  if (!aiReady()) throw new Error(PROXY ? 'Falta tu código de invitación. Añádelo en Ajustes.' : 'Falta la clave de API. Añádela en Ajustes.');
  const direct = !!S.apiKey;
  let res;
  try {
    res = await fetch(direct ? 'https://api.anthropic.com/v1/messages' : PROXY + 'ia', {
      method: 'POST',
      headers: direct ? { 'content-type': 'application/json', 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : { 'content-type': 'application/json', 'x-tandas-code': S.code },
      body: JSON.stringify({ model: S.model, max_tokens: 2000, ...body })
    });
  } catch (e) { throw new Error('Sin conexión con la IA. Revisa tu internet.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data && data.error && data.error.message || '';
    const t = data && data.error && data.error.type;
    if (t === 'codigo') throw new Error('Tu código de invitación no es válido. Revísalo en Ajustes.');
    if (t === 'limite') throw new Error('Has llegado al límite de uso de hoy. Mañana vuelve a funcionar.');
    if (res.status === 401) throw new Error('La clave de API no es válida. Revísala en Ajustes.');
    if (res.status === 429) throw new Error('Demasiadas peticiones o límite de gasto alcanzado. Prueba en un rato.');
    if (res.status === 404 && /model/i.test(m)) throw new Error('El modelo elegido no está disponible. Cambia de modelo en Ajustes.');
    console.error('API', res.status, m);
    if (res.status >= 500 || res.status === 529) throw new Error('La IA está saturada ahora mismo. Prueba en un minuto.');
    throw new Error('No he podido responder esta vez. Vuelve a intentarlo.');
  }
  return data;
}
function catalogText() { return Object.entries(S.P).map(([n, p]) => p.c ? `${n} | botes (ud) | ${p.f} (1 bote = ${p.g} ${p.gu || 'g'}) | CONSUMIBLE` : `${n} | ${p.u} | ${p.f} (${p.q} ${p.u})`).join('\n'); }

/* ---------- Escanear ticket ---------- */
let RV = null;
function openScan() {
  $('#scan-in').innerHTML = `
    <div class="sheet-head"><h2>Escanear ticket</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <p class="lead">Haz una foto al ticket o elige una de la galería. ${aiReady() ? 'La IA lo leerá y podrás revisarlo antes de guardar.' : `Para leerlo automáticamente añade tu ${PROXY ? 'código de invitación' : 'clave de API'} en Ajustes; mientras, puedes apuntarlo a mano.`}</p>
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
          tienda: { type: 'string' }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, total: { type: 'number', description: 'Total pagado, en la moneda del ticket' },
          lineas: {
            type: 'array', items: {
              type: 'object', required: ['desc', 'uds', 'importe', 'producto', 'cantidad_inventario', 'tipo'], properties: {
                desc: { type: 'string', description: 'Texto de la línea tal como aparece' },
                uds: { type: 'number', description: 'Unidades o paquetes comprados' },
                importe: { type: 'number', description: 'Importe total de la línea, en la moneda del ticket' },
                nombre_comun: { type: ['string', 'null'], description: 'Nombre genérico y corto del producto tal como se dice normalmente en el país del ticket, sin marca ni peso (p. ej. Guineo, Fréjol rojo, Papa chola → Papa)' }, producto: { type: ['string', 'null'], description: 'Nombre EXACTO del catálogo o null si no encaja' },
                cantidad_inventario: { type: 'number', description: 'Cantidad que entra a la despensa en la unidad del producto del catálogo (g, ml o ud). 0 si producto es null' },
                tipo: { type: 'string', enum: ['De la lista', 'Extra', 'Hogar'] }, producto_hogar: { type: ['string', 'null'], description: 'Solo si tipo es Hogar: nombre corto y genérico (p. ej. Champú, Lavavajillas a mano); usa el de la lista de hogar si existe' }, categoria_hogar: { type: ['string', 'null'], enum: HCATS.concat([null]) },
                grupo: { type: ['string', 'null'], enum: EXTRA_GROUPS.concat([null]) },
                es_snack: { type: 'boolean', description: 'true solo si es algo para picar entre horas: galletas, barritas, chocolate, dulces, golosinas, snacks salados, helados, bollería. false para ingredientes de cocina y productos de uso largo (aceite, harina, azúcar, arroz, especias, salsas, mermelada, leche…)' }
              }
            }
          }
        }
      }
    };
    const prompt = `Lee este ticket. Hoy es ${new Date().toISOString().slice(0, 10)}.
Catálogo de productos (nombre | unidad | formato):
${catalogText()}

Equivalencias aprendidas (texto del ticket → producto): ${JSON.stringify(S.alias)}${REG().names ? `\nEl ticket es de ${REG().name} (supermercados como Supermaxi, Megamaxi, Tía, Mi Comisariato o Santa María). Allí los productos tienen otros nombres; equivalencias (nombre del catálogo = nombre local): ${Object.entries(locNames() || REG().names).map(([a, b]) => a + ' = ' + b).join('; ')}. Devuelve siempre el nombre del catálogo.` : ''}
Productos que hacen falta para el menú de la semana: ${plan.join(', ') || 'ninguno'}

Reglas:
- Una línea por producto del ticket; ignora IVA, tarjeta y totales parciales. Si el ticket está en otra moneda, usa el importe en euros.
- producto: el nombre exacto del catálogo si es claramente ese producto; si no, null.
- cantidad_inventario: uds × tamaño del formato del catálogo, en su unidad (ejemplo: 2 paquetes de quinoa de 250 g = 500). Para fruta al peso usa el peso o las unidades según la unidad del catálogo. Para productos CONSUMIBLES (especias, sazonadores) es el número de botes, no los gramos (2 botes de comino = 2).
- tipo "Hogar": todo lo que no se come ni se bebe: aseo personal (pasta de dientes, champú, gel, desodorante, papel higiénico), limpieza (lavavajillas, esponjas, detergente, lejía) y cosas de casa (fundas o bolsas de basura, papel de cocina, aluminio, film, servilletas, pilas). En ese caso producto = null, cantidad_inventario = número de unidades, y rellena producto_hogar y categoria_hogar. Productos de hogar ya conocidos: ${Object.keys(S.HP).join(', ')}.
- es_snack: true solo para galletas, barritas, chocolate, dulces, golosinas, snacks salados, helados o bollería; false para ingredientes de cocina y productos de uso largo (aceite, harina, azúcar, salsas…).
- tipo: "De la lista" si es comida básica de cocinar o un producto del catálogo usado en recetas; "Extra" si es dulce, capricho, snack o bebida no planificada. Si es Extra, elige grupo.`;
    const data = await claude({ tools: [tool], tool_choice: { type: 'tool', name: 'registrar_ticket' }, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] });
    const tu = (data.content || []).find(c => c.type === 'tool_use'); if (!tu) throw new Error('La IA no devolvió el ticket. Prueba con otra foto.');
    const x = tu.input;
    RV = { tienda: x.tienda || '', fecha: (x.fecha || '').slice(0, 10) || new Date().toISOString().slice(0, 10), total: Number(x.total) || 0, lineas: (x.lineas || []).map(l => { const sn = l.es_snack === true && l.tipo !== 'Hogar' && !S.P[l.producto]; return { es_snack: sn, desc: l.desc || '', uds: Number(l.uds) || 1, importe: Number(l.importe) || 0, producto: S.P[l.producto] ? l.producto : sn ? '__new' : '', inv: sn ? Number(l.uds) || 1 : Number(l.cantidad_inventario) || 0, tipo: sn ? 'Extra' : ['Extra', 'Hogar'].includes(l.tipo) ? l.tipo : 'De la lista', grupo: sn ? 'Dulces y antojos' : l.grupo || 'Otros', ncom: l.nombre_comun || '', hprod: l.producto_hogar || (l.tipo === 'Hogar' ? l.desc : ''), hcat: HCATS.includes(l.categoria_hogar) ? l.categoria_hogar : 'Otros' }; }) };
    renderReview();
  } catch (e) {
    $('#scan-in').innerHTML = `<div class="sheet-head"><h2>No se pudo leer</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div><div class="check bad">${esc(e.message)}</div><button type="button" class="btn ghost wide" id="sc-manual">Apuntarlo a mano</button>`;
  }
}
function prodOptions(sel) { return `<option value="">— Solo gasto —</option><option value="__new">＋ Crear producto nuevo</option>` + Object.keys(S.P).sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join(''); }
function renderReview() {
  const sum = RV.lineas.reduce((a, l) => a + (Number(l.importe) || 0), 0); const diff = r2(RV.total - sum);
  $('#scan-in').innerHTML = `
    <div class="sheet-head"><h2>Revisa el ticket</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>
    <div class="grid2"><label class="field">Tienda<input data-rv="tienda" value="${esc(RV.tienda)}"></label><label class="field">Fecha<input type="date" data-rv="fecha" value="${esc(RV.fecha)}"></label></div>
    <label class="field">Total pagado (${SYM()})<input type="number" step="0.01" inputmode="decimal" data-rv="total" value="${RV.total}"></label>
    <div class="check ${Math.abs(diff) < 0.02 ? 'ok' : 'bad'}">${Math.abs(diff) < 0.02 ? `✓ Las líneas suman ${eur(sum)}, cuadra con el total` : `Las líneas suman ${eur(sum)}; diferencia de ${eur(diff)} con el total`}</div>
    ${RV.lineas.map((l, i) => { const p = S.P[l.producto]; return `<div class="rv">
      <div class="rv-top"><input data-i="${i}" data-f="desc" value="${esc(l.desc)}" aria-label="Descripción"><button type="button" class="icon-btn" data-rvdel="${i}" aria-label="Quitar línea" style="width:36px;height:36px">✕</button></div>
      <div class="rv-grid">
        ${l.tipo === 'Hogar' ? `<label>Producto de casa<input data-i="${i}" data-f="hprod" list="h-names-rv" value="${esc(l.hprod || l.desc)}"></label>` : `<label>Producto<select data-i="${i}" data-f="producto">${prodOptions(l.producto)}</select></label>`}
        <label>Importe (${SYM()})<input type="number" step="0.01" inputmode="decimal" data-i="${i}" data-f="importe" value="${l.importe}"></label>
        <label>Unidades<input type="number" min="0" step="1" data-i="${i}" data-f="uds" value="${l.uds}"></label>
        ${l.tipo === 'Hogar' ? `<label>Categoría<select data-i="${i}" data-f="hcat">${HCATS.map(c => `<option ${c === l.hcat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : `<label>A la despensa (${p ? p.u : '—'})<input type="number" min="0" inputmode="decimal" data-i="${i}" data-f="inv" value="${l.inv}" ${p ? '' : 'disabled'}></label>`}
        <label>Tipo<select data-i="${i}" data-f="tipo"><option ${l.tipo === 'De la lista' ? 'selected' : ''}>De la lista</option><option ${l.tipo === 'Extra' ? 'selected' : ''}>Extra</option><option value="Hogar" ${l.tipo === 'Hogar' ? 'selected' : ''}>Hogar (no es comida)</option></select></label>
        ${l.tipo === 'Extra' ? `<label>Grupo<select data-i="${i}" data-f="grupo">${EXTRA_GROUPS.map(g => `<option ${g === l.grupo ? 'selected' : ''}>${g}</option>`).join('')}</select></label>` : ''}
      </div></div>`; }).join('')}
    <datalist id="h-names-rv">${Object.keys(S.HP).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <button type="button" class="btn ghost wide" id="rv-add">+ Añadir línea</button>
    <button type="button" class="btn wide" id="rv-save">Guardar ticket y actualizar despensa</button>`;
}
function saveReview() {
  const id = 't' + Date.now(); const lineas = []; const learn = [];
  for (const l of RV.lineas) {
    if (!l.desc && !l.importe) continue;
    if (l.tipo === 'Hogar') {
      const hn = String(l.hprod || l.desc).trim().replace(/^./, c => c.toUpperCase()); const u = Math.max(1, Math.round(Number(l.uds) || 1));
      if (!S.HP[hn]) S.HP[hn] = { cat: HCATS.includes(l.hcat) ? l.hcat : 'Otros', f: 'Unidad', p: 0, t: 0 };
      if (l.importe > 0) { S.HP[hn].p = r2(l.importe / u); S.HP[hn].t = 1; }
      S.hstock[hn] = (S.hstock[hn] || 0) + u; delete S.hwant[hn];
      lineas.push({ desc: l.desc, producto: null, hogar: hn, uds: u, importe: r2(Number(l.importe) || 0), tipo: 'Hogar', grupo: null }); continue;
    }
    let prod = l.producto || null;
    if (prod === '__new') {
      prod = l.desc.trim().toLowerCase().replace(/^./, c => c.toUpperCase());
      if (!S.P[prod]) { S.P[prod] = { f: 'Unidad', p: r2((l.importe || 0) / (l.uds || 1)), q: 1, u: 'ud', t: 1 }; if (l.es_snack) S.P[prod].snack = 1; const cat = (l.es_snack && S.CATS.find(c => c.name === 'Dulces y snacks')) || S.CATS[S.CATS.length - 1]; cat.items.push(prod); }
      l.inv = l.inv || l.uds || 1;
    }
    if (prod && S.P[prod]) {
      if (S.cart) delete S.cart[prod];
      if (l.inv > 0) { S.stock[prod] = r2((S.stock[prod] || 0) + Number(l.inv)); if (isC(prod)) { S.since[prod] = new Date(RV.fecha + 'T12:00').getTime() || Date.now(); delete S.want[prod]; delete S.snz[prod]; } }
      if (l.uds > 0 && l.importe > 0 && S.P[prod].q && l.inv > 0) { const packs = l.inv / S.P[prod].q; if (packs > 0) { S.P[prod].p = r2(l.importe / packs); S.P[prod].t = 1; } }
      S.alias[l.desc.toUpperCase()] = prod;
      const nc = String(l.ncom || '').trim().replace(/^./, c => c.toUpperCase());
      if (S.region !== 'ES' && nc && nc.toLowerCase() !== prod.toLowerCase()) { S.lname = S.lname || {}; S.lname[prod] = nc; LOC_FOR = null; }
      if (l.inv > 0 && l.importe > 0) learn.push({ p: prod, pu: r2(l.importe / l.inv * 10000) / 10000, n: S.region !== 'ES' ? nc : '' });
    }
    lineas.push({ desc: l.desc, producto: prod, inv: prod && S.P[prod] ? Number(l.inv) || 0 : 0, uds: Number(l.uds) || 1, importe: r2(Number(l.importe) || 0), tipo: l.tipo, grupo: l.tipo === 'Extra' ? l.grupo : null });
  }
  S.tickets.push({ id, fecha: RV.fecha, tienda: RV.tienda || 'Tienda', total: r2(Number(RV.total) || lineas.reduce((a, l) => a + l.importe, 0)), lineas });
  if (learn.length && PROXY && S.code) pushPost('comunidad/aprende', { region: S.region, items: learn }).catch(() => {});
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
  if (f === 'hprod' && S.HP[l.hprod]) l.hcat = S.HP[l.hprod].cat;
  if (['producto', 'tipo', 'importe', 'uds', 'hprod'].includes(f)) renderReview();
});
for (const id of ['#file-cam', '#file-gal']) $(id).addEventListener('change', ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (!aiReady()) { RV = { tienda: '', fecha: new Date().toISOString().slice(0, 10), total: 0, lineas: [{ desc: '', uds: 1, importe: 0, producto: '', inv: 0, tipo: 'De la lista', grupo: 'Otros' }] }; renderReview(); toast('Sin IA configurada: apúntalo a mano'); return; }
  readTicket(f);
});

/* ---------- Asistente ---------- */
const AI_TOOLS = [
  { name: 'ajustar_despensa', description: 'Cambia la cantidad de un producto de la despensa.', input_schema: { type: 'object', required: ['producto', 'cantidad', 'modo'], properties: { producto: { type: 'string', description: 'Nombre exacto del catálogo' }, cantidad: { type: 'number', description: 'En la unidad del producto (g, ml o ud)' }, modo: { type: 'string', enum: ['sumar', 'restar', 'fijar'] } } } },
  { name: 'crear_producto', description: 'Crea un producto nuevo en el catálogo.', input_schema: { type: 'object', required: ['nombre', 'unidad', 'formato', 'precio', 'cantidad_formato', 'categoria'], properties: { nombre: { type: 'string' }, unidad: { type: 'string', enum: ['g', 'ml', 'ud'] }, formato: { type: 'string', description: 'Ej.: Paquete 500 g' }, precio: { type: 'number', description: 'Precio del formato en la moneda del usuario' }, cantidad_formato: { type: 'number' }, categoria: { type: 'string', enum: NEWCATS.map(c => c[0]) }, consumible: { type: 'boolean', description: 'true para especias, sazonadores y condimentos secos: se cuentan por botes y no se descuentan al cocinar' }, cantidad_en_casa: { type: 'number', description: 'En la unidad del producto; si es consumible, número de botes' } } } },
  { name: 'ajustar_hogar', description: 'Cambia la cantidad de un producto de casa (aseo personal, limpieza, cocina y hogar). Lo crea si no existe. Úsalo para todo lo que no es comida.', input_schema: { type: 'object', required: ['producto', 'cantidad', 'modo'], properties: { producto: { type: 'string', description: 'Nombre corto y genérico, p. ej. Champú' }, cantidad: { type: 'integer', description: 'Unidades' }, modo: { type: 'string', enum: ['sumar', 'restar', 'fijar', 'a_la_lista'] }, categoria: { type: 'string', enum: HCATS } } } },
  { name: 'recordar_habito', description: 'Guarda una nota corta y estable sobre los hábitos, gustos o rutina de consumo del usuario, para recordarla aunque se borre el chat.', input_schema: { type: 'object', required: ['nota'], properties: { nota: { type: 'string', description: 'Una frase corta, p. ej. "Suele cenar 2 fajas de pavo"' } } } },
  { name: 'anotar_snack', description: 'Anota un snack o picoteo entre horas hecho con un producto de la despensa y lo descuenta.', input_schema: { type: 'object', required: ['producto', 'cantidad'], properties: { producto: { type: 'string', description: 'Nombre exacto del catálogo' }, cantidad: { type: 'number', description: 'En la unidad del producto' } } } },
  { name: 'anadir_a_semana', description: 'Añade platos de una receta al menú de la semana.', input_schema: { type: 'object', required: ['receta_id', 'platos'], properties: { receta_id: { type: 'string' }, platos: { type: 'integer', minimum: 1 } } } },
  { name: 'quitar_de_semana', description: 'Quita una receta del menú de la semana.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' } } } },
  { name: 'anotar_comida', description: 'Anota que el usuario se comió raciones de una receta. Descuenta de lo cocinado o, si era al momento, de la despensa.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' }, raciones: { type: 'integer', minimum: 1 } } } },
  { name: 'marcar_cocinado', description: 'Marca como cocinada la tanda de una receta de la semana y descuenta sus ingredientes.', input_schema: { type: 'object', required: ['receta_id'], properties: { receta_id: { type: 'string' } } } },
  { name: 'cambiar_presupuesto', description: 'Cambia el presupuesto semanal.', input_schema: { type: 'object', required: ['euros'], properties: { euros: { type: 'number' } } } },
  { name: 'gestionar_recetario', description: 'Añade o quita una receta de "Mi recetario".', input_schema: { type: 'object', required: ['receta_id', 'accion'], properties: { receta_id: { type: 'string' }, accion: { type: 'string', enum: ['anadir', 'quitar'] } } } },
  { name: 'crear_receta', description: 'Crea una receta nueva con ingredientes del catálogo y la añade a Mi recetario.', input_schema: { type: 'object', required: ['nombre', 'tipos', 'raciones', 'apta_tanda', 'ingredientes', 'pasos'], properties: { nombre: { type: 'string' }, tipos: { type: 'array', items: { type: 'string', enum: ['desayuno', 'almuerzo', 'cena', 'snack', 'postre', 'bebida'] } }, raciones: { type: 'integer', minimum: 1 }, apta_tanda: { type: 'boolean' }, ingredientes: { type: 'array', items: { type: 'object', required: ['producto', 'cantidad'], properties: { producto: { type: 'string' }, cantidad: { type: 'number', description: 'Para toda la receta, en la unidad del producto' }, opcional: { type: 'boolean' }, kcal_por_unidad: { type: 'number' } } } }, pasos: { type: 'array', items: { type: 'string' } } } } }
];
function runTool(name, x) {
  const findR = id => byId(id) || S.R.find(r => r.n.toLowerCase() === String(id).toLowerCase());
  if (name === 'ajustar_despensa') {
    const p = S.P[x.producto]; if (!p) return `Error: "${x.producto}" no está en el catálogo.`;
    const cur = S.stock[x.producto] || 0; const v = x.modo === 'sumar' ? cur + x.cantidad : x.modo === 'restar' ? cur - x.cantidad : x.cantidad;
    if (p.c && v > cur) { S.since[x.producto] = Date.now(); delete S.want[x.producto]; delete S.snz[x.producto]; }
    if (v > 1e-6) S.stock[x.producto] = r2(v); else delete S.stock[x.producto];
    return `OK. ${x.producto}: ${fmtQ(Math.max(0, v), p.u)} en casa.`;
  }
  if (name === 'crear_producto') {
    if (S.P[x.nombre]) return `Ya existe "${x.nombre}".`;
    S.P[x.nombre] = x.consumible ? { f: x.formato, p: r2(x.precio), q: 1, u: 'ud', c: 1, g: x.cantidad_formato || 1, gu: x.unidad === 'ml' ? 'ml' : 'g', t: 0 } : { f: x.formato, p: r2(x.precio), q: x.cantidad_formato || 1, u: x.unidad, t: 0 };
    if (x.consumible && !x.categoria) x.categoria = 'Especias y condimentos';
    if (x.consumible && x.cantidad_en_casa > 0) S.since[x.nombre] = Date.now();
    const ci = S.CATS.findIndex(c => c.name.toLowerCase() === String(x.categoria).toLowerCase()); (S.CATS[ci >= 0 ? ci : S.CATS.length - 1]).items.push(x.nombre);
    if (x.cantidad_en_casa > 0) S.stock[x.nombre] = x.cantidad_en_casa;
    return `OK. Producto "${x.nombre}" creado.`;
  }
  if (name === 'ajustar_hogar') {
    const n = String(x.producto || '').trim().replace(/^./, c => c.toUpperCase()); if (!n) return 'Error: falta el producto.';
    if (!S.HP[n]) S.HP[n] = { cat: HCATS.includes(x.categoria) ? x.categoria : 'Otros', f: 'Unidad', p: 0, t: 0 };
    if (x.modo === 'a_la_lista') { S.hwant[n] = 1; return `OK. ${n} en la lista de compra de casa.`; }
    const cur = S.hstock[n] || 0; const v = Math.max(0, Math.round(x.modo === 'sumar' ? cur + x.cantidad : x.modo === 'restar' ? cur - x.cantidad : x.cantidad));
    if (v > 0) { S.hstock[n] = v; delete S.hwant[n]; } else delete S.hstock[n];
    return `OK. ${n}: ${v} en casa.`;
  }
  if (name === 'recordar_habito') { const t = String(x.nota || '').trim().slice(0, 160); if (!t) return 'Error: nota vacía.'; if ((S.habits || []).some(h => h.t.toLowerCase() === t.toLowerCase())) return 'Ya lo tenía apuntado.'; S.habits = (S.habits || []).concat({ t, ts: Date.now() }).slice(-40); return `OK. Apuntado: ${t}`; }
  if (name === 'anotar_snack') { const p = S.P[x.producto]; if (!p) return `Error: "${x.producto}" no está en el catálogo.`; const c = eatSnack(x.producto, Number(x.cantidad) || 0); return c === null ? 'Error: cantidad no válida.' : `OK. Snack: ${fmtQ(x.cantidad, p.u)} de ${x.producto} (${eur(c)}).`; }
  if (name === 'anadir_a_semana') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; const it = S.plan.find(p => p.rid === r.id && !p.cocinado); if (it) it.veces += x.platos; else S.plan.push({ k: S.seq++, rid: r.id, veces: x.platos, opc: false }); if (!S.mine.includes(r.id)) S.mine.push(r.id); return `OK. ${r.n}: +${x.platos} platos en la semana.`; }
  if (name === 'quitar_de_semana') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; S.plan = S.plan.filter(p => p.rid !== r.id); return `OK. ${r.n} quitada de la semana.`; }
  if (name === 'anotar_comida') {
    const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; const n = x.raciones || 1;
    for (let i = 0; i < n; i++) { const it = S.plan.find(p => p.rid === r.id); if (it) eatOne(it); else { const d = deduct(r, 1, false, null); const t = mealOf(r); if (t) S.eaten[t] = (S.eaten[t] || 0) + 1; logMeal(t, r.n, d.cost); } }
    return `OK. Anotadas ${n} raciones de ${r.n}.`;
  }
  if (name === 'marcar_cocinado') { const r = findR(x.receta_id); const it = r && S.plan.find(p => p.rid === r.id && !p.cocinado); if (!it) return 'Error: esa receta no está pendiente en la semana.'; const m = deductMsg(cook(it)); return `OK. ${r.n} cocinado; despensa descontada.${m ? ' ' + m + '.' : ''}`; }
  if (name === 'cambiar_presupuesto') { S.budget = Math.max(0, x.euros); return `OK. Presupuesto: ${eur(S.budget)}.`; }
  if (name === 'gestionar_recetario') { const r = findR(x.receta_id); if (!r) return 'Error: receta no encontrada.'; if (x.accion === 'anadir') { if (!S.mine.includes(r.id)) S.mine.push(r.id); } else S.mine = S.mine.filter(i => i !== r.id); return `OK. ${r.n} ${x.accion === 'anadir' ? 'añadida a' : 'quitada de'} Mi recetario.`; }
  if (name === 'crear_receta') {
    const bad = x.ingredientes.filter(g => !S.P[g.producto]).map(g => g.producto); if (bad.length) return `Error: estos productos no existen en el catálogo: ${bad.join(', ')}. Créalos primero con crear_producto.`;
    const old = S.R.find(r => r.n.trim().toLowerCase() === x.nombre.trim().toLowerCase());
    if (old) { Object.assign(old, { tipos: x.tipos, rac: x.raciones, tanda: x.apta_tanda ? 1 : 0, i: x.ingredientes.map(g => g.opcional ? [g.producto, g.cantidad, 1] : [g.producto, g.cantidad]) }); S.STEPS[old.id] = x.pasos; if (!S.mine.includes(old.id)) S.mine.push(old.id); return `OK. Receta "${old.n}" actualizada. Coste por ración: ${eur(perRacion(old, false))}.`; }
    let id = x.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'receta'; while (byId(id)) id += '-2';
    S.R.push({ id, n: x.nombre, tipos: x.tipos, rac: x.raciones, tanda: x.apta_tanda ? 1 : 0, i: x.ingredientes.map(g => g.opcional ? [g.producto, g.cantidad, 1] : [g.producto, g.cantidad]) });
    for (const g of x.ingredientes) if (g.kcal_por_unidad && S.K[g.producto] === undefined) S.K[g.producto] = g.kcal_por_unidad;
    S.STEPS[id] = x.pasos; S.mine.push(id); return `OK. Receta "${x.nombre}" creada con id ${id}. Coste por ración: ${eur(perRacion(byId(id), false))}.`;
  }
  return 'Herramienta desconocida.';
}
function habitStats() {
  const since = Date.now() - 30 * 864e5; const log = (S.log || []).filter(x => x.ts >= since && x.n);
  if (!log.length) return 'Aún no hay suficientes datos de lo que come.';
  const by = {}; const hours = {};
  for (const x of log) { const k = `${x.n} (${x.t})`; by[k] = (by[k] || 0) + 1; const h = new Date(x.ts).getHours(); (hours[x.t] = hours[x.t] || []).push(h); }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ×${n}`).join('; ');
  const hrs = Object.entries(hours).map(([t, hs]) => `${t} hacia las ${Math.round(hs.reduce((a, b) => a + b, 0) / hs.length)}h`).join(', ');
  const days = new Set(log.map(x => dayKey(new Date(x.ts)))).size;
  return `Últimos 30 días (${days} días con registros): lo que más come: ${top}. Horas habituales: ${hrs}.`;
}
function aiContext() {
  const stock = Object.entries(S.stock).map(([n, q]) => `${n}: ${fmtQ(q, S.P[n] ? S.P[n].u : 'ud')}`).join('; ');
  const plan = S.plan.map(p => `${byId(p.rid).n} [${p.rid}] ×${p.veces}${p.cocinado ? ` (cocinado, quedan ${leftOf(p)})` : ''}`).join('; ') || 'vacío';
  const recs = S.R.map(r => `${r.id}: ${r.n} (${r.tipos.join('/')}${S.mine.includes(r.id) ? ', en Mi recetario' : ''})`).join('\n');
  const si = spentInfo(); const pend = shop(S.plan).total;
  const recent = S.chat.filter(m => (m.r === 'u' || m.r === 'a' || m.r === 't') && !isErr(m)).slice(-9, -1).map(m => (m.r === 'u' ? 'Usuario: ' : m.r === 't' ? 'Hecho: ' : 'Tú: ') + m.t).join('\n');
  return `Eres el asistente de la app Tandas: llevas la despensa, el menú y el gasto en comida de ${S.name || 'la persona que usa la app'}.
REGLA PRINCIPAL: atiende SOLO su último mensaje. La conversación anterior ya está procesada y sus cambios ya están guardados en la despensa: NUNCA repitas una acción de un mensaje anterior. Úsala solo para entender a qué se refiere ("la otra", "eso", "también").
Precisión (muy importante):
- Antes de tocar nada, identifica cada producto del catálogo, la cantidad y la operación. "Usé / puse / gasté X" = restar X. "Compré / me han dado X" = sumar X. "Me queda / tengo / hay X" = fijar X. "Me comí N de una receta" = anotar_comida (no restes además sus ingredientes). "Cociné la tanda" = marcar_cocinado.
- Si dice qué le puso a un plato que se comió (p. ej. "en la faja puse 60 g de champiñones y mostaza"), resta esos ingredientes con ajustar_despensa uno por uno.
- Conversiones: 1 kg = 1000 g; 1 L = 1000 ml; cucharada ≈ 15 g o ml; cucharadita ≈ 5; chorrito ≈ 10 ml; "un poco" de salsa ≈ 10 g; loncha de fiambre ≈ 15 g; loncha de queso = 1 ud; puñado ≈ 30 g; huevo = 1 ud. Usa la unidad del producto en el catálogo.
- Si no encuentras el producto en el catálogo o hay dos que encajan igual, pregunta en una frase corta cuál es, en vez de adivinar. Si solo falta la cantidad, usa la conversión razonable y dila.
- Al confirmar, da las cifras finales que devuelven las herramientas (cuánto queda), no las calcules tú.
- Si te pide algo que no puedes hacer con tus herramientas, dilo claro en una frase.
Lo que sabes de sus hábitos (guárdalo en cuenta para sugerencias y para entenderle): ${habitStats()}${(S.habits || []).length ? '\nNotas que has guardado sobre él: ' + S.habits.map(h => h.t).join(' | ') : ''}
Cuando te cuente algo estable de sus gustos o rutina (qué desayuna siempre, que no come arroz, cuántas fajas suele comer, cuándo hace la compra…), guárdalo con recordar_habito en una frase corta. No guardes cosas de un solo día.
${recent ? 'Conversación reciente (YA PROCESADA, solo contexto):\n' + recent : ''}
Cómo hablas:
- Como un colega español que le echa una mano en la cocina: natural, cercano, de tú. Nada de tono de robot ni de atención al cliente.
- Corto: una o dos frases. Si hiciste un cambio, di qué cambiaste y cuánto queda, y ya. Ejemplo: "Hecho, te quedan 190 g de champiñones y he quitado un poco de mostaza y de barbacoa."
- Texto plano. Prohibido usar asteriscos, almohadillas, negritas, listas con guiones, emojis o tablas: la app no los muestra bien.
- No empieces con "¡Claro!", "¡Perfecto!", "Entendido" ni similares, no repitas lo que te ha dicho, no expliques qué herramientas usas y no ofrezcas más ayuda al final.
- Si algo es ambiguo, haz la suposición más razonable (por ejemplo, "un poco" de una salsa son unos 10 g) y menciónala de pasada.
Usa siempre los nombres exactos del catálogo y los id de receta en las herramientas, pero al hablar usa nombres normales.
Consumibles: las especias, sazonadores y condimentos secos (pimienta, comino, ajo en polvo…) son consumibles. En la despensa se cuentan por botes, no por gramos, y no se descuentan al cocinar; en las recetas sí van en gramos para calcular el coste. Si creas un producto de este tipo, márcalo con consumible: true y su cantidad_formato son los gramos del bote. Los alimentos (carne, verdura, salsas, aceite, etc.) no son consumibles.
Casa: lo que no es comida (champú, pasta de dientes, detergente, esponjas, fundas de basura…) va aparte, con ajustar_hogar, nunca en la despensa de comida ni en el presupuesto de comida. Productos de casa que tiene: ${Object.entries(S.hstock).map(([n, q]) => n + ': ' + q).join('; ') || 'ninguno'}.
Snacks: si dice que ha picado algo entre horas (una barrita, un yogur, unas galletas), anótalo con anotar_snack.
Recetas nuevas: si te cuenta una receta suya o te pide añadir una, guárdala con crear_receta sin pedir permiso. Si falta algún ingrediente en el catálogo, créalo antes con crear_producto (formato típico del súper y precio estimado en su moneda). Cantidades para toda la receta, en la unidad del producto. Si no dice raciones, pon 1 en desayunos y cenas al momento y 5 en tandas de almuerzo. Pasos cortos y claros. Si cambia algo de una receta ya creada, crea la versión nueva con el mismo nombre. Al terminar, confirma en una frase con el nombre, las raciones y lo que cuesta más o menos cada ración.
Hoy: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
País: ${REG().name}. Moneda: ${REG().currency} (habla de precios en esa moneda).${REG().names ? ' Habla con los nombres que se usan en ' + REG().name + ' (en las herramientas usa siempre el nombre del catálogo). Equivalencias: ' + Object.entries(locNames() || REG().names).map(([a, b]) => a + ' = ' + b).join('; ') + '.' : ''}\nPresupuesto semanal: ${eur(S.budget)}. Gastado esta semana: ${eur(si.spent)} (extras ${eur(si.extras)}). Falta comprar para el menú: ${eur(pend)}. Comensales: ${S.adults} adultos, ${S.kids} niños.
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
    ${aiReady() ? '' : `<div class="check bad">Añade tu ${PROXY ? 'código de invitación' : 'clave de API'} en Ajustes para usar el asistente.</div>`}
    <div class="chat" id="chat" aria-live="polite">${msgs.length ? msgs.filter(m => !isErr(m)).map(m => `<div class="msg ${m.r}">${esc(m.r === 'a' ? plain(m.t) : m.t)}</div>`).join('') : `<div class="msg a">Hola${S.name ? ', ' + esc(S.name) : ''}. Dime qué has comido, qué te sobró o qué quieres cocinar y lo apunto por ti.</div>`}${busy ? '<div class="msg a"><span class="spinner"></span></div>' : ''}</div>
    ${aiUndo && !busy ? '<button type="button" class="btn ghost small" data-undo style="justify-self:start">Deshacer lo último que hizo</button>' : ''}
    <details class="habits"><summary>Lo que el asistente sabe de ti (${(S.habits || []).length})</summary>${(S.habits || []).length ? `<ul>${S.habits.map((h, i) => `<li><span>${esc(h.t)}</span><button type="button" class="link" data-habit-del="${i}" aria-label="Olvidar">Olvidar</button></li>`).join('')}</ul>` : '<p class="small muted">Aún nada. Cuéntale tus costumbres («siempre desayuno yogur», «los lunes hago la compra») y lo recordará aunque borres el chat.</p>'}<p class="small muted">Además aprende solo de lo que marcas como comido.</p></details>
    <div class="sugs">${['Me comí 2 griegos de limón', '¿Qué ceno hoy con lo que tengo?', 'Sobró medio paquete de queso rallado', 'Añade 3 tomates a la despensa'].map(s => `<button type="button" class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="chat-in" id="chat-form"><input id="chat-text" autocomplete="off" placeholder="Escribe aquí…" aria-label="Mensaje"><button type="submit" class="btn" ${busy ? 'disabled' : ''}>Enviar</button></form>`;
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
}
function plain(t) { return t.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/\n{3,}/g, '\n\n').trim(); }
function isErr(m) { return m.r === 'a' && /^La IA respondió con un error/.test(m.t); }
const UNDO_KEYS = ['stock', 'hstock', 'hwant', 'plan', 'P', 'R', 'STEPS', 'mine', 'CATS', 'HP', 'snacks', 'log', 'budget', 'since', 'want', 'snz', 'eaten', 'habits'];
let aiUndo = null;
function openAI() {
  const today = dayKey(new Date()); if (S.chatDay !== today) { S.chat = []; S.chatDay = today; aiUndo = null; save(); } /* el chat empieza limpio cada día; lo aprendido se queda */ renderAI(false); $('#dlg-ai').showModal(); }
let aiBusy = false;
async function sendAI(text) {
  if (!text.trim() || aiBusy) return;
  S.chat.push({ r: 'u', t: text.trim() }); aiBusy = true; renderAI(true); save();
  const snap = JSON.stringify(UNDO_KEYS.map(k => S[k])); let changed = false;
  try {
    const messages = [{ role: 'user', content: text.trim() }]; let loops = 0;
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
      const results = uses.map(u => { let out; try { out = runTool(u.name, u.input || {}); } catch (e) { out = 'Error: ' + e.message; } if (out.startsWith('OK')) { changed = true; S.chat.push({ r: 't', t: '✓ ' + out.slice(4) }); } return { type: 'tool_result', tool_use_id: u.id, content: out }; });
      messages.push({ role: 'user', content: results });
      render();
    }
  } catch (e) { S.chat.push({ r: 'e', t: e.message }); }
  aiUndo = changed ? snap : null;
  aiBusy = false; render(); renderAI(false);
}
$('#dlg-ai').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.close !== undefined) return $('#dlg-ai').close();
  if (b.dataset.clear !== undefined) { S.chat = []; aiUndo = null; save(); toast('Chat borrado. Lo que sabe de ti y tus datos se quedan'); return renderAI(false); }
  if (b.dataset.undo !== undefined && aiUndo) { const v = JSON.parse(aiUndo); UNDO_KEYS.forEach((k, i) => { S[k] = v[i]; }); aiUndo = null; S.chat.push({ r: 't', t: '↩ Deshecho: la despensa vuelve a como estaba antes del último mensaje' }); render(); return renderAI(false); }
  if (b.dataset.habitDel !== undefined) { S.habits.splice(Number(b.dataset.habitDel), 1); save(); return renderAI(false); }
  if (b.dataset.sug) sendAI(b.dataset.sug);
});
$('#dlg-ai').addEventListener('submit', ev => { ev.preventDefault(); const i = $('#chat-text'); const v = i.value; i.value = ''; sendAI(v); });
for (const d of ['#dlg-settings', '#dlg-scan', '#dlg-ai']) $(d).addEventListener('click', ev => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

/* ---------- Nombres locales según el país (solo lo que se ve; por dentro no cambia) ---------- */
let LOC = null, LOC_RE = null, LOC_FOR = null;
// Nombres que se ven: los del país, mejorados con lo que aprende la comunidad y, por encima, con los de tus propios tickets
function locNames() { const r = REG(); if (S.region === 'ES' || !r.names) return null; return Object.assign({}, r.names, S.cname || {}, S.lname || {}); }
function buildLoc() {
  const r = REG(); LOC_FOR = S.region;
  if (!r.names && !r.words) { LOC = null; LOC_RE = null; return; }
  const names = locNames() || r.names || {};
  const m = {}; const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  for (const [a, b] of Object.entries(r.words || {})) { m[a] = b; m[cap(a)] = cap(b); }
  for (const [a, b] of Object.entries(names)) { m[a] = b; m[a.toLowerCase()] = b.toLowerCase(); }
  for (const v of Object.values(m)) if (!(v in m)) m[v] = v; // lo ya traducido se queda igual
  LOC = m; const keys = Object.keys(m).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  LOC_RE = new RegExp('(?<![\\p{L}])(' + keys.join('|') + ')(?![\\p{L}])', 'gu');
}
function locText(t) { if (LOC_FOR !== S.region) buildLoc(); return LOC_RE && t ? t.replace(LOC_RE, x => LOC[x] || x) : t; }
function localize(root) {
  if (LOC_FOR !== S.region) buildLoc(); if (!LOC_RE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT; if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const v = n.nodeValue; if (!v || !v.trim()) continue; const nv = v.replace(LOC_RE, x => LOC[x] || x); if (nv !== v) n.nodeValue = nv; }
}
new MutationObserver(ms => { if (S.region !== 'EC' && LOC_FOR === S.region) return; for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1) localize(n); else if (n.nodeType === 3 && n.parentNode) localize(n.parentNode); } }).observe(document.body, { childList: true, subtree: true });

/* ---------- Aprendizaje de la comunidad: precios y nombres de otros usuarios del mismo país ---------- */
async function syncCommunity(force) {
  if (!PROXY || !S.code) return; const today = dayKey(new Date()); if (!force && S.comDay === today) return;
  try {
    const r = await pushPost('comunidad/leer', { region: S.region }); if (!r || !r.ok) return;
    let n = 0;
    for (const [prod, pu] of Object.entries(r.precios || {})) { const p = S.P[prod]; if (!p || p.t === 1 || !(pu > 0)) continue; const np = r2(pu * p.q); if (np > 0 && np !== p.p) { p.p = np; p.cp = 1; n++; } }
    S.cname = S.region !== 'ES' ? (r.nombres || {}) : {}; S.comDay = today; LOC_FOR = null; save(); render();
  } catch (e) {}
}

/* ---------- Tema ---------- */
const THEME_FONTS = { confianza: 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800', fresco: 'family=Sora:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700' };
const THEME_BG = { grafito: '#121315', confianza: '#F4F6FA', fresco: '#F3F6F2' };
function applyTheme() {
  const t = THEME_BG[S.theme] ? S.theme : 'grafito'; document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', THEME_BG[t]);
  if (THEME_FONTS[t] && !document.getElementById('font-' + t)) { const l = document.createElement('link'); l.id = 'font-' + t; l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${THEME_FONTS[t]}&display=swap`; document.head.appendChild(l); }
}
applyTheme();

/* ---------- Recordatorios ---------- */
const REM = [
  ['desayuno', 'No te olvides de la comida más importante del día, prepárate tu desayuno', 'Desayuno'],
  ['almuerzo', 'No te olvides de almorzar, es importante para tu salud', 'Almuerzo'],
  ['cena', 'No te olvides de cenar, también es importante para que duermas bien!', 'Cena']
];
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function dueReminders(now = new Date()) {
  if (!S.remind || !S.remind.on) return [];
  return REM.filter(([t]) => {
    const [h, m] = String(S.remind[t] || '').split(':').map(Number); if (isNaN(h)) return false;
    const at = new Date(now); at.setHours(h, m || 0, 0, 0);
    const ate = (S.log || []).some(x => x.t === t && dayKey(new Date(x.ts)) === dayKey(now));
    return now >= at && now - at < 3 * 36e5 && !ate && S.remind.sent[t] !== dayKey(now);
  });
}
async function notify(t, msg) {
  try { if ('Notification' in window && Notification.permission === 'granted') { const reg = await navigator.serviceWorker.ready; await reg.showNotification('Tandas', { body: msg, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tandas-' + t }); return true; } } catch (e) {}
  return false;
}
async function checkReminders() {
  if (S.pushId) return; // los manda el servidor
  await mergeSwSent();
  for (const [t, msg] of dueReminders()) {
    S.remind.sent[t] = dayKey(new Date()); save();
    if (document.hidden) notify(t, msg); else toast(msg);
  }
}
async function mirrorState() {
  try { const c = await caches.open('tandas-state'); await c.put('state', new Response(JSON.stringify({ remind: S.remind, log: S.log || [], push: !!S.pushId }))); } catch (e) {}
}
async function mergeSwSent() {
  try { const c = await caches.open('tandas-state'); const r = await c.match('swsent'); if (!r) return; const d = await r.json(); for (const k in d) if (d[k]) S.remind.sent[k] = d[k]; } catch (e) {}
}
const canPush = () => !!(PROXY && S.code && 'serviceWorker' in navigator && 'PushManager' in window);
function pushPost(path, body) { return fetch(PROXY + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tandas-code': S.code || '' }, body: JSON.stringify(body) }).then(r => r.json()); }
async function enablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) });
  const t = {}; for (const [k] of REM) t[k] = S.remind[k];
  const r = await pushPost('push/alta', { sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, t });
  if (!r.ok) throw new Error((r.error && r.error.message) || 'No se pudieron activar los avisos');
  S.pushId = r.id; save();
  const today = dayKey(new Date());
  for (const [k] of REM) if ((S.log || []).some(x => x.t === k && dayKey(new Date(x.ts)) === today)) pushPost('push/comi', { id: r.id, comida: k }).catch(() => {});
  return true;
}
async function disablePush() {
  const id = S.pushId; S.pushId = null; save();
  try { if (id) await pushPost('push/baja', { id }); const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
}
async function enableReminders() {
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {}
  if ('Notification' in window && Notification.permission === 'denied') return toast('Las notificaciones están bloqueadas: actívalas en los ajustes del móvil para Tandas');
  if ('Notification' in window && Notification.permission === 'granted' && canPush()) {
    try { await enablePush(); toast('Recordatorios activados'); } catch (e) { toast('No pude activar los avisos: ' + e.message); }
  }
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.register('tandas-recordatorio', { minInterval: 60 * 60 * 1000 }); } catch (e) {}
  mirrorState();
}
setInterval(checkReminders, 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); else mirrorState(); });

/* ---------- Ideas con lo que hay en la despensa ---------- */
let IDEAS = null; // { ai: [...] | null, busy, err }
function stockLines() { return Object.entries(S.stock).filter(([n, q]) => S.P[n] && q > 0 && !S.P[n].c).map(([n, q]) => `${n}: ${fmtQ(q, S.P[n].u)}`); }
function cookableNow() {
  return S.R.filter(r => r.i.length && r.i.some(x => !x[2] && !isC(x[0])) && canMake({ rid: r.id, opc: false, k: -1 }, 1))
    .sort((a, b) => (S.mine.includes(b.id) ? 1 : 0) - (S.mine.includes(a.id) ? 1 : 0) || b.i.length - a.i.length).slice(0, 8);
}
function renderIdeas() {
  const have = stockLines(); const rs = cookableNow();
  let h = `<div class="sheet-head"><h2>¿Qué cocino con lo que tengo?</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button></div>`;
  if (!have.length) { $('#ideas-in').innerHTML = h + '<p class="lead">Tu despensa está vacía. Compra algo desde la Lista o añádelo a mano.</p>'; return; }
  h += `<h3 style="margin:4px 0">Recetas que ya puedes hacer</h3>` + (rs.length ? `<div class="list">${rs.map(r => `<div class="card"><div class="card-head"><div><h3>${esc(r.n)}</h3><div class="small muted">${S.mine.includes(r.id) ? 'En tu recetario' : 'De Explorar'} · ${eur(perRacion(r, false))} por ración</div></div>${S.mine.includes(r.id) ? '' : `<button type="button" class="btn small" data-act="idea-mine" data-id="${r.id}">+ A mi recetario</button>`}</div></div>`).join('')}</div>` : '<p class="small muted">Con lo que tienes no te alcanza para ninguna receta completa. Prueba las ideas con IA: se inventan algo con lo que hay.</p>');
  h += `<h3 style="margin:14px 0 4px">Ideas nuevas con IA</h3>`;
  if (IDEAS && IDEAS.busy) h += '<p class="small muted">Pensando con lo que tienes…</p>';
  else {
    if (IDEAS && IDEAS.err) h += `<div class="check bad">${esc(IDEAS.err)}</div>`;
    if (IDEAS && IDEAS.ai) h += IDEAS.ai.map(x => `<div class="card"><div class="card-head"><h3>${esc(x.nombre)}</h3></div><div class="small">Usas: ${esc((x.usas || []).join(', '))}</div>${(x.falta || []).length ? `<div class="small muted">Te faltaría: ${esc(x.falta.join(', '))}</div>` : '<div class="small muted">No te falta nada.</div>'}<p class="small" style="margin:6px 0 0">${esc(x.como || '')}</p></div>`).join('');
    h += aiReady() ? `<button type="button" class="btn wide" data-act="idea-ai" style="margin-top:8px">${IDEAS && IDEAS.ai ? 'Dame otras ideas' : 'Sugerir con IA'}</button>` : '<p class="small muted">Para las ideas con IA hace falta configurarla en Ajustes.</p>';
  }
  $('#ideas-in').innerHTML = h;
}
async function askIdeas() {
  const have = stockLines(); const spices = Object.keys(S.stock).filter(n => S.P[n] && S.P[n].c && S.stock[n] > 0);
  const prev = IDEAS && IDEAS.ai ? IDEAS.ai.map(x => x.nombre) : [];
  IDEAS = { ai: IDEAS && IDEAS.ai, busy: true }; renderIdeas();
  const tool = { name: 'sugerir_comidas', description: 'Propone comidas que se pueden hacer con lo que hay en la despensa.', input_schema: { type: 'object', required: ['ideas'], properties: { ideas: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', required: ['nombre', 'usas', 'falta', 'como'], properties: { nombre: { type: 'string' }, usas: { type: 'array', items: { type: 'string' }, description: 'Productos de la despensa que usa, con la cantidad aproximada' }, falta: { type: 'array', items: { type: 'string' }, description: 'Máximo 2 ingredientes baratos y básicos que no estén en la despensa; vacío si no falta nada' }, como: { type: 'string', description: 'Cómo prepararlo en 2 frases' } } } } } } };
  const prompt = `Estas son las cosas que tengo en casa (producto: cantidad):\n${have.join('\n')}\n${spices.length ? 'Especias y sazonadores que tengo: ' + spices.join(', ') + '.' : 'No tengo especias.'}
Vivo en ${REG().name}. Sugiere de 3 a 5 comidas sencillas y baratas que pueda hacer MAYORMENTE con lo que hay, priorizando gastar lo que más cantidad tengo y combinando varios productos. No inventes que tengo cosas que no están en la lista; lo que falte va en "falta" (máximo 2 y básicos). Tengo cantidades para una persona.${prev.length ? ' No repitas estas: ' + prev.join(', ') + '.' : ''}`;
  try {
    const data = await claude({ tools: [tool], tool_choice: { type: 'tool', name: 'sugerir_comidas' }, messages: [{ role: 'user', content: prompt }] });
    const tu = (data.content || []).find(c => c.type === 'tool_use'); if (!tu || !Array.isArray(tu.input.ideas)) throw new Error('La IA no devolvió ideas. Inténtalo otra vez.');
    IDEAS = { ai: tu.input.ideas };
  } catch (e) { IDEAS = { ai: IDEAS && IDEAS.ai, err: e.message }; }
  if ($('#dlg-ideas').open) renderIdeas();
}
$('#dlg-ideas').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.close !== undefined) return $('#dlg-ideas').close();
  if (b.dataset.act === 'idea-ai') askIdeas();
  else if (b.dataset.act === 'idea-mine') { if (!S.mine.includes(b.dataset.id)) S.mine.push(b.dataset.id); toast(byId(b.dataset.id).n + ' añadida a tu recetario'); save(); renderIdeas(); }
});

/* ---------- Bienvenida ---------- */
function openWelcome() {
  $('#welcome-in').innerHTML = `
    <div class="sheet-head"><h2>Bienvenido a Tandas</h2></div>
    <p class="lead" style="margin:0">Planifica tus comidas por tandas, controla lo que tienes en casa y cuánto te cuesta cada plato. Es una versión de prueba: tus datos se guardan solo en este móvil.</p>
    <label class="field">¿Cómo te llamas?<input id="wl-name" autocomplete="given-name" maxlength="30"></label>
    <label class="field">¿Dónde haces la compra?<select id="wl-region">${Object.entries(window.REGIONS).map(([k, r]) => `<option value="${k}" ${k === S.region ? 'selected' : ''}>${r.name} (${r.currency === 'USD' ? '$' : '€'})</option>`).join('')}</select></label>
    ${PROXY ? '<label class="field">Código de invitación<input id="wl-code" autocomplete="off" autocapitalize="none" placeholder="Te lo pasaron con el enlace"></label>' : ''}
    <button type="button" class="btn wide" id="wl-go">Empezar</button>
    <button type="button" class="link" id="wl-import" style="justify-self:center">Tengo una copia de mis datos</button>`;
  $('#dlg-welcome').showModal();
}
$('#dlg-welcome').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.id === 'wl-go') {
    const n = $('#wl-name').value.trim(); if (!n) return toast('Escribe tu nombre');
    S.name = n; if ($('#wl-region').value !== S.region) applyRegion($('#wl-region').value); if ($('#wl-code')) S.code = $('#wl-code').value.trim(); save(); $('#dlg-welcome').close(); render(); toast(`¡Hola, ${n}!`);
  } else if (b.id === 'wl-import') { const n = $('#wl-name').value.trim(); if (n) S.name = n; if ($('#wl-code')) S.code = $('#wl-code').value.trim(); save(); $('#dlg-welcome').close(); $('#file-backup').click(); }
});
$('#dlg-welcome').addEventListener('cancel', ev => ev.preventDefault());

/* ---------- Arranque ---------- */
render();
if (!S.name) openWelcome();
checkReminders(); mirrorState(); setTimeout(() => syncCommunity(false), 1500);
$('#dlg-pop').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b && ev.target !== ev.currentTarget) return;
  const off = $('#pop-off'); if (off && off.checked) { S.enjoyPopup = false; save(); toast('Vale, no te lo vuelvo a mostrar. Puedes reactivarlo en Ajustes'); }
  $('#dlg-pop').close();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadSW = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => { reg.update(); document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); }); }).catch(() => {});
  // Cuando llega una versión nueva, recarga una vez para usarla
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
}

let rsT = null;
$('#rsearch').addEventListener('input', ev => { clearTimeout(rsT); rsT = setTimeout(() => { S.rq = ev.target.value; renderRecetas(); }, 200); });
