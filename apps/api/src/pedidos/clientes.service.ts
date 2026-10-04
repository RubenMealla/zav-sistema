import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { consultaTexto, objeto, paginacion, texto, uuid } from '../inventario/validacion.js';

const CAMPOS_CLIENTE = ['nombre', 'telefono', 'direccion', 'latitud', 'longitud'] as const;
const CAMPOS_UBICACION = ['direccion', 'latitud', 'longitud'] as const;
const CAMPOS_EDICION = ['nombre', 'telefono', 'direccion', 'latitud', 'longitud'] as const;
const CAMPOS_ESTADO = ['activo'] as const;

function telefonoOpcional(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return texto(valor, 'telefono', 30);
}

function coordenada(valor: unknown, campo: string, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new BadRequestException(`${campo} debe estar entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

function coordenadasOpcionales(datos: Record<string, unknown>) {
  const tieneLat = datos.latitud !== undefined && datos.latitud !== null;
  const tieneLon = datos.longitud !== undefined && datos.longitud !== null;
  if (tieneLat !== tieneLon) {
    throw new BadRequestException('latitud y longitud deben enviarse juntas.');
  }
  if (!tieneLat) return { latitud: null, longitud: null };
  return {
    latitud: coordenada(datos.latitud, 'latitud', -90, 90),
    longitud: coordenada(datos.longitud, 'longitud', -180, 180),
  };
}

@Injectable()
export class ClientesService {
  constructor(private readonly db: DataSource) {}

  async crear(entrada: unknown) {
    const datos = objeto(entrada, CAMPOS_CLIENTE);
    const nombre = texto(datos.nombre, 'nombre', 140);
    const telefono = telefonoOpcional(datos.telefono);
    const direccion = texto(datos.direccion, 'direccion', 240);
    const { latitud, longitud } = coordenadasOpcionales(datos);
    if (latitud === null || longitud === null) {
      throw new BadRequestException(
        'Todo cliente nuevo requiere una ubicación confirmada en Tarija.',
      );
    }

    const filas = await this.db.query(
      `INSERT INTO cliente
         (nombre, telefono, direccion, latitud, longitud, ubicacion_confirmada_en)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() END)
       RETURNING id, nombre, telefono, direccion, latitud, longitud,
                 ubicacion_confirmada_en, activo, creado_en, actualizado_en`,
      [nombre, telefono, direccion, latitud, longitud],
    ) as Array<Record<string, unknown>>;

    return this.respuesta(filas[0]);
  }

  async actualizar(idEntrada: string, entrada: unknown) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_EDICION);
    const nombre = texto(datos.nombre, 'nombre', 140);
    const telefono = telefonoOpcional(datos.telefono);
    const direccion = texto(datos.direccion, 'direccion', 240);
    const { latitud, longitud } = coordenadasOpcionales(datos);

    if (latitud === null || longitud === null) {
      throw new BadRequestException(
        'El cliente debe conservar una ubicación confirmada.',
      );
    }

    await this.db.query(
      `UPDATE cliente
       SET nombre = $2,
           telefono = $3,
           direccion = $4,
           latitud = $5,
           longitud = $6,
           ubicacion_confirmada_en = now(),
           actualizado_en = now()
       WHERE id = $1::uuid AND activo = TRUE`,
      [id, nombre, telefono, direccion, latitud, longitud],
    );

    return this.obtener(id);
  }

  async actualizarUbicacion(idEntrada: string, entrada: unknown) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_UBICACION);
    const { latitud, longitud } = coordenadasOpcionales(datos);
    if (latitud === null || longitud === null) {
      throw new BadRequestException('La ubicacion confirmada requiere latitud y longitud.');
    }

    const direccion =
      datos.direccion === undefined ? null : texto(datos.direccion, 'direccion', 240);

    await this.db.query(
      `UPDATE cliente
       SET direccion = COALESCE($2, direccion),
           latitud = $3,
           longitud = $4,
           ubicacion_confirmada_en = now(),
           actualizado_en = now()
       WHERE id = $1::uuid AND activo = TRUE`,
      [id, direccion, latitud, longitud],
    );

    return this.obtener(id);
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['q', 'activo', 'page', 'limit']);
    const q = consultaTexto(consulta.q, 'q', 100);
    const parametros: unknown[] = [];
    const condiciones: string[] = [];

    if (consulta.activo === undefined || consulta.activo === 'true') {
      condiciones.push('activo = TRUE');
    } else if (consulta.activo === 'false') {
      condiciones.push('activo = FALSE');
    } else if (consulta.activo !== 'todos') {
      throw new BadRequestException('activo debe ser true, false o todos.');
    }

    if (q) {
      parametros.push(`%${q}%`);
      condiciones.push(`(nombre ILIKE $${parametros.length} OR COALESCE(telefono, '') ILIKE $${parametros.length})`);
    }

    parametros.push(limit, (page - 1) * limit);
    const limitePos = parametros.length - 1;
    const offsetPos = parametros.length;

    const where = condiciones.length ? condiciones.join(' AND ') : 'TRUE';
    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT id, nombre, telefono, direccion, latitud, longitud,
                ubicacion_confirmada_en, activo, creado_en, actualizado_en
         FROM cliente
         WHERE ${where}
         ORDER BY nombre, id
         LIMIT $${limitePos} OFFSET $${offsetPos}`,
        parametros,
      ) as Promise<Array<Record<string, unknown>>>,
      this.db.query(
        `SELECT count(*)::int AS total FROM cliente WHERE ${where}`,
        parametros.slice(0, parametros.length - 2),
      ) as Promise<Array<{ total: number }>>,
    ]);

    return {
      items: items.map((fila) => this.respuesta(fila)),
      total: total[0].total,
      page,
      limit,
    };
  }

  async cambiarEstado(idEntrada: string, entrada: unknown) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_ESTADO);
    if (typeof datos.activo !== 'boolean') {
      throw new BadRequestException('activo debe ser booleano.');
    }

    const filas = await this.db.query(
      `UPDATE cliente
       SET activo = $2,
           actualizado_en = now()
       WHERE id = $1::uuid
       RETURNING id`,
      [id, datos.activo],
    ) as Array<{ id: string }>;

    if (!filas.length) throw new NotFoundException('Cliente no encontrado.');
    return this.obtener(id);
  }

  async obtener(idEntrada: string) {
    const id = uuid(idEntrada, 'id');
    const filas = await this.db.query(
      `SELECT id, nombre, telefono, direccion, latitud, longitud,
              ubicacion_confirmada_en, activo, creado_en, actualizado_en
       FROM cliente WHERE id = $1::uuid`,
      [id],
    ) as Array<Record<string, unknown>>;

    if (!filas.length) throw new NotFoundException('Cliente no encontrado.');
    return this.respuesta(filas[0]);
  }

  private respuesta(fila: Record<string, unknown>) {
    return {
      id: fila.id,
      nombre: fila.nombre,
      telefono: fila.telefono,
      direccion: fila.direccion,
      ubicacion:
        fila.latitud === null || fila.latitud === undefined
          ? null
          : {
              latitud: Number(fila.latitud),
              longitud: Number(fila.longitud),
              confirmadaEn: fila.ubicacion_confirmada_en,
            },
      activo: fila.activo,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
    };
  }
}
