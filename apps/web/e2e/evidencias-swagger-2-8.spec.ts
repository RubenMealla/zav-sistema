import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const DIR = path.join(process.cwd(), 'test-results', 'evidencias-swagger');

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  return valor;
}

async function token(request: APIRequestContext, rol: 'admin' | 'vendedor') {
  const identificador = rol === 'admin'
    ? requerida('QA_ADMIN_IDENTIFICADOR')
    : requerida('QA_VENDEDOR_IDENTIFICADOR');
  const contrasena = rol === 'admin'
    ? requerida('QA_ADMIN_PASSWORD')
    : requerida('QA_VENDEDOR_PASSWORD');

  const respuesta = await request.post(`${API}/api/v1/auth/login`, {
    data: { identificador, contrasena },
  });
  expect(respuesta.status()).toBe(200);
  return (await respuesta.json()).accessToken as string;
}

function operacion(page: Page, metodo: string, ruta: string): Locator {
  return page.locator('.opblock').filter({ hasText: ruta }).filter({ hasText: metodo }).first();
}

async function abrir(page: Page, metodo: string, ruta: string) {
  const op = operacion(page, metodo, ruta);
  await expect(op).toBeVisible();
  const cuerpo = op.locator('.opblock-body');
  if (!(await cuerpo.isVisible().catch(() => false))) {
    await op.locator('.opblock-summary').click();
  }
  await expect(op.locator('.opblock-body')).toBeVisible();
  return op;
}

async function probar(op: Locator) {
  const boton = op.getByRole('button', { name: /Try it out/i });
  if (await boton.count()) await boton.click();
}

async function ejecutar(op: Locator) {
  await op.getByRole('button', { name: /^Execute$/i }).click();
}

async function esperarCodigo(op: Locator, codigo: string) {
  await expect(op.locator('.response-col_status').filter({ hasText: codigo }).first()).toBeVisible({
    timeout: 15000,
  });
}

async function capturar(op: Locator, nombre: string) {
  await mkdir(DIR, { recursive: true });
  await op.screenshot({ path: path.join(DIR, nombre) });
}

async function autorizar(page: Page, jwt: string) {
  const abrirModal = page.locator('.scheme-container .btn.authorize').first();
  await abrirModal.scrollIntoViewIfNeeded();
  await abrirModal.click();
  const modal = page.locator('.modal-ux');
  await expect(modal).toBeVisible();
  const entrada = modal.locator('input').first();
  await entrada.fill(jwt);
  const boton = modal.getByRole('button', { name: /^Authorize$/i }).last();
  await boton.click();
  const cerrar = modal.getByRole('button', { name: /Close/i });
  if (await cerrar.count()) await cerrar.click();
  else await modal.locator('button.modal-ux-close').click();
  await expect(modal).toBeHidden();
}

async function desautorizar(page: Page) {
  const abrirModal = page.locator('.scheme-container .btn.authorize').first();
  await abrirModal.scrollIntoViewIfNeeded();
  await abrirModal.click();
  const modal = page.locator('.modal-ux');
  await expect(modal).toBeVisible();
  const logout = modal.getByRole('button', { name: /Logout/i });
  if (await logout.count()) await logout.click();
  const cerrar = modal.getByRole('button', { name: /Close/i });
  if (await cerrar.count()) await cerrar.click();
  else await modal.locator('button.modal-ux-close').click();
}

test.describe.serial('Evidencias reales Swagger del apartado 2.8', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swagger');
    await expect(page.getByText('ZAV · Swagger API')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ZAV API' })).toBeVisible({ timeout: 15000 });
  });

  test('documentación y HTTP 200', async ({ page }) => {
    await mkdir(DIR, { recursive: true });
    await page.screenshot({ path: path.join(DIR, 'swagger-01-documentacion.png'), fullPage: false });

    const op = await abrir(page, 'GET', '/api/v1/salud');
    await probar(op);
    await ejecutar(op);
    await esperarCodigo(op, '200');
    await capturar(op, 'swagger-02-salud-200.png');
  });

  test('HTTP 400 y 401 visibles en Swagger', async ({ page }) => {
    const login400 = await abrir(page, 'POST', '/api/v1/auth/login');
    await probar(login400);
    const body400 = login400.locator('textarea').first();
    await body400.fill(JSON.stringify({ identificador: '' }, null, 2));
    await ejecutar(login400);
    await esperarCodigo(login400, '400');
    await capturar(login400, 'swagger-03-login-400.png');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'ZAV API' })).toBeVisible({ timeout: 15000 });
    const login401 = await abrir(page, 'POST', '/api/v1/auth/login');
    await probar(login401);
    const body401 = login401.locator('textarea').first();
    await body401.fill(JSON.stringify({
      identificador: 'usuario.invalido@zav.test',
      contrasena: 'incorrecta',
    }, null, 2));
    await ejecutar(login401);
    await esperarCodigo(login401, '401');
    await capturar(login401, 'swagger-04-login-401.png');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'ZAV API' })).toBeVisible({ timeout: 15000 });
    const productos401 = await abrir(page, 'GET', '/api/v1/productos');
    await probar(productos401);
    await ejecutar(productos401);
    await esperarCodigo(productos401, '401');
    await capturar(productos401, 'swagger-05-productos-401.png');
  });

  test('HTTP 403 y 409 visibles en Swagger', async ({ page, request }) => {
    const admin = await token(request, 'admin');

    const codigo = `SWAGGER-QA-${Date.now()}`;
    const creado = await request.post(`${API}/api/v1/productos`, {
      headers: { Authorization: `Bearer ${admin}` },
      data: {
        codigo,
        nombre: 'Producto sintético Swagger',
        familia: 'QA',
        presentacion: 'Unidad',
        pesoGramos: 250,
        precioBob: 10,
      },
    });
    expect(creado.status()).toBe(201);

    await autorizar(page, admin);

    const cliente403 = await abrir(page, 'POST', '/api/v1/clientes');
    await probar(cliente403);
    await ejecutar(cliente403);
    await esperarCodigo(cliente403, '403');
    await capturar(cliente403, 'swagger-06-clientes-403.png');

    const producto409 = await abrir(page, 'POST', '/api/v1/productos');
    await probar(producto409);
    const body409 = producto409.locator('textarea').first();
    await body409.fill(JSON.stringify({
      codigo,
      nombre: 'Producto duplicado Swagger',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 10,
    }, null, 2));
    await ejecutar(producto409);
    await esperarCodigo(producto409, '409');
    await capturar(producto409, 'swagger-07-producto-409.png');
  });

  test('HTTP 404 y 503 visibles en Swagger', async ({ page, request }) => {
    const vendedor = await token(request, 'vendedor');
    await autorizar(page, vendedor);

    const cliente404 = await abrir(page, 'GET', '/api/v1/clientes/{id}');
    await probar(cliente404);
    await cliente404.locator('input').first().fill('00000000-0000-4000-8000-000000000404');
    await ejecutar(cliente404);
    await esperarCodigo(cliente404, '404');
    await capturar(cliente404, 'swagger-08-cliente-404.png');

    const geo503 = await abrir(page, 'GET', '/api/v1/geografia/geocodificar');
    await probar(geo503);
    await geo503.locator('input').first().fill('Tarija');
    await ejecutar(geo503);
    await esperarCodigo(geo503, '503');
    await capturar(geo503, 'swagger-09-geografia-503.png');

    await desautorizar(page);
  });
});
