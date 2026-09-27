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
  await expect(page.locator('p[role="alert"]')).toContainText('La sesión terminó o ya no es válida');

  await captura(page, '01-panel-protegido-sin-sesion.png');
});

test('permite al Administrador gestionar producto, lote, traslado y condición con persistencia', async ({ page }, testInfo) => {
  const identificador = requerida('QA_ADMIN_IDENTIFICADOR');
  const contrasena = requerida('QA_ADMIN_PASSWORD');
  const productoCodigo = `QA-WEB-001-R${testInfo.retry}`;
  const loteCodigo = `QA-WEB-LOTE-001-R${testInfo.retry}`;

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
  await formularioProducto.getByLabel('Código').fill(productoCodigo);
  await formularioProducto.getByLabel('Nombre').fill('Producto QA Playwright');
  await formularioProducto.getByLabel('Familia').fill('Pruebas');
  await formularioProducto.getByLabel('Presentación').fill('Paquete de prueba');
  await formularioProducto.getByLabel('Peso (gramos)').fill('250');
  await formularioProducto.getByLabel('Precio (Bs)').fill('18.50');
  await formularioProducto.getByRole('button', { name: 'Guardar producto' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=producto$/);
  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  await expect(page.getByRole('cell', { name: productoCodigo })).toBeVisible();
  await captura(page, '04-producto-registrado.png');

  await page.getByText('+ Registrar lote e ingreso inicial').click();
  const formularioLote = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar lote e ingreso' }),
  });
  await formularioLote.getByLabel('Producto').selectOption({ label: `${productoCodigo} · Producto QA Playwright` });
  await formularioLote.getByLabel('Código de lote').fill(loteCodigo);
  await formularioLote.getByLabel('Fecha de elaboración').fill('2026-09-20');
  await formularioLote.getByLabel('Fecha de vencimiento').fill('2026-12-20');
  await formularioLote.getByLabel('Cantidad inicial (paquetes)').fill('12');
  await formularioLote.getByRole('button', { name: 'Guardar lote e ingreso' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=lote$/);
  await expect(page.getByRole('status')).toContainText('Lote e ingreso inicial registrados correctamente');
  await expect(page.getByRole('cell', { name: loteCodigo })).toBeVisible();
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 12')).toBeVisible();
  await captura(page, '05-lote-registrado.png');

  await page.reload();
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 12')).toBeVisible();
  await captura(page, '06-persistencia-despues-recarga.png');

  await page.getByText('+ Registrar traslado').click();
  const formularioTraslado = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar traslado' }),
  });
  await formularioTraslado.getByLabel('Lote a trasladar').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await formularioTraslado.getByLabel('Origen').selectOption('PRODUCCION_ALMACENAMIENTO');
  await formularioTraslado.getByLabel('Destino').selectOption('VENTA_DESPACHO');
  await formularioTraslado.getByLabel('Cantidad a trasladar').fill('5');
  await formularioTraslado.getByLabel('Referencia (opcional)').fill('QA-WEB-TR-001');
  await formularioTraslado.getByRole('button', { name: 'Guardar traslado' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=traslado&historialLoteId=[0-9a-f-]+#movimientos$/);
  await expect(page.getByRole('status')).toContainText('Traslado registrado correctamente');
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 7 · VENTA_DESPACHO: 5')).toBeVisible();
  const filaTraslado = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'TRASLADO' }) });
  await expect(filaTraslado).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Produccion y Almacenamiento' })).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Venta y Despacho' })).toBeVisible();
  await captura(page, '07-traslado-registrado.png');

  await page.reload();
  await expect(page.getByText('PRODUCCION_ALMACENAMIENTO: 7 · VENTA_DESPACHO: 5')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'TRASLADO' })).toBeVisible();
  await captura(page, '08-traslado-persistente.png');

  await page.getByText('+ Cambiar condición del lote').click();
  const formularioCondicion = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar condición' }),
  });
  await formularioCondicion.getByLabel('Lote').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await formularioCondicion.getByLabel('Acción').selectOption('liberar');
  await formularioCondicion.getByLabel('Motivo').fill('QA: revisión interna completada');
  await formularioCondicion.getByRole('button', { name: 'Guardar condición' }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=condicion&historialCondicionLoteId=[0-9a-f-]+#condiciones$/);
  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  const filaLoteLiberado = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) }).first();
  await expect(filaLoteLiberado.getByText('LIBERADO')).toBeVisible();
  const filaLiberacion = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'QA: revisión interna completada' }) });
  await expect(filaLiberacion.getByRole('cell', { name: 'RETENIDO' })).toBeVisible();
  await expect(filaLiberacion.getByRole('cell', { name: 'LIBERADO' })).toBeVisible();
  await captura(page, '09-lote-liberado.png');

  await page.getByText('+ Cambiar condición del lote').click();
  const formularioBloqueo = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Guardar condición' }),
  });
  await formularioBloqueo.getByLabel('Lote').selectOption({ label: `${loteCodigo} · LIBERADO` });
  await formularioBloqueo.getByLabel('Acción').selectOption('bloquear');
  await formularioBloqueo.getByLabel('Motivo').fill('QA: observación temporal');
  await formularioBloqueo.getByRole('button', { name: 'Guardar condición' }).click();

  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  const filaLoteBloqueado = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) }).first();
  await expect(filaLoteBloqueado.getByText('BLOQUEADO')).toBeVisible();
  const filaBloqueo = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'QA: observación temporal' }) });
  await expect(filaBloqueo.getByRole('cell', { name: 'LIBERADO' })).toBeVisible();
  await expect(filaBloqueo.getByRole('cell', { name: 'BLOQUEADO' })).toBeVisible();
  await captura(page, '10-lote-bloqueado.png');

  await page.reload();
  await expect(filaLoteBloqueado.getByText('BLOQUEADO')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'QA: observación temporal' })).toBeVisible();
});
