import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const [directorio, canal] = process.argv.slice(2);
assert.ok(directorio && ['qa', 'release'].includes(canal), 'Uso: node scripts/verificar-bundle.mjs <directorio> <qa|release>');
const archivos = readdirSync(directorio, { recursive: true }).map(f => path.join(directorio, f));
const mapas = archivos.filter(f => f.endsWith('.map'));
assert.ok(mapas.length, 'Se requiere exportar con --source-maps --no-bytecode');
const fuentes = mapas.flatMap(f => JSON.parse(readFileSync(f, 'utf8')).sources).map(f => f.replaceAll('\\', '/'));
const exclusivos = ['components/consola-qa.tsx', 'lib/diagnostico-qa.ts', 'lib/configuracion-api.ts', 'lib/hora-qa.ts'];
for (const exclusivo of exclusivos) {
  assert.equal(fuentes.some(f => f.endsWith(exclusivo)), canal === 'qa', `${canal}: ${exclusivo}`);
}
if (canal === 'release') {
  assert.ok(fuentes.some(f => f.endsWith('lib/configuracion-api-release.ts')));
  const bundles = archivos.filter(f => f.endsWith('.js'));
  assert.ok(bundles.length);
  for (const bundle of bundles) {
    const contenido = readFileSync(bundle, 'utf8');
    for (const texto of ['Abrir consola QA', 'Consola de pruebas', 'Configurar API de mi computadora']) {
      assert.ok(!contenido.includes(texto), `Interfaz QA encontrada en release: ${texto}`);
    }
  }
}
console.log(`Bundle ${canal}: separación verificada en ${mapas.length} mapa(s) de fuentes.`);
