// Tickets «de verdad»: productos que no existen, nombres raros, cantidades difíciles, combinaciones al azar.
const { T } = require('./lib');
const setup = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); return r; };
const sinProducto = h => h.S(() => S.tickets.flatMap(t => t.lineas.filter(l => l.tipo === 'De la lista' && !l.producto && !t.est).map(l => l.desc)));
const save = async (h, p, t) => { await h.scan(t); await p.click('#rv-save'); await p.waitForTimeout(150); if (await p.locator('#dlg-scan').evaluate(d => d.open)) { await p.click('#rv-save'); await p.waitForTimeout(150); } };
const L = (desc, o = {}) => ({ desc, uds: 1, importe: 2, producto: null, cantidad_inventario: 0, tipo: 'De la lista', ...o });
const tk = (lineas, o = {}) => ({ tienda: 'Mercadona', fecha: '2026-11-07', total: Math.round(lineas.reduce((a, l) => a + l.importe, 0) * 100) / 100, lineas, ...o });
const rnd = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

T('Tickets reales · comida nueva en g, ml y piezas entra a la despensa con su cantidad', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h);
  await save(h, p, tk([L('LECHE COCO 400ML', { uds: 3, importe: 4.5, nombre_nuevo: 'Leche de coco', unidad_nueva: 'ml', cantidad_envase: 400 }), L('HUEVOS CODORNIZ 24U', { uds: 1, importe: 2.4, nombre_nuevo: 'Huevos de codorniz', unidad_nueva: 'ud', cantidad_envase: 24 }), L('CERDO TACOS', { uds: 2, importe: 7, nombre_nuevo: 'Cerdo en tacos', unidad_nueva: 'g', cantidad_envase: 500 })]));
  eq(await h.S(() => S.stock['Leche de coco']), 1200, 'ml'); eq(await h.S(() => S.stock['Huevos de codorniz']), 24, 'piezas'); eq(await h.S(() => S.stock['Cerdo en tacos']), 1000, 'g');
});
T('Tickets reales · sin nombre nuevo ni cantidad igualmente no se pierde la línea', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await h.scan(tk([L('QUESO FRESCO BATIDO 0%', { uds: 2, importe: 3 }), L('PAN BIMBO 12', { uds: 1, importe: 1.9, unidad_nueva: 'g', nombre_nuevo: 'Pan bimbo' })]));
  eq(await p.locator('#scan-in .rv-attn').count(), 0, 'nada en naranja: la app propone un producto nuevo'); await p.click('#rv-save'); await p.waitForTimeout(150);
  ok(await h.S(() => Object.values(S.stock).length >= 2), 'las dos líneas entran a la despensa'); ok(await h.S(() => !S.tickets[0].lineas.some(l => l.tipo === 'De la lista' && !l.producto)), 'ninguna línea de comida queda «solo gasto»');
});
T('Tickets reales · gramos sin tamaño de envase no inventa 1 g por paquete', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await save(h, p, tk([L('JAMON COCIDO', { uds: 2, importe: 5, nombre_nuevo: 'Fiambre de pavo', unidad_nueva: 'g', cantidad_envase: null })]));
  const q = await h.S(() => S.P['Fiambre de pavo'] && S.P['Fiambre de pavo'].q); ok(q === 1 && (await h.S(() => S.P['Fiambre de pavo'].u)) === 'ud', 'se cuenta por paquetes'); eq(await h.S(() => S.stock['Fiambre de pavo']), 2, '2 paquetes');
});
T('Tickets reales · el mismo producto nuevo en dos líneas y en dos tickets no se duplica', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); const n = (d, u, i) => L(d, { uds: u, importe: i, nombre_nuevo: 'Cerdo en tacos', unidad_nueva: 'g', cantidad_envase: 500 });
  await save(h, p, tk([n('CERDO TACOS', 1, 3.5), n('CERDO TACOS OFERTA', 1, 3)])); await save(h, p, tk([n('CERDO EN TACOS 500G', 2, 7)], { fecha: '2026-11-09' }));
  eq(await h.S(() => Object.keys(S.P).filter(k => /cerdo en tacos/i.test(k)).length), 1, 'un solo producto'); eq(await h.S(() => S.stock['Cerdo en tacos']), 2000, '4 bandejas');
});
T('Tickets reales · nombres con tildes, mayúsculas y plurales no crean duplicados', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); for (const [i, nom] of ['Salsa de tomate casera', 'SALSA DE TOMATE CASERA', 'salsa tomate caseras', 'Salsa de Tómate Casera'].entries()) await save(h, p, tk([L('SALSA', { uds: 1, importe: 2, nombre_nuevo: nom, unidad_nueva: 'g', cantidad_envase: 300 })], { fecha: `2026-11-0${i + 1}` }));
  eq(await h.S(() => Object.keys(S.P).filter(k => /salsa.*tomate.*casera/i.test(k)).length), 1, 'un solo producto'); eq(await h.S(() => S.stock[Object.keys(S.P).find(k => /salsa.*tomate.*casera/i.test(k))]), 1200, '4 × 300 g');
});
T('Tickets reales · sinónimos de Hogar (todos los de la lista y sus variantes) no duplican', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); const n0 = await h.S(() => Object.keys(S.HP).length);
  const vars = ['Estropajo', 'Estropajos de cocina', 'Esponja de cocina', 'Esponjas', 'Fibra verde', 'Estropajo y esponja', 'Lavavajillas', 'Lavavajillas a mano', 'Detergente de ropa', 'Detergente ropa', 'Papel higiénico', 'Papel higienico', 'Gel de ducha', 'Pasta de dientes', 'Champú', 'Champu'];
  for (const [i, v] of vars.entries()) await save(h, p, tk([L(v.toUpperCase(), { tipo: 'Hogar', producto_hogar: v, categoria_hogar: 'Limpieza', importe: 1 })], { fecha: `2026-11-${String(i % 9 + 1).padStart(2, '0')}` }));
  const names = await h.S(() => Object.keys(S.HP)); ok(names.length <= n0 + 6, 'a lo sumo los productos realmente distintos: ' + (names.length - n0) + ' nuevos → ' + names.filter(x => /esponja|estropajo|fibra|lavavaj|detergente|papel hig|gel|pasta de dientes|champ/i.test(x)).join(' | '));
});
T('Tickets reales · descuento negativo, cantidad 0 y peso con decimales no rompen nada', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await save(h, p, tk([L('MANZANA GOLDEN', { uds: 0.745, importe: 1.49, nombre_nuevo: 'Manzana golden', unidad_nueva: 'g', cantidad_envase: 1000 }), L('DESCUENTO PROMO', { uds: 1, importe: -1.2, tipo: 'Extra', grupo: 'Otros' }), L('BOLSA', { uds: 0, importe: 0.1, tipo: 'Extra', grupo: 'Otros' })]));
  ok(await h.S(() => S.tickets.length === 1 && isFinite(S.tickets[0].total)), 'ticket guardado con total válido'); ok(await h.S(() => !('Manzana golden' in S.stock) || S.stock['Manzana golden'] > 0), 'sin stock inválido');
});
T('Tickets reales · ticket largo (40 líneas) cabe en la respuesta pedida', async ({ p, h, env, ok, eq }) => {
  await h.start(); await setup(h); const ls = Array.from({ length: 40 }, (_, i) => L('PRODUCTO ' + i, { importe: 1 + i / 10, nombre_nuevo: 'Cosa rica ' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + (i / 26 | 0)), unidad_nueva: 'g', cantidad_envase: 250 }));
  await h.scan(tk(ls)); ok(!/se cortó/.test(await p.locator('#scan-in').innerText()), 'no se corta'); await p.click('#rv-save'); await p.waitForTimeout(300); ok(await h.S(() => Object.keys(S.stock).filter(k => /^Cosa rica/.test(k)).length === 40), 'las 40 entran a la despensa');
});
T('Tickets reales · con el tope antiguo del servidor (2000) un ticket largo avisa claro', async ({ p, h, env, ok }) => {
  await h.start(); await setup(h); env.workerCap = 2000; const ls = Array.from({ length: 40 }, (_, i) => L('P' + i, { importe: 1 })); env.nextTicket = tk(ls);
  await p.evaluate(() => { S.apiKey = 'sk-ant-test'; save(); }); await p.locator('#btn-scan').click(); await h.scanFile(); await p.waitForSelector('#scan-in .check.bad', { timeout: 5000 }); ok(/dos partes|cortó/.test(await p.locator('#scan-in').innerText()), 'mensaje claro'); env.workerCap = 6000;
});
T('Tickets reales · 25 tickets al azar mezclando todo mantienen las cuentas', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); const r = rnd(20261107); const foods = ['Cerdo en tacos', 'Leche de coco', 'Queso fresco', 'Tofu', 'Kimchi', 'Pan naan', 'Pulpo cocido', 'Agua con gas', 'Salsa de soja', 'Hummus', 'Lomo adobado', 'Tortellini', 'Caldo de pollo', 'Aceitunas rellenas', 'Maíz dulce'];
  const casa = ['Estropajo', 'Esponja de cocina', 'Lejía', 'Suavizante', 'Bolsas de basura', 'Papel de cocina', 'Gel de ducha', 'Champú']; let esperado = 0, tickets = 0;
  for (let t = 0; t < 25; t++) {
    const n = 2 + Math.floor(r() * 8); const ls = [];
    for (let i = 0; i < n; i++) { const k = r(); const imp = Math.round((0.5 + r() * 9) * 100) / 100;
      if (k < 0.55) { const f = foods[Math.floor(r() * foods.length)]; const nom = r() < 0.3 ? f.toUpperCase() : f; ls.push(L(f.toUpperCase().slice(0, 14), { uds: 1 + Math.floor(r() * 3), importe: imp, nombre_nuevo: nom, unidad_nueva: ['g', 'ml', 'ud'][Math.floor(r() * 3)], cantidad_envase: [200, 250, 400, 500, 1000][Math.floor(r() * 5)] })); }
      else if (k < 0.75) { const c = casa[Math.floor(r() * casa.length)]; ls.push(L(c.toUpperCase(), { tipo: 'Hogar', producto_hogar: r() < 0.5 ? c : c.toLowerCase() + 's', categoria_hogar: 'Limpieza', importe: imp })); }
      else if (k < 0.9) ls.push(L('CAPRICHO ' + i, { tipo: 'Extra', grupo: 'Otros', importe: imp, es_snack: r() < 0.5 }));
      else { const rows = await h.S(() => Object.keys(S.P).slice(0, 40)); const nm = rows[Math.floor(r() * rows.length)]; ls.push(L(nm.toUpperCase(), { producto: nm, uds: 1, importe: imp, cantidad_inventario: await h.S(n => S.P[n].q, nm) })); } }
    const tt = tk(ls, { fecha: `2026-11-${String(1 + t % 28).padStart(2, '0')}`, tienda: 'Tienda ' + t }); esperado += tt.total; tickets++;
    await save(h, p, tt);
  }
  eq(await sinProducto(h), [], 'ninguna línea de comida se queda sin producto'); eq(await h.S(() => S.tickets.length), tickets, 'se guardaron todos'); ok(h.approx(await h.S(() => S.tickets.reduce((a, t) => a + t.total, 0)), esperado, 0.5), 'el gasto total cuadra con la suma de tickets');
});
T('Tickets reales · el mismo snack escrito distinto en dos tickets no se duplica', async ({ p, h, ok, eq }) => {
  await h.start(); await setup(h); await save(h, p, tk([L('GALLETAS MARIA', { tipo: 'Extra', grupo: 'Dulces y antojos', es_snack: true, importe: 1.5 })])); await save(h, p, tk([L('Galletas María', { tipo: 'Extra', grupo: 'Dulces y antojos', es_snack: true, importe: 1.6 })], { fecha: '2026-11-09' }));
  eq(await h.S(() => Object.keys(S.P).filter(k => /galletas mar/i.test(k.normalize('NFD').replace(/[̀-ͯ]/g, ''))).length), 1, 'un solo producto de galletas');
});
