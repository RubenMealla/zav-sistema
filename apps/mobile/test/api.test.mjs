import './soporte.mjs';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'qa';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:3001';
const api = await import('../src/lib/api.ts');
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test('una conexión bloqueada termina, libera el temporizador y no reintenta una operación', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let llamadas = 0;
  globalThis.fetch = async (_url, { signal }) => {
    llamadas++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abortado'))));
  };
  const pendiente = assert.rejects(api.retirarPedido('token-sintetico', 'pedido', 'clave'),
    error => error instanceof api.ApiError && error.status === 0 && /comprobar el resultado/.test(error.message));
  t.mock.timers.tick(60_000);
  await pendiente;
  assert.equal(llamadas, 1);
});

test('un cuerpo JSON roto se comunica como error de respuesta y no como éxito', async () => {
  globalThis.fetch = async () => new Response('{', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(api.perfil('token-sintetico'), error => error.status === 502);
  globalThis.fetch = async () => new Response('<html>Proxy</html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(api.perfil('token-sintetico'), error => error.status === 502);
});

test('pedidos activos usa una petición por página y conserva el total del servidor', async () => {
  const llamadas = [];
  globalThis.fetch = async (url) => {
    llamadas.push(new URL(url));
    return Response.json({ items: [{ id: 'pedido-pagina-2' }], page: 2, limit: 100, total: 101 });
  };
  const resultado = await api.listarPedidosActivos('token-sintetico', 2);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].searchParams.get('estado'), 'ACTIVOS');
  assert.equal(llamadas[0].searchParams.get('page'), '2');
  assert.equal(resultado.total, 101);
});

test('el directorio recupera clientes después de la primera página, incluidos inactivos', async () => {
  const paginas = [];
  globalThis.fetch = async (url) => {
    const consulta = new URL(url).searchParams;
    assert.equal(consulta.get('activo'), 'todos');
    const page = Number(consulta.get('page'));
    paginas.push(page);
    return Response.json({
      items: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({
        id: String((page - 1) * 100 + i), nombre: 'Cliente sintético', activo: page === 1,
      })), total: 101, page, limit: 100,
    });
  };
  const resultado = await api.listarDirectorioClientes('token-sintetico');
  assert.deepEqual(paginas, [1, 2]);
  assert.equal(resultado.items.length, 101);
  assert.equal(resultado.items.at(-1).activo, false);
});
