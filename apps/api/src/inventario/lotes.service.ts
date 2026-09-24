import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LoteEntity } from '../database/entities/lote.entity.js';
import { ProductoEntity } from '../database/entities/producto.entity.js';
import {
  codigo,
  codigoPostgres,
  enteroPositivo,
  fechaIso,
  objeto,
  paginacion,
  uuid,
  vigenciaFiltro,
} from './validacion.js';

const CAMPOS_LOTE = ['operacionClave', 'productoId', 'codigo', 'elaboradoEl', 'venceEl', 'cantidadInicial', 'ubicacionCodigo'];
const CODIGO_INGRESO = 'PRODUCCION_ALMACENAMIENTO';

type FilaExistencia = {
  lote_id: string;
  codigo: string;
  nombre: string;
  cantidad_fisica: number;
  cantidad_comprometida: number;
};

type FilaReenvio = {
  id: string;
  codigo: string;
  producto_id: string;
  elaborado_el: string;
  vence_el: string;
  cantidad: number;
  usuario_id: string;
  destino_codigo: string;
};

@Injectable()
export class LotesService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(LoteEntity) private readonly lotes: Repository<LoteEntity>,
    @InjectRepository(ProductoEntity) private readonly productos: Repository<ProductoEntity>,
  ) {}

  private async saldos(ids: string[]): Promise<Map<string, FilaExistencia[]>> {
    const mapa = new Map<string, FilaExistencia[]>();
    if (ids.length === 0) return mapa;
    const filas = await this.db.query(
      `SELECT e.lote_id, u.codigo, u.nombre, e.cantidad_fisica, e.cantidad_comprometida
       FROM existencia e INNER JOIN ubicacion u ON u.id = e.ubicacion_id
       WHERE e.lote_id = ANY($1::uuid[]) ORDER BY u.codigo`,
      [ids],
    ) as FilaExistencia[];
    for (const fila of filas) {
      const delLote = mapa.get(fila.lote_id) ?? [];
      delLote.push(fila);
      mapa.set(fila.lote_id, delLote);
    }
    return mapa;
  }

  // La entidad TypeORM no se extiende como objeto: se devuelve un DTO plano.
  private respuestaLote(lote: LoteEntity, existencias: FilaExistencia[]) {
    return {
      id: lote.id,
      codigo: lote.codigo,
      productoId: lote.productoId,
      elaboradoEl: lote.elaboradoEl,
      venceEl: lote.venceEl,
      condicion: lote.condicion,
      creadoEn: lote.creadoEn,
      existencias,
    };
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['productoId', 'vigencia', 'page', 'limit']);
    const productoId = consulta.productoId === undefined ? undefined : uuid(consulta.productoId, 'productoId');
    const vigencia = vigenciaFiltro(consulta.vigencia);
    const qb = this.lotes.createQueryBuilder('l');
    if (productoId) qb.andWhere('l.producto_id = :productoId', { productoId });
    if (vigencia === 'vigente') qb.andWhere('l.vence_el >= CURRENT_DATE');
    if (vigencia === 'vencido') qb.andWhere('l.vence_el < CURRENT_DATE');
    const [items, total] = await qb.orderBy('l.creado_en', 'DESC').addOrderBy('l.id', 'DESC')
      .skip((page - 1) * limit).take(limit).getManyAndCount();
    const saldos = await this.saldos(items.map((lote) => lote.id));
    return {
      items: items.map((lote) => this.respuestaLote(lote, saldos.get(lote.id) ?? [])),
      total, page, limit,
    };
  }

  async obtener(id: string) {
    const lote = await this.lotes.findOneBy({ id: uuid(id, 'id') });
    if (!lote) throw new NotFoundException('Lote no encontrado.');
    const producto = await this.productos.findOneBy({ id: lote.productoId });
    const saldos = await this.saldos([lote.id]);
    return { ...this.respuestaLote(lote, saldos.get(lote.id) ?? []), producto };
  }

  async crear(entrada: unknown, usuarioId: string) {
    const datos = objeto(entrada, CAMPOS_LOTE);
    const operacionClave = uuid(datos.operacionClave, 'operacionClave');
    const productoId = uuid(datos.productoId, 'productoId');
    const loteCodigo = codigo(datos.codigo, 'codigo', 60);
    const elaboradoEl = fechaIso(datos.elaboradoEl, 'elaboradoEl');
    const venceEl = fechaIso(datos.venceEl, 'venceEl');
    if (venceEl <= elaboradoEl) {
      throw new BadRequestException('venceEl debe ser posterior a elaboradoEl.');
    }
    const cantidadInicial = enteroPositivo(datos.cantidadInicial, 'cantidadInicial');
    const ubicacionCodigo = codigo(datos.ubicacionCodigo, 'ubicacionCodigo', 40);
    if (ubicacionCodigo !== CODIGO_INGRESO) {
      throw new BadRequestException('El ingreso inicial solo puede registrarse en Produccion y Almacenamiento.');
    }

    try {
      const id = await this.db.transaction(async (manager) => {
        // Serializa reintentos simultaneos de una misma operacion durante esta transaccion.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [operacionClave]);
        const repetido = await manager.query(
          `SELECT l.id, l.codigo, l.producto_id,
                  to_char(l.elaborado_el, 'YYYY-MM-DD') AS elaborado_el,
                  to_char(l.vence_el, 'YYYY-MM-DD') AS vence_el,
                  m.cantidad, m.usuario_id, u.codigo AS destino_codigo
           FROM movimiento m JOIN lote l ON l.id = m.lote_id
           JOIN ubicacion u ON u.id = m.destino_id
           WHERE m.operacion_clave = $1::uuid`, [operacionClave],
        ) as FilaReenvio[];
        if (repetido.length > 0) {
          const previo = repetido[0];
          if (previo.codigo !== loteCodigo || previo.producto_id !== productoId ||
              previo.elaborado_el !== elaboradoEl || previo.vence_el !== venceEl ||
              previo.cantidad !== cantidadInicial || previo.usuario_id !== usuarioId ||
              previo.destino_codigo !== ubicacionCodigo) {
            throw new ConflictException('La clave de operacion ya se utilizo con otros datos.');
          }
          return previo.id;
        }

        const producto = await manager.getRepository(ProductoEntity).findOneBy({ id: productoId, activo: true });
        if (!producto) throw new NotFoundException('Producto activo no encontrado.');
        const ubicaciones = await manager.query(
          `SELECT id FROM ubicacion WHERE codigo = $1 AND activa = TRUE AND clase = 'AREA_FISICA'`,
          [ubicacionCodigo],
        ) as { id: string }[];
        if (!ubicaciones.length) throw new NotFoundException('Ubicacion de ingreso no disponible.');
        const destinoId = ubicaciones[0].id;

        const nuevos = await manager.query(
          `INSERT INTO lote (codigo, producto_id, elaborado_el, vence_el, condicion)
           VALUES ($1, $2::uuid, $3::date, $4::date, 'RETENIDO') RETURNING id`,
          [loteCodigo, productoId, elaboradoEl, venceEl],
        ) as { id: string }[];
        const loteId = nuevos[0].id;
        await manager.query(
          `INSERT INTO movimiento
             (operacion_clave, lote_id, tipo, origen_id, destino_id, cantidad, usuario_id)
           VALUES ($1::uuid, $2::uuid, 'INGRESO', NULL, $3::uuid, $4, $5::uuid)`,
          [operacionClave, loteId, destinoId, cantidadInicial, usuarioId],
        );
        await manager.query(
          `INSERT INTO existencia (lote_id, ubicacion_id, cantidad_fisica, cantidad_comprometida)
           VALUES ($1::uuid, $2::uuid, $3, 0)`,
          [loteId, destinoId, cantidadInicial],
        );
        return loteId;
      });
      return this.obtener(id);
    } catch (error) {
      if (codigoPostgres(error) === '23505') {
        throw new ConflictException('El codigo de lote o la clave de operacion ya existe.');
      }
      throw error;
    }
  }
}
