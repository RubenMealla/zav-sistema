import { expect, test } from '@playwright/test';

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de QA ${nombre}.`);
  return valor;
}

test('edita y desactiva un producto desde la web', async ({ page }) => {
  const codigo = `QA-CRUD-${Date.now()}`;

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();

  const alta = page.getByRole('dialog', { name: 'Registrar producto' });
  await alta.getByLabel('Código').fill(codigo);
  await alta.getByLabel('Nombre').fill('Producto CRUD E3');
  await alta.getByLabel('Familia').fill('Pruebas');
  await alta.getByLabel('Presentación').fill('Unidad de prueba');
  await alta.getByLabel('Peso (gramos)').fill('300');
  await alta.getByLabel('Precio (Bs)').fill('21.50');
  await alta.getByRole('button', { name: 'Guardar producto' }).click();

  let fila = page.getByRole('row').filter({ has: page.getByRole('cell', { name: codigo }) });
  await fila.getByRole('button', { name: 'Editar' }).click();

  const edicion = page.getByRole('dialog', { name: 'Editar producto' });
  await edicion.getByLabel('Nombre').fill('Producto CRUD E3 actualizado');
  await edicion.getByLabel('Precio (Bs)').fill('22.75');
  await edicion.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page.getByRole('status')).toContainText('Producto actualizado correctamente');
  fila = page.getByRole('row').filter({ has: page.getByRole('cell', { name: codigo }) });
  await expect(fila).toContainText('Producto CRUD E3 actualizado');

  await fila.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('status')).toContainText('Producto desactivado correctamente');

  fila = page.getByRole('row').filter({ has: page.getByRole('cell', { name: codigo }) });
  await expect(fila.getByText('INACTIVO')).toBeVisible();
  await expect(fila.getByText('Sin acciones')).toBeVisible();
});
