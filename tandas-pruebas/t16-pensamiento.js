// Pensamiento apagado: sin esto los modelos 5.x gastan miles de tokens «pensando» (se cobran) y Haiku cortaba los tickets.
// Medido contra la API real el 10/11/2026: Haiku solo admite thinking «disabled» y Sonnet solo «between_tools».
const { T } = require('./lib');
// nivel 4 (con plato en la semana, despensa y un consumo): es cuando aparece el botón del asistente
const lvl = async h => { const r = await h.pick({ tipo: 'almuerzo', cheap: true }); await h.addPlan(r.id, 3); await h.stockFor(r.id, 3); await h.S(() => { S.log.push({ ts: Date.now() - 3600e3, t: 'almuerzo', n: 'Plato previo', c: 1 }); save(); render(); }); return r; };
const L = (desc, o = {}) => ({ desc, uds: 1, importe: 2, producto: null, cantidad_inventario: 0, tipo: 'De la lista', ...o });
const tk = lineas => ({ tienda: 'Mercadona', fecha: '2026-11-07', total: Math.round(lineas.reduce((a, l) => a + l.importe, 0) * 100) / 100, lineas });
const esperado = m => /haiku/.test(m) ? 'disabled' : 'between_tools';
const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];

for (const m of MODELOS) {
  T(`Pensamiento · ${m}: ticket, chat e ideas piden el pensamiento apagado (con tu clave)`, async ({ p, h, env, ok, eq }) => {
    await h.start(); await lvl(h); await h.S(m => { S.model = m; S.apiKey = 'sk-ant-test'; save(); }, m);
    await p.locator('#btn-ai').click(); await p.waitForSelector('#chat-text'); await h.chatSay('hola', [{ text: 'Hola' }]); await h.closeAll();
    const c = env.aiCalls.filter(b => b.tools && b.tools.length > 1); ok(c.length >= 1, 'hubo llamada de chat'); for (const b of c) { eq(b.model, m, 'modelo del chat'); eq(b.thinking && b.thinking.type, esperado(m), 'pensamiento del chat'); }
    await h.scan(tk([L('LECHE DESN', { importe: 0.81 }), L('HUEVOS', { importe: 1.8 })])); await h.closeAll();
    const t = env.aiCalls.filter(b => b.tools && b.tools[0].name === 'registrar_ticket'); eq(t.length, 1, 'una llamada de ticket'); eq(t[0].model, m, 'modelo del ticket'); eq(t[0].thinking && t[0].thinking.type, esperado(m), 'pensamiento del ticket');
    ok(env.aiCalls.every(b => b.thinking && b.thinking.type === esperado(m)), 'todas las llamadas con el pensamiento apagado: ' + JSON.stringify(env.aiCalls.map(b => b.thinking)));
  });
  T(`Pensamiento · ${m}: también cuando va por el servidor con código de invitación`, async ({ p, h, env, ok, eq }) => {
    await h.start(); await lvl(h); await h.S(m => { S.model = m; S.apiKey = ''; S.code = 'tnd-prueba1'; save(); }, m);
    await h.scan(tk([L('PAN', { importe: 1.1 })])); await h.closeAll();
    ok(env.aiCalls.length >= 1, 'llamó'); ok(env.aiCalls.every(b => b.thinking && b.thinking.type === esperado(m) && b.model === m), 'por el servidor también: ' + JSON.stringify(env.aiCalls.map(b => [b.model, b.thinking])));
  });
}
T('Pensamiento · un ticket largo (40 líneas) cabe en el margen de 6.000 tokens con ambos modelos', async ({ p, h, env, ok, eq }) => {
  await h.start(); await lvl(h);
  for (const m of MODELOS) { await h.S(m => { S.model = m; S.apiKey = 'sk-ant-test'; save(); }, m);
    const ls = Array.from({ length: 30 }, (_, i) => L('PRODUCTO ' + i, { importe: 1 })); await h.scan(tk(ls)); ok(await p.locator('#rv-save').count() === 1, m + ': el ticket de 30 líneas llega entero'); await h.closeAll(); }
});
