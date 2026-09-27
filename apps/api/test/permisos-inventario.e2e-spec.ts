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

describe('Permisos y transacciones de inventario (e2e)', () => {
  let app: INestApplication<App>;
  let db: pg.Pool;
  let tokenAdmin: string;
  let tokenVendedor: string;
  let productoId: string;
  let loteId: string;

  const admin = {
    identificador: requerida('QA_ADMIN_IDENTIFICADOR'),
    contrasena: requerida('QA_ADMIN_PASSWORD'),
  };
  const vendedor = {
    identificador: requerida('QA_VENDEDOR_IDENTIFICADOR'),
    contrasena: requerida('QA_VENDEDOR_PASSWORD'),
  };

  async function crearAplicacion() {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const instancia = modulo.createNestApplication();
    await instancia.init();
    return instancia;
  }

  async function login(identificador: string, contrasena: string) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identificador, contrasena })
      .expect(200);

    expect(respuesta.body.accessToken).toEqual(expect.any(String));
    return respuesta.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await crearAplicacion();
    db = new pg.Pool({ connectionString: requerida('DATABASE_URL') });
    tokenAdmin = await login(admin.identificador, admin.contrasena);
    tokenVendedor = await login(vendedor.identificador, vendedor.contrasena);
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('autentica al Vendedor y conserva su rol vigente en PostgreSQL', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .expect(200);

    expect(respuesta.body.identificador).toBe(vendedor.identificador);
    expect(respuesta.body.rol).toBe('VENDEDOR');
  });

  it('distingue una solicitud no autenticada de un Vendedor sin permiso', async () => {
    const cuerpo = {
      codigo: 'QA-SIN-AUTH',
      nombre: 'Producto sin autenticacion',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 100,
      precioBob: 10,
    };

    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .send(cuerpo)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send(cuerpo)
      .expect(403);
  });

  it('impide al Vendedor registrar productos sin crear filas', async () => {
    const antes = await db.query('SELECT count(*)::int AS total FROM producto');

    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        codigo: 'QA-VENDEDOR-PROD',
        nombre: 'Producto no autorizado',
        familia: 'QA',
        presentacion: 'Unidad',
        pesoGramos: 100,
        precioBob: 10,
      })
      .expect(403);

    const despues = await db.query('SELECT count(*)::int AS total FROM producto');
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('impide al Vendedor registrar lotes sin crear filas', async () => {
    const antes = await db.query('SELECT count(*)::int AS total FROM lote');

    await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: randomUUID(),
        productoId: randomUUID(),
        codigo: 'QA-VENDEDOR-LOTE',
        elaboradoEl: '2026-09-01',
        venceEl: '2026-10-01',
        cantidadInicial: 10,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(403);

    const despues = await db.query('SELECT count(*)::int AS total FROM lote');
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('registra un producto valido y rechaza datos invalidos o duplicados', async () => {
    const producto = {
      codigo: 'QA-PROD-001',
      nombre: 'Producto de prueba automatizada',
      familia: 'QA',
      presentacion: 'Unidad de prueba',
      pesoGramos: 100,
      precioBob: 10.5,
    };

    const creado = await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(producto)
      .expect(201);

    productoId = creado.body.id;
    expect(productoId).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...producto, codigo: 'QA-PROD-INVALIDO', pesoGramos: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(producto)
      .expect(409);
  });

  it('registra un lote valido, rechaza fechas invalidas y conserva idempotencia', async () => {
    const operacionClave = randomUUID();
    const lote = {
      operacionClave,
      productoId,
      codigo: 'QA-LOTE-001',
      elaboradoEl: '2026-09-01',
      venceEl: '2026-10-01',
      cantidadInicial: 10,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    };

    await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...lote, operacionClave: randomUUID(), codigo: 'QA-LOTE-FECHA', venceEl: '2026-08-31' })
      .expect(400);

    const creado = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(lote)
      .expect(201);

    loteId = creado.body.id;
    expect(creado.body.condicion).toBe('RETENIDO');
    expect(creado.body.existencias[0].cantidad_fisica).toBe(10);

    const repetido = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(lote)
      .expect(201);

    expect(repetido.body.id).toBe(loteId);

    await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...lote, cantidadInicial: 11 })
      .expect(409);

    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(movimientos.rows[0].total).toBe(1);
  });

  it('revierte lote y movimiento si falla la existencia dentro de la transaccion', async () => {
    const operacionClave = randomUUID();
    const codigoLote = 'QA-ROLLBACK-001';

    await db.query(`
      CREATE OR REPLACE FUNCTION qa_fallar_existencia()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'FALLO_QA_FORZADO';
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.query(`
      CREATE TRIGGER qa_fallar_existencia_trigger
      BEFORE INSERT ON existencia
      FOR EACH ROW EXECUTE FUNCTION qa_fallar_existencia()
    `);

    try {
      const respuesta = await request(app.getHttpServer())
        .post('/api/v1/lotes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          operacionClave,
          productoId,
          codigo: codigoLote,
          elaboradoEl: '2026-09-02',
          venceEl: '2026-10-02',
          cantidadInicial: 7,
          ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
        })
        .expect(500);

      const textoRespuesta = JSON.stringify(respuesta.body);
      expect(textoRespuesta).not.toContain(requerida('DATABASE_URL'));
      expect(textoRespuesta).not.toContain(admin.contrasena);
      expect(textoRespuesta).not.toContain('contrasena_hash');
    } finally {
      await db.query('DROP TRIGGER IF EXISTS qa_fallar_existencia_trigger ON existencia');
      await db.query('DROP FUNCTION IF EXISTS qa_fallar_existencia()');
    }

    const [lotes, movimientos, existencias] = await Promise.all([
      db.query('SELECT count(*)::int AS total FROM lote WHERE codigo = $1', [codigoLote]),
      db.query('SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid', [operacionClave]),
      db.query(
        `SELECT count(*)::int AS total
         FROM existencia e
         JOIN lote l ON l.id = e.lote_id
         WHERE l.codigo = $1`,
        [codigoLote],
      ),
    ]);

    expect(lotes.rows[0].total).toBe(0);
    expect(movimientos.rows[0].total).toBe(0);
    expect(existencias.rows[0].total).toBe(0);
  });

  it('mantiene productos y lotes despues de reiniciar la aplicacion', async () => {
    await app.close();
    app = await crearAplicacion();

    const producto = await request(app.getHttpServer())
      .get(`/api/v1/productos/${productoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(producto.body.id).toBe(productoId);

    const lote = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(lote.body.id).toBe(loteId);
    expect(lote.body.existencias[0].cantidad_fisica).toBe(10);
  });

  it('impide al Vendedor registrar traslados de inventario', async () => {
    const antes = await db.query(
      "SELECT count(*)::int AS total FROM movimiento WHERE tipo = 'TRASLADO'",
    );

    await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: randomUUID(),
        loteId,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad: 1,
      })
      .expect(403);

    const despues = await db.query(
      "SELECT count(*)::int AS total FROM movimiento WHERE tipo = 'TRASLADO'",
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('traslada saldo, mantiene el lote retenido y evita duplicados por reintento', async () => {
    const operacionClave = randomUUID();
    const traslado = {
      operacionClave,
      loteId,
      origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
      destinoCodigo: 'VENTA_DESPACHO',
      cantidad: 4,
      referencia: 'QA-TRASLADO-001',
      motivo: 'Prueba automatizada de traslado',
    };

    const creado = await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(traslado)
      .expect(201);

    expect(creado.body.movimiento.tipo).toBe('TRASLADO');
    expect(creado.body.movimiento.origen.codigo).toBe('PRODUCCION_ALMACENAMIENTO');
    expect(creado.body.movimiento.destino.codigo).toBe('VENTA_DESPACHO');

    const produccion = creado.body.existencias.find(
      (fila: { codigo: string }) => fila.codigo === 'PRODUCCION_ALMACENAMIENTO',
    );
    const venta = creado.body.existencias.find(
      (fila: { codigo: string }) => fila.codigo === 'VENTA_DESPACHO',
    );
    expect(produccion.cantidad_fisica).toBe(6);
    expect(venta.cantidad_fisica).toBe(4);

    const repetido = await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(traslado)
      .expect(201);

    expect(repetido.body.movimiento.id).toBe(creado.body.movimiento.id);

    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(movimientos.rows[0].total).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...traslado, cantidad: 5 })
      .expect(409);

    const lote = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(lote.body.condicion).toBe('RETENIDO');
  });

  it('permite el traslado inverso y registra el historial del lote', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        loteId,
        origenCodigo: 'VENTA_DESPACHO',
        destinoCodigo: 'PRODUCCION_ALMACENAMIENTO',
        cantidad: 1,
        referencia: 'QA-RETORNO-001',
      })
      .expect(201);

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/movimientos?loteId=${loteId}&page=1&limit=20`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(historial.body.total).toBe(3);
    expect(historial.body.items.map((item: { tipo: string }) => item.tipo)).toContain('INGRESO');
    expect(historial.body.items.filter((item: { tipo: string }) => item.tipo === 'TRASLADO')).toHaveLength(2);
  });

  it('rechaza saldo insuficiente sin modificar existencias ni crear movimiento', async () => {
    const operacionClave = randomUUID();
    const antes = await db.query(
      `SELECT u.codigo, e.cantidad_fisica
       FROM existencia e
       JOIN ubicacion u ON u.id = e.ubicacion_id
       WHERE e.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [loteId],
    );

    await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave,
        loteId,
        origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
        destinoCodigo: 'VENTA_DESPACHO',
        cantidad: 999,
      })
      .expect(409);

    const despues = await db.query(
      `SELECT u.codigo, e.cantidad_fisica
       FROM existencia e
       JOIN ubicacion u ON u.id = e.ubicacion_id
       WHERE e.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [loteId],
    );
    expect(despues.rows).toEqual(antes.rows);

    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(movimientos.rows[0].total).toBe(0);
  });

  it('revierte los saldos si falla el registro del movimiento de traslado', async () => {
    const operacionClave = randomUUID();
    const antes = await db.query(
      `SELECT u.codigo, e.cantidad_fisica
       FROM existencia e
       JOIN ubicacion u ON u.id = e.ubicacion_id
       WHERE e.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [loteId],
    );

    await db.query(`
      CREATE OR REPLACE FUNCTION qa_fallar_movimiento_traslado()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.tipo = 'TRASLADO' AND NEW.referencia = 'QA-FALLO-TRASLADO' THEN
          RAISE EXCEPTION 'FALLO_QA_TRASLADO';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.query(`
      CREATE TRIGGER qa_fallar_movimiento_traslado_trigger
      BEFORE INSERT ON movimiento
      FOR EACH ROW EXECUTE FUNCTION qa_fallar_movimiento_traslado()
    `);

    try {
      await request(app.getHttpServer())
        .post('/api/v1/movimientos/traslado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          operacionClave,
          loteId,
          origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
          destinoCodigo: 'VENTA_DESPACHO',
          cantidad: 2,
          referencia: 'QA-FALLO-TRASLADO',
        })
        .expect(500);
    } finally {
      await db.query('DROP TRIGGER IF EXISTS qa_fallar_movimiento_traslado_trigger ON movimiento');
      await db.query('DROP FUNCTION IF EXISTS qa_fallar_movimiento_traslado()');
    }

    const despues = await db.query(
      `SELECT u.codigo, e.cantidad_fisica
       FROM existencia e
       JOIN ubicacion u ON u.id = e.ubicacion_id
       WHERE e.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [loteId],
    );
    expect(despues.rows).toEqual(antes.rows);

    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(movimientos.rows[0].total).toBe(0);
  });


  it('impide al Vendedor liberar o bloquear lotes', async () => {
    const antes = await db.query(
      'SELECT count(*)::int AS total FROM lote_condicion_historial',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: randomUUID(),
        motivo: 'Intento no autorizado',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/bloquear`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({
        operacionClave: randomUUID(),
        motivo: 'Intento no autorizado',
      })
      .expect(403);

    const despues = await db.query(
      'SELECT count(*)::int AS total FROM lote_condicion_historial',
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('libera un lote retenido con auditoria e idempotencia', async () => {
    const operacionClave = randomUUID();
    const cuerpo = {
      operacionClave,
      motivo: 'QA: revision interna completada',
    };

    const liberado = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(cuerpo)
      .expect(201);

    expect(liberado.body.condicion).toBe('LIBERADO');
    expect(liberado.body.evento.condicionAnterior).toBe('RETENIDO');
    expect(liberado.body.evento.condicionNueva).toBe('LIBERADO');
    expect(liberado.body.evento.usuario.identificador).toBe(admin.identificador);

    const repetido = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(cuerpo)
      .expect(201);

    expect(repetido.body.evento.id).toBe(liberado.body.evento.id);

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...cuerpo, motivo: 'Otro motivo con la misma clave' })
      .expect(409);

    const lote = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${loteId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(lote.body.condicion).toBe('LIBERADO');
  });

  it('bloquea y vuelve a liberar un lote conservando historial', async () => {
    const bloqueado = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/bloquear`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        motivo: 'QA: observacion temporal',
      })
      .expect(201);

    expect(bloqueado.body.condicion).toBe('BLOQUEADO');
    expect(bloqueado.body.evento.condicionAnterior).toBe('LIBERADO');

    const reliberado = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        motivo: 'QA: observacion resuelta',
      })
      .expect(201);

    expect(reliberado.body.condicion).toBe('LIBERADO');
    expect(reliberado.body.evento.condicionAnterior).toBe('BLOQUEADO');

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${loteId}/condiciones?page=1&limit=20`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(historial.body.total).toBe(3);
    expect(historial.body.items[0].condicionNueva).toBe('LIBERADO');
  });

  it('impide liberar un lote vencido', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        productoId,
        codigo: 'QA-LOTE-VENCIDO',
        elaboradoEl: '2026-08-01',
        venceEl: '2026-09-01',
        cantidadInicial: 3,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${creado.body.id}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        motivo: 'QA: no debe liberarse',
      })
      .expect(409);

    const lote = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${creado.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(lote.body.condicion).toBe('RETENIDO');

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${creado.body.id}/condiciones`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(historial.body.total).toBe(0);
  });

  it('impide liberar un lote de un producto inactivo', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        productoId,
        codigo: 'QA-LOTE-PRODUCTO-INACTIVO',
        elaboradoEl: '2026-09-10',
        venceEl: '2026-12-15',
        cantidadInicial: 2,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(201);

    await db.query(
      'UPDATE producto SET activo = FALSE WHERE id = $1::uuid',
      [productoId],
    );

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/lotes/${creado.body.id}/liberar`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          operacionClave: randomUUID(),
          motivo: 'QA: no debe liberarse con producto inactivo',
        })
        .expect(409);
    } finally {
      await db.query(
        'UPDATE producto SET activo = TRUE WHERE id = $1::uuid',
        [productoId],
      );
    }

    const lote = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${creado.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(lote.body.condicion).toBe('RETENIDO');

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${creado.body.id}/condiciones`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(historial.body.total).toBe(0);
  });

  it('revierte el cambio de condicion si falla la auditoria', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        operacionClave: randomUUID(),
        productoId,
        codigo: 'QA-LOTE-COND-ROLLBACK',
        elaboradoEl: '2026-09-10',
        venceEl: '2026-12-10',
        cantidadInicial: 2,
        ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
      })
      .expect(201);

    const operacionClave = randomUUID();

    await db.query(`
      CREATE OR REPLACE FUNCTION qa_fallar_condicion_lote()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.motivo = 'QA-FALLO-CONDICION' THEN
          RAISE EXCEPTION 'FALLO_QA_CONDICION';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.query(`
      CREATE TRIGGER qa_fallar_condicion_lote_trigger
      BEFORE INSERT ON lote_condicion_historial
      FOR EACH ROW EXECUTE FUNCTION qa_fallar_condicion_lote()
    `);

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/lotes/${creado.body.id}/liberar`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          operacionClave,
          motivo: 'QA-FALLO-CONDICION',
        })
        .expect(500);
    } finally {
      await db.query(
        'DROP TRIGGER IF EXISTS qa_fallar_condicion_lote_trigger ON lote_condicion_historial',
      );
      await db.query('DROP FUNCTION IF EXISTS qa_fallar_condicion_lote()');
    }

    const lote = await db.query(
      'SELECT condicion FROM lote WHERE id = $1::uuid',
      [creado.body.id],
    );
    expect(lote.rows[0].condicion).toBe('RETENIDO');

    const historial = await db.query(
      'SELECT count(*)::int AS total FROM lote_condicion_historial WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(historial.rows[0].total).toBe(0);
  });

});
