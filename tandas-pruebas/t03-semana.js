const { T } = require('./lib');
const plate = async (h, o = {}) => { const r = await h.pick({ tipo: o.tipo || 'almuerzo', tanda: o.tanda, cheap: true, n: o.n || 0 }); const k = await h.addPlan(r.id, o.veces || 2); if (o.stock !== false) await h.stockFor(r.id, o.veces || 2); return { r, k }; };

T('Semana · vacía muestra el mensaje y los cuadros a 0', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('.tab[data-view=semana]');
  ok(/vacía/.test(await p.locator('#plan-list').innerText()), 'mensaje «Tu semana está vacía»'); ok(/0,00/.test(await p.locator('#s-compra').innerText()), 'Te falta comprar = 0');
});
T('Semana · el plato aparece con nombre, dibujo, precio y pasos', async ({ p, h, ok }) => {
  await h.start(); const { r } = await plate(h, { stock: false }); await h.view('semana');
  const c = p.locator('#plan-list article.card').first(); ok(await c.locator('h3', { hasText: r.n }).count() === 1, 'nombre del plato'); ok(await c.locator('.dish').count() >= 1, 'dibujo del plato');
  ok(/€/.test(await c.locator('.price').first().innerText()), 'precio'); ok(await c.locator('details.how').count() === 1, 'ingredientes y pasos');
});
T('Semana · los botones + y − cambian las veces y el precio', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { veces: 2, stock: false }); await h.view('semana');
  const price0 = await p.locator('#plan-list .card .price').first().innerText();
  await p.locator(`#plan-list [data-act=veces][data-k="${k}"][data-d="1"]`).click(); eq(await h.S(() => S.plan[0].veces), 3, '2→3'); ok(await p.locator('#plan-list .card .price').first().innerText() !== price0, 'el precio cambia');
  await p.locator(`#plan-list [data-act=veces][data-k="${k}"][data-d="-1"]`).click(); await p.locator(`#plan-list [data-act=veces][data-k="${k}"][data-d="-1"]`).click(); eq(await h.S(() => S.plan[0].veces), 1, '3→1');
  await p.locator(`#plan-list [data-act=veces][data-k="${k}"][data-d="-1"]`).click(); eq(await h.S(() => S.plan.length), 0, 'a 0 se quita');
});
T('Semana · «Quitar» elimina el plato sin cocinar al primer toque', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { stock: false }); await h.view('semana'); await p.locator(`#plan-list [data-act=remove][data-k="${k}"]`).click(); eq(await h.S(() => S.plan.length), 0, 'plato quitado');
});
T('Semana · «Quitar» un plato cocinado con raciones pide confirmar', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { tanda: true, veces: 3 }); await h.view('semana');
  await p.locator(`#plan-list [data-act=cook][data-k="${k}"]`).click(); await p.waitForTimeout(100);
  const q = p.locator(`#plan-list [data-act=remove][data-k="${k}"]`); await q.click(); eq(await h.S(() => S.plan.length), 1, 'primer toque no lo quita'); ok(/Quitar\?|Se pierden/i.test(await q.innerText()), 'pide confirmar');
  await q.click(); eq(await h.S(() => S.plan.length), 0, 'segundo toque lo quita');
});
T('Semana · el plato opcional (checkbox) cambia ingredientes y precio', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.S(() => { const r = S.R.find(r => r.i.some(x => x[2])); return r ? { id: r.id, n: r.n } : null; }); ok(!!r, 'existe alguna receta con ingrediente opcional'); if (!r) return;
  await h.addPlan(r.id, 1); await h.view('semana'); const before = await h.S(() => shop(S.plan).total);
  await p.locator('#plan-list [data-act=opc]').first().check(); await p.waitForTimeout(80); ok(await h.S(() => S.plan[0].opc), 'S.plan[0].opc'); ok(await h.S(() => shop(S.plan).total) >= before, 'la compra no baja al añadir el opcional');
  await p.locator('#plan-list [data-act=opc]').first().uncheck(); ok(!(await h.S(() => S.plan[0].opc)), 'se desmarca');
});
T('Semana · sin ingredientes no deja cocinar ni comer y lo explica', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { stock: false }); await h.view('semana');
  ok(/Aún no lo tienes/.test(await p.locator('#plan-list').innerText()), 'explica que falta algo'); eq(await p.locator('[data-act=cook]').count(), 0, 'no ofrece «Ya lo cociné»'); eq(await p.locator('[data-act=eat]').count(), 0, 'no ofrece «Comí»');
});
T('Semana · «Ya lo cociné» descuenta la despensa y deja raciones', async ({ p, h, ok, eq }) => {
  await h.start(); const { r, k } = await plate(h, { tanda: true, veces: 2 }); await h.view('semana');
  const before = await h.S(() => JSON.stringify(S.stock)); await p.locator(`#plan-list [data-act=cook][data-k="${k}"]`).click(); await p.waitForTimeout(100);
  ok(await h.S(() => S.plan[0].cocinado), 'marcado cocinado'); ok(await h.S(() => JSON.stringify(S.stock)) !== before, 'la despensa cambió'); ok(/Cocinado/.test(await h.toast()), 'avisa «Cocinado»');
  ok(await h.S(() => leftOf(S.plan[0])) > 0, 'quedan raciones'); ok(/Cocinado · quedan/.test(await p.locator('#plan-list').innerText()), 'etiqueta «quedan N»'); eq(await p.locator('[data-act=cook]').count(), 0, 'ya no ofrece cocinar');
});
T('Semana · «Comí» anota la comida, descuenta, registra el coste y saluda', async ({ p, h, ok, eq }) => {
  await h.start(); const { r, k } = await plate(h, { veces: 2 }); await h.view('semana'); const stock0 = await h.S(() => Object.values(S.stock).reduce((a, b) => a + b, 0));
  await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(150);
  eq(await h.S(() => S.log.length), 1, 'una entrada en el registro'); ok(await h.S(() => S.log[0].c) > 0, 'con coste'); eq(await h.S(() => S.log[0].n), r.n, 'con el nombre del plato');
  ok(await h.S(() => Object.values(S.stock).reduce((a, b) => a + b, 0)) < stock0, 'baja la despensa'); eq(await h.S(() => S.plan[0].veces), 1, 'queda 1 plato');
  ok(await p.locator('#dlg-pop').evaluate(d => d.open), 'sale el mensaje «que aproveche»'); ok(/aproveche/i.test(await p.locator('#pop-in').innerText()), 'texto del mensaje');
  ok(/disfrutado/.test(await p.locator('#pop-in').innerText()), '«espero hayas disfrutado tu…»');
});
T('Semana · «Que aproveche»: «No volver a mostrar» lo apaga y Ajustes lo reactiva', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { veces: 3 }); await h.view('semana');
  await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await p.check('#pop-off'); await p.locator('#pop-in [data-close]').click(); await p.waitForTimeout(100);
  eq(await h.S(() => S.enjoyPopup), false, 'se apaga'); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'se cierra');
  await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'la siguiente vez no sale'); ok(/Anotado/.test(await h.toast()), 'solo un aviso breve');
  await p.click('#btn-settings'); ok(!(await p.locator('#st-enjoy').isChecked()), 'Ajustes lo muestra apagado'); await p.check('#st-enjoy'); await p.click('#st-save'); eq(await h.S(() => S.enjoyPopup), true, 'Ajustes lo reactiva');
});
T('Semana · el contador de «Comí N» sube, baja y respeta el máximo', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { tanda: true, veces: 5 }); await h.view('semana'); await p.locator(`#plan-list [data-act=cook][data-k="${k}"]`).click(); await p.waitForTimeout(100);
  const left = await h.S(() => leftOf(S.plan[0])); ok(left >= 3, 'la tanda deja varias raciones');
  const plus = () => p.locator(`#plan-list [data-act=eatn][data-k="${k}"][data-d="1"]`), minus = () => p.locator(`#plan-list [data-act=eatn][data-k="${k}"][data-d="-1"]`);
  ok(await minus().isDisabled(), '− desactivado en 1'); await plus().click(); await plus().click(); ok(/Comí 3/.test(await p.locator('#plan-list').innerText()), 'el botón dice «Comí 3»'); await minus().click(); ok(/Comí 2/.test(await p.locator('#plan-list').innerText()), 'baja a «Comí 2»');
  for (let i = 0; i < left + 2; i++) if (await plus().isEnabled()) await plus().click(); ok(await plus().isDisabled(), '+ se desactiva en el máximo'); await minus().click();
  await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(150); await h.closeAll();
  eq(await h.S(() => S.log.length), left - 1, 'se anotan tantas raciones como indicó el contador'); eq(await h.S(() => leftOf(S.plan[0])), 1, 'queda 1 ración');
});
T('Semana · comer la última ración quita el plato de la semana', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { veces: 1 }); await h.view('semana'); await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await h.closeAll();
  eq(await h.S(() => S.plan.length), 0, 'sin platos'); ok(/vacía/.test(await p.locator('#plan-list').innerText()), 'la semana queda vacía');
});
T('Semana · «Lo que comes» se abre, lista lo comido y coincide con el total', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { veces: 3 }); await h.view('semana'); await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await h.closeAll();
  await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await h.closeAll();
  ok(await p.locator('#btn-eaten').isVisible(), 'el cuadro aparece'); eq(await p.locator('#eaten-panel').isVisible(), false, 'empieza cerrado');
  await p.click('#btn-eaten'); ok(await p.locator('#eaten-panel').isVisible(), 'se abre'); eq(await p.locator('#btn-eaten').getAttribute('aria-expanded'), 'true', 'aria-expanded');
  const sum = await h.S(() => S.log.reduce((a, x) => a + x.c, 0)); ok(h.approx(sum, Number((await p.locator('#s-consumo').innerText()).replace(/[^\d,]/g, '').replace(',', '.'))), 'el total del cuadro = suma del registro');
  ok(/×2/.test(await p.locator('#eaten-panel').innerText()), 'agrupa el mismo plato (×2)'); await p.click('#btn-eaten'); ok(!(await p.locator('#eaten-panel').isVisible()), 'se cierra');
});
T('Semana · «Lo que comes» vacío explica qué hacer', async ({ p, h, ok }) => {
  await h.start(); const { k } = await plate(h, { veces: 1 }); await h.view('semana'); await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await h.closeAll();
  await h.S(() => { S.log = []; S.eaten = {}; save(); render(); }); await p.click('#btn-eaten'); ok(/Aún no has anotado/.test(await p.locator('#eaten-panel').innerText()), 'mensaje de vacío');
});
T('Semana · «Te falta comprar» abre la confirmación y lleva a la Lista (o se queda)', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { stock: false }); await h.view('semana');
  await p.click('#btn-compra'); ok(await p.locator('#dlg-pop').evaluate(d => d.open), 'sale la confirmación'); ok(/Lista de compras/.test(await p.locator('#pop-in').innerText()), 'pregunta por la Lista');
  await p.locator('#pop-in [data-close]').click(); eq(await h.S(() => S.view), 'semana', '«No» se queda'); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'se cierra');
  await p.click('#btn-compra'); await p.locator('#pop-in [data-view=lista]').click(); await p.waitForTimeout(100); eq(await h.S(() => S.view), 'lista', '«Sí» va a la Lista'); ok(!(await p.locator('#dlg-pop').evaluate(d => d.open)), 'se cierra'); ok(await p.locator('#v-lista').isVisible(), 'la Lista se ve');
});
T('Semana · «Te falta comprar» muestra «Nada ✓» si ya está todo y «Te quedará» cuenta la despensa', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 1 }); await h.view('semana');
  eq(await p.locator('#s-compra').innerText(), 'Nada ✓', 'todo cubierto'); ok(await h.S(() => shop(S.plan).sobra) > 0, '«sobra» > 0'); ok(!/^0,00/.test(await p.locator('#s-sobra').innerText()), '«Te quedará en casa» no sale a 0 con la despensa llena');
});
T('Semana · los cuadros cuadran con la Lista', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 2, stock: false }); await plate(h, { tipo: 'cena', veces: 2, stock: false, n: 1 }); await h.view('semana');
  const s = await h.S(() => shop(S.plan)); const txt = await p.locator('#s-compra').innerText(); ok(txt.includes(s.total.toFixed(2).replace('.', ',')), 'Te falta comprar = total de la Lista');
  await h.view('lista'); ok((await p.locator('#shop-list .foot .num').innerText()).includes(s.total.toFixed(2).replace('.', ',')), 'el total de la Lista coincide');
});
T('Semana · apuntar un snack descuenta, cuesta y suma a «Lo que comes»', async ({ p, h, ok, eq }) => {
  await h.start(); const { k } = await plate(h, { veces: 2 }); await h.view('semana'); await p.locator(`#plan-list [data-act=eat][data-k="${k}"]`).click(); await p.waitForTimeout(100); await h.closeAll();
  await h.S(() => { S.stock['Plátano'] = 4; S.stock[Object.keys(S.P).find(n => /Galletas/i.test(n))] = 400; save(); render(); }); await h.view('semana');
  ok(await p.locator('#snack-box').isVisible(), 'caja de snacks visible'); const n0 = await h.S(() => S.log.length); const prod = await p.locator('#sn-prod').inputValue(); const st0 = await h.S(n => S.stock[n], prod);
  await p.fill('#sn-qty', '1'); await p.locator('[data-act=snack-add]').click(); await p.waitForTimeout(100);
  eq(await h.S(() => S.log.length), n0 + 1, 'se registra'); ok(await h.S(n => (S.stock[n] || 0), prod) < st0, 'baja la despensa'); ok(/Anotado/.test(await h.toast()), 'avisa');
  await p.fill('#sn-qty', '0'); await p.locator('[data-act=snack-add]').click(); ok(/mayor que 0/.test(await h.toast()), 'rechaza cantidad 0'); eq(await h.S(() => S.log.length), n0 + 1, 'sin cambios con 0');
});
