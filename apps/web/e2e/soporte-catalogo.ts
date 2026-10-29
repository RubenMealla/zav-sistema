import { expect, type Page } from "@playwright/test";

export async function guardarCatalogo(page: Page) {
  await page
    .locator(".gestion-editor")
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  const confirmacion = page.getByRole("alertdialog", {
    name: "Guardar catálogo",
  });
  await expect(confirmacion).toBeVisible();
  await confirmacion
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Catálogo actualizado correctamente." }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /catálogo/ })).toHaveCount(0);
}
export async function crearPresentacionWeb(
  page: Page,
  {
    codigo,
    nombre,
    precio = "18.50",
    peso = "250",
  }: { codigo: string; nombre: string; precio?: string; peso?: string },
) {
  await page.goto("/panel?vista=catalogo");
  await page
    .getByRole("button", { name: "Productos comerciales", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear producto", exact: true })
    .click();
  let editor = page.getByRole("region", { name: "Crear catálogo" });
  await editor
    .getByRole("combobox", { name: "Familia", exact: true })
    .selectOption({ label: "Salchichas" });
  await editor.getByLabel("Nombre", { exact: true }).fill(nombre);
  await guardarCatalogo(page);
  await page
    .getByRole("button", { name: "Presentaciones / SKU", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear presentación", exact: true })
    .click();
  editor = page.getByRole("region", { name: "Crear catálogo" });
  await editor
    .getByRole("combobox", { name: "Familia", exact: true })
    .selectOption({ label: "Salchichas" });
  await editor
    .getByRole("combobox", { name: "Producto comercial", exact: true })
    .selectOption({ label: nombre });
  await editor.getByLabel("Código SKU", { exact: true }).fill(codigo);
  await editor
    .getByLabel("Presentación", { exact: true })
    .fill("Paquete de prueba");
  await editor
    .getByLabel("Tipo de empaque", { exact: true })
    .fill("Empaque QA");
  await editor.getByLabel("Peso (gramos)", { exact: true }).fill(peso);
  await editor.getByLabel("Precio (Bs)", { exact: true }).fill(precio);
  await editor
    .getByRole("combobox", { name: "Validación comercial", exact: true })
    .selectOption("VALIDADO");
  await guardarCatalogo(page);
  await page.getByLabel("Buscar", { exact: true }).fill(codigo);
  await expect(page.getByRole("row").filter({ hasText: codigo })).toBeVisible();
}
