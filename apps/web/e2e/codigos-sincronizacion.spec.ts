import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { guardarCatalogo } from './soporte-catalogo';
const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
async function login(request: APIRequestContext, rol = 'ADMIN') {
  const r = await request.post(`${API}/api/v1/auth/login`, { data: { identificador: process.env[`QA_${rol}_IDENTIFICADOR`], contrasena: process.env[`QA_${rol}_PASSWORD`] } });
  expect(r.status()).toBe(200);
  return r.json();
}
async function entrar(page: Page, token: string) {
  await page.context().addCookies([{ name: 'zav_acceso', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
test('sugiere SKU, preserva el código físico de lote y busca presentaciones creadas después de abrir el formulario', async ({ page, request }) => {
  const admin = await login(request);
  await entrar(page, admin.accessToken);
  const headers = { Authorization: `Bearer ${admin.accessToken}` };
  const codigo = `SYNC-${Date.now()}`;
  const nuevo = await request.post(`${API}/api/v1/productos`, { headers, data: { codigo, nombre: codigo, familia: 'Salchichas', presentacion: 'Paquete QA', pesoGramos: 500, precioBob: '10.00', validacionComercial: 'VALIDADO' } });
  expect(nuevo.status()).toBe(201);
  await page.goto('/panel?vista=catalogo');
  await page.getByRole('button', { name: 'Presentaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Crear presentación' }).click();
  const editor = page.getByRole('region', { name: 'Crear catálogo' });
  await editor.getByRole('combobox', { name: 'Familia', exact: true }).selectOption({ label: 'Salchichas' });
  await expect(editor.getByLabel('Código SKU')).toHaveValue(/^SAL-\d+$/);
  const sku = await editor.getByLabel('Código SKU').inputValue();
  await editor.getByRole('combobox', { name: 'Producto comercial' }).selectOption({ label: codigo });
  await editor.getByLabel('Presentación', { exact: true }).fill('Paquete de ensayo');
  await editor.getByLabel('Tipo de empaque').fill('Bolsa QA');
  await editor.getByLabel('Peso (gramos)').fill('250');
  await editor.getByLabel('Precio (Bs)').fill('5.50');
  await guardarCatalogo(page);
  await page.getByLabel('Buscar', { exact: true }).fill(sku);
  await expect(page.getByRole('row').filter({ hasText: sku })).toBeVisible();

  await page.goto('/panel?vista=lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  const modal = page.getByRole('dialog');
  const posterior = await request.post(`${API}/api/v1/productos`, { headers, data: { codigo: `${codigo}-DOS`, nombre: `${codigo} posterior`, familia: 'Salchichas', presentacion: 'Unidad', pesoGramos: 100, precioBob: '3.00' } });
  expect(posterior.status()).toBe(201);
  const producto = await posterior.json();
  await modal.getByLabel('Buscar presentación en todo el catálogo').fill(`${codigo} posterior`);
  await expect(modal.getByLabel('Producto', { exact: true }).getByRole('option', { name: /posterior/ })).toHaveCount(1);
  await modal.getByLabel('Producto', { exact: true }).selectOption(producto.id);
  await expect(modal.getByLabel('Código de lote')).toHaveValue(new RegExp(`^TJ-ZAV-${codigo}-DOS-\\d{8}-01$`));
  await modal.getByLabel('Código de lote').fill('ETIQUETA-FISICA-123');
  await modal.getByLabel('Fecha de elaboración').fill('2026-01-01');
  await modal.getByLabel('Cantidad inicial').click();
  await expect(modal.getByLabel('Código de lote')).toHaveValue('ETIQUETA-FISICA-123');
  await modal.getByRole('button', { name: 'Regenerar' }).click();
  await expect(modal.getByLabel('Código de lote')).toHaveValue(`TJ-ZAV-${codigo}-DOS-20260101-01`);
});

test('un pedido del contrato móvil aparece y cambia de estado en una web ya abierta; stock compartido se actualiza sin recargar', async ({ page, request }) => {
  test.setTimeout(120000);
  const admin = await login(request), vendedor = await login(request, 'VENDEDOR');
  const at = { Authorization: `Bearer ${admin.accessToken}` }, vt = { Authorization: `Bearer ${vendedor.accessToken}` };
  const post = async (ruta: string, data: unknown, headers = at) => {
    const r = await request.post(`${API}/api/v1/${ruta}`, { headers, data });
    expect(r.status(), await r.text()).toBe(201);
    return r.json();
  };
  const codigo = `CRUZADO-${Date.now()}`;
  const producto = await post('productos', { codigo, nombre: codigo, familia: 'QA sincronización', presentacion: 'Unidad QA', pesoGramos: 100, precioBob: '5.00', validacionComercial: 'VALIDADO' });
  const lote = await post('lotes', { operacionClave: randomUUID(), productoId: producto.id, codigo: `L-${codigo}`, elaboradoEl: '2026-01-01', venceEl: '2099-01-01', cantidadInicial: 20, ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO' });
  await post(`lotes/${lote.id}/liberar`, { operacionClave: randomUUID(), motivo: 'Ensayo de sincronización' });
  await post('movimientos/traslado', { operacionClave: randomUUID(), loteId: lote.id, cantidad: 20, origenCodigo: 'PRODUCCION_ALMACENAMIENTO', destinoCodigo: 'VENTA_DESPACHO' });
  const cliente = await post('clientes', { nombre: codigo, direccion: 'Dirección sintética QA', latitud: -21.53, longitud: -64.73 }, vt);
  await entrar(page, admin.accessToken);
  await page.clock.install();
  await page.goto('/panel?vista=pedidos');
  const pedido = await post('pedidos', { clienteId: cliente.id, detalles: [{ productoId: producto.id, cantidad: 3 }] }, vt);
  await page.clock.runFor(31000);
  const fila = page.getByRole('row').filter({ hasText: codigo });
  await expect(fila).toContainText('REGISTRADO');
  await page.goto('/panel?vista=venta-directa');
  const cantidad = page.getByLabel(`Cantidad ${codigo}`, { exact: true });
  await expect(cantidad).toBeVisible();
  const tarjeta = cantidad.locator('../..');
  await expect(tarjeta).toContainText('17');
  await post(`pedidos/${pedido.id}/cancelacion`, { motivo: 'Ensayo de actualización cruzada' }, vt);
  await page.clock.runFor(31000);
  await expect(tarjeta).toContainText('20');
  const libre = await request.get(`${API}/api/v1/pedidos/disponibilidad`, { headers: vt });
  expect((await libre.json()).items.find((p: { productoId: string }) => p.productoId === producto.id).cantidadDisponible).toBe(20);
  await page.goto('/panel?vista=pedidos&pedidoEstado=CANCELADO');
  await expect(page.getByRole('row').filter({ hasText: codigo })).toContainText('CANCELADO');
});
