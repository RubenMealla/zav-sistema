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

describe('Permisos y transacciones de inventario E3 (e2e)', () => {
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

  async function login(identificador: string, contrasena: string) {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identificador, contrasena })
      .expect(200);
    return respuesta.body.accessToken as string;
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
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('distingue 401 sin token de 403 con rol Vendedor', async () => {
    const cuerpo = {
      codigo: 'QA-E3-SIN-AUTH',
      nombre: 'Producto sin autorizacion',
      familia: 'QA',
      presentacion: 'Unidad',
      pesoGramos: 100,
      precioBob: 10,
    };

    await request(app.getHttpServer()).post('/api/v1/productos').send(cuerpo).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send(cuerpo)
      .expect(403);
  });

  it('crea, edita y da de baja un producto solo como Administrador', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: 'QA-PROD-001',
        nombre: 'Producto QA E3',
        familia: 'QA',
        presentacion: 'Unidad de prueba',
        pesoGramos: 250,
        precioBob: 18.5,
      })
      .expect(201);

    productoId = creado.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/productos/${productoId}`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ precioBob: 20 })
      .expect(403);

    const editado = await request(app.getHttpServer())
      .patch(`/api/v1/productos/${productoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Producto QA E3 editado', precioBob: 19.75 })
      .expect(200);

    expect(editado.body.nombre).toBe('Producto QA E3 editado');
    expect(editado.body.precioBob).toBe('19.75');

    const baja = await request(app.getHttpServer())
      .patch(`/api/v1/productos/${productoId}/baja`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(baja.body.activo).toBe(false);
    await db.query('UPDATE producto SET activo = TRUE WHERE id = $1::uuid', [productoId]);
  });

  it('registra un ingreso idempotente y deriva el saldo desde movimientos', async () => {
    const operacionClave = randomUUID();
    const cuerpo = {
      operacionClave,
      productoId,
      codigo: 'QA-LOTE-001',
      elaboradoEl: '2026-09-15',
      venceEl: '2026-12-15',
      cantidadInicial: 10,
      ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
    };

    const creado = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(cuerpo)
      .expect(201);

    loteId = creado.body.id;
    expect(creado.body.existencias[0].cantidad_fisica).toBe(10);

    const repetido = await request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(cuerpo)
      .expect(201);

    expect(repetido.body.id).toBe(loteId);

    const tabla = await db.query(
      `SELECT to_regclass(current_schema() || '.existencia') AS relacion`,
    );
    expect(tabla.rows[0].relacion).toBeNull();

    const saldo = await db.query(
      `SELECT s.cantidad_fisica
       FROM saldo_inventario s
       JOIN ubicacion u ON u.id = s.ubicacion_id
       WHERE s.lote_id = $1::uuid AND u.codigo = 'PRODUCCION_ALMACENAMIENTO'`,
      [loteId],
    );
    expect(saldo.rows[0].cantidad_fisica).toBe(10);
  });

  it('revierte lote y movimiento si falla el ingreso', async () => {
    const operacionClave = randomUUID();
    const codigoLote = 'QA-ROLLBACK-001';

    await db.query(`
      CREATE OR REPLACE FUNCTION qa_fallar_ingreso()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.tipo = 'INGRESO' THEN
          RAISE EXCEPTION 'FALLO_QA_FORZADO';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.query(`
      CREATE TRIGGER qa_fallar_ingreso_trigger
      BEFORE INSERT ON movimiento
      FOR EACH ROW EXECUTE FUNCTION qa_fallar_ingreso()
    `);

    try {
      await request(app.getHttpServer())
        .post('/api/v1/lotes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          operacionClave,
          productoId,
          codigo: codigoLote,
          elaboradoEl: '2026-09-15',
          venceEl: '2026-12-20',
          cantidadInicial: 3,
          ubicacionCodigo: 'PRODUCCION_ALMACENAMIENTO',
        })
        .expect(500);
    } finally {
      await db.query('DROP TRIGGER IF EXISTS qa_fallar_ingreso_trigger ON movimiento');
      await db.query('DROP FUNCTION IF EXISTS qa_fallar_ingreso()');
    }

    const lotes = await db.query('SELECT count(*)::int AS total FROM lote WHERE codigo = $1', [codigoLote]);
    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(lotes.rows[0].total).toBe(0);
    expect(movimientos.rows[0].total).toBe(0);
  });

  it('traslada saldo e impide duplicarlo por reintento', async () => {
    const operacionClave = randomUUID();
    const cuerpo = {
      operacionClave,
      loteId,
      origenCodigo: 'PRODUCCION_ALMACENAMIENTO',
      destinoCodigo: 'VENTA_DESPACHO',
      cantidad: 4,
      referencia: 'QA-TRASLADO-001',
    };

    const creado = await request(app.getHttpServer())
      .post('/api/v1/movimientos/traslado')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(cuerpo)
      .expect(201);

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
      .send(cuerpo)
      .expect(201);

    expect(repetido.body.movimiento.id).toBe(creado.body.movimiento.id);
  });

  it('rechaza saldo insuficiente sin crear movimiento', async () => {
    const operacionClave = randomUUID();

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

    const movimientos = await db.query(
      'SELECT count(*)::int AS total FROM movimiento WHERE operacion_clave = $1::uuid',
      [operacionClave],
    );
    expect(movimientos.rows[0].total).toBe(0);
  });

  it('impide al Vendedor trasladar y liberar lotes', async () => {
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

    await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenVendedor}`)
      .send({ operacionClave: randomUUID(), motivo: 'Intento no autorizado' })
      .expect(403);
  });

  it('libera un lote como Administrador y conserva auditoria', async () => {
    const liberado = await request(app.getHttpServer())
      .post(`/api/v1/lotes/${loteId}/liberar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ operacionClave: randomUUID(), motivo: 'QA E3: revision completada' })
      .expect(201);

    expect(liberado.body.condicion).toBe('LIBERADO');
    expect(liberado.body.evento.usuario.identificador).toBe(admin.identificador);

    const historial = await request(app.getHttpServer())
      .get(`/api/v1/lotes/${loteId}/condiciones`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(historial.body.total).toBe(1);
  });
});
