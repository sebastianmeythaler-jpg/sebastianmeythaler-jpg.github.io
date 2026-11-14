const { T } = require('./lib');
// Crear una receta propia pulsando de verdad
const openNew = async (p) => { await p.click('#seg-mine'); await p.locator('[data-act=rc-new]').first().click(); await p.waitForSelector('#rc-name'); };
const ing = async (p, i, n, q) => { const rows = p.locator('#rc-ings .rc-ing'); while (await rows.count() <= i) await p.click('[data-rc=add-ing]'); await rows.nth(i).locator('.rc-n').fill(n); await rows.nth(i).locator('.rc-n').dispatchEvent('change'); if (q !== undefined) await rows.nth(i).locator('.rc-q').fill(String(q)); };
const crear = async (p, o) => { await openNew(p); await p.fill('#rc-name', o.n); for (const t of o.tipos || ['almuerzo']) await p.click(`[data-rc-tipo=${t}]`); if (o.rac) await p.fill('#rc-rac', String(o.rac)); if (o.tanda) await p.check('#rc-tanda'); let i = 0; for (const [n, q] of o.i) await ing(p, i++, n, q); if (o.pasos) await p.fill('#rc-steps', o.pasos); await p.click('[data-rc=save]'); await p.waitForTimeout(150); };
const err = p => p.locator('#form-err').innerText();

T('Receta propia · un usuario nuevo empieza en «Mi recetario» con «Crear mi receta» y «Ver recetas ya hechas»', async ({ p, h, ok, eq }) => {
  await h.start(); eq(await h.S(() => S.seg), 'mine', 'empieza en Mi recetario'); const e = p.locator('#recipe-list .empty'); ok(/vacío/.test(await e.innerText()), 'explica que está vacío');
  ok(await e.locator('[data-act=rc-new]').count() === 1, 'botón Crear mi receta'); await e.locator('[data-act=go-explore]').click(); await p.waitForTimeout(100); eq(await h.S(() => S.seg), 'explore', '«Ver recetas ya hechas» lleva a Explorar'); ok(await p.locator('details.rgroup').count() >= 3, 'se ven los grupos de Explorar');
});
T('Receta propia · crearla con ingredientes del catálogo: se guarda, sale primero, con su precio y sus pasos', async ({ p, h, ok, eq }) => {
  await h.start(); const otro = await h.pick({ tipo: 'cena' }); await h.S(id => { S.mine.push(id); save(); render(); }, otro.id);
  await crear(p, { n: 'arroz con pollo de casa', tipos: ['almuerzo', 'cena'], rac: 4, tanda: true, i: [['Arroz', 400], ['pechuga de pollo', 500], ['Cebolla', 1]], pasos: '1. Sofríe la cebolla\n- Añade el pollo\nEcha el arroz y el agua' });
  const r = await h.S(() => { const r = S.R.find(x => x.own); return r && { ...r, steps: S.STEPS[r.id], mine: S.mine.includes(r.id), cost: perRacion(r, false), exp: (400 * ucost(S.P['Arroz']) + 500 * ucost(S.P['Pechuga de pollo']) + ucost(S.P['Cebolla'])) / 4 }; });
  ok(r, 'la receta existe y está marcada como propia'); eq(r.n, 'Arroz con pollo de casa', 'nombre con mayúscula inicial'); eq(r.tipos.join(), 'almuerzo,cena', 'tipos'); eq(r.rac, 4, 'raciones'); eq(r.tanda, 1, 'para varios días'); ok(r.mine, 'está en Mi recetario');
  eq(JSON.stringify(r.i), JSON.stringify([['Arroz', 400], ['Pechuga de pollo', 500], ['Cebolla', 1]]), 'ingredientes con el nombre exacto del catálogo (sin duplicar por minúsculas)');
  eq(r.steps.join('|'), 'Sofríe la cebolla|Añade el pollo|Echa el arroz y el agua', 'pasos limpios, sin números ni guiones'); ok(h.approx(r.cost, r.exp, 0.001), 'coste por ración correcto');
  ok(!await p.locator('#dlg-form').evaluate(d => d.open), 'la hoja se cierra'); ok(/Receta guardada: Arroz con pollo de casa/.test(await h.toast()), 'avisa: ' + await h.toast());
  const first = p.locator('#recipe-list article.card').first(); ok(/Arroz con pollo de casa/.test(await first.innerText()), 'las tuyas salen primero'); ok(/Tuya/.test(await first.locator('.meta').innerText()), 'etiqueta «Tuya»'); ok(await first.locator('[data-act=rc-edit]').count() === 1, 'se puede editar');
});
T('Receta propia · validaciones: nombre, tipo, raciones, ingredientes, cantidades y repetidos', async ({ p, h, ok, eq }) => {
  await h.start(); await openNew(p); const n0 = await h.S(() => S.R.length);
  await p.click('[data-rc=save]'); ok(/nombre/.test(await err(p)), 'sin nombre'); await p.fill('#rc-name', 'Mi plato');
  await p.click('[data-rc=save]'); ok(/cuándo la comes/i.test(await err(p)), 'sin tipo'); await p.click('[data-rc-tipo=desayuno]');
  await p.fill('#rc-rac', '0'); await p.click('[data-rc=save]'); ok(/raciones/.test(await err(p)), 'raciones 0'); await p.fill('#rc-rac', '2');
  await p.click('[data-rc=save]'); ok(/al menos un ingrediente/.test(await err(p)), 'sin ingredientes');
  await ing(p, 0, 'Arroz'); await p.click('[data-rc=save]'); ok(/cantidad de Arroz/.test(await err(p)), 'ingrediente sin cantidad');
  await ing(p, 0, 'Arroz', 200); await ing(p, 1, 'arroz', 100); await p.click('[data-rc=save]'); ok(/dos veces/.test(await err(p)), 'ingrediente repetido');
  eq(await h.S(() => S.R.length), n0, 'nada guardado mientras hay errores'); ok(await p.locator('#rc-name').inputValue() === 'Mi plato', 'no se pierde lo escrito');
  await p.locator('#rc-ings .rc-ing').nth(1).locator('[data-rc=rm-ing]').click(); await p.click('[data-rc=save]'); await p.waitForTimeout(100); eq(await h.S(() => S.R.length), n0 + 1, 'corregido se guarda');
  await openNew(p); await p.fill('#rc-name', 'MI PLATO'); await p.click('[data-rc-tipo=cena]'); await ing(p, 0, 'Arroz', 100); await p.click('[data-rc=save]'); ok(/Ya tienes una receta con ese nombre/.test(await err(p)), 'nombre repetido');
});
T('Receta propia · ingrediente que no existe (sin IA): se crea con su unidad, precio y categoría, sin duplicar', async ({ p, h, ok, eq }) => {
  await h.start(); await openNew(p); await p.fill('#rc-name', 'Tofu salteado'); await p.click('[data-rc-tipo=cena]');
  await ing(p, 0, 'tofu ahumado', 200); const row = p.locator('#rc-ings .rc-ing').first(); ok(await row.locator('.rc-usel').count() === 1, 'producto nuevo: deja elegir unidad'); ok(/Producto nuevo/.test(await row.locator('.rc-new').innerText()), 'avisa de que es nuevo');
  await row.locator('.rc-pq').fill('400'); await row.locator('.rc-pp').fill('2.4');
  await ing(p, 1, 'Salsa de soja', 30); ok(await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-usel').count() === 0, 'el que ya existe muestra su unidad fija');
  await ing(p, 2, 'brotes de bambú', 1); await p.locator('#rc-ings .rc-ing').nth(2).locator('.rc-usel').selectOption('ud');
  await p.click('[data-rc=save]'); await p.waitForTimeout(150);
  const s = await h.S(() => ({ tofu: S.P['Tofu ahumado'], cat: (S.CATS[catOf('Tofu ahumado')] || {}).name, bam: S.P['Brotes de bambú'], r: S.R.find(x => x.own), cost: perRacion(S.R.find(x => x.own), false) }));
  ok(s.tofu && s.tofu.u === 'g' && s.tofu.q === 400 && s.tofu.p === 2.4, 'tofu creado: 400 g a 2,40'); eq(s.cat, 'Proteínas', 'colocado en su categoría'); ok(s.bam && s.bam.u === 'ud' && s.bam.q === 1 && s.bam.p === 0, 'el otro queda sin precio');
  ok(/Falta el precio de Brotes de bambú/.test(await h.toast()), 'avisa del precio pendiente'); ok(/Sin precio todavía: Brotes de bambú/.test(await p.locator('#recipe-list article.card').first().innerText()), 'la tarjeta lo indica');
  ok(s.cost > 0 && isFinite(s.cost), 'el coste por ración se calcula con lo que sí tiene precio');
});
T('Receta propia · con IA: el ingrediente nuevo recibe precio aproximado y categoría en segundo plano', async ({ p, h, env, ok, eq }) => {
  await h.start(); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); });
  env.forced.inventariar = { items: [{ texto: 'Leche de coco', nombre: 'Leche de coco', destino: 'comida', categoria: 'Salsas', unidad: 'ml', cantidad: 400, formato: 'Lata 400 ml', cantidad_formato: 400, precio: 1.35 }] };
  await crear(p, { n: 'Curry rápido', tipos: ['cena'], rac: 2, i: [['Pechuga de pollo', 300], ['leche de coco', 200]] }); await p.locator('#rc-ings').count();
  await p.waitForFunction(() => S.P['Leche de coco'] && S.P['Leche de coco'].p > 0, null, { timeout: 4000 });
  const s = await h.S(() => ({ p: S.P['Leche de coco'], cat: S.CATS[catOf('Leche de coco')].name, n: S.CATS.filter(c => c.items.includes('Leche de coco')).length }));
  eq(s.p.p, 1.35, 'precio de la IA'); eq(s.p.q, 400, 'tamaño del formato'); eq(s.p.f, 'Lata 400 ml', 'formato'); eq(s.cat, 'Salsas', 'categoría de la IA'); eq(s.n, 1, 'está en una sola categoría');
  ok(!/Sin precio todavía/.test(await p.locator('#recipe-list').innerText()), 'ya no sale como pendiente');
});
T('Receta propia · con IA y unidad distinta al escribir: el ingrediente sale en ml porque así lo elegí', async ({ p, h, env, ok, eq }) => {
  await h.start(); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); }); env.offline = true; // la IA falla: no debe romper nada
  await openNew(p); await p.fill('#rc-name', 'Batido'); await p.click('[data-rc-tipo=bebida]'); await ing(p, 0, 'bebida de almendra', 250); await p.locator('#rc-ings .rc-ing').first().locator('.rc-usel').selectOption('ml'); await p.click('[data-rc=save]'); await p.waitForTimeout(400);
  const s = await h.S(() => S.P['Bebida de almendra']); ok(s && s.u === 'ml' && s.q === 1000, 'se crea en ml aunque la IA no responda'); ok(await h.S(() => !!S.R.find(r => r.n === 'Batido' && r.own)), 'la receta se guarda igual');
});
T('Receta propia · editar cambia la receta sin duplicarla, y borrar pide confirmar y la quita también de la semana', async ({ p, h, ok, eq }) => {
  await h.start(); await crear(p, { n: 'Pasta mía', tipos: ['almuerzo'], rac: 2, i: [['Macarrones', 200], ['Tomate frito', 150], ['Queso rallado', 40]], pasos: 'Cuece la pasta' });
  const id = await h.S(() => S.R.find(r => r.own).id); await h.addPlan(id, 2); const n0 = await h.S(() => S.R.length);
  await p.locator(`[data-act=rc-edit][data-id="${id}"]`).click(); await p.waitForSelector('#rc-name'); eq(await p.locator('#rc-name').inputValue(), 'Pasta mía', 'abre con sus datos'); eq(await p.locator('#rc-ings .rc-ing').count(), 3, 'con sus 3 ingredientes'); ok(/Cuece la pasta/.test(await p.locator('#rc-steps').inputValue()), 'y sus pasos');
  await p.fill('#rc-name', 'Pasta de la abuela'); await p.fill('#rc-rac', '3'); await p.locator('#rc-ings .rc-ing').nth(2).locator('[data-rc=rm-ing]').click(); await p.locator('#rc-ings .rc-ing').first().locator('.rc-q').fill('300'); await p.click('[data-rc=save]'); await p.waitForTimeout(150);
  const r = await h.S(id => byId(id), id); eq(r.n, 'Pasta de la abuela', 'nombre cambiado'); eq(r.rac, 3, 'raciones'); eq(JSON.stringify(r.i), JSON.stringify([['Macarrones', 300], ['Tomate frito', 150]]), 'ingredientes editados'); eq(await h.S(() => S.R.length), n0, 'no se duplica'); ok(r.own === 1, 'sigue siendo tuya'); ok(/Cambios guardados/.test(await h.toast()), 'avisa');
  await p.locator(`[data-act=rc-edit][data-id="${id}"]`).click(); const del = p.locator('[data-rc=del]'); await del.click(); ok(await h.S(id => !!byId(id), id), 'el primer toque no borra'); ok(/Seguro/.test(await del.innerText()), 'pide confirmar'); await del.click(); await p.waitForTimeout(150);
  ok(await h.S(id => !byId(id) && !S.mine.includes(id) && !S.plan.some(x => x.rid === id) && !S.STEPS[id], id), 'borrada del recetario, de la semana y sus pasos'); ok(/Receta borrada/.test(await h.toast()), 'avisa');
});
T('Receta propia · funciona en toda la cadena: semana, lista de la compra, cocinar y comer', async ({ p, h, ok, eq }) => {
  await h.start(); await crear(p, { n: 'Lentejas de casa', tipos: ['almuerzo'], rac: 4, tanda: true, i: [['Lentejas', 400], ['Cebolla', 1], ['chorizo casero', 150]], pasos: 'Todo a la olla' });
  const id = await h.S(() => S.R.find(r => r.own).id); await p.locator(`[data-act=addone][data-id="${id}"]`).click(); await p.waitForTimeout(100); eq(await h.S(() => S.plan.length), 1, 'el + la lleva a la semana');
  await h.view('lista'); const lt = await p.locator('#shop-list').innerText(); ok(/Lentejas/.test(lt) && /Chorizo casero/.test(lt), 'la lista pide sus ingredientes, también el nuevo');
  await h.stockFor(id, 1); await h.view('semana'); const k = await h.S(() => S.plan[0].k); await h.tap(p.locator(`#plan-list [data-act=cook][data-k="${k}"]`)); await p.waitForTimeout(100); ok(await h.S(() => !!S.plan[0].cocinado), 'se puede cocinar'); ok(await h.S(() => (S.stock['Lentejas'] || 0) < 100), 'descuenta la despensa');
  await h.tap(p.locator(`#plan-list [data-act=eat][data-k="${k}"]`)); await p.waitForTimeout(150); await h.closeAll(); ok(await h.S(() => S.log.length === 1 && isFinite(S.log[0].c)), 'comer la anota con coste válido');
});
T('Receta propia · en Explorar no aparece duplicada y el filtro y el buscador la encuentran en Mi recetario', async ({ p, h, ok, eq }) => {
  await h.start(); await crear(p, { n: 'Tostadas de aguacate', tipos: ['desayuno'], rac: 1, i: [['Pan de molde integral', 2], ['Aguacate', 1]] });
  await p.click('#seg-explore'); await h.search('Tostadas de aguacate'); eq(await p.locator('#recipe-list article.card h3', { hasText: /^Tostadas de aguacate$/ }).count(), 0, 'no sale en Explorar (ya es tuya)');
  await p.click('#seg-mine'); await h.search('aguacate'); ok(/Tostadas de aguacate/.test(await p.locator('#recipe-list').innerText()), 'el buscador la encuentra por ingrediente'); await h.search('');
  await p.locator('#filters [data-f=almuerzo]').click(); await p.waitForTimeout(80); ok(!/Tostadas de aguacate/.test(await p.locator('#recipe-list').innerText()), 'el filtro Almuerzo la oculta'); ok(await p.locator('#recipe-list [data-act=rc-new]').count() === 1, 'con filtro sigue el botón de crear');
  await p.locator('#filters [data-f=almuerzo]').click(); await p.locator('#filters [data-f=desayuno]').click(); await p.waitForTimeout(80); ok(/Tostadas de aguacate/.test(await p.locator('#recipe-list').innerText()), 'el filtro Desayuno la muestra');
  await p.locator('[data-act=rc-new]').first().click(); await p.waitForSelector('#rc-name'); eq(await p.locator('[data-rc-tipo=desayuno]').getAttribute('aria-pressed'), 'true', 'crear con un filtro puesto ya marca ese tipo');
});
T('Receta propia · las recetas que ya había creado el asistente se marcan como tuyas al actualizar (y las nuevas también)', async ({ p, h, env, ok, eq }) => {
  await h.start(); await h.S(() => { S.R.push({ id: 'mi-vieja', n: 'Receta vieja del chat', tipos: ['cena'], rac: 2, tanda: 0, i: [['Arroz', 100]] }); S.STEPS['mi-vieja'] = ['x']; S.mine.push('mi-vieja'); delete S.ownV; save(); });
  await p.reload(); await p.waitForTimeout(400); await h.closeAll(); ok(await h.S(() => byId('mi-vieja').own === 1), 'la antigua queda marcada'); ok(await h.S(() => S.R.filter(r => r.own).length === 1), 'las del catálogo y la biblioteca no se marcan');
  await h.S(() => { S.nivel = 4; save(); render(); }); await h.openAI(); await h.chatSay('guarda mi receta de arroz blanco', [{ tools: [{ tool: 'crear_receta', input: { nombre: 'Arroz blanco mío', tipos: ['almuerzo'], raciones: 2, apta_tanda: false, ingredientes: [{ producto: 'Arroz', cantidad: 150 }], pasos: ['Hervir'] } }] }, { text: 'Guardada.' }]);
  ok(await h.S(() => { const r = S.R.find(x => x.n === 'Arroz blanco mío'); return r && r.own === 1 && S.mine.includes(r.id); }), 'la que crea el asistente es tuya'); ok((env.aiCalls[0].system || '').includes('CREADA POR EL USUARIO'), 'el asistente sabe cuáles son tuyas para darles prioridad');
});
T('Avisos · un aviso lanzado con una hoja abierta se ve dentro de la hoja y vuelve a la página al cerrarla', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 1); await h.stockFor(r.id, 1); await h.view('despensa'); await p.click('#btn-inv-add'); await p.click('#ia-cat > summary'); await p.selectOption('#inv-mode', 'suelto'); await p.fill('#inv-qty', '0'); await p.click('[data-act=inv-add]');
  ok(await p.evaluate(() => !!document.querySelector('#dlg-form #toasts .toast')), 'el aviso está dentro de la hoja abierta'); ok(await p.locator('#toasts .toast').first().isVisible(), 'y se ve');
  await p.click('#dlg-form [data-close]'); await p.waitForTimeout(100); ok(await p.evaluate(() => document.getElementById('toasts').parentNode === document.body), 'al cerrar vuelve a la página');
});
T('Cabecera · plegada ocupa poco (sin desglose) y al tocarla muestra el desglose completo', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2);
  ok(!await p.locator('#summary .seg-legend').isVisible(), 'plegada no muestra la leyenda'); const h0 = await p.locator('.top').evaluate(e => e.getBoundingClientRect().height); ok(h0 < 250, 'la cabecera deja sitio al contenido (' + Math.round(h0) + 'px)');
  ok(/Quedan|Te pasas|Al límite/.test(await p.locator('#summary').innerText()), 'sigue diciendo cuánto queda'); ok(await p.locator('#summary .seg').isVisible(), 'y la barra');
  await p.click('#summary'); await p.waitForTimeout(100); ok(await p.locator('#summary .seg-legend').isVisible(), 'desplegada muestra la leyenda'); ok(/comidas de la semana/.test(await p.locator('#summary').innerText()), 'y las comidas cubiertas');
});
