import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { objeto, paginacion, texto, uuid } from './validacion.js';

const CAMPOS_CAMBIO = ['operacionClave', 'motivo'] as const;
type Condicion = 'LIBERADO' | 'RETENIDO' | 'BLOQUEADO';

type FilaLote = {
  id: string;
  producto_id: string;
  condicion: Condicion;
  vence_el: string;
  producto_activo: boolean;
};

type FilaEvento = {
  id: string;
  operacion_clave: string;
  lote_id: string;
  condicion_anterior: Condicion;
  condicion_nueva: Condicion;
  usuario_id: string;
  identificador: string;
  usuario_nombre: string;
  motivo: string;
  creado_en: Date;
};

@Injectable()
export class CondicionesLoteService {
  constructor(private readonly db: DataSource) {}

  private async detalleEvento(id: string) {
    const filas = await this.db.query(
      `SELECT h.id, h.operacion_clave, h.lote_id,
              h.condicion_anterior, h.condicion_nueva,
              h.usuario_id, u.identificador, u.nombre AS usuario_nombre,
              h.motivo, h.creado_en
       FROM lote_condicion_historial h
       JOIN usuario u ON u.id = h.usuario_id
       WHERE h.id = $1::uuid`,
      [id],
    ) as FilaEvento[];

    if (!filas.length) throw new NotFoundException('Evento de condicion no encontrado.');
    const fila = filas[0];
    return {
      id: fila.id,
      operacionClave: fila.operacion_clave,
      loteId: fila.lote_id,
      condicionAnterior: fila.condicion_anterior,
      condicionNueva: fila.condicion_nueva,
      motivo: fila.motivo,
      creadoEn: fila.creado_en,
      usuario: {
        id: fila.usuario_id,
        identificador: fila.identificador,
        nombre: fila.usuario_nombre,
      },
    };
  }

  private async cambiar(
    loteIdEntrada: string,
    entrada: unknown,
    usuarioId: string,
    condicionNueva: 'LIBERADO' | 'BLOQUEADO',
  ) {
    const loteId = uuid(loteIdEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_CAMBIO);
    const operacionClave = uuid(datos.operacionClave, 'operacionClave');
    const motivo = texto(datos.motivo, 'motivo', 250);

    const eventoId = await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [operacionClave]);

      const repetidos = await manager.query(
        `SELECT id, lote_id, condicion_nueva, usuario_id, motivo
         FROM lote_condicion_historial
         WHERE operacion_clave = $1::uuid`,
        [operacionClave],
      ) as Array<{
        id: string;
        lote_id: string;
        condicion_nueva: Condicion;
        usuario_id: string;
        motivo: string;
      }>;

      if (repetidos.length) {
        const previo = repetidos[0];
        if (
          previo.lote_id !== loteId ||
          previo.condicion_nueva !== condicionNueva ||
          previo.usuario_id !== usuarioId ||
          previo.motivo !== motivo
        ) {
          throw new ConflictException('La clave de operacion ya se utilizo con otros datos.');
        }
        return previo.id;
      }

      const referencias = await manager.query(
        'SELECT producto_id FROM lote WHERE id = $1::uuid',
        [loteId],
      ) as Array<{ producto_id: string }>;
      if (!referencias.length) throw new NotFoundException('Lote no encontrado.');

      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`producto:${referencias[0].producto_id}`]);
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`condicion-lote:${loteId}`]);

      const lotes = await manager.query(
        `SELECT l.id, l.producto_id, l.condicion,
                to_char(l.vence_el, 'YYYY-MM-DD') AS vence_el,
                p.activo AS producto_activo
         FROM lote l
         JOIN producto p ON p.id = l.producto_id
         WHERE l.id = $1::uuid
         FOR UPDATE OF l`,
        [loteId],
      ) as FilaLote[];

      if (!lotes.length) throw new NotFoundException('Lote no encontrado.');
      const lote = lotes[0];

      if (lote.condicion === condicionNueva) {
        throw new ConflictException(`El lote ya se encuentra ${condicionNueva.toLowerCase()}.`);
      }

      if (condicionNueva === 'LIBERADO') {
        const fechaActual = await manager.query(
          "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS hoy",
        ) as { hoy: string }[];
        if (lote.vence_el <= fechaActual[0].hoy) {
          throw new ConflictException('No se puede liberar un lote vencido.');
        }
        if (!lote.producto_activo) {
          throw new ConflictException('No se puede liberar un lote de un producto inactivo.');
        }
      }

      if (condicionNueva === 'BLOQUEADO' && lote.condicion === 'LIBERADO') {
        const saldosVenta = await manager.query(
          `SELECT COALESCE(s.cantidad_fisica, 0)::int AS cantidad
           FROM ubicacion u
           LEFT JOIN saldo_inventario s
             ON s.ubicacion_id = u.id AND s.lote_id = $1::uuid
           WHERE u.codigo = 'VENTA_DESPACHO'`,
          [loteId],
        ) as Array<{ cantidad: number }>;
        const cantidadLoteVenta = saldosVenta[0]?.cantidad ?? 0;

        if (cantidadLoteVenta > 0) {
          const [fisico, comprometido] = await Promise.all([
            manager.query(
              `SELECT COALESCE(SUM(s.cantidad_fisica), 0)::int AS cantidad
               FROM lote l
               JOIN saldo_inventario s ON s.lote_id = l.id
               JOIN ubicacion u ON u.id = s.ubicacion_id
               WHERE l.producto_id = $1::uuid
                 AND u.codigo = 'VENTA_DESPACHO'
                 AND l.condicion = 'LIBERADO'
                 AND l.vence_el >= CURRENT_DATE`,
              [lote.producto_id],
            ) as Promise<Array<{ cantidad: number }>>,
            manager.query(
              `SELECT COALESCE(SUM(d.cantidad), 0)::int AS cantidad
               FROM detalle_pedido d
               JOIN pedido pe ON pe.id = d.pedido_id
               WHERE d.producto_id = $1::uuid AND pe.estado = 'REGISTRADO'`,
              [lote.producto_id],
            ) as Promise<Array<{ cantidad: number }>>,
          ]);

          const disponibleTrasBloqueo = fisico[0].cantidad - cantidadLoteVenta;
          if (disponibleTrasBloqueo < comprometido[0].cantidad) {
            throw new ConflictException(
              'No se puede bloquear el lote porque su stock esta reservado para pedidos registrados.',
            );
          }
        }
      }

      await manager.query(
        'UPDATE lote SET condicion = $2 WHERE id = $1::uuid',
        [loteId, condicionNueva],
      );

      const eventos = await manager.query(
        `INSERT INTO lote_condicion_historial
           (operacion_clave, lote_id, condicion_anterior, condicion_nueva, usuario_id, motivo)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)
         RETURNING id`,
        [operacionClave, loteId, lote.condicion, condicionNueva, usuarioId, motivo],
      ) as { id: string }[];

      return eventos[0].id;
    });

    return {
      loteId,
      condicion: condicionNueva,
      evento: await this.detalleEvento(eventoId),
    };
  }

  liberar(loteId: string, entrada: unknown, usuarioId: string) {
    return this.cambiar(loteId, entrada, usuarioId, 'LIBERADO');
  }

  bloquear(loteId: string, entrada: unknown, usuarioId: string) {
    return this.cambiar(loteId, entrada, usuarioId, 'BLOQUEADO');
  }

  async listar(loteIdEntrada: string, consulta: Record<string, unknown>) {
    const loteId = uuid(loteIdEntrada, 'id');
    const { page, limit } = paginacion(consulta, ['page', 'limit']);

    const existe = await this.db.query(
      'SELECT id FROM lote WHERE id = $1::uuid',
      [loteId],
    ) as { id: string }[];
    if (!existe.length) throw new NotFoundException('Lote no encontrado.');

    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT h.id, h.operacion_clave, h.lote_id,
                h.condicion_anterior, h.condicion_nueva,
                h.usuario_id, u.identificador, u.nombre AS usuario_nombre,
                h.motivo, h.creado_en
         FROM lote_condicion_historial h
         JOIN usuario u ON u.id = h.usuario_id
         WHERE h.lote_id = $1::uuid
         ORDER BY h.creado_en DESC, h.id DESC
         LIMIT $2 OFFSET $3`,
        [loteId, limit, (page - 1) * limit],
      ) as Promise<FilaEvento[]>,
      this.db.query(
        'SELECT count(*)::int AS total FROM lote_condicion_historial WHERE lote_id = $1::uuid',
        [loteId],
      ) as Promise<{ total: number }[]>,
    ]);

    return {
      items: items.map((fila) => ({
        id: fila.id,
        operacionClave: fila.operacion_clave,
        loteId: fila.lote_id,
        condicionAnterior: fila.condicion_anterior,
        condicionNueva: fila.condicion_nueva,
        motivo: fila.motivo,
        creadoEn: fila.creado_en,
        usuario: {
          id: fila.usuario_id,
          identificador: fila.identificador,
          nombre: fila.usuario_nombre,
        },
      })),
      total: total[0].total,
      page,
      limit,
    };
  }
}
