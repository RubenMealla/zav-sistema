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
  await page.screenshot({
    path: path.join(DIR, 'WEB-15-confirmacion-producto.png'),
    fullPage: true,
  });
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
  await page.screenshot({
    path: path.join(DIR, 'WEB-16-confirmacion-traslado.png'),
    fullPage: true,
  });
  await confirmar.getByRole('button', { name: 'Sí, registrar traslado', exact: true }).click();

  const alerta = page.locator('[role="alert"], [role="status"]').filter({ hasText: /409|saldo|existencia/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(DIR, 'WEB-14-error-traslado-409.png'),
    fullPage: true,
  });
});


test('muestra en la web un 400 devuelto por la API para datos inválidos', async ({ page }) => {
  await mkdir(DIR, { recursive: true });

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await expect(page).toHaveURL(/\/panel/);

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();

  const modal = page.getByRole('dialog', { name: 'Registrar producto' });
  await modal.getByLabel('Familia').fill('QA validación');
  const codigo = modal.getByLabel('Código');
  await codigo.evaluate((elemento) => {
    const input = elemento as HTMLInputElement;
    input.removeAttribute('pattern');
    input.removeAttribute('minlength');
  });
  await codigo.fill('!');
  await modal.getByLabel('Nombre comercial').fill('Producto inválido QA');
  await modal.getByLabel('Presentación').fill('Unidad de prueba');
  await modal.getByLabel('Peso (gramos)').fill('250');
  await modal.getByLabel('Precio (Bs)').fill('10.00');

  await modal.getByRole('button', { name: 'Guardar producto' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(confirmacion).toBeVisible();
  await confirmacion.getByRole('button', { name: 'Sí, registrar producto', exact: true }).click();

  const alerta = page.getByRole('alert').filter({ hasText: /HTTP 400|datos incompletos|inválidos|codigo debe/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await expect(alerta).toContainText('HTTP 400');
  await page.screenshot({
    path: path.join(DIR, 'WEB-20-error-validacion-400.png'),
    fullPage: true,
  });
});


test('muestra en la web un 400 al registrar un lote con fecha inválida', async ({ page, request }) => {
  await mkdir(DIR, { recursive: true });
  const admin = await tokenAdmin(request);
  const codigoProducto = `QA-LOTE-ERR-${Date.now()}`;

  const producto = await request.post(`${API}/api/v1/productos`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      codigo: codigoProducto,
      nombre: 'Producto para validación de lote',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 12,
    },
  });
  expect(producto.status()).toBe(201);

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo lote' }).click();

  const modal = page.getByRole('dialog', { name: 'Registrar lote e ingreso inicial' });
  const selectorProducto = modal.getByLabel('Producto');
  const opcionProducto = selectorProducto.locator('option').filter({ hasText: codigoProducto }).first();
  await expect(opcionProducto).toHaveCount(1);
  const valorProducto = await opcionProducto.getAttribute('value');
  expect(valorProducto).toBeTruthy();
  await selectorProducto.selectOption(valorProducto!);
  const elaborado = modal.getByLabel('Fecha de elaboración');
  await elaborado.evaluate((elemento) => (elemento as HTMLInputElement).removeAttribute('max'));
  await elaborado.fill('2026-10-08');
  await modal.getByLabel('Fecha de vencimiento').fill('2026-12-31');
  await modal.getByLabel('Cantidad inicial').fill('2');

  await modal.getByRole('button', { name: 'Guardar lote e ingreso' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(confirmacion).toBeVisible();
  await confirmacion.getByRole('button', { name: 'Sí, registrar lote', exact: true }).click();

  const alerta = page.getByRole('alert').filter({ hasText: /HTTP 400|fecha|inválidos|elaboradoEl/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await expect(alerta).toContainText('HTTP 400');
  await page.screenshot({
    path: path.join(DIR, 'WEB-21-error-lote-fecha-400.png'),
    fullPage: true,
  });
});

test('muestra en la web un 409 al intentar liberar un lote ya liberado', async ({ page, request }) => {
  await mkdir(DIR, { recursive: true });
  const admin = await tokenAdmin(request);
  const codigoProducto = `QA-COND-${Date.now()}`;

  const producto = await request.post(`${API}/api/v1/productos`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      codigo: codigoProducto,
      nombre: 'Producto para condición repetida',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 12,
    },
  });
  expect(producto.status()).toBe(201);
  const productoBody = await producto.json();

  const loteCodigo = `LOTE-${codigoProducto}`;
  const lote = await request.post(`${API}/api/v1/lotes`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      operacionClave: crypto.randomUUID(),
      productoId: productoBody.id,
      codigo: loteCodigo,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 5,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    },
  });
  expect(lote.status()).toBe(201);
  const loteBody = await lote.json();

  const liberacion = await request.post(`${API}/api/v1/lotes/${loteBody.id}/liberar`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: {
      operacionClave: crypto.randomUUID(),
      motivo: 'Liberación inicial para prueba',
    },
  });
  expect(liberacion.status()).toBe(201);

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Gestionar condición' }).click();

  const modal = page.getByRole('dialog', { name: 'Gestionar condición' });
  const selectorLote = modal.locator('select[name="loteId"]');
  const opcionLote = selectorLote.locator('option').filter({ hasText: loteCodigo }).first();
  await expect(opcionLote).toHaveCount(1);
  const valor = await opcionLote.getAttribute('value');
  expect(valor).toBeTruthy();
  await selectorLote.selectOption(valor!);
  await modal.locator('select[name="accion"]').selectOption('liberar');
  await modal.locator('input[name="motivo"]').fill('Intento repetido de liberación');

  await modal.getByRole('button', { name: 'Guardar condición' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(confirmacion).toBeVisible();
  await confirmacion.getByRole('button', { name: 'Sí, guardar condición', exact: true }).click();

  const alerta = page.getByRole('alert').filter({ hasText: /HTTP 409|ya se encuentra liberado|condición/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await expect(alerta).toContainText('HTTP 409');
  await page.screenshot({
    path: path.join(DIR, 'WEB-22-error-condicion-409.png'),
    fullPage: true,
  });
});


test('muestra 403 en la web cuando el Vendedor intenta entrar al panel administrativo', async ({ page }) => {
  await mkdir(DIR, { recursive: true });

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_VENDEDOR_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_VENDEDOR_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();

  await expect(page).toHaveURL(/\/acceso\?error=permisos&codigo=403/);
  const alerta = page.getByRole('alert').filter({ hasText: /HTTP 403|permiso|Administrador/i }).first();
  await expect(alerta).toBeVisible({ timeout: 10000 });
  await expect(alerta).toContainText('HTTP 403');
  await page.screenshot({
    path: path.join(DIR, 'WEB-23-vendedor-web-403.png'),
    fullPage: true,
  });
});
