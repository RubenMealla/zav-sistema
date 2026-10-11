import { expect, test } from '@playwright/test';
import { VERSION_WEB } from '../app/lib/version';

test('el identificador de versión de la web sigue la convención SemVer', () => {
  expect(VERSION_WEB).toMatch(/^\d+\.\d+\.\d+$/);
});

for (const ancho of [390, 1440]) {
  test(`muestra la misma versión en sitio, acceso y panel a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/');
    await expect(page.locator('.publico-footer-legal')).toContainText(`Versión web ${VERSION_WEB}`);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    await page.goto('/acceso');
    await expect(page.locator('.acceso-panel-pie')).toContainText(`Versión web ${VERSION_WEB}`);

    const identificador = process.env.QA_ADMIN_IDENTIFICADOR;
    const contrasena = process.env.QA_ADMIN_PASSWORD;
    if (!identificador || !contrasena) {
      throw new Error('La verificación del panel requiere las cuentas sintéticas de QA.');
    }

    await page.getByLabel('Identificador', { exact: true }).fill(identificador);
    await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
    await expect(page.getByTestId('version-web-panel')).toHaveText(`Versión web ${VERSION_WEB}`);
    await expect(page.getByTestId('version-web-panel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
