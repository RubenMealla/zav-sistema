import { expect, test } from '@playwright/test';

test('geografía web rechaza cookies inventadas antes de consultar proveedores', async ({ request }) => {
  const sinSesion = await request.get('/api/geografia/autocompletar?q=Tarija');
  expect(sinSesion.status()).toBe(401);
  const falsa = await request.get('/api/geografia/autocompletar?q=Tarija', {
    headers: { Cookie: 'zav_acceso=token-inventado' },
  });
  expect(falsa.status()).toBe(401);
});

test('geografía administrativa no admite el token del Vendedor', async ({ request }) => {
  const sesion = await request.post('http://127.0.0.1:3001/api/v1/auth/login', {
    data: { identificador: process.env.QA_VENDEDOR_IDENTIFICADOR, contrasena: process.env.QA_VENDEDOR_PASSWORD },
  });
  expect(sesion.status()).toBe(200);
  const { accessToken } = await sesion.json();
  const respuesta = await request.get('/api/geografia/autocompletar?q=Tarija', {
    headers: { Cookie: `zav_acceso=${accessToken}` },
  });
  expect(respuesta.status()).toBe(403);
});
