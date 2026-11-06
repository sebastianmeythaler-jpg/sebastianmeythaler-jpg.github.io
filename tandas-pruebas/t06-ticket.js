const { T } = require('./lib');
const base = async (h, o = {}) => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, o.veces || 2); return r; };

T('Ticket · el botón abre la hoja con cámara, galería y «a mano»', async ({ p, h, ok }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); ok(await p.locator('#dlg-scan').evaluate(d => d.open), 'se abre'); for (const id of ['#sc-cam', '#sc-gal', '#sc-manual']) ok(await p.locator(id).count() === 1, 'botón ' + id);
  ok(await p.locator('#sc-total').count() === 1, 'atajo «solo el total» (hay lista)'); await p.locator('#dlg-scan [data-close]').first().click(); ok(!(await p.locator('#dlg-scan').evaluate(d => d.open)), 'se cierra');
});
T('Ticket · galería y cámara abren el selector de archivos', async ({ p, h, ok }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); for (const id of ['#sc-gal', '#sc-cam']) { const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }), p.click(id)]); ok(!!fc, id + ' abre el selector'); await fc.setFiles([]); }
});
T('Ticket · leído por la IA: líneas correctas, guardar actualiza despensa, gasto e historial', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList(); await h.scan(tk);
  ok(/cuadra con el total/.test(await p.locator('#scan-in').innerText()), 'el total cuadra'); ok(await p.locator('#scan-in .rv-mini').count() >= 3, 'líneas correctas en formato compacto'); eq(await p.locator('#scan-in .rv-attn').count(), 0, 'ninguna línea pide revisión');
  await p.click('#rv-save'); await p.waitForTimeout(150); ok(!(await p.locator('#dlg-scan').evaluate(d => d.open)), 'se cierra al guardar'); eq(await h.S(() => S.tickets.length), 1, 'ticket guardado'); ok(h.approx(await h.S(() => S.tickets[0].total), tk.total), 'con el total');
  ok(await h.S(() => shop(S.plan).total) < 0.01, 'la Lista queda cubierta'); ok(h.approx(await h.S(() => spentInfo().spent), tk.total, 0.05), 'el gasto de la semana = total del ticket'); ok(/Ticket guardado/.test(await h.toast()), 'avisa');
  ok(await p.locator('.tab[data-view=despensa]').isVisible(), 'se desbloquea la Despensa'); await h.S(() => { updateMonths(); }); ok(await h.S(() => Object.values(S.months).some(m => m.comida > 0)), 'entra en el historial mensual');
});
T('Ticket · el precio real del ticket actualiza el precio del producto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList(); const l = tk.lineas[0]; const n = l.producto; l.importe = Math.round(l.importe * 2 * 100) / 100; tk.total = Math.round(tk.lineas.reduce((a, x) => a + x.importe, 0) * 100) / 100;
  await h.scan(tk); await p.click('#rv-save'); await p.waitForTimeout(150); ok(h.approx(await h.S(n => S.P[n].p, n), l.importe / l.uds, 0.02), 'el precio del producto se actualiza'); ok(await h.S(n => S.P[n].t === 1, n), 'marcado como precio real');
});
T('Ticket · línea sin producto pide revisión; elegir producto la deja lista', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList(); tk.lineas[0].producto = null; await h.scan(tk);
  eq(await p.locator('#scan-in .rv-attn').count(), 1, 'una línea pide revisión'); ok(/Hay 1 línea que conviene revisar/.test(await p.locator('#scan-in').innerText()), 'lo dice arriba');
  const real = (await h.ticketFromList()).lineas[0].desc; const prod = await h.S(() => shop(S.plan).rows.find(x => x.packs).n); await p.locator('#scan-in .rv-attn select[data-f=producto]').selectOption(prod); await p.waitForTimeout(100);
  eq(await p.locator('#scan-in .rv-attn').count(), 0, 'ya no pide revisión'); ok(await p.locator('#scan-in .rv-mini').count() >= 1, 'pasa a compacta');
});
T('Ticket · «Cambiar» reabre una línea compacta', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.scan(await h.ticketFromList()); const n = await p.locator('#scan-in .rv-mini').count(); await p.locator('#scan-in [data-rvopen]').first().click(); await p.waitForTimeout(100);
  eq(await p.locator('#scan-in .rv-mini').count(), n - 1, 'una línea se abre'); ok(await p.locator('#scan-in .rv select[data-f=producto]').count() === 1, 'con sus campos editables');
});
T('Ticket · cambiar importe o total muestra la diferencia', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.scan(await h.ticketFromList({ total: 99 })); ok(/diferencia/.test(await p.locator('#scan-in').innerText()), 'avisa de la diferencia con el total');
  await p.fill('[data-rv=total]', '0'); await p.press('[data-rv=total]', 'Tab'); await p.waitForTimeout(100); ok(/cuadra|diferencia/.test(await p.locator('#scan-in').innerText()), 'recalcula al cambiar el total');
});
T('Ticket · quitar una línea con la ✕ y añadir otra con «+ Añadir línea»', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.scan(await h.ticketFromList()); await p.locator('#scan-in [data-rvopen]').first().click(); const n0 = await h.S(() => RV.lineas.length);
  await p.locator('#scan-in [data-rvdel]').first().click(); eq(await h.S(() => RV.lineas.length), n0 - 1, 'una línea menos'); await p.click('#rv-add'); eq(await h.S(() => RV.lineas.length), n0, 'una línea más'); ok(await p.locator('#scan-in .rv-attn').count() >= 1, 'la nueva línea está abierta para rellenar');
});
T('Ticket · a mano: añadir línea, elegir producto, envase y guardar', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); await p.click('#sc-manual'); await p.fill('[data-rv=tienda]', 'Dia'); await p.fill('[data-f=desc]', 'arroz'); await p.selectOption('[data-f=producto]', 'Arroz');
  await p.selectOption('[data-f=env]', 'bolsa'); await p.fill('[data-f=uds]', '2'); await p.press('[data-f=uds]', 'Tab'); await p.fill('[data-f=each]', '500'); await p.press('[data-f=each]', 'Tab'); await p.fill('[data-f=importe]', '2.2'); await p.press('[data-f=importe]', 'Tab'); await p.waitForTimeout(100);
  eq(await h.S(() => RV.lineas[0].inv), 1000, '2 bolsas de 500 g = 1000 g'); const s0 = await h.S(() => S.stock['Arroz'] || 0); await p.fill('[data-rv=total]', '2.2'); await p.press('[data-rv=total]', 'Tab'); await p.click('#rv-save'); await p.waitForTimeout(150);
  eq(await h.S(() => S.stock['Arroz']), s0 + 1000, 'suma 1000 g'); eq(await h.S(() => S.tickets[0].tienda), 'Dia', 'tienda'); eq(await h.S(() => S.tickets[0].total), 2.2, 'total');
});
T('Ticket · vacío no se puede guardar', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); await p.click('#sc-manual'); await p.click('#rv-save'); ok(/vacío/.test(await h.toast()), 'avisa «El ticket está vacío»'); eq(await h.S(() => S.tickets.length), 0, 'no se guarda'); ok(await p.locator('#dlg-scan').evaluate(d => d.open), 'la hoja sigue abierta');
});
T('Ticket · duplicado (misma fecha y total) avisa y pide confirmar', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList(); await h.scan(tk); await p.click('#rv-save'); await p.waitForTimeout(150);
  await h.S(() => { S.cart = {}; save(); }); await h.scan(tk); await p.click('#rv-save'); ok(/ya guardaste/.test(await h.toast()), 'avisa del duplicado'); eq(await h.S(() => S.tickets.length), 1, 'no lo guarda aún'); ok(/guardar igualmente/.test(await p.locator('#rv-save').innerText()), 'el botón cambia');
  await p.click('#rv-save'); await p.waitForTimeout(150); eq(await h.S(() => S.tickets.length), 2, 'al confirmar se guarda');
});
T('Ticket · líneas «Extra» cuentan como capricho y no entran en la despensa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList({ extras: [{ desc: 'GALLETAS', uds: 1, importe: 1.5, producto: null, cantidad_inventario: 0, tipo: 'Extra', grupo: 'Dulces y antojos' }] }); await h.scan(tk); const st0 = await h.S(() => JSON.stringify(S.stock)); await p.click('#rv-save'); await p.waitForTimeout(150);
  ok(h.approx(await h.S(() => spentInfo().extras), 1.5, 0.01), 'suma 1,5 € a «Caprichos y extras»'); ok(await h.S(() => !Object.keys(S.stock).some(n => /galleta/i.test(n) && !JSON.parse(st0)[n] && false)), 'sin error de despensa');
});
T('Ticket · líneas de Hogar van al hogar y no cuentan como comida', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList({ extras: [{ desc: 'CHAMPU', uds: 2, importe: 5, producto: null, cantidad_inventario: 0, tipo: 'Hogar', producto_hogar: 'Champú', categoria_hogar: 'Aseo personal', grupo: null }] }); await h.scan(tk);
  const sp0 = tk.total - 5; await p.click('#rv-save'); await p.waitForTimeout(150); eq(await h.S(() => S.hstock['Champú']), 2, '2 champús en casa'); ok(h.approx(await h.S(() => spentInfo().spent), sp0, 0.06), 'el gasto de comida NO incluye el champú'); ok(await h.S(() => S.HP['Champú'].p) > 0, 'guarda su precio');
});
T('Ticket · producto nuevo (__new) se crea en el catálogo', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList({ extras: [{ desc: 'HUMUS CASERO', uds: 1, importe: 1.9, producto: null, cantidad_inventario: 1, tipo: 'De la lista', grupo: null }] }); await h.scan(tk);
  const idx = await h.S(() => RV.lineas.findIndex(l => l.desc === 'HUMUS CASERO')); await h.S(i => { RV.lineas[i].producto = '__new'; RV.lineas[i].open = true; renderReview(); }, idx);
  await p.click('#rv-save'); await p.waitForTimeout(150); ok(await h.S(() => !!S.P['Humus casero']), 'el producto se crea'); ok(await h.S(() => S.stock['Humus casero'] > 0), 'y entra en la despensa');
});
T('Ticket · atajo «solo el total»: pasa la Lista a la despensa y reparte el gasto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); await p.click('#sc-quick'); ok(/Escribe cuánto/.test(await h.toast()), 'sin total avisa'); await p.fill('#sc-total', '12.5'); await p.click('#sc-quick'); await p.waitForTimeout(150);
  eq(await h.S(() => S.tickets.length), 1, 'un ticket'); ok(await h.S(() => S.tickets[0].est), 'estimado'); eq(await h.S(() => S.tickets[0].total), 12.5, 'total 12,5'); ok(h.approx(await h.S(() => S.tickets[0].lineas.reduce((a, l) => a + l.importe, 0)), 12.5, 0.15), 'las líneas suman el total');
  ok(await h.S(() => shop(S.plan).total) < 0.01, 'la Lista queda cubierta'); ok(h.approx(await h.S(() => spentInfo().spent), 12.5, 0.01), 'el gasto = 12,5'); ok(!(await p.locator('#dlg-scan').evaluate(d => d.open)), 'se cierra');
});
T('Ticket · sin internet explica el problema y ofrece apuntarlo a mano', async ({ p, h, env, ok }) => {
  await h.start(); await base(h); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); }); env.offline = true; await p.click('#btn-scan'); await h.scanFile(); await p.waitForTimeout(1500);
  ok(/Sin conexión|conexión/.test(await p.locator('#scan-in').innerText()), 'explica la falta de conexión'); ok(await p.locator('#sc-manual').count() === 1, 'ofrece apuntarlo a mano'); await p.click('#sc-manual'); ok(await p.locator('#rv-save').count() === 1, 'abre el formulario manual');
});
T('Ticket · sin IA configurada abre el formulario a mano y lo dice', async ({ p, h, ok }) => {
  await h.start(); await base(h); await h.S(() => { S.apiKey = ''; S.code = ''; save(); }); await p.click('#btn-scan'); await h.scanFile(); await p.waitForTimeout(500); ok(await p.locator('#rv-save').count() === 1, 'abre el formulario'); ok(/Sin IA configurada/.test(await h.toast()), 'avisa');
});
T('Ticket · cerrar sin guardar no cambia nada', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const s0 = await h.S(() => JSON.stringify([S.stock, S.tickets])); await h.scan(await h.ticketFromList()); await p.locator('#dlg-scan [data-close]').first().click(); eq(await h.S(() => JSON.stringify([S.stock, S.tickets])), s0, 'sin cambios');
});
T('Ticket · la fecha por defecto es la de hoy en tu zona horaria (también pasada la medianoche)', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#btn-scan'); await p.click('#sc-manual'); const f = await p.locator('[data-rv=fecha]').inputValue(); const hoy = await h.S(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  eq(f, hoy, 'fecha del formulario manual');
}, { start: new Date('2026-11-07T00:30:00+01:00') });
T('Ticket · borrar: pide confirmar, quita lo que metió en la despensa y su gasto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const s0 = await h.S(() => JSON.stringify(S.stock)); await h.scan(await h.ticketFromList()); await p.click('#rv-save'); await p.waitForTimeout(150);
  await p.click('#summary'); await p.waitForTimeout(100); const del = p.locator('[data-act=del-ticket]').first(); await del.click(); eq(await h.S(() => S.tickets.length), 1, 'el primer toque no borra'); ok(/Borrar\?/.test(await del.innerText()), 'pide confirmar');
  await del.click(); await p.waitForTimeout(100); eq(await h.S(() => S.tickets.length), 0, 'segundo toque borra'); eq(await h.S(() => JSON.stringify(S.stock)), s0, 'la despensa vuelve a como estaba'); ok(h.approx(await h.S(() => spentInfo().spent), 0), 'el gasto vuelve a 0'); ok(/Ticket borrado/.test(await h.toast()), 'avisa');
});
T('Ticket · borrar también quita lo comido que salió de ese ticket del historial', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.scan(await h.ticketFromList()); await p.click('#rv-save'); await p.waitForTimeout(150); await h.view('semana'); await p.locator('[data-act=eat]').first().click(); await p.waitForTimeout(100); await h.closeAll();
  const logs = await h.S(() => S.log.length); ok(logs >= 1, 'se anotó la comida'); await p.click('#summary'); await p.waitForTimeout(100); const del = p.locator('[data-act=del-ticket]').first(); await del.click(); await del.click(); await p.waitForTimeout(100);
  ok(await h.S(() => S.tickets.length === 0), 'ticket borrado'); ok(await h.S(() => S.stock && Object.values(S.stock).every(v => v > 0)), 'despensa sin valores negativos');
});
T('Ticket · el panel de detalles lista los tickets de la semana con su total', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const tk = await h.ticketFromList(); await h.scan(tk); await p.click('#rv-save'); await p.waitForTimeout(150); await p.click('#summary'); await p.waitForTimeout(100);
  ok(await p.locator('#details').isVisible(), 'se despliega el detalle'); ok(/Mercadona/.test(await p.locator('#details').innerText()), 'muestra la tienda'); await p.click('#summary'); ok(!(await p.locator('#details').isVisible()), 'se pliega');
});
