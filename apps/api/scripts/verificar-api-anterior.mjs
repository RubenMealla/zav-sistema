// Ejecutar únicamente contra una copia local del respaldo ya migrado.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import argon2 from 'argon2';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(process.env.NODE_ENV, 'test');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.pathname, '/zav_compat_catalogo_20261028');
const apiBase = 'http://127.0.0.1:3002/api/v1/';
const db = new pg.Client({ connectionString: url.href });
const sufijo = randomUUID().slice(0, 8);
const contrasena = `QA-local-${randomUUID()}`;
async function api(ruta, datos, token, esperado = 201) {
  const respuesta = await fetch(apiBase + ruta, {
    method: datos === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  });
  assert.equal(respuesta.status, esperado, `HTTP ${ruta}: ${respuesta.status}`);
  return respuesta.json();
}
await db.connect();
try {
  assert.equal((await db.query('SELECT current_database() AS db')).rows[0].db, url.pathname.slice(1));
  const hash = await argon2.hash(contrasena);
  const usuarios = [];
  for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
    const identificador = `compat-${rol.toLowerCase()}-${sufijo}@zav.test`;
    const { rows: [usuario] } = await db.query(
      'INSERT INTO usuario(nombre,identificador,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING id',
      [`QA compatibilidad ${rol}`, identificador, hash, rol],
    );
    const sesion = await api('auth/login', { identificador, contrasena }, undefined, 200);
    usuarios.push({ id: usuario.id, token: sesion.accessToken });
  }
  const [admin, vendedor] = usuarios;
  const { rows: [producto] } = await db.query(
    `INSERT INTO producto(codigo,nombre,familia,presentacion,peso_gramos,precio_bob,validacion_comercial)
     VALUES($1,'QA compatibilidad','QA compatibilidad','Paquete QA',500,20,'LEGADO') RETURNING id`,
    [`COMPAT-${sufijo}`],
  );
  const { rows: [lote] } = await db.query(
    `INSERT INTO lote(codigo,producto_id,elaborado_el,vence_el,condicion)
     VALUES($1,$2,(now() AT TIME ZONE 'America/La_Paz')::date-1,
       (now() AT TIME ZONE 'America/La_Paz')::date+30,'LIBERADO') RETURNING id`,
    [`COMPAT-${sufijo}`, producto.id],
  );
  await db.query(`INSERT INTO movimiento(operacion_clave,lote_id,tipo,destino_id,cantidad,usuario_id)
    VALUES($1,$2,'INGRESO',(SELECT id FROM ubicacion WHERE codigo='VENTA_DESPACHO'),10,$3)`,
  [randomUUID(), lote.id, admin.id]);
  const cliente = await api('clientes', {
    nombre: `QA compatibilidad ${sufijo}`, direccion: 'Dirección sintética QA',
    telefono: '70000000', latitud: -21.535, longitud: -64.73,
  }, vendedor.token);
  const pedido = await api('pedidos', { clienteId: cliente.id, detalles: [{ productoId: producto.id, cantidad: 3 }] }, vendedor.token);
  assert.equal(pedido.estado, 'REGISTRADO');
  const retiro = { operacionClave: randomUUID() };
  for (let i = 0; i < 2; i++) {
    assert.equal((await api(`pedidos/${pedido.id}/retiro`, retiro, vendedor.token)).estado, 'EN_DISTRIBUCION');
  }
  const entrega = { operacionClave: randomUUID(), latitud: -21.535, longitud: -64.73, precisionMetros: 8 };
  for (let i = 0; i < 2; i++) {
    assert.equal((await api(`pedidos/${pedido.id}/entrega`, entrega, vendedor.token)).estado, 'ENTREGADO');
  }
  const movimientos = (await db.query('SELECT tipo,count(*)::int AS total FROM movimiento WHERE lote_id=$1 GROUP BY tipo ORDER BY tipo', [lote.id])).rows;
  assert.deepEqual(movimientos, [{ tipo: 'ENTREGA', total: 1 }, { tipo: 'INGRESO', total: 1 }, { tipo: 'RETIRO', total: 1 }]);
  const saldo = await db.query('SELECT sum(cantidad_fisica)::int AS total FROM saldo_inventario WHERE lote_id=$1', [lote.id]);
  assert.equal(saldo.rows[0].total, 7);
  const informe = {
    fecha: new Date().toISOString(), codigoAnterior: 'e9dc1a40476a72034f38e4dabb0e178c62af0066',
    base: url.pathname.slice(1), migraciones: (await db.query('SELECT count(*)::int AS total FROM typeorm_migraciones')).rows[0].total,
    datos: 'Sintéticos, exclusivamente en copia local; respaldo certificado sin modificaciones',
    pedido: ['REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO'], idempotenciaRetiroEntrega: true,
    movimientos, saldoFinal: 7, resultado: 'APROBADO',
    alcance: 'API anterior y esquema ampliado: login, cliente, pedido, retiro, entrega GPS y reintentos. No certifica un retorno con nuevas operaciones pendientes.',
  };
  await writeFile(process.env.EVIDENCIA_COMPATIBILIDAD ?? '../../backups/compatibilidad-api-anterior.json', JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe));
} finally {
  await db.end();
}
