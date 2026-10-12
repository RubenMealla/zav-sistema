import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { objeto, texto, uuid } from '../inventario/validacion.js';
import { distanciaHaversine } from './geografia.service.js';

import type { EstadoPedido } from './tipos-pedidos.js';
import { ConsultasPedidos } from './consultas-pedidos.js';
import {
  CAMPOS_PEDIDO, CAMPOS_RETIRO, CAMPOS_RETIROS, CAMPOS_RETIRO_ITEM,
  CAMPOS_ENTREGA, CAMPOS_CANCELACION,
  opcional, numeroRango, numeroOpcionalNoNegativo, detallesEntrada,
} from './validacion-pedidos.js';

@Injectable()
export class PedidosService {
  private readonly consultas: ConsultasPedidos;

  constructor(private readonly db: DataSource) {
    this.consultas = new ConsultasPedidos(db);
  }

  disponibilidad() { return this.consultas.disponibilidad(); }
  listar(vendedorId: string, consulta: Record<string, unknown>) {
    return this.consultas.listar(vendedorId, consulta);
  }
  listarAdmin(consulta: Record<string, unknown>) { return this.consultas.listarAdmin(consulta); }
  obtener(id: string, vendedorId: string) { return this.consultas.obtener(id, vendedorId); }

  private async bloquearProductos(manager: EntityManager, productoIds: string[]) {
    for (const productoId of [...productoIds].sort()) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`producto:${productoId}`]);
    }
  }

  async crear(entrada: unknown, vendedorId: string) {
    const datos = objeto(entrada, CAMPOS_PEDIDO);
    const clienteId = uuid(datos.clienteId, 'clienteId');
    const detalles = detallesEntrada(datos.detalles);
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

      const disponibilidad = await this.consultas.disponibilidadIds(manager, productoIds);
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

  async actualizar(idEntrada: string, entrada: unknown, vendedorId: string) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_PEDIDO);
    const clienteId = uuid(datos.clienteId, 'clienteId');
    const detalles = detallesEntrada(datos.detalles);
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

      const disponibilidad = await this.consultas.disponibilidadIds(manager, idsProductos);
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
        // No usar el disponible truncado a cero: un lote vencido puede dejar déficit.
        const capacidad = Math.max(0, producto.fisico - producto.comprometido + cantidadAnterior);
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

      const disponibilidad = await this.consultas.disponibilidadIds(manager, detalles.map((d) => d.producto_id));
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

      // El bloqueo del pedido y la clave conservan la idempotencia. PostgreSQL
      // inserta todos los movimientos en una sentencia y en la misma transacción.
      const entregas = await manager.query(
        `INSERT INTO movimiento
           (operacion_clave, lote_id, tipo, origen_id, destino_id, cantidad, usuario_id, referencia, motivo)
         SELECT gen_random_uuid(), lote_id, 'ENTREGA', destino_id, NULL, cantidad,
                $2::uuid, $1::text, 'Entrega confirmada con ubicacion puntual'
         FROM movimiento
         WHERE tipo = 'RETIRO' AND referencia = $1
         ORDER BY creado_en, id
         RETURNING id`,
        [id, vendedorId],
      ) as Array<{ id: string }>;
      if (!entregas.length) {
        throw new ConflictException('El pedido no tiene movimientos de retiro registrados.');
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
