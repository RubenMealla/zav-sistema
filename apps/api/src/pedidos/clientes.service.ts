import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { consultaTexto, objeto, paginacion, texto, uuid } from '../inventario/validacion.js';

const CAMPOS_CLIENTE = ['nombre', 'telefono', 'direccion'] as const;

function telefonoOpcional(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return texto(valor, 'telefono', 30);
}

@Injectable()
export class ClientesService {
  constructor(private readonly db: DataSource) {}

  async crear(entrada: unknown) {
    const datos = objeto(entrada, CAMPOS_CLIENTE);
    const nombre = texto(datos.nombre, 'nombre', 140);
    const telefono = telefonoOpcional(datos.telefono);
    const direccion = texto(datos.direccion, 'direccion', 240);

    const filas = await this.db.query(
      `INSERT INTO cliente (nombre, telefono, direccion)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, telefono, direccion, activo, creado_en, actualizado_en`,
      [nombre, telefono, direccion],
    ) as Array<Record<string, unknown>>;

    return this.respuesta(filas[0]);
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['q', 'page', 'limit']);
    const q = consultaTexto(consulta.q, 'q', 100);
    const parametros: unknown[] = [];
    const condiciones = ['activo = TRUE'];

    if (q) {
      parametros.push(`%${q}%`);
      condiciones.push(`(nombre ILIKE $${parametros.length} OR COALESCE(telefono, '') ILIKE $${parametros.length})`);
    }

    parametros.push(limit, (page - 1) * limit);
    const limitePos = parametros.length - 1;
    const offsetPos = parametros.length;

    const where = condiciones.join(' AND ');
    const [items, total] = await Promise.all([
      this.db.query(
        `SELECT id, nombre, telefono, direccion, activo, creado_en, actualizado_en
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

  async obtener(idEntrada: string) {
    const id = uuid(idEntrada, 'id');
    const filas = await this.db.query(
      `SELECT id, nombre, telefono, direccion, activo, creado_en, actualizado_en
       FROM cliente WHERE id = $1::uuid AND activo = TRUE`,
      [id],
    ) as Array<Record<string, unknown>>;

    if (!filas.length) throw new NotFoundException('Cliente activo no encontrado.');
    return this.respuesta(filas[0]);
  }

  private respuesta(fila: Record<string, unknown>) {
    return {
      id: fila.id,
      nombre: fila.nombre,
      telefono: fila.telefono,
      direccion: fila.direccion,
      activo: fila.activo,
      creadoEn: fila.creado_en,
      actualizadoEn: fila.actualizado_en,
    };
  }
}
