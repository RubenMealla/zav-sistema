import { expect, test, type APIRequestContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  return valor;
}

const DIR = path.join(process.cwd(), 'test-results', 'evidencias-web-documento');
const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';

async function tokenAdmin(request: APIRequestContext) {
  const r = await request.post(`${API}/api/v1/auth/login`, {
    data: {
      identificador: requerida('QA_ADMIN_IDENTIFICADOR'),
      contrasena: requerida('QA_ADMIN_PASSWORD'),
    },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

test('captura un producto registrado sin datos de otras pruebas', async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  const codigo = `QA-DOC-${Date.now()}`;

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await expect(page).toHaveURL(/\/panel/);

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();

  const modal = page.getByRole('dialog');
  await modal.getByLabel('Familia').fill('Fiambres');
  await modal.getByLabel('Código').fill(codigo);
  await modal.getByLabel('Nombre').fill('Producto de prueba QA');
  await modal.getByLabel('Presentación').fill('Unidad de prueba');
  await modal.getByLabel('Peso (gramos)').fill('250');
  await modal.getByLabel('Precio (Bs)').fill('19.50');
  await modal.getByRole('button', { name: 'Guardar producto' }).click();

  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Sí, registrar producto', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  const buscar = page.getByPlaceholder('Código o nombre del producto');
  await buscar.fill(codigo);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('cell', { name: codigo })).toBeVisible();

  await page.screenshot({
    path: path.join(DIR, 'WEB-13-producto-registrado-limpio.png'),
    fullPage: true,
  });
});

test('captura el manejo visible de un traslado sin saldo suficiente', async ({ page, request }) => {
  await mkdir(DIR, { recursive: true });
  const admin = await tokenAdmin(request);
  const codigo = `QA-SALDO-${Date.now()}`;
  const producto = await request.post(`${API}/api/v1/productos`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      codigo,
      nombre: 'Producto para error de saldo',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 12,
    },
  });
  expect(producto.status()).toBe(201);
  const productoBody = await producto.json();
  const loteCodigo = `LOTE-${codigo}`;
  const lote = await request.post(`${API}/api/v1/lotes`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      operacionClave: crypto.randomUUID(),
      productoId: productoBody.id,
      codigo: loteCodigo,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 3,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    },
  });
  expect(lote.status()).toBe(201);

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await expect(page).toHaveURL(/\/panel/);

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo traslado' }).click();
  const modal = page.getByRole('dialog');
  const selectorLote = modal.getByLabel('Lote a trasladar');
  const opcionLote = selectorLote.locator('option').filter({ hasText: loteCodigo }).first();
  await expect(opcionLote).toHaveCount(1);
  const valorLote = await opcionLote.getAttribute('value');
  expect(valorLote).toBeTruthy();
  await selectorLote.selectOption(valorLote!);
  await modal.getByLabel('Cantidad').fill('999');
  await modal.getByLabel('Origen').selectOption('PRODUCCION_ALMACENAMIENTO');
  await modal.getByLabel('Destino').selectOption('VENTA_DESPACHO');
  await modal.getByLabel(/Referencia/).fill('QA-SALDO-INSUFICIENTE');
  await modal.getByRole('button', { name: 'Guardar traslado' }).click();

  const confirmar = page.getByRole('alertdialog');
  await expect(confirmar).toBeVisible();
  await confirmar.getByRole('button', { name: 'Sí, registrar traslado', exact: true }).click();

  const alerta = page.locator('[role="alert"], [role="status"]').filter({ hasText: /409|saldo|existencia/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(DIR, 'WEB-14-error-traslado-409.png'),
    fullPage: true,
  });
});
