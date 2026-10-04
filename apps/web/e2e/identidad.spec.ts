import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function captura(page: Page, nombre: string) {
  const destino = path.join(process.cwd(), 'test-results', 'evidencias');
  await mkdir(destino, { recursive: true });
  await expect.poll(() => page.locator('img:visible').evaluateAll((imgs) => imgs.every((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0))).toBeTruthy();
  await page.screenshot({ path: path.join(destino, nombre), fullPage: true });
}

async function ingresar(page: Page) {
  const usuario = process.env.QA_ADMIN_IDENTIFICADOR;
  const clave = process.env.QA_ADMIN_PASSWORD;
  if (!usuario || !clave) throw new Error('Faltan las credenciales sintéticas de QA.');
  await page.goto('/acceso');
  await page.getByLabel('Identificador de acceso').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible();
}

async function sinDesborde(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
}

for (const ancho of [390, 768, 1440]) {
  test(`identidad y navegación completa a ${ancho}px`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fiambres y embutidos');
    await expect(page.getByRole('img', { name: 'ZAV · Fiambres y embutidos' }).first()).toBeVisible();
    await expect.poll(() => page.locator('img').evaluateAll((imgs) => imgs.every((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0))).toBeTruthy();
    await sinDesborde(page);
    await captura(page, `identidad-inicio-${ancho}.png`);

    await page.getByRole('link', { name: 'Acceso privado' }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByRole('heading', { name: 'Ingresa a tu espacio de trabajo' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'ZAV · Fiambres y embutidos' }).filter({ visible: true })).toBeVisible();
    await page.getByLabel('Contraseña', { exact: true }).fill('Prueba-visual');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await page.getByLabel('Contraseña', { exact: true }).clear();
    await sinDesborde(page);
    await captura(page, `identidad-acceso-${ancho}.png`);

    await ingresar(page);
    await sinDesborde(page);
    await captura(page, `identidad-resumen-${ancho}.png`);
    const navegacion = page.getByRole('navigation', { name: ancho <= 820 ? 'Módulos' : 'Módulos del sistema', exact: true });
    for (const [nombre, boton, dialogo, archivo] of [
      ['Productos terminados', 'Nuevo producto', 'Registrar producto', 'productos'],
      ['Lotes y existencias', 'Nuevo lote', 'Registrar lote e ingreso inicial', 'lotes'],
      ['Condición de lotes', 'Gestionar condición', 'Cambiar condición del lote', 'condiciones'],
      ['Movimientos', 'Nuevo traslado', 'Registrar traslado', 'movimientos'],
    ]) {
      await navegacion.getByRole('link', { name: nombre, exact: true }).click();
      await expect(navegacion.getByRole('link', { name: nombre, exact: true })).toHaveAttribute('aria-current', 'page');
      await sinDesborde(page);
      await captura(page, `identidad-${archivo}-${ancho}.png`);
      const abrir = page.getByRole('button', { name: boton, exact: true });
      await abrir.click();
      const modal = page.getByRole('dialog', { name: dialogo, exact: true });
      await expect(modal).toBeVisible();
      const caja = await modal.boundingBox();
      expect(caja).not.toBeNull();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho + 1);
      expect(caja!.height).toBeLessThanOrEqual(900);
      await modal.getByRole('button', { name: 'Cerrar ventana' }).focus();
      await page.keyboard.press('Shift+Tab');
      expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBeTruthy();
      await page.keyboard.press('Tab');
      expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBeTruthy();
      await captura(page, `identidad-modal-${archivo}-${ancho}.png`);
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
      await expect(abrir).toBeFocused();
    }
    await navegacion.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await expect(navegacion.getByRole('link', { name: 'Pedidos', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Auditoría de pedidos' })).toBeVisible();
    await sinDesborde(page);
    await captura(page, `identidad-pedidos-${ancho}.png`);

    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await page.goto('/panel');
    await expect(page).toHaveURL(/error=sesion/);
    expect(errores).toEqual([]);
  });
}

test('teclado, contraste y movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#principal')).toBeFocused();
  await ingresar(page);
  await page.getByRole('link', { name: 'Productos terminados', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const modalProducto = page.getByRole('dialog', { name: 'Registrar producto' });
  const codigoProducto = modalProducto.getByLabel('Código', { exact: true });
  await codigoProducto.focus();
  expect(await codigoProducto.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Escape');
  const contrastes = await page.locator('.boton-primario, .sidebar .nav-item, th, td, .codigo, .badge, .eyebrow').evaluateAll((elementos) => {
    const rgb = (valor: string) => valor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminancia = (color: number[]) => color.map((n) => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    return elementos.filter((el) => el.getClientRects().length).map((el) => {
      const estilo = getComputedStyle(el);
      let fondo = estilo.backgroundColor;
      let padre = el.parentElement;
      while ((fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent') && padre) {
        fondo = getComputedStyle(padre).backgroundColor;
        padre = padre.parentElement;
      }
      const a = luminancia(rgb(estilo.color)), b = luminancia(rgb(fondo));
      return { texto: el.textContent?.trim().slice(0, 60), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const contraste of contrastes) expect(contraste.ratio, contraste.texto).toBeGreaterThanOrEqual(4.5);
  expect(await page.locator('.boton-primario').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  await captura(page, 'identidad-teclado-contraste.png');
});

test('credenciales inválidas muestran un error legible', async ({ page }) => {
  await page.goto('/acceso');
  await page.getByLabel('Identificador de acceso').fill('no-existe.qa');
  await page.getByLabel('Contraseña', { exact: true }).fill('No-es-una-cuenta-real');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('.mensaje-error')).toContainText('Verifica los datos de acceso');
  await captura(page, 'identidad-acceso-error.png');
});
