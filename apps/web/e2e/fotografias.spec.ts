import { expect, test } from "@playwright/test";
import { guardarCatalogo } from "./soporte-catalogo";
import { readFileSync } from "node:fs";

const fotografia = { name: "fotografia de prueba.png", mimeType: "image/png", buffer: readFileSync("public/catalogo-original/chorizo-coctelero.png") };

for (const grupo of ["familia", "producto"] as const) {
  test(`fotografía de ${grupo}: vista previa, deshacer, persistencia y errores`, async ({ page, request }, testInfo) => {
    test.setTimeout(90000);
    const sesion = await request.post("http://127.0.0.1:3001/api/v1/auth/login", {
      data: { identificador: process.env.QA_ADMIN_IDENTIFICADOR, contrasena: process.env.QA_ADMIN_PASSWORD },
    });
    expect(sesion.status()).toBe(200);
    await page.context().addCookies([{ name: "zav_acceso", value: (await sesion.json()).accessToken, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/panel?vista=catalogo");
    if (grupo === "producto") await page.getByRole("button", { name: "Productos", exact: true }).click();
    await page.getByRole("button", { name: `Crear ${grupo}`, exact: true }).click();
    let editor = page.getByRole("region", { name: "Crear catálogo" });
    const nombre = `Fotografía QA ${grupo} ${Date.now()}`;
    await editor.getByLabel("Nombre", { exact: true }).fill(nombre);
    if (grupo === "producto") await editor.getByRole("combobox", { name: "Familia", exact: true }).selectOption({ label: "Chorizos" });
    const entrada = () => editor.getByLabel("Fotografía", { exact: true });
    await entrada().setInputFiles({ name: "no-es-foto.txt", mimeType: "text/plain", buffer: Buffer.from("prueba") });
    await expect(page.getByRole("alert").filter({ hasText: "Selecciona una fotografía" })).toBeVisible();
    await expect(editor.getByAltText("Vista previa de la fotografía")).toHaveCount(0);

    let liberar!: () => void;
    const espera = new Promise<void>(resolve => { liberar = resolve; });
    await page.route("**/api/gestion/catalogo/imagenes", async route => { await espera; await route.continue(); }, { times: 1 });
    await entrada().setInputFiles(fotografia);
    await expect(editor.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", /^blob:/);
    await expect(editor.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
    liberar();
    await expect(editor.getByRole("status")).toContainText("Fotografía lista");
    await editor.getByRole("button", { name: "Deshacer cambio de foto" }).click();
    await expect(editor.getByAltText("Vista previa de la fotografía")).toHaveCount(0);
    await entrada().setInputFiles(fotografia);
    await expect(editor.getByRole("status")).toContainText("Fotografía lista");
    await guardarCatalogo(page);
    await page.getByLabel("Buscar", { exact: true }).fill(nombre);
    const fila = page.getByRole("row").filter({ hasText: nombre });
    await expect(fila.locator("img")).toBeVisible();
    await fila.getByRole("button", { name: "Editar", exact: true }).click();
    editor = page.getByRole("region", { name: "Editar catálogo" });
    const src = await editor.getByAltText("Vista previa de la fotografía").getAttribute("src");
    await page.route("**/api/gestion/catalogo/imagenes", route => route.fulfill({ status: 503, json: { message: "No se pudo subir la fotografía. Reintenta." } }), { times: 1 });
    await entrada().setInputFiles(fotografia);
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo subir" })).toBeVisible();
    await expect(editor.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", src!);
    await expect(editor.getByRole("button", { name: "Guardar cambios", exact: true })).toBeEnabled();
    await entrada().setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("contenido que no es imagen") });
    await expect(editor.getByRole("alert")).toContainText(/imagen|archivo|formato/i);
    await expect(editor.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", src!);
    if (grupo === "producto") await page.setViewportSize({ width: 390, height: 844 });
    await expect(editor.locator(".selector-imagen-vista")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await editor.getByRole("alert").getByRole("button").click();
    await editor.locator(".selector-imagen").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`selector-${grupo}.png`) });
    await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  });
}
