const { T } = require('./lib');
const plate = async (h, o = {}) => { const r = await h.pick({ tipo: o.tipo || 'almuerzo', tanda: o.tanda, cheap: !o.dear, n: o.n || 0 }); const k = await h.addPlan(r.id, o.veces || 2); if (o.stock) await h.stockFor(r.id, o.veces || 2); return { r, k }; };

T('Lista · vacía explica cómo llenarla', async ({ p, h, ok }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.S(() => { S.plan = []; save(); render(); }); await h.view('lista');
  ok(/se llena cuando añades/.test(await p.locator('#shop-list').innerText()), 'mensaje de lista vacía');
});
T('Lista · muestra cada ingrediente que falta con paquetes, precio y total', async ({ p, h, ok, eq }) => {
  await h.start(); const { r } = await plate(h, { veces: 2 }); await h.view('lista');
  const rows = await p.locator('#shop-list .row').count(); const need = await h.S(() => shop(S.plan).rows.length); eq(rows, need, 'una fila por producto necesario');
  ok(/Total a pagar/.test(await p.locator('#shop-list .foot').innerText()), 'hay línea de total'); ok(/compra \d+ ×|Necesitas/.test(await p.locator('#shop-list .row').first().innerText()), 'dice cuánto comprar');
});
T('Lista · lo que ya tienes sale marcado y bloqueado', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 1, stock: true }); await h.view('lista');
  const dis = await p.locator('#shop-list input[data-act=cart]').evaluateAll(c => c.filter(x => x.disabled && x.checked).length); ok(dis >= 1, 'hay filas «Ya lo tienes» marcadas y desactivadas');
});
T('Lista · marcar «en el carro» se guarda, avisa y se puede desmarcar', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 2 }); await h.view('lista'); const cb = p.locator('#shop-list input[data-act=cart]:not(:disabled)').first(); const n = await cb.getAttribute('data-n');
  await cb.check(); ok(await h.S(n => !!(S.cart || {})[n], n), 'queda en el carro'); ok(await p.locator('.cart-note').count() === 1, 'sale la nota «Marcar solo lo pone en el carro»'); ok(await p.locator('[data-act=cart-stock]').count() === 1, 'sale el botón de pasar a la despensa');
  const st = await h.S(n => S.stock[n] || 0, n); eq(st, 0, 'marcar NO toca la despensa'); await p.reload(); await p.waitForTimeout(250); await h.view('lista'); ok(await p.locator(`input[data-n="${n}"]`).isChecked(), 'sigue marcado tras recargar');
  await p.locator(`input[data-n="${n}"]`).uncheck(); ok(!(await h.S(n => !!(S.cart || {})[n], n)), 'se desmarca'); eq(await p.locator('.cart-note').count(), 0, 'la nota desaparece');
});
T('Lista · «pasar a la despensa» suma stock, crea ticket estimado y apunta el gasto', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 2 }); await h.view('lista'); const boxes = p.locator('#shop-list input[data-act=cart]:not(:disabled)'); const n = await boxes.count(); for (let i = 0; i < n; i++) await boxes.nth(i).check();
  const expect = await h.S(() => shop(S.plan).rows.filter(x => x.packs).map(x => ({ n: x.n, add: x.packs * x.p.q, cost: x.packs * x.p.p }))); const total = expect.reduce((a, x) => a + x.cost, 0);
  await p.locator('[data-act=cart-stock]').click(); await p.waitForTimeout(100);
  eq(await h.S(() => S.tickets.length), 1, 'un ticket'); ok(await h.S(() => S.tickets[0].est), 'marcado estimado'); ok(h.approx(await h.S(() => S.tickets[0].total), total, 0.05), 'el ticket suma lo estimado');
  for (const x of expect) ok(await h.S(a => (S.stock[a.n] || 0) >= a.add - 1e-6, x), `en la despensa: ${x.n}`);
  eq(await h.S(() => Object.keys(S.cart || {}).length), 0, 'el carro queda vacío'); ok(await h.S(() => shop(S.plan).total) < 0.01, 'la Lista ya no pide nada'); ok(await h.S(() => spentInfo().spent) > 0, 'el gasto de la semana sube');
  ok(/pasados a la despensa/.test(await h.toast()), 'avisa'); ok(await p.locator('.tab[data-view=despensa]').isVisible(), 'se desbloquea la Despensa');
});
T('Lista · «Ya lo tengo en casa» quita un básico de la lista', async ({ p, h, ok, eq }) => {
  await h.start(); const found = await h.S(() => { for (const r of S.R) { if (!r.i.length) continue; const trial = [{ k: -9, rid: r.id, veces: 1, opc: false }]; if (shop(trial).rows.some(x => x.packs && !x.cons && x.need / (x.packs * x.p.q) < 0.25)) return r.id; } return null; }); ok(!!found, 'existe una receta con un ingrediente básico'); if (!found) return;
  await h.addPlan(found, 1); await h.view('lista'); const b = p.locator('#shop-list [data-act=haveit]').first(); const n = await b.getAttribute('data-n'); const t0 = await h.S(() => shop(S.plan).total); await b.click(); await p.waitForTimeout(100);
  ok(await h.S(n => (S.stock[n] || 0) > 0, n), 'queda en la despensa'); ok(await h.S(() => shop(S.plan).total) < t0, 'baja el total de la Lista'); ok(/Lo quito de la lista/.test(await h.toast()), 'avisa');
});
T('Lista · si la compra se pasa del presupuesto, ofrece ajustar y funciona', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 4, dear: true }); await plate(h, { veces: 3, tipo: 'cena', dear: true, n: 1 }); await h.S(() => { S.budget = 5; save(); render(); }); await h.view('lista');
  ok(await p.locator('.fit').count() === 1, 'aparece el cuadro de ajuste'); const t0 = await h.S(() => shop(S.plan).total); ok(await p.locator('.fit button').count() >= 1, 'con botones para ajustar');
  const less = p.locator('.fit [data-act=fit-less]').first(); if (await less.count()) { await less.click(); await p.waitForTimeout(100); ok(await h.S(() => shop(S.plan).total) < t0, '«un plato menos» baja la compra'); ok(/Un plato menos/.test(await h.toast()), 'avisa'); }
  const sw = p.locator('.fit [data-act=fit-swap]').first(); const t1 = await h.S(() => shop(S.plan).total); if (await sw.count()) { const to = await sw.getAttribute('data-to'); await sw.click(); await p.waitForTimeout(100); ok(await h.S(() => shop(S.plan).total) < t1, '«cambiar» baja la compra'); ok(await h.S(to => S.plan.some(i => i.rid === to), to), 'el plato nuevo está en la semana'); ok(await h.S(to => S.mine.includes(to), to), 'y en tu recetario'); }
});
T('Lista · con presupuesto de sobra no aparece el cuadro de ajuste', async ({ p, h, ok }) => {
  await h.start(); await plate(h, { veces: 1 }); await h.S(() => { S.budget = 500; save(); render(); }); await h.view('lista'); ok(await p.locator('.fit').count() === 0, 'sin cuadro de ajuste');
});
T('Lista · especias: «Aún tengo» pospone y «Se acabó» las pasa a la lista', async ({ p, h, ok, eq }) => {
  await h.start(); await plate(h, { veces: 1 }); const n = await h.S(() => { const n = Object.keys(S.P).find(n => S.P[n].c); S.stock[n] = 1; S.since[n] = Date.now() - 6 * 7 * 864e5; save(); render(); return n; }); await h.view('lista');
  ok(await p.locator('.cons-box [data-act=cons-snz]').count() >= 1, 'aparece el aviso de especias antiguas'); ok(/más de 4 semanas/.test(await p.locator('.cons-box').first().innerText()), 'explica el motivo');
  await p.locator(`[data-act=cons-snz][data-n="${n}"]`).click(); await p.waitForTimeout(100); ok(await p.locator(`[data-act=cons-snz][data-n="${n}"]`).count() === 0, '«Aún tengo» lo oculta'); ok(await h.S(n => !!S.snz[n], n), 'queda pospuesto'); ok(await h.S(n => S.stock[n] > 0, n), 'sigue en la despensa');
  await h.S(n => { delete S.snz[n]; save(); render(); }, n); await h.view('lista'); await p.locator(`[data-act=cons-out][data-n="${n}"]`).click(); await p.waitForTimeout(100);
  ok(await h.S(n => !S.stock[n] && S.want[n] === 1, n), '«Se acabó»: sale de la despensa y pasa a «quiero»'); ok(/\b(añadido a la lista)/.test(await h.toast()), 'avisa');
  ok(await p.locator('#shop-list').innerText().then(t => t.toLowerCase().includes(n.toLowerCase())), 'aparece en la Lista');
});
T('Lista · cosas de casa: «Para casa» aparece y «Comprado» las repone', async ({ p, h, ok, eq }) => {
  await h.start(); const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 1); await h.stockFor(r.id, 1); await h.view('despensa'); await p.click('#seg-home'); await p.fill('#h-name', 'Champú'); await p.fill('#h-qty', '1'); await p.click('[data-act=home-add]'); await p.waitForTimeout(100);
  await p.locator('[data-act=home-out][data-n="Champú"]').click(); await p.waitForTimeout(100); ok(await h.S(() => !S.hstock['Champú'] && S.hwant['Champú'] === 1), 'pasa a «quiero»');
  await h.view('lista'); ok(await p.locator('.home-box').count() === 1, 'sale la caja «Para casa»'); ok(/Champú/.test(await p.locator('.home-box').innerText()), 'con el producto');
  await p.locator('.home-box [data-act=hbuy][data-n="Champú"]').click(); await p.waitForTimeout(100); eq(await h.S(() => S.hstock['Champú']), 1, 'vuelve a haber 1'); ok(await h.S(() => !S.hwant['Champú']), 'ya no se quiere'); eq(await p.locator('.home-box').count(), 0, 'la caja desaparece');
});
T('Lista · las cosas de casa NO entran en el total de comida', async ({ p, h, ok }) => {
  await h.start(); await plate(h, { veces: 1 }); const t0 = await h.S(() => shop(S.plan).total); await h.S(() => { S.HP['Champú'] = { cat: 'Aseo personal', f: 'Unidad', p: 3.5, t: 1 }; S.hwant['Champú'] = 1; save(); render(); }); ok(Math.abs(t0 - await h.S(() => shop(S.plan).total)) < 0.001, 'el total de comida no cambia');
});
