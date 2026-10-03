import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de pruebas ${nombre}.`);
  return valor;
}

describe('Pedidos y distribucion E3 (e2e)', () => {
  let app: INestApplication<App>;
  let db: pg.Pool;
  let tokenAdmin: string;
  let tokenVendedor: string;
  let productoPrincipalId: string;
  let productoLimiteId: string;
  let lotePrincipalId: string;

  const admin = {
    identificador: requerida('QA_ADMIN_IDENTIFICADOR'),
    contrasena: requerida('QA_ADMIN_PASSWORD'),
  };
  const vendedor = {
    identificador: requerida('QA_VENDEDOR_IDENTIFICADOR'),
    contrasena: requerida('QA_VENDEDOR_PASSWORD'),
  };

  async function login(identificador: string, contrasena: string) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identificador, contrasena })
      .expect(200);
    return respuesta.body.accessToken as string;
  }

  async function prepararProducto(codigo: string, cantidad: number) {
    const producto = await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo,
        nombre: `Producto ${codigo}`,
        familia: 'QA PEDIDOS',
        presentacion: 'Unidad de prueba',
        pesoGramos: 200,
        precioBob: 25,
      })
      .expect(201);

    const lote = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        productoId: producto.body.id,
        codigo: `LOTE-${codigo}`,
        elaboradoEl: '2026-09-20',
        venceEl: '2026-12-20',
        cantidadInicial: cantidad,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${lote.body.id}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ operacionClave: randomUUID(), motivo: 'QA E3 pedidos' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        loteId: lote.body.id,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad,
        referencia: `PREPARACION-${codigo}`,
      })
      .expect(201);

    return { productoId: producto.body.id as string, loteId: lote.body.id as string };
  }

  async function crearCliente(
    sufijo: string,
    ubicacion?: { latitud: number; longitud: number },
  ) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        nombre: `Cliente QA ${sufijo}`,
        telefono: '70000000',
        direccion: `Calle de prueba ${sufijo}, Tarija`,
        ...(ubicacion ?? {}),
      })
      .expect(201);
    return respuesta.body.id as string;
  }

  async function crearPedido(clienteId: string, productoId: string, cantidad: number) {
    return request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        clienteId,
        observacion: 'Pedido sintetico QA E3',
        detalles: [{ productoId, cantidad }],
      });
  }

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    await app.init();
    db = new pg.Pool({ connectionString: requerida('DATABASE_URL') });

    tokenAdmin = await login(admin.identificador, admin.contrasena);
    tokenVendedor = await login(vendedor.identificador, vendedor.contrasena);

    const principal = await prepararProducto('QA-PED-PRINCIPAL', 20);
    productoPrincipalId = principal.productoId;
    lotePrincipalId = principal.loteId;

    const limite = await prepararProducto('QA-PED-LIMITE', 5);
    productoLimiteId = limite.productoId;
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('rechaza al Administrador en rutas exclusivas del Vendedor y valida cliente', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'No autorizado', direccion: 'Tarija' })
      .expect(403);

    const invalido = await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ nombre: 'Cliente incompleto', direccion: '' })
      .expect(400);

    expect(invalido.body).toEqual(
      expect.objectContaining({ statusCode: 400, path: '/api/v1/clientes' }),
    );
  });

  it('registra y consulta un Cliente como Vendedor', async () => {
    const clienteId = await crearCliente('REGISTRO');

    const consulta = await request(app.getHttpServer())
      .get(`/api/v1/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .expect(200);

    expect(consulta.body.nombre).toBe('Cliente QA REGISTRO');
    expect(consulta.body.activo).toBe(true);
  });

  it('permite al Vendedor consultar productos y disponibilidad sin permisos de edicion', async () => {
    const productos = await request(app.getHttpServer())
      .get('/api/v1/productos?limit=100')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .expect(200);

    expect(productos.body.items.some((p: { id: string }) => p.id === productoPrincipalId)).toBe(true);

    const disponibilidad = await request(app.getHttpServer())
      .get('/api/v1/pedidos/disponibilidad')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .expect(200);

    const principal = disponibilidad.body.items.find(
      (p: { productoId: string }) => p.productoId === productoPrincipalId,
    );
    expect(principal.cantidadFisica).toBe(20);
    expect(principal.cantidadComprometida).toBe(0);
    expect(principal.cantidadDisponible).toBe(20);

    await request(app.getHttpServer())
      .patch(`/api/v1/productos/${productoPrincipalId}`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ precioBob: 99 })
      .expect(403);
  });

  it('crea Pedido, reserva disponibilidad y rechaza sobreventa', async () => {
    const clienteId = await crearCliente('LIMITE');

    const primero = await crearPedido(clienteId, productoLimiteId, 5);
    expect(primero.status).toBe(201);
    expect(primero.body.estado).toBe('REGISTRADO');
    expect(primero.body.detalles[0].cantidad).toBe(5);

    const disponibilidad = await request(app.getHttpServer())
      .get('/api/v1/pedidos/disponibilidad')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .expect(200);

    const limitado = disponibilidad.body.items.find(
      (p: { productoId: string }) => p.productoId === productoLimiteId,
    );
    expect(limitado.cantidadFisica).toBe(5);
    expect(limitado.cantidadComprometida).toBe(5);
    expect(limitado.cantidadDisponible).toBe(0);

    const segundo = await crearPedido(clienteId, productoLimiteId, 1);
    expect(segundo.status).toBe(409);
    expect(segundo.body.statusCode).toBe(409);
  });

  it('georreferencia Cliente y sugiere una secuencia reproducible por proximidad', async () => {
    const despacho = await request(app.getHttpServer())
      .get('/api/v1/ubicaciones/venta-despacho')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(despacho.body.codigo).toBe('VENTA_DESPACHO');

    await request(app.getHttpServer())
      .patch(`/api/v1/ubicaciones/${despacho.body.id}/georreferencia`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ latitud: -21.535, longitud: -64.73 })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/ubicaciones/${despacho.body.id}/georreferencia`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ latitud: -21.535, longitud: -64.73 })
      .expect(200);

    const clienteCercano = await crearCliente('GEO-CERCA', {
      latitud: -21.5355,
      longitud: -64.7302,
    });
    const clienteLejano = await crearCliente('GEO-LEJOS', {
      latitud: -21.55,
      longitud: -64.75,
    });

    const cerca = await crearPedido(clienteCercano, productoPrincipalId, 1);
    const lejos = await crearPedido(clienteLejano, productoPrincipalId, 1);
    expect(cerca.status).toBe(201);
    expect(lejos.status).toBe(201);

    expect(cerca.body.destinoGps).toEqual({
      latitud: -21.5355,
      longitud: -64.7302,
    });

    const plan = await request(app.getHttpServer())
      .post('/api/v1/pedidos/planificacion')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        pedidoIds: [lejos.body.id, cerca.body.id],
        origenTipo: 'DESPACHO',
      })
      .expect(201);

    expect(plan.body.naturaleza).toBe('SECUENCIA_GEOGRAFICA_SUGERIDA');
    expect(plan.body.paradas).toHaveLength(2);
    expect(plan.body.paradas[0].pedidoId).toBe(cerca.body.id);
    expect(plan.body.distanciaTotalAproximadaMetros).toBeGreaterThan(0);

    const remoto = await crearCliente('GEO-CORREGIR');
    const corregido = await request(app.getHttpServer())
      .patch(`/api/v1/clientes/${remoto}/ubicacion`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        direccion: 'Direccion sintetica corregida, Tarija',
        latitud: -21.54,
        longitud: -64.74,
      })
      .expect(200);

    expect(corregido.body.ubicacion).toEqual(
      expect.objectContaining({ latitud: -21.54, longitud: -64.74 }),
    );
  });

  it('rechaza entrega antes del retiro y coordenadas fuera de rango', async () => {
    const clienteId = await crearCliente('TRANSICION');
    const creado = await crearPedido(clienteId, productoPrincipalId, 1);
    expect(creado.status).toBe(201);

    await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${creado.body.id}/entrega`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ operacionClave: randomUUID(), latitud: -21.53, longitud: -64.73 })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${creado.body.id}/entrega`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ operacionClave: randomUUID(), latitud: 120, longitud: -64.73 })
      .expect(400);
  });

  it('protege stock comprometido ante traslado o bloqueo administrativo', async () => {
    const traslada = await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        loteId: lotePrincipalId,
        origenCodigo: 'VENTA_DESPACHO',
        destinoCodigo: 'PRODUCCION_ALMACENAMIENTO',
        cantidad: 20,
        referencia: 'INTENTO-SOBRE-RESERVA',
      })
      .expect(409);

    expect(traslada.body.statusCode).toBe(409);

    const bloquea = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${lotePrincipalId}/bloquear`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ operacionClave: randomUUID(), motivo: 'Intento sobre stock comprometido' })
      .expect(409);

    expect(bloquea.body.statusCode).toBe(409);
  });

  it('completa Pedido → Retiro → Entrega GPS sin duplicar reintentos', async () => {
    const clienteId = await crearCliente('FLUJO', {
      latitud: -21.535,
      longitud: -64.73,
    });
    const creado = await crearPedido(clienteId, productoPrincipalId, 6);
    expect(creado.status).toBe(201);
    const pedidoId = creado.body.id as string;

    const retiroClave = randomUUID();
    const retiro = await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${pedidoId}/retiro`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ operacionClave: retiroClave })
      .expect(201);

    expect(retiro.body.estado).toBe('EN_DISTRIBUCION');

    await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${pedidoId}/retiro`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ operacionClave: retiroClave })
      .expect(201);

    const retiros = await db.query(
      "SELECT count(*)::int AS total FROM movimiento WHERE tipo = 'RETIRO' AND referencia = $1",
      [pedidoId],
    );
    expect(retiros.rows[0].total).toBe(1);

    const entregaClave = randomUUID();
    const entrega = await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${pedidoId}/entrega`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: entregaClave,
        latitud: -21.53549,
        longitud: -64.72956,
        precisionMetros: 8.5,
      })
      .expect(201);

    expect(entrega.body.estado).toBe('ENTREGADO');
    expect(entrega.body.entregaGps.latitud).toBe(-21.53549);
    expect(entrega.body.entregaGps.longitud).toBe(-64.72956);
    expect(entrega.body.entregaGps.precisionMetros).toBe(8.5);
    expect(entrega.body.entregaGps.distanciaDestinoMetros).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${pedidoId}/entrega`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: entregaClave,
        latitud: -21.53549,
        longitud: -64.72956,
        precisionMetros: 8.5,
      })
      .expect(201);

    const entregas = await db.query(
      "SELECT count(*)::int AS total FROM movimiento WHERE tipo = 'ENTREGA' AND referencia = $1",
      [pedidoId],
    );
    expect(entregas.rows[0].total).toBe(1);

    const saldos = await db.query(
      `SELECT u.codigo, s.cantidad_fisica::int
       FROM saldo_inventario s
       JOIN ubicacion u ON u.id = s.ubicacion_id
       WHERE s.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [lotePrincipalId],
    );

    const venta = saldos.rows.find((fila) => fila.codigo === 'VENTA_DESPACHO');
    const distribucion = saldos.rows.find((fila) => fila.codigo === 'EN_DISTRIBUCION');
    expect(venta.cantidad_fisica).toBe(14);
    expect(distribucion).toBeUndefined();
  });
});
