import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { bloquearProductos } from '../inventario/bloqueos.js';
import {
  disponibilidadDespacho,
  lotesFefo,
} from '../inventario/disponibilidad.js';
import {
  enteroPositivo,
  FECHA_HOY_BOLIVIA_SQL,
  objeto,
  paginacion,
  texto,
  uuid,
} from '../inventario/validacion.js';
import {
  detallesEntrada,
  numeroRango,
  opcional,
} from '../pedidos/validacion-pedidos.js';
import { respuestaCatalogo } from '../catalogo/validacion-catalogo.js';

export type Actor = { id: string; rol: string };
type Tipo = 'SALIDA_DIRECTA' | 'CARGA' | 'DEVOLUCION' | 'REVERSION';
type Fila = Record<string, unknown>;
type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  presentacion: string;
  familia: string;
  peso_gramos: number;
  tipo_empaque: string;
  precio_bob: string;
  validacion_comercial: string;
};
type Asignacion = { id: string; lote_id: string; cantidad: number };

@Injectable()
export class OperacionesService {
  constructor(private readonly db: DataSource) {}

  private admin(actor: Actor) {
    if (actor.rol !== 'ADMINISTRADOR')
      throw new ForbiddenException(
        'Solo el Administrador puede realizar esta operación.',
      );
  }
  private async anterior(
    m: EntityManager,
    clave: string,
    actor: Actor,
    solicitud: unknown,
  ) {
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [clave]);
    const [previo] = (await m.query(
      `SELECT id,usuario_id,solicitud=$2::jsonb AS coincide FROM operacion_inventario WHERE operacion_clave=$1`,
      [clave, JSON.stringify(solicitud)],
    )) as Array<{ id: string; usuario_id: string; coincide: boolean }>;
    if (previo) {
      if (previo.usuario_id !== actor.id || !previo.coincide)
        throw new ConflictException(
          'La clave ya se utilizó con otros datos o responsable.',
        );
      return previo.id;
    }
    const usados = (await m.query(
      `SELECT id FROM evento_operacion WHERE operacion_clave=$1 UNION ALL SELECT id FROM movimiento WHERE operacion_clave=$1`,
      [clave],
    )) as Fila[];
    if (usados.length)
      throw new ConflictException('La clave ya identifica otra operación.');
    return null;
  }
  private async ubicaciones(m: EntityManager) {
    const filas = (await m.query(
      `SELECT id,codigo,latitud,longitud FROM ubicacion WHERE activa AND codigo IN ('VENTA_DESPACHO','EN_DISTRIBUCION','DEVOLUCIONES_INSPECCION')`,
    )) as Array<{
      id: string;
      codigo: string;
      latitud: string | null;
      longitud: string | null;
    }>;
    const mapa = new Map(filas.map((f) => [f.codigo, f]));
    if (mapa.size !== 3)
      throw new ConflictException('Faltan ubicaciones operativas activas.');
    return {
      despacho: mapa.get('VENTA_DESPACHO')!,
      distribucion: mapa.get('EN_DISTRIBUCION')!,
      inspeccion: mapa.get('DEVOLUCIONES_INSPECCION')!,
    };
  }
  private async mover(
    m: EntityManager,
    asignaciones: Asignacion[],
    tipo: Tipo,
    origen: string | null,
    destino: string | null,
    actor: Actor,
    operacionId: string,
  ) {
    for (const a of asignaciones)
      await m.query(
        `INSERT INTO movimiento(operacion_clave,lote_id,tipo,origen_id,destino_id,cantidad,usuario_id,referencia,motivo,asignacion_operacion_id)
      VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$2,$8)`,
        [
          a.lote_id,
          tipo,
          origen,
          destino,
          a.cantidad,
          actor.id,
          operacionId,
          a.id,
        ],
      );
  }
  private async productos(
    m: EntityManager,
    ids: string[],
    exigeHabilitado = true,
  ) {
    return m.query(
      `SELECT p.* FROM producto p JOIN producto_comercial c ON c.id=p.producto_comercial_id JOIN familia f ON f.id=c.familia_id
      WHERE p.id=ANY($1::uuid[]) ${exigeHabilitado ? "AND p.activo AND c.activo AND f.activo AND p.validacion_comercial<>'PROVISIONAL'" : ''}`,
      [ids],
    ) as Promise<Producto[]>;
  }
  private async detalle(
    m: EntityManager,
    op: string,
    p: Producto,
    cantidad: number,
  ) {
    const snapshot = {
      codigo: p.codigo,
      nombre: p.nombre,
      familia: p.familia,
      presentacion: p.presentacion,
      pesoGramos: p.peso_gramos,
      tipoEmpaque: p.tipo_empaque,
      validacionComercial: p.validacion_comercial,
    };
    const [d] = (await m.query(
      `INSERT INTO detalle_operacion(operacion_id,producto_id,cantidad,producto_historico,precio_unitario_bob) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [
        op,
        p.id,
        cantidad,
        JSON.stringify(snapshot),
        p.validacion_comercial === 'VALIDADO' ? p.precio_bob : null,
      ],
    )) as { id: string }[];
    return d.id;
  }
  private async asignar(
    m: EntityManager,
    detalleId: string,
    loteId: string,
    cantidad: number,
    condicion: string,
  ) {
    const [a] = (await m.query(
      `INSERT INTO asignacion_operacion(detalle_id,lote_id,cantidad,condicion_al_registrar) VALUES($1,$2,$3,$4) RETURNING id,lote_id,cantidad`,
      [detalleId, loteId, cantidad, condicion],
    )) as Asignacion[];
    return a;
  }
  async crear(
    tipo: 'SALIDA_DIRECTA' | 'CARGA',
    entrada: unknown,
    actor: Actor,
  ) {
    if (tipo === 'CARGA') this.admin(actor);
    const esMovil = tipo === 'SALIDA_DIRECTA' && actor.rol === 'VENDEDOR';
    const datos = objeto(entrada, [
      'operacionClave',
      'detalles',
      ...(tipo === 'CARGA'
        ? ['vendedorId']
        : esMovil
          ? ['latitud', 'longitud', 'precisionMetros']
          : []),
    ]);
    const clave = uuid(datos.operacionClave, 'operacionClave');
    const detalles = detallesEntrada(datos.detalles).sort((a, b) =>
      a.productoId.localeCompare(b.productoId),
    );
    const vendedorId =
      tipo === 'CARGA'
        ? uuid(datos.vendedorId, 'vendedorId')
        : esMovil
          ? actor.id
          : null;
    const gps = esMovil
      ? {
          latitud: numeroRango(datos.latitud, 'latitud', -90, 90),
          longitud: numeroRango(datos.longitud, 'longitud', -180, 180),
          precisionMetros: numeroRango(
            datos.precisionMetros,
            'precisionMetros',
            0,
            100000,
          ),
        }
      : null;
    const solicitud = { tipo, detalles, vendedorId, gps };
    const id = await this.db.transaction(async (m) => {
      const anterior = await this.anterior(m, clave, actor, solicitud);
      if (anterior) return anterior;
      await bloquearProductos(
        m,
        detalles.map((d) => d.productoId),
      );
      if (vendedorId) {
        const v = (await m.query(
          "SELECT id FROM usuario WHERE id=$1 AND activo AND rol='VENDEDOR'",
          [vendedorId],
        )) as Fila[];
        if (!v.length)
          throw new ConflictException('Vendedor activo no encontrado.');
      }
      const productos = await this.productos(
        m,
        detalles.map((d) => d.productoId),
      );
      if (productos.length !== detalles.length)
        throw new ConflictException(
          'Seleccione presentaciones activas y comercialmente habilitadas. Los datos provisionales requieren validación.',
        );
      const u = await this.ubicaciones(m);
      if (tipo === 'SALIDA_DIRECTA' && !esMovil && u.despacho.latitud === null)
        throw new ConflictException(
          'Configure la ubicación de VENTA_DESPACHO en Distribución antes de confirmar.',
        );
      const libre = esMovil
        ? []
        : await disponibilidadDespacho(
            m,
            detalles.map((d) => d.productoId),
          );
      const [op] = (await m.query(
        `INSERT INTO operacion_inventario(operacion_clave,tipo,estado,usuario_id,vendedor_id,cliente_id,solicitud,latitud,longitud,precision_m)
        VALUES($1,$2::text,$3,$4,$5,(SELECT id FROM cliente WHERE es_consumidor_final AND $2::text='SALIDA_DIRECTA'),$6,$7,$8,$9) RETURNING id`,
        [
          clave,
          tipo,
          tipo === 'CARGA' ? 'PENDIENTE_RECEPCION' : 'CONFIRMADA',
          actor.id,
          vendedorId,
          JSON.stringify(solicitud),
          gps?.latitud ??
            (tipo === 'SALIDA_DIRECTA' ? u.despacho.latitud : null),
          gps?.longitud ??
            (tipo === 'SALIDA_DIRECTA' ? u.despacho.longitud : null),
          gps?.precisionMetros ?? null,
        ],
      )) as { id: string }[];
      for (const d of detalles) {
        if (
          !esMovil &&
          (libre.find((p) => p.id === d.productoId)?.disponible ?? 0) <
            d.cantidad
        )
          throw new ConflictException(
            'Stock libre insuficiente; se preservan los compromisos de pedidos.',
          );
        const p = productos.find((p) => p.id === d.productoId)!;
        const detalleId = await this.detalle(m, op.id, p, d.cantidad);
        const lotes = esMovil
          ? ((await m.query(
              `SELECT l.id,l.condicion,c.disponible AS cantidad_fisica FROM custodia_libre c JOIN lote l ON l.id=c.lote_id
          WHERE c.vendedor_id=$1 AND l.producto_id=$2 AND c.disponible>0 AND l.condicion='LIBERADO' AND l.vence_el>=${FECHA_HOY_BOLIVIA_SQL}
          ORDER BY l.vence_el,l.creado_en,l.id`,
              [actor.id, p.id],
            )) as { id: string; condicion: string; cantidad_fisica: number }[])
          : await lotesFefo(m, p.id, u.despacho.id);
        let restante = d.cantidad;
        const asignaciones: Asignacion[] = [];
        for (const l of lotes) {
          if (!restante) break;
          const cantidad = Math.min(restante, l.cantidad_fisica);
          asignaciones.push(
            await this.asignar(m, detalleId, l.id, cantidad, l.condicion),
          );
          restante -= cantidad;
        }
        if (restante)
          throw new ConflictException(
            'No hay suficientes lotes elegibles en su stock libre.',
          );
        await this.mover(
          m,
          asignaciones,
          tipo,
          esMovil ? u.distribucion.id : u.despacho.id,
          tipo === 'CARGA' ? u.distribucion.id : null,
          actor,
          op.id,
        );
      }
      return op.id;
    });
    return this.obtener(id, actor);
  }

  async devolver(entrada: unknown, actor: Actor) {
    if (actor.rol !== 'VENDEDOR')
      throw new ForbiddenException(
        'La devolución debe solicitarla el Vendedor que posee la mercancía.',
      );
    const datos = objeto(entrada, ['operacionClave', 'lotes', 'motivo']);
    const clave = uuid(datos.operacionClave, 'operacionClave');
    const motivo = texto(datos.motivo, 'motivo', 300);
    if (
      !Array.isArray(datos.lotes) ||
      !datos.lotes.length ||
      datos.lotes.length > 100
    )
      throw new BadRequestException('Seleccione entre 1 y 100 lotes.');
    const lotes = datos.lotes
      .map((x) => {
        const d = objeto(x, ['loteId', 'cantidad']);
        return {
          loteId: uuid(d.loteId, 'loteId'),
          cantidad: enteroPositivo(d.cantidad, 'cantidad'),
        };
      })
      .sort((a, b) => a.loteId.localeCompare(b.loteId));
    if (new Set(lotes.map((l) => l.loteId)).size !== lotes.length)
      throw new BadRequestException('No repita lotes.');
    const solicitud = { tipo: 'DEVOLUCION', lotes, motivo };
    const id = await this.db.transaction(async (m) => {
      const anterior = await this.anterior(m, clave, actor, solicitud);
      if (anterior) return anterior;
      const refs = (await m.query(
        'SELECT id,producto_id FROM lote WHERE id=ANY($1::uuid[])',
        [lotes.map((l) => l.loteId)],
      )) as { id: string; producto_id: string }[];
      if (refs.length !== lotes.length)
        throw new NotFoundException('Lote no encontrado.');
      await bloquearProductos(
        m,
        refs.map((l) => l.producto_id),
      );
      const productos = await this.productos(
        m,
        [...new Set(refs.map((l) => l.producto_id))],
        false,
      );
      const [op] = (await m.query(
        `INSERT INTO operacion_inventario(operacion_clave,tipo,estado,usuario_id,vendedor_id,solicitud,motivo)
        VALUES($1,'DEVOLUCION','PENDIENTE_RECEPCION',$2,$2,$3,$4) RETURNING id`,
        [clave, actor.id, JSON.stringify(solicitud), motivo],
      )) as { id: string }[];
      for (const p of productos) {
        const delProducto = lotes.filter(
          (l) => refs.find((r) => r.id === l.loteId)?.producto_id === p.id,
        );
        const detalleId = await this.detalle(
          m,
          op.id,
          p,
          delProducto.reduce((s, l) => s + l.cantidad, 0),
        );
        for (const l of delProducto) {
          const [stock] = (await m.query(
            `SELECT c.disponible,l.condicion FROM custodia_libre c JOIN lote l ON l.id=c.lote_id WHERE c.vendedor_id=$1 AND c.lote_id=$2`,
            [actor.id, l.loteId],
          )) as { disponible: number; condicion: string }[];
          if (!stock || stock.disponible < l.cantidad)
            throw new ConflictException(
              'La devolución supera su custodia libre disponible.',
            );
          // Vencidos o bloqueados también deben poder regresar, siempre a inspección.
          await this.asignar(
            m,
            detalleId,
            l.loteId,
            l.cantidad,
            stock.condicion,
          );
        }
      }
      return op.id;
    });
    return this.obtener(id, actor);
  }

  async recibir(
    idEntrada: string,
    accion: 'RECEPCION_CARGA' | 'RECEPCION_DEVOLUCION',
    entrada: unknown,
    actor: Actor,
  ) {
    if (accion === 'RECEPCION_DEVOLUCION') this.admin(actor);
    const id = uuid(idEntrada, 'id');
    const d = objeto(entrada, ['operacionClave', 'observacion']);
    const clave = uuid(d.operacionClave, 'operacionClave');
    const solicitud = {
      accion,
      id,
      observacion: opcional(d.observacion, 'observacion', 300),
    };
    await this.db.transaction(async (m) => {
      await this.anterior(m, clave, actor, solicitud).catch(async (e) => {
        // Las claves de eventos se verifican abajo incluyendo responsable y payload.
        if (!(e instanceof ConflictException)) throw e;
        const [ev] = (await m.query(
          'SELECT usuario_id,solicitud=$2::jsonb AS coincide FROM evento_operacion WHERE operacion_clave=$1',
          [clave, JSON.stringify(solicitud)],
        )) as { usuario_id: string; coincide: boolean }[];
        if (!ev || ev.usuario_id !== actor.id || !ev.coincide) throw e;
      });
      const [op] = (await m.query(
        'SELECT * FROM operacion_inventario WHERE id=$1 FOR UPDATE',
        [id],
      )) as Fila[];
      if (!op || (actor.rol !== 'ADMINISTRADOR' && op.vendedor_id !== actor.id))
        throw new NotFoundException('Operación no encontrada.');
      if (accion === 'RECEPCION_CARGA' && op.vendedor_id !== actor.id)
        throw new ForbiddenException('Solo el destinatario confirma la carga.');
      if (op.tipo !== (accion === 'RECEPCION_CARGA' ? 'CARGA' : 'DEVOLUCION'))
        throw new ConflictException('La operación no admite esta recepción.');
      const eventos = (await m.query(
        'SELECT id FROM evento_operacion WHERE operacion_clave=$1',
        [clave],
      )) as Fila[];
      if (eventos.length) return;
      if (op.estado !== 'PENDIENTE_RECEPCION')
        throw new ConflictException('La operación ya fue recibida.');
      const detalles = (await m.query(
        'SELECT producto_id FROM detalle_operacion WHERE operacion_id=$1',
        [id],
      )) as { producto_id: string }[];
      await bloquearProductos(
        m,
        detalles.map((d) => d.producto_id),
      );
      if (accion === 'RECEPCION_DEVOLUCION') {
        const asignaciones = (await m.query(
          `SELECT a.* FROM asignacion_operacion a JOIN detalle_operacion d ON d.id=a.detalle_id WHERE d.operacion_id=$1`,
          [id],
        )) as Asignacion[];
        for (const a of asignaciones) {
          const [s] = (await m.query(
            "SELECT cantidad FROM saldo_custodia WHERE vendedor_id=$1 AND lote_id=$2 AND finalidad='LIBRE'",
            [op.vendedor_id, a.lote_id],
          )) as { cantidad: number }[];
          if (!s || s.cantidad < a.cantidad)
            throw new ConflictException(
              'No coincide la custodia física a devolver.',
            );
        }
        const u = await this.ubicaciones(m);
        await this.mover(
          m,
          asignaciones,
          'DEVOLUCION',
          u.distribucion.id,
          u.inspeccion.id,
          actor,
          id,
        );
      }
      await m.query(
        `INSERT INTO evento_operacion(operacion_id,operacion_clave,usuario_id,accion,solicitud) VALUES($1,$2,$3,$4,$5)`,
        [id, clave, actor.id, accion, JSON.stringify(solicitud)],
      );
      await m.query(
        "UPDATE operacion_inventario SET estado='CONFIRMADA' WHERE id=$1",
        [id],
      );
    });
    return this.obtener(id, actor);
  }

  async revertir(idEntrada: string, entrada: unknown, actor: Actor) {
    this.admin(actor);
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, [
      'operacionClave',
      'motivo',
      'recepcionFisicaConfirmada',
    ]);
    if (datos.recepcionFisicaConfirmada !== true)
      throw new BadRequestException(
        'Confirme la recepción física de todas las unidades antes de revertir.',
      );
    const clave = uuid(datos.operacionClave, 'operacionClave');
    const motivo = texto(datos.motivo, 'motivo', 300);
    const solicitud = {
      tipo: 'REVERSION',
      id,
      motivo,
      recepcionFisicaConfirmada: true,
    };
    const nuevo = await this.db.transaction(async (m) => {
      const previo = await this.anterior(m, clave, actor, solicitud);
      if (previo) return previo;
      const [origen] = (await m.query(
        'SELECT * FROM operacion_inventario WHERE id=$1 FOR UPDATE',
        [id],
      )) as Fila[];
      if (!origen || origen.tipo !== 'SALIDA_DIRECTA')
        throw new ConflictException(
          'Solo se revierte una salida directa confirmada.',
        );
      if (
        (
          (await m.query(
            'SELECT id FROM operacion_inventario WHERE revierte_id=$1',
            [id],
          )) as Fila[]
        ).length
      )
        throw new ConflictException('La salida ya tiene una reversión.');
      const detalles = (await m.query(
        'SELECT * FROM detalle_operacion WHERE operacion_id=$1',
        [id],
      )) as Array<{
        id: string;
        producto_id: string;
        cantidad: number;
        producto_historico: unknown;
        precio_unitario_bob: string | null;
      }>;
      await bloquearProductos(
        m,
        detalles.map((d) => d.producto_id),
      );
      const u = await this.ubicaciones(m);
      const [op] = (await m.query(
        `INSERT INTO operacion_inventario(operacion_clave,tipo,estado,usuario_id,vendedor_id,solicitud,motivo,revierte_id)
        VALUES($1,'REVERSION','CONFIRMADA',$2,$3,$4,$5,$6) RETURNING id`,
        [
          clave,
          actor.id,
          origen.vendedor_id,
          JSON.stringify(solicitud),
          motivo,
          id,
        ],
      )) as { id: string }[];
      for (const d of detalles) {
        const [nuevoDetalle] = (await m.query(
          `INSERT INTO detalle_operacion(operacion_id,producto_id,cantidad,producto_historico,precio_unitario_bob) VALUES($1,$2,$3,$4,$5) RETURNING id`,
          [
            op.id,
            d.producto_id,
            d.cantidad,
            JSON.stringify(d.producto_historico),
            d.precio_unitario_bob,
          ],
        )) as { id: string }[];
        const lotes = (await m.query(
          'SELECT a.lote_id,a.cantidad,l.condicion FROM asignacion_operacion a JOIN lote l ON l.id=a.lote_id WHERE a.detalle_id=$1',
          [d.id],
        )) as Array<{ lote_id: string; cantidad: number; condicion: string }>;
        for (const l of lotes) {
          const a = await this.asignar(
            m,
            nuevoDetalle.id,
            l.lote_id,
            l.cantidad,
            l.condicion,
          );
          await this.mover(
            m,
            [a],
            'REVERSION',
            null,
            u.inspeccion.id,
            actor,
            op.id,
          );
        }
      }
      return op.id;
    });
    return this.obtener(nuevo, actor);
  }
  async conciliacion(actor: Actor) {
    this.admin(actor);
    const filas = (await this.db.query(`WITH fisico AS (
      SELECT s.lote_id,s.cantidad_fisica FROM saldo_inventario s JOIN ubicacion u ON u.id=s.ubicacion_id WHERE u.codigo='EN_DISTRIBUCION'
    ),custodia AS (SELECT lote_id,sum(cantidad)::int AS cantidad,sum(CASE WHEN vendedor_id IS NULL THEN cantidad ELSE 0 END)::int AS sin_responsable FROM saldo_custodia GROUP BY lote_id)
    SELECT l.id AS lote_id,l.codigo,COALESCE(f.cantidad_fisica,0)::int AS fisico,COALESCE(c.cantidad,0)::int AS custodia,
      COALESCE(c.sin_responsable,0)::int AS sin_responsable,(COALESCE(f.cantidad_fisica,0)-COALESCE(c.cantidad,0))::int AS diferencia
    FROM lote l LEFT JOIN fisico f ON f.lote_id=l.id LEFT JOIN custodia c ON c.lote_id=l.id WHERE f.lote_id IS NOT NULL OR c.lote_id IS NOT NULL ORDER BY l.codigo`)) as Fila[];
    return {
      items: filas.map(respuestaCatalogo),
      conciliado: filas.every(
        (f) => f.diferencia === 0 && f.sin_responsable === 0,
      ),
    };
  }
  async disponibilidad(actor: Actor) {
    if (actor.rol === 'ADMINISTRADOR') {
      const rows = await disponibilidadDespacho(this.db);
      return {
        items: rows.map((p) => ({
          productoId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          presentacion: p.presentacion,
          cantidadDisponible: p.disponible,
          cantidadComprometida: p.comprometido,
        })),
      };
    }
    const rows = (await this.db.query(
      `SELECT p.id AS producto_id,p.codigo,p.nombre,p.presentacion,sum(c.disponible)::int AS cantidad_disponible
      FROM custodia_libre c JOIN lote l ON l.id=c.lote_id JOIN producto p ON p.id=l.producto_id JOIN producto_comercial pc ON pc.id=p.producto_comercial_id JOIN familia f ON f.id=pc.familia_id
      WHERE c.vendedor_id=$1 AND c.disponible>0 AND l.condicion='LIBERADO' AND l.vence_el>=${FECHA_HOY_BOLIVIA_SQL}
        AND p.activo AND pc.activo AND f.activo AND p.validacion_comercial<>'PROVISIONAL'
      GROUP BY p.id ORDER BY p.nombre,p.codigo`,
      [actor.id],
    )) as Fila[];
    return { items: rows.map(respuestaCatalogo) };
  }
  async custodia(actor: Actor, consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, [
      'vendedorId',
      'page',
      'limit',
    ]);
    const vendedor =
      actor.rol === 'VENDEDOR'
        ? actor.id
        : consulta.vendedorId === undefined
          ? null
          : uuid(consulta.vendedorId, 'vendedorId');
    if (
      actor.rol === 'VENDEDOR' &&
      consulta.vendedorId !== undefined &&
      consulta.vendedorId !== actor.id
    )
      throw new ForbiddenException('Solo puede consultar su propia custodia.');
    const filas = (await this.db.query(
      `SELECT s.vendedor_id,u.nombre AS vendedor_nombre,s.lote_id,l.codigo AS lote_codigo,l.producto_id,p.nombre,p.codigo,p.presentacion,l.condicion,l.vence_el,s.finalidad,s.cantidad,
        CASE WHEN s.finalidad='LIBRE' THEN c.disponible ELSE 0 END AS libre,
        COALESCE(c.pendiente,0) AS pendiente, (l.condicion='LIBERADO' AND l.vence_el>=${FECHA_HOY_BOLIVIA_SQL}) AS elegible
      FROM saldo_custodia s JOIN lote l ON l.id=s.lote_id JOIN producto p ON p.id=l.producto_id LEFT JOIN usuario u ON u.id=s.vendedor_id
      LEFT JOIN custodia_libre c ON c.vendedor_id=s.vendedor_id AND c.lote_id=s.lote_id AND s.finalidad='LIBRE'
      WHERE s.cantidad<>0 AND ($1::uuid IS NULL OR s.vendedor_id=$1) ORDER BY u.nombre,p.nombre,l.vence_el,l.id,s.finalidad LIMIT $2 OFFSET $3`,
      [vendedor, limit, (page - 1) * limit],
    )) as Fila[];
    return { items: filas.map(respuestaCatalogo), page, limit };
  }
  async vendedores(actor: Actor) {
    this.admin(actor);
    return {
      items: (await this.db.query(
        "SELECT id,nombre FROM usuario WHERE activo AND rol='VENDEDOR' ORDER BY nombre",
      )) as Fila[],
    };
  }
  async listar(actor: Actor, consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, [
      'page',
      'limit',
      'tipo',
      'estado',
    ]);
    const tipo =
      consulta.tipo === undefined ? null : texto(consulta.tipo, 'tipo', 24);
    const estado =
      consulta.estado === undefined
        ? null
        : texto(consulta.estado, 'estado', 24);
    const parametros = [
      actor.rol === 'ADMINISTRADOR' ? null : actor.id,
      tipo,
      estado,
    ];
    const where =
      'WHERE ($1::uuid IS NULL OR o.vendedor_id=$1) AND ($2::text IS NULL OR o.tipo=$2) AND ($3::text IS NULL OR o.estado=$3)';
    const rows = (await this.db.query(
      `SELECT o.id,o.tipo,o.estado,o.creado_en,o.usuario_id,o.vendedor_id,u.nombre AS responsable,v.nombre AS vendedor_nombre,
      (SELECT sum(cantidad)::int FROM detalle_operacion WHERE operacion_id=o.id) AS unidades,
      (SELECT id FROM operacion_inventario WHERE revierte_id=o.id) AS reversion_id
      FROM operacion_inventario o JOIN usuario u ON u.id=o.usuario_id LEFT JOIN usuario v ON v.id=o.vendedor_id ${where} ORDER BY o.creado_en DESC,o.id LIMIT $4 OFFSET $5`,
      [...parametros, limit, (page - 1) * limit],
    )) as Fila[];
    const [count] = (await this.db.query(
      `SELECT count(*)::int AS total FROM operacion_inventario o ${where}`,
      parametros,
    )) as { total: number }[];
    return {
      items: rows.map(respuestaCatalogo),
      total: count.total,
      page,
      limit,
    };
  }
  async obtener(idEntrada: string, actor: Actor) {
    const [op] = (await this.db.query(
      `SELECT o.*,u.nombre AS responsable,v.nombre AS vendedor_nombre,c.nombre AS cliente_nombre,
      (SELECT id FROM operacion_inventario WHERE revierte_id=o.id) AS reversion_id
      FROM operacion_inventario o JOIN usuario u ON u.id=o.usuario_id LEFT JOIN usuario v ON v.id=o.vendedor_id LEFT JOIN cliente c ON c.id=o.cliente_id
      WHERE o.id=$1 AND ($2::uuid IS NULL OR o.vendedor_id=$2)`,
      [uuid(idEntrada, 'id'), actor.rol === 'ADMINISTRADOR' ? null : actor.id],
    )) as Fila[];
    if (!op) throw new NotFoundException('Operación no encontrada.');
    const detalles = (await this.db.query(
      `SELECT d.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('loteId',a.lote_id,'codigo',l.codigo,'cantidad',a.cantidad,'condicionAlRegistrar',a.condicion_al_registrar,'movimientoId',m.id))
      FROM asignacion_operacion a JOIN lote l ON l.id=a.lote_id LEFT JOIN movimiento m ON m.asignacion_operacion_id=a.id WHERE a.detalle_id=d.id),'[]'::jsonb) AS lotes
      FROM detalle_operacion d WHERE d.operacion_id=$1 ORDER BY d.producto_id`,
      [op.id],
    )) as Fila[];
    const eventos = (await this.db.query(
      `SELECT e.accion,e.usuario_id,u.nombre AS responsable,e.solicitud,e.creado_en FROM evento_operacion e JOIN usuario u ON u.id=e.usuario_id WHERE e.operacion_id=$1 ORDER BY e.creado_en`,
      [op.id],
    )) as Fila[];
    return {
      ...respuestaCatalogo(op),
      detalles: detalles.map(respuestaCatalogo),
      eventos: eventos.map(respuestaCatalogo),
    };
  }
}
