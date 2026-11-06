const { T } = require('./lib');

T('Bienvenida · no deja empezar sin nombre', async ({ p, h, ok }) => {
  await h.load();
  ok(await p.locator('#dlg-welcome').evaluate(d => d.open), 'la bienvenida debe abrirse la primera vez');
  await p.click('#wl-go');
  ok(await p.locator('#dlg-welcome').evaluate(d => d.open), 'no debe cerrarse sin nombre');
  ok(/nombre/i.test(await h.toast()), 'debe avisar «Escribe tu nombre»');
});
T('Bienvenida · Escape no la cierra', async ({ p, h, ok }) => {
  await h.load(); await p.keyboard.press('Escape'); await p.waitForTimeout(100); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok(await p.locator('#dlg-welcome').evaluate(d => d.open), 'Escape (aunque se pulse dos veces) no debe dejar la app sin nombre');
});
T('Bienvenida · guarda nombre, presupuesto al mes y letra grande', async ({ p, h, ok, eq }) => {
  await h.load(); await h.welcome('Danna', { budget: 100, per: 'm', big: true });
  eq(await h.S(() => S.name), 'Danna', 'nombre guardado');
  eq(await h.S(() => S.budget), 23, '100 €/mes ≈ 23 €/semana');
  ok(await h.S(() => document.documentElement.classList.contains('big')), 'letra grande aplicada');
  ok(!(await p.locator('#dlg-welcome').evaluate(d => d.open)), 'la bienvenida se cierra');
  ok(/Danna/.test(await h.toast()), 'saluda por el nombre');
});
T('Bienvenida · presupuesto por semana se guarda tal cual', async ({ h, eq }) => {
  await h.load(); await h.welcome('Ana', { budget: 30, per: 's' });
  eq(await h.S(() => S.budget), 30, 'presupuesto semanal');
});
T('Bienvenida · sin presupuesto deja el de por defecto', async ({ h, ok }) => {
  await h.load(); await h.welcome('Ana'); ok(await h.S(() => S.budget) > 0, 'presupuesto por defecto > 0');
});
T('Bienvenida · recordatorios activados por defecto', async ({ p, h, ok }) => {
  await h.load(); await p.fill('#wl-name', 'Ana'); ok(await p.locator('#wl-remind').isChecked(), 'casilla de recordatorios marcada por defecto');
  await p.click('#wl-go'); await p.waitForTimeout(150); ok(await h.S(() => S.remind.on), 'S.remind.on activo');
});
T('Bienvenida · elegir Ecuador pone dólares', async ({ p, h, ok, eq }) => {
  await h.load(); await h.welcome('Ana', { region: 'EC' });
  eq(await h.S(() => S.region), 'EC', 'región Ecuador');
  await h.view('lista'); await h.view('recetas');
  ok(/\$/.test(await p.locator('body').innerText()), 'se ven precios en $');
});
T('Bienvenida · «Tengo una copia» abre el selector de archivos', async ({ p, h, ok }) => {
  await h.load(); await p.fill('#wl-name', 'Ana');
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }), p.click('#wl-import')]);
  ok(!!fc, 'se abre el selector de archivos');
});
T('Bienvenida · no vuelve a salir si ya hay nombre', async ({ p, h, ok }) => {
  await h.start(); await p.reload(); await p.waitForTimeout(300);
  ok(!(await p.locator('#dlg-welcome').evaluate(d => d.open)), 'la bienvenida no debe reaparecer');
});
T('Datos · se guardan al recargar', async ({ p, h, eq }) => {
  await h.start({ name: 'Luis' }); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 2);
  await p.reload(); await p.waitForTimeout(300);
  eq(await h.S(() => S.name), 'Luis', 'nombre tras recargar'); eq(await h.S(() => S.plan.length), 1, 'plato tras recargar'); eq(await h.S(() => S.plan[0].veces), 2, 'veces tras recargar');
});

// ---- Niveles y navegación ----
T('Niveles · al empezar solo se ven Recetas y Semana', async ({ p, h, ok, eq }) => {
  await h.start();
  ok(await p.locator('.tab[data-view=recetas]').isVisible(), 'Recetas visible'); ok(await p.locator('.tab[data-view=semana]').isVisible(), 'Semana visible');
  ok(!(await p.locator('.tab[data-view=lista]').isVisible()), 'Lista oculta'); ok(!(await p.locator('.tab[data-view=despensa]').isVisible()), 'Despensa oculta');
  ok(!(await p.locator('#btn-scan').isVisible()), 'botón Ticket oculto'); ok(!(await p.locator('#btn-ai').isVisible()), 'asistente oculto');
  ok(/Paso 1/.test(await p.locator('#guia').innerText()), 'la guía muestra el Paso 1');
});
T('Niveles · la guía «Llévame» lleva a Explorar', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('.tab[data-view=semana]');
  const go = p.locator('#guia [data-go]'); ok(await go.count() > 0, 'hay botón «Llévame»'); await go.click(); await p.waitForTimeout(100);
  eq(await h.S(() => S.view), 'recetas', 'va a Recetas'); eq(await h.S(() => S.seg), 'explore', 'en Explorar');
});
T('Niveles · añadir un plato desbloquea Lista y Ticket (y después Despensa y asistente)', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' });
  await h.exploreAdd(r);
  await p.locator(`[data-act=addone][data-id="${r.id}"]`).first().click(); await p.waitForTimeout(100);
  ok(await p.locator('.tab[data-view=lista]').isVisible(), 'Lista aparece'); ok(await p.locator('#btn-scan').isVisible(), 'Ticket aparece');
  ok(!(await p.locator('.tab[data-view=despensa]').isVisible()), 'Despensa aún no');
  await h.stockFor(r.id, 1); await p.waitForTimeout(50);
  ok(await p.locator('.tab[data-view=despensa]').isVisible(), 'Despensa aparece con stock');
  await p.click('.tab[data-view=semana]'); await p.locator('[data-act=eat]').first().click(); await p.waitForTimeout(150); await h.closeAll();
  ok(await p.locator('#btn-ai').isVisible(), 'asistente aparece al anotar una comida'); ok(await p.locator('#btn-eaten').isVisible(), '«Lo que comes» aparece');
});
T('Navegación · cada pestaña muestra su vista y marca la actual', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.stockFor(r.id);
  for (const v of ['recetas', 'semana', 'lista', 'despensa']) {
    await p.locator(`.tab[data-view=${v}]`).click(); await p.waitForTimeout(80);
    for (const w of ['recetas', 'semana', 'lista', 'despensa']) eq(await p.locator('#v-' + w).isVisible(), w === v, `vista ${w} visible=${w === v} al ir a ${v}`);
    eq(await p.locator('.tab[aria-current=page]').getAttribute('data-view'), v, 'pestaña actual marcada');
  }
});
T('Navegación · el último lugar se recuerda al recargar', async ({ p, h, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await p.click('.tab[data-view=lista]'); await p.reload(); await p.waitForTimeout(300);
  eq(await h.S(() => S.view), 'lista', 'vista tras recargar');
});
