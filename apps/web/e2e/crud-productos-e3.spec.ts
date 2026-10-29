import { crearPresentacionWeb,guardarCatalogo } from './soporte-catalogo';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

function requerida(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de QA ${nombre}.`);
  return valor;
}

test('edita y desactiva un producto desde la web', async ({ page }) => {
  test.setTimeout(120_000);
  const codigo = `QA-CRUD-${Date.now()}`;
  const dir = path.join(process.cwd(), 'test-results', 'evidencias-web-documento');
  await mkdir(dir, { recursive: true });

  await page.goto('/acceso');
  await page.getByLabel('Identificador', { exact: true }).fill(requerida('QA_ADMIN_IDENTIFICADOR'));
  await page.getByLabel('Contraseña', { exact: true }).fill(requerida('QA_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await expect(page).toHaveURL(/\/panel/);

  await crearPresentacionWeb(page,{codigo,nombre:`Producto CRUD E3 ${codigo}`,precio:'21.50',peso:'300'});
  let fila=page.getByRole('row').filter({hasText:codigo});
  await fila.getByRole('button',{name:'Editar',exact:true}).click();
  let editor=page.getByRole('region',{name:'Editar catálogo'});
  await expect(editor.getByLabel('Código SKU')).toHaveAttribute('readonly','');
  await editor.getByLabel('Precio (Bs)',{exact:true}).fill('22.75');
  await guardarCatalogo(page);
  await expect(fila).toContainText('22.75');
  await page.screenshot({path:path.join(dir,'WEB-17-producto-editado.png'),fullPage:true});
  await fila.getByRole('button',{name:'Editar',exact:true}).click();
  editor=page.getByRole('region',{name:'Editar catálogo'});
  await editor.getByLabel('Activo para operaciones').uncheck();
  await editor.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  const confirmacion=page.getByRole('alertdialog',{name:'Guardar catálogo'});
  await expect(confirmacion).toBeVisible();
  await page.screenshot({path:path.join(dir,'WEB-18-confirmacion-baja-producto.png'),fullPage:true});
  const caja=await confirmacion.boundingBox(),viewport=page.viewportSize();
  expect(caja).not.toBeNull();expect(viewport).not.toBeNull();
  expect(caja!.x).toBeGreaterThanOrEqual(0);expect(caja!.x+caja!.width).toBeLessThanOrEqual(viewport!.width+1);
  expect(caja!.y).toBeGreaterThanOrEqual(0);expect(caja!.y+caja!.height).toBeLessThanOrEqual(viewport!.height+1);
  await confirmacion.getByRole('button',{name:'Cancelar'}).click();
  await expect(fila.getByRole('cell',{name:'Activo',exact:true})).toBeVisible();
  await guardarCatalogo(page);
  fila=page.getByRole('row').filter({hasText:codigo});
  await expect(fila.getByRole('cell',{name:'Inactivo',exact:true})).toBeVisible();
  // La nueva gestión permite reactivar sin borrar el registro ni cambiar su SKU.
  await fila.getByRole('button',{name:'Editar',exact:true}).click();
  await expect(page.getByRole('region',{name:'Editar catálogo'}).getByLabel('Código SKU')).toHaveValue(codigo);
  await page.screenshot({path:path.join(dir,'WEB-19-producto-desactivado.png'),fullPage:true});
});
