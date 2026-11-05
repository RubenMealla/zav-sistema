import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8'));
const version = leer('package.json').version;
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.[1-9]\d*)?$/, 'Usar MAYOR.MENOR.PARCHE o una candidata -rc.N');
for (const app of ['api', 'web', 'mobile']) {
  assert.equal(leer(`apps/${app}/package.json`).version, version, `Versión incoherente en ${app}`);
}
const config = leer('apps/mobile/app.json').expo;
assert.equal(config.version, version);
assert.ok(Number.isSafeInteger(config.android.versionCode) && config.android.versionCode > 0);
assert.equal(config.ios.buildNumber, String(config.android.versionCode));
for (const ruta of ['docs/api/openapi-e3.yaml', 'apps/web/public/openapi-zav.yaml']) {
  const contenido = readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
  assert.equal(/^  version: (.+)$/m.exec(contenido)?.[1], version, `Contrato desactualizado: ${ruta}`);
}
if (process.argv.includes('--estable')) assert.ok(!version.includes('-'), 'La publicación estable no admite sufijos de prueba');
console.log(`ZAV ${version}; Android/iOS build ${config.android.versionCode}; versiones coherentes.`);
