// Conversaciones reales con el asistente: la herramienta correcta, con la cantidad del usuario, y las reglas del prompt.
const { T } = require('./lib');
const rt = (h, name, x) => h.S(([n, x]) => runTool(n, x), [name, x]);
const lvl = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); return r; };

T('Asistente · editar_producto corrige lo que trae el paquete, el formato y el precio sin tocar la despensa', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); const n = await h.S(() => Object.keys(S.P).find(k => !S.P[k].c && S.P[k].u === 'g' && S.P[k].q >= 200)); await h.S(n => { S.stock[n] = 123; save(); }, n);
  const antes = await h.S(n => ({ ...S.P[n] }), n); const r = await rt(h, 'editar_producto', { producto: n, cantidad_formato: 400, precio: 2.1 });
  ok(/^OK/.test(r), r); eq(await h.S(n => S.P[n].q, n), 400, 'trae 400'); eq(await h.S(n => S.P[n].p, n), 2.1, 'precio'); ok(/400/.test(await h.S(n => S.P[n].f, n)), 'el formato lo dice: ' + await h.S(n => S.P[n].f, n)); eq(await h.S(n => S.stock[n], n), 123, 'la despensa no cambia');
  const r2 = await rt(h, 'editar_producto', { producto: n.toUpperCase(), formato: 'Bolsa grande 400 g' }); ok(/^OK/.test(r2), 'resuelve mayúsculas: ' + r2); eq(await h.S(n => S.P[n].f, n), 'Bolsa grande 400 g', 'formato nuevo');
});
T('Asistente · editar_producto rechaza lo que no tiene sentido', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); const n = await h.S(() => Object.keys(S.P)[0]);
  for (const [x, re] of [[{ producto: 'ñoño inventado', cantidad_formato: 5 }, /no está en el catálogo/], [{ producto: n }, /qué cambio/], [{ producto: n, cantidad_formato: 0 }, /mayor que 0/], [{ producto: n, cantidad_formato: -5 }, /mayor que 0/], [{ producto: n, precio: -1 }, /precio no válido/]]) { const r = await rt(h, 'editar_producto', x); ok(re.test(r), JSON.stringify(x) + ' → ' + r); }
  ok(await h.S(() => Object.values(S.P).every(p => isFinite(p.q) && p.q > 0 && isFinite(p.p))), 'ningún producto quedó roto');
});
T('Asistente · editar_producto en un consumible cambia los gramos del bote', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); const n = await h.S(() => Object.keys(S.P).find(k => S.P[k].c)); ok(!!n, 'hay un consumible'); const r = await rt(h, 'editar_producto', { producto: n, cantidad_formato: 60 }); ok(/^OK/.test(r), r); eq(await h.S(n => S.P[n].g, n), 60, 'gramos del bote'); eq(await h.S(n => S.P[n].q, n), 1, 'sigue contando botes');
});
T('Asistente · caso «usé… para sacar 6 platos»: receta, semana, corrección de despensa y descuento', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl(h); const [pasta, carne, queso] = await h.S(() => { const f = (re, u) => Object.keys(S.P).find(k => re.test(k) && !S.P[k].c); return [f(/macarron/i), f(/cerdo|picada/i), f(/queso rallado/i)]; });
  ok(pasta && carne && queso, 'productos de la conversación: ' + [pasta, carne, queso]); await h.S(([a, b, c]) => { S.stock[a] = 900; S.stock[b] = 250; S.stock[c] = 270; save(); }, [pasta, carne, queso]);
  ok(/^OK/.test(await rt(h, 'crear_receta', { nombre: 'Fideos con carne', tipos: ['almuerzo'], raciones: 6, apta_tanda: true, ingredientes: [{ producto: pasta, cantidad: 900 }, { producto: carne, cantidad: 250 }, { producto: queso, cantidad: 400 }], pasos: ['Cocer la pasta', 'Mezclar'] })), 'crea la receta');
  const id = await h.S(() => S.R.find(r => r.n === 'Fideos con carne').id); ok(/^OK/.test(await rt(h, 'anadir_a_semana', { receta_id: id, platos: 6 })), 'a la semana');
  ok(/^OK/.test(await rt(h, 'ajustar_despensa', { producto: queso, cantidad: 130, modo: 'sumar', motivo: 'correccion' })), 'corrige lo que constaba (tras confirmarlo el usuario)'); const r = await rt(h, 'marcar_cocinado', { receta_id: id });
  ok(/^OK/.test(r) && !/No tenías/.test(r), 'descuenta sin faltantes: ' + r); eq(await h.S(q => S.stock[q] || 0, queso), 0, 'se gastó la bolsa'); eq(await h.S(a => S.stock[a] || 0, pasta), 0, 'y la pasta');
  eq(await h.S(() => S.plan.find(i => i.rid === 'x' || byId(i.rid).n === 'Fideos con carne').cocinado), true, 'marcada como cocinada');
});
T('Asistente · el prompt trae las reglas que evitan los errores de la conversación', async ({ p, h, ok }) => {
  await h.start(); const sp = await h.S(() => aiContext());
  for (const [re, m] of [[/editar_producto/, 'sabe editar productos'], [/La despensa es la referencia/, 'no da por bueno lo que no consta en la despensa y pregunta'], [/marcar_cocinado, en ese orden/, 'lo ya cocinado se descuenta'], [/fideos, espaguetis, macarrones/, 'equivalencias sin preguntar'], [/UNA sola vez/, 'una sola pregunta'], [/no puedes es renombrar/i, 'lo que no puede lo dice claro']]) ok(re.test(sp), m);
  ok(await h.S(() => AI_TOOLS.some(t => t.name === 'editar_producto')), 'la herramienta está expuesta');
});
