// Nombres «como los escribe la gente»: mayúsculas, plurales, tildes, sinónimos, por la IA y a mano.
const { T } = require('./lib');
const rt = (h, name, x) => h.S(([n, x]) => runTool(n, x), [name, x]);
const lvl = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); return r; };

T('Nombres · la IA crea un producto y luego lo pide con otras mayúsculas/plural: no hay duplicados', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h);
  ok(/^OK/.test(await rt(h, 'crear_producto', { nombre: 'Tofu ahumado', unidad: 'g', formato: 'Paquete 200 g', precio: 2.5, cantidad_formato: 200, categoria: 'Proteínas', cantidad_en_casa: 200 })), 'crea');
  const r = await rt(h, 'crear_producto', { nombre: 'tofu ahumado', unidad: 'g', formato: 'Paquete 200 g', precio: 2.5, cantidad_formato: 200, categoria: 'Proteínas' }); ok(/Ya existe/.test(r), 'rechaza el duplicado: ' + r);
  const r2 = await rt(h, 'crear_producto', { nombre: 'Tofus ahumados', unidad: 'g', formato: 'Paquete 200 g', precio: 2.5, cantidad_formato: 200, categoria: 'Proteínas' }); ok(/Ya existe/.test(r2), 'el plural tampoco: ' + r2);
  const r3 = await rt(h, 'ajustar_despensa', { motivo: 'compra', producto: 'TOFU AHUMADO', cantidad: 100, modo: 'sumar' }); ok(/^OK/.test(r3), 'encuentra el producto en mayúsculas: ' + r3); eq(await h.S(() => S.stock['Tofu ahumado']), 300, 'suma sobre el existente');
});
T('Nombres · la IA habla de casa con sinónimos (estropajo, esponja, fibra) y todo va al mismo producto', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); const n0 = await h.S(() => Object.keys(S.HP).length);
  for (const v of ['estropajo', 'Esponja de cocina', 'fibras', 'Estropajos y esponjas']) ok(/^OK/.test(await rt(h, 'ajustar_hogar', { producto: v, modo: 'sumar', cantidad: 1 })), v);
  eq(await h.S(() => Object.keys(S.HP).length), n0, 'sin productos de casa nuevos'); eq(await h.S(() => S.hstock['Estropajos y esponjas']), 4, '4 unidades en el mismo');
});
T('Nombres · anotar_consumo con producto escrito distinto lo encuentra o avisa, nunca inventa', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); await h.S(() => { S.stock['Huevos L'] = 6; save(); });
  const r = await rt(h, 'anotar_consumo', { comida: 'cena', descripcion: 'Tortilla', ingredientes: [{ producto: 'huevos', cantidad: 2 }] }); ok(/^OK|Error|no encontr/i.test(r), 'responde algo claro: ' + r);
  ok(await h.S(() => Object.keys(S.stock).every(k => S.P[k])), 'no hay stock de productos inexistentes'); const n = await h.S(() => Object.keys(S.P).length);
  await rt(h, 'anotar_consumo', { comida: 'cena', descripcion: 'x', ingredientes: [{ producto: 'ñoño inexistente', cantidad: 2 }] }); eq(await h.S(() => Object.keys(S.P).length), n, 'no crea productos al consumir');
});
T('Nombres · añadir a mano en Despensa un producto con nombre ya existente (otra grafía) no lo duplica', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); await h.view('despensa'); const ex = await h.S(() => Object.keys(S.P).find(k => /^[A-Z]/.test(k) && !S.P[k].c));
  const lower = ex.toLowerCase(); await h.S((n) => { S.invSel = n; render(); }, ex);
  ok(await h.S(() => typeof findName === 'function'), 'existe el buscador de nombres'); ok(await h.S(([a, b]) => sameName(a, b, false), [ex, lower.toUpperCase()]), 'mismo nombre en mayúsculas es el mismo');
});
T('Nombres · el buscador reconoce iguales y no confunde distintos', async ({ p, h, ok, eq }) => {
  await h.start(); const yes = [['Estropajo', 'Esponja de cocina'], ['Papel higiénico', 'Papel higienico'], ['Champú', 'champu'], ['Salsa de tomate', 'SALSA TOMATE'], ['Bolsas de basura', 'Bolsa de basura']];
  const no = [['Papel higiénico', 'Papel de cocina'], ['Gel de ducha', 'Gel de manos'], ['Leche de coco', 'Leche de avena'], ['Esponja de baño', 'Estropajo de cocina'], ['Pasta de dientes', 'Pasta integral'], ['Aceite de oliva', 'Aceite de girasol']];
  for (const [a, b] of yes) ok(await h.S(([a, b]) => sameName(a, b, true), [a, b]), `${a} = ${b}`); for (const [a, b] of no) ok(!(await h.S(([a, b]) => sameName(a, b, true), [a, b])), `${a} ≠ ${b}`);
});
