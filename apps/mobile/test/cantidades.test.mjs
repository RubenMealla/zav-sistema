import './soporte.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { errorCantidad, validarCantidades } = await import('../src/lib/cantidades.ts');

const stock = [{ id: 'uno', nombre: 'Paquete 500 g', disponible: 20 }, { id: 'dos', nombre: 'Paquete 250 g', disponible: 5 }];
test('cantidades pegadas no se convierten silenciosamente ni permiten una entrega parcial', () => {
  for (const valor of ['1.5', '-3', '1,5', '1e1', '+3', ' 3 ', 'abc', '2147483648']) {
    assert.ok(errorCantidad(valor, 20), valor);
    assert.ok(validarCantidades({ uno: valor, dos: '2' }, stock), valor);
  }
  assert.equal(validarCantidades({ uno: '3', dos: '2' }, stock), null);
  assert.equal(validarCantidades({ uno: '', dos: '2' }, stock), null);
});
test('revisa stock, selecciones ausentes y límite de líneas antes de obtener GPS o enviar', () => {
  assert.match(validarCantidades({ uno: '21' }, stock), /20/);
  assert.match(validarCantidades({ desaparecido: '1', dos: '2' }, stock), /ya no está disponible/);
  assert.match(validarCantidades({ uno: '0' }, stock), /al menos/);
  assert.match(validarCantidades({ uno: '2', dos: '2' }, stock, 1), /máximo 1/);
});
