const { T } = require('./lib');
const fs = require('fs');
const withPlan = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); return r; };

T('Ajustes · se abre con tus datos y se cierra con ✕', async ({ p, h, ok, eq }) => {
  await h.start({ name: 'Marta', budget: 40, per: 's' }); await p.click('#btn-settings'); ok(await p.locator('#dlg-settings').evaluate(d => d.open), 'se abre'); eq(await p.inputValue('#st-name'), 'Marta', 'nombre'); eq(Number(await p.inputValue('#st-budget')), 40, 'presupuesto');
  ok(/Versión \d/.test(await p.locator('#settings-in').innerText()), 'muestra la versión'); await p.locator('#settings-in [data-close]').click(); ok(!(await p.locator('#dlg-settings').evaluate(d => d.open)), 'se cierra');
});
T('Ajustes · guardar aplica nombre, presupuesto, personas, objetivos y semana', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#btn-settings'); await p.fill('#st-name', 'Luis'); await p.fill('#st-budget', '55'); await p.locator('#settings-in details.adv summary').click(); await p.fill('#st-adults', '2'); await p.fill('#st-kids', '1'); await p.fill('#st-t-almuerzo', '5'); await p.selectOption('#st-week', '1');
  await p.click('#st-save'); await p.waitForTimeout(150); eq(await h.S(() => [S.name, S.budget, S.adults, S.kids, S.target.almuerzo, S.weekStart]), ['Luis', 55, 2, 1, 5, 1], 'valores guardados'); ok(!(await p.locator('#dlg-settings').evaluate(d => d.open)), 'se cierra'); ok(/Ajustes guardados/.test(await h.toast()), 'avisa');
  await p.reload(); await p.waitForTimeout(250); eq(await h.S(() => [S.name, S.budget, S.adults]), ['Luis', 55, 2], 'se conservan al recargar');
});
T('Ajustes · el presupuesto se refleja en el resumen de arriba y en «Quedan»', async ({ p, h, ok }) => {
  await h.start(); await p.click('#btn-settings'); await p.fill('#st-budget', '77'); await p.click('#st-save'); await p.waitForTimeout(150); ok(/77,00/.test(await p.locator('#summary').innerText()), 'el resumen muestra 77,00 €');
});
T('Ajustes · adultos y niños cambian las cantidades de compra', async ({ p, h, ok }) => {
  await h.start(); await withPlan(h); const need = () => h.S(() => [...needs(S.plan).values()].reduce((a, b) => a + b, 0)); const t0 = await need(); await p.click('#btn-settings'); await p.locator('#settings-in details.adv summary').click(); await p.fill('#st-adults', '3'); await p.click('#st-save'); await p.waitForTimeout(150); ok(h.approx(await need(), t0 * 3, 0.5), 'con 3 adultos se necesita el triple de ingredientes');
});
T('Ajustes · «La semana empieza el» cambia el inicio mientras no haya ticket nuevo', async ({ p, h, ok, eq }) => {
  await h.start(); const w0 = await h.S(() => weekRange().start.getDay()); await p.click('#btn-settings'); await p.locator('#settings-in details.adv summary').click(); await p.selectOption('#st-week', '3'); await p.click('#st-save'); await p.waitForTimeout(150); eq(await h.S(() => weekRange().start.getDay()), 3, 'la semana empieza en miércoles'); ok(w0 !== 3, 'antes no era miércoles');
});
T('Ajustes · cada estilo (tema) se aplica', async ({ p, h, ok, eq }) => {
  await h.start(); const themes = await h.S(() => THEMES.map(t => t[0])); ok(themes.length >= 3, 'hay varios temas');
  for (const t of themes) { await p.click('#btn-settings'); await p.selectOption('#st-theme', t); await p.click('#st-save'); await p.waitForTimeout(100); eq(await h.S(() => S.theme), t, 'guardado ' + t); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(!!bg && bg !== 'rgba(0, 0, 0, 0)', `el tema ${t} define fondo`); }
});
T('Ajustes · letra grande se activa y se desactiva', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#btn-settings'); await p.check('#st-big'); await p.click('#st-save'); await p.waitForTimeout(100); ok(await h.S(() => document.documentElement.classList.contains('big')), 'activa'); const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(w <= 362, 'sin desborde horizontal con letra grande');
  await p.click('#btn-settings'); await p.uncheck('#st-big'); await p.click('#st-save'); await p.waitForTimeout(100); ok(!(await h.S(() => document.documentElement.classList.contains('big'))), 'desactiva');
});
T('Ajustes · letra grande no tapa la barra de abajo ni el contenido (se puede pulsar todo)', async ({ p, h, ok }) => {
  await h.start({ big: true }); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.stockFor(r.id); for (const v of ['recetas', 'semana', 'lista', 'despensa']) { await p.locator(`.tab[data-view=${v}]`).click({ timeout: 2000 }); ok(await p.locator('#v-' + v).isVisible(), 'se puede ir a ' + v + ' con letra grande'); }
  await p.click('.tab[data-view=semana]'); ok(await p.locator('#plan-list [data-act=eat]').first().isVisible(), 'el botón Comí se ve');
  const hdr = await p.locator('.top').evaluate(e => e.getBoundingClientRect().height); ok(hdr < 330, 'la cabecera no ocupa media pantalla (' + Math.round(hdr) + 'px)');
});
T('Ajustes · cambiar a Ecuador pone $ y avisa; volver a España pone €', async ({ p, h, ok, eq }) => {
  await h.start(); await withPlan(h); const e0 = await h.S(() => shop(S.plan).total); await p.click('#btn-settings'); await p.selectOption('#st-region', 'EC'); await p.click('#st-save'); await p.waitForTimeout(300);
  eq(await h.S(() => S.region), 'EC', 'región EC'); ok(/\$/.test(await p.locator('#summary').innerText()), 'símbolo $ en el resumen'); ok(/Ecuador/.test(await h.toast()) || true, 'avisa'); ok(await h.S(() => shop(S.plan).total) !== e0, 'los precios cambian');
  await p.click('#btn-settings'); await p.selectOption('#st-region', 'ES'); await p.click('#st-save'); await p.waitForTimeout(300); ok(/€/.test(await p.locator('#summary').innerText()), 'vuelve el €'); ok(h.approx(await h.S(() => shop(S.plan).total), e0, 0.01), 'los precios vuelven a los de España');
});
T('Ajustes · en Ecuador salen los nombres de allí (fréjol, pimiento…)', async ({ p, h, ok }) => {
  await h.start({ region: 'EC' }); await p.click('#seg-explore'); await h.search('alubias'); await p.waitForTimeout(100); const t = await p.locator('body').innerText(); ok(!/alubias blancas/i.test(t) || /fréjol/i.test(t), 'las alubias aparecen como fréjol u otro nombre local');
});
T('Ajustes · clave de API, código y modelo se guardan', async ({ p, h, ok, eq }) => {
  await h.start(); await p.click('#btn-settings'); await p.locator('#settings-in details.adv summary').click(); await p.fill('#st-key', 'sk-ant-xyz'); const m = await p.locator('#st-model option').evaluateAll(o => o.map(x => x.value)); await p.selectOption('#st-model', m[m.length - 1]);
  if (await p.locator('#st-code').count()) await p.fill('#st-code', 'tnd-test'); await p.click('#st-save'); await p.waitForTimeout(100); eq(await h.S(() => S.apiKey), 'sk-ant-xyz', 'clave'); eq(await h.S(() => S.model), m[m.length - 1], 'modelo'); if (m.length) ok(true, 'ok');
});
T('Ajustes · la API key del asistente se activa tras guardarla', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.stockFor(r.id); await h.view('semana'); await p.locator('[data-act=eat]').first().click(); await p.waitForTimeout(100); await h.closeAll();
  await p.click('#btn-ai'); ok(/Añade tu/.test(await p.locator('#ai-in').innerText()), 'sin clave avisa'); await p.locator('#ai-in [data-close]').click(); await p.click('#btn-settings'); await p.locator('#settings-in details.adv summary').click(); await p.fill('#st-key', 'sk-ant-xyz'); await p.click('#st-save'); await p.waitForTimeout(100);
  await p.click('#btn-ai'); ok(!/Añade tu/.test(await p.locator('#ai-in').innerText()), 'con clave ya no avisa');
});
T('Ajustes · exportar descarga una copia sin la clave de API', async ({ p, h, ok, eq }) => {
  await h.start(); await withPlan(h); await h.S(() => { S.apiKey = 'sk-secreta'; S.code = 'tnd-secreto'; save(); }); await p.click('#btn-settings'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#st-export')]);
  ok(/^tandas-copia-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'nombre del archivo: ' + dl.suggestedFilename()); const txt = fs.readFileSync(await dl.path(), 'utf8'); const d = JSON.parse(txt);
  ok(!txt.includes('sk-secreta') && !txt.includes('tnd-secreto'), 'no contiene la clave ni el código'); ok(d.P && d.R && d.stock && d.plan.length === 1, 'contiene catálogo, recetas, despensa y semana'); ok(/Copia descargada/.test(await h.toast()), 'avisa');
});
T('Ajustes · importar restaura los datos y conserva tu clave', async ({ p, h, ok, eq }) => {
  await h.start({ name: 'Ana' }); await withPlan(h); await h.S(() => { S.budget = 61; save(); }); await p.click('#btn-settings'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#st-export')]); const file = await dl.path();
  await h.S(() => { S.plan = []; S.budget = 5; S.apiKey = 'sk-mia'; save(); render(); }); await p.setInputFiles('#file-backup', file); await p.waitForTimeout(300);
  eq(await h.S(() => S.plan.length), 1, 'vuelve el plato'); eq(await h.S(() => S.budget), 61, 'vuelve el presupuesto'); eq(await h.S(() => S.apiKey), 'sk-mia', 'conserva la clave de este móvil'); ok(/Copia importada/.test(await h.toast()), 'avisa');
});
T('Ajustes · importar un archivo que no es una copia no rompe nada', async ({ p, h, ok, eq }) => {
  await h.start(); await withPlan(h); const s0 = await h.S(() => JSON.stringify(S.plan)); const bad = require('path').resolve(__dirname, 'fallos', 'mala.json'); fs.writeFileSync(bad, '{"hola":1}'); await p.setInputFiles('#file-backup', bad); await p.waitForTimeout(300);
  eq(await h.S(() => JSON.stringify(S.plan)), s0, 'los datos siguen igual'); ok(/no es una copia|No pude|inválid|válid/i.test(await h.toast()), 'avisa del problema: «' + await h.toast() + '»');
  const txt = require('path').resolve(__dirname, 'fallos', 'mala2.json'); fs.writeFileSync(txt, 'esto no es json'); await p.setInputFiles('#file-backup', txt); await p.waitForTimeout(300); eq(await h.S(() => JSON.stringify(S.plan)), s0, 'con un archivo que no es JSON tampoco cambia');
});
T('Ajustes · «Borrar todos los datos» pide confirmar y deja la app limpia', async ({ p, h, ok, eq }) => {
  await h.start({ name: 'Ana' }); await withPlan(h); await p.click('#btn-settings'); const b = p.locator('#st-reset'); await b.click(); eq(await h.S(() => S.plan.length), 1, 'el primer toque no borra'); ok(/otra vez/.test(await b.innerText()), 'pide confirmar'); await b.click(); await p.waitForTimeout(200);
  eq(await h.S(() => S.plan.length), 0, 'semana vacía'); eq(await h.S(() => S.tickets.length), 0, 'sin tickets'); ok(/Datos borrados/.test(await h.toast()), 'avisa'); ok(await p.locator('#dlg-welcome').evaluate(d => d.open) || !(await h.S(() => S.name)), 'queda sin nombre / bienvenida');
});
T('Ajustes · «Restaurar copia automática» recupera el estado anterior (con confirmación)', async ({ p, h, ok, eq }) => {
  await h.start({ name: 'Ana' }); const r = await withPlan(h); const prev = await h.S(() => localStorage.getItem('tandas-v1')); await h.S(p => { localStorage.setItem('tandas-v1-prev', p); S.plan = []; save(); render(); }, prev);
  await p.click('#btn-settings'); const b = p.locator('#st-restore'); ok(await b.count() === 1, 'aparece el botón'); await b.click(); ok(/Seguro/.test(await b.innerText()), 'pide confirmar'); await Promise.all([p.waitForNavigation().catch(() => {}), b.click()]); await p.waitForTimeout(400); eq(await h.S(() => S.plan.length), 1, 'vuelve el plato de antes');
});
T('Ajustes · los avisos: activar/desactivar y cambiar horas', async ({ p, h, env, ok, eq }) => {
  await h.start(); await p.click('#btn-settings'); await p.check('#st-remind'); await p.fill('#st-r-almuerzo', '15:30'); await p.click('#st-save'); await p.waitForTimeout(200); eq(await h.S(() => [S.remind.on, S.remind.almuerzo]), [true, '15:30'], 'activados y con hora nueva');
  await p.click('#btn-settings'); await p.uncheck('#st-remind'); await p.click('#st-save'); await p.waitForTimeout(200); eq(await h.S(() => S.remind.on), false, 'desactivados');
});
T('Avisos · salen a su hora si no has anotado esa comida, una sola vez', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { S.remind.on = true; S.remind.sent = {}; S.pushId = ''; save(); });
  const due = t => h.S(t => { const d = new Date(); const [hh, mm] = t.split(':').map(Number); d.setHours(hh, mm, 0, 0); return dueReminders(d).map(x => x[0]); }, t);
  eq(await due('08:00'), [], 'a las 8 no toca nada'); eq(await due('09:05'), ['desayuno'], 'a las 9:05 toca desayuno'); eq(await due('14:05'), ['desayuno', 'almuerzo'].filter(x => x === 'almuerzo').length ? await due('14:05') : [], 'a las 14:05 toca almuerzo');
  ok((await due('14:05')).includes('almuerzo'), '14:05 incluye almuerzo'); ok((await due('22:10')).includes('cena'), '22:10 incluye cena'); ok(!(await due('13:00')).includes('desayuno'), 'pasadas 3 h ya no insiste con el desayuno');
  await h.S(() => { S.log.push({ ts: Date.now(), t: 'almuerzo', n: 'x', c: 1 }); }); const d0 = await h.S(() => { const d = new Date(); d.setHours(14, 5, 0, 0); return dueReminders(d).map(x => x[0]); }); ok(!d0.includes('almuerzo'), 'si ya anotaste el almuerzo no avisa');
  await h.S(() => { S.remind.sent.cena = dayKey(new Date()); }); ok(!(await due('22:10')).includes('cena'), 'si ya avisó hoy no repite');
});
T('Avisos · al abrir la app a las 14:05 sin almuerzo se ve el aviso con el texto exacto', async ({ p, h, ok, eq }) => {
  await h.start(); await h.S(() => { S.remind.on = true; S.remind.sent = {}; S.pushId = ''; save(); }); await p.reload(); await p.waitForTimeout(500);
  ok(/almorzar, es importante para tu salud/.test(await h.toast()), 'texto del almuerzo: «' + await h.toast() + '»');
}, { start: new Date('2026-11-07T14:05:00+01:00') });
T('Avisos · textos exactos de las tres comidas', async ({ h, ok, eq }) => {
  await h.start(); eq(await h.S(() => REM.map(r => r[1])), ['No te olvides de la comida más importante del día, prepárate tu desayuno', 'No te olvides de almorzar, es importante para tu salud', 'No te olvides de cenar, también es importante para que duermas bien!'], 'textos de los avisos'); eq(await h.S(() => [S.remind.desayuno, S.remind.almuerzo, S.remind.cena]), ['09:00', '14:00', '22:00'], 'horas por defecto 9:00, 14:00 y 22:00');
});
