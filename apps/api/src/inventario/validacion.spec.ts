import { BadRequestException } from '@nestjs/common';
import {
  codigo,
  enteroPositivo,
  fechaIso,
  objeto,
  paginacion,
  precio,
  uuid,
} from './validacion.js';

describe('Validacion del inventario', () => {
  it('normaliza codigos y valida UUID', () => {
    expect(codigo('  prod-01 ', 'codigo', 40)).toBe('PROD-01');
    expect(uuid('11111111-1111-4111-8111-111111111111', 'id')).toBe('11111111-1111-4111-8111-111111111111');
    expect(() => uuid('no-uuid', 'id')).toThrow(BadRequestException);
  });

  it('rechaza cantidades que no son enteros positivos', () => {
    expect(enteroPositivo(5, 'cantidadInicial')).toBe(5);
    for (const valor of [0, -1, 1.2, '5', Number.MAX_SAFE_INTEGER]) {
      expect(() => enteroPositivo(valor, 'cantidadInicial')).toThrow(BadRequestException);
    }
  });

  it('valida fecha comercial y precio sin aceptar fechas imposibles', () => {
    expect(fechaIso('2026-09-24', 'elaboradoEl')).toBe('2026-09-24');
    expect(() => fechaIso('2026-02-30', 'elaboradoEl')).toThrow(BadRequestException);
    expect(precio('12.50')).toBe('12.50');
    expect(() => precio('-1')).toThrow(BadRequestException);
    expect(() => precio('4.123')).toThrow(BadRequestException);
  });

  it('rechaza campos inesperados y filtros de pagina incorrectos', () => {
    expect(() => objeto({ codigo: 'X', condicion: 'LIBERADO' }, ['codigo'])).toThrow(BadRequestException);
    expect(() => paginacion({ page: '0' }, ['page', 'limit'])).toThrow(BadRequestException);
    expect(paginacion({}, ['page', 'limit'])).toEqual({ page: 1, limit: 20 });
  });
});
