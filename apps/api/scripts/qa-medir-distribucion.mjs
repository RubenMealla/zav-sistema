import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/zav_test') {
  throw new Error('La medición requiere NODE_ENV=test y PostgreSQL local zav_test.');
}
const salida = process.argv[2];
if (!salida) throw new Error('Indica el archivo JSON de resultados.');
const { AppModule } = await import('../dist/app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(0, '127.0.0.1');
const base = await app.getUrl();
const db = app.get(DataSource);
let consultas = 0;
const loggerOriginal = db.logger;
db.logger = { ...loggerOriginal, logQuery() { consultas++; }, logQueryError() {}, logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {} };
async function post(ruta, datos, token) {
  const respuesta = await fetch(base + '/api/v1/' + ruta, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(`${ruta}: HTTP ${respuesta.status}`);
  return cuerpo;
}
const muestras = { planificacion: [], retiro: [], entrega: [] };
try {
  const sesion = await post('auth/login', {
    identificador: process.env.QA_VENDEDOR_IDENTIFICADOR,
    contrasena: process.env.QA_VENDEDOR_PASSWORD,
  });
  const [version] = await db.query('SHOW server_version');
  // Un producto, diez lotes y dos pedidos por muestra: fuerza diez movimientos al entregar.
  for (let i = 0; i < 26; i++) {
    const codigo = 'MED-' + randomUUID().slice(0, 8);
    const [producto] = await db.query(`INSERT INTO producto (codigo,nombre,familia,presentacion,peso_gramos,precio_bob)
      VALUES ($1,'Producto sintético','QA','Unidad',100,10) RETURNING id`, [codigo]);
    const [cliente] = await db.query(`INSERT INTO cliente (nombre,direccion,latitud,longitud)
      VALUES ('Cliente sintético','Dirección QA',-21.5355,-64.7302) RETURNING id`);
    const lotes = await db.query(`INSERT INTO lote (codigo,producto_id,elaborado_el,vence_el,condicion)
      SELECT $1 || '-' || n,$2::uuid,CURRENT_DATE,CURRENT_DATE+30,'LIBERADO' FROM generate_series(1,10) n RETURNING id`, [codigo, producto.id]);
    await db.query(`INSERT INTO movimiento (operacion_clave,lote_id,tipo,destino_id,cantidad,usuario_id)
      SELECT gen_random_uuid(),l.id,'INGRESO',u.id,2,$2::uuid FROM lote l CROSS JOIN ubicacion u
      WHERE l.id=ANY($1::uuid[]) AND u.codigo='VENTA_DESPACHO'`, [lotes.map(l => l.id), sesion.usuario.id]);
    const datos = { clienteId: cliente.id, detalles: [{ productoId: producto.id, cantidad: 19 }] };
    const pedido = await post('pedidos', datos, sesion.accessToken);
    const otro = await post('pedidos', { ...datos, detalles: [{ productoId: producto.id, cantidad: 1 }] }, sesion.accessToken);
    const operaciones = [
      ['planificacion', 'pedidos/planificacion', { pedidoIds: [pedido.id, otro.id], origenTipo: 'ACTUAL', origenLatitud: -21.5355, origenLongitud: -64.7302 }],
      ['retiro', `pedidos/${pedido.id}/retiro`, { operacionClave: randomUUID() }],
      ['entrega', `pedidos/${pedido.id}/entrega`, { operacionClave: randomUUID(), latitud: -21.5355, longitud: -64.7302, precisionMetros: 5 }],
    ];
    for (const [nombre, ruta, entrada] of operaciones) {
      consultas = 0;
      const inicio = performance.now();
      await post(ruta, entrada, sesion.accessToken);
      const ms = Number((performance.now() - inicio).toFixed(3));
      if (i > 0) muestras[nombre].push({ ms, consultas });
    }
  }
  const resumen = Object.fromEntries(Object.entries(muestras).map(([nombre, valores]) => {
    const tiempos = valores.map(v => v.ms).sort((a, b) => a - b);
    return [nombre, { medianaMs: tiempos[12], p95Ms: tiempos[23], consultas: [...new Set(valores.map(v => v.consultas))] }];
  }));
  const resultado = { fechaUtc: new Date().toISOString(), postgres: version.server_version,
    entorno: 'NestJS HTTP y PostgreSQL local aislado; 25 muestras secuenciales, un calentamiento excluido; 10 lotes/pedido',
    resumen, muestras, limitacion: 'No mide Neon, GPS ni tiempos de pantalla. La base debe reiniciarse con global-setup-e2e.mjs entre comparaciones.' };
  writeFileSync(salida, JSON.stringify(resultado, null, 2) + '\n');
  console.log(JSON.stringify(resumen));
} finally {
  db.logger = loggerOriginal;
  await app.close();
}
