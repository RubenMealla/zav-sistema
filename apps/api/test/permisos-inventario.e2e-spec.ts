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
});
