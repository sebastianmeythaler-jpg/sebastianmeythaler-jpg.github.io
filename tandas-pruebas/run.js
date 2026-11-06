// Uso:  node run.js            → todas las pruebas
//       node run.js ajustes    → solo las que contengan "ajustes" en el nombre
//       node run.js --rapido   → todas menos los «monos» (pulsaciones al azar)
const fs = require('fs'), path = require('path');
const lib = require('./lib');
for (const f of fs.readdirSync(__dirname).filter(f => /^t\d+-.*\.js$/.test(f)).sort()) require('./' + f);
const args = process.argv.slice(2); const rapido = args.includes('--rapido'); const filtro = args.find(a => !a.startsWith('--'));
lib.run(filtro, { rapido }).then(n => process.exit(n ? 1 : 0));
