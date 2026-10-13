import { BadRequestException, ConflictException } from '@nestjs/common';
import { codigoPostgres, texto } from '../inventario/validacion.js';

export function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean')
    throw new BadRequestException(`${campo} debe ser verdadero o falso.`);
  return valor;
}

export function textoCatalogo(
  valor: unknown,
  campo: string,
  maximo: number,
): string {
  if (typeof valor !== 'string' || valor.length > maximo)
    throw new BadRequestException(
      `${campo} supera el límite de ${maximo} caracteres.`,
    );
  return valor.trim();
}

export function nombreCatalogo(valor: unknown, maximo: number): string {
  return texto(valor, 'nombre', maximo).normalize('NFC').replace(/\s+/g, ' ');
}

export function ordenCatalogo(valor: unknown): number {
  if (
    typeof valor !== 'number' ||
    !Number.isInteger(valor) ||
    valor < 0 ||
    valor > 100000
  )
    throw new BadRequestException('orden debe ser un entero entre 0 y 100000.');
  return valor;
}

export function conflictoCatalogo(error: unknown): never {
  const codigo = codigoPostgres(error);
  if (codigo === '23505')
    throw new ConflictException(
      'Ya existe un nombre equivalente en este grupo o el código SKU está utilizado.',
    );
  if (codigo === '23503')
    throw new ConflictException(
      'La relación indicada no existe o el registro conserva referencias.',
    );
  if (codigo === '23514')
    throw new ConflictException(
      'No se puede cambiar la identidad de un SKU con historial ni reutilizar su código. Crea una nueva presentación.',
    );
  throw error;
}

export function respuestaCatalogo(
  fila: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fila)
      .filter(([k]) => k !== 'nombre_normalizado')
      .map(([k, v]) => [
        k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()),
        v,
      ]),
  );
}
