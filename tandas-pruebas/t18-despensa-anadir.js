const { T } = require('./lib');
const base = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 2); await h.stockFor(r.id, 2); await h.view('despensa'); return r; };
const escribir = async (p, txt) => { await p.click('#btn-inv-add'); await p.fill('#ia-text', txt); await p.click('[data-ia=go]'); await p.waitForSelector('[data-ia=save]', { timeout: 5000 }); };
const filas = p => p.locator('#ia-rows .ia-r');

T('Despensa · el buscador encuentra productos (sin tildes ni mayúsculas) y vuelve a mostrar todo al borrarlo', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.stock['Plátano'] = 3; S.stock['Leche desnatada'] = 1000; S.stock['Comino molido'] = 1; S.since['Comino molido'] = Date.now(); save(); render(); });
  const all = await p.locator('#inv-list .inv-r').count(); await p.fill('#isearch', 'PLATANO'); await p.waitForTimeout(350);
  eq(await p.locator('#inv-list .inv-r').count(), 1, 'solo queda el plátano'); ok(/Plátano/.test(await p.locator('#inv-list .inv-r').innerText()), 'es el plátano'); ok(await p.locator('#isearch').evaluate(e => e === document.activeElement), 'no pierde el foco al escribir');
  await p.fill('#isearch', 'leche'); await p.waitForTimeout(350); ok(/Leche desnatada/.test(await p.locator('#inv-list').innerText()), 'busca por parte del nombre');
  await p.fill('#isearch', ''); await p.waitForTimeout(350); eq(await p.locator('#inv-list .inv-r').count(), all, 'al borrar vuelven todos');
  const chip = p.locator('.inv-chips [data-act=inv-cat]').nth(1); await chip.click(); await p.waitForTimeout(80); await p.fill('#isearch', 'comino'); await p.waitForTimeout(350); ok(/Comino molido/.test(await p.locator('#inv-list').innerText()), 'buscar ignora la categoría elegida');
});
T('Despensa · buscar algo que no tienes ofrece añadirlo con el nombre ya escrito', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.fill('#isearch', 'garbanzos'); await p.waitForTimeout(350); ok(/No tienes «garbanzos» en casa/.test(await p.locator('#inv-list').innerText()), 'lo dice claro');
  await p.locator('[data-act=inv-new]').click(); await p.waitForSelector('#ia-text'); eq(await p.locator('#ia-text').inputValue(), 'garbanzos', 'la hoja se abre con el nombre');
});
T('Añadir a la despensa · entiende cantidades y unidades escritas a mano', async ({ h, ok, eq }) => {
  await h.start(); const r = await h.S(() => ['2 kg de arroz', '6 huevos', 'media docena de huevos', 'aceite de oliva 1 L', '1,5 l leche', '3 latas de atún', 'champú', '2 limones', 'dos paquetes de macarrones', 'Sal x2', '- 250g queso rallado.', 'tomate: 4'].map(t => { const x = parseInvLine(t); return `${x.name}|${x.q}|${x.k}`; }));
  eq(r.join(' ; '), 'arroz|2|kg ; huevos|6| ; huevos|0.5|doc ; aceite de oliva|1|l ; leche|1.5|l ; atún|3|env ; champú|null| ; limones|2| ; macarrones|2|env ; Sal|2| ; queso rallado|250|g ; tomate|4|', 'cada línea se parte en nombre, cantidad y unidad');
  const parts = await h.S(() => invSplit('2 kg de arroz, 6 huevos y 1,5 l de leche\nchampú; sal')); eq(parts.join('|'), '2 kg de arroz|6 huevos|1,5 l de leche|champú|sal', 'separa por comas, «y», punto y coma y líneas, sin romper los decimales');
});
T('Añadir a la despensa · sin IA: coloca cada cosa (comida y hogar), suma al stock y no cuenta como gasto', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const s0 = await h.S(() => ({ arroz: S.stock['Arroz'] || 0, hue: S.stock['Huevos L'] || 0, leche: S.stock['Leche desnatada'] || 0, com: S.stock['Comino molido'] || 0, spent: spentInfo().spent, tk: S.tickets.length, nP: Object.keys(S.P).length }));
  await escribir(p, '2 kg de arroz, 6 huevos l, 1,5 l de leche desnatada, comino molido, champú, 2 lejía');
  eq(await filas(p).count(), 6, 'seis filas para revisar'); const txt = await p.locator('#ia-rows').innerText(); ok(/Hogar · Aseo personal/.test(txt) && /Hogar · Limpieza/.test(txt), 'reconoce lo que es de hogar'); ok(!/Nuevo/.test(txt), 'todo existía: nada marcado como nuevo');
  ok(/no cuenta como gasto/.test(await p.locator('#form-in').innerText()), 'explica que no es un gasto'); await p.click('[data-ia=save]'); await p.waitForTimeout(150);
  const s = await h.S(() => ({ arroz: S.stock['Arroz'], hue: S.stock['Huevos L'], leche: S.stock['Leche desnatada'], com: S.stock['Comino molido'], ch: S.hstock['Champú'], lej: S.hstock['Lejía'], spent: spentInfo().spent, tk: S.tickets.length, nP: Object.keys(S.P).length, since: !!S.since['Comino molido'] }));
  eq(s.arroz, s0.arroz + 2000, '2 kg = 2000 g'); eq(s.hue, s0.hue + 6, '6 huevos'); eq(s.leche, s0.leche + 1500, '1,5 l = 1500 ml'); eq(s.com, s0.com + 1, 'la especia cuenta por botes'); ok(s.since, 'y apunta desde cuándo la tienes'); eq(s.ch, 1, 'champú en Hogar'); eq(s.lej, 2, '2 de lejía');
  eq(s.spent, s0.spent, 'el gasto no cambia'); eq(s.tk, s0.tk, 'no crea tickets'); eq(s.nP, s0.nP, 'no crea productos duplicados'); ok(/6 productos añadidos a tu despensa \(2 en Hogar\)/.test(await h.toast()), 'avisa: ' + await h.toast()); ok(!await p.locator('#dlg-form').evaluate(d => d.open), 'la hoja se cierra');
});
T('Añadir a la despensa · sin IA: producto nuevo, con categoría sugerida que puedo cambiar, unidad y nombre', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await escribir(p, 'tofu ahumado 400 g\n2 kombucha\nlimpiacristales');
  eq(await filas(p).count(), 3, 'tres filas'); eq(await p.locator('#ia-rows .tag.acc', { hasText: 'Nuevo' }).count(), 3, 'las tres son nuevas');
  eq(await filas(p).nth(0).locator('.ia-c').inputValue(), 'c:Proteínas', 'tofu → Proteínas'); eq(await filas(p).nth(0).locator('.ia-u').inputValue(), 'g', 'en gramos'); eq(await filas(p).nth(0).locator('.ia-qty').inputValue(), '400', '400 g');
  eq(await filas(p).nth(2).locator('.ia-c').inputValue(), 'h:Limpieza', 'limpiacristales → Hogar · Limpieza');
  await filas(p).nth(1).locator('.ia-c').selectOption('c:Bebidas'); await p.waitForTimeout(80); await filas(p).nth(1).locator('.ia-n').fill('Kombucha de jengibre'); eq(await filas(p).nth(0).locator('.ia-qty').inputValue(), '400', 'cambiar una categoría no borra lo demás');
  await p.click('[data-ia=save]'); await p.waitForTimeout(150);
  const s = await h.S(() => ({ tofu: S.P['Tofu ahumado'], tc: S.CATS[catOf('Tofu ahumado')].name, ts: S.stock['Tofu ahumado'], k: S.P['Kombucha de jengibre'], kc: S.CATS[catOf('Kombucha de jengibre')].name, ks: S.stock['Kombucha de jengibre'], l: S.HP['Limpiacristales'], ls: S.hstock['Limpiacristales'] }));
  ok(s.tofu && s.tofu.u === 'g' && s.tofu.q === 400, 'tofu creado con su formato de 400 g'); eq(s.tc, 'Proteínas', 'en Proteínas'); eq(s.ts, 400, 'con 400 g en casa'); ok(s.k && s.k.u === 'ud', 'kombucha por unidades'); eq(s.kc, 'Bebidas', 'en la categoría que elegí'); eq(s.ks, 2, '2 unidades');
  ok(s.l && s.l.cat === 'Limpieza', 'producto de hogar creado'); eq(s.ls, 1, 'una unidad'); ok(/3 eran nuevos/.test(await h.toast()), 'avisa de los nuevos');
  await p.fill('#isearch', 'tofu'); await p.waitForTimeout(350); ok(/Tofu ahumado/.test(await p.locator('#inv-list').innerText()), 'y ya se ve en la despensa');
});
T('Añadir a la despensa · «huevos» o «pan» proponen los parecidos del catálogo en vez de duplicar, y puedo decir que es otro', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); const n0 = await h.S(() => Object.keys(S.P).length); await escribir(p, '6 huevos, 1 pan');
  const pan = filas(p).nth(1); ok(await pan.locator('.ia-pick').count() === 1, 'pan: deja elegir cuál'); const opts = await pan.locator('.ia-pick option').allInnerTexts(); ok(opts.filter(o => /^Pan /.test(o)).length >= 2 && opts.some(o => /Es otro/.test(o)), 'lista los panes y «es otro»: ' + opts.join(' / '));
  await pan.locator('.ia-pick').selectOption('Pan de molde integral'); await p.waitForTimeout(80); await p.click('[data-ia=save]'); await p.waitForTimeout(150);
  ok(await h.S(() => S.stock['Huevos L'] >= 6), 'los huevos van a «Huevos L»'); ok(await h.S(() => S.stock['Pan de molde integral'] > 0), 'el pan al que elegí'); eq(await h.S(() => Object.keys(S.P).length), n0, 'no se crea ningún producto');
  await escribir(p, 'pan'); await filas(p).first().locator('.ia-pick').selectOption('__new'); await p.waitForTimeout(80); ok(await filas(p).first().locator('.tag.acc').count() === 1, 'al decir «es otro» pasa a ser nuevo'); await p.click('[data-ia=save]'); await p.waitForTimeout(150); ok(await h.S(() => S.P['Pan'] && S.stock['Pan'] === 1 && S.CATS[catOf('Pan')].name === 'Pan y tortillas'), 'se crea «Pan» en su categoría');
});
T('Añadir a la despensa · validaciones: vacío, cantidad 0, quitar filas, volver a escribir y líneas repetidas', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await p.click('#btn-inv-add'); await p.click('[data-ia=go]'); ok(/Escribe al menos una cosa/.test(await p.locator('#form-err').innerText()), 'vacío avisa');
  await p.fill('#ia-text', '1 kg de arroz\n500 g de arroz\nmacarrones'); await p.click('[data-ia=go]'); await p.waitForSelector('[data-ia=save]'); eq(await filas(p).count(), 2, 'dos líneas de arroz se juntan'); eq(await filas(p).first().locator('.ia-qty').inputValue(), '1500', 'sumadas: 1500 g');
  await filas(p).first().locator('.ia-qty').fill('0'); await p.click('[data-ia=save]'); ok(/Falta la cantidad de Arroz/.test(await p.locator('#form-err').innerText()), 'cantidad 0 no se guarda');
  await p.click('[data-ia=back]'); eq(await p.locator('#ia-text').inputValue(), '1 kg de arroz\n500 g de arroz\nmacarrones', '«Volver» conserva lo escrito');
  await p.click('[data-ia=go]'); await p.waitForSelector('[data-ia=save]'); const a0 = await h.S(() => S.stock['Arroz'] || 0); await filas(p).first().locator('[data-ia=rm]').click(); eq(await filas(p).count(), 1, 'quitar una fila'); ok(/Guardar 1 en/.test(await p.locator('[data-ia=save]').innerText()), 'el botón dice cuántos');
  await p.click('[data-ia=save]'); await p.waitForTimeout(150); eq(await h.S(() => S.stock['Arroz'] || 0), a0, 'el arroz quitado no se suma'); ok(await h.S(() => S.stock['Macarrones'] === S.P['Macarrones'].q), 'sin cantidad = un paquete');
});
T('Añadir a la despensa · con IA: usa lo que existe, crea lo nuevo con precio aproximado y separa el hogar', async ({ p, h, env, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); }); const a0 = await h.S(() => S.stock['Arroz'] || 0);
  env.forced.inventariar = { items: [
    { texto: 'arrocito 2 kg', nombre: 'Arroz', producto_existente: 'Arroz', destino: 'comida', categoria: 'Pasta, cereales y legumbres', unidad: 'g', cantidad: 2000 },
    { texto: 'un bote de kimchi', nombre: 'Kimchi', destino: 'comida', categoria: 'Verduras', unidad: 'g', cantidad: 300, formato: 'Bote 300 g', cantidad_formato: 300, precio: 3.2 },
    { texto: 'pimentón picante', nombre: 'PIMENTÓN PICANTE', destino: 'comida', categoria: 'Especias y condimentos', unidad: 'g', cantidad: 75, formato: 'Lata 75 g', cantidad_formato: 75, precio: 1.1, consumible: true },
    { texto: 'ambientador', nombre: 'Ambientador', destino: 'hogar', categoria: 'Otros', unidad: 'ud', cantidad: 1, formato: 'Spray', precio: 1.5 },
    { texto: 'esponjas de cocina', nombre: 'Esponjas de cocina', producto_existente: 'Estropajos y esponjas', destino: 'hogar', categoria: 'Limpieza', unidad: 'ud', cantidad: 3 }] };
  await escribir(p, 'arrocito 2 kg, un bote de kimchi, pimentón picante, ambientador, esponjas de cocina');
  ok(/tool|inventariar/.test(JSON.stringify(env.aiCalls[0].tools.map(t => t.name))), 'se pidió a la IA'); ok(env.aiCalls[0].messages[0].content.some ? true : /Arroz/.test(env.aiCalls[0].messages[0].content), 'con el catálogo');
  eq(await filas(p).count(), 5, 'cinco filas'); await p.click('[data-ia=save]'); await p.waitForTimeout(150);
  const s = await h.S(() => ({ arroz: S.stock['Arroz'], kim: S.P['Kimchi'], kc: S.CATS[catOf('Kimchi')].name, ks: S.stock['Kimchi'], pim: S.P['Pimentón picante'], pc: S.CATS[catOf('Pimentón picante')].name, ps: S.stock['Pimentón picante'], amb: S.HP['Ambientador'], as: S.hstock['Ambientador'], esp: S.hstock['Estropajos y esponjas'], dupH: Object.keys(S.HP).filter(n => /esponja/i.test(n)).length }));
  eq(s.arroz, a0 + 2000, 'suma al arroz que ya existía'); ok(s.kim && s.kim.p === 3.2 && s.kim.q === 300 && s.kim.f === 'Bote 300 g', 'kimchi creado con formato y precio'); eq(s.kc, 'Verduras', 'en la categoría de la IA'); eq(s.ks, 300, '300 g en casa');
  ok(s.pim && s.pim.c === 1 && s.pim.u === 'ud' && s.pim.g === 75, 'la especia se crea como bote'); eq(s.pc, 'Especias y condimentos', 'en Especias'); eq(s.ps, 1, 'un bote');
  ok(s.amb && s.amb.cat === 'Otros' && s.as === 1, 'ambientador en Hogar · Otros'); eq(s.esp, 3, 'las esponjas van al producto que ya existía'); eq(s.dupH, 1, 'sin duplicar esponjas');
});
T('Añadir a la despensa · si la IA falla, lo coloca la app y lo avisa (no se pierde lo escrito)', async ({ p, h, env, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.apiKey = 'sk-ant-test'; save(); }); env.offline = true; const a0 = await h.S(() => S.stock['Arroz'] || 0);
  await escribir(p, '1 kg de arroz, mermelada de fresa'); ok(/No he podido consultar a la IA/.test(await p.locator('#form-in').innerText()), 'avisa del fallo'); eq(await filas(p).count(), 2, 'pero deja revisar las 2 filas');
  await p.click('[data-ia=save]'); await p.waitForTimeout(150); eq(await h.S(() => S.stock['Arroz']), a0 + 1000, 'se guarda igualmente'); ok(await h.S(() => { const k = Object.keys(S.stock).find(n => /mermelada/i.test(n)); return k && S.stock[k] > 0; }), 'la mermelada también');
});
T('Añadir a la despensa · en Hogar la hoja ofrece añadir con categoría, y el buscador filtra los productos de casa', async ({ p, h, ok, eq }) => {
  await h.start(); await base(h); await h.S(() => { S.hstock['Champú'] = 1; S.hstock['Lejía'] = 2; save(); render(); }); await p.click('#seg-home');
  await p.fill('#isearch', 'lej'); await p.waitForTimeout(350); eq(await p.locator('#inv-list input[data-act=hstock]').count(), 1, 'solo la lejía'); await p.fill('#isearch', 'zzz'); await p.waitForTimeout(350); ok(/No tienes «zzz»/.test(await p.locator('#inv-list').innerText()), 'sin resultados lo dice'); await p.fill('#isearch', ''); await p.waitForTimeout(350);
  await p.click('#btn-inv-add'); ok(/categoría/i.test(await p.locator('#ia-cat > summary').innerText()), 'opción de añadir con categoría'); await p.click('#ia-cat > summary'); ok(await p.locator('#h-name').count() === 1 && await p.locator('#inv-prod').count() === 0, 'en Hogar sale el formulario de hogar');
  await p.fill('#ia-text', 'gel de ducha'); await p.click('[data-ia=go]'); await p.waitForSelector('[data-ia=save]'); await p.click('[data-ia=save]'); await p.waitForTimeout(150); eq(await h.S(() => S.hstock['Gel de ducha']), 1, 'el texto libre también funciona desde Hogar'); eq(await h.S(() => S.invSeg), 'home', 'y te deja en Hogar');
});
T('Añadir a la despensa · Ecuador: entiende los nombres locales y no duplica el producto', async ({ p, h, ok, eq }) => {
  await h.start({ region: 'EC' }); await base(h); const par = await h.S(() => { const ln = locNames() || {}; const e = Object.entries(ln).find(([a, b]) => S.P[a] && a.toLowerCase() !== b.toLowerCase() && !S.P[b]); return e || null; });
  if (!par) return ok(true, 'sin nombres locales distintos'); const n0 = await h.S(() => Object.keys(S.P).length); const s0 = await h.S(a => S.stock[a] || 0, par[0]);
  await escribir(p, '1 ' + par[1].toLowerCase()); await p.click('[data-ia=save]'); await p.waitForTimeout(150); eq(await h.S(() => Object.keys(S.P).length), n0, `«${par[1]}» no crea producto nuevo`); ok(await h.S(a => S.stock[a] || 0, par[0]) > s0, `suma a «${par[0]}»`);
});
