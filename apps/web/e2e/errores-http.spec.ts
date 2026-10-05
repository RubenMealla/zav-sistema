import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';

type Evidencia = {
  codigo: number;
  titulo: string;
  metodo: string;
  ruta: string;
  autenticacion: string;
  respuesta: unknown;
};

async function login(
  request: APIRequestContext,
  identificador: string,
  contrasena: string,
) {
  const respuesta = await request.post(`${API}/api/v1/auth/login`, {
    data: { identificador, contrasena },
  });
  expect(respuesta.status()).toBe(200);
  const body = await respuesta.json();
  return body.accessToken as string;
}

async function capturaError(page: Page, evidencia: Evidencia) {
  const destino = path.join(process.cwd(), 'test-results', 'evidencias-http');
  await mkdir(destino, { recursive: true });

  const respuesta = JSON.stringify(evidencia.respuesta, null, 2)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  await page.setContent(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Evidencia HTTP ${evidencia.codigo} · ZAV</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f4f4f4;
            color: #151515;
          }
          main {
            width: min(980px, calc(100% - 48px));
            margin: 42px auto;
            background: white;
            border: 1px solid #d7d7d7;
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 12px 32px rgba(0,0,0,.08);
          }
          header {
            padding: 28px 32px;
            background: #151515;
            color: white;
          }
          .marca { color: #ff641e; font-weight: 800; letter-spacing: .08em; }
          h1 { margin: 8px 0 0; font-size: 30px; }
          .codigo {
            display: inline-block;
            margin-top: 16px;
            padding: 8px 14px;
            border: 2px solid #ff641e;
            border-radius: 999px;
            color: #ffb18b;
            font-size: 18px;
            font-weight: 700;
          }
          section { padding: 26px 32px 32px; }
          dl {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 10px 18px;
            margin: 0 0 24px;
          }
          dt { font-weight: 700; }
          dd { margin: 0; }
          pre {
            margin: 0;
            padding: 20px;
            border-radius: 12px;
            background: #101010;
            color: #f6f6f6;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font: 15px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
          }
          footer {
            padding: 0 32px 28px;
            color: #666;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div class="marca">ZAV · QA E3</div>
            <h1>${evidencia.titulo}</h1>
            <span class="codigo">HTTP ${evidencia.codigo}</span>
          </header>
          <section>
            <dl>
              <dt>Método</dt><dd>${evidencia.metodo}</dd>
              <dt>Ruta</dt><dd>${evidencia.ruta}</dd>
              <dt>Autenticación</dt><dd>${evidencia.autenticacion}</dd>
              <dt>Resultado esperado</dt><dd>${evidencia.codigo}</dd>
              <dt>Resultado obtenido</dt><dd>${evidencia.codigo}</dd>
            </dl>
            <pre>${respuesta}</pre>
          </section>
          <footer>
            Evidencia generada automáticamente por Playwright contra la API y PostgreSQL aislados de QA.
            No contiene contraseñas, tokens ni secretos.
          </footer>
        </main>
      </body>
    </html>
  `);

  await page.screenshot({
    path: path.join(destino, `http-${evidencia.codigo}.png`),
    fullPage: true,
  });
}

test.describe('Evidencias HTTP E3', () => {
  test('genera capturas 400, 401, 403, 404, 409 y 503', async ({ page, request }) => {
    const adminId = process.env.QA_ADMIN_IDENTIFICADOR;
    const adminPassword = process.env.QA_ADMIN_PASSWORD;
    const vendedorId = process.env.QA_VENDEDOR_IDENTIFICADOR;
    const vendedorPassword = process.env.QA_VENDEDOR_PASSWORD;

    if (!adminId || !adminPassword || !vendedorId || !vendedorPassword) {
      throw new Error('Faltan credenciales sintéticas de QA.');
    }

    const [tokenAdmin, tokenVendedor] = await Promise.all([
      login(request, adminId, adminPassword),
      login(request, vendedorId, vendedorPassword),
    ]);

    const sinToken = await request.get(`${API}/api/v1/productos`);
    expect(sinToken.status()).toBe(401);
    await capturaError(page, {
      codigo: 401,
      titulo: 'Ruta protegida sin autenticación',
      metodo: 'GET',
      ruta: '/api/v1/productos',
      autenticacion: 'Sin cabecera Authorization',
      respuesta: await sinToken.json(),
    });

    const invalido = await request.post(`${API}/api/v1/clientes`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
      data: { nombre: 'Cliente QA inválido', direccion: '' },
    });
    expect(invalido.status()).toBe(400);
    await capturaError(page, {
      codigo: 400,
      titulo: 'Validación de entrada en servidor',
      metodo: 'POST',
      ruta: '/api/v1/clientes',
      autenticacion: 'Vendedor QA autenticado',
      respuesta: await invalido.json(),
    });

    const rolIncorrecto = await request.post(`${API}/api/v1/clientes`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: {
        nombre: 'Intento Administrador',
        direccion: 'Tarija',
        latitud: -21.5355,
        longitud: -64.7302,
      },
    });
    expect(rolIncorrecto.status()).toBe(403);
    await capturaError(page, {
      codigo: 403,
      titulo: 'Autorización por rol verificada en la API',
      metodo: 'POST',
      ruta: '/api/v1/clientes',
      autenticacion: 'Administrador QA en ruta exclusiva del Vendedor',
      respuesta: await rolIncorrecto.json(),
    });

    const inexistenteId = '00000000-0000-4000-8000-000000000404';
    const inexistente = await request.get(`${API}/api/v1/clientes/${inexistenteId}`, {
      headers: { Authorization: `Bearer ${tokenVendedor}` },
    });
    expect(inexistente.status()).toBe(404);
    await capturaError(page, {
      codigo: 404,
      titulo: 'Recurso inexistente',
      metodo: 'GET',
      ruta: `/api/v1/clientes/${inexistenteId}`,
      autenticacion: 'Vendedor QA autenticado',
      respuesta: await inexistente.json(),
    });

    const proveedorNoDisponible = await request.get(
      `${API}/api/v1/geografia/geocodificar?q=Tarija`,
      { headers: { Authorization: `Bearer ${tokenVendedor}` } },
    );
    expect(proveedorNoDisponible.status()).toBe(503);
    await capturaError(page, {
      codigo: 503,
      titulo: 'Servicio externo de geocodificación no disponible',
      metodo: 'GET',
      ruta: '/api/v1/geografia/geocodificar?q=Tarija',
      autenticacion: 'Vendedor QA autenticado',
      respuesta: await proveedorNoDisponible.json(),
    });

    const codigo = `QA-DUP-${randomUUID().slice(0, 8).toUpperCase()}`;
    const producto = {
      codigo,
      nombre: 'Producto para conflicto QA',
      familia: 'QA HTTP',
      presentacion: 'Unidad',
      pesoGramos: 250,
      precioBob: 20,
    };

    const creado = await request.post(`${API}/api/v1/productos`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: producto,
    });
    expect(creado.status()).toBe(201);

    const conflicto = await request.post(`${API}/api/v1/productos`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: producto,
    });
    expect(conflicto.status()).toBe(409);
    await capturaError(page, {
      codigo: 409,
      titulo: 'Conflicto de negocio por dato duplicado',
      metodo: 'POST',
      ruta: '/api/v1/productos',
      autenticacion: 'Administrador QA autenticado',
      respuesta: await conflicto.json(),
    });
  });
});
