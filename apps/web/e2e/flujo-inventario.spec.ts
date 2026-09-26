import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de QA ${nombre}.`);
  return valor;
}

const evidencias = path.join(process.cwd(), 'test-results', 'evidencias');

async function captura(page: Page, nombre: string) {
  await mkdir(evidencias, { recursive: true });
  await page.screenshot({
    path: path.join(evidencias, nombre),
    fullPage: true,
  });
}

test('protege el panel cuando no existe una sesion administrativa', async ({ page }) => {
  await page.goto('/panel');

  await expect(page).toHaveURL(/\/acceso\?error=sesion$/);
  await expect(page.getByRole('alert')).toContainText('La sesión terminó o ya no es válida');

  await captura(page, '01-panel-protegido-sin-sesion.png');
});

test('permite al Administrador registrar producto y lote y conserva los datos al recargar', async ({ page }) => {
  const identificador = requerida('QA_ADMIN_IDENTIFICADOR');
  const contrasena = requerida('QA_ADMIN_PASSWORD');

  await page.goto('/acceso');
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await captura(page, '02-acceso-administrativo.png');

  await page.getByLabel('Identificador de acceso').fill(identificador);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Panel de inventario' })).toBeVisible();
  await expect(page.getByText(`${identificador} · Administrador`)).toBeVisible();
  await captura(page, '03-panel-inventario.png');

  await page.getByText('+ Registrar producto').click();
  const formularioProducto = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar producto' }),
  });

  await formularioProducto.getByLabel('Código').fill('QA-WEB-001');
  await formularioProducto.getByLabel('Nombre').fill('Producto QA Playwright');
  await formularioProducto.getByLabel('Familia').fill('Pruebas');
  await formularioProducto.getByLabel('Presentación').fill('Paquete de prueba');
  await formularioProducto.getByLabel('Peso (gramos)').fill('250');
  await formularioProducto.getByLabel('Precio (Bs)').fill('18.50');
  await formularioProducto.getByRole('button', { name: 'Guardar producto' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=producto$/);
  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  await expect(page.getByRole('cell', { name: 'QA-WEB-001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Producto QA Playwright' })).toBeVisible();
  await captura(page, '04-producto-registrado.png');

  await page.getByText('+ Registrar lote e ingreso inicial').click();
  const formularioLote = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar lote e ingreso' }),
  });

  await formularioLote.getByLabel('Producto').selectOption({ label: 'QA-WEB-001 · Producto QA Playwright' });
  await formularioLote.getByLabel('Código de lote').fill('QA-WEB-LOTE-001');
  await formularioLote.getByLabel('Fecha de elaboración').fill('2026-09-20');
  await formularioLote.getByLabel('Fecha de vencimiento').fill('2026-12-20');
  await formularioLote.getByLabel('Cantidad inicial (paquetes)').fill('12');
  await formularioLote.getByRole('button', { name: 'Guardar lote e ingreso' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=lote$/);
  await expect(page.getByRole('status')).toContainText('Lote e ingreso inicial registrados correctamente');
  await expect(page.getByRole('cell', { name: 'QA-WEB-LOTE-001' })).toBeVisible();
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 12')).toBeVisible();
  await captura(page, '05-lote-registrado.png');

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Panel de inventario' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'QA-WEB-001' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'QA-WEB-LOTE-001' })).toBeVisible();
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 12')).toBeVisible();
  await captura(page, '06-persistencia-despues-recarga.png');
});
