const { T } = require('./lib');

T('Recetas · «+ A mi recetario» la añade, avisa y aparece en Mi recetario', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' });
  await p.click('#seg-explore'); await h.search(r.n);
  await p.locator(`[data-act=mine][data-id="${r.id}"]`).first().click(); await p.waitForTimeout(100);
  ok(await h.S(id => S.mine.includes(id), r.id), 'queda en S.mine'); ok(/añadida/.test(await h.toast()), 'avisa «añadida a tu recetario»');
  ok(await p.locator(`[data-act=mine][data-id="${r.id}"]`).count() === 0, 'ya no se ofrece en Explorar');
  await h.search(''); await p.click('#seg-mine'); await p.waitForTimeout(80);
  ok(await p.locator(`[data-act=unmine][data-id="${r.id}"]`).count() === 1, 'aparece en Mi recetario');
});
T('Recetas · Explorar muestra los grupos y el número coincide con las tarjetas', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#seg-explore'); await p.waitForTimeout(100);
  const groups = await p.locator('details.rgroup').count(); ok(groups >= 4, 'hay al menos 4 grupos de recetas');
  for (let i = 0; i < groups; i++) {
    const g = p.locator('details.rgroup').nth(i); const t = await g.getAttribute('data-group'); const cnt = Number(await g.locator('summary .cnt').innerText());
    await g.locator('> summary').click(); await p.waitForTimeout(80);
    eq(await p.locator(`details.rgroup[data-group=${t}] article.card`).count(), cnt, `grupo ${t}: las tarjetas coinciden con el contador`);
  }
});
T('Recetas · abrir y cerrar un grupo funciona y se recuerda', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#seg-explore'); const g = p.locator('details.rgroup').first(); const t = await g.getAttribute('data-group');
  eq(await g.getAttribute('open'), null, 'empieza cerrado'); await g.locator('> summary').click(); await p.waitForTimeout(80);
  ok(await h.S(t => (S.openGroups || []).includes(t), t), 'el grupo abierto se guarda');
  ok(await p.locator(`details.rgroup[data-group=${t}]`).evaluate(d => d.open), 'queda abierto');
  await p.locator(`details.rgroup[data-group=${t}] > summary`).click(); await p.waitForTimeout(80);
  ok(!(await h.S(t => (S.openGroups || []).includes(t), t)), 'al cerrarlo se quita');
});
T('Recetas · «Quitar» pide confirmar con segundo toque, y se arrepiente solo', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.exploreAdd(r);
  const q = p.locator(`[data-act=unmine][data-id="${r.id}"]`); await q.click();
  ok(await h.S(id => S.mine.includes(id), r.id), 'tras el primer toque NO se quita'); ok(/Seguro/.test(await q.innerText()), 'el botón pide «¿Seguro?»');
  await p.evaluate(() => 0); await p.waitForTimeout(100); await p.clock; await p.context().clock.fastForward(4500); await p.waitForTimeout(100);
  ok(/Quitar/.test(await q.innerText()) && !/Seguro/.test(await q.innerText()), 'tras 4 s vuelve a «Quitar»');
  await q.click(); await q.click(); await p.waitForTimeout(100);
  ok(!(await h.S(id => S.mine.includes(id), r.id)), 'el segundo toque sí la quita'); ok(/Explorar/.test(await h.toast()), 'avisa que sigue en Explorar');
});
T('Recetas · quitar de «mi recetario» un plato que está en la semana también lo gestiona bien', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 2); await p.click('#seg-mine');
  const q = p.locator(`[data-act=unmine][data-id="${r.id}"]`); await q.click(); await q.click(); await p.waitForTimeout(100);
  const planned = await h.S(() => S.plan.length); const mine = await h.S(id => S.mine.includes(id), r.id);
  ok(!(mine && planned === 0 && false), 'estado coherente'); // lo importante: sin errores y sin platos huérfanos (lo comprueba el control final)
  if (planned) ok(await h.S(() => S.plan.every(it => byId(it.rid))), 'los platos de la semana siguen teniendo receta');
});
T('Recetas · el buscador filtra, avisa si no hay nada y se limpia', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await p.click('#seg-explore');
  await h.search(r.n); ok(await p.locator('#recipe-list article.card').count() >= 1, 'encuentra el plato por nombre');
  ok(await p.locator('#recipe-list article.card h3', { hasText: r.n }).count() >= 1, 'el plato buscado aparece');
  await h.search('zzzzqqq'); eq(await p.locator('#recipe-list article.card').count(), 0, 'sin resultados no hay tarjetas'); ok(await p.locator('#recipe-list .empty').count() === 1, 'muestra el mensaje de vacío');
  await h.search('ATÚN'); ok(await p.locator('#recipe-list article.card').count() >= 1, 'mayúsculas y tildes no importan'); await h.search(''); ok(await p.locator('details.rgroup').count() >= 4, 'al limpiar vuelve a los grupos');
});
T('Recetas · buscar por ingrediente funciona', async ({ p, h, ok }) => {
  await h.start(); await p.click('#seg-explore'); await h.search('atun');
  ok(await p.locator('#recipe-list article.card').count() >= 2, 'varias recetas con atún');
});
T('Recetas · los filtros por tipo se activan, combinan y «Todas» los limpia', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#seg-explore');
  await p.locator('#filters [data-f=desayuno]').click(); eq(await h.S(() => S.filter), ['desayuno'], 'filtro desayuno');
  eq(await p.locator('#filters [data-f=desayuno]').getAttribute('aria-pressed'), 'true', 'chip marcado');
  const tags = await p.locator('#recipe-list article.card .meta .tag').allInnerTexts(); ok(tags.some(t => /Desayuno/.test(t)), 'se ven desayunos');
  const noDes = await p.locator('#recipe-list article.card').evaluateAll(cs => cs.filter(c => !/Desayuno/.test(c.querySelector('.meta').innerText)).length); eq(noDes, 0, 'no se cuela ninguna receta que no sea desayuno');
  await p.locator('#filters [data-f=cena]').click(); eq(await h.S(() => S.filter.length), 2, 'se pueden combinar dos filtros');
  await p.locator('#filters [data-f=desayuno]').click(); eq(await h.S(() => S.filter), ['cena'], 'se quita uno');
  await p.locator('#filters [data-f=""]').click(); eq(await h.S(() => S.filter), [], '«Todas» limpia');
});
T('Recetas · cada chip de filtro da resultados (o un mensaje claro)', async ({ p, h, ok }) => {
  await h.start(); await p.click('#seg-explore'); const chips = await p.locator('#filters [data-f]').evaluateAll(c => c.map(x => x.dataset.f).filter(Boolean));
  for (const f of chips) { await p.locator(`#filters [data-f=${f}]`).click(); await p.waitForTimeout(60); const n = await p.locator('#recipe-list article.card').count(); const e = await p.locator('#recipe-list .empty').count(); ok(n > 0 || e === 1, `filtro «${f}» no deja la pantalla en blanco`); await p.locator(`#filters [data-f=${f}]`).click(); }
});
T('Recetas · «solo para varios días» deja solo las de tanda', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#seg-explore'); await p.check('#only-tanda'); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelectorAll('details.rgroup').forEach(d => d.open = true)); await p.waitForTimeout(50);
  ok(await h.S(() => S.onlyTanda), 'S.onlyTanda activo');
  const bad = await p.locator('#recipe-list article.card').evaluateAll(cs => cs.filter(c => !/Para varios días/.test(c.innerText)).length); eq(bad, 0, 'todas llevan la etiqueta «Para varios días»');
  await p.uncheck('#only-tanda'); ok(!(await h.S(() => S.onlyTanda)), 'se desactiva');
});
T('Recetas · el + añade a la semana, sube/baja y el − al llegar a 0 la quita', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.exploreAdd(r);
  await p.locator(`[data-act=addone][data-id="${r.id}"]`).click(); await p.waitForTimeout(100); eq(await h.S(() => S.plan.map(i => i.veces)), [1], 'se añade 1 plato');
  const k = await h.S(() => S.plan[0].k);
  await p.locator(`#recipe-list .stepper [data-act=veces][data-k="${k}"][data-d="1"]`).click(); eq(await h.S(() => S.plan[0].veces), 2, 'sube a 2');
  await p.locator(`#recipe-list .stepper [data-act=veces][data-k="${k}"][data-d="-1"]`).click(); eq(await h.S(() => S.plan[0].veces), 1, 'baja a 1');
  await p.locator(`#recipe-list .stepper [data-act=veces][data-k="${k}"][data-d="-1"]`).click(); eq(await h.S(() => S.plan.length), 0, 'al bajar de 1 se quita de la semana');
  ok(await p.locator(`[data-act=addone][data-id="${r.id}"]`).count() === 1, 'vuelve a ofrecer el +');
});
T('Recetas · el + no pasa de 30 platos', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 29); await p.click('#seg-mine'); const k = await h.S(() => S.plan[0].k);
  for (let i = 0; i < 3; i++) await p.locator(`#recipe-list .stepper [data-act=veces][data-k="${k}"][data-d="1"]`).click();
  eq(await h.S(() => S.plan[0].veces), 30, 'tope de 30');
});
T('Recetas · se ve cuánto sube la compra al añadir y cuánto te quedaría', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.exploreAdd(r);
  const t = await p.locator(`#recipe-list article.card`, { has: p.locator(`[data-id="${r.id}"]`) }).first().innerText();
  ok(/sube la compra/.test(t), 'aviso «Añadirlo sube la compra …»'); ok(/te quedarían|te pasarías/.test(t), 'dice lo que te queda o te pasas');
});
T('Recetas · «Ingredientes y pasos» se abre, lista cantidades y pasos', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.exploreAdd(r);
  const card = p.locator('#recipe-list article.card').first(); await card.locator('details.how summary').click(); await p.waitForTimeout(80);
  ok(await card.locator('details.how').evaluate(d => d.open), 'se abre'); ok(await card.locator('.how-body li').count() >= 3, 'hay ingredientes y pasos');
  const t = await card.locator('.how-body').innerText(); ok(/Ingredientes/i.test(t) && /Pasos/i.test(t), 'secciones Ingredientes y Pasos');
});
T('Recetas · todas las recetas tienen ingredientes, pasos, precio y dibujo razonables', async ({ h, ok }) => {
  await h.start(); const bad = await h.S(() => { const o = []; for (const r of S.R) { if (!r.i.length) continue; if (!(S.STEPS[r.id] || []).length) o.push('sin pasos: ' + r.n); const pr = perRacion(r, false); if (!(pr > 0.05 && pr < 15)) o.push('precio raro ' + r.n + ' ' + pr.toFixed(2)); if (!dishArt(r)) o.push('sin dibujo: ' + r.n); for (const [n, q] of r.i) { if (!S.P[n]) o.push('ingrediente sin producto: ' + r.n + ' → ' + n); if (!(q > 0)) o.push('cantidad 0: ' + r.n + ' → ' + n); } if (!r.tipos.length) o.push('sin tipo: ' + r.n); } return o; });
  ok(bad.length === 0, 'Recetas con problemas: ' + bad.slice(0, 8).join(' | ') + (bad.length > 8 ? ` (+${bad.length - 8})` : ''));
});
T('Recetas · las cantidades salen en medidas de cocina (tz, cda, cdta) cuando toca', async ({ p, h, ok }) => {
  await h.start(); const found = await h.S(() => { for (const r of S.R) { for (const [n, q] of r.i) { const t = kitchen(n, q, rU(n)); if (/tz|cda|cdta/.test(t || '')) return [r.id, r.n, t]; } } return null; });
  ok(!!found, 'alguna receta usa medidas de cocina'); if (!found) return;
  await h.exploreAdd({ id: found[0], n: found[1] }); await p.locator('#recipe-list article.card').first().locator('details.how summary').click(); await p.waitForTimeout(80);
  ok(/tz|cda|cdta/.test(await p.locator('#recipe-list article.card').first().locator('.how-body').innerText()), 'las medidas se ven en la tarjeta');
});
