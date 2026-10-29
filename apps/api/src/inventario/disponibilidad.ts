import { DataSource, EntityManager } from 'typeorm';
import { FECHA_HOY_BOLIVIA_SQL } from './validacion.js';
import type { FilaDisponibilidad } from '../pedidos/tipos-pedidos.js';

// El llamador debe tomar los bloqueos de producto antes de usar estas lecturas para escribir.
export async function disponibilidadDespacho(
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
           AND l.vence_el >= ${FECHA_HOY_BOLIVIA_SQL}
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
       WHERE p.activo = TRUE AND p.validacion_comercial <> 'PROVISIONAL'
         AND EXISTS(SELECT 1 FROM producto_comercial pc JOIN familia fa ON fa.id=pc.familia_id WHERE pc.id=p.producto_comercial_id AND pc.activo AND fa.activo) ${filtro}
       ORDER BY p.nombre, p.codigo`,
    parametros,
  ) as Promise<FilaDisponibilidad[]>;
}

export async function lotesFefo(
  manager: EntityManager,
  productoId: string,
  origenId: string,
) {
  return manager.query(
    `SELECT l.id,l.condicion,s.cantidad_fisica::int AS cantidad_fisica
     FROM lote l JOIN saldo_inventario s ON s.lote_id=l.id
     WHERE l.producto_id=$1 AND s.ubicacion_id=$2 AND l.condicion='LIBERADO'
       AND l.vence_el >= ${FECHA_HOY_BOLIVIA_SQL} AND s.cantidad_fisica>0
     ORDER BY l.vence_el,l.creado_en,l.id`,
    [productoId, origenId],
  ) as Promise<
    Array<{ id: string; condicion: string; cantidad_fisica: number }>
  >;
}
