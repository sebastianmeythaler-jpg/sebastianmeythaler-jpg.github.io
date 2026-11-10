# Pruebas de Tandas

Un solo comando abre la app en un móvil virtual (360×740), pulsa los botones de verdad y comprueba lo que hacen.
Se lanza **después de cada mejora o cambio**, antes de subirlo.

```
cd tandas-pruebas
node run.js              # todas (≈ 2 min)
node run.js --rapido     # todas menos los «monos» (pulsaciones al azar)
node run.js ajustes      # solo las pruebas cuyo nombre contenga «ajustes»
TANDAS_DIR=/ruta/a/otra/version/tandas node run.js   # contra otra copia de la app
```

Hace falta Node y `playwright` instalado (`npm i playwright`, y `npx playwright install chromium`).
Si algo falla, escribe qué prueba y qué esperaba; una captura queda en `fallos/` (no se sube).

## Qué cubre

| Archivo | Zona |
|---|---|
| `t01-inicio` | Bienvenida, niveles que se desbloquean, navegación, guardado |
| `t02-recetas` | Explorar/Mi recetario, buscador, filtros, +/−, ingredientes y pasos, datos de las recetas |
| `t03-semana` | Plato en la semana, Ya lo cociné, Comí N, Lo que comes, Te falta comprar, snacks |
| `t04-lista` | Lista de compras, carro, pasar a la despensa, «ya lo tengo», ajuste de presupuesto, especias y hogar |
| `t05-despensa` | Despensa, categorías, añadir por paquete/lata/bote, editar, Hogar, «¿Qué cocino?» |
| `t06-ticket` | Escáner (IA simulada), a mano, solo el total, duplicados, extras, hogar, borrar |
| `t07-ajustes` | Ajustes, temas, letra grande, país, exportar/importar/borrar/restaurar, avisos |
| `t08-asistente` | Cada herramienta del asistente, deshacer, borrar chat, hábitos, errores |
| `t09-mes-y-cadena` | Historial mensual, resumen de fin de mes, y la cadena receta → lista → ticket → despensa → cocinar → comer → gasto |
| `t10-estructura` | Archivos y service worker, datos de recetas/catálogo/Ecuador, desbordes, tamaño de botones, avisos |
| `t11-monos` | Pulsaciones al azar con semilla fija (repetibles) vigilando que nada se rompa |

Al acabar **cada** prueba se revisa siempre, además: errores de JavaScript y de consola, textos raros
(`NaN`, `undefined`, `null €`…), desbordes horizontales, cantidades negativas, platos sin receta,
y que el historial mensual cuadre con los tickets.

## Cómo añadir una prueba

Cada vez que se arregla un fallo o se añade un botón, se añade su prueba en el archivo de su zona:

```js
T('Zona · lo que debe pasar', async ({ p, h, ok, eq }) => {
  await h.start();                       // app nueva, sin bienvenida
  const r = await h.pick({ tipo: 'almuerzo' }); await h.addPlan(r.id, 2);
  await h.view('semana'); await p.locator('[data-act=eat]').first().click();
  eq(await h.S(() => S.log.length), 1, 'se anota la comida');
});
```

`h` trae ayudas: `start`, `pick`, `addPlan`, `stockFor`, `exploreAdd`, `search`, `scan`, `ticketFromList`, `chatSay`, `S` (leer el estado)…

## Qué cubren las pruebas «duras» (t12, t13, t14)
- **Contrato con la IA** (`lib.js · contractErrors`): el simulador rechaza con error 400 lo que la API real rechazaría (p. ej. `tool_choice` forzado, herramientas mal definidas, imagen no válida) y simula el tope de respuesta del servidor. Si la app pide algo que fallaría en el móvil, la prueba falla.
- **Tickets reales** (t13): comida que no está en el catálogo (g, ml, piezas, sin tamaño), nombres en mayúsculas/plural/tildes, el mismo producto en varias líneas y tickets, sinónimos de Hogar, descuentos negativos, cantidades con decimales, ticket de 40 líneas y 25 tickets generados al azar (semilla fija) con comprobación de cuentas.
- **Nombres y IA** (t14): la IA crea o nombra productos con otra grafía; no debe haber duplicados.
- **Invariantes globales** (todas las pruebas): sin productos duplicados en comida ni en casa, sin textos raros, sin stock inválido, historial cuadrado con los tickets.
- Regla: todo error que aparezca en el móvil se añade aquí **con el caso exacto que lo produjo** antes de darlo por corregido.

- `t16-pensamiento.js`: comprueba que cada llamada a la IA (directa o por el Worker) lleva el pensamiento apagado según el modelo (Haiku «disabled», Sonnet «between_tools») y que un ticket de 40 líneas cabe en 6.000 tokens.
