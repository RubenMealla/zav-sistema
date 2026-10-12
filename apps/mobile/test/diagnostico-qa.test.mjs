import './soporte.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'qa';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:3001';
const config = await import('../src/lib/configuracion-api.ts');
const diagnostico = await import('../src/lib/diagnostico-qa.ts');

test('QA rechaza producción, credenciales y HTTP público; persiste únicamente destinos válidos', async () => {
  for (const valor of ['https://zav-api-2026.onrender.com', 'https://ZAV-API-2026.ONRENDER.COM.',
    'https://usuario:secreto@example.test', 'http://8.8.8.8:3001', 'http://192.168.1.2:3001/api/v1',
    'http://192.168.1.2:3001?token=privado']) {
    assert.throws(() => config.validarDireccionApi(valor));
  }
  await config.configurarDireccionApi('http://192.168.1.2:3001/');
  assert.equal(await config.cargarDireccionApi(), 'http://192.168.1.2:3001');
});

test('el diagnóstico limita memoria y oculta consultas, fragmentos, UUID y texto privado', () => {
  diagnostico.limpiarSolicitudesQa();
  let notificaciones = 0;
  const cancelar = diagnostico.suscribirSolicitudesQa(() => notificaciones++);
  for (let i = 0; i < 81; i++) {
    diagnostico.registrarSolicitudQa({ metodo: 'GET', ruta: '/api/v1/clientes/privado%40correo.test?token=secreto#privado',
      codigo: 0, duracionMs: 10.5, correcta: false });
  }
  const registros = diagnostico.obtenerSolicitudesQa();
  assert.equal(registros.length, 80);
  assert.equal(notificaciones, 81);
  assert.equal(registros[0].ruta, '/api/v1/clientes/:id');
  assert.match(registros[0].momento, /Z$/);
  assert.equal(registros[0].duracionMs, 11);
  assert.doesNotMatch(JSON.stringify(registros), /secreto|privado|correo/);
  cancelar();
  diagnostico.limpiarSolicitudesQa();
  assert.equal(notificaciones, 81);
  assert.equal(diagnostico.obtenerSolicitudesQa().length, 0);
});
