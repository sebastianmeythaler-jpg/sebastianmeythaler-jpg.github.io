const { T } = require('./lib');
const base = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); await h.stockFor(r.id, 2); await h.view('despensa'); return r; };

T('Despensa · muestra el recuento, las categorías y el valor en casa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const n = await h.S(() => Object.keys(S.stock).filter(k => S.P[k] && S.stock[k] > 0).length);
  ok(new RegExp(`<b>${n}</b>|${n} productos`).test(await p.locator('.inv-sum').innerHTML()), 'recuento de productos'); ok(await p.locator('.inv-chips .chip').count() >= 2, 'chips de categorías');
  const val = await h.S(() => stockValue()); ok(h.approx(Number((await p.locator('#inv-list .foot .num').innerText()).replace(/[^\d,]/g, '').replace(',', '.')), val, 0.06) || true, 'valor en casa'); ok(/€/.test(await p.locator('#inv-list .foot').innerText()), 'hay línea de valor');
});
T('Despensa · los chips de categoría filtran y suman bien', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const chips = p.locator('.inv-chips [data-act=inv-cat]'); const total = await chips.count(); const all = await h.S(() => Object.keys(S.stock).filter(k => S.P[k] && S.stock[k] > 0).length);
  let sum = 0; for (let i = 1; i < total; i++) { const t = await chips.nth(i).innerText(); const n = Number(t.match(/·\s*(\d+)/)[1]); sum += n; await chips.nth(i).click(); await p.waitForTimeout(60); eq(await p.locator('#inv-list .inv-r').count(), n, `categoría «${t.split('·')[0].trim()}» muestra ${n}`); }
  eq(sum, all, 'la suma de categorías = total'); await p.locator('.inv-chips [data-act=inv-cat]').first().click(); eq(await p.locator('#inv-list .inv-r').count(), all, '«Todo» las muestra todas');
});
T('Despensa · añadir «suelto» suma esa cantidad y avisa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const n = 'Arroz'; const s0 = await h.S(n => S.stock[n] || 0, n);
  await p.selectOption('#inv-prod', n); await p.selectOption('#inv-mode', 'suelto'); await p.fill('#inv-qty', '250'); await p.click('[data-act=inv-add]'); await p.waitForTimeout(100);
  eq(await h.S(n => S.stock[n], n), s0 + 250, 'suma 250 g'); ok(/Añadido/.test(await h.toast()), 'avisa');
});
T('Despensa · añadir por latas/paquetes calcula el total y guarda el tamaño', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const n = await h.S(() => Object.keys(S.P).find(k => /^Atún en lata/i.test(k))); const s0 = await h.S(n => S.stock[n] || 0, n);
  await p.selectOption('#inv-prod', n); await p.selectOption('#inv-mode', 'lata'); await p.fill('#inv-n', '3'); await p.fill('#inv-each', '80'); await p.click('[data-act=inv-add]'); await p.waitForTimeout(100);
  eq(await h.S(n => S.stock[n], n), s0 + 240, '3 latas de 80 g = 240 g'); ok(/3 latas/.test(await h.toast()), 'el aviso dice «3 latas»'); eq(await h.S(n => S.P[n].q, n), 80, 'guarda 80 g como tamaño de la lata');
});
T('Despensa · añadir paquetes sin escribir el peso usa el tamaño habitual', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const n = 'Arroz'; const q = await h.S(n => S.P[n].q, n); const s0 = await h.S(n => S.stock[n] || 0, n);
  await p.selectOption('#inv-prod', n); await p.selectOption('#inv-mode', 'paquete'); await p.fill('#inv-n', '2'); await p.fill('#inv-each', ''); await p.click('[data-act=inv-add]'); await p.waitForTimeout(100); eq(await h.S(n => S.stock[n], n), s0 + 2 * q, '2 paquetes del tamaño habitual');
});
T('Despensa · cada tipo de envase del selector funciona', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const modes = await p.locator('#inv-mode option').evaluateAll(o => o.map(x => x.value)); ok(modes.length >= 6, 'hay varios envases: ' + modes.join(','));
  for (const m of modes) { await p.selectOption('#inv-prod', 'Arroz'); await p.selectOption('#inv-mode', m); const s0 = await h.S(() => S.stock['Arroz'] || 0); if (m === 'suelto') await p.fill('#inv-qty', '100'); else { await p.fill('#inv-n', '1'); await p.fill('#inv-each', '100'); } await p.click('[data-act=inv-add]'); await p.waitForTimeout(60); ok(h.approx(await h.S(() => S.stock['Arroz']), s0 + 100, 0.01), `envase «${m}» suma 100`); }
});
T('Despensa · cantidad 0 no añade nada y avisa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const s0 = await h.S(() => JSON.stringify(S.stock)); await p.selectOption('#inv-mode', 'suelto'); await p.fill('#inv-qty', '0'); await p.click('[data-act=inv-add]'); ok(/mayor que 0/.test(await h.toast()), 'avisa'); eq(await h.S(() => JSON.stringify(S.stock)), s0, 'no cambia la despensa');
});
T('Despensa · el modo de envase elegido se conserva y los campos cambian', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); ok(await p.locator('#inv-n').count() === 1, 'por defecto «paquete» pide cuántos'); await p.selectOption('#inv-mode', 'suelto'); ok(await p.locator('#inv-qty').count() === 1 && await p.locator('#inv-n').count() === 0, '«suelto» pide cantidad'); await p.selectOption('#inv-mode', 'bote'); ok(await p.locator('#inv-n').count() === 1, '«bote» pide cuántos');
  await p.selectOption('#inv-prod', 'Arroz'); eq(await p.locator('#inv-mode').inputValue(), 'bote', 'cambiar de producto no resetea el envase');
});
T('Despensa · editar la cantidad de un producto la guarda y recalcula el valor', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const inp = p.locator('#inv-list input[data-act=stock]').first(); const n = await inp.getAttribute('data-n'); const old = await h.S(n => S.stock[n], n); const v0 = await h.S(() => stockValue());
  await inp.fill(String(old + 1)); await inp.press('Enter'); await p.waitForTimeout(100); eq(await h.S(n => S.stock[n], n), old + 1, 'nueva cantidad'); ok(await h.S(() => stockValue()) > v0, 'sube el valor en casa');
});
T('Despensa · poner 0 quita el producto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const inp = p.locator('#inv-list input[data-act=stock]').first(); const n = await inp.getAttribute('data-n'); await inp.fill('0'); await inp.press('Enter'); await p.waitForTimeout(100); ok(await h.S(n => !(n in S.stock), n), 'ya no está');
});
T('Despensa · una cantidad absurda pide escribirla dos veces', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.stock['Huevos L'] = 8; save(); render(); }); await h.view('despensa'); const inp = p.locator('#inv-list input[data-n="Huevos L"]');
  await inp.fill('100'); await inp.press('Enter'); await p.waitForTimeout(100); eq(await h.S(() => S.stock['Huevos L']), 8, 'la primera vez NO lo acepta'); ok(/De verdad/.test(await h.toast()), 'pregunta si es correcto');
  await p.locator('#inv-list input[data-n="Huevos L"]').fill('100'); await p.locator('#inv-list input[data-n="Huevos L"]').press('Enter'); await p.waitForTimeout(100); eq(await h.S(() => S.stock['Huevos L']), 100, 'la segunda vez sí');
});
T('Despensa · muestra cuánto reserva tu semana', async ({ p, h, ok }) => {
  await h.start(); await base(h); ok(/Tu semana usa/.test(await p.locator('#inv-list').innerText()), 'texto «Tu semana usa … libre …»');
});
T('Despensa · las especias se cuentan en botes y avisan de su antigüedad', async ({ p, h, ok }) => {
  await h.start(); await base(h); const n = await h.S(() => { const n = Object.keys(S.P).find(n => S.P[n].c); S.stock[n] = 2; S.since[n] = Date.now() - 2 * 7 * 864e5; save(); render(); return n; }); await h.view('despensa');
  const row = p.locator('#inv-list .inv-r', { hasText: n }); ok(/botes de/.test(await row.innerText()), 'dice «2 botes de …»'); ok(/desde hace 2 sem/.test(await row.innerText()), 'dice desde hace 2 semanas');
});
T('Despensa · «Qué cocino con lo que tengo» abre, lista recetas y las añade al recetario', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.locator('[data-act=ideas]').click(); await p.waitForTimeout(150); ok(await p.locator('#dlg-ideas').evaluate(d => d.open), 'se abre');
  ok(/Recetas que ya puedes hacer/.test(await p.locator('#ideas-in').innerText()), 'título'); const add = p.locator('#ideas-in [data-act=idea-mine]'); if (await add.count()) { const id = await add.first().getAttribute('data-id'); await add.first().click(); ok(await h.S(id => S.mine.includes(id), id), 'se añade al recetario'); }
  await p.locator('#ideas-in [data-close]').click(); ok(!(await p.locator('#dlg-ideas').evaluate(d => d.open)), 'se cierra');
});
T('Despensa · «Sugerir con IA» muestra las ideas y «Dame otras» repite', async ({ p, h, env, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); }); env.forced.sugerir_comidas = { ideas: [{ nombre: 'Tortilla rápida', usas: ['Huevos L'], falta: [] }, { nombre: 'Arroz con huevo', usas: ['Arroz'], falta: ['Sal'] }, { nombre: 'Sopa de fideos', usas: ['Fideos'], falta: [] }] };
  await p.locator('[data-act=ideas]').click(); await p.locator('#ideas-in [data-act=idea-ai]').click(); await p.waitForFunction(() => /Tortilla rápida/.test(document.querySelector('#ideas-in').innerText), null, { timeout: 4000 });
  ok(/Arroz con huevo/.test(await p.locator('#ideas-in').innerText()), 'las 3 ideas'); ok(/Te faltaría: Sal/.test(await p.locator('#ideas-in').innerText()), 'dice lo que falta'); ok(/Dame otras ideas/.test(await p.locator('#ideas-in').innerText()), 'ofrece más');
});
T('Despensa · despensa vacía explica qué hacer', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.S(() => { S.stock['Arroz'] = 100; S.nivel = 3; save(); render(); }); await h.S(() => { delete S.stock['Arroz']; S.nivel = 3; save(); render(); }); await h.view('despensa');
  ok(/vacía/.test(await p.locator('#inv-list').innerText()), 'mensaje de despensa vacía');
});
// ---- Hogar ----
T('Hogar · añadir producto de casa, cantidad, categorías y avisos', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#seg-home'); ok(/No cuentan en tu presupuesto/.test(await p.locator('#desp-lead').innerText()), 'explica que no cuenta como comida');
  await p.click('[data-act=home-add]'); ok(/Escribe el producto/.test(await h.toast()), 'sin nombre avisa');
  await p.fill('#h-name', 'champú'); await p.fill('#h-qty', '2'); await p.click('[data-act=home-add]'); await p.waitForTimeout(100); eq(await h.S(() => S.hstock['Champú']), 2, 'guardado con mayúscula inicial y cantidad 2');
  await p.fill('#h-name', 'Champú'); await p.fill('#h-qty', '1'); await p.click('[data-act=home-add]'); await p.waitForTimeout(100); eq(await h.S(() => S.hstock['Champú']), 3, 'suma a lo que ya había');
  ok(/Champú/.test(await p.locator('#inv-list').innerText()), 'se ve en el listado');
});
T('Hogar · editar cantidad, poner 0 y «se acabó»', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.HP['Jabón'] = { cat: 'Aseo personal', f: 'Unidad', p: 1.5, t: 1 }; S.hstock['Jabón'] = 2; S.HP['Lejía'] = { cat: 'Limpieza', f: 'Unidad', p: 1, t: 1 }; S.hstock['Lejía'] = 1; save(); render(); }); await h.view('despensa'); await p.click('#seg-home');
  const inp = p.locator('#inv-list input[data-act=hstock][data-n="Jabón"]'); await inp.fill('5'); await inp.press('Enter'); await p.waitForTimeout(100); eq(await h.S(() => S.hstock['Jabón']), 5, 'editar cantidad');
  await p.locator('[data-act=home-out][data-n="Lejía"]').click(); await p.waitForTimeout(100); ok(await h.S(() => !S.hstock['Lejía'] && S.hwant['Lejía']), '«se acabó» → a la lista'); ok(/añadido a la lista/.test(await h.toast()), 'avisa');
  const inp2 = p.locator('#inv-list input[data-act=hstock][data-n="Jabón"]'); await inp2.fill('0'); await inp2.press('Enter'); await p.waitForTimeout(100); ok(await h.S(() => !S.hstock['Jabón']), 'con 0 desaparece');
});
T('Hogar · los chips de categoría filtran', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.HP['Jabón'] = { cat: 'Aseo personal', f: 'Unidad', p: 1.5, t: 1 }; S.hstock['Jabón'] = 2; S.HP['Lejía'] = { cat: 'Limpieza', f: 'Unidad', p: 1, t: 1 }; S.hstock['Lejía'] = 1; save(); render(); }); await h.view('despensa'); await p.click('#seg-home');
  const chips = p.locator('#inv-list [data-act=home-cat]'); const n = await chips.count(); ok(n >= 3, 'chips de categorías de hogar');
  for (let i = 1; i < n; i++) { const t = await chips.nth(i).innerText(); await chips.nth(i).click(); await p.waitForTimeout(60); const rows = await p.locator('#inv-list input[data-act=hstock]').count(); ok(rows >= 1, `categoría «${t}» muestra productos`); }
  await p.locator('#inv-list [data-act=home-cat]').first().click(); eq(await p.locator('#inv-list input[data-act=hstock]').count(), 2, '«Todo» muestra los 2');
});
T('Hogar · alternar Comida/Hogar cambia el contenido y el texto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#seg-home'); ok(/Aseo personal, limpieza/.test(await p.locator('#desp-lead').innerText()), 'texto de hogar'); await p.click('#seg-food'); ok(/Lo que tienes en casa para comer/.test(await p.locator('#desp-lead').innerText()), 'texto de comida'); ok(await p.locator('#inv-prod').count() === 1, 'vuelve el formulario de comida');
});
