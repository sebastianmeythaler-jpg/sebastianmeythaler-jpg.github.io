const { T } = require('./lib');
const lvl4 = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 3); await h.stockFor(r.id, 3); await h.S(() => { S.log.push({ ts: Date.now() - 3600e3, t: 'almuerzo', n: 'Plato previo', c: 1 }); S.apiKey = 'sk-ant-test'; save(); render(); }); return r; };
const say = (h, text, tools, final = 'Listo.') => h.chatSay(text, [{ tools }, { text: final }]);
const ai = async (h, p) => { await p.locator('#btn-ai').click(); await p.waitForSelector('#chat-text'); };

T('Asistente · se abre, saluda y ofrece las 4 sugerencias', async ({ p, h, ok, eq }) => {
  await h.start({ name: 'Marta' }); await lvl4(h); await ai(h, p); ok(await p.locator('#dlg-ai').evaluate(d => d.open), 'se abre'); ok(/Hola, Marta/.test(await p.locator('#chat').innerText()), 'saluda por el nombre'); eq(await p.locator('.sugs [data-sug]').count(), 4, '4 sugerencias');
  await p.locator('#ai-in [data-close]').click(); ok(!(await p.locator('#dlg-ai').evaluate(d => d.open)), 'se cierra');
});
T('Asistente · sin clave avisa de que hay que configurarla', async ({ p, h, ok }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.apiKey = ''; S.code = ''; save(); }); await ai(h, p); ok(/Añade tu/.test(await p.locator('#ai-in').innerText()), 'aviso de configuración');
});
T('Asistente · enviar un mensaje lo muestra y muestra la respuesta', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); await h.chatSay('Hola, ¿qué tal?', [{ text: '¡Muy bien! Dime qué has comido.' }]); ok(/Hola, ¿qué tal\?/.test(await p.locator('#chat .msg.u').innerText()), 'tu mensaje'); ok(/Muy bien/.test(await p.locator('#chat .msg.a').last().innerText()), 'respuesta');
});
T('Asistente · mensaje vacío no se envía', async ({ p, h, env, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); await p.fill('#chat-text', '   '); await p.click('#chat-form button[type=submit]'); await p.waitForTimeout(200); eq(env.aiCalls.length, 0, 'no llama a la IA');
});
T('Asistente · cada sugerencia rápida envía su texto', async ({ p, h, env, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); const sugs = await p.locator('.sugs [data-sug]').evaluateAll(b => b.map(x => x.dataset.sug));
  for (const s of sugs) { env.chat.push({ text: 'ok ' + s.slice(0, 5) }); await p.locator(`.sugs [data-sug="${s.replace(/"/g, '\\"')}"]`).click(); await p.waitForFunction(() => !aiBusy, null, { timeout: 5000 }); await p.waitForTimeout(80); ok((await p.locator('#chat .msg.u').allInnerTexts()).some(t => t.includes(s)), 'envía «' + s + '»'); }
});
T('Asistente · solo se envía el último mensaje (lo anterior va como «ya procesado»)', async ({ p, h, env, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); await h.chatSay('Me comí 2 huevos', [{ text: 'Anotado.' }]); await h.chatSay('Y una manzana', [{ text: 'Vale.' }]); const last = env.aiCalls[env.aiCalls.length - 1];
  eq(last.messages.length, 1, 'solo 1 mensaje en la petición'); ok(/Y una manzana/.test(JSON.stringify(last.messages[0])), 'es el último'); ok(/Me comí 2 huevos/.test(JSON.stringify(last.system)) && /NUNCA repitas/.test(JSON.stringify(last.system)), 'lo anterior va en el contexto con la regla de no repetir');
});
T('Asistente · ajustar_despensa: sumar, restar, fijar y comido', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); const s0 = await h.S(() => S.stock['Arroz'] || 0);
  await say(h, 'compré arroz', [{ tool: 'ajustar_despensa', input: { motivo: 'compra', producto: 'Arroz', cantidad: 500, modo: 'sumar' } }]); eq(await h.S(() => S.stock['Arroz']), s0 + 500, 'sumar'); ok(/✓/.test(await p.locator('#chat .msg.t').last().innerText()), 'muestra ✓ de lo hecho');
  await say(h, 'tiré 200 g', [{ tool: 'ajustar_despensa', input: { motivo: 'tirado', producto: 'Arroz', cantidad: 200, modo: 'restar' } }]); eq(await h.S(() => S.stock['Arroz']), s0 + 300, 'restar');
  await say(h, 'tengo 1 kg', [{ tool: 'ajustar_despensa', input: { motivo: 'correccion', producto: 'Arroz', cantidad: 1000, modo: 'fijar' } }]); eq(await h.S(() => S.stock['Arroz']), 1000, 'fijar');
  const l0 = await h.S(() => S.log.length); await say(h, 'me comí 100 g de arroz', [{ tool: 'ajustar_despensa', input: { motivo: 'comido', producto: 'Arroz', cantidad: 100, modo: 'restar' } }]); eq(await h.S(() => S.stock['Arroz']), 900, 'comido resta'); eq(await h.S(() => S.log.length), l0 + 1, 'y se anota la comida'); ok(await h.S(() => S.log[S.log.length - 1].c) > 0, 'con coste');
  await say(h, 'quita todo', [{ tool: 'ajustar_despensa', input: { motivo: 'tirado', producto: 'Arroz', cantidad: 5000, modo: 'restar' } }]); ok(await h.S(() => !('Arroz' in S.stock)), 'restar de más deja 0 y quita el producto');
});
T('Asistente · producto inexistente da error claro y no cambia nada', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); const s0 = await h.S(() => JSON.stringify(S.stock)); await say(h, 'compré ñoño', [{ tool: 'ajustar_despensa', input: { motivo: 'compra', producto: 'Producto Inventado', cantidad: 5, modo: 'sumar' } }]); eq(await h.S(() => JSON.stringify(S.stock)), s0, 'la despensa no cambia'); ok(!/✓/.test(await p.locator('#chat').innerText().then(t => t.split('Producto Inventado')[1] || '')), 'no marca ✓');
});
T('Asistente · anotar_consumo resta, cuesta y suma a «Lo que comes»', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Pechuga de pollo'] = 500; S.stock['Huevos L'] = 6; save(); }); await ai(h, p); const l0 = await h.S(() => S.log.length); const c0 = await h.S(() => S.log.reduce((a, x) => a + x.c, 0));
  await say(h, 'para el almuerzo usé 180 g de pollo y 2 huevos', [{ tool: 'anotar_consumo', input: { comida: 'almuerzo', descripcion: 'Pollo con huevo', ingredientes: [{ producto: 'Pechuga de pollo', cantidad: 180 }, { producto: 'Huevos L', cantidad: 2 }] } }]);
  eq(await h.S(() => S.stock['Pechuga de pollo']), 320, 'resta el pollo'); eq(await h.S(() => S.stock['Huevos L']), 4, 'resta los huevos'); eq(await h.S(() => S.log.length), l0 + 1, 'una comida anotada'); const exp = await h.S(() => 180 * ucost(S.P['Pechuga de pollo']) + 2 * ucost(S.P['Huevos L']));
  ok(h.approx(await h.S(() => S.log.reduce((a, x) => a + x.c, 0)) - c0, exp, 0.02), 'el coste es exacto: ' + exp.toFixed(2)); await p.locator('#ai-in [data-close]').click(); await h.view('semana'); await p.click('#btn-eaten'); ok(/Pollo con huevo/.test(await p.locator('#eaten-panel').innerText()), 'aparece en «Lo que comes»');
});
T('Asistente · anotar_consumo con más cantidad de la que hay solo cobra lo que había', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Huevos L'] = 2; save(); }); await ai(h, p); const c0 = await h.S(() => S.log.reduce((a, x) => a + x.c, 0));
  await say(h, 'me comí 10 huevos', [{ tool: 'anotar_consumo', input: { comida: 'cena', descripcion: 'Huevos', ingredientes: [{ producto: 'Huevos L', cantidad: 10 }] } }]); ok(!('Huevos L' in await h.S(() => S.stock)), 'deja 0'); ok(h.approx(await h.S(() => S.log.reduce((a, x) => a + x.c, 0)) - c0, await h.S(() => 2 * ucost(S.P['Huevos L'])), 0.02), 'cobra solo los 2 que tenías');
});
T('Asistente · anotar_snack, anotar_comida, anotar_comida_fuera', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await lvl4(h); await h.S(() => { S.stock['Plátano'] = 3; save(); }); await ai(h, p); let l = await h.S(() => S.log.length);
  await say(h, 'me comí un plátano', [{ tool: 'anotar_snack', input: { producto: 'Plátano', cantidad: 1 } }]); eq(await h.S(() => S.stock['Plátano']), 2, 'snack resta'); eq(await h.S(() => S.log.length), l + 1, 'snack anotado');
  await say(h, 'me comí el plato', [{ tool: 'anotar_comida', input: { receta_id: r.id, raciones: 1 } }]); eq(await h.S(() => S.log.length), l + 2, 'comida anotada'); eq(await h.S(() => S.plan[0].veces), 2, 'resta un plato de la semana');
  const spent0 = await h.S(() => spentInfo().spent); await say(h, 'cené fuera 12 €', [{ tool: 'anotar_comida_fuera', input: { descripcion: 'Pizza', importe: 12, comida: 'cena' } }]); eq(await h.S(() => S.log.length), l + 3, 'comida fuera anotada'); ok(h.approx(await h.S(() => spentInfo().spent), spent0 + 12, 0.01), 'suma 12 € al gasto');
  await say(h, 'cené fuera', [{ tool: 'anotar_comida_fuera', input: { descripcion: 'Pizza', comida: 'cena' } }]); eq(await h.S(() => S.log.length), l + 3, 'sin importe no anota');
});
T('Asistente · semana: añadir, quitar, marcar cocinado', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await lvl4(h); const r2 = await h.pick({ tipo: 'cena', cheap: true }); await ai(h, p);
  await say(h, 'añade una cena', [{ tool: 'anadir_a_semana', input: { receta_id: r2.id, platos: 2 } }]); eq(await h.S(id => S.plan.find(i => i.rid === id).veces, r2.id), 2, 'añadida con 2 platos'); ok(await h.S(id => S.mine.includes(id), r2.id), 'y en el recetario');
  await say(h, 'añade otra', [{ tool: 'anadir_a_semana', input: { receta_id: r2.id, platos: 1 } }]); eq(await h.S(id => S.plan.find(i => i.rid === id).veces, r2.id), 3, 'suma a la que ya había');
  await say(h, 'ya cociné el primero', [{ tool: 'marcar_cocinado', input: { receta_id: r.id } }]); ok(await h.S(id => S.plan.find(i => i.rid === id).cocinado, r.id), 'cocinado');
  await say(h, 'quita la cena', [{ tool: 'quitar_de_semana', input: { receta_id: r2.id } }]); ok(await h.S(id => !S.plan.some(i => i.rid === id), r2.id), 'quitada');
  await say(h, 'añade algo que no existe', [{ tool: 'anadir_a_semana', input: { receta_id: 'no-existe', platos: 1 } }]); ok(await h.S(() => S.plan.every(i => byId(i.rid))), 'receta inexistente no deja huérfanos');
});
T('Asistente · recetario y presupuesto', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); const r = await h.S(() => S.R.find(r => !S.mine.includes(r.id)).id); await ai(h, p);
  await say(h, 'guarda esa receta', [{ tool: 'gestionar_recetario', input: { receta_id: r, accion: 'anadir' } }]); ok(await h.S(id => S.mine.includes(id), r), 'añadida'); await say(h, 'quítala', [{ tool: 'gestionar_recetario', input: { receta_id: r, accion: 'quitar' } }]); ok(await h.S(id => !S.mine.includes(id), r), 'quitada');
  await say(h, 'mi presupuesto son 30', [{ tool: 'cambiar_presupuesto', input: { euros: 30 } }]); eq(await h.S(() => S.budget), 30, 'presupuesto 30');
});
T('Asistente · crear_producto y crear_receta (con coste, pasos y recetario)', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p);
  await say(h, 'añade humus', [{ tool: 'crear_producto', input: { nombre: 'Humus', unidad: 'g', formato: 'Tarrina 200 g', precio: 1.8, cantidad_formato: 200, categoria: 'Otros', cantidad_en_casa: 200 } }]); ok(await h.S(() => !!S.P['Humus'] && S.stock['Humus'] === 200), 'producto creado con 200 g en casa'); ok(await h.S(() => S.CATS.some(c => c.items.includes('Humus'))), 'está en una categoría');
  await say(h, 'otra vez humus', [{ tool: 'crear_producto', input: { nombre: 'Humus', unidad: 'g', formato: 'x', precio: 9, cantidad_formato: 1 } }]); eq(await h.S(() => S.P['Humus'].p), 1.8, 'si ya existe no lo pisa');
  await say(h, 'receta', [{ tool: 'crear_receta', input: { nombre: 'Tostada de humus', tipos: ['desayuno'], raciones: 2, apta_tanda: false, ingredientes: [{ producto: 'Humus', cantidad: 100 }, { producto: 'Pan de molde integral', cantidad: 2 }], pasos: ['Tuesta el pan.', 'Unta el humus.'] } }]);
  const rid = await h.S(() => S.R.find(r => r.n === 'Tostada de humus').id); ok(await h.S(id => S.mine.includes(id) && S.STEPS[id].length === 2, rid), 'en el recetario con sus pasos'); ok(await h.S(id => perRacion(byId(id), false) > 0, rid), 'tiene coste por ración');
  await say(h, 'mejora la receta', [{ tool: 'crear_receta', input: { nombre: 'tostada de humus', tipos: ['desayuno'], raciones: 1, apta_tanda: false, ingredientes: [{ producto: 'Humus', cantidad: 50 }], pasos: ['Solo humus.'] } }]); eq(await h.S(() => S.R.filter(r => /humus/i.test(r.n)).length), 1, 'misma receta: se actualiza, no se duplica'); eq(await h.S(id => byId(id).rac, rid), 1, 'con los datos nuevos');
  await say(h, 'receta mala', [{ tool: 'crear_receta', input: { nombre: 'Mala', tipos: ['cena'], raciones: 1, apta_tanda: false, ingredientes: [{ producto: 'Cosa Inexistente', cantidad: 1 }], pasos: ['x'] } }]); ok(await h.S(() => !S.R.some(r => r.n === 'Mala')), 'ingrediente inexistente: no la crea');
});
T('Asistente · ajustar_hogar: sumar, restar, fijar y a la lista', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p);
  await say(h, 'compré 2 champús', [{ tool: 'ajustar_hogar', input: { producto: 'champú', cantidad: 2, modo: 'sumar', categoria: 'Aseo personal' } }]); eq(await h.S(() => S.hstock['Champú']), 2, 'sumar'); await say(h, 'gasté uno', [{ tool: 'ajustar_hogar', input: { producto: 'Champú', cantidad: 1, modo: 'restar' } }]); eq(await h.S(() => S.hstock['Champú']), 1, 'restar');
  await say(h, 'tengo 5', [{ tool: 'ajustar_hogar', input: { producto: 'Champú', cantidad: 5, modo: 'fijar' } }]); eq(await h.S(() => S.hstock['Champú']), 5, 'fijar'); await say(h, 'se acabó', [{ tool: 'ajustar_hogar', input: { producto: 'Champú', modo: 'a_la_lista' } }]); eq(await h.S(() => S.hwant['Champú']), 1, 'a la lista');
  ok(await h.S(() => shop(S.plan).total) >= 0, 'sin romper la compra de comida');
});
T('Asistente · recordar_habito (sin duplicados) y «Olvidar»', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); await say(h, 'suelo cenar tarde', [{ tool: 'recordar_habito', input: { nota: 'Suele cenar a las 22h' } }]); eq(await h.S(() => S.habits.length), 1, 'un hábito'); await say(h, 'ya te lo dije', [{ tool: 'recordar_habito', input: { nota: 'suele cenar a las 22h' } }]); eq(await h.S(() => S.habits.length), 1, 'sin duplicados');
  await p.locator('details.habits summary').click(); ok(/Suele cenar a las 22h/.test(await p.locator('details.habits').innerText()), 'se ve en la lista'); await p.locator('[data-habit-del]').click(); await p.waitForTimeout(80); eq(await h.S(() => S.habits.length), 0, '«Olvidar» lo quita');
});
T('Asistente · varias acciones en un mismo mensaje se aplican todas', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Huevos L'] = 6; S.stock['Plátano'] = 3; save(); }); await ai(h, p);
  await say(h, 'me comí 2 huevos y un plátano', [{ tool: 'anotar_snack', input: { producto: 'Plátano', cantidad: 1 } }, { tool: 'anotar_consumo', input: { comida: 'desayuno', descripcion: 'Huevos', ingredientes: [{ producto: 'Huevos L', cantidad: 2 }] } }]); eq(await h.S(() => [S.stock['Huevos L'], S.stock['Plátano']]), [4, 2], 'las dos acciones'); ok((await p.locator('#chat .msg.t').count()) >= 2, 'dos ✓ en el chat');
});
T('Asistente · «Deshacer lo último» restaura todo', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Huevos L'] = 6; save(); }); await ai(h, p); const snap = await h.S(() => JSON.stringify([S.stock, S.log.length]));
  await say(h, 'me comí 4 huevos', [{ tool: 'anotar_consumo', input: { comida: 'cena', descripcion: 'Huevos', ingredientes: [{ producto: 'Huevos L', cantidad: 4 }] } }]); ok(await p.locator('[data-undo]').count() === 1, 'aparece «Deshacer»'); await p.locator('[data-undo]').click(); await p.waitForTimeout(100);
  eq(await h.S(() => JSON.stringify([S.stock, S.log.length])), snap, 'despensa y registro como antes'); eq(await p.locator('[data-undo]').count(), 0, 'el botón desaparece');
});
T('Asistente · «Borrar chat» limpia la conversación pero no los datos ni los hábitos', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Huevos L'] = 6; S.habits = [{ t: 'Hábito', ts: 1 }]; save(); }); await ai(h, p); await say(h, 'me comí 2 huevos', [{ tool: 'anotar_consumo', input: { comida: 'cena', descripcion: 'Huevos', ingredientes: [{ producto: 'Huevos L', cantidad: 2 }] } }]);
  await p.locator('[data-clear]').click(); await p.waitForTimeout(100); eq(await h.S(() => S.chat.length), 0, 'chat vacío'); eq(await h.S(() => S.stock['Huevos L']), 4, 'la despensa se queda'); eq(await h.S(() => S.habits.length), 1, 'los hábitos se quedan'); ok(/Chat borrado/.test(await h.toast()), 'avisa');
});
T('Asistente · el chat empieza limpio al día siguiente (y no repite acciones viejas)', async ({ p, h, ok, eq }) => {
  await h.start(); await lvl4(h); await h.S(() => { S.stock['Huevos L'] = 6; S.habits = [{ t: 'H', ts: 1 }]; save(); }); await ai(h, p); await say(h, 'me comí 2 huevos', [{ tool: 'anotar_consumo', input: { comida: 'cena', descripcion: 'Huevos', ingredientes: [{ producto: 'Huevos L', cantidad: 2 }] } }]); await p.locator('#ai-in [data-close]').click();
  await p.context().clock.setSystemTime(new Date('2026-11-08T10:00:00+01:00')); await p.reload(); await p.waitForTimeout(300); await p.click('#btn-ai'); await p.waitForSelector('#chat-text'); eq(await h.S(() => S.chat.length), 0, 'chat limpio'); eq(await h.S(() => S.stock['Huevos L']), 4, 'sin reejecutar'); eq(await h.S(() => S.habits.length), 1, 'hábitos intactos');
});
T('Asistente · un error de la IA se muestra en lenguaje normal, sin texto técnico', async ({ p, h, env, ok, eq }) => {
  await h.start(); await lvl4(h); await ai(h, p); await h.chatSay('hola', [{ error: 'overloaded_error: internal stack trace {json}' }]); const t = await p.locator('#chat').innerText(); ok(!/stack trace|\{json\}|overloaded_error|undefined|\[object/.test(t), 'no enseña el error técnico: «' + t.slice(-120).replace(/\n/g, ' ') + '»');
  ok(await p.locator('#chat-form button[type=submit]').isEnabled(), 'se puede volver a escribir');
});
T('Asistente · sin internet explica la causa', async ({ p, h, env, ok }) => {
  await h.start(); await lvl4(h); await ai(h, p); env.offline = true; await h.chatSay('hola', []); ok(/conexi|internet/i.test(await p.locator('#chat').innerText()), 'habla de la conexión');
});
T('Asistente · el contexto que recibe la IA incluye despensa, semana, presupuesto y recetas', async ({ p, h, env, ok }) => {
  await h.start(); const r = await lvl4(h); await ai(h, p); await h.chatSay('hola', [{ text: 'hola' }]); const sys = JSON.stringify(env.aiCalls[0].system); ok(sys.includes(r.id) && /Arroz|Huevos|Atún|Pollo/.test(sys), 'incluye recetas con id y despensa'); ok(/presupuesto/i.test(sys), 'incluye el presupuesto'); ok(/Prueba/.test(sys), 'incluye el nombre');
});
