import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  activoFiltro,
  codigo,
  consultaTexto,
  enteroPositivo,
  objeto,
  paginacion,
  precio,
  texto,
  uuid,
} from '../inventario/validacion.js';
import { bloquearProductos } from '../inventario/bloqueos.js';
import {
  booleano,
  conflictoCatalogo,
  nombreCatalogo,
  ordenCatalogo,
  respuestaCatalogo,
  textoCatalogo,
} from './validacion-catalogo.js';

type Grupo = 'familias' | 'productos';
type Fila = Record<string, unknown>;
const TABLAS = {
  familias: 'familia',
  productos: 'producto_comercial',
} as const;
const CAMPOS = [
  'nombre',
  'descripcion',
  'imagenId',
  'activo',
  'publicado',
  'orden',
] as const;
const SKU = [
  'productoComercialId',
  'codigo',
  'presentacion',
  'tipoEmpaque',
  'pesoGramos',
  'precioBob',
  'activo',
  'validacionComercial',
] as const;

@Injectable()
export class CatalogoService {
  constructor(private readonly db: DataSource) {}

  private async auditar(
    m: EntityManager,
    entidad: string,
    id: string,
    actor: string,
    anterior: Fila | null,
    posterior: Fila,
  ) {
    await m.query(
      'INSERT INTO catalogo_auditoria(entidad,entidad_id,usuario_id,anterior,posterior) VALUES ($1,$2,$3,$4,$5)',
      [entidad, id, actor, anterior, posterior],
    );
  }

  async listar(grupo: Grupo, consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, [
      'page',
      'limit',
      'q',
      'activo',
      'publicado',
      'familiaId',
    ]);
    const parametros: unknown[] = [];
    const filtros: string[] = [];
    const agregar = (sql: string, valor: unknown) => {
      parametros.push(valor);
      filtros.push(sql.replace('?', `$${parametros.length}`));
    };
    const q = consultaTexto(consulta.q, 'q', 100);
    if (q) agregar('t.nombre ILIKE ?', `%${q}%`);
    for (const campo of ['activo', 'publicado']) {
      const valor = activoFiltro(consulta[campo]);
      if (valor !== undefined) agregar(`t.${campo} = ?`, valor);
    }
    if (consulta.familiaId !== undefined) {
      if (grupo !== 'productos')
        throw new BadRequestException(
          'familiaId solo filtra productos comerciales.',
        );
      agregar('t.familia_id = ?::uuid', uuid(consulta.familiaId, 'familiaId'));
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const tabla = TABLAS[grupo];
    const contador =
      grupo === 'familias'
        ? '(SELECT count(*)::int FROM producto_comercial c WHERE c.familia_id=t.id) AS productos_asociados'
        : '(SELECT count(*)::int FROM producto p WHERE p.producto_comercial_id=t.id) AS presentaciones_asociadas';
    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT t.*,${contador}, COALESCE('/api/v1/publico/catalogo/imagenes/'||t.imagen_id::text,t.imagen_original) AS imagen
        FROM ${tabla} t ${where} ORDER BY t.orden,t.nombre,t.id LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, limit, (page - 1) * limit],
      ) as Promise<Fila[]>,
      this.db.query(
        `SELECT count(*)::int AS total FROM ${tabla} t ${where}`,
        parametros,
      ) as Promise<{ total: number }[]>,
    ]);
    return {
      items: items.map(respuestaCatalogo),
      total: total[0].total,
      page,
      limit,
    };
  }

  async obtener(grupo: Grupo, idEntrada: string) {
    const [fila] = (await this.db.query(
      `SELECT *,COALESCE('/api/v1/publico/catalogo/imagenes/'||imagen_id::text,imagen_original) AS imagen FROM ${TABLAS[grupo]} WHERE id=$1`,
      [uuid(idEntrada, 'id')],
    )) as Fila[];
    if (!fila)
      throw new NotFoundException('Registro del catálogo no encontrado.');
    return respuestaCatalogo(fila);
  }

  async guardar(
    grupo: Grupo,
    idEntrada: string | null,
    entrada: unknown,
    actor: string,
  ) {
    const datos = objeto(
      entrada,
      grupo === 'productos'
        ? [...CAMPOS, 'familiaId', 'caracteristicas']
        : CAMPOS,
    );
    const id = idEntrada ? uuid(idEntrada, 'id') : null;
    if (!Object.keys(datos).length)
      throw new BadRequestException('Envía al menos un campo.');
    const valores: Fila = {};
    if (!id || datos.nombre !== undefined)
      valores.nombre = nombreCatalogo(
        datos.nombre,
        grupo === 'familias' ? 70 : 120,
      );
    if (datos.descripcion !== undefined)
      valores.descripcion = textoCatalogo(
        datos.descripcion,
        'descripcion',
        1500,
      );
    if (datos.caracteristicas !== undefined)
      valores.caracteristicas = textoCatalogo(
        datos.caracteristicas,
        'caracteristicas',
        2000,
      );
    if (grupo === 'productos' && (!id || datos.familiaId !== undefined))
      valores.familia_id = uuid(datos.familiaId, 'familiaId');
    if (datos.imagenId !== undefined)
      valores.imagen_id =
        datos.imagenId === null ? null : uuid(datos.imagenId, 'imagenId');
    for (const campo of ['activo', 'publicado'])
      if (datos[campo] !== undefined)
        valores[campo] = booleano(datos[campo], campo);
    if (datos.orden !== undefined) valores.orden = ordenCatalogo(datos.orden);
    try {
      const guardado = await this.db.transaction(async (m) => {
        // Serializa cambios de jerarquía; coordina además contra ventas/reservas.
        await m.query(
          "SELECT pg_advisory_xact_lock(hashtext('catalogo:jerarquia'))",
        );
        if (id) {
          const productos = (await m.query(
            grupo === 'familias'
              ? 'SELECT p.id FROM producto p JOIN producto_comercial c ON c.id=p.producto_comercial_id WHERE c.familia_id=$1'
              : 'SELECT id FROM producto WHERE producto_comercial_id=$1',
            [id],
          )) as { id: string }[];
          await bloquearProductos(
            m,
            productos.map((p) => p.id),
          );
        }
        const [anterior] = id
          ? ((await m.query(
              `SELECT * FROM ${TABLAS[grupo]} WHERE id=$1 FOR UPDATE`,
              [id],
            )) as Fila[])
          : [];
        if (id && !anterior)
          throw new NotFoundException('Registro del catálogo no encontrado.');
        if (valores.familia_id) {
          const familias = (await m.query(
            'SELECT id FROM familia WHERE id=$1 AND activo=true',
            [valores.familia_id],
          )) as Fila[];
          if (!familias.length)
            throw new ConflictException('Selecciona una familia activa.');
        }
        const columnas = Object.keys(valores),
          params = Object.values(valores);
        const [posterior] = (await m.query(
          id
            ? `WITH actualizado AS (UPDATE ${TABLAS[grupo]} SET ${columnas.map((c, i) => `${c}=$${i + 1}`).join(',')},actualizado_en=now() WHERE id=$${params.length + 1} RETURNING *) SELECT * FROM actualizado`
            : `INSERT INTO ${TABLAS[grupo]}(${columnas.join(',')}) VALUES (${params.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
          id ? [...params, id] : params,
        )) as Fila[];
        await this.auditar(
          m,
          TABLAS[grupo],
          posterior.id as string,
          actor,
          anterior ?? null,
          posterior,
        );
        return posterior.id as string;
      });
      return this.obtener(grupo, guardado);
    } catch (e) {
      conflictoCatalogo(e);
    }
  }

  async listarPresentaciones(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, [
      'page',
      'limit',
      'q',
      'activo',
      'familiaId',
      'productoComercialId',
      'validacionComercial',
    ]);
    const params: unknown[] = [];
    const filtros: string[] = [];
    const filtro = (sql: string, v: unknown) => {
      params.push(v);
      filtros.push(sql.replace('?', `$${params.length}`));
    };
    const q = consultaTexto(consulta.q, 'q', 100);
    if (q)
      filtro(
        '(p.codigo ILIKE ? OR p.nombre ILIKE $' + (params.length + 1) + ')',
        `%${q}%`,
      );
    const activo = activoFiltro(consulta.activo);
    if (activo !== undefined) filtro('p.activo=?', activo);
    if (consulta.familiaId !== undefined)
      filtro('c.familia_id=?', uuid(consulta.familiaId, 'familiaId'));
    if (consulta.productoComercialId !== undefined)
      filtro(
        'p.producto_comercial_id=?',
        uuid(consulta.productoComercialId, 'productoComercialId'),
      );
    if (consulta.validacionComercial !== undefined) {
      if (
        typeof consulta.validacionComercial !== 'string' ||
        !['LEGADO', 'PROVISIONAL', 'VALIDADO'].includes(
          consulta.validacionComercial,
        )
      )
        throw new BadRequestException('Validación comercial inválida.');
      filtro('p.validacion_comercial=?', consulta.validacionComercial);
    }
    const from = `FROM producto p LEFT JOIN producto_comercial c ON c.id=p.producto_comercial_id ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}`;
    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT p.*,c.familia_id,c.nombre AS nombre_comercial ${from} ORDER BY p.nombre,p.codigo LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit],
      ) as Promise<Fila[]>,
      this.db.query(`SELECT count(*)::int AS total ${from}`, params) as Promise<
        { total: number }[]
      >,
    ]);
    return {
      items: items.map(respuestaCatalogo),
      total: total[0].total,
      page,
      limit,
    };
  }

  async obtenerPresentacion(idEntrada: string) {
    const [p] = (await this.db.query(
      'SELECT p.*,c.familia_id,c.nombre AS nombre_comercial FROM producto p LEFT JOIN producto_comercial c ON c.id=p.producto_comercial_id WHERE p.id=$1',
      [uuid(idEntrada, 'id')],
    )) as Fila[];
    if (!p) throw new NotFoundException('Presentación no encontrada.');
    return respuestaCatalogo(p);
  }

  async guardarPresentacion(
    idEntrada: string | null,
    entrada: unknown,
    actor: string,
  ) {
    const datos = objeto(entrada, SKU);
    const id = idEntrada ? uuid(idEntrada, 'id') : null;
    if (!Object.keys(datos).length)
      throw new BadRequestException('Envía al menos un campo.');
    const valores: Fila = {};
    if (!id || datos.productoComercialId !== undefined)
      valores.producto_comercial_id = uuid(
        datos.productoComercialId,
        'productoComercialId',
      );
    if (!id || datos.codigo !== undefined)
      valores.codigo = codigo(datos.codigo, 'codigo', 40);
    if (!id || datos.presentacion !== undefined)
      valores.presentacion = texto(datos.presentacion, 'presentacion', 100);
    if (!id || datos.tipoEmpaque !== undefined)
      valores.tipo_empaque = texto(datos.tipoEmpaque, 'tipoEmpaque', 100);
    if (!id || datos.pesoGramos !== undefined)
      valores.peso_gramos = enteroPositivo(datos.pesoGramos, 'pesoGramos');
    if (!id || datos.precioBob !== undefined)
      valores.precio_bob = precio(datos.precioBob);
    if (datos.activo !== undefined)
      valores.activo = booleano(datos.activo, 'activo');
    if (
      !id ||
      datos.validacionComercial !== undefined ||
      datos.precioBob !== undefined
    ) {
      const estado = datos.validacionComercial ?? 'PROVISIONAL';
      if (
        typeof estado !== 'string' ||
        !['PROVISIONAL', 'VALIDADO'].includes(estado)
      )
        throw new BadRequestException('Selecciona PROVISIONAL o VALIDADO.');
      valores.validacion_comercial = estado;
      valores.validado_por = estado === 'VALIDADO' ? actor : null;
      valores.validado_en = estado === 'VALIDADO' ? new Date() : null;
    }
    try {
      const guardado = await this.db.transaction(async (m) => {
        await m.query(
          "SELECT pg_advisory_xact_lock(hashtext('catalogo:jerarquia'))",
        );
        if (id) await bloquearProductos(m, [id]);
        const [anterior] = id
          ? ((await m.query('SELECT * FROM producto WHERE id=$1 FOR UPDATE', [
              id,
            ])) as Fila[])
          : [];
        if (id && !anterior)
          throw new NotFoundException('Presentación no encontrada.');
        if (valores.producto_comercial_id) {
          const [c] = (await m.query(
            'SELECT c.nombre,f.nombre AS familia FROM producto_comercial c JOIN familia f ON f.id=c.familia_id WHERE c.id=$1 AND c.activo AND f.activo',
            [valores.producto_comercial_id],
          )) as Fila[];
          if (!c)
            throw new ConflictException(
              'Selecciona un producto comercial y una familia activos.',
            );
          // No refrescar nombres históricos cuando el usuario edita únicamente precio/estado.
          if (
            !id ||
            valores.producto_comercial_id !== anterior.producto_comercial_id
          ) {
            valores.nombre = c.nombre;
            valores.familia = c.familia;
          }
        }
        const columnas = Object.keys(valores),
          params = Object.values(valores);
        const [posterior] = (await m.query(
          id
            ? `WITH actualizado AS (UPDATE producto SET ${columnas.map((c, i) => `${c}=$${i + 1}`).join(',')},actualizado_en=now() WHERE id=$${params.length + 1} RETURNING *) SELECT * FROM actualizado`
            : `INSERT INTO producto(${columnas.join(',')}) VALUES (${params.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
          id ? [...params, id] : params,
        )) as Fila[];
        await this.auditar(
          m,
          'producto',
          posterior.id as string,
          actor,
          anterior ?? null,
          posterior,
        );
        return posterior.id as string;
      });
      return this.obtenerPresentacion(guardado);
    } catch (e) {
      conflictoCatalogo(e);
    }
  }

  async publico() {
    // Proyección cerrada: jamás devuelve filas internas completas, precios provisionales o stock.
    const familias = (await this.db
      .query(`SELECT f.id,f.slug,f.nombre,f.descripcion,f.orden,
      COALESCE('/api/v1/publico/catalogo/imagenes/'||f.imagen_id::text,f.imagen_original) AS imagen
      FROM familia f WHERE f.publicado AND f.activo ORDER BY f.orden,f.nombre,f.id`)) as Fila[];
    const productos = (await this.db
      .query(`SELECT c.id,c.familia_id,c.nombre,c.descripcion,c.caracteristicas,c.orden,
      COALESCE('/api/v1/publico/catalogo/imagenes/'||c.imagen_id::text,c.imagen_original) AS imagen
      FROM producto_comercial c JOIN familia f ON f.id=c.familia_id
      WHERE c.publicado AND c.activo AND f.publicado AND f.activo ORDER BY c.orden,c.nombre,c.id`)) as Fila[];
    return {
      familias: familias.map((f) => ({
        ...f,
        productos: productos
          .filter((p) => p.familia_id === f.id)
          .map(({ familia_id: _familia, ...p }) => p),
      })),
    };
  }
}
