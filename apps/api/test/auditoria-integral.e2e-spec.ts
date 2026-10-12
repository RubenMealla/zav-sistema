import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { FECHA_HOY_BOLIVIA_SQL, fechaHoyBolivia } from '../src/inventario/validacion.js';

describe('Regresiones de auditoría integral', () => {
  let app: INestApplication<App>;
  let db: pg.Pool;
  let admin: string;
  let vendedor: string;
  let vendedorId: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await app.init();
    db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    for (const rol of ['ADMIN', 'VENDEDOR']) {
      const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        identificador: process.env[`QA_${rol}_IDENTIFICADOR`],
        contrasena: process.env[`QA_${rol}_PASSWORD`],
      }).expect(200);
      if (rol === 'ADMIN') admin = login.body.accessToken as string;
      else { vendedor = login.body.accessToken as string; vendedorId = login.body.usuario.id as string; }
    }
  });
  afterAll(async () => { await db?.end(); await app?.close(); });

  async function preparar(lotes = 1) {
    const codigo = 'AUD-' + randomUUID().slice(0, 8);
    const producto = await db.query(`INSERT INTO producto (codigo,nombre,familia,presentacion,peso_gramos,precio_bob)
      VALUES ($1,'Producto auditoría','QA','Unidad',100,10) RETURNING id`, [codigo]);
    const cliente = await db.query(`INSERT INTO cliente (nombre,direccion,latitud,longitud)
      VALUES ('Cliente auditoría','Dirección sintética',-21.5355,-64.7302) RETURNING id`);
    const filas = await db.query(`INSERT INTO lote (codigo,producto_id,elaborado_el,vence_el,condicion)
      SELECT $1 || '-' || n,$2::uuid,CURRENT_DATE,CURRENT_DATE+30,'LIBERADO'
      FROM generate_series(1,$3::int) n RETURNING id`, [codigo, producto.rows[0].id, lotes]);
    await db.query(`INSERT INTO movimiento (operacion_clave,lote_id,tipo,destino_id,cantidad,usuario_id)
      SELECT gen_random_uuid(),l.id,'INGRESO',u.id,10,$2::uuid FROM lote l CROSS JOIN ubicacion u
      WHERE l.id=ANY($1::uuid[]) AND u.codigo='VENTA_DESPACHO'`, [filas.rows.map(r => r.id), vendedorId]);
    return { productoId: producto.rows[0].id as string, clienteId: cliente.rows[0].id as string, lotes: filas.rows.map(r => r.id as string) };
  }
  const crear = (clienteId: string, productoId: string, cantidad: number) => request(app.getHttpServer())
    .post('/api/v1/pedidos').set('Authorization', `Bearer ${vendedor}`)
    .send({ clienteId, detalles: [{ productoId, cantidad }] });

  it('usa fecha civil de Bolivia independientemente de la zona PostgreSQL', async () => {
    const conexion = await db.connect();
    try {
      await conexion.query('BEGIN');
      for (const zona of ['UTC', 'Asia/Tokyo']) {
        await conexion.query("SELECT set_config('TimeZone', $1, true)", [zona]);
        const ahora = await conexion.query(`SELECT (${FECHA_HOY_BOLIVIA_SQL})::text AS hoy`);
        expect(ahora.rows[0].hoy).toBe(fechaHoyBolivia());
        for (const [instante, fecha, vigente] of [
          ['2026-10-13T03:59:59Z', '2026-10-12', true],
          ['2026-10-13T04:00:00Z', '2026-10-13', false],
        ] as const) {
          const calculo = await conexion.query(
            `SELECT ($1::timestamptz AT TIME ZONE 'America/La_Paz')::date::text AS hoy,
                    (DATE '2026-10-12' >= ($1::timestamptz AT TIME ZONE 'America/La_Paz')::date) AS vigente`,
            [instante],
          );
          expect(calculo.rows[0]).toEqual({ hoy: fecha, vigente });
        }
      }
    } finally {
      await conexion.query('ROLLBACK');
      conexion.release();
    }
  });

  it('permite liberar un lote durante su día de vencimiento en Bolivia', async () => {
    const hoy = fechaHoyBolivia();
    const vigente = await preparar();
    const vencido = await preparar();
    for (const { lotes } of [vigente, vencido]) {
      await db.query("UPDATE lote SET condicion='RETENIDO' WHERE id=$1", [lotes[0]]);
    }
    await db.query(
      "UPDATE lote SET elaborado_el=$2::date-2, vence_el=$2::date WHERE id=$1",
      [vigente.lotes[0], hoy],
    );
    await db.query(
      "UPDATE lote SET elaborado_el=$2::date-3, vence_el=$2::date-1 WHERE id=$1",
      [vencido.lotes[0], hoy],
    );
    const liberar = (id: string) =>
      request(app.getHttpServer()).post(`/api/v1/lotes/${id}/liberar`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ operacionClave: randomUUID(), motivo: 'Verificación de fecha civil de Bolivia' });
    await liberar(vigente.lotes[0]).expect(201);
    await liberar(vencido.lotes[0]).expect(409);
  });

  it('devuelve 400 por fechas de auditoría inexistentes y formatos ambiguos', async () => {
    for (const fecha of ['2026-02-30', '2026-13-01', 'ayer']) {
      for (const campo of ['desde', 'hasta']) {
        await request(app.getHttpServer()).get(`/api/v1/admin/pedidos?${campo}=${fecha}`)
          .set('Authorization', `Bearer ${admin}`).expect(400);
      }
    }
  });

  it('no comunica éxito al editar un cliente inactivo', async () => {
    const { clienteId } = await preparar();
    await db.query('UPDATE cliente SET activo=FALSE WHERE id=$1', [clienteId]);
    for (const ruta of ['', '/ubicacion']) {
      const datos = { direccion: 'Cambio rechazado', latitud: -21.53, longitud: -64.73 };
      await request(app.getHttpServer()).patch(`/api/v1/clientes/${clienteId}${ruta}`)
        .set('Authorization', `Bearer ${vendedor}`)
        .send(ruta ? datos : { ...datos, nombre: 'Cambio rechazado' }).expect(404);
    }
    expect((await db.query('SELECT direccion FROM cliente WHERE id=$1', [clienteId])).rows[0].direccion).toBe('Dirección sintética');
  });

  it('no sobreestima la capacidad de edición cuando parte del stock vence', async () => {
    const datos = await preparar(2);
    const pedido = await crear(datos.clienteId, datos.productoId, 15).expect(201);
    await db.query("UPDATE lote SET elaborado_el=CURRENT_DATE-30, vence_el=CURRENT_DATE-1 WHERE id=$1", [datos.lotes[0]]);
    const editar = (cantidad: number) => request(app.getHttpServer()).patch(`/api/v1/pedidos/${pedido.body.id}`)
      .set('Authorization', `Bearer ${vendedor}`)
      .send({ clienteId: datos.clienteId, detalles: [{ productoId: datos.productoId, cantidad }] });
    await editar(14).expect(409);
    const reducido = await editar(10).expect(200);
    expect(reducido.body.detalles[0].cantidad).toBe(10);
  });

  it('serializa dos reservas concurrentes sin sobreventa', async () => {
    const datos = await preparar();
    const resultados = await Promise.all([
      crear(datos.clienteId, datos.productoId, 7), crear(datos.clienteId, datos.productoId, 7),
    ]);
    expect(resultados.map(r => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  });

  it('relee la condición del lote después de esperar una liberación y reserva concurrente', async () => {
    const datos = await preparar();
    await db.query("UPDATE lote SET condicion='RETENIDO' WHERE id=$1", [datos.lotes[0]]);
    const bloqueo = await db.connect();
    let traslado: Promise<request.Response> | undefined;
    try {
      await bloqueo.query('BEGIN');
      await bloqueo.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`producto:${datos.productoId}`]);
      traslado = request(app.getHttpServer()).post('/api/v1/movimientos/traslado')
        .set('Authorization', `Bearer ${admin}`).send({ operacionClave: randomUUID(), loteId: datos.lotes[0],
          origenCodigo: 'VENTA_DESPACHO', destinoCodigo: 'PRODUCCION_ALMACENAMIENTO', cantidad: 1,
        }).then(r => r);
      let esperando = false;
      for (let intento = 0; intento < 100 && !esperando; intento++) {
        const estado = await bloqueo.query(`SELECT 1 FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event='advisory' AND pid<>pg_backend_pid()`);
        esperando = estado.rowCount !== 0;
        if (!esperando) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(esperando).toBe(true);
      await bloqueo.query("UPDATE lote SET condicion='LIBERADO' WHERE id=$1", [datos.lotes[0]]);
      const pedido = await bloqueo.query(`INSERT INTO pedido (cliente_id,vendedor_id,direccion_entrega)
        VALUES ($1,$2,'Dirección sintética') RETURNING id`, [datos.clienteId, vendedorId]);
      await bloqueo.query(`INSERT INTO detalle_pedido (pedido_id,producto_id,cantidad,precio_unitario_bob)
        VALUES ($1,$2,10,10)`, [pedido.rows[0].id, datos.productoId]);
      await bloqueo.query('COMMIT');
      expect((await traslado).status).toBe(409);
      const saldo = await db.query(`SELECT cantidad_fisica FROM saldo_inventario s JOIN ubicacion u ON u.id=s.ubicacion_id
        WHERE s.lote_id=$1 AND u.codigo='VENTA_DESPACHO'`, [datos.lotes[0]]);
      expect(Number(saldo.rows[0].cantidad_fisica)).toBe(10);
    } finally {
      await bloqueo.query('ROLLBACK');
      bloqueo.release();
      await traslado;
    }
  });

  it('entrega todos los lotes una sola vez ante reintentos concurrentes y revierte fallos', async () => {
    const datos = await preparar(3);
    const pedido = await crear(datos.clienteId, datos.productoId, 25).expect(201);
    const id = pedido.body.id as string;
    await request(app.getHttpServer()).post(`/api/v1/pedidos/${id}/retiro`)
      .set('Authorization', `Bearer ${vendedor}`).send({ operacionClave: randomUUID() }).expect(201);
    const cuerpo = { operacionClave: randomUUID(), latitud: -21.5355, longitud: -64.7302, precisionMetros: 5 };
    const entregar = () => request(app.getHttpServer()).post(`/api/v1/pedidos/${id}/entrega`)
      .set('Authorization', `Bearer ${vendedor}`).send(cuerpo);
    // Un fallo en el UPDATE posterior debe deshacer también todos los movimientos.
    await db.query(`CREATE FUNCTION qa_fallo_entrega_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id='${id}'::uuid AND NEW.estado='ENTREGADO' THEN RAISE EXCEPTION 'Fallo QA'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER qa_fallo_entrega_auditoria BEFORE UPDATE ON pedido FOR EACH ROW EXECUTE FUNCTION qa_fallo_entrega_auditoria()');
    try {
      await entregar().expect(500);
      expect((await db.query("SELECT count(*)::int n FROM movimiento WHERE referencia=$1 AND tipo='ENTREGA'", [id])).rows[0].n).toBe(0);
    } finally {
      await db.query('DROP TRIGGER qa_fallo_entrega_auditoria ON pedido');
      await db.query('DROP FUNCTION qa_fallo_entrega_auditoria()');
    }
    const respuestas = await Promise.all([entregar(), entregar()]);
    expect(respuestas.map(r => r.status)).toEqual([201, 201]);
    const movimientos = await db.query("SELECT count(*)::int n,sum(cantidad)::int cantidad FROM movimiento WHERE referencia=$1 AND tipo='ENTREGA'", [id]);
    expect(movimientos.rows[0]).toEqual({ n: 3, cantidad: 25 });
    expect(respuestas[0].body.entregaGps.distanciaDestinoMetros).toBe(0);
  });
});
