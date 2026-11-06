const { T } = require('./lib');
const seedTickets = (h, list) => h.S(l => { for (const t of l) S.tickets.push({ id: 't' + Math.random(), fecha: t.f, tienda: t.s || 'Super', total: t.total, lineas: [{ desc: 'x', producto: null, inv: 0, uds: 1, importe: t.total, tipo: t.tipo || 'Extra', grupo: 'Otros' }] }); S.nivel = 4; save(); render(); }, list);
const day = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00+01:00`);

T('Historial · aparece con los meses, el total de cada uno y «en curso»', async ({ p, h, ok, eq }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-10-10', total: 40 }, { f: '2026-10-20', total: 25.5 }, { f: '2026-11-02', total: 18 }]); await p.click('#summary'); await p.waitForTimeout(100); await p.locator('details.months > summary').click(); await p.waitForTimeout(80);
  const t = await p.locator('details.months').innerText(); ok(/Octubre 2026/.test(t) && /Noviembre 2026/.test(t), 'lista octubre y noviembre'); ok(/65,50/.test(t), 'octubre suma 65,50'); ok(/18,00/.test(t), 'noviembre 18,00'); ok(/en curso/.test(t), 'marca el mes en curso'); ok(/2 meses/.test(t), 'cuenta 2 meses');
  ok(/Presupuesto del mes/.test(t), 'presupuesto del mes en curso'); ok(/Te pasaste|Ahorraste/.test(t), 'compara los meses cerrados con el presupuesto');
});
T('Historial · abrir/cerrar se recuerda al recargar', async ({ p, h, ok, eq }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-11-02', total: 18 }]); await p.click('#summary'); await p.locator('details.months > summary').click(); await p.waitForTimeout(100); ok(await h.S(() => S.monthsOpen), 'abierto guardado'); await p.reload(); await p.waitForTimeout(300); await p.click('#summary'); ok(await p.locator('details.months').evaluate(d => d.open), 'sigue abierto tras recargar');
});
T('Historial · sin tickets no aparece el panel', async ({ p, h, ok }) => {
  await h.start(); await p.click('#summary'); await p.waitForTimeout(100).catch(() => {}); ok(await p.locator('details.months').count() === 0, 'sin panel de meses');
});
T('Historial · distingue comida, caprichos y casa y suma lo comido', async ({ p, h, ok, eq }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-11-02', total: 30, tipo: 'De la lista' }, { f: '2026-11-03', total: 5, tipo: 'Extra' }, { f: '2026-11-04', total: 7, tipo: 'Hogar' }]); await h.S(() => { S.log.push({ ts: Date.now(), t: 'cena', n: 'Plato', c: 2 }); S.log.push({ ts: Date.now(), t: 'cena', n: 'Plato2', c: 3 }); save(); render(); });
  const m = await h.S(() => { updateMonths(); return S.months['2026-11']; }); eq(m.extras, 5, 'caprichos 5'); eq(m.comido, 5, 'comido 5'); eq(m.comidas, 2, '2 comidas'); ok(m.hogar >= 0, 'casa separada');
});
T('Historial · borrar un ticket lo recalcula', async ({ p, h, ok, eq }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-11-02', total: 18 }, { f: '2026-10-02', total: 9 }]); await h.S(() => { const t = S.tickets.find(t => t.fecha === '2026-11-02'); S.tickets = S.tickets.filter(x => x !== t); updateMonths(); }); ok(await h.S(() => !S.months['2026-11'] || (S.months['2026-11'].comida + S.months['2026-11'].extras) === 0), 'el mes se recalcula sin ese ticket');
});
T('Fin de mes · el último día por la noche sale el resumen con el total y el presupuesto', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { S.budget = 10; save(); }); await seedTickets(h, [{ f: '2026-11-05', total: 50 }]); await p.context().clock.setSystemTime(day('2026-11-30', 21)); await p.reload(); await p.waitForTimeout(1800);
  ok(await p.locator('#dlg-pop').evaluate(d => d.open), 'sale el resumen'); const t = await p.locator('#pop-in').innerText(); ok(/resumen de Noviembre/i.test(t), 'título del mes'); ok(/50,00/.test(t), 'total gastado'); ok(/Te pasaste/.test(t), 'dice que se pasó (50 € frente a ≈43 € del mes)');
  ok(/Tus gastos por mes/.test(t), 'dice dónde queda guardado'); await p.locator('#pop-in [data-close]').click(); await p.reload(); await p.waitForTimeout(1800); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'no vuelve a salir');
});
T('Fin de mes · el resumen dice «¡Bien!» si gastaste menos que el presupuesto del mes', async ({ p, h, ok }) => {
  await h.start(); await h.S(() => { S.budget = 100; save(); }); await seedTickets(h, [{ f: '2026-11-05', total: 50 }]); await p.context().clock.setSystemTime(day('2026-11-30', 21)); await p.reload(); await p.waitForTimeout(1800); ok(/Bien/.test(await p.locator('#pop-in').innerText()), 'mensaje positivo');
});
T('Fin de mes · al abrir ya en el mes siguiente sale el resumen del anterior', async ({ p, h, ok }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-11-05', total: 50 }]); await p.context().clock.setSystemTime(day('2026-12-02', 10)); await p.reload(); await p.waitForTimeout(1800); ok(/resumen de Noviembre/i.test(await p.locator('#pop-in').innerText()), 'resumen de noviembre');
});
T('Fin de mes · a media mes no molesta, ni si no hay datos del mes', async ({ p, h, ok }) => {
  await h.start(); await seedTickets(h, [{ f: '2026-11-05', total: 50 }]); await p.context().clock.setSystemTime(day('2026-11-15', 21)); await p.reload(); await p.waitForTimeout(1800); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'sin aviso a mitad de mes');
  await h.S(() => { S.tickets = []; S.months = {}; S.monthShown = ''; save(); }); await p.context().clock.setSystemTime(day('2026-11-30', 22)); await p.reload(); await p.waitForTimeout(1800); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'sin datos no hay resumen');
});
T('Fin de mes · no se pisa con la bienvenida', async ({ p, h, ok }) => {
  await h.load(); await p.context().clock.setSystemTime(day('2026-11-30', 21)); await p.reload(); await p.waitForTimeout(1800); ok(await p.locator('#dlg-welcome').evaluate(d => d.open), 'la bienvenida sigue ahí'); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'sin resumen encima');
});

// ---------- La cadena completa: receta → lista → ticket → despensa → cocinar → comer → gasto → historial ----------
T('Cadena · de la receta al historial, todo cuadra', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', tanda: true, cheap: true }); await h.exploreAdd(r); await p.locator(`[data-act=addone][data-id="${r.id}"]`).click(); await p.locator(`#recipe-list .stepper [data-act=veces][data-d="1"]`).click(); await p.waitForTimeout(100);
  const need = await h.S(() => shop(S.plan)); ok(need.total > 0, 'la Lista pide cosas'); await h.view('lista'); const boxes = p.locator('#shop-list input[data-act=cart]:not(:disabled)'); for (let i = 0, n = await boxes.count(); i < n; i++) await boxes.nth(i).check();
  await p.locator('[data-act=cart-stock]').click(); await p.waitForTimeout(150);
  eq(await h.S(() => shop(S.plan).total), 0, 'tras comprar, la Lista no pide nada'); ok(h.approx(await h.S(() => spentInfo().spent), need.total, 0.05), 'gasto = lo comprado');
  await h.view('semana'); eq(await p.locator('#s-compra').innerText(), 'Nada ✓', 'Semana: «Nada ✓»'); const stockBefore = await h.S(() => JSON.stringify(S.stock)); await p.locator('[data-act=cook]').first().click(); await p.waitForTimeout(150); await h.closeAll();
  const used = await h.S(b => { const before = JSON.parse(b); let u = 0; for (const n of Object.keys(before)) u += (before[n] - (S.stock[n] || 0)) * (S.P[n] ? ucost(S.P[n]) : 0); return u; }, stockBefore); ok(used > 0, 'cocinar gasta despensa');
  const left = await h.S(() => leftOf(S.plan[0])); await p.locator('[data-act=eat]').first().click(); await p.waitForTimeout(150); await h.closeAll();
  eq(await h.S(() => S.log.length), 1, 'una comida anotada'); const logc = await h.S(() => S.log[0].c); ok(logc > 0 && logc <= used + 0.001 + (need.total), 'su coste es razonable');
  await p.click('#btn-eaten'); ok(h.approx(Number((await p.locator('#s-consumo').innerText()).replace(/[^\d,]/g, '').replace(',', '.')), logc, 0.011), 'el cuadro «Lo que comes» = coste de la comida');
  await h.S(() => updateMonths()); const m = await h.S(() => Object.values(S.months)[0]); ok(h.approx(m.comida + m.extras, need.total, 0.05), 'historial mensual = gasto'); ok(h.approx(m.comido, logc, 0.011), 'historial: comido = registro'); eq(m.comidas, 1, 'historial: 1 comida');
});
T('Cadena · comprar con ticket y comer con el asistente cuadran con comer con el botón', async ({ p, h, env, ok, eq }) => {
  // dos formas de anotar lo mismo (180 g de pollo) deben costar igual
  await h.start(); await h.S(() => { S.stock['Pechuga de pollo'] = 500; S.apiKey = 'k'; S.nivel = 4; S.log.push({ ts: Date.now() - 1e6, t: 'cena', n: 'x', c: 0 }); save(); render(); }); await p.click('#btn-ai'); await p.waitForSelector('#chat-text');
  const l0 = await h.S(() => S.log.length); await h.chatSay('usé 180 g de pollo', [{ tools: [{ tool: 'anotar_consumo', input: { comida: 'almuerzo', descripcion: 'Pollo', ingredientes: [{ producto: 'Pechuga de pollo', cantidad: 180 }] } }] }, { text: 'ok' }]); const a = await h.S(l => S.log[l].c, l0);
  await h.chatSay('usé 180 g de pollo (otra vez, por ajustar)', [{ tools: [{ tool: 'ajustar_despensa', input: { motivo: 'comido', producto: 'Pechuga de pollo', cantidad: 180, modo: 'restar' } }] }, { text: 'ok' }]); const b = await h.S(l => S.log[l + 1].c, l0); ok(h.approx(a, b, 0.011), `anotar_consumo (${a}) y ajustar_despensa «comido» (${b}) cuestan lo mismo`);
});
T('Cadena · quitar un ticket que ya se cocinó no deja la despensa en negativo', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 1); await h.view('lista'); const boxes = p.locator('#shop-list input[data-act=cart]:not(:disabled)'); for (let i = 0, n = await boxes.count(); i < n; i++) await boxes.nth(i).check(); await p.locator('[data-act=cart-stock]').click(); await p.waitForTimeout(100);
  await h.view('semana'); await p.locator('[data-act=cook]').first().click(); await p.waitForTimeout(100); await h.closeAll(); await p.click('#summary'); await p.waitForTimeout(100); const del = p.locator('[data-act=del-ticket]').first(); await del.click(); await del.click(); await p.waitForTimeout(100);
  ok(await h.S(() => Object.values(S.stock).every(v => v > 0)), 'ninguna cantidad negativa o cero guardada');
});
T('Cadena · plato de la semana sin receta en «mi recetario» sigue funcionando', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 1); await h.S(id => { S.mine = S.mine.filter(x => x !== id); save(); render(); }, r.id); await h.view('semana'); ok(await p.locator('#plan-list article.card').count() === 1, 'el plato sigue en la semana'); await h.view('lista'); ok(await p.locator('#shop-list .row').count() > 0, 'y en la Lista');
});
T('Cadena · cambiar región con cosas en la semana mantiene el estado coherente', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); await h.stockFor(r.id, 1); const st = await h.S(() => JSON.stringify(S.stock)); await p.click('#btn-settings'); await p.selectOption('#st-region', 'EC'); await p.click('#st-save'); await p.waitForTimeout(300); eq(await h.S(() => JSON.stringify(S.stock)), st, 'la despensa no cambia al cambiar de país'); eq(await h.S(() => S.plan.length), 1, 'la semana tampoco');
});
