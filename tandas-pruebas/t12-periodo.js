const { T } = require('./lib');
const setup = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 3); await h.stockFor(r.id, 3); return r; };
const saveTicket = async (h, p, o) => { const t = await h.ticketFromList({ extras: [{ desc: 'CHOCOLATE', uds: 1, importe: 2.5, producto: null, cantidad_inventario: 0, tipo: 'Extra', grupo: 'Otros' }], ...o }); await h.scan(t); await p.click('#rv-save'); await p.waitForTimeout(300); };
const eatFuera = h => h.S(() => { const id = 't' + Date.now(); S.tickets.push({ id, fecha: localDay(), tienda: 'Fuera de casa', total: 10, lineas: [{ desc: 'Pizza', producto: null, inv: 0, uds: 1, importe: 10, tipo: 'Extra', grupo: 'Otros' }] }); logMeal('cena', 'Pizza', 10); S.log[S.log.length - 1].tid = id; save(); });

T('Periodo · al pasar el sábado NO se pone nada a cero', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await eatFuera(h); const a = await h.S(() => ({ s: spentInfo().spent, c: S.log.length, k: weekTickets().length }));
  await p.context().clock.setSystemTime(new Date('2026-11-16T10:00:00+01:00')); await p.reload(); await p.waitForTimeout(300);
  const b = await h.S(() => ({ s: spentInfo().spent, c: S.log.length, k: weekTickets().length }));
  eq(b.s, a.s, 'mismo gasto una semana después'); eq(b.c, a.c, 'mismo registro de comidas'); eq(b.k, a.k, 'mismos tickets del periodo');
});
T('Periodo · un ticket nuevo pone los contadores a cero y archiva el anterior', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await eatFuera(h); const antes = await h.S(() => periodStats(weekRange().start.getTime(), 8.64e15));
  ok(antes.gasto >= 10 && antes.comido >= 10, 'hay datos antes'); await p.context().clock.setSystemTime(new Date('2026-11-12T10:00:00+01:00'));
  await saveTicket(h, p, {});
  const d = await h.S(() => ({ cy: S.cycles.length, last: S.cycles[S.cycles.length - 1], log: S.log.length, tk: S.tickets.length, comido: periodStats(weekRange().start.getTime(), 8.64e15).comido, wk: weekTickets().length }));
  eq(d.cy, 1, 'un periodo archivado'); ok(d.last.gasto >= 10 && d.last.comido >= 10, 'el archivo conserva gasto y comido'); eq(d.comido, 0, '«lo que comes» a cero'); eq(d.wk, 1, 'solo el ticket nuevo cuenta ahora'); ok(d.log >= 1 && d.tk >= 2, 'no se borró ningún registro ni ticket');
});
T('Periodo · lo que cuenta la IA (consumo y comida fuera) se guarda y entra en el historial', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await h.S(() => { S.stock['Huevos L'] = 6; save(); }); await p.locator('#btn-ai').click().catch(() => {});
  const r = await h.S(() => { const o = []; o.push(runTool('anotar_consumo', { comida: 'cena', descripcion: 'Tortilla', ingredientes: [{ producto: 'Huevos L', cantidad: 2 }] })); o.push(runTool('anotar_comida_fuera', { descripcion: 'Café', importe: 2, comida: 'desayuno' })); return o; });
  ok(r.every(x => /^OK/.test(x)), 'la IA anota: ' + r.join(' | '));
  const n = await h.S(() => S.log.length); await h.closeAll(); await p.context().clock.setSystemTime(new Date('2026-11-20T10:00:00+01:00')); await saveTicket(h, p, {});
  eq(await h.S(() => S.cycles[0].comidas), 2, 'las 2 anotaciones quedan en el periodo archivado'); ok(await h.S(() => S.cycles[0].gasto >= 2), 'y el gasto'); ok((await h.S(() => S.log.length)) >= n, 'el registro sigue');
});
T('Periodo · el botón «Empezar nueva …» pide confirmación y archiva sin borrar', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await eatFuera(h); await h.S(() => { S.detailsOpen = true; render(); });
  const b = p.locator('#btn-newcycle'); ok(/Empezar nueva semana/.test(await b.innerText()), 'dice «semana»'); await b.click(); eq(await h.S(() => (S.cycles || []).length), 0, 'a la primera no hace nada'); ok(/Seguro/.test(await p.locator('#btn-newcycle').innerText()), 'pide confirmar');
  await p.locator('#btn-newcycle').click(); await p.waitForTimeout(200); eq(await h.S(() => S.cycles.length), 1, 'archivado'); eq(await h.S(() => spentInfo().spent), 0, 'gasto a cero'); ok(await h.S(() => S.tickets.length >= 1 && S.log.length >= 1), 'no borra tickets ni comidas');
  await h.S(() => { S.detailsOpen = true; render(); }); ok(/Tus compras anteriores/.test(await p.locator('#details').innerText()), 'aparece el historial');
});
T('Periodo · el texto del botón sigue la frecuencia de compra (quincena / mes)', async ({ p, h, ok }) => {
  await h.start(); await setup(h); for (const [k, re] of [['quincena', /Empezar nueva quincena/], ['mes', /Empezar nuevo mes/]]) { await h.S(k => { S.ciclo = k; S.detailsOpen = true; render(); }, k); ok(re.test(await p.locator('#btn-newcycle').innerText()), k); }
});
T('Periodo · tras un ticket, cambiar «La semana empieza el» ya no mueve el periodo', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await saveTicket(h, p, {}); const s0 = await h.S(() => S.cycleStart); await p.click('#btn-settings'); await p.locator('#settings-in details.adv summary').click(); await p.selectOption('#st-week', '3'); await p.click('#st-save'); await p.waitForTimeout(150);
  eq(await h.S(() => S.cycleStart), s0, 'el inicio sigue siendo el del ticket');
});
T('Periodo · el panel muestra día, gasto por día y compara con el periodo anterior', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await eatFuera(h); await p.context().clock.setSystemTime(new Date('2026-11-09T10:00:00+01:00')); await saveTicket(h, p, {});
  await h.S(() => { S.detailsOpen = true; render(); }); const t = await p.locator('#details').innerText();
  ok(/Periodo en curso · día 1/.test(t), 'día 1 del periodo nuevo'); ok(/al día/.test(t), 'gasto al día'); ok(!/NaN|undefined/.test(t), 'sin NaN');
  await h.S(() => { S.cycles[0].gasto = 100; S.cycles[0].end = S.cycles[0].start + 864e5 * 7; render(); }); ok(/por (debajo|encima) del ritmo|mismo ritmo/.test(await p.locator('#details').innerText()), 'compara con el anterior');
});
T('Periodo · aviso suave cuando se alarga y la nota se guarda en el archivo', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await eatFuera(h); await h.S(() => { S.detailsOpen = true; render(); }); ok(!/Llevas \d+ días/.test(await p.locator('#details').innerText()), 'al principio no avisa');
  await p.fill('#cyc-note', 'semana de visitas'); await p.press('#cyc-note', 'Tab'); eq(await h.S(() => S.cycleNote), 'semana de visitas', 'nota guardada');
  await p.context().clock.setSystemTime(new Date('2026-11-20T10:00:00+01:00')); await p.reload(); await p.waitForTimeout(300); await h.S(() => { S.detailsOpen = true; render(); }); ok(/Llevas 1\d días/.test(await p.locator('#details').innerText()), 'avisa pasados los días');
  ok(/día 1\d/.test(await p.locator('#summary').innerText()), 'el resumen muestra el día');
  await saveTicket(h, p, {}); eq(await h.S(() => S.cycles[0].nota), 'semana de visitas', 'la nota queda archivada'); ok(await h.S(() => S.cycles[0].desp >= 0), 'guarda lo que quedó en la despensa'); eq(await h.S(() => S.cycleNote), '', 'el nuevo periodo empieza sin nota');
  await h.S(() => { S.detailsOpen = true; S.cyclesOpen = true; render(); }); const t = await p.locator('#details').innerText(); ok(/semana de visitas/.test(t) && /Quedó en la despensa/.test(t), 'el historial la enseña');
});
T('Ticket · pide margen de respuesta suficiente y avisa claro si la respuesta se corta', async ({ p, h, env, ok, eq }) => {
  await h.start(); await setup(h); env.truncate = true; env.nextTicket = {}; await p.evaluate(() => { S.apiKey = 'sk-ant-test'; save(); }); await p.locator('#btn-scan').click(); await h.scanFile(); await p.waitForSelector('#scan-in .check.bad', { timeout: 5000 });
  ok(/dos partes/.test(await p.locator('#scan-in').innerText()), 'explica qué hacer'); ok(env.aiCalls[env.aiCalls.length - 1].max_tokens >= 6000, 'pide 6000 tokens: ' + env.aiCalls[env.aiCalls.length - 1].max_tokens); env.truncate = false;
});
T('Ticket · no pide tool_choice «tool»/«any» (este modelo da error 400) y lee el ticket', async ({ p, h, env, ok, eq }) => {
  await h.start(); await setup(h); await h.scan(await h.ticketFromList({ extras: [{ desc: 'CHOCOLATE', uds: 1, importe: 2.5, producto: null, cantidad_inventario: 0, tipo: 'Extra', grupo: 'Otros' }] }));
  const c = env.aiCalls[env.aiCalls.length - 1]; ok(!c.tool_choice || c.tool_choice.type === 'auto', 'tool_choice automático'); ok(JSON.stringify(c.messages).includes('registrar_ticket'), 'le indica la herramienta'); ok(await p.locator('#rv-save').count() === 1, 'llega a la revisión');
});
const tkNuevo = (extra) => ({ tienda: 'Mercadona', fecha: '2026-11-07', total: 0, lineas: extra });
T('Ticket · un producto que no está en el catálogo se crea y entra en la despensa', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); const l = { desc: 'CERDO TACOS 500G', uds: 2, importe: 7, producto: null, cantidad_inventario: 0, tipo: 'De la lista', nombre_nuevo: 'Cerdo en tacos', unidad_nueva: 'g', cantidad_envase: 500 };
  const cat = await h.S(() => NEWCATS[0][0]); l.categoria_nueva = cat; await h.scan({ ...tkNuevo([l]), total: 7 });
  ok(/Producto nuevo/.test(await p.locator('#scan-in').innerText()), 'lo enseña como producto nuevo'); eq(await p.locator('#scan-in .rv-attn').count(), 0, 'no hay nada en naranja'); await p.click('#rv-save'); await p.waitForTimeout(200);
  ok(await h.S(() => !!S.P['Cerdo en tacos']), 'creado'); eq(await h.S(() => S.stock['Cerdo en tacos']), 1000, '2 bandejas de 500 g = 1000 g en la despensa'); eq(await h.S(() => S.P['Cerdo en tacos'].p), 3.5, 'precio por bandeja'); ok(await h.S(() => S.CATS.some(c => c.items.includes('Cerdo en tacos'))), 'aparece en una categoría');
  await h.scan({ ...tkNuevo([{ ...l, importe: 8 }]), total: 8, fecha: '2026-11-08' }); await p.click('#rv-save'); await p.waitForTimeout(200); eq(await h.S(() => Object.keys(S.P).filter(k => /cerdo en tacos/i.test(k)).length), 1, 'la segunda vez no lo duplica'); eq(await h.S(() => S.stock['Cerdo en tacos']), 2000, 'suma a la despensa');
});
T('Ticket · «estropajo» y «esponja de cocina» son lo mismo (no duplica en Hogar)', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); const l = { desc: 'ESTROPAJO COCINA', uds: 1, importe: 1.5, producto: null, cantidad_inventario: 0, tipo: 'Hogar', producto_hogar: 'Estropajo de cocina', categoria_hogar: 'Limpieza' };
  const n0 = await h.S(() => Object.keys(S.HP).length); const s0 = await h.S(() => S.hstock['Estropajos y esponjas'] || 0); await h.scan({ ...tkNuevo([l]), total: 1.5 }); await p.click('#rv-save'); await p.waitForTimeout(200);
  eq(await h.S(() => Object.keys(S.HP).length), n0, 'no crea otro producto de casa'); eq(await h.S(() => S.hstock['Estropajos y esponjas']), s0 + 1, 'suma al que ya existía');
});
T('Hogar · los duplicados que ya había se juntan una sola vez al abrir la app', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { S.HP['Esponja de cocina'] = { cat: 'Limpieza', f: 'Unidad', p: 1, t: 1 }; S.hstock['Esponja de cocina'] = 2; S.hstock['Estropajos y esponjas'] = 1; S.hdupV = 0; save(); }); await p.reload(); await p.waitForTimeout(400);
  eq(await h.S(() => Object.keys(S.HP).filter(k => /esponja|estropajo/i.test(k)).length), 1, 'queda uno'); eq(await h.S(() => Object.values(S.hstock).reduce((a, b) => a + b, 0) >= 3), true, 'conserva las unidades'); eq(await h.S(() => S.hstock['Estropajos y esponjas']), 3, 'suma 2 + 1');
});
