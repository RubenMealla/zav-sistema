import { BadRequestException } from '@nestjs/common';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODIGO = /^[A-Z0-9][A-Z0-9._-]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function objeto(entrada: unknown, permitidos: readonly string[]): Record<string, unknown> {
  if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  }
  const datos = entrada as Record<string, unknown>;
  if (Object.keys(datos).some((clave) => !permitidos.includes(clave))) {
    throw new BadRequestException('El cuerpo contiene campos no permitidos.');
  }
  return datos;
}

export function texto(valor: unknown, campo: string, maximo: number): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
    throw new BadRequestException(`${campo} debe tener entre 1 y ${maximo} caracteres.`);
  }
  return valor.trim();
}

export function codigo(valor: unknown, campo: string, maximo: number): string {
  const normalizado = texto(valor, campo, maximo).toUpperCase();
  if (normalizado.length < 2 || !CODIGO.test(normalizado)) {
    throw new BadRequestException(`${campo} debe contener entre 2 y ${maximo} caracteres: letras, numeros, puntos, guiones o guion bajo.`);
  }
  return normalizado;
}

export function uuid(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) {
    throw new BadRequestException(`${campo} debe ser un UUID valido.`);
  }
  return valor.toLowerCase();
}

export function enteroPositivo(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > 2147483647) {
    throw new BadRequestException(`${campo} debe ser un entero positivo.`);
  }
  return valor;
}

export function precio(valor: unknown): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw new BadRequestException('precioBob debe ser un importe decimal valido.');
  }
  const cadena = String(valor);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cadena)) {
    throw new BadRequestException('precioBob debe ser no negativo, con hasta 10 enteros y 2 decimales.');
  }
  return Number(cadena).toFixed(2);
}

export function fechaIso(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !ISO_DATE.test(valor)) {
    throw new BadRequestException(`${campo} debe tener formato YYYY-MM-DD.`);
  }
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new BadRequestException(`${campo} no es una fecha valida.`);
  }
  return valor;
}

export function paginacion(consulta: Record<string, unknown>, permitidos: readonly string[]) {
  if (Object.keys(consulta).some((clave) => !permitidos.includes(clave))) {
    throw new BadRequestException('Parametro de consulta no permitido.');
  }
  const validar = (valor: unknown, nombre: string, maximo: number, defecto: number): number => {
    if (valor === undefined) return defecto;
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
      throw new BadRequestException(`${nombre} debe ser un entero positivo.`);
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero > maximo) {
      throw new BadRequestException(`${nombre} supera el limite permitido.`);
    }
    return numero;
  };
  return {
    page: validar(consulta.page, 'page', 100000, 1),
    limit: validar(consulta.limit, 'limit', 100, 20),
  };
}

export function consultaTexto(valor: unknown, campo: string, maximo: number): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || valor.trim().length === 0 || valor.trim().length > maximo) {
    throw new BadRequestException(`${campo} no es valido.`);
  }
  return valor.trim();
}

export function activoFiltro(valor: unknown): boolean | undefined {
  if (valor === undefined) return undefined;
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  throw new BadRequestException('activo debe ser true o false.');
}

export function vigenciaFiltro(valor: unknown): 'vigente' | 'vencido' | undefined {
  if (valor === undefined) return undefined;
  if (valor === 'vigente' || valor === 'vencido') return valor;
  throw new BadRequestException('vigencia debe ser vigente o vencido.');
}

export function codigoPostgres(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const err = error as { code?: unknown; driverError?: { code?: unknown } };
  const code = err.driverError?.code ?? err.code;
  return typeof code === 'string' ? code : undefined;
}
