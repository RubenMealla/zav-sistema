import { expect, test } from '@playwright/test';
import { limiteSeguro, paginaSegura } from '../app/panel/lib/paginacion-panel';

test('limites permitidos y parametros invalidos', () => {
  expect(limiteSeguro('20')).toBe(20);
  expect(limiteSeguro('150')).toBe(150);
  expect(limiteSeguro('20xyz')).toBe(20);
  expect(limiteSeguro('999')).toBe(20);
  expect(limiteSeguro(undefined)).toBe(20);
  expect(paginaSegura('3')).toBe(3);
  expect(paginaSegura('3abc')).toBe(1);
  expect(paginaSegura('0')).toBe(1);
  expect(paginaSegura('-1')).toBe(1);
  expect(paginaSegura('999999999999999999999')).toBe(1);
});
