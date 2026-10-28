import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Salidas directas y custodia: HTTP y PostgreSQL real', () => {
  let app: INestApplication<App>;
  let db: pg.Pool;
  let admin: string;
  let vendedor: string;
  let otro: string;
  let adminId: string;
  let vendedorId: string;
  let otroId: string;
  let clienteId: string;
  const gps = { latitud: -21.535, longitud: -64.731, precisionMetros: 7 };
  const post = (path: string, body: unknown, token = admin) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const get = (path: string, token = admin) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set('Authorization', `Bearer ${token}`);
  const salida = (
    productoId: string,
    cantidad: number,
    extra: Record<string, unknown> = {},
  ) => ({
    operacionClave: randomUUID(),
    detalles: [{ productoId, cantidad }],
    ...extra,
  });
  async function stock(cantidad = 20) {
    const codigo = `OPS-${randomUUID().slice(0, 8)}`;
    const {
      rows: [p],
    } = await db.query(
      `INSERT INTO producto(codigo,nombre,familia,presentacion,peso_gramos,precio_bob,validacion_comercial)
      VALUES($1,$1,'QA operaciones','Paquete QA 500g',500,30.20,'VALIDADO') RETURNING id`,
      [codigo],
    );
    const lotes: string[] = [];
    for (const [dias, unidades] of [
      [5, Math.ceil(cantidad / 2)],
      [15, Math.floor(cantidad / 2)],
    ]) {
      if (!unidades) continue;
      const {
        rows: [l],
      } = await db.query(
        `INSERT INTO lote(codigo,producto_id,elaborado_el,vence_el,condicion) VALUES($1,$2,CURRENT_DATE-1,CURRENT_DATE+$3::int,'LIBERADO') RETURNING id`,
        [`${codigo}-${dias}`, p.id, dias],
      );
      await db.query(
        `INSERT INTO movimiento(operacion_clave,lote_id,tipo,destino_id,cantidad,usuario_id) VALUES($1,$2,'INGRESO',(SELECT id FROM ubicacion WHERE codigo='VENTA_DESPACHO'),$3,$4)`,
        [randomUUID(), l.id, unidades, adminId],
      );
      lotes.push(l.id);
    }
    return { id: p.id as string, lotes };
  }
  async function pedido(productoId: string, cantidad: number) {
    return (
      await post(
        'pedidos',
        { clienteId, detalles: [{ productoId, cantidad }] },
        vendedor,
      ).expect(201)
    ).body;
  }
  async function cargar(
    productoId: string,
    cantidad: number,
    destinatario = vendedorId,
  ) {
    return (
      await post(
        'operaciones/cargas',
        salida(productoId, cantidad, { vendedorId: destinatario }),
      ).expect(201)
    ).body;
  }
  async function recibirCarga(id: string, token = vendedor) {
    return post(
      `operaciones/${id}/recepcion`,
      { operacionClave: randomUUID() },
      token,
    ).expect(201);
  }
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const login = async (identificador: string, contrasena: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ identificador, contrasena })
          .expect(200)
      ).body.accessToken as string;
    admin = await login(
      process.env.QA_ADMIN_IDENTIFICADOR!,
      process.env.QA_ADMIN_PASSWORD!,
    );
    vendedor = await login(
      process.env.QA_VENDEDOR_IDENTIFICADOR!,
      process.env.QA_VENDEDOR_PASSWORD!,
    );
    const { rows } = await db.query('SELECT id,rol FROM usuario ORDER BY rol');
    adminId = rows.find((r) => r.rol === 'ADMINISTRADOR').id;
    vendedorId = rows.find((r) => r.rol === 'VENDEDOR').id;
    const identificador = `otro-${randomUUID()}@zav.test`;
    const {
      rows: [v],
    } = await db.query(
      `INSERT INTO usuario(nombre,identificador,contrasena_hash,rol) SELECT 'Otro vendedor QA',$1,contrasena_hash,rol FROM usuario WHERE id=$2 RETURNING id`,
      [identificador, vendedorId],
    );
    otroId = v.id;
    otro = await login(identificador, process.env.QA_VENDEDOR_PASSWORD!);
    const {
      rows: [c],
    } = await db.query(
      "INSERT INTO cliente(nombre,direccion,latitud,longitud) VALUES('Cliente QA operaciones','Solo entorno aislado',-21.53,-64.73) RETURNING id",
    );
    clienteId = c.id;
    await db.query(
      "UPDATE ubicacion SET latitud=-21.53,longitud=-64.73 WHERE codigo='VENTA_DESPACHO'",
    );
  });
  afterAll(async () => {
    await db?.end();
    await app?.close();
  });

  it('exige JWT, roles y obtiene responsable del token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/operaciones/salidas-directas')
      .send({})
      .expect(401);
    await post('operaciones/cargas', {}, vendedor).expect(403);
    await post('operaciones/devoluciones', {}).expect(403);
    await get(`operaciones/custodia?vendedorId=${otroId}`, vendedor).expect(
      403,
    );
    const p = await stock();
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1, { usuarioId: otroId }),
    ).expect(400);
  });
  it('cliente genérico permanente, excluido de clientes, pedidos y rutas', async () => {
    const {
      rows: [c],
    } = await db.query('SELECT * FROM cliente WHERE es_consumidor_final');
    expect(c.telefono).toBeNull();
    expect(c.latitud).toBeNull();
    const listado = await get(
      'clientes?activo=todos&limit=100',
      vendedor,
    ).expect(200);
    expect(listado.body.items.some((x: { id: string }) => x.id === c.id)).toBe(
      false,
    );
    const p = await stock();
    await post(
      'pedidos',
      { clienteId: c.id, detalles: [{ productoId: p.id, cantidad: 1 }] },
      vendedor,
    ).expect(404);
    await expect(
      db.query('DELETE FROM cliente WHERE id=$1', [c.id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('requiere configuración de despacho y conserva coordenadas históricas', async () => {
    const p = await stock();
    await db.query(
      "UPDATE ubicacion SET latitud=NULL,longitud=NULL WHERE codigo='VENTA_DESPACHO'",
    );
    await post('operaciones/salidas-directas', salida(p.id, 1)).expect(409);
    await db.query(
      "UPDATE ubicacion SET latitud=-21.53,longitud=-64.73 WHERE codigo='VENTA_DESPACHO'",
    );
    const venta = await post(
      'operaciones/salidas-directas',
      salida(p.id, 1),
    ).expect(201);
    await db.query(
      "UPDATE ubicacion SET latitud=-21.54 WHERE codigo='VENTA_DESPACHO'",
    );
    const { body } = await get(`operaciones/${venta.body.id}`).expect(200);
    expect(body.latitud).toBe('-21.530000');
    expect(body.usuarioId).toBe(adminId);
    expect(body.clienteNombre).toBe('Consumidor final');
  });
  it('FEFO, salida multiproducto, precio exacto y snapshot independiente de cambios posteriores', async () => {
    const a = await stock(10);
    const b = await stock(4);
    const { body } = await post('operaciones/salidas-directas', {
      operacionClave: randomUUID(),
      detalles: [
        { productoId: a.id, cantidad: 7 },
        { productoId: b.id, cantidad: 2 },
      ],
    }).expect(201);
    const detalle = body.detalles.find(
      (d: { productoId: string }) => d.productoId === a.id,
    );
    expect(detalle.precioUnitarioBob).toBe('30.20');
    expect(
      detalle.lotes.find((l: { loteId: string }) => l.loteId === a.lotes[0])
        .cantidad,
    ).toBe(5);
    await db.query('UPDATE producto SET precio_bob=45 WHERE id=$1', [a.id]);
    const hist = await get(`operaciones/${body.id}`).expect(200);
    expect(
      hist.body.detalles.find(
        (d: { productoId: string }) => d.productoId === a.id,
      ).precioUnitarioBob,
    ).toBe('30.20');
    expect(
      detalle.lotes.every((l: { movimientoId: string }) => l.movimientoId),
    ).toBe(true);
  });
  it('rechaza provisionales en venta/carga/pedido y conserva LEGADO sin precio oficial', async () => {
    const p = await stock();
    await db.query(
      "UPDATE producto SET validacion_comercial='PROVISIONAL' WHERE id=$1",
      [p.id],
    );
    await post('operaciones/salidas-directas', salida(p.id, 1)).expect(409);
    await post('operaciones/cargas', salida(p.id, 1, { vendedorId })).expect(
      409,
    );
    await post(
      'pedidos',
      { clienteId, detalles: [{ productoId: p.id, cantidad: 1 }] },
      vendedor,
    ).expect(404);
    await db.query(
      "UPDATE producto SET validacion_comercial='LEGADO' WHERE id=$1",
      [p.id],
    );
    const { body } = await post(
      'operaciones/salidas-directas',
      salida(p.id, 1),
    ).expect(201);
    expect(body.detalles[0].precioUnitarioBob).toBeNull();
  });
  it('idempotencia simultánea exacta y conflicto por payload diferente', async () => {
    const p = await stock();
    const datos = salida(p.id, 3);
    const resultados = await Promise.all([
      post('operaciones/salidas-directas', datos),
      post('operaciones/salidas-directas', datos),
    ]);
    expect(resultados.map((r) => r.status)).toEqual([201, 201]);
    expect(resultados[0].body.id).toBe(resultados[1].body.id);
    await post('operaciones/salidas-directas', {
      ...datos,
      detalles: [{ productoId: p.id, cantidad: 4 }],
    }).expect(409);
    const {
      rows: [r],
    } = await db.query(
      "SELECT sum(cantidad)::int AS cantidad FROM movimiento WHERE tipo='SALIDA_DIRECTA' AND lote_id=ANY($1::uuid[])",
      [p.lotes],
    );
    expect(r.cantidad).toBe(3);
  });
  it('serializa dos ventas y revierte íntegramente la perdedora', async () => {
    const p = await stock(5);
    const r = await Promise.all([
      post('operaciones/salidas-directas', salida(p.id, 4)),
      post('operaciones/salidas-directas', salida(p.id, 4)),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
  });
  it('protege reservas y permite retiro simultáneo con salida del saldo libre', async () => {
    const p = await stock(20);
    const pe = await pedido(p.id, 15);
    await post('operaciones/salidas-directas', salida(p.id, 6)).expect(409);
    await post('operaciones/cargas', salida(p.id, 6, { vendedorId })).expect(
      409,
    );
    const r = await Promise.all([
      post(
        `pedidos/${pe.id}/retiro`,
        { operacionClave: randomUUID() },
        vendedor,
      ),
      post('operaciones/salidas-directas', salida(p.id, 5)),
    ]);
    expect(r.map((x) => x.status)).toEqual([201, 201]);
    const cust = await get('operaciones/custodia?limit=100', vendedor).expect(
      200,
    );
    expect(
      cust.body.items
        .filter((x: { productoId: string }) => x.productoId === p.id)
        .reduce((s: number, x: { cantidad: number }) => s + x.cantidad, 0),
    ).toBe(15);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1, gps),
      vendedor,
    ).expect(409);
    await post(
      `pedidos/${pe.id}/entrega`,
      { operacionClave: randomUUID(), ...gps },
      vendedor,
    ).expect(201);
  });
  it('carga y pedido simultáneos no sobrecomprometen despacho', async () => {
    const p = await stock(5);
    const r = await Promise.all([
      post('operaciones/cargas', salida(p.id, 4, { vendedorId })),
      post(
        'pedidos',
        { clienteId, detalles: [{ productoId: p.id, cantidad: 4 }] },
        vendedor,
      ),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
  });
  it('recepción por destinatario, GPS obligatorio y separación de stock ajeno', async () => {
    const p = await stock(20);
    const carga = await cargar(p.id, 5);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1, gps),
      vendedor,
    ).expect(409);
    await post(
      `operaciones/${carga.id}/recepcion`,
      { operacionClave: randomUUID() },
      otro,
    ).expect(404);
    const clave = randomUUID();
    await post(
      `operaciones/${carga.id}/recepcion`,
      { operacionClave: clave },
      vendedor,
    ).expect(201);
    await post(
      `operaciones/${carga.id}/recepcion`,
      { operacionClave: clave },
      vendedor,
    ).expect(201);
    await post(
      `operaciones/${carga.id}/recepcion`,
      { operacionClave: clave, observacion: 'Diferente' },
      vendedor,
    ).expect(409);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1),
      vendedor,
    ).expect(400);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1, gps),
      otro,
    ).expect(409);
    const { body } = await post(
      'operaciones/salidas-directas',
      salida(p.id, 3, gps),
      vendedor,
    ).expect(201);
    expect(body.usuarioId).toBe(vendedorId);
    expect(body.precisionM).toBe('7.00');
    await get(`operaciones/${body.id}`, otro).expect(404);
    const libre = await get('operaciones/disponibilidad', vendedor).expect(200);
    expect(
      libre.body.items.find(
        (x: { productoId: string }) => x.productoId === p.id,
      ).cantidadDisponible,
    ).toBe(2);
  });
  it('devolución reserva lotes, recepción administrativa a inspección y reintentos', async () => {
    const p = await stock(10);
    const carga = await cargar(p.id, 5);
    await recibirCarga(carga.id);
    await post(
      'operaciones/devoluciones',
      {
        operacionClave: randomUUID(),
        motivo: 'Sobrantes QA',
        lotes: [{ loteId: p.lotes[0], cantidad: 6 }],
      },
      vendedor,
    ).expect(409);
    const datos = {
      operacionClave: randomUUID(),
      motivo: 'Sobrantes QA',
      lotes: [{ loteId: p.lotes[0], cantidad: 3 }],
    };
    const { body } = await post(
      'operaciones/devoluciones',
      datos,
      vendedor,
    ).expect(201);
    await post('operaciones/devoluciones', datos, vendedor).expect(201);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 3, gps),
      vendedor,
    ).expect(409);
    await post(
      `operaciones/${body.id}/recibir-devolucion`,
      { operacionClave: randomUUID() },
      vendedor,
    ).expect(403);
    const clave = randomUUID();
    await post(`operaciones/${body.id}/recibir-devolucion`, {
      operacionClave: clave,
      observacion: 'Recibido para inspección QA',
    }).expect(201);
    await post(`operaciones/${body.id}/recibir-devolucion`, {
      operacionClave: clave,
      observacion: 'Recibido para inspección QA',
    }).expect(201);
    const {
      rows: [r],
    } = await db.query(
      "SELECT s.cantidad_fisica FROM saldo_inventario s JOIN ubicacion u ON u.id=s.ubicacion_id WHERE s.lote_id=$1 AND u.codigo='DEVOLUCIONES_INSPECCION'",
      [p.lotes[0]],
    );
    expect(r.cantidad_fisica).toBe(3);
    const movimiento = {
      operacionClave: randomUUID(),
      loteId: p.lotes[0],
      cantidad: 3,
      origenCodigo: 'DEVOLUCIONES_INSPECCION',
      destinoCodigo: 'VENTA_DESPACHO',
    };
    await post('movimientos/traslado', movimiento).expect(400);
    await post('movimientos/traslado', {
      ...movimiento,
      motivo: 'Inspección QA: empaque y frío conformes',
    }).expect(201);
  });
  it('venta y devolución simultáneas no consumen dos veces la misma custodia', async () => {
    const p = await stock(10);
    await recibirCarga((await cargar(p.id, 5)).id);
    const r = await Promise.all([
      post('operaciones/salidas-directas', salida(p.id, 4, gps), vendedor),
      post(
        'operaciones/devoluciones',
        {
          operacionClave: randomUUID(),
          motivo: 'Retorno QA',
          lotes: [{ loteId: p.lotes[0], cantidad: 4 }],
        },
        vendedor,
      ),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
  });
  it('rechaza lotes vencidos y bloqueados para venta; admite su retorno a inspección', async () => {
    const p = await stock(10);
    await recibirCarga((await cargar(p.id, 5)).id);
    await db.query("UPDATE lote SET condicion='BLOQUEADO' WHERE id=$1", [
      p.lotes[0],
    ]);
    await post(
      'operaciones/salidas-directas',
      salida(p.id, 1, gps),
      vendedor,
    ).expect(409);
    const { body } = await post(
      'operaciones/devoluciones',
      {
        operacionClave: randomUUID(),
        motivo: 'Lote bloqueado QA',
        lotes: [{ loteId: p.lotes[0], cantidad: 5 }],
      },
      vendedor,
    ).expect(201);
    await post(`operaciones/${body.id}/recibir-devolucion`, {
      operacionClave: randomUUID(),
    }).expect(201);
    await post('movimientos/traslado', {
      operacionClave: randomUUID(),
      loteId: p.lotes[0],
      cantidad: 5,
      origenCodigo: 'DEVOLUCIONES_INSPECCION',
      destinoCodigo: 'VENTA_DESPACHO',
      motivo: 'Intento inválido QA',
    }).expect(409);
    const vencido = await stock(5);
    await db.query(
      'UPDATE lote SET elaborado_el=CURRENT_DATE-10,vence_el=CURRENT_DATE-1 WHERE producto_id=$1',
      [vencido.id],
    );
    await post('operaciones/salidas-directas', salida(vencido.id, 1)).expect(
      409,
    );
  });
  it('reversión exige recepción física, conserva original y entra a inspección una sola vez', async () => {
    const p = await stock();
    const venta = (
      await post('operaciones/salidas-directas', salida(p.id, 3)).expect(201)
    ).body;
    const datos = {
      operacionClave: randomUUID(),
      motivo: 'Error de entrega QA',
      recepcionFisicaConfirmada: true,
    };
    await post(`operaciones/${venta.id}/reversion`, {
      ...datos,
      recepcionFisicaConfirmada: false,
    }).expect(400);
    const { body } = await post(
      `operaciones/${venta.id}/reversion`,
      datos,
    ).expect(201);
    await post(`operaciones/${venta.id}/reversion`, datos).expect(201);
    await post(`operaciones/${venta.id}/reversion`, {
      ...datos,
      operacionClave: randomUUID(),
    }).expect(409);
    const original = await get(`operaciones/${venta.id}`).expect(200);
    expect(original.body.reversionId).toBe(body.id);
    expect(original.body.estado).toBe('CONFIRMADA');
  });
  it('rechaza alteraciones del historial y saldos negativos incluso por SQL directo', async () => {
    const p = await stock(6);
    const venta = (await post('operaciones/salidas-directas', salida(p.id, 2)).expect(201)).body;
    for (const [sql, id] of [
      ['DELETE FROM operacion_inventario WHERE id=$1', venta.id],
      ['UPDATE detalle_operacion SET cantidad=cantidad+1 WHERE operacion_id=$1', venta.id],
      ['DELETE FROM movimiento WHERE asignacion_operacion_id IN (SELECT a.id FROM asignacion_operacion a JOIN detalle_operacion d ON d.id=a.detalle_id WHERE d.operacion_id=$1)', venta.id],
    ]) await expect(db.query(sql, [id])).rejects.toMatchObject({code:'23514'});
    await expect(db.query(`INSERT INTO movimiento(operacion_clave,lote_id,tipo,origen_id,destino_id,cantidad,usuario_id)
      VALUES($1,$2,'TRASLADO',(SELECT id FROM ubicacion WHERE codigo='VENTA_DESPACHO'),(SELECT id FROM ubicacion WHERE codigo='PRODUCCION_ALMACENAMIENTO'),100,$3)`,[randomUUID(),p.lotes[0],adminId])).rejects.toMatchObject({code:'23514'});
    const original=await get(`operaciones/${venta.id}`).expect(200);
    expect(original.body.detalles[0].cantidad).toBe(2);
  });
  it('el API anterior no permite usar altas provisionales ni precios editados sin validar', async () => {
    const codigo=`LEG-${randomUUID().slice(0,8)}`;
    const p=(await post('productos',{codigo,nombre:codigo,familia:'QA compatibilidad',presentacion:'Paquete QA',pesoGramos:500,precioBob:'20.00'}).expect(201)).body;
    expect((await db.query('SELECT validacion_comercial FROM producto WHERE id=$1',[p.id])).rows[0].validacion_comercial).toBe('PROVISIONAL');
    const existente=await stock(6);
    await request(app.getHttpServer()).patch(`/api/v1/productos/${existente.id}`).set('Authorization',`Bearer ${admin}`).send({precioBob:'31.00'}).expect(200);
    expect((await db.query('SELECT validacion_comercial FROM producto WHERE id=$1',[existente.id])).rows[0].validacion_comercial).toBe('PROVISIONAL');
    await post('operaciones/salidas-directas',salida(existente.id,1)).expect(409);
    // Pedidos conserva su contrato previo: un producto no habilitado devuelve 404.
    const rechazado=await post('pedidos',{clienteId,detalles:[{productoId:existente.id,cantidad:1}]},vendedor).expect(404);
    expect(rechazado.body.message).toBe('Uno o mas productos activos no existen.');
    expect((await db.query('SELECT count(*)::int AS total FROM detalle_pedido WHERE producto_id=$1',[existente.id])).rows[0].total).toBe(0);
    await request(app.getHttpServer()).patch(`/api/v1/productos/${existente.id}`).set('Authorization',`Bearer ${admin}`).send({validacionComercial:'VALIDADO'}).expect(200);
    await post('operaciones/salidas-directas',salida(existente.id,1)).expect(201);
  });
  it('revalida la condición del lote después de esperar al bloqueo de producto', async () => {
    const p=await stock(6),tx=await db.connect();
    let respuesta:Promise<request.Response>|undefined;
    try{
      await tx.query('BEGIN');
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('producto:'||$1::text))",[p.id]);
      respuesta=post('operaciones/salidas-directas',salida(p.id,6)).then(r=>r);
      await expect.poll(async()=>Number((await db.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'")).rows[0].count),{timeout:5000}).toBeGreaterThan(0);
      await tx.query("UPDATE lote SET condicion='BLOQUEADO' WHERE producto_id=$1",[p.id]);
      await tx.query('COMMIT');
      expect((await respuesta).status).toBe(409);
      expect(Number((await db.query('SELECT sum(cantidad_fisica) AS total FROM saldo_inventario WHERE lote_id=ANY($1::uuid[])',[p.lotes])).rows[0].total)).toBe(6);
    }finally{await tx.query('ROLLBACK');tx.release();await respuesta;}
  });
  it('conciliación física/custodia, sin saldos negativos ni asignaciones sin movimientos confirmados', async () => {
    const { body } = await get('operaciones/conciliacion').expect(200);
    expect(body.conciliado).toBe(true);
    expect(
      (await db.query('SELECT * FROM saldo_inventario WHERE cantidad_fisica<0'))
        .rowCount,
    ).toBe(0);
    expect(
      (await db.query('SELECT * FROM saldo_custodia WHERE cantidad<0'))
        .rowCount,
    ).toBe(0);
    expect(
      (await db.query('SELECT * FROM custodia_libre WHERE disponible<0'))
        .rowCount,
    ).toBe(0);
    const {
      rows: [r],
    } = await db.query(
      `SELECT count(*)::int AS total FROM asignacion_operacion a JOIN detalle_operacion d ON d.id=a.detalle_id JOIN operacion_inventario o ON o.id=d.operacion_id LEFT JOIN movimiento m ON m.asignacion_operacion_id=a.id WHERE o.estado='CONFIRMADA' AND m.id IS NULL`,
    );
    expect(r.total).toBe(0);
  });
});
