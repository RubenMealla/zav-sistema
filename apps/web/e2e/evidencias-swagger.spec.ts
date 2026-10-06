import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'test-results', 'evidencias-swagger');

async function captura(page: Page, nombre: string) {
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, nombre), fullPage: true });
}

function operacion(page: Page, ruta: string): Locator {
  return page.locator('.opblock').filter({
    has: page.locator('.opblock-summary-path', { hasText: ruta }),
  }).first();
}

async function abrirOperacion(page: Page, ruta: string) {
  const bloque = operacion(page, ruta);
  await expect(bloque).toBeVisible();
  const body = bloque.locator('.opblock-body');
  if (!(await body.isVisible().catch(() => false))) {
    await bloque.locator('.opblock-summary').click();
  }
  await expect(bloque.locator('.opblock-body')).toBeVisible();
  return bloque;
}

async function ejecutarConBody(page: Page, ruta: string, body: unknown) {
  const bloque = await abrirOperacion(page, ruta);
  const tryBtn = bloque.getByRole('button', { name: /Try it out/i });
  if (await tryBtn.isVisible().catch(() => false)) await tryBtn.click();
  const textarea = bloque.locator('textarea.body-param__text');
  await expect(textarea).toBeVisible();
  await textarea.fill(JSON.stringify(body, null, 2));
  await bloque.getByRole('button', { name: /Execute/i }).click();
  return bloque;
}

test.describe.serial('Evidencias reales de Swagger UI', () => {
  test('captura documentación y respuestas HTTP reales', async ({ page }) => {
    await page.goto('/swagger');
    await expect(page.locator('#swagger-ui')).toBeVisible();
    await expect(page.getByText('ZAV API', { exact: false }).first()).toBeVisible({ timeout: 30_000 });

    await captura(page, 'SW-01-swagger-api.png');

    const salud = await abrirOperacion(page, '/api/v1/salud');
    const trySalud = salud.getByRole('button', { name: /Try it out/i });
    if (await trySalud.isVisible().catch(() => false)) await trySalud.click();
    await salud.getByRole('button', { name: /Execute/i }).click();
    await expect(salud.locator('.responses-table')).toContainText('200');
    await salud.scrollIntoViewIfNeeded();
    await salud.screenshot({ path: path.join(OUT, 'SW-02-salud-200.png') });

    const login401 = await ejecutarConBody(page, '/api/v1/auth/login', {
      identificador: 'invalido@zav.test',
      contrasena: 'incorrecta',
    });
    await expect(login401.locator('.responses-table')).toContainText('401');
    await login401.scrollIntoViewIfNeeded();
    await login401.screenshot({ path: path.join(OUT, 'SW-03-login-401.png') });

    const login400 = await ejecutarConBody(page, '/api/v1/auth/login', {
      identificador: 'vendedor@zav.test',
    });
    await expect(login400.locator('.responses-table')).toContainText('400');
    await login400.scrollIntoViewIfNeeded();
    await login400.screenshot({ path: path.join(OUT, 'SW-04-login-400.png') });

    const productos = await abrirOperacion(page, '/api/v1/productos');
    const tryProductos = productos.getByRole('button', { name: /Try it out/i });
    if (await tryProductos.isVisible().catch(() => false)) await tryProductos.click();
    await productos.getByRole('button', { name: /Execute/i }).click();
    await expect(productos.locator('.responses-table')).toContainText('401');
    await productos.scrollIntoViewIfNeeded();
    await productos.screenshot({ path: path.join(OUT, 'SW-05-productos-401.png') });
  });
});
