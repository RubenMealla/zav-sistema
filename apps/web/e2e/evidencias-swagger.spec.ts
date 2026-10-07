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
  const respuestaReal = op.locator('.live-responses-table');
  await expect(respuestaReal).toBeVisible({ timeout: 15000 });
  await expect(
    respuestaReal.locator('.response-col_status').filter({ hasText: codigo }).first(),
  ).toBeVisible({ timeout: 15000 });
}

async function capturar(op: Locator, nombre: string) {
  await mkdir(DIR, { recursive: true });
  // Se captura la operación de Swagger ya ejecutada: método/ruta, parámetros
  // o body seleccionado y la respuesta real del servidor. Se ocultan los
  // snippets cURL porque pueden contener el Bearer JWT de la sesión de QA.
  const respuestaReal = op.locator('.live-responses-table');
  await expect(respuestaReal).toBeVisible();
  await op.locator('.curl-command, .request-snippets').evaluateAll((elementos) => {
    for (const elemento of elementos) {
      (elemento as HTMLElement).style.display = 'none';
    }
  });
  // Swagger también muestra debajo la documentación estática de respuestas
  // posibles. Para la evidencia académica se conserva únicamente la petición
  // ejecutada y la respuesta REAL devuelta por el servidor.
  await op.locator('.responses-table:not(.live-responses-table)').evaluateAll((elementos) => {
    for (const elemento of elementos) {
      (elemento as HTMLElement).style.display = 'none';
    }
  });

  // La barra ZAV es sticky y, al capturar un elemento largo, puede quedar
  // superpuesta en medio de la evidencia y ocultar parte del JSON enviado.
  // Se vuelve invisible solo durante la captura; no se modifica la petición,
  // la respuesta ni el contenido de Swagger UI.
  const barraZav = op.page().locator('.zav-bar');
  if (await barraZav.count()) {
    await barraZav.evaluate((elemento) => {
      (elemento as HTMLElement).style.visibility = 'hidden';
    });
  }
  try {
    await op.screenshot({ path: path.join(DIR, nombre) });
  } finally {
    if (await barraZav.count()) {
      await barraZav.evaluate((elemento) => {
        (elemento as HTMLElement).style.visibility = '';
      });
    }
  }
}

async function autorizar(page: Page, jwt: string) {
  await page.waitForFunction(() => {
    const w = window as unknown as { ui?: { preauthorizeApiKey?: (name: string, value: string) => void } };
    return typeof w.ui?.preauthorizeApiKey === 'function';
  });
  await page.evaluate((jwtValue) => {
    const w = window as unknown as { ui: { preauthorizeApiKey: (name: string, value: string) => void } };
    w.ui.preauthorizeApiKey('bearerAuth', jwtValue);
  }, jwt);
}

async function desautorizar(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { ui?: { authActions?: { logout?: (names: string[]) => void } } };
    w.ui?.authActions?.logout?.(['bearerAuth']);
  });
}

test.describe.serial('Evidencias verificables de Swagger UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swagger');
    await expect(page.getByText('ZAV · Swagger API')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ZAV API' })).toBeVisible({ timeout: 15000 });
  });

  test('documentación y HTTP 200', async ({ page }) => {
    await mkdir(DIR, { recursive: true });
    await page.screenshot({ path: path.join(DIR, 'SW-01-swagger-api.png'), fullPage: false });

    const op = await abrir(page, 'GET', '/api/v1/salud');
    await probar(op);
    await ejecutar(op);
    await esperarCodigo(op, '200');
    await capturar(op, 'SW-02-salud-200.png');
  });

  test('operaciones protegidas correctas: HTTP 200 y 201', async ({ page, request }) => {
    const admin = await token(request, 'admin');
    await autorizar(page, admin);

    const me = await abrir(page, 'GET', '/api/v1/auth/me');
    await probar(me);
    await ejecutar(me);
    await esperarCodigo(me, '200');
    await capturar(me, 'SW-10-auth-me-200.png');

    const producto = await abrir(page, 'POST', '/api/v1/productos');
    await probar(producto);
    const codigo = `SWAGGER-OK-${Date.now()}`;
    await producto.locator('textarea').first().fill(JSON.stringify({
      codigo,
      nombre: 'Producto verificación Swagger',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 19.5,
    }, null, 2));
    await ejecutar(producto);
    await esperarCodigo(producto, '201');
    await capturar(producto, 'SW-11-producto-201.png');

    await desautorizar(page);
    const vendedor = await token(request, 'vendedor');
    await autorizar(page, vendedor);
    const pedidos = await abrir(page, 'GET', '/api/v1/pedidos');
    await probar(pedidos);
    await ejecutar(pedidos);
    await esperarCodigo(pedidos, '200');
    await capturar(pedidos, 'SW-12-pedidos-vendedor-200.png');
  });

  test('ejecuciones correctas de los flujos principales desde Swagger', async ({ page, request }) => {
    const ahora = Date.now();
    const admin = await token(request, 'admin');
    const vendedor = await token(request, 'vendedor');

    const post = async (ruta: string, jwt: string, data: unknown) => {
      const respuesta = await request.post(`${API}${ruta}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data,
      });
      expect(respuesta.ok()).toBeTruthy();
      return await respuesta.json();
    };

    const crearProducto = async (sufijo: string) =>
      post('/api/v1/productos', admin, {
        codigo: `SW-${sufijo}-${ahora}`,
        nombre: `Producto Swagger ${sufijo}`,
        familia: 'QA',
        presentacion: 'Unidad',
        pesoGramos: 250,
        precioBob: 18.5,
      });

    const prepararStock = async (sufijo: string, cantidad = 20) => {
      const producto = await crearProducto(sufijo);
      const lote = await post('/api/v1/lotes', admin, {
        operacionClave: crypto.randomUUID(),
        productoId: producto.id,
        codigo: `LOTE-SW-${sufijo}-${ahora}`,
        elaboradoEl: '2026-10-01',
        venceEl: '2026-12-31',
        cantidadInicial: cantidad,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      });
      await post(`/api/v1/lotes/${lote.id}/liberar`, admin, {
        operacionClave: crypto.randomUUID(),
        motivo: 'QA visual Swagger',
      });
      await post('/api/v1/movimientos/traslado', admin, {
        operacionClave: crypto.randomUUID(),
        loteId: lote.id,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad,
        referencia: `SW-${sufijo}`,
      });
      return { producto, lote };
    };

    const crearCliente = async (sufijo: string) =>
      post('/api/v1/clientes', vendedor, {
        nombre: `Cliente Swagger ${sufijo}`,
        telefono: '70000000',
        direccion: 'Tarija, Bolivia',
        latitud: -21.535,
        longitud: -64.73,
      });

    const crearPedido = async (clienteId: string, productoId: string, cantidad = 1) =>
      post('/api/v1/pedidos', vendedor, {
        clienteId,
        observacion: 'Pedido de evidencia Swagger',
        detalles: [{ productoId, cantidad }],
      });

    // Login correcto ejecutado directamente desde Swagger.
    const login = await abrir(page, 'POST', '/api/v1/auth/login');
    await probar(login);
    await login.locator('textarea').first().fill(JSON.stringify({
      identificador: requerida('QA_ADMIN_IDENTIFICADOR'),
      contrasena: requerida('QA_ADMIN_PASSWORD'),
    }, null, 2));
    await ejecutar(login);
    await esperarCodigo(login, '200');
    await capturar(login, 'SW-13-login-200.png');

    await autorizar(page, admin);

    // Lote e ingreso inicial.
    const productoLote = await crearProducto('LOTE');
    const loteSwagger = await abrir(page, 'POST', '/api/v1/lotes');
    await probar(loteSwagger);
    await loteSwagger.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      productoId: productoLote.id,
      codigo: `LOTE-SW-UI-${ahora}`,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 10,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    }, null, 2));
    await ejecutar(loteSwagger);
    await esperarCodigo(loteSwagger, '201');
    await capturar(loteSwagger, 'SW-14-lote-201.png');

    // Traslado con saldo suficiente.
    const stockTraslado = await prepararStock('TRASLADO', 12);
    const traslado = await abrir(page, 'POST', '/api/v1/movimientos/traslado');
    await probar(traslado);
    await traslado.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      loteId: stockTraslado.lote.id,
      origenCodigo: 'VENTA_DESPACHO',
      destinoCodigo: 'PRODUCCION_ALMACENAMIENTO',
      cantidad: 2,
      referencia: 'SWAGGER-TRASLADO-OK',
    }, null, 2));
    await ejecutar(traslado);
    await esperarCodigo(traslado, '201');
    await capturar(traslado, 'SW-15-traslado-201.png');

    await desautorizar(page);
    await autorizar(page, vendedor);

    // Cliente georreferenciado.
    const clienteSwagger = await abrir(page, 'POST', '/api/v1/clientes');
    await probar(clienteSwagger);
    await clienteSwagger.locator('textarea').first().fill(JSON.stringify({
      nombre: `Cliente creado desde Swagger ${ahora}`,
      telefono: '70000001',
      direccion: 'Centro, Tarija',
      latitud: -21.535,
      longitud: -64.73,
    }, null, 2));
    await ejecutar(clienteSwagger);
    await esperarCodigo(clienteSwagger, '201');
    await capturar(clienteSwagger, 'SW-16-cliente-201.png');

    // Pedido con disponibilidad.
    const stockPedido = await prepararStock('PEDIDO', 20);
    const clientePedido = await crearCliente('PEDIDO');
    const pedidoSwagger = await abrir(page, 'POST', '/api/v1/pedidos');
    await probar(pedidoSwagger);
    await pedidoSwagger.locator('textarea').first().fill(JSON.stringify({
      clienteId: clientePedido.id,
      observacion: 'Pedido correcto ejecutado desde Swagger',
      detalles: [{ productoId: stockPedido.producto.id, cantidad: 2 }],
    }, null, 2));
    await ejecutar(pedidoSwagger);
    await esperarCodigo(pedidoSwagger, '201');
    await capturar(pedidoSwagger, 'SW-17-pedido-201.png');

    // Retiro.
    const clienteRetiro = await crearCliente('RETIRO');
    const pedidoRetiro = await crearPedido(clienteRetiro.id, stockPedido.producto.id, 1);
    const retiro = await abrir(page, 'POST', '/api/v1/pedidos/{id}/retiro');
    await probar(retiro);
    const retiroClave = crypto.randomUUID();
    await retiro.locator('input').first().fill(pedidoRetiro.id);
    await retiro.locator('textarea').first().fill(JSON.stringify({
      operacionClave: retiroClave,
    }, null, 2));
    await ejecutar(retiro);
    await esperarCodigo(retiro, '201');
    await capturar(retiro, 'SW-18-retiro-201.png');

    // Repetición de la misma operación: debe devolver el mismo estado sin
    // duplicar el movimiento ni descontar stock nuevamente.
    await ejecutar(retiro);
    await esperarCodigo(retiro, '201');
    await capturar(retiro, 'SW-25-retiro-idempotente-201.png');

    // Entrega con georreferencia puntual.
    const clienteEntrega = await crearCliente('ENTREGA');
    const pedidoEntrega = await crearPedido(clienteEntrega.id, stockPedido.producto.id, 1);
    await post(`/api/v1/pedidos/${pedidoEntrega.id}/retiro`, vendedor, {
      operacionClave: crypto.randomUUID(),
    });
    const entrega = await abrir(page, 'POST', '/api/v1/pedidos/{id}/entrega');
    await probar(entrega);
    await entrega.locator('input').first().fill(pedidoEntrega.id);
    await entrega.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      latitud: -21.53549,
      longitud: -64.72956,
      precisionMetros: 8.5,
    }, null, 2));
    await ejecutar(entrega);
    await esperarCodigo(entrega, '201');
    await capturar(entrega, 'SW-19-entrega-201.png');

    await desautorizar(page);
  });

  test('errores de negocio de los requisitos principales visibles en Swagger', async ({ page, request }) => {
    const ahora = Date.now();
    const admin = await token(request, 'admin');
    const vendedor = await token(request, 'vendedor');

    const post = async (ruta: string, jwt: string, data: unknown) => {
      const respuesta = await request.post(`${API}${ruta}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data,
      });
      expect(respuesta.ok()).toBeTruthy();
      return await respuesta.json();
    };

    const producto = await post('/api/v1/productos', admin, {
      codigo: `SW-ERR-${ahora}`,
      nombre: 'Producto Swagger errores Must',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 15,
    });

    await autorizar(page, admin);

    const lote400 = await abrir(page, 'POST', '/api/v1/lotes');
    await probar(lote400);
    await lote400.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      productoId: producto.id,
      codigo: `LOTE-SW-ERR-${ahora}`,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 0,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    }, null, 2));
    await ejecutar(lote400);
    await esperarCodigo(lote400, '400');
    await capturar(lote400, 'SW-20-lote-400.png');

    const lote = await post('/api/v1/lotes', admin, {
      operacionClave: crypto.randomUUID(),
      productoId: producto.id,
      codigo: `LOTE-SW-SALDO-${ahora}`,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 3,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    });
    await post(`/api/v1/lotes/${lote.id}/liberar`, admin, {
      operacionClave: crypto.randomUUID(),
      motivo: 'QA visual de saldo insuficiente',
    });

    const traslado409 = await abrir(page, 'POST', '/api/v1/movimientos/traslado');
    await probar(traslado409);
    await traslado409.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      loteId: lote.id,
      origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
      destinoCodigo: 'VENTA_DESPACHO',
      cantidad: 999,
      referencia: 'SWAGGER-SALDO-INSUFICIENTE',
    }, null, 2));
    await ejecutar(traslado409);
    await esperarCodigo(traslado409, '409');
    await capturar(traslado409, 'SW-21-traslado-409.png');

    await desautorizar(page);
    await autorizar(page, vendedor);

    const cliente400 = await abrir(page, 'POST', '/api/v1/clientes');
    await probar(cliente400);
    await cliente400.locator('textarea').first().fill(JSON.stringify({
      nombre: 'Cliente sin georreferencia',
      telefono: '70000000',
      direccion: '',
    }, null, 2));
    await ejecutar(cliente400);
    await esperarCodigo(cliente400, '400');
    await capturar(cliente400, 'SW-22-cliente-400.png');

    // Preparar stock comercial mediante API para probar sobreventa desde Swagger.
    const lotePedido = await post('/api/v1/lotes', admin, {
      operacionClave: crypto.randomUUID(),
      productoId: producto.id,
      codigo: `LOTE-SW-PEDIDO-${ahora}`,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: 5,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    });
    await post(`/api/v1/lotes/${lotePedido.id}/liberar`, admin, {
      operacionClave: crypto.randomUUID(),
      motivo: 'QA visual de pedido',
    });
    await post('/api/v1/movimientos/traslado', admin, {
      operacionClave: crypto.randomUUID(),
      loteId: lotePedido.id,
      origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
      destinoCodigo: 'VENTA_DESPACHO',
      cantidad: 5,
      referencia: 'SWAGGER-PEDIDO-ERROR',
    });
    const cliente = await post('/api/v1/clientes', vendedor, {
      nombre: `Cliente Swagger Error ${ahora}`,
      telefono: '70000002',
      direccion: 'Tarija, Bolivia',
      latitud: -21.535,
      longitud: -64.73,
    });

    const pedido409 = await abrir(page, 'POST', '/api/v1/pedidos');
    await probar(pedido409);
    await pedido409.locator('textarea').first().fill(JSON.stringify({
      clienteId: cliente.id,
      observacion: 'Sobreventa de evidencia Swagger',
      detalles: [{ productoId: producto.id, cantidad: 999 }],
    }, null, 2));
    await ejecutar(pedido409);
    await esperarCodigo(pedido409, '409');
    await capturar(pedido409, 'SW-23-pedido-409.png');

    const pedidoValido = await post('/api/v1/pedidos', vendedor, {
      clienteId: cliente.id,
      observacion: 'Pedido para probar transición inválida de entrega',
      detalles: [{ productoId: producto.id, cantidad: 1 }],
    });

    const entrega409 = await abrir(page, 'POST', '/api/v1/pedidos/{id}/entrega');
    await probar(entrega409);
    await entrega409.locator('input').first().fill(pedidoValido.id);
    await entrega409.locator('textarea').first().fill(JSON.stringify({
      operacionClave: crypto.randomUUID(),
      latitud: -21.535,
      longitud: -64.73,
      precisionMetros: 8,
    }, null, 2));
    await ejecutar(entrega409);
    await esperarCodigo(entrega409, '409');
    await capturar(entrega409, 'SW-24-entrega-409.png');

    await desautorizar(page);
  });

  test('HTTP 400 y 401 visibles en Swagger', async ({ page }) => {
    const login400 = await abrir(page, 'POST', '/api/v1/auth/login');
    await probar(login400);
    const body400 = login400.locator('textarea').first();
    await body400.fill(JSON.stringify({ identificador: '' }, null, 2));
    await ejecutar(login400);
    await esperarCodigo(login400, '400');
    await capturar(login400, 'SW-03-login-400.png');

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
    await capturar(login401, 'SW-04-login-401.png');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'ZAV API' })).toBeVisible({ timeout: 15000 });
    const productos401 = await abrir(page, 'GET', '/api/v1/productos');
    await probar(productos401);
    await ejecutar(productos401);
    await esperarCodigo(productos401, '401');
    await capturar(productos401, 'SW-05-productos-401.png');
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
    await capturar(cliente403, 'SW-06-clientes-403.png');

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
    await capturar(producto409, 'SW-07-producto-409.png');
  });

  test('HTTP 404 y 503 visibles en Swagger', async ({ page, request }) => {
    const vendedor = await token(request, 'vendedor');
    await autorizar(page, vendedor);

    const cliente404 = await abrir(page, 'GET', '/api/v1/clientes/{id}');
    await probar(cliente404);
    await cliente404.locator('input').first().fill('00000000-0000-4000-8000-000000000404');
    await ejecutar(cliente404);
    await esperarCodigo(cliente404, '404');
    await capturar(cliente404, 'SW-08-cliente-404.png');

    const geo503 = await abrir(page, 'GET', '/api/v1/geografia/geocodificar');
    await probar(geo503);
    await geo503.locator('input').first().fill('Tarija');
    await ejecutar(geo503);
    await esperarCodigo(geo503, '503');
    await capturar(geo503, 'SW-09-geografia-503.png');

    await desautorizar(page);
  });
});
