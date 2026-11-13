// Detalle de cada ticket: líneas, datos de la factura (hora, número, IVA, pago) y pasar a la despensa lo que quedó como solo gasto.
const { T } = require('./lib');
const path = require('path');
const setup = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); return r; };
const L = (desc, o = {}) => ({ desc, uds: 1, importe: 2, producto: null, cantidad_inventario: 0, tipo: 'De la lista', ...o });
const open = async (p, h) => { await h.S(() => { S.detailsOpen = true; render(); }); await p.locator('[data-act=tk-open]').first().click(); await p.waitForTimeout(100); };
const seed = (h, extra = {}) => h.S(e => { S.tickets.push({ id: 't' + Date.now(), fecha: localDay(), tienda: 'Mercadona', total: 9.5, lineas: [
  { desc: 'CERDO TACOS', producto: null, inv: 0, uds: 1, importe: 3.39, tipo: 'Extra', grupo: 'Otros' }, { desc: 'ARIEL CÁPSULAS 19', producto: null, hogar: 'Detergente de ropa', uds: 1, importe: 4.95, tipo: 'Hogar' }, { desc: 'CANELA MOLIDA', producto: null, inv: 0, uds: 1, importe: 1.16, tipo: 'De la lista' }], ...e }); save(); render(); }, extra);

T('Detalle · el ticket guardado conserva hora, factura, IVA, pago y precio unitario (y no el número de tarjeta)', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h);
  await h.scan({ tienda: 'Mercadona', fecha: '2026-11-07', total: 4.6, hora: '20:41', num_factura: '2265-010-417312', direccion: 'Jaén', metodo_pago: 'tarjeta', iva: [{ tipo: 4, base: 1.2, cuota: 0.05 }, { tipo: 21, base: 3.0, cuota: 0.63 }], lineas: [L('GRIEGO LIMÓN', { uds: 2, importe: 3.1, precio_unitario: 1.55, tipo: 'Extra', grupo: 'Dulces y antojos' }), L('ESTROPAJO', { importe: 1.5, tipo: 'Hogar', producto_hogar: 'Estropajos y esponjas' })] });
  await p.click('#rv-save'); await p.waitForTimeout(200); const t = await h.S(() => S.tickets[S.tickets.length - 1]);
  eq(t.hora, '20:41', 'hora'); eq(t.factura, '2265-010-417312', 'factura'); eq(t.pago, 'tarjeta', 'pago'); eq(t.iva.length, 2, 'dos tipos de IVA'); eq(t.iva[1].cuota, 0.63, 'cuota'); eq(t.lineas[0].pu, 1.55, 'precio unitario'); ok(!JSON.stringify(t).match(/\d{4}\s?\*{4}|\*{4}\s?\d{4}/), 'ninguna cifra de tarjeta');
  await open(p, h); const tx = await p.locator('#details').innerText(); ok(/20:41/.test(tx) && /2265-010-417312/.test(tx) && /Pagado con tarjeta/.test(tx), 'se ve la cabecera'); ok(/21%/.test(tx) && /4%/.test(tx), 'se ve el IVA'); ok(/GRIEGO LIMÓN/i.test(tx) && /× 2 a/.test(tx), 'se ven las líneas con cantidad y precio');
});
T('Detalle · cada línea dice a dónde fue: despensa, casa, capricho o solo gasto', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await seed(h); await open(p, h); const tx = await p.locator('#details').innerText();
  ok(/Casa: Detergente de ropa/.test(tx), 'casa'); ok(/Capricho · Otros, no entra a la despensa/.test(tx), 'capricho sin producto'); ok(/Solo gasto, no entra a la despensa/.test(tx), 'solo gasto'); ok(/Sin hora, número de factura ni IVA/.test(tx), 'avisa de lo que falta'); ok(await p.locator('[data-act=tk-fix]').count() === 2, 'dos líneas se pueden pasar a la despensa (la de casa no)');
});
T('Detalle · pasar una línea sin producto a la despensa la crea, suma el stock y la deja bien clasificada', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await seed(h); await open(p, h); const n0 = await h.S(() => Object.keys(S.P).length);
  await p.locator('[data-act=tk-fix]').first().click(); eq(await p.inputValue('#tkf-name'), 'Cerdo tacos', 'propone el nombre'); await p.fill('#tkf-name', 'Cerdo en tacos'); await p.selectOption('#tkf-u', 'g'); await p.fill('#tkf-q', '450'); await p.selectOption('#tkf-cat', 'Proteínas'); await p.click('[data-act=tk-fix-save]'); await p.waitForTimeout(150);
  eq(await h.S(() => S.stock['Cerdo en tacos']), 450, 'stock'); eq(await h.S(() => S.P['Cerdo en tacos'].q), 450, 'tamaño'); eq(await h.S(() => S.P['Cerdo en tacos'].p), 3.39, 'precio del paquete'); eq(await h.S(() => Object.keys(S.P).length), n0 + 1, 'un producto nuevo');
  const l = await h.S(() => S.tickets[S.tickets.length - 1].lineas[0]); eq(l.producto, 'Cerdo en tacos', 'la línea apunta al producto'); eq(l.tipo, 'De la lista', 'ya no es capricho'); eq(l.inv, 450, 'cantidad'); ok(await h.S(() => S.CATS.some(c => c.items.includes('Cerdo en tacos'))), 'en una categoría');
  ok(/A la despensa: Cerdo en tacos/.test(await p.locator('#details').innerText()), 'el detalle lo refleja');
});
T('Detalle · pasar a la despensa algo que ya existe suma al producto y no lo duplica; valida los datos', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await seed(h); await h.S(() => { S.P['Canela molida'] = S.P['Canela molida'] || { f: 'Bote', p: 1, q: 1, u: 'ud', t: 1 }; S.stock['Canela molida'] = 1; save(); }); await open(p, h);
  await p.locator('[data-act=tk-fix]').nth(1).click(); await p.fill('#tkf-name', 'canela molida'); await p.selectOption('#tkf-u', 'g'); await p.fill('#tkf-q', ''); await p.click('[data-act=tk-fix-save]'); ok(await p.locator('#tkf-name').count() === 1, 'sin cantidad no guarda y el formulario sigue');
  await p.fill('#tkf-q', '30'); await p.click('[data-act=tk-fix-save]'); await p.waitForTimeout(150); eq(await h.S(() => Object.keys(S.P).filter(k => /canela molida/i.test(k)).length), 1, 'no se duplica');
});
T('Detalle · completar los datos de la factura con una foto, y rechazar la foto de otro ticket', async ({ p, h, env, ok, eq }) => {
  await h.start(); await setup(h); await seed(h, { total: 9.5 }); await p.evaluate(() => { S.apiKey = 'sk-ant-test'; save(); }); await open(p, h); const png = path.join(__dirname, 'ticket.png');
  env.nextTicket = { tienda: 'Mercadona', fecha: '2026-11-07', total: 99, hora: '20:41', num_factura: 'X1', lineas: [] }; let [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act=tk-complete]')]); await fc.setFiles(png); await p.waitForSelector('#scan-in .check.bad', { timeout: 5000 });
  ok(/no coincide/.test(await p.locator('#scan-in').innerText()), 'rechaza si el total no cuadra'); ok(!(await h.S(() => S.tickets[S.tickets.length - 1].factura)), 'no cambió nada'); await h.closeAll();
  env.nextTicket = { tienda: 'Mercadona', fecha: '2026-11-07', total: 9.5, hora: '20:41', num_factura: 'X1', metodo_pago: 'tarjeta', iva: [{ tipo: 21, base: 7.85, cuota: 1.65 }], lineas: [L('CERDO TACOS', { importe: 3.39, precio_unitario: 3.39 })] };
  [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act=tk-complete]')]); await fc.setFiles(png); await p.waitForTimeout(600);
  const t = await h.S(() => S.tickets[S.tickets.length - 1]); eq(t.factura, 'X1', 'factura guardada'); eq(t.hora, '20:41', 'hora'); eq(t.iva[0].cuota, 1.65, 'iva'); eq(t.lineas.length, 3, 'las líneas no se tocan'); eq(t.lineas[0].pu, 3.39, 'precio unitario añadido');
});
T('Archivo · «Todos mis tickets» junta todos por meses y los muestra como un ticket completo', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await h.S(() => { S.tickets.push({ id: 't1', fecha: '2026-10-24', tienda: 'Mercadona', total: 42.25, hora: '19:05', factura: 'F-1', iva: [{ tipo: 10, base: 38.4, cuota: 3.85 }], lineas: [{ desc: 'AGUA 6L', producto: null, inv: 0, uds: 2, pu: 1.1, importe: 2.2, tipo: 'Extra', grupo: 'Otros' }] }, { id: 't2', fecha: '2026-10-31', tienda: 'Frutas Hadi', total: 2.93, lineas: [] }); S.detailsOpen = true; render(); });
  const d = p.locator('details.tkall'); eq(await d.count(), 1, 'existe el archivo'); await d.locator('> summary').click(); await p.waitForTimeout(100); let tx = await d.innerText();
  ok(/Octubre 2026/.test(tx) && /45,18/.test(tx), 'agrupa por mes con su total'); ok(/Frutas Hadi/.test(tx) && /Mercadona/.test(tx), 'están los tickets de meses anteriores'); ok(await h.S(() => S.tkAllOpen), 'recuerda que está abierto');
  await d.locator('[data-act=tk-open]').nth(1).click(); await p.waitForTimeout(100); tx = await p.locator('details.tkall').innerText();
  ok(/Factura F-1/.test(tx) && /19:05/.test(tx) && /TOTAL/.test(tx) && /10%/.test(tx) && /AGUA 6L/.test(tx) && /× 2 a/.test(tx), 'se ve el ticket completo como en el papel: ' + tx.slice(0, 200));
});
T('Datos antiguos · un apunte de comida sin nombre ni coste se repara al abrir', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { S.log.push({ ts: Date.now() - 864e5, t: 'snack' }); save(); }); await p.reload(); await p.waitForTimeout(400);
  eq(await h.S(() => S.log.filter(x => !isFinite(x.c) || !x.n).length), 0, 'sin apuntes rotos');
});
