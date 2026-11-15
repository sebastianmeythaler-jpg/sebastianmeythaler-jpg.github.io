const { T } = require('./lib');
const base = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); await h.stockFor(r.id, 2); return r; };
const openNew = async p => { await p.click('#seg-mine'); await p.locator('[data-act=rc-new]').first().click(); await p.waitForSelector('#rc-name'); };

T('Receta propia · los pasos son opcionales: se guarda sin pasos y la tarjeta no muestra un apartado vacío', async ({ p, h, ok, eq }) => {
  await h.start(); await openNew(p); await p.fill('#rc-name', 'Tostada con tomate'); await p.click('[data-rc-tipo=desayuno]'); await p.fill('#rc-rac', '1');
  await p.locator('#rc-ings .rc-ing').nth(0).locator('.rc-n').fill('Pan campesino'); await p.locator('#rc-ings .rc-ing').nth(0).locator('.rc-q').fill('1'); await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-n').fill('Tomate'); await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-q').fill('1');
  ok(/opcional/.test(await p.locator('label.field', { hasText: 'Cómo se hace' }).innerText()), 'el campo dice que es opcional'); await p.click('[data-rc=save]'); await p.waitForTimeout(150);
  ok(await h.S(() => { const r = S.R.find(x => x.own); return r && (S.STEPS[r.id] || []).length === 0; }), 'guardada sin pasos'); const card = p.locator('#recipe-list article.card').first();
  const how = card.locator('details.how'); eq(await how.locator('summary').innerText(), 'Ingredientes', 'el desplegable se llama solo «Ingredientes»'); await how.locator('summary').click(); await p.waitForTimeout(80);
  const tx = await how.innerText(); ok(!/^Pasos/m.test(tx) && /Sin pasos/.test(tx), 'no hay lista de pasos vacía, solo la invitación a añadirlos');
  await card.locator('[data-act=rc-edit]').click(); await p.waitForSelector('#rc-name'); await p.fill('#rc-steps', 'Tuesta el pan\nAñade el tomate'); await p.click('[data-rc=save]'); await p.waitForTimeout(150);
  eq(await p.locator('#recipe-list article.card').first().locator('details.how summary').innerText(), 'Ingredientes y pasos', 'al añadir pasos vuelve el nombre completo');
  await h.view('semana'); const id = await h.S(() => S.R.find(r => r.own).id); await h.addPlan(id, 1); await p.waitForTimeout(100); ok(/Ingredientes/.test(await p.locator('#plan-list').innerText()), 'también se ve bien en la Semana');
});
T('Recetas · «Varios días» es un filtro más de la fila (ya no hay casilla aparte) y se combina con el tipo', async ({ p, h, ok, eq }) => {
  await h.start(); ok(await p.locator('#only-tanda').count() === 0, 'la casilla antigua ya no está'); ok(await p.locator('#filters [data-act=tanda]').count() === 1, 'hay un chip «Varios días»');
  await p.click('#seg-explore'); await p.locator('#filters [data-f=almuerzo]').click(); await p.locator('#filters [data-act=tanda]').click(); await p.waitForTimeout(150); eq(await p.locator('#filters [data-act=tanda]').getAttribute('aria-pressed'), 'true', 'chip activo');
  await p.evaluate(() => document.querySelectorAll('details.rgroup').forEach(d => d.open = true)); await p.waitForTimeout(60); const n = await p.locator('#recipe-list article.card').count(); ok(n > 0, 'hay platos'); eq(await p.locator('#recipe-list article.card').evaluateAll(cs => cs.filter(c => !/Para varios días/.test(c.innerText) || !/Almuerzo/.test(c.innerText)).length), 0, 'todos son almuerzos para varios días');
  await h.S(() => { S.onlyTanda = false; render(); }); eq(await p.locator('#filters [data-act=tanda]').getAttribute('aria-pressed'), 'false', 'apagado se ve apagado');
});
T('Despensa · tocar un producto abre su precio y tamaño; guardar cambia el coste de la receta y valida los datos', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await base(h); await h.view('despensa'); const n = await h.S(id => byId(id).i.map(x => x[0]).find(k => !S.P[k].c && S.stock[k] > 0), r.id); const before = await h.S(id => perRacion(byId(id), false), r.id);
  await p.locator(`#inv-list [data-act=p-edit][data-n="${n}"]`).click(); await p.waitForSelector('#pe-p'); ok(/Ahora:/.test(await p.locator('#form-in').innerText()), 'muestra lo de ahora'); const p0 = await h.S(k => ({ p: S.P[k].p, q: S.P[k].q, f: S.P[k].f }), n);
  await p.fill('#pe-p', ''); await p.click('[data-pe=save]'); ok(/Escribe el precio/.test(await p.locator('#form-err').innerText()), 'precio vacío avisa'); await p.fill('#pe-p', '-1'); await p.click('[data-pe=save]'); ok(/Escribe el precio/.test(await p.locator('#form-err').innerText()), 'precio negativo avisa');
  await p.fill('#pe-p', String(p0.p * 2)); await p.fill('#pe-q', '0'); await p.click('[data-pe=save]'); ok(/mayor que 0/.test(await p.locator('#form-err').innerText()), 'tamaño 0 avisa'); eq(await h.S(k => S.P[k].p, n), p0.p, 'mientras haya errores no cambia nada');
  await p.fill('#pe-q', String(p0.q)); await p.click('[data-pe=save]'); await p.waitForTimeout(150); eq(await h.S(k => S.P[k].p, n), p0.p * 2, 'precio guardado'); eq(await h.S(k => S.P[k].f, n), p0.f, 'si el tamaño no cambia, el formato se queda'); ok(await h.S(id => perRacion(byId(id), false), r.id) > before, 'la receta cuesta más'); ok(!await p.locator('#dlg-form').evaluate(d => d.open), 'la hoja se cierra');
  await p.locator(`#inv-list [data-act=p-edit][data-n="${n}"]`).click(); await p.fill('#pe-q', String(p0.q * 2)); await p.click('[data-pe=save]'); await p.waitForTimeout(150); eq(await h.S(k => S.P[k].q, n), p0.q * 2, 'tamaño nuevo'); ok(await h.S(k => S.P[k].f !== undefined && S.P[k].f !== '', n), 'formato actualizado');
});
T('Despensa · el precio de una especia (bote) se edita sobre el bote y no toca la despensa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.stock['Comino molido'] = 2; S.since['Comino molido'] = Date.now(); save(); render(); }); await h.view('despensa'); const s0 = await h.S(() => S.stock['Comino molido']);
  await p.locator('#inv-list [data-act=p-edit][data-n="Comino molido"]').click(); await p.waitForSelector('#pe-p'); ok(/bote/.test(await p.locator('#form-in').innerText()), 'habla de botes'); await p.fill('#pe-p', '2.5'); await p.fill('#pe-q', '80'); await p.click('[data-pe=save]'); await p.waitForTimeout(150);
  const s = await h.S(() => ({ p: S.P['Comino molido'].p, g: S.P['Comino molido'].g, q: S.P['Comino molido'].q, st: S.stock['Comino molido'] })); eq(s.p, 2.5, 'precio del bote'); eq(s.g, 80, 'gramos por bote'); eq(s.q, 1, 'sigue contándose por botes'); eq(s.st, s0, 'la despensa no cambia');
});
T('Receta propia · el ingrediente sin precio se arregla desde la propia tarjeta de la receta', async ({ p, h, ok, eq }) => {
  await h.start(); await openNew(p); await p.fill('#rc-name', 'Bocadillo raro'); await p.click('[data-rc-tipo=almuerzo]'); await p.fill('#rc-rac', '1');
  await p.locator('#rc-ings .rc-ing').nth(0).locator('.rc-n').fill('Pan campesino'); await p.locator('#rc-ings .rc-ing').nth(0).locator('.rc-q').fill('1'); await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-n').fill('jengibre confitado'); await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-n').dispatchEvent('change'); await p.locator('#rc-ings .rc-ing').nth(1).locator('.rc-q').fill('100'); await p.click('[data-rc=save]'); await p.waitForTimeout(150);
  const link = p.locator('#recipe-list [data-act=p-edit][data-n="Jengibre confitado"]'); ok(await link.count() === 1, 'la tarjeta ofrece poner el precio'); await link.click(); await p.waitForSelector('#pe-p'); await p.fill('#pe-p', '3'); await p.fill('#pe-q', '200'); await p.click('[data-pe=save]'); await p.waitForTimeout(150);
  eq(await h.S(() => S.P['Jengibre confitado'].p), 3, 'precio puesto'); ok(!/Sin precio todavía/.test(await p.locator('#recipe-list').innerText()), 'ya no sale como pendiente'); ok(await h.S(() => perRacion(S.R.find(r => r.own), false)) > 1.5, 'el coste por ración incluye el jengibre: 100 g de 200 g a 3 € = 1,50 €');
});
T('Cabecera · al bajar se encoge (sigue viéndose lo gastado y lo que queda) y al subir vuelve entera', async ({ p, h, ok }) => {
  await h.start(); await h.S(() => { for (const r of S.R.filter(r => r.i.length).slice(0, 8)) { S.mine.push(r.id); } S.nivel = 4; save(); render(); }); await p.click('#seg-mine'); await p.waitForTimeout(100);
  const full = await p.locator('.top').evaluate(e => e.getBoundingClientRect().height); await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(250);
  ok(await p.locator('.top.mini').count() === 1, 'se pone en modo compacto'); const mini = await p.locator('.top').evaluate(e => e.getBoundingClientRect().height); ok(mini < full * 0.7, `ocupa mucho menos (${Math.round(mini)}px frente a ${Math.round(full)}px)`);
  const tx = await p.locator('#summary').innerText(); ok(/€/.test(tx) && /Quedan|Te pasas|Al límite/.test(tx), 'sigue mostrando gasto y lo que queda: ' + tx.replace(/\n/g, ' ')); ok(await p.locator('#summary').isVisible(), 'y se puede tocar');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(250); ok(await p.locator('.top.mini').count() === 0, 'arriba vuelve entera'); ok(await p.locator('#hoy').isVisible(), 'con la fecha');
});
T('Cabecera · si la abres con la página algo bajada, se ve entera y sus botones se pueden pulsar', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { for (const r of S.R.filter(r => r.i.length).slice(0, 8)) S.mine.push(r.id); S.nivel = 4; save(); render(); }); await p.click('#seg-mine'); await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(250); ok(await p.locator('.top.mini').count() === 1, 'está compacta');
  await p.click('#summary'); await p.waitForTimeout(150); ok(await p.locator('#summary .seg-legend').isVisible(), 'al abrirla muestra el desglose completo'); ok(await p.locator('#details').isVisible(), 'y el panel de detalles');
  const b = p.locator('#details button').first(); ok(await b.count() === 1 && await b.isVisible(), 'sus botones se ven'); await p.click('#summary'); await p.waitForTimeout(150); ok(!await p.locator('#summary .seg-legend').isVisible(), 'al cerrarla vuelve a lo compacto');
});
T('Accesibilidad · el nombre de un producto de la despensa se puede tocar con comodidad', async ({ p, h, ok }) => {
  await h.start(); await base(h); await h.view('despensa'); const hs = await p.locator('#inv-list .inv-r .nm').evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().height))); ok(hs.length > 0 && Math.min(...hs) >= 36, 'alto mínimo ' + Math.min(...hs) + ' px');
});
