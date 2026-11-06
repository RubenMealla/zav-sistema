import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { fechaHoyBolivia, fechaIso, nombreTexto, objeto, uuid } from './validacion.js';

const PREFIJOS: Record<string, string> = {
  MORTADELAS: 'MTD', CHORIZOS: 'CHO', SALCHICHAS: 'SAL', MORCILLAS: 'MRC',
  JAMONES: 'JAM', 'TOCINOS Y AHUMADOS': 'TOA', 'FIAMBRES ESPECIALES': 'FES',
};

function prefijoFamilia(nombre: string): string {
  const normalizado = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
  if (PREFIJOS[normalizado]) return PREFIJOS[normalizado];
  const palabras = normalizado.split(/[^A-Z0-9]+/).filter(p => p && !['Y', 'DE', 'DEL', 'LA', 'LAS', 'LOS'].includes(p));
  if (!palabras.length) return 'PRD';
  if (palabras.length === 1) return palabras[0].slice(0, 3).padEnd(3, 'X');
  return (palabras.map(p => p[0]).join('') + palabras.join('')).slice(0, 3).padEnd(3, 'X');
}

@Injectable()
export class CodigosService {
  constructor(private readonly db: DataSource) {}

  // Una sugerencia no reserva un número. Al guardar, la restricción UNIQUE
  // decide de forma atómica: nunca renumerar silenciosamente una etiqueta.
  private async siguiente(tabla: 'producto' | 'lote', base: string, ancho: number, maximo: number) {
    const inicio = `${base}-`;
    const [fila] = await this.db.query<{ siguiente: string }[]>(
      `SELECT (COALESCE(MAX(sufijo::numeric),0)+1)::text AS siguiente
       FROM (SELECT substring(upper(codigo) FROM $2::integer) AS sufijo FROM ${tabla}
             WHERE starts_with(upper(codigo),$1)) c WHERE sufijo ~ '^[0-9]+$'`,
      [inicio, inicio.length + 1],
    );
    const codigo = inicio + fila.siguiente.padStart(ancho, '0');
    if (codigo.length > maximo) throw new ConflictException('La serie de códigos alcanzó su longitud máxima. Introduce un código propio que coincida con la identificación del producto o lote.');
    return codigo;
  }

  async producto(entrada: Record<string, unknown>) {
    const q = objeto(entrada, ['familiaId', 'familia']);
    if ((q.familiaId === undefined) === (q.familia === undefined))
      throw new BadRequestException('Selecciona una familia.');
    let nombre: string;
    if (q.familiaId !== undefined) {
      const [familia] = await this.db.query<{ nombre: string; activo: boolean }[]>('SELECT nombre, activo FROM familia WHERE id=$1', [uuid(q.familiaId, 'familiaId')]);
      if (!familia) throw new NotFoundException('La familia no existe.');
      if (!familia.activo) throw new ConflictException('La familia está inactiva.');
      nombre = familia.nombre;
    } else nombre = nombreTexto(q.familia, 70, 'familia'); // Compatibilidad del formulario anterior.
    const prefijo = prefijoFamilia(nombre);
    return { codigo: await this.siguiente('producto', prefijo, 3, 40), prefijo, convencion: 'interna' };
  }

  async lote(entrada: Record<string, unknown>) {
    const q = objeto(entrada, ['productoId', 'elaboradoEl']);
    const id = uuid(q.productoId, 'productoId');
    const fecha = fechaIso(q.elaboradoEl, 'elaboradoEl');
    if (fecha > fechaHoyBolivia()) throw new BadRequestException('La elaboración no puede ser futura.');
    const [producto] = await this.db.query<{ codigo: string; activo: boolean }[]>('SELECT codigo, activo FROM producto WHERE id=$1', [id]);
    if (!producto) throw new NotFoundException('La presentación no existe.');
    if (!producto.activo) throw new ConflictException('La presentación está inactiva.');
    const base = `TJ-ZAV-${producto.codigo.toUpperCase()}-${fecha.replaceAll('-', '')}`;
    return { codigo: await this.siguiente('lote', base, 2, 60), convencion: 'interna-editable' };
  }
}
