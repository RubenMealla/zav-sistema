import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  return valor;
}

const DIR = path.join(process.cwd(), 'test-results', 'evidencias-web-documento');

test('captura un producto registrado sin datos de otras pruebas', async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  const codigo = `QA-DOC-${Date.now()}`;

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await expect(page).toHaveURL(/\/panel/);

  const modulos = page.getByRole('navigation', { name: 'Módulos del sistema', exact: true });
  await modulos.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();

  const modal = page.getByRole('dialog');
  await modal.getByLabel('Familia').fill('Fiambres');
  await modal.getByLabel('Código').fill(codigo);
  await modal.getByLabel('Nombre').fill('Producto de prueba QA');
  await modal.getByLabel('Presentación').fill('Unidad de prueba');
  await modal.getByLabel('Peso (gramos)').fill('250');
  await modal.getByLabel('Precio (Bs)').fill('19.50');
  await modal.getByRole('button', { name: 'Guardar producto' }).click();

  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Sí, registrar producto', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('Producto registrado correctamente');
  const buscar = page.getByPlaceholder('Código o nombre del producto');
  await buscar.fill(codigo);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('cell', { name: codigo })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);

  await page.screenshot({
    path: path.join(DIR, 'web-producto-registrado.png'),
    fullPage: true,
  });
});
