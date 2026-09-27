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

test('muestra una portada profesional y protege el panel sin sesion', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Control de inventario con trazabilidad clara/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Acceso privado/ })).toBeVisible();
  await expect(page.getByText('Inventario centralizado')).toBeVisible();
  await captura(page, '01-inicio-redisenado.png');

  await page.goto('/panel');
  await expect(page).toHaveURL(/\/acceso\?error=sesion$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await expect(page.locator('.mensaje-error[role="alert"]')).toContainText('La sesión terminó o ya no es válida');
  await captura(page, '02-acceso-protegido-redisenado.png');
});

test('permite gestionar inventario desde módulos, modales y notificaciones', async ({ page }, testInfo) => {
  const identificador = requerida('QA_ADMIN_IDENTIFICADOR');
  const contrasena = requerida('QA_ADMIN_PASSWORD');
  const productoCodigo = `QA-UI-001-R${testInfo.retry}`;
  const loteCodigo = `QA-UI-LOTE-001-R${testInfo.retry}`;

  await page.goto('/acceso');
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await page.getByLabel('Identificador de acceso').fill(identificador);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible();
  await expect(page.getByText('Trabaja por módulo')).toBeVisible();
  await expect(page.getByText('Distribución actual')).toBeVisible();
  await captura(page, '03-dashboard-administrativo.png');

  await page.getByRole('link', { name: 'Productos terminados' }).click();
  await expect(page).toHaveURL(/\/panel\?vista=productos$/);
  await expect(page.getByRole('heading', { name: 'Productos terminados' })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const modalProducto = page.getByRole('dialog');
  await expect(modalProducto.getByRole('heading', { name: 'Registrar producto' })).toBeVisible();
  await captura(page, '04-modal-producto.png');

  await modalProducto.getByLabel('Código').fill(productoCodigo);
  await modalProducto.getByLabel('Nombre').fill('Producto QA UI');
  await modalProducto.getByLabel('Familia').fill('Pruebas');
  await modalProducto.getByLabel('Presentación').fill('Paquete de prueba');
  await modalProducto.getByLabel('Peso (gramos)').fill('250');
  await modalProducto.getByLabel('Precio (Bs)').fill('18.50');
  await modalProducto.getByRole('button', { name: 'Guardar producto' }).click();

  await expect(page).toHaveURL(/\/panel\?vista=productos&mensaje=producto$/);
  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  await expect(page.getByRole('cell', { name: productoCodigo })).toBeVisible();
  await captura(page, '05-producto-registrado.png');

  await page.getByRole('link', { name: 'Lotes y existencias' }).click();
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  const modalLote = page.getByRole('dialog');
  await modalLote.getByLabel('Producto').selectOption({ label: `${productoCodigo} · Producto QA UI` });
  await modalLote.getByLabel('Código de lote').fill(loteCodigo);
  await modalLote.getByLabel('Fecha de elaboración').fill('2026-09-20');
  await modalLote.getByLabel('Fecha de vencimiento').fill('2026-12-20');
  await modalLote.getByLabel('Cantidad inicial').fill('12');
  await modalLote.getByRole('button', { name: 'Guardar lote e ingreso' }).click();

  await expect(page).toHaveURL(/\/panel\?vista=lotes&mensaje=lote$/);
  await expect(page.getByRole('status')).toContainText('Lote e ingreso inicial registrados correctamente');
  const filaLote = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) });
  await expect(filaLote.getByText('RETENIDO')).toBeVisible();
  await expect(filaLote.getByText('PRODUCCION_ALMACENAMIENTO')).toBeVisible();
  await captura(page, '06-lote-registrado.png');

  await page.getByRole('link', { name: 'Movimientos' }).click();
  await page.getByRole('button', { name: 'Nuevo traslado' }).click();
  const modalTraslado = page.getByRole('dialog');
  await modalTraslado.getByLabel('Lote a trasladar').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await modalTraslado.getByLabel('Cantidad').fill('5');
  await modalTraslado.getByLabel('Origen').selectOption('PRODUCCION_ALMACENAMIENTO');
  await modalTraslado.getByLabel('Destino').selectOption('VENTA_DESPACHO');
  await modalTraslado.getByLabel(/Referencia/).fill('QA-UI-TR-001');
  await modalTraslado.getByRole('button', { name: 'Guardar traslado' }).click();

  await expect(page).toHaveURL(/\/panel\?vista=movimientos&mensaje=traslado&historialLoteId=[0-9a-f-]+$/);
  await expect(page.getByRole('status')).toContainText('Traslado registrado correctamente');
  const filaTraslado = page.getByRole('row')
    .filter({ has: page.getByRole('cell', { name: loteCodigo }) })
    .filter({ has: page.getByRole('cell', { name: 'TRASLADO' }) });
  await expect(filaTraslado).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Produccion y Almacenamiento' })).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Venta y Despacho' })).toBeVisible();
  await captura(page, '07-traslado-registrado.png');

  await page.getByRole('link', { name: 'Lotes y existencias' }).click();
  const filaLoteTrasladado = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) });
  await expect(filaLoteTrasladado.getByText('PRODUCCION_ALMACENAMIENTO')).toBeVisible();
  await expect(filaLoteTrasladado.getByText('7', { exact: true })).toBeVisible();
  await expect(filaLoteTrasladado.getByText('VENTA_DESPACHO')).toBeVisible();
  await expect(filaLoteTrasladado.getByText('5', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Condición de lotes' }).click();
  await page.getByRole('button', { name: 'Gestionar condición' }).click();
  const modalCondicion = page.getByRole('dialog');
  await modalCondicion.getByLabel('Lote').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await modalCondicion.getByLabel('Acción').selectOption('liberar');
  await modalCondicion.getByLabel('Motivo').fill('QA UI: revisión completada');
  await modalCondicion.getByRole('button', { name: 'Guardar condición' }).click();

  await expect(page).toHaveURL(/\/panel\?vista=condiciones&mensaje=condicion&historialCondicionLoteId=[0-9a-f-]+$/);
  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  const filaCondicion = page.locator('.condicion-fila').filter({ hasText: loteCodigo });
  await expect(filaCondicion.getByText('LIBERADO')).toBeVisible();
  await expect(page.getByText('QA UI: revisión completada')).toBeVisible();
  await captura(page, '08-lote-liberado.png');

  await page.getByRole('button', { name: 'Gestionar condición' }).click();
  const modalBloqueo = page.getByRole('dialog');
  await modalBloqueo.getByLabel('Lote').selectOption({ label: `${loteCodigo} · LIBERADO` });
  await modalBloqueo.getByLabel('Acción').selectOption('bloquear');
  await modalBloqueo.getByLabel('Motivo').fill('QA UI: observación temporal');
  await modalBloqueo.getByRole('button', { name: 'Guardar condición' }).click();

  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  await expect(page.locator('.condicion-fila').filter({ hasText: loteCodigo }).getByText('BLOQUEADO')).toBeVisible();
  await expect(page.getByText('QA UI: observación temporal')).toBeVisible();
  await captura(page, '09-lote-bloqueado.png');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Condición de lotes' })).toBeVisible();
  await expect(page.locator('.condicion-fila').filter({ hasText: loteCodigo }).getByText('BLOQUEADO')).toBeVisible();
  await expect(page.getByText('QA UI: observación temporal')).toBeVisible();
  await captura(page, '10-condicion-persistente.png');

  await page.getByRole('link', { name: 'Resumen general' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible();
  await expect(page.getByText('Trabaja por módulo')).toBeVisible();
  await captura(page, '11-dashboard-final.png');
});
