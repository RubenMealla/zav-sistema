import { BadRequestException } from '@nestjs/common';
import { enteroPositivo, objeto, texto, uuid } from '../inventario/validacion.js';
import type { DetalleEntrada } from './tipos-pedidos.js';

export const CAMPOS_PEDIDO = ['clienteId', 'direccionEntrega', 'observacion', 'detalles'] as const;
export const CAMPOS_DETALLE = ['productoId', 'cantidad'] as const;
export const CAMPOS_RETIRO = ['operacionClave'] as const;
export const CAMPOS_RETIROS = ['retiros'] as const;
export const CAMPOS_RETIRO_ITEM = ['pedidoId', 'operacionClave'] as const;
export const CAMPOS_ENTREGA = ['operacionClave', 'latitud', 'longitud', 'precisionMetros', 'observacionDistancia'] as const;
export const CAMPOS_CANCELACION = ['motivo'] as const;

export function opcional(valor: unknown, campo: string, maximo: number): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return texto(valor, campo, maximo);
}

export function numeroRango(valor: unknown, campo: string, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new BadRequestException(`${campo} debe estar entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

export function numeroOpcionalNoNegativo(valor: unknown, campo: string, maximo: number): number | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw new BadRequestException(`${campo} debe ser un numero entre 0 y ${maximo}.`);
  }
  return valor;
}

export function detallesEntrada(valor: unknown): DetalleEntrada[] {
    if (!Array.isArray(valor) || valor.length < 1 || valor.length > 50) {
      throw new BadRequestException('detalles debe contener entre 1 y 50 productos.');
    }

    const detalles = valor.map((elemento, indice) => {
      const datos = objeto(elemento, CAMPOS_DETALLE);
      return {
        productoId: uuid(datos.productoId, `detalles[${indice}].productoId`),
        cantidad: enteroPositivo(datos.cantidad, `detalles[${indice}].cantidad`),
      };
    });

    if (new Set(detalles.map((d) => d.productoId)).size !== detalles.length) {
      throw new BadRequestException('Un producto no puede repetirse dentro del mismo pedido.');
    }

    return detalles;
  }
