import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const DIR = path.join(process.cwd(), 'test-results', 'evidencias-finales-e3');

type Caso = {
  id: string;
  titulo: string;
  requisito: string;
  tipo: string;
  esperado: string;
  obtenido: string;
  metodo?: string;
  ruta?: string;
  detalle?: unknown;
};

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de QA ${nombre}.`);
  return valor;
}

function sanitizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sanitizar);
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
      if (/token|contrasena|password|secret/i.test(clave)) {
        salida[clave] = '[OMITIDO EN EVIDENCIA]';
      } else {
        salida[clave] = sanitizar(contenido);
      }
    }
    return salida;
  }
  return valor;
}

async function capturar(page: Page, caso: Caso) {
  await mkdir(DIR, { recursive: true });
  const detalle = JSON.stringify(sanitizar(caso.detalle ?? {}), null, 2)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  await page.setContent(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${caso.id} · ${caso.titulo}</title>
<style>
*{box-sizing:border-box} body{margin:0;background:#f2f2ef;color:#20201e;font-family:Arial,sans-serif}
main{width:min(1080px,calc(100% - 48px));margin:34px auto;background:#fff;border:1px solid #d8d8d1;border-radius:14px;overflow:hidden;box-shadow:0 12px 28px rgba(0,0,0,.08)}
header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;background:#20201e;color:#fff;padding:24px 30px}
.marca{color:#f29a79;font-size:12px;font-weight:900;letter-spacing:1.3px}.id{font-size:29px;font-weight:900;margin-top:6px}.tipo{border:1px solid #a8a89f;border-radius:999px;padding:7px 12px;font-size:12px;white-space:nowrap}
section{padding:24px 30px}.titulo{font-size:21px;font-weight:800;margin:0 0 18px}
dl{display:grid;grid-template-columns:180px 1fr;gap:9px 16px;margin:0 0 20px}dt{font-weight:800;color:#50504a}dd{margin:0}
.resultado{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.caja{border:1px solid #d8d8d1;border-radius:10px;padding:14px}.caja b{display:block;margin-bottom:5px}.ok{border-left:4px solid #2d7a55}
pre{margin:0;background:#111;color:#f4f4f2;border-radius:9px;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 Consolas,monospace}
footer{padding:0 30px 24px;color:#707069;font-size:12px;line-height:1.5}
</style>
</head>
<body><main>
<header><div><div class="marca">ZAV · QA FINAL E3 · APARTADO 2.8</div><div class="id">${caso.id}</div></div><div class="tipo">${caso.tipo}</div></header>
<section>
<p class="titulo">${caso.titulo}</p>
<dl>
<dt>Requisito</dt><dd>${caso.requisito}</dd>
<dt>Método</dt><dd>${caso.metodo ?? '—'}</dd>
<dt>Ruta</dt><dd>${caso.ruta ?? '—'}</dd>
</dl>
<div class="resultado">
<div class="caja"><b>Resultado esperado</b>${caso.esperado}</div>
<div class="caja ok"><b>Resultado obtenido</b>${caso.obtenido}</div>
</div>
<pre>${detalle}</pre>
</section>
<footer>Evidencia generada automáticamente por Playwright sobre API y PostgreSQL aislados de QA. Datos sintéticos; tokens, contraseñas y secretos se omiten.</footer>
</main></body></html>`);

  await page.screenshot({ path: path.join(DIR, `${caso.id}.png`), fullPage: true });
}

async function login(request: APIRequestContext, rol: 'admin' | 'vendedor') {
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

async function crearProducto(request: APIRequestContext, token: string, sufijo: string) {
  const codigo = `QA2-${sufijo}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const respuesta = await request.post(`${API}/api/v1/productos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      codigo,
      nombre: `Producto QA final ${sufijo}`,
      familia: 'QA FINAL E3',
      presentacion: 'Unidad de prueba',
      pesoGramos: 250,
      precioBob: 21.5,
    },
  });
  expect(respuesta.status()).toBe(201);
  return { codigo, body: await respuesta.json() };
}

async function prepararStock(
  request: APIRequestContext,
  tokenAdmin: string,
  sufijo: string,
  cantidad = 10,
) {
  const producto = await crearProducto(request, tokenAdmin, sufijo);
  const operacionLote = randomUUID();
  const lote = await request.post(`${API}/api/v1/lotes`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    data: {
      operacionClave: operacionLote,
      productoId: producto.body.id,
      codigo: `LOTE-${producto.codigo}`,
      elaboradoEl: '2026-10-01',
      venceEl: '2026-12-31',
      cantidadInicial: cantidad,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    },
  });
  expect(lote.status()).toBe(201);
  const loteBody = await lote.json();

  const liberar = await request.post(`${API}/api/v1/lotes/${loteBody.id}/liberar`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    data: { operacionClave: randomUUID(), motivo: 'QA final E3' },
  });
  expect(liberar.status()).toBe(201);

  const traslado = await request.post(`${API}/api/v1/movimientos/traslado`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    data: {
      operacionClave: randomUUID(),
      loteId: loteBody.id,
      origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
      destinoCodigo: 'VENTA_DESPACHO',
      cantidad,
      referencia: `QA-FINAL-${sufijo}`,
    },
  });
  expect(traslado.status()).toBe(201);

  return { producto: producto.body, lote: loteBody, operacionLote };
}

async function crearCliente(request: APIRequestContext, token: string, sufijo: string) {
  const respuesta = await request.post(`${API}/api/v1/clientes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nombre: `Cliente QA final ${sufijo}`,
      telefono: '70000000',
      direccion: `Calle QA ${sufijo}, Tarija`,
      latitud: -21.535,
      longitud: -64.73,
    },
  });
  expect(respuesta.status()).toBe(201);
  return await respuesta.json();
}

async function crearPedido(
  request: APIRequestContext,
  token: string,
  clienteId: string,
  productoId: string,
  cantidad: number,
) {
  return request.post(`${API}/api/v1/pedidos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      clienteId,
      observacion: 'Pedido sintético QA final E3',
      detalles: [{ productoId, cantidad }],
    },
  });
}

test.describe.serial('QA final E3 · evidencias para apartado 2.8', () => {
  test('CP-01 a CP-04 · autenticación y autorización', async ({ page, request }) => {
    const loginOk = await request.post(`${API}/api/v1/auth/login`, {
      data: {
        identificador: requerida('QA_ADMIN_IDENTIFICADOR'),
        contrasena: requerida('QA_ADMIN_PASSWORD'),
      },
    });
    expect(loginOk.status()).toBe(200);
    const loginBody = await loginOk.json();
    await capturar(page, {
      id: 'CP-01',
      titulo: 'Inicio de sesión con credenciales válidas',
      requisito: 'RF-02 · Autenticación',
      tipo: 'Camino feliz',
      esperado: 'HTTP 200 y sesión autenticada.',
      obtenido: `HTTP ${loginOk.status()} y JWT emitido.`,
      metodo: 'POST',
      ruta: '/api/v1/auth/login',
      detalle: loginBody,
    });

    const loginError = await request.post(`${API}/api/v1/auth/login`, {
      data: { identificador: 'invalido@zav.test', contrasena: 'incorrecta' },
    });
    expect(loginError.status()).toBe(401);
    await capturar(page, {
      id: 'CP-02',
      titulo: 'Rechazo de credenciales inválidas',
      requisito: 'RF-02 · Autenticación',
      tipo: 'Camino de error',
      esperado: 'HTTP 401 sin crear sesión.',
      obtenido: `HTTP ${loginError.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/auth/login',
      detalle: await loginError.json(),
    });

    const sinToken = await request.get(`${API}/api/v1/productos`);
    expect(sinToken.status()).toBe(401);
    await capturar(page, {
      id: 'CP-03',
      titulo: 'Ruta protegida sin token',
      requisito: 'Seguridad · Autenticación',
      tipo: 'Seguridad',
      esperado: 'HTTP 401.',
      obtenido: `HTTP ${sinToken.status()}.`,
      metodo: 'GET',
      ruta: '/api/v1/productos',
      detalle: await sinToken.json(),
    });

    const tokenAdmin = loginBody.accessToken as string;
    const rolIncorrecto = await request.post(`${API}/api/v1/clientes`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        nombre: 'Cliente intento administrador',
        direccion: 'Tarija',
        latitud: -21.535,
        longitud: -64.73,
      },
    });
    expect(rolIncorrecto.status()).toBe(403);
    await capturar(page, {
      id: 'CP-04',
      titulo: 'Rol incorrecto bloqueado por la API',
      requisito: 'Seguridad · Autorización por rol',
      tipo: 'Seguridad',
      esperado: 'HTTP 403.',
      obtenido: `HTTP ${rolIncorrecto.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/clientes',
      detalle: await rolIncorrecto.json(),
    });
  });

  test('CP-05 a CP-10 · producto, lote y traslado', async ({ page, request }) => {
    const tokenAdmin = await login(request, 'admin');

    const producto = await crearProducto(request, tokenAdmin, 'CRUD');
    const editado = await request.patch(`${API}/api/v1/productos/${producto.body.id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: { nombre: 'Producto QA final actualizado', precioBob: 22.75 },
    });
    expect(editado.status()).toBe(200);
    const baja = await request.patch(`${API}/api/v1/productos/${producto.body.id}/baja`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    expect(baja.status()).toBe(200);
    await capturar(page, {
      id: 'CP-05',
      titulo: 'CRUD completo de Producto',
      requisito: 'RF-03 · Productos',
      tipo: 'Camino feliz',
      esperado: 'Crear, editar y dar de baja conservando trazabilidad.',
      obtenido: 'Operaciones 201 / 200 / 200; producto final inactivo.',
      metodo: 'POST · PATCH · PATCH',
      ruta: '/api/v1/productos',
      detalle: { creado: producto.body, editado: await editado.json(), baja: await baja.json() },
    });

    const duplicadoBase = await crearProducto(request, tokenAdmin, 'DUP');
    const duplicado = await request.post(`${API}/api/v1/productos`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        codigo: duplicadoBase.codigo,
        nombre: 'Duplicado',
        familia: 'QA FINAL E3',
        presentacion: 'Unidad',
        pesoGramos: 250,
        precioBob: 10,
      },
    });
    expect(duplicado.status()).toBe(409);
    await capturar(page, {
      id: 'CP-06',
      titulo: 'Producto duplicado rechazado',
      requisito: 'RF-03 · Productos',
      tipo: 'Camino de error',
      esperado: 'HTTP 409 y sin segundo producto con el mismo código.',
      obtenido: `HTTP ${duplicado.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/productos',
      detalle: await duplicado.json(),
    });

    const productoLote = await crearProducto(request, tokenAdmin, 'LOTE');
    const opLote = randomUUID();
    const lote = await request.post(`${API}/api/v1/lotes`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        operacionClave: opLote,
        productoId: productoLote.body.id,
        codigo: `LOTE-${productoLote.codigo}`,
        elaboradoEl: '2026-10-01',
        venceEl: '2026-12-31',
        cantidadInicial: 10,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      },
    });
    expect(lote.status()).toBe(201);
    const loteBody = await lote.json();
    await capturar(page, {
      id: 'CP-07',
      titulo: 'Registro de lote e ingreso inicial',
      requisito: 'RF-04 · Lotes e ingreso',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201 y saldo inicial derivado del movimiento de ingreso.',
      obtenido: 'Lote creado con cantidad inicial 10.',
      metodo: 'POST',
      ruta: '/api/v1/lotes',
      detalle: loteBody,
    });

    const loteInvalido = await request.post(`${API}/api/v1/lotes`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        operacionClave: randomUUID(),
        productoId: productoLote.body.id,
        codigo: `LOTE-INVALIDO-${randomUUID().slice(0, 5)}`,
        elaboradoEl: '2026-10-01',
        venceEl: '2026-12-31',
        cantidadInicial: 0,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      },
    });
    expect(loteInvalido.status()).toBe(400);
    await capturar(page, {
      id: 'CP-08',
      titulo: 'Lote con cantidad inválida rechazado',
      requisito: 'RF-04 · Lotes e ingreso',
      tipo: 'Camino de error',
      esperado: 'HTTP 400.',
      obtenido: `HTTP ${loteInvalido.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/lotes',
      detalle: await loteInvalido.json(),
    });

    const liberar = await request.post(`${API}/api/v1/lotes/${loteBody.id}/liberar`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: { operacionClave: randomUUID(), motivo: 'QA final traslado' },
    });
    expect(liberar.status()).toBe(201);

    const traslado = await request.post(`${API}/api/v1/movimientos/traslado`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        operacionClave: randomUUID(),
        loteId: loteBody.id,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad: 4,
        referencia: 'QA-FINAL-TRASLADO',
      },
    });
    expect(traslado.status()).toBe(201);
    await capturar(page, {
      id: 'CP-09',
      titulo: 'Traslado de inventario entre ubicaciones',
      requisito: 'RF-05 · Movimientos y traslados',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201; disminuye origen, aumenta destino y se conserva el total.',
      obtenido: 'Traslado registrado correctamente.',
      metodo: 'POST',
      ruta: '/api/v1/movimientos/traslado',
      detalle: await traslado.json(),
    });

    const insuficiente = await request.post(`${API}/api/v1/movimientos/traslado`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        operacionClave: randomUUID(),
        loteId: loteBody.id,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad: 999,
        referencia: 'QA-FINAL-INSUFICIENTE',
      },
    });
    expect(insuficiente.status()).toBe(409);
    await capturar(page, {
      id: 'CP-10',
      titulo: 'Traslado con saldo insuficiente rechazado',
      requisito: 'RF-05 · Movimientos y traslados',
      tipo: 'Camino de error',
      esperado: 'HTTP 409 y operación no aplicada.',
      obtenido: `HTTP ${insuficiente.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/movimientos/traslado',
      detalle: await insuficiente.json(),
    });
  });

  test('CP-11 a CP-14 · cliente y pedido', async ({ page, request }) => {
    const [tokenAdmin, tokenVendedor] = await Promise.all([
      login(request, 'admin'),
      login(request, 'vendedor'),
    ]);
    const stock = await prepararStock(request, tokenAdmin, 'PEDIDO', 6);

    const cliente = await crearCliente(request, tokenVendedor, 'ALTA');
    await capturar(page, {
      id: 'CP-11',
      titulo: 'Registro de cliente georreferenciado',
      requisito: 'RF-06 · Clientes',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201 con coordenadas confirmadas.',
      obtenido: 'Cliente creado con ubicación.',
      metodo: 'POST',
      ruta: '/api/v1/clientes',
      detalle: cliente,
    });

    const clienteInvalido = await request.post(`${API}/api/v1/clientes`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: { nombre: 'Cliente inválido', direccion: '' },
    });
    expect(clienteInvalido.status()).toBe(400);
    await capturar(page, {
      id: 'CP-12',
      titulo: 'Cliente sin datos geográficos rechazado',
      requisito: 'RF-06 · Clientes',
      tipo: 'Camino de error',
      esperado: 'HTTP 400.',
      obtenido: `HTTP ${clienteInvalido.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/clientes',
      detalle: await clienteInvalido.json(),
    });

    const pedido = await crearPedido(request, tokenVendedor, cliente.id, stock.producto.id, 2);
    expect(pedido.status()).toBe(201);
    const pedidoBody = await pedido.json();
    await capturar(page, {
      id: 'CP-13',
      titulo: 'Registro de Pedido con disponibilidad',
      requisito: 'RF-07 · Pedidos',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201 y estado REGISTRADO.',
      obtenido: `HTTP 201; estado ${pedidoBody.estado}.`,
      metodo: 'POST',
      ruta: '/api/v1/pedidos',
      detalle: pedidoBody,
    });

    const sobreventa = await crearPedido(request, tokenVendedor, cliente.id, stock.producto.id, 99);
    expect(sobreventa.status()).toBe(409);
    await capturar(page, {
      id: 'CP-14',
      titulo: 'Pedido superior a disponibilidad rechazado',
      requisito: 'RF-07 · Pedidos',
      tipo: 'Camino de error',
      esperado: 'HTTP 409; no se compromete stock inexistente.',
      obtenido: `HTTP ${sobreventa.status()}.`,
      metodo: 'POST',
      ruta: '/api/v1/pedidos',
      detalle: await sobreventa.json(),
    });
  });

  test('CP-15 a CP-19 y CP-21 · retiro, entrega y errores de contrato', async ({ page, request }) => {
    const [tokenAdmin, tokenVendedor] = await Promise.all([
      login(request, 'admin'),
      login(request, 'vendedor'),
    ]);
    const stock = await prepararStock(request, tokenAdmin, 'DISTRIBUCION', 8);
    const cliente = await crearCliente(request, tokenVendedor, 'DISTRIBUCION');

    const pedido = await crearPedido(request, tokenVendedor, cliente.id, stock.producto.id, 2);
    expect(pedido.status()).toBe(201);
    const pedidoBody = await pedido.json();

    const retiroClave = randomUUID();
    const retiro = await request.post(`${API}/api/v1/pedidos/${pedidoBody.id}/retiro`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: { operacionClave: retiroClave },
    });
    expect(retiro.status()).toBe(201);
    const retiroBody = await retiro.json();
    await capturar(page, {
      id: 'CP-15',
      titulo: 'Retiro de Pedido para reparto',
      requisito: 'RF-09 · Retiro',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201 y estado EN_DISTRIBUCION.',
      obtenido: `HTTP 201; estado ${retiroBody.estado}.`,
      metodo: 'POST',
      ruta: `/api/v1/pedidos/${pedidoBody.id}/retiro`,
      detalle: retiroBody,
    });

    const retiroRepetido = await request.post(`${API}/api/v1/pedidos/${pedidoBody.id}/retiro`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: { operacionClave: retiroClave },
    });
    expect(retiroRepetido.status()).toBe(201);
    const repetidoBody = await retiroRepetido.json();
    expect(repetidoBody.id).toBe(retiroBody.id);
    await capturar(page, {
      id: 'CP-16',
      titulo: 'Reintento idempotente de Retiro',
      requisito: 'RF-09 · Retiro',
      tipo: 'Idempotencia',
      esperado: 'El reintento con la misma clave no crea una segunda operación.',
      obtenido: 'Segundo POST devuelve el mismo Pedido en EN_DISTRIBUCION; el conteo de un único movimiento se valida en E2E backend.',
      metodo: 'POST repetido',
      ruta: `/api/v1/pedidos/${pedidoBody.id}/retiro`,
      detalle: { primerRetiro: retiroBody, segundoRetiro: repetidoBody },
    });

    const entregaClave = randomUUID();
    const entrega = await request.post(`${API}/api/v1/pedidos/${pedidoBody.id}/entrega`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: {
        operacionClave: entregaClave,
        latitud: -21.53549,
        longitud: -64.72956,
        precisionMetros: 8.5,
      },
    });
    expect(entrega.status()).toBe(201);
    const entregaBody = await entrega.json();
    await capturar(page, {
      id: 'CP-17',
      titulo: 'Confirmación de entrega con GPS puntual',
      requisito: 'RF-10 · Entrega GPS',
      tipo: 'Camino feliz',
      esperado: 'HTTP 201, estado ENTREGADO y georreferencia de entrega.',
      obtenido: `HTTP 201; estado ${entregaBody.estado}.`,
      metodo: 'POST',
      ruta: `/api/v1/pedidos/${pedidoBody.id}/entrega`,
      detalle: entregaBody,
    });

    const cliente2 = await crearCliente(request, tokenVendedor, 'ERROR-ENTREGA');
    const pedido2 = await crearPedido(request, tokenVendedor, cliente2.id, stock.producto.id, 1);
    expect(pedido2.status()).toBe(201);
    const pedido2Body = await pedido2.json();
    const entregaPrematura = await request.post(`${API}/api/v1/pedidos/${pedido2Body.id}/entrega`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: { operacionClave: randomUUID(), latitud: -21.535, longitud: -64.73 },
    });
    expect(entregaPrematura.status()).toBe(409);
    await capturar(page, {
      id: 'CP-18',
      titulo: 'Entrega antes del Retiro rechazada',
      requisito: 'RF-10 · Entrega GPS',
      tipo: 'Camino de error',
      esperado: 'HTTP 409 por transición de estado inválida.',
      obtenido: `HTTP ${entregaPrematura.status()}.`,
      metodo: 'POST',
      ruta: `/api/v1/pedidos/${pedido2Body.id}/entrega`,
      detalle: await entregaPrematura.json(),
    });

    const inexistenteId = '00000000-0000-4000-8000-000000000404';
    const inexistente = await request.get(`${API}/api/v1/clientes/${inexistenteId}`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
    });
    expect(inexistente.status()).toBe(404);
    await capturar(page, {
      id: 'CP-19',
      titulo: 'Recurso inexistente',
      requisito: 'Contrato HTTP',
      tipo: 'Error complementario',
      esperado: 'HTTP 404.',
      obtenido: `HTTP ${inexistente.status()}.`,
      metodo: 'GET',
      ruta: `/api/v1/clientes/${inexistenteId}`,
      detalle: await inexistente.json(),
    });

    const geocodificacion = await request.get(`${API}/api/v1/geografia/geocodificar?q=Tarija`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
    });
    expect(geocodificacion.status()).toBe(503);
    await capturar(page, {
      id: 'CP-21',
      titulo: 'Proveedor externo no disponible en QA aislado',
      requisito: 'Integración de geocodificación',
      tipo: 'Servicio externo',
      esperado: 'HTTP 503 genérico sin exponer claves.',
      obtenido: `HTTP ${geocodificacion.status()}.`,
      metodo: 'GET',
      ruta: '/api/v1/geografia/geocodificar?q=Tarija',
      detalle: await geocodificacion.json(),
    });
  });
});
