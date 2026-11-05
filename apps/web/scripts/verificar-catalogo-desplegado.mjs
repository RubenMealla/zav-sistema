import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Ensayo remoto explícito: jamás aceptar un host arbitrario o de producción.
const API = 'https://zav-api-catalogo-qa.onrender.com/api/v1/';
const secretos = JSON.parse(await readFile('../../backups/catalogo-qa-secrets.json', 'utf8'));
const preview = JSON.parse(await readFile('../../backups/catalogo-qa-preview.json', 'utf8'));
assert.equal(preview.host, 'zav-sistema-qqtlx18z8-dariomealla24-6763.vercel.app');
const WEB = `https://${preview.host}`;
const carpeta = '../../backups/catalogo-qa-desplegado-20261031';
await mkdir(carpeta, { recursive: true });
const resultados = [];
async function api(ruta, datos, token, estado = 201, metodo = 'POST') {
  const r = await fetch(API + ruta, {
    method: datos === undefined ? 'GET' : metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: datos === undefined ? undefined : JSON.stringify(datos), signal: AbortSignal.timeout(60000),
  });
  assert.equal(r.status, estado, `${metodo} ${ruta}: estado HTTP inesperado`);
  resultados.push({ ruta, estado });
  return r.json();
}
const login = (identificador, contrasena) => api('auth/login', { identificador, contrasena }, null, 200);
const admin = await login('admin.catalogo@zav.test', secretos.adminPassword);
const vendedor = await login('vendedor.catalogo@zav.test', secretos.vendorPassword);
const at = admin.accessToken, vt = vendedor.accessToken;
const publico = await api('publico/catalogo', undefined, null, 200);
assert.equal(publico.familias.length, 7);
assert.equal(publico.familias.flatMap(f => f.productos).length, 13);
await api('catalogo/familias', {}, null, 401);
await api('catalogo/familias', {}, vt, 403);
const comercial = publico.familias[0].productos[0];
const codigo = 'QA-REMOTO-' + randomUUID().slice(0, 8).toUpperCase();
const p = await api('catalogo/presentaciones', {
  productoComercialId: comercial.id, codigo, presentacion: 'Ejemplo QA 500 g',
  tipoEmpaque: 'Bolsa sintética QA', pesoGramos: 500, precioBob: '20.30',
}, at);
assert.equal(p.validacionComercial, 'PROVISIONAL');
await api(`catalogo/presentaciones/${p.id}`, { validacionComercial: 'VALIDADO' }, at, 200, 'PATCH');
const fecha = dias => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
const l = await api('lotes', {
  operacionClave: randomUUID(), productoId: p.id, codigo: 'L-' + codigo,
  elaboradoEl: fecha(-1), venceEl: fecha(30), cantidadInicial: 12,
  ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
}, at);
await api(`lotes/${l.id}/liberar`, { operacionClave: randomUUID(), motivo: 'Ensayo remoto sintético' }, at);
await api('movimientos/traslado', { operacionClave: randomUUID(), loteId: l.id,
  origenCodigo: 'PRODUCCION_ALMACENAMIENTO', destinoCodigo: 'VENTA_DESPACHO', cantidad: 12 }, at);
const despacho = await api('ubicaciones/venta-despacho', undefined, at, 200);
// Coordenadas de ejemplo exclusivamente en la base sintética de QA.
await api(`ubicaciones/${despacho.id}/georreferencia`, { latitud: -21.53, longitud: -64.73 }, at, 200, 'PATCH');
const salida = cantidad => ({ operacionClave: randomUUID(), detalles: [{ productoId: p.id, cantidad }] });
const directa = salida(2);
const ventaAdmin = await api('operaciones/salidas-directas', directa, at);
const repetida = await api('operaciones/salidas-directas', directa, at);
assert.equal(ventaAdmin.id, repetida.id);
await api('operaciones/salidas-directas', { ...directa, detalles: [{ productoId: p.id, cantidad: 3 }] }, at, 409);
const carga = await api('operaciones/cargas', { ...salida(5), vendedorId: vendedor.usuario.id }, at);
await api(`operaciones/${carga.id}/recepcion`, { operacionClave: randomUUID() }, vt);
await api('operaciones/salidas-directas', salida(1), vt, 400);
const ventaVendedor = await api('operaciones/salidas-directas', {
  ...salida(2), latitud: -21.535, longitud: -64.731, precisionMetros: 7,
}, vt);
const devolucion = await api('operaciones/devoluciones', {
  operacionClave: randomUUID(), motivo: 'Sobrante sintético QA', lotes: [{ loteId: l.id, cantidad: 1 }],
}, vt);
await api(`operaciones/${devolucion.id}/recibir-devolucion`, { operacionClave: randomUUID() }, at);
const disponibilidad = await api('operaciones/disponibilidad', undefined, vt, 200);
assert.equal(disponibilidad.items.find(x => x.productoId === p.id).cantidadDisponible, 2);
const conciliacion = await api('operaciones/conciliacion', undefined, at, 200);
assert.equal(conciliacion.conciliado, true);
await writeFile(carpeta + '/api-resultado.json', JSON.stringify({ fecha: new Date().toISOString(), api: API,
  codigo, productoId: p.id, loteId: l.id, ventaAdmin: ventaAdmin.id, ventaVendedor: ventaVendedor.id,
  carga: carga.id, devolucion: devolucion.id, stockLibreFinal: 2, conciliado: true, resultados }, null, 2));

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${WEB}/?_vercel_share=${encodeURIComponent(preview.secret)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '7 familias de productos ZAV.' })).toBeVisible();
  await page.goto(WEB + '/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill('admin.catalogo@zav.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(secretos.adminPassword);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  await page.goto(WEB + '/panel?vista=catalogo');
  await page.getByRole('button', { name: 'Crear familia', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Crear catálogo' });
  const nombre = 'QA publicación remota ' + Date.now();
  await editor.getByLabel('Nombre', { exact: true }).fill(nombre);
  await editor.getByLabel('Publicado en la landing').check();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Crear catálogo' })).toHaveCount(0);
  await page.goto(WEB + '/');
  await expect(page.getByRole('button', { name: nombre, exact: true })).toBeVisible();
  await page.screenshot({ path: carpeta + '/landing-publicacion.png', fullPage: true });
  const familias = await api('catalogo/familias?q=' + encodeURIComponent(nombre), undefined, at, 200);
  await api('catalogo/familias/' + familias.items[0].id, { publicado: false }, at, 200, 'PATCH');
  await page.reload();
  await expect(page.getByRole('button', { name: nombre, exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '7 familias de productos ZAV.' })).toBeVisible();
  await page.goto(WEB + '/panel?vista=venta-directa');
  await expect(page.getByLabel('Buscar producto o presentación')).toBeVisible();
  await page.getByLabel('Buscar producto o presentación').fill(codigo);
  await page.getByLabel(`Cantidad ${codigo}`, { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Confirmado por la API' })).toBeVisible();
  const stockWeb = await api('operaciones/disponibilidad', undefined, at, 200);
  assert.equal(stockWeb.items.find(x => x.productoId === p.id).cantidadDisponible, 4);
  await page.screenshot({ path: carpeta + '/venta-directa.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(WEB + '/');
  await page.locator('img').evaluateAll(imgs => imgs.forEach(img => { img.loading = 'eager'; }));
  await expect.poll(() => page.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), { timeout: 30000 }).toBeTruthy();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: carpeta + '/landing-movil.png', fullPage: true });
  await writeFile(carpeta + '/resultado.json', JSON.stringify({ fecha: new Date().toISOString(), api: API, web: WEB,
    codigo, productoId: p.id, loteId: l.id, ventaAdmin: ventaAdmin.id, ventaVendedor: ventaVendedor.id,
    carga: carga.id, devolucion: devolucion.id, stockLibreFinal: 2, conciliado: true,
    loginWeb: true, ventaWebConfirmada: true, stockDespachoFinal: 4, publicacionDinamica: true, ocultacionDinamica: true, anchoMovil: 390, resultados }, null, 2));
  console.log(JSON.stringify({ solicitudes: resultados.length, loginWeb: true, ventaWebConfirmada: true, publicacionDinamica: true, stockLibreFinal: 2, conciliado: true }));
} finally {
  await browser.close();
}
