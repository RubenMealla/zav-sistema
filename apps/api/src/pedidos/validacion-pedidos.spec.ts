import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { detallesEntrada, numeroRango, numeroOpcionalNoNegativo } from './validacion-pedidos.js';

const productoId = '11111111-1111-4111-8111-111111111111';

describe('Validacion de pedidos', () => {
  it('acepta un detalle con cantidad entera positiva', () => {
    expect(detallesEntrada([{ productoId, cantidad: 2 }])).toEqual([{ productoId, cantidad: 2 }]);
  });

  it('rechaza productos duplicados, cantidades invalidas y campos extra', () => {
    expect(() => detallesEntrada([{ productoId, cantidad: 1 }, { productoId, cantidad: 1 }])).toThrow(BadRequestException);
    expect(() => detallesEntrada([{ productoId, cantidad: 0 }])).toThrow(BadRequestException);
    expect(() => detallesEntrada([{ productoId, cantidad: 1, precioBob: '0' }])).toThrow(BadRequestException);
  });

  it('valida coordenadas y distancias opcionales', () => {
    expect(numeroRango(-21.5, 'latitud', -90, 90)).toBe(-21.5);
    expect(() => numeroRango(91, 'latitud', -90, 90)).toThrow(BadRequestException);
    expect(numeroOpcionalNoNegativo(undefined, 'precision', 1000)).toBeNull();
    expect(() => numeroOpcionalNoNegativo(-1, 'precision', 1000)).toThrow(BadRequestException);
  });
});
