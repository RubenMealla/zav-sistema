import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de QA ${nombre}.`);
  return valor;
}

const evidencias = path.join(process.cwd(), 'test-results', 'evidencias');

function fechaBolivia(dias = 0) {
  const ahora = new Date(Date.now() + dias * 86400000);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}

async function confirmar(page: Page, boton: string) {
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: boton, exact: true }).click();
}

async function captura(page: Page, nombre: string) {
  await mkdir(evidencias, { recursive: true });
  await expect.poll(() => page.locator('img:visible').evaluateAll((imgs) => imgs.every((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0))).toBeTruthy();
  await page.screenshot({
    path: path.join(evidencias, nombre),
    fullPage: true,
  });
}

test('muestra una portada profesional y protege el panel sin sesion', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Fiambres y embutidos ZAV/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Acceso interno/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Siete familias de productos ZAV.' })).toBeVisible();
  await captura(page, '01-inicio-redisenado.png');

  await page.goto('/panel');
  await expect(page).toHaveURL(/\/acceso\?error=sesion&codigo=401$/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.locator('.mensaje-error[role="alert"]')).toContainText('HTTP 401');
  await expect(page.locator('.mensaje-error[role="alert"]')).toContainText('La sesión terminó o ya no es válida');
  await captura(page, '02-acceso-protegido-redisenado.png');
});

test('permite gestionar inventario desde módulos, modales y notificaciones', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const identificador = requerida('QA_ADMIN_IDENTIFICADOR');
  const contrasena = requerida('QA_ADMIN_PASSWORD');
  const ejecucion = `${Date.now()}-${testInfo.retry}`;
  const productoCodigo = `QA-UI-${ejecucion}`;
  const loteCodigo = `QA-LOTE-${ejecucion}`;

  await page.goto('/acceso');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByLabel('Identificador', { exact: true }).fill(identificador);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();

  await expect(page).toHaveURL(/\/panel\?mensaje=sesion-iniciada$/);
  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Trabaja por módulo')).toBeVisible();
  await expect(page.getByText('Condición actual')).toBeVisible();
  await captura(page, '03-dashboard-administrativo.png');
  await expect(page.getByText(/Lotes consultados:/)).toBeVisible();

  await modulos.getByRole('link', { name: 'Productos', exact: true }).click();
  await expect(page).toHaveURL(/\/panel\?vista=productos$/);
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Productos registrados' })).toBeVisible();
  await captura(page, 'identidad-productos-listado.png');

  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const modalProducto = page.getByRole('dialog');
  await expect(modalProducto.getByRole('heading', { name: 'Registrar producto' })).toBeVisible();
  await expect(modalProducto).toHaveAccessibleName('Registrar producto');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeFocused();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await captura(page, '04-modal-producto.png');

  const codigoProductoCampo = modalProducto.getByLabel('Código');
  await modalProducto.getByLabel('Familia').fill('Salchichas');
  await expect(codigoProductoCampo).toHaveValue(/^SAL-\d{3,}$/);
  await codigoProductoCampo.fill(productoCodigo);
  await modalProducto.getByLabel('Nombre').fill('Producto QA UI');
  await modalProducto.getByLabel('Presentación').fill('Paquete de prueba');
  await modalProducto.getByLabel('Peso (gramos)').fill('250');
  await modalProducto.getByLabel('Precio (Bs)').fill('18.50');
  await modalProducto.getByRole('button', { name: 'Guardar producto' }).click();
  await confirmar(page, 'Sí, registrar producto');

  await expect(page).toHaveURL(/\/panel\?vista=productos&mensaje=producto$/);
  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  await expect(page.getByRole('cell', { name: productoCodigo })).toBeVisible();
  await captura(page, '05-producto-registrado.png');
  await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);

  await modulos.getByRole('link', { name: 'Lotes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  const modalLote = page.getByRole('dialog');
  const hoy = fechaBolivia();
  const manana = fechaBolivia(1);
  await modalLote.getByLabel('Producto').selectOption({ label: `${productoCodigo} · Producto QA UI` });
  const codigoLoteCampo = modalLote.getByLabel('Código de lote');
  await expect(codigoLoteCampo).toHaveValue(new RegExp(`^TJ-ZAV-${productoCodigo}-${hoy.replaceAll('-', '')}-\\d{2,}$`));
  await codigoLoteCampo.fill(loteCodigo);
  await expect(modalLote.getByLabel('Fecha de elaboración')).toHaveValue(hoy);
  await expect(modalLote.getByLabel('Fecha de elaboración')).toHaveAttribute('max', hoy);
  await expect(modalLote.getByLabel('Fecha de registro')).toHaveValue(hoy);
  await expect(modalLote.getByLabel('Fecha de registro')).toHaveAttribute('readonly', '');
  await expect(modalLote.getByLabel('Fecha de vencimiento')).toHaveAttribute('min', manana);
  await modalLote.getByLabel('Fecha de elaboración').fill(fechaBolivia(1));
  expect(await modalLote.getByLabel('Fecha de elaboración').evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow)).toBeTruthy();
  await modalLote.getByLabel('Fecha de elaboración').fill(hoy);
  await modalLote.getByLabel('Fecha de vencimiento').fill(fechaBolivia(-1));
  expect(await modalLote.getByLabel('Fecha de vencimiento').evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow)).toBeTruthy();
  await modalLote.getByLabel('Fecha de elaboración').fill(hoy);
  await modalLote.getByLabel('Fecha de vencimiento').fill(fechaBolivia(90));
  await modalLote.getByLabel('Cantidad inicial').fill('12');
  await modalLote.getByRole('button', { name: 'Guardar lote e ingreso' }).click();
  await confirmar(page, 'Sí, registrar lote');

  await expect(page).toHaveURL(/\/panel\?vista=lotes&mensaje=lote$/);
  await expect(page.getByRole('status')).toContainText('Lote e ingreso inicial registrados correctamente');
  // La mutación y la consulta de la tabla son solicitudes distintas. Se recarga
  // la vista antes de validar la fila para evitar una carrera de refresco del RSC.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lotes', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Lote e ingreso inicial registrados correctamente');
  const filaLote = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) });
  await expect(filaLote).toBeVisible();
  await expect(filaLote).toContainText('RETENIDO');
  await expect(filaLote).toContainText('Producción y Almacenamiento');
  await captura(page, '06-lote-registrado.png');

  await modulos.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo traslado' }).click();
  const modalTraslado = page.getByRole('dialog');
  await modalTraslado.getByLabel('Lote a trasladar').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await modalTraslado.getByLabel('Cantidad').fill('5');
  await modalTraslado.getByLabel('Origen').selectOption('PRODUCCION_ALMACENAMIENTO');
  await modalTraslado.getByLabel('Destino').selectOption('VENTA_DESPACHO');
  await modalTraslado.getByLabel(/Referencia/).fill('QA-UI-TR-001');
  await modalTraslado.getByRole('button', { name: 'Guardar traslado' }).click();
  await confirmar(page, 'Sí, registrar traslado');

  await expect(page).toHaveURL(/\/panel\?vista=movimientos&mensaje=traslado&historialLoteId=[0-9a-f-]+$/);
  await expect(page.getByRole('status')).toContainText('Traslado registrado correctamente');
  const filaTraslado = page.getByRole('row')
    .filter({ has: page.getByRole('cell', { name: loteCodigo }) })
    .filter({ has: page.getByRole('cell', { name: 'TRASLADO' }) });
  await expect(filaTraslado).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Produccion y Almacenamiento' })).toBeVisible();
  await expect(filaTraslado.getByRole('cell', { name: 'Venta y Despacho' })).toBeVisible();
  await captura(page, '07-traslado-registrado.png');

  await modulos.getByRole('link', { name: 'Lotes', exact: true }).click();
  const filaLoteTrasladado = page.getByRole('row').filter({ has: page.getByRole('cell', { name: loteCodigo }) });
  await expect(filaLoteTrasladado.getByText('Producción y Almacenamiento')).toBeVisible();
  await expect(filaLoteTrasladado.getByText('7', { exact: true })).toBeVisible();
  await expect(filaLoteTrasladado.getByText('Venta y Despacho')).toBeVisible();
  await expect(filaLoteTrasladado.getByText('5', { exact: true })).toBeVisible();

  await modulos.getByRole('link', { name: 'Condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Gestionar condición' }).click();
  const modalCondicion = page.getByRole('dialog');
  await modalCondicion.locator('select[name="loteId"]').selectOption({ label: `${loteCodigo} · RETENIDO` });
  await modalCondicion.locator('select[name="accion"]').selectOption('liberar');
  await modalCondicion.locator('input[name="motivo"]').fill('QA UI: revisión completada');
  await modalCondicion.getByRole('button', { name: 'Guardar condición' }).click();
  await confirmar(page, 'Sí, guardar condición');

  await expect(page).toHaveURL(/\/panel\?vista=condiciones&mensaje=condicion&historialCondicionLoteId=[0-9a-f-]+$/);
  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  const filaCondicion = page.locator('.condicion-fila').filter({ hasText: loteCodigo });
  await expect(filaCondicion.locator('.condicion-fila-acciones > span').getByText('LIBERADO', { exact: true })).toBeVisible();
  await expect(page.getByText('QA UI: revisión completada')).toBeVisible();
  await captura(page, '08-lote-liberado.png');

  await page.getByRole('button', { name: 'Gestionar condición' }).click();
  const modalBloqueo = page.getByRole('dialog');
  await modalBloqueo.locator('select[name="loteId"]').selectOption({ label: `${loteCodigo} · LIBERADO` });
  await modalBloqueo.locator('select[name="accion"]').selectOption('bloquear');
  await modalBloqueo.locator('input[name="motivo"]').fill('QA UI: observación temporal');
  await modalBloqueo.getByRole('button', { name: 'Guardar condición' }).click();
  await confirmar(page, 'Sí, guardar condición');

  await expect(page.getByRole('status')).toContainText('Condición del lote actualizada correctamente');
  await expect(page.locator('.condicion-fila').filter({ hasText: loteCodigo }).locator('.condicion-fila-acciones > span').getByText('BLOQUEADO', { exact: true })).toBeVisible();
  await expect(page.getByText('QA UI: observación temporal')).toBeVisible();
  await captura(page, '09-lote-bloqueado.png');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Condiciones' })).toBeVisible();
  await expect(page.locator('.condicion-fila').filter({ hasText: loteCodigo }).locator('.condicion-fila-acciones > span').getByText('BLOQUEADO', { exact: true })).toBeVisible();
  await expect(page.getByText('QA UI: observación temporal')).toBeVisible();
  await captura(page, '10-condicion-persistente.png');

  await modulos.getByRole('link', { name: 'Distribución', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Distribución', exact: true })).toBeVisible();
  await expect(page.getByRole('application', { name: 'Mapa para seleccionar la ubicación de Venta y Despacho' })).toBeVisible();
  const zoomMapa = page.locator('.leaflet-bottom.leaflet-right .leaflet-control-zoom');
  await expect(zoomMapa).toBeVisible();
  await expect(page.locator('.leaflet-top.leaflet-left .leaflet-control-zoom')).toHaveCount(0);
  const cajaMapa = await page.getByRole('application', { name: 'Mapa para seleccionar la ubicación de Venta y Despacho' }).boundingBox();
  const cajaZoom = await zoomMapa.boundingBox();
  expect(cajaMapa).not.toBeNull();
  expect(cajaZoom).not.toBeNull();
  expect(cajaZoom!.x).toBeGreaterThan(cajaMapa!.x + cajaMapa!.width / 2);
  expect(cajaZoom!.y).toBeGreaterThan(cajaMapa!.y + cajaMapa!.height / 2);
  await captura(page, '11-distribucion-mapa.png');

  await modulos.getByRole('link', { name: 'Resumen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Trabaja por módulo')).toBeVisible();
  await captura(page, '12-dashboard-final.png');
});
