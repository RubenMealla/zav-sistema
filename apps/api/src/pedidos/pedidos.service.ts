import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { enteroPositivo, objeto, paginacion, texto, uuid } from '../inventario/validacion.js';
import { distanciaHaversine } from './geografia.service.js';

const CAMPOS_PEDIDO = ['clienteId', 'direccionEntrega', 'observacion', 'detalles'] as const;
const CAMPOS_DETALLE = ['productoId', 'cantidad'] as const;
const CAMPOS_RETIRO = ['operacionClave'] as const;
const CAMPOS_RETIROS = ['retiros'] as const;
const CAMPOS_RETIRO_ITEM = ['pedidoId', 'operacionClave'] as const;
const CAMPOS_ENTREGA = ['operacionClave', 'latitud', 'longitud', 'precisionMetros', 'observacionDistancia'] as const;
const CAMPOS_CANCELACION = ['motivo'] as const;

type EstadoPedido = 'REGISTRADO' | 'EN_DISTRIBUCION' | 'ENTREGADO' | 'CANCELADO';

type DetalleEntrada = {
  productoId: string;
  cantidad: number;
};

type FilaPedido = {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  estado: EstadoPedido;
  direccion_entrega: string;
  observacion: string | null;
  destino_latitud: string | null;
  destino_longitud: string | null;
  retiro_operacion_clave: string | null;
  retirado_en: Date | null;
  entrega_operacion_clave: string | null;
  entregado_en: Date | null;
  entrega_latitud: string | null;
  entrega_longitud: string | null;
  entrega_precision_m: string | null;
  entrega_distancia_destino_m: string | null;
  entrega_observacion: string | null;
  cancelado_en: Date | null;
  cancelacion_motivo: string | null;
  creado_en: Date;
  actualizado_en: Date;
  cliente_nombre: string;
  cliente_telefono: string | null;
  vendedor_nombre: string;
};

type FilaDetalle = {
  id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario_bob: string;
  subtotal_bob: string;
};

type FilaDisponibilidad = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  presentacion: string;
  peso_gramos: number;
  precio_bob: string;
  fisico: number;
  comprometido: number;
  disponible: number;
};

function opcional(valor: unknown, campo: string, maximo: number): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return texto(valor, campo, maximo);
}

function numeroRango(valor: unknown, campo: string, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new BadRequestException(`${campo} debe estar entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

function numeroOpcionalNoNegativo(valor: unknown, campo: string, maximo: number): number | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw new BadRequestException(`${campo} debe ser un numero entre 0 y ${maximo}.`);
  }
  return valor;
}

@Injectable()
export class PedidosService {
  constructor(private readonly db: DataSource) {}

  private detallesEntrada(valor: unknown): DetalleEntrada[] {
    if (!Array.isArray(valor) || valor.length < 1 || valor.length > 50) {
      throw new BadRequestException('detalles debe contener entre 1 y 50 productos.');
    }

    const detalles = valor.map((elemento, indice) => {
      const datos = objeto(elemento, CAMPOS_DETALLE);
      return {
        productoId: uuid(datos.productoId, `detalles[${indice}].productoId`),
        cantidad: enteroPositivo(datos.cantidad, `detalles[${indice}].cantidad`),
      };
    });

    if (new Set(detalles.map((d) => d.productoId)).size !== detalles.length) {
      throw new BadRequestException('Un producto no puede repetirse dentro del mismo pedido.');
    }

    return detalles;
  }

  private async bloquearProductos(manager: EntityManager, productoIds: string[]) {
    for (const productoId of [...productoIds].sort()) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`producto:${productoId}`]);
    }
  }

  private async disponibilidadIds(
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

  async crear(entrada: unknown, vendedorId: string) {
    const datos = objeto(entrada, CAMPOS_PEDIDO);
    const clienteId = uuid(datos.clienteId, 'clienteId');
    const detalles = this.detallesEntrada(datos.detalles);
    const observacion = opcional(datos.observacion, 'observacion', 300);

    const pedidoId = await this.db.transaction(async (manager) => {
      const clientes = await manager.query(
        'SELECT id, direccion, latitud, longitud FROM cliente WHERE id = $1::uuid AND activo = TRUE',
        [clienteId],
      ) as Array<{ id: string; direccion: string; latitud: string | null; longitud: string | null }>;
      if (!clientes.length) throw new NotFoundException('Cliente activo no encontrado.');

      const direccionEntrega = datos.direccionEntrega === undefined || datos.direccionEntrega === null || datos.direccionEntrega === ''
        ? clientes[0].direccion
        : texto(datos.direccionEntrega, 'direccionEntrega', 240);

      const productoIds = detalles.map((d) => d.productoId);
      await this.bloquearProductos(manager, productoIds);

      const disponibilidad = await this.disponibilidadIds(manager, productoIds);
      if (disponibilidad.length !== productoIds.length) {
        throw new NotFoundException('Uno o mas productos activos no existen.');
      }
      const porProducto = new Map(disponibilidad.map((d) => [d.id, d]));

      for (const detalle of detalles) {
        const disponible = porProducto.get(detalle.productoId)!;
        if (detalle.cantidad > disponible.disponible) {
          throw new ConflictException(
            `Stock disponible insuficiente para ${disponible.nombre}. Disponible: ${disponible.disponible}.`,
          );
        }
      }

      const pedidos = await manager.query(
        `INSERT INTO pedido
           (cliente_id, vendedor_id, direccion_entrega, observacion, destino_latitud, destino_longitud)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
         RETURNING id`,
        [
          clienteId,
          vendedorId,
          direccionEntrega,
          observacion,
          clientes[0].latitud,
          clientes[0].longitud,
        ],
      ) as Array<{ id: string }>;
      const id = pedidos[0].id;

      for (const detalle of detalles) {
        const producto = porProducto.get(detalle.productoId)!;
        await manager.query(
          `INSERT INTO detalle_pedido
             (pedido_id, producto_id, cantidad, precio_unitario_bob)
           VALUES ($1::uuid, $2::uuid, $3, $4)`,
          [id, detalle.productoId, detalle.cantidad, producto.precio_bob],
        );
      }

      return id;
    });

    return this.obtener(pedidoId, vendedorId);
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
      filtros.push(`pe.vendedor_id = ${parametros.length}::uuid`);
    }

    if (consulta.q !== undefined) {
      const q = texto(consulta.q, 'q', 120);
      parametros.push(`%${q}%`);
      filtros.push(
        `(c.nombre ILIKE ${parametros.length} OR u.nombre ILIKE ${parametros.length} OR u.identificador ILIKE ${parametros.length} OR pe.direccion_entrega ILIKE ${parametros.length})`,
      );
    }

    if (consulta.desde !== undefined) {
      const desde = texto(consulta.desde, 'desde', 10);
      parametros.push(desde);
      filtros.push(`pe.creado_en >= ${parametros.length}::date`);
    }

    if (consulta.hasta !== undefined) {
      const hasta = texto(consulta.hasta, 'hasta', 10);
      parametros.push(hasta);
      filtros.push(
        `pe.creado_en < (${parametros.length}::date + interval '1 day')`,
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

  async actualizar(idEntrada: string, entrada: unknown, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_PEDIDO);
    const clienteId = uuid(datos.clienteId, 'clienteId');
    const detalles = this.detallesEntrada(datos.detalles);
    const observacion = opcional(datos.observacion, 'observacion', 300);

    await this.db.transaction(async (manager) => {
      const pedidos = await manager.query(
        `SELECT id, vendedor_id, estado
         FROM pedido
         WHERE id = $1::uuid
         FOR UPDATE`,
        [id],
      ) as Array<{ id: string; vendedor_id: string; estado: EstadoPedido }>;

      if (!pedidos.length || pedidos[0].vendedor_id !== vendedorId) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      if (pedidos[0].estado !== 'REGISTRADO') {
        throw new ConflictException(
          'Solo se puede editar un pedido antes de retirarlo para reparto.',
        );
      }

      const clientes = await manager.query(
        'SELECT id, direccion, latitud, longitud FROM cliente WHERE id = $1::uuid AND activo = TRUE',
        [clienteId],
      ) as Array<{ id: string; direccion: string; latitud: string | null; longitud: string | null }>;
      if (!clientes.length) throw new NotFoundException('Cliente activo no encontrado.');

      const direccionEntrega =
        datos.direccionEntrega === undefined ||
        datos.direccionEntrega === null ||
        datos.direccionEntrega === ''
          ? clientes[0].direccion
          : texto(datos.direccionEntrega, 'direccionEntrega', 240);

      const anteriores = await manager.query(
        `SELECT producto_id, cantidad, precio_unitario_bob
         FROM detalle_pedido
         WHERE pedido_id = $1::uuid`,
        [id],
      ) as Array<{ producto_id: string; cantidad: number; precio_unitario_bob: string }>;

      const idsProductos = [
        ...new Set([
          ...anteriores.map((detalle) => detalle.producto_id),
          ...detalles.map((detalle) => detalle.productoId),
        ]),
      ];
      await this.bloquearProductos(manager, idsProductos);

      const disponibilidad = await this.disponibilidadIds(manager, idsProductos);
      const porProducto = new Map(disponibilidad.map((producto) => [producto.id, producto]));
      const anteriorPorProducto = new Map(
        anteriores.map((detalle) => [detalle.producto_id, detalle]),
      );

      for (const detalle of detalles) {
        const producto = porProducto.get(detalle.productoId);
        if (!producto) {
          throw new NotFoundException('Uno o mas productos activos no existen.');
        }
        const cantidadAnterior = anteriorPorProducto.get(detalle.productoId)?.cantidad ?? 0;
        const capacidad = producto.disponible + cantidadAnterior;
        if (detalle.cantidad > capacidad) {
          throw new ConflictException(
            `Stock disponible insuficiente para ${producto.nombre}. Disponible para esta edición: ${capacidad}.`,
          );
        }
      }

      await manager.query(
        `UPDATE pedido
         SET cliente_id = $2::uuid,
             direccion_entrega = $3,
             observacion = $4,
             destino_latitud = $5,
             destino_longitud = $6,
             actualizado_en = now()
         WHERE id = $1::uuid`,
        [
          id,
          clienteId,
          direccionEntrega,
          observacion,
          clientes[0].latitud,
          clientes[0].longitud,
        ],
      );

      await manager.query('DELETE FROM detalle_pedido WHERE pedido_id = $1::uuid', [id]);

      for (const detalle of detalles) {
        const producto = porProducto.get(detalle.productoId)!;
        const precio =
          anteriorPorProducto.get(detalle.productoId)?.precio_unitario_bob ??
          producto.precio_bob;
        await manager.query(
          `INSERT INTO detalle_pedido
             (pedido_id, producto_id, cantidad, precio_unitario_bob)
           VALUES ($1::uuid, $2::uuid, $3, $4)`,
          [id, detalle.productoId, detalle.cantidad, precio],
        );
      }
    });

    return this.obtener(id, vendedorId);
  }

  async cancelar(idEntrada: string, entrada: unknown, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_CANCELACION);
    const motivo = opcional(datos.motivo, 'motivo', 300) ?? 'Anulado por el Vendedor antes del retiro';

    await this.db.transaction(async (manager) => {
      const pedidos = await manager.query(
        `SELECT id, vendedor_id, estado
         FROM pedido
         WHERE id = $1::uuid
         FOR UPDATE`,
        [id],
      ) as Array<{ id: string; vendedor_id: string; estado: EstadoPedido }>;

      if (!pedidos.length || pedidos[0].vendedor_id !== vendedorId) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      if (pedidos[0].estado === 'CANCELADO') return;
      if (pedidos[0].estado !== 'REGISTRADO') {
        throw new ConflictException(
          'Solo se puede anular un pedido antes de retirarlo para reparto.',
        );
      }

      await manager.query(
        `UPDATE pedido
         SET estado = 'CANCELADO',
             cancelado_en = now(),
             cancelacion_motivo = $2,
             actualizado_en = now()
         WHERE id = $1::uuid`,
        [id, motivo],
      );
    });

    return this.obtener(id, vendedorId);
  }

  async retirarVarios(entrada: unknown, vendedorId: string) {
    const datos = objeto(entrada, CAMPOS_RETIROS);
    if (!Array.isArray(datos.retiros) || datos.retiros.length < 1 || datos.retiros.length > 20) {
      throw new BadRequestException('retiros debe contener entre 1 y 20 pedidos.');
    }

    const retiros = datos.retiros.map((elemento, indice) => {
      const item = objeto(elemento, CAMPOS_RETIRO_ITEM);
      return {
        pedidoId: uuid(item.pedidoId, `retiros[${indice}].pedidoId`),
        operacionClave: uuid(item.operacionClave, `retiros[${indice}].operacionClave`),
      };
    });

    if (new Set(retiros.map((r) => r.pedidoId)).size !== retiros.length) {
      throw new BadRequestException('Un pedido no puede repetirse en el mismo retiro múltiple.');
    }
    if (new Set(retiros.map((r) => r.operacionClave)).size !== retiros.length) {
      throw new BadRequestException('Cada retiro debe utilizar una operacionClave diferente.');
    }

    const resultados: Array<{
      pedidoId: string;
      ok: boolean;
      estado?: EstadoPedido;
      statusCode?: number;
      message?: string;
    }> = [];

    for (const retiro of retiros) {
      try {
        const pedido = await this.retirar(
          retiro.pedidoId,
          { operacionClave: retiro.operacionClave },
          vendedorId,
        );
        resultados.push({
          pedidoId: retiro.pedidoId,
          ok: true,
          estado: pedido.estado as EstadoPedido,
        });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const respuesta = error.getResponse();
        let message = error.message;
        if (typeof respuesta === 'string') {
          message = respuesta;
        } else if (
          respuesta &&
          typeof respuesta === 'object' &&
          'message' in respuesta
        ) {
          const valor = (respuesta as { message?: unknown }).message;
          message = Array.isArray(valor)
            ? valor.map(String).join(' ')
            : typeof valor === 'string'
              ? valor
              : error.message;
        }
        resultados.push({
          pedidoId: retiro.pedidoId,
          ok: false,
          statusCode: error.getStatus(),
          message,
        });
      }
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.length - exitosos;

    return {
      resultado:
        fallidos === 0 ? 'COMPLETO' : exitosos === 0 ? 'SIN_CAMBIOS' : 'PARCIAL',
      exitosos,
      fallidos,
      items: resultados,
    };
  }

  async retirar(idEntrada: string, entrada: unknown, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_RETIRO);
    const operacionClave = uuid(datos.operacionClave, 'operacionClave');

    await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [operacionClave]);

      const porClave = await manager.query(
        'SELECT id, vendedor_id FROM pedido WHERE retiro_operacion_clave = $1::uuid',
        [operacionClave],
      ) as Array<{ id: string; vendedor_id: string }>;
      if (porClave.length && (porClave[0].id !== id || porClave[0].vendedor_id !== vendedorId)) {
        throw new ConflictException('La clave de retiro ya se utilizo en otro pedido.');
      }

      const pedidos = await manager.query(
        `SELECT id, vendedor_id, estado, retiro_operacion_clave
         FROM pedido WHERE id = $1::uuid FOR UPDATE`,
        [id],
      ) as Array<{ id: string; vendedor_id: string; estado: EstadoPedido; retiro_operacion_clave: string | null }>;
      if (!pedidos.length || pedidos[0].vendedor_id !== vendedorId) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      const pedido = pedidos[0];

      if (pedido.retiro_operacion_clave === operacionClave) return;
      if (pedido.estado !== 'REGISTRADO') {
        throw new ConflictException('El pedido no se encuentra disponible para retiro.');
      }

      const detalles = await manager.query(
        `SELECT producto_id, cantidad
         FROM detalle_pedido WHERE pedido_id = $1::uuid ORDER BY producto_id`,
        [id],
      ) as Array<{ producto_id: string; cantidad: number }>;

      await this.bloquearProductos(manager, detalles.map((d) => d.producto_id));

      const ubicaciones = await manager.query(
        `SELECT id, codigo FROM ubicacion
         WHERE codigo = ANY($1::text[]) AND activa = TRUE`,
        [['VENTA_DESPACHO', 'EN_DISTRIBUCION']],
      ) as Array<{ id: string; codigo: string }>;
      const ids = new Map(ubicaciones.map((u) => [u.codigo, u.id]));
      const origenId = ids.get('VENTA_DESPACHO');
      const destinoId = ids.get('EN_DISTRIBUCION');
      if (!origenId || !destinoId) {
        throw new ConflictException('Las ubicaciones de distribucion no estan disponibles.');
      }

      const disponibilidad = await this.disponibilidadIds(manager, detalles.map((d) => d.producto_id));
      const porProducto = new Map(disponibilidad.map((d) => [d.id, d]));

      for (const detalle of detalles) {
        const actual = porProducto.get(detalle.producto_id);
        if (!actual || actual.fisico < actual.comprometido) {
          throw new ConflictException('El stock comprometido ya no puede cubrir todos los pedidos registrados.');
        }

        let restante = detalle.cantidad;
        const lotes = await manager.query(
          `SELECT l.id, s.cantidad_fisica::int AS cantidad_fisica
           FROM lote l
           JOIN saldo_inventario s ON s.lote_id = l.id
           WHERE l.producto_id = $1::uuid
             AND s.ubicacion_id = $2::uuid
             AND l.condicion = 'LIBERADO'
             AND l.vence_el >= CURRENT_DATE
             AND s.cantidad_fisica > 0
           ORDER BY l.vence_el ASC, l.creado_en ASC, l.id ASC`,
          [detalle.producto_id, origenId],
        ) as Array<{ id: string; cantidad_fisica: number }>;

        for (const lote of lotes) {
          if (restante <= 0) break;
          const cantidad = Math.min(restante, lote.cantidad_fisica);
          await manager.query(
            `INSERT INTO movimiento
               (operacion_clave, lote_id, tipo, origen_id, destino_id, cantidad, usuario_id, referencia, motivo)
             VALUES (gen_random_uuid(), $1::uuid, 'RETIRO', $2::uuid, $3::uuid, $4, $5::uuid, $6, 'Retiro de pedido para distribucion')`,
            [lote.id, origenId, destinoId, cantidad, vendedorId, id],
          );
          restante -= cantidad;
        }

        if (restante !== 0) {
          throw new ConflictException('No fue posible asignar lotes suficientes al retiro.');
        }
      }

      await manager.query(
        `UPDATE pedido
         SET estado = 'EN_DISTRIBUCION',
             retiro_operacion_clave = $2::uuid,
             retirado_en = now(),
             actualizado_en = now()
         WHERE id = $1::uuid`,
        [id, operacionClave],
      );
    });

    return this.obtener(id, vendedorId);
  }

  async entregar(idEntrada: string, entrada: unknown, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_ENTREGA);
    const operacionClave = uuid(datos.operacionClave, 'operacionClave');
    const latitud = numeroRango(datos.latitud, 'latitud', -90, 90);
    const longitud = numeroRango(datos.longitud, 'longitud', -180, 180);
    const precisionMetros = numeroOpcionalNoNegativo(datos.precisionMetros, 'precisionMetros', 10000);
    const observacionDistancia = opcional(datos.observacionDistancia, 'observacionDistancia', 300);

    await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [operacionClave]);

      const porClave = await manager.query(
        'SELECT id, vendedor_id FROM pedido WHERE entrega_operacion_clave = $1::uuid',
        [operacionClave],
      ) as Array<{ id: string; vendedor_id: string }>;
      if (porClave.length && (porClave[0].id !== id || porClave[0].vendedor_id !== vendedorId)) {
        throw new ConflictException('La clave de entrega ya se utilizo en otro pedido.');
      }

      const pedidos = await manager.query(
        `SELECT id, vendedor_id, estado, entrega_operacion_clave,
                destino_latitud, destino_longitud,
                entrega_latitud, entrega_longitud
         FROM pedido WHERE id = $1::uuid FOR UPDATE`,
        [id],
      ) as Array<{
        id: string;
        vendedor_id: string;
        estado: EstadoPedido;
        entrega_operacion_clave: string | null;
        destino_latitud: string | null;
        destino_longitud: string | null;
        entrega_latitud: string | null;
        entrega_longitud: string | null;
      }>;
      if (!pedidos.length || pedidos[0].vendedor_id !== vendedorId) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      const pedido = pedidos[0];

      if (pedido.entrega_operacion_clave === operacionClave) {
        if (
          Number(pedido.entrega_latitud) !== latitud ||
          Number(pedido.entrega_longitud) !== longitud
        ) {
          throw new ConflictException('La clave de entrega ya se utilizo con otras coordenadas.');
        }
        return;
      }
      if (pedido.estado !== 'EN_DISTRIBUCION') {
        throw new ConflictException('El pedido debe estar en distribucion antes de registrar la entrega.');
      }

      const retiros = await manager.query(
        `SELECT lote_id, destino_id AS distribucion_id, cantidad
         FROM movimiento
         WHERE tipo = 'RETIRO' AND referencia = $1
         ORDER BY creado_en, id`,
        [id],
      ) as Array<{ lote_id: string; distribucion_id: string; cantidad: number }>;
      if (!retiros.length) {
        throw new ConflictException('El pedido no tiene movimientos de retiro registrados.');
      }

      for (const retiro of retiros) {
        await manager.query(
          `INSERT INTO movimiento
             (operacion_clave, lote_id, tipo, origen_id, destino_id, cantidad, usuario_id, referencia, motivo)
           VALUES (gen_random_uuid(), $1::uuid, 'ENTREGA', $2::uuid, NULL, $3, $4::uuid, $5, 'Entrega confirmada con ubicacion puntual')`,
          [retiro.lote_id, retiro.distribucion_id, retiro.cantidad, vendedorId, id],
        );
      }

      const distanciaDestinoMetros =
        pedido.destino_latitud === null || pedido.destino_longitud === null
          ? null
          : distanciaHaversine(
              {
                latitud: Number(pedido.destino_latitud),
                longitud: Number(pedido.destino_longitud),
              },
              { latitud, longitud },
            );

      await manager.query(
        `UPDATE pedido
         SET estado = 'ENTREGADO',
             entrega_operacion_clave = $2::uuid,
             entregado_en = now(),
             entrega_latitud = $3,
             entrega_longitud = $4,
             entrega_precision_m = $5,
             entrega_distancia_destino_m = $6,
             entrega_observacion = $7,
             actualizado_en = now()
         WHERE id = $1::uuid`,
        [
          id,
          operacionClave,
          latitud,
          longitud,
          precisionMetros,
          distanciaDestinoMetros,
          observacionDistancia,
        ],
      );
    });

    return this.obtener(id, vendedorId);
  }
}
