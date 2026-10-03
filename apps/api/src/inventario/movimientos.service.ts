import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  codigo,
  enteroPositivo,
  objeto,
  paginacion,
  texto,
  uuid,
} from './validacion.js';

const CAMPOS_TRASLADO = [
  'operacionClave',
  'loteId',
  'origenCodigo',
  'destinoCodigo',
  'cantidad',
  'referencia',
  'motivo',
] as const;

type FilaReenvio = {
  id: string;
  lote_id: string;
  tipo: string;
  cantidad: number;
  usuario_id: string;
  referencia: string | null;
  motivo: string | null;
  origen_codigo: string | null;
  destino_codigo: string | null;
};

type FilaUbicacion = {
  id: string;
  codigo: string;
  nombre: string;
};

function textoOpcional(valor: unknown, campo: string, maximo: number): string | null {
  if (valor === undefined || valor === null) return null;
  return texto(valor, campo, maximo);
}

@Injectable()
export class MovimientosService {
  constructor(private readonly db: DataSource) {}

  private async saldosLote(loteId: string) {
    return this.db.query(
      `SELECT u.codigo, u.nombre, s.cantidad_fisica, s.cantidad_comprometida
       FROM saldo_inventario s
       JOIN ubicacion u ON u.id = s.ubicacion_id
       WHERE s.lote_id = $1::uuid
       ORDER BY u.codigo`,
      [loteId],
    ) as Promise<Array<{
      codigo: string;
      nombre: string;
      cantidad_fisica: number;
      cantidad_comprometida: number;
    }>>;
  }

  private async detalleMovimiento(id: string) {
    const filas = await this.db.query(
      `SELECT m.id, m.operacion_clave, m.lote_id, m.tipo, m.cantidad,
              m.referencia, m.motivo, m.creado_en,
              o.codigo AS origen_codigo, o.nombre AS origen_nombre,
              d.codigo AS destino_codigo, d.nombre AS destino_nombre,
              us.id AS usuario_id, us.identificador, us.nombre AS usuario_nombre
       FROM movimiento m
       LEFT JOIN ubicacion o ON o.id = m.origen_id
       LEFT JOIN ubicacion d ON d.id = m.destino_id
       JOIN usuario us ON us.id = m.usuario_id
       WHERE m.id = $1::uuid`,
      [id],
    ) as Array<{
      id: string;
      operacion_clave: string;
      lote_id: string;
      tipo: string;
      cantidad: number;
      referencia: string | null;
      motivo: string | null;
      creado_en: Date;
      origen_codigo: string | null;
      origen_nombre: string | null;
      destino_codigo: string | null;
      destino_nombre: string | null;
      usuario_id: string;
      identificador: string;
      usuario_nombre: string;
    }>;

    if (!filas.length) throw new NotFoundException('Movimiento no encontrado.');
    const fila = filas[0];
    return {
      id: fila.id,
      operacionClave: fila.operacion_clave,
      loteId: fila.lote_id,
      tipo: fila.tipo,
      cantidad: fila.cantidad,
      referencia: fila.referencia,
      motivo: fila.motivo,
      creadoEn: fila.creado_en,
      origen: fila.origen_codigo
        ? { codigo: fila.origen_codigo, nombre: fila.origen_nombre }
        : null,
      destino: fila.destino_codigo
        ? { codigo: fila.destino_codigo, nombre: fila.destino_nombre }
        : null,
      usuario: {
        id: fila.usuario_id,
        identificador: fila.identificador,
        nombre: fila.usuario_nombre,
      },
    };
  }

  async trasladar(entrada: unknown, usuarioId: string) {
    const datos = objeto(entrada, CAMPOS_TRASLADO);
    const operacionClave = uuid(datos.operacionClave, 'operacionClave');
    const loteId = uuid(datos.loteId, 'loteId');
    const origenCodigo = codigo(datos.origenCodigo, 'origenCodigo', 40);
    const destinoCodigo = codigo(datos.destinoCodigo, 'destinoCodigo', 40);
    const cantidad = enteroPositivo(datos.cantidad, 'cantidad');
    const referencia = textoOpcional(datos.referencia, 'referencia', 80);
    const motivo = textoOpcional(datos.motivo, 'motivo', 250);

    if (origenCodigo === destinoCodigo) {
      throw new BadRequestException('La ubicacion de origen y destino deben ser diferentes.');
    }

    const movimientoId = await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [operacionClave]);

      const repetido = await manager.query(
        `SELECT m.id, m.lote_id, m.tipo, m.cantidad, m.usuario_id, m.referencia, m.motivo,
                o.codigo AS origen_codigo, d.codigo AS destino_codigo
         FROM movimiento m
         LEFT JOIN ubicacion o ON o.id = m.origen_id
         LEFT JOIN ubicacion d ON d.id = m.destino_id
         WHERE m.operacion_clave = $1::uuid`,
        [operacionClave],
      ) as FilaReenvio[];

      if (repetido.length > 0) {
        const previo = repetido[0];
        if (
          previo.tipo !== 'TRASLADO' ||
          previo.lote_id !== loteId ||
          previo.cantidad !== cantidad ||
          previo.usuario_id !== usuarioId ||
          previo.origen_codigo !== origenCodigo ||
          previo.destino_codigo !== destinoCodigo ||
          previo.referencia !== referencia ||
          previo.motivo !== motivo
        ) {
          throw new ConflictException('La clave de operacion ya se utilizo con otros datos.');
        }
        return previo.id;
      }

      const lotes = await manager.query(
        `SELECT id, producto_id, condicion, (vence_el >= CURRENT_DATE) AS vigente
         FROM lote WHERE id = $1::uuid`,
        [loteId],
      ) as Array<{ id: string; producto_id: string; condicion: string; vigente: boolean }>;
      if (!lotes.length) throw new NotFoundException('Lote no encontrado.');
      const lote = lotes[0];

      // Los pedidos y los movimientos que afectan venta se serializan por producto.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`producto:${lote.producto_id}`]);
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [`lote:${loteId}`]);

      const ubicaciones = await manager.query(
        `SELECT id, codigo, nombre
         FROM ubicacion
         WHERE codigo = ANY($1::text[]) AND activa = TRUE AND clase = 'AREA_FISICA'`,
        [[origenCodigo, destinoCodigo]],
      ) as FilaUbicacion[];

      const porCodigo = new Map(ubicaciones.map((ubicacion) => [ubicacion.codigo, ubicacion]));
      const origen = porCodigo.get(origenCodigo);
      const destino = porCodigo.get(destinoCodigo);
      if (!origen || !destino) {
        throw new NotFoundException('Ubicacion de origen o destino no disponible.');
      }

      if (
        origenCodigo === 'VENTA_DESPACHO' &&
        lote.condicion === 'LIBERADO' &&
        lote.vigente
      ) {
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
             JOIN pedido p ON p.id = d.pedido_id
             WHERE d.producto_id = $1::uuid AND p.estado = 'REGISTRADO'`,
            [lote.producto_id],
          ) as Promise<Array<{ cantidad: number }>>,
        ]);

        const libre = fisico[0].cantidad - comprometido[0].cantidad;
        if (libre < cantidad) {
          throw new ConflictException(
            'El traslado reduciria stock reservado para pedidos registrados.',
          );
        }
      }

      const saldosOrigen = await manager.query(
        `SELECT cantidad_fisica, cantidad_comprometida
         FROM saldo_inventario
         WHERE lote_id = $1::uuid AND ubicacion_id = $2::uuid`,
        [loteId, origen.id],
      ) as Array<{ cantidad_fisica: number; cantidad_comprometida: number }>;

      const saldoOrigen = saldosOrigen[0];
      const disponible = saldoOrigen
        ? saldoOrigen.cantidad_fisica - saldoOrigen.cantidad_comprometida
        : 0;

      if (!saldoOrigen || disponible < cantidad) {
        throw new ConflictException('Saldo disponible insuficiente en la ubicacion de origen.');
      }

      const nuevos = await manager.query(
        `INSERT INTO movimiento
           (operacion_clave, lote_id, tipo, origen_id, destino_id, cantidad, usuario_id, referencia, motivo)
         VALUES ($1::uuid, $2::uuid, 'TRASLADO', $3::uuid, $4::uuid, $5, $6::uuid, $7, $8)
         RETURNING id`,
        [operacionClave, loteId, origen.id, destino.id, cantidad, usuarioId, referencia, motivo],
      ) as { id: string }[];

      return nuevos[0].id;
    });

    return {
      movimiento: await this.detalleMovimiento(movimientoId),
      existencias: await this.saldosLote(loteId),
    };
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['loteId', 'page', 'limit']);
    const loteId = uuid(consulta.loteId, 'loteId');

    const lotes = await this.db.query(
      'SELECT id FROM lote WHERE id = $1::uuid',
      [loteId],
    ) as { id: string }[];
    if (!lotes.length) throw new NotFoundException('Lote no encontrado.');

    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT m.id, m.operacion_clave, m.lote_id, m.tipo, m.cantidad,
                m.referencia, m.motivo, m.creado_en,
                o.codigo AS origen_codigo, o.nombre AS origen_nombre,
                d.codigo AS destino_codigo, d.nombre AS destino_nombre,
                us.identificador, us.nombre AS usuario_nombre
         FROM movimiento m
         LEFT JOIN ubicacion o ON o.id = m.origen_id
         LEFT JOIN ubicacion d ON d.id = m.destino_id
         JOIN usuario us ON us.id = m.usuario_id
         WHERE m.lote_id = $1::uuid
         ORDER BY m.creado_en DESC, m.id DESC
         LIMIT $2 OFFSET $3`,
        [loteId, limit, (page - 1) * limit],
      ) as Promise<Array<{
        id: string;
        operacion_clave: string;
        lote_id: string;
        tipo: string;
        cantidad: number;
        referencia: string | null;
        motivo: string | null;
        creado_en: Date;
        origen_codigo: string | null;
        origen_nombre: string | null;
        destino_codigo: string | null;
        destino_nombre: string | null;
        identificador: string;
        usuario_nombre: string;
      }>>,
      this.db.query(
        'SELECT count(*)::int AS total FROM movimiento WHERE lote_id = $1::uuid',
        [loteId],
      ) as Promise<{ total: number }[]>,
    ]);

    return {
      items: items.map((fila) => ({
        id: fila.id,
        operacionClave: fila.operacion_clave,
        loteId: fila.lote_id,
        tipo: fila.tipo,
        cantidad: fila.cantidad,
        referencia: fila.referencia,
        motivo: fila.motivo,
        creadoEn: fila.creado_en,
        origen: fila.origen_codigo
          ? { codigo: fila.origen_codigo, nombre: fila.origen_nombre }
          : null,
        destino: fila.destino_codigo
          ? { codigo: fila.destino_codigo, nombre: fila.destino_nombre }
          : null,
        usuario: {
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
