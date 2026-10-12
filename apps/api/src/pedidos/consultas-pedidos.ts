import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { fechaIso, paginacion, texto, uuid } from '../inventario/validacion.js';
import type { EstadoPedido, FilaPedido, FilaDetalle, FilaDisponibilidad } from './tipos-pedidos.js';

// Lecturas SQL compartidas. Las validaciones de stock reciben el manager de la transacción.
export class ConsultasPedidos {
  constructor(private readonly db: DataSource) {}

  async disponibilidadIds(
    manager: EntityManager | DataSource,
    productoIds?: string[],
  ): Promise<FilaDisponibilidad[]> {
    const filtro = productoIds?.length ? 'AND p.id = ANY($1::uuid[])' : '';
    const parametros = productoIds?.length ? [productoIds] : [];

    return manager.query(
      `WITH fisico AS (
         SELECT l.producto_id,
                COALESCE(SUM(s.cantidad_fisica), 0)::int AS cantidad
         FROM lote l
         JOIN saldo_inventario s ON s.lote_id = l.id
         JOIN ubicacion u ON u.id = s.ubicacion_id
         WHERE u.codigo = 'VENTA_DESPACHO'
           AND l.condicion = 'LIBERADO'
           AND l.vence_el >= CURRENT_DATE
         GROUP BY l.producto_id
       ),
       comprometido AS (
         SELECT d.producto_id, COALESCE(SUM(d.cantidad), 0)::int AS cantidad
         FROM detalle_pedido d
         JOIN pedido pe ON pe.id = d.pedido_id
         WHERE pe.estado = 'REGISTRADO'
         GROUP BY d.producto_id
       )
       SELECT p.id, p.codigo, p.nombre, p.familia, p.presentacion,
              p.peso_gramos, p.precio_bob,
              COALESCE(f.cantidad, 0)::int AS fisico,
              COALESCE(c.cantidad, 0)::int AS comprometido,
              GREATEST(COALESCE(f.cantidad, 0) - COALESCE(c.cantidad, 0), 0)::int AS disponible
       FROM producto p
       LEFT JOIN fisico f ON f.producto_id = p.id
       LEFT JOIN comprometido c ON c.producto_id = p.id
       WHERE p.activo = TRUE ${filtro}
       ORDER BY p.nombre, p.codigo`,
      parametros,
    ) as Promise<FilaDisponibilidad[]>;
  }

  async disponibilidad() {
    const items = await this.disponibilidadIds(this.db);
    return {
      items: items.map((fila) => ({
        productoId: fila.id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        familia: fila.familia,
        presentacion: fila.presentacion,
        pesoGramos: fila.peso_gramos,
        precioBob: fila.precio_bob,
        cantidadFisica: fila.fisico,
        cantidadComprometida: fila.comprometido,
        cantidadDisponible: fila.disponible,
      })),
    };
  }

  async listar(vendedorId: string, consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['estado', 'page', 'limit']);
    let estado: EstadoPedido | 'ACTIVOS' | undefined;
    if (consulta.estado !== undefined) {
      if (
        typeof consulta.estado !== 'string' ||
        !['REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO', 'CANCELADO', 'ACTIVOS'].includes(consulta.estado)
      ) {
        throw new BadRequestException('estado de pedido no valido.');
      }
      estado = consulta.estado as EstadoPedido | 'ACTIVOS';
    }

    const parametros: unknown[] = [vendedorId];
    let filtro = '';
    if (estado === 'ACTIVOS') {
      filtro = `AND pe.estado IN ('REGISTRADO', 'EN_DISTRIBUCION')`;
    } else if (estado) {
      parametros.push(estado);
      filtro = `AND pe.estado = $${parametros.length}`;
    }
    parametros.push(limit, (page - 1) * limit);
    const limitePos = parametros.length - 1;
    const offsetPos = parametros.length;

    const items = await this.db.query(
      `SELECT pe.id, pe.estado, pe.direccion_entrega, pe.destino_latitud, pe.destino_longitud,
              pe.creado_en, pe.retirado_en, pe.entregado_en,
              c.id AS cliente_id, c.nombre AS cliente_nombre,
              COALESCE(SUM(d.cantidad * d.precio_unitario_bob), 0)::numeric(14,2) AS total_bob,
              COALESCE(SUM(d.cantidad), 0)::int AS unidades
       FROM pedido pe
       JOIN cliente c ON c.id = pe.cliente_id
       JOIN detalle_pedido d ON d.pedido_id = pe.id
       WHERE pe.vendedor_id = $1::uuid ${filtro}
       GROUP BY pe.id, c.id, c.nombre
       ORDER BY pe.creado_en DESC, pe.id DESC
       LIMIT $${limitePos} OFFSET $${offsetPos}`,
      parametros,
    ) as Array<Record<string, unknown>>;

    const totalParametros =
      estado && estado !== 'ACTIVOS' ? [vendedorId, estado] : [vendedorId];
    const totalFiltro =
      estado === 'ACTIVOS'
        ? "AND estado IN ('REGISTRADO', 'EN_DISTRIBUCION')"
        : estado
          ? 'AND estado = $2'
          : '';
    const total = await this.db.query(
      `SELECT count(*)::int AS total
       FROM pedido
       WHERE vendedor_id = $1::uuid ${totalFiltro}`,
      totalParametros,
    ) as Array<{ total: number }>;

    return {
      items: items.map((fila) => ({
        id: fila.id,
        estado: fila.estado,
        direccionEntrega: fila.direccion_entrega,
        destinoGps:
          fila.destino_latitud === null
            ? null
            : {
                latitud: Number(fila.destino_latitud),
                longitud: Number(fila.destino_longitud),
              },
        creadoEn: fila.creado_en,
        retiradoEn: fila.retirado_en,
        entregadoEn: fila.entregado_en,
        cliente: { id: fila.cliente_id, nombre: fila.cliente_nombre },
        unidades: fila.unidades,
        totalBob: fila.total_bob,
      })),
      total: total[0].total,
      page,
      limit,
    };
  }

  async listarAdmin(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['estado', 'vendedorId', 'q', 'desde', 'hasta', 'page', 'limit']);
    const parametros: unknown[] = [];
    const filtros: string[] = [];

    if (consulta.estado !== undefined) {
      if (
        typeof consulta.estado !== 'string' ||
        !['REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO', 'CANCELADO'].includes(consulta.estado)
      ) {
        throw new BadRequestException('estado de pedido no valido.');
      }
      parametros.push(consulta.estado);
      filtros.push(`pe.estado = $${parametros.length}`);
    }

    if (consulta.vendedorId !== undefined) {
      parametros.push(uuid(consulta.vendedorId, 'vendedorId'));
      filtros.push(`pe.vendedor_id = $${parametros.length}::uuid`);
    }

    if (consulta.q !== undefined) {
      const q = texto(consulta.q, 'q', 120);
      parametros.push(`%${q}%`);
      filtros.push(
        `(c.nombre ILIKE $${parametros.length} OR u.nombre ILIKE $${parametros.length} OR u.identificador ILIKE $${parametros.length} OR pe.direccion_entrega ILIKE $${parametros.length})`,
      );
    }

    if (consulta.desde !== undefined) {
      const desde = fechaIso(consulta.desde, 'desde');
      parametros.push(desde);
      filtros.push(`pe.creado_en >= $${parametros.length}::date`);
    }

    if (consulta.hasta !== undefined) {
      const hasta = fechaIso(consulta.hasta, 'hasta');
      parametros.push(hasta);
      filtros.push(
        `pe.creado_en < ($${parametros.length}::date + interval '1 day')`,
      );
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    parametros.push(limit, (page - 1) * limit);
    const limitePos = parametros.length - 1;
    const offsetPos = parametros.length;

    const items = await this.db.query(
      `SELECT pe.id, pe.estado, pe.direccion_entrega, pe.creado_en,
              pe.retirado_en, pe.entregado_en,
              c.id AS cliente_id, c.nombre AS cliente_nombre,
              u.id AS vendedor_id, u.nombre AS vendedor_nombre,
              u.identificador AS vendedor_identificador,
              COALESCE(SUM(d.cantidad * d.precio_unitario_bob), 0)::numeric(14,2) AS total_bob,
              COALESCE(SUM(d.cantidad), 0)::int AS unidades
       FROM pedido pe
       JOIN cliente c ON c.id = pe.cliente_id
       JOIN usuario u ON u.id = pe.vendedor_id
       JOIN detalle_pedido d ON d.pedido_id = pe.id
       ${where}
       GROUP BY pe.id, c.id, c.nombre, u.id, u.nombre, u.identificador
       ORDER BY pe.creado_en DESC, pe.id DESC
       LIMIT $${limitePos} OFFSET $${offsetPos}`,
      parametros,
    ) as Array<Record<string, unknown>>;

    const totalParametros = parametros.slice(0, filtros.length);
    const total = await this.db.query(
      `SELECT count(*)::int AS total
       FROM pedido pe
       JOIN cliente c ON c.id = pe.cliente_id
       JOIN usuario u ON u.id = pe.vendedor_id
       ${where}`,
      totalParametros,
    ) as Array<{ total: number }>;

    return {
      items: items.map((fila) => ({
        id: fila.id,
        estado: fila.estado,
        direccionEntrega: fila.direccion_entrega,
        creadoEn: fila.creado_en,
        retiradoEn: fila.retirado_en,
        entregadoEn: fila.entregado_en,
        cliente: {
          id: fila.cliente_id,
          nombre: fila.cliente_nombre,
        },
        vendedor: {
          id: fila.vendedor_id,
          nombre: fila.vendedor_nombre,
          identificador: fila.vendedor_identificador,
        },
        unidades: fila.unidades,
        totalBob: fila.total_bob,
      })),
      total: total[0].total,
      page,
      limit,
    };
  }

  async obtener(idEntrada: string, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const pedidos = await this.db.query(
      `SELECT pe.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
              u.nombre AS vendedor_nombre
       FROM pedido pe
       JOIN cliente c ON c.id = pe.cliente_id
       JOIN usuario u ON u.id = pe.vendedor_id
       WHERE pe.id = $1::uuid AND pe.vendedor_id = $2::uuid`,
      [id, vendedorId],
    ) as FilaPedido[];
    if (!pedidos.length) throw new NotFoundException('Pedido no encontrado.');

    const detalles = await this.db.query(
      `SELECT d.id, d.producto_id, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
              d.cantidad, d.precio_unitario_bob,
              (d.cantidad * d.precio_unitario_bob)::numeric(14,2) AS subtotal_bob
       FROM detalle_pedido d
       JOIN producto p ON p.id = d.producto_id
       WHERE d.pedido_id = $1::uuid
       ORDER BY p.nombre, p.codigo`,
      [id],
    ) as FilaDetalle[];

    const pedido = pedidos[0];
    const total = detalles.reduce((acum, d) => acum + Number(d.subtotal_bob), 0);

    return {
      id: pedido.id,
      estado: pedido.estado,
      direccionEntrega: pedido.direccion_entrega,
      observacion: pedido.observacion,
      destinoGps:
        pedido.destino_latitud === null
          ? null
          : {
              latitud: Number(pedido.destino_latitud),
              longitud: Number(pedido.destino_longitud),
            },
      creadoEn: pedido.creado_en,
      retiradoEn: pedido.retirado_en,
      entregadoEn: pedido.entregado_en,
      canceladoEn: pedido.cancelado_en,
      cancelacionMotivo: pedido.cancelacion_motivo,
      entregaGps: pedido.entrega_latitud === null ? null : {
        latitud: Number(pedido.entrega_latitud),
        longitud: Number(pedido.entrega_longitud),
        precisionMetros:
          pedido.entrega_precision_m === null ? null : Number(pedido.entrega_precision_m),
        distanciaDestinoMetros:
          pedido.entrega_distancia_destino_m === null
            ? null
            : Number(pedido.entrega_distancia_destino_m),
        observacion: pedido.entrega_observacion,
      },
      cliente: {
        id: pedido.cliente_id,
        nombre: pedido.cliente_nombre,
        telefono: pedido.cliente_telefono,
      },
      vendedor: {
        id: pedido.vendedor_id,
        nombre: pedido.vendedor_nombre,
      },
      detalles: detalles.map((d) => ({
        id: d.id,
        productoId: d.producto_id,
        codigo: d.producto_codigo,
        nombre: d.producto_nombre,
        cantidad: d.cantidad,
        precioUnitarioBob: d.precio_unitario_bob,
        subtotalBob: d.subtotal_bob,
      })),
      totalBob: total.toFixed(2),
    };
  }

}
