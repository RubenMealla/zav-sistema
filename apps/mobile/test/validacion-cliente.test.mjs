import './soporte.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { validarDatosCliente } = await import('../src/lib/validacion-cliente.ts');
test('cliente admite nombres comerciales con tildes, números y teléfono opcional', () => {
  for (const telefono of ['', '  ', '70000000', '+591 7000-0000', '6641234'])
    assert.equal(validarDatosCliente('Tienda Doña María 2', telefono), null);
});
test('cliente rechaza nombre sin letras, invisible y teléfono mal formado', () => {
  for (const nombre of ['  ', '123', '---', 'Tienda\u200bQA', '<b>Tienda</b>', 'A'.repeat(141)])
    assert.ok(validarDatosCliente(nombre, ''));
  for (const telefono of ['llamar mañana', '123', '1234567890123456', '++59170000000', '7000/0000'])
    assert.ok(validarDatosCliente('Tienda QA', telefono));
});
