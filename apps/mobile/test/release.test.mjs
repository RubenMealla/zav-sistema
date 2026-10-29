import './soporte.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'release';
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.release.test';
const config = await import('../src/lib/configuracion-api-release.ts');
const require = createRequire(import.meta.url);
const directorio = fileURLToPath(new URL('../', import.meta.url));

test('release conserva su API de compilación e impide cambiarla', async () => {
  await assert.rejects(config.configurarDireccionApi('http://192.168.1.2:3001'));
  assert.equal(config.ES_COMPILACION_QA, false);
  assert.equal(await config.cargarDireccionApi(), 'https://api.release.test');
  assert.equal(config.obtenerDireccionApi(), 'https://api.release.test');
});

test('Metro excluye consola, registro y configuración QA del grafo release', () => {
  const metro = require('../metro.config.js');
  const casos = [
    ['src/components/consola-qa.tsx', 'src/lib/qa-desactivado.ts'],
    ['src/lib/diagnostico-qa.ts', 'src/lib/qa-desactivado.ts'],
    ['src/lib/configuracion-api.ts', 'src/lib/configuracion-api-release.ts'],
    ['src/lib/api.ts', 'src/lib/api.ts'],
  ];
  for (const [origen, destino] of casos) {
    const context = { resolveRequest: () => ({ type: 'sourceFile', filePath: path.resolve(directorio, origen) }) };
    const resultado = metro.resolver.resolveRequest(context, origen, 'android');
    assert.equal(resultado.filePath, path.resolve(directorio, destino));
  }
  const rutaMetro = require.resolve('../metro.config.js');
  process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'qa';
  delete require.cache[rutaMetro];
  const qa = require(rutaMetro);
  assert.notEqual(qa.cacheVersion, metro.cacheVersion, 'QA y release no comparten transformaciones');
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.30:3001';
  delete require.cache[rutaMetro];
  assert.notEqual(require(rutaMetro).cacheVersion, qa.cacheVersion, 'Cambiar la API invalida el código anterior');
  process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'release';
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.release.test';
  delete require.cache[rutaMetro];
});

test('configuración Expo mantiene nombres, paquetes, versión y permisos separados', () => {
  const ruta = require.resolve('../app.config.js');
  const original = require('../app.json').expo;
  for (const canal of ['qa', 'release']) {
    process.env.EXPO_PUBLIC_BUILD_CHANNEL = canal;
    delete require.cache[ruta];
    const resultado = require(ruta)({ config: original });
    assert.equal(resultado.name, canal === 'qa' ? 'ZAV Vendedor QA' : 'ZAV Vendedor');
    assert.equal(resultado.android.package, 'bo.zav.gestion.vendedor' + (canal === 'qa' ? '.qa' : ''));
    assert.equal(resultado.plugins.includes('./plugins/with-qa-local-network'), canal === 'qa');
    assert.equal(resultado.version, '1.1.0');
    assert.equal(resultado.android.versionCode, 10100);
  }
});
