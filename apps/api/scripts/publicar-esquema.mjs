// Publicación controlada: mismo ejecutor en restauración local, ensayo remoto y producción.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DataSource, MigrationExecutor } from 'typeorm';
import { MIGRACIONES_ZAV } from './migraciones.mjs';

const modo = process.argv[2];
assert.ok(['--ensayo', '--production'].includes(modo), 'Indicar --ensayo o --production');
const url = new URL(process.env.DATABASE_URL ?? '');
const local = url.hostname === '127.0.0.1' && url.port === '55433' && url.pathname === '/zav_restore_publicacion_20261104';
const ensayo = url.hostname === 'ep-tiny-butterfly-b6lxt7mt.c-2.sa-east-1.aws.neon.tech' && url.pathname === '/zav_release_20261104';
const produccion = url.hostname === 'ep-delicate-pond-b6jga3az.c-2.sa-east-1.aws.neon.tech' && url.pathname === '/neondb';
assert.ok(modo === '--production' ? produccion : local || ensayo, 'Destino no autorizado para este modo');
if (!local) assert.equal(url.searchParams.get('sslmode'), 'verify-full', 'Requerir TLS verificable y conexión directa');
const evidencia = resolve(process.env.RELEASE_EVIDENCE ?? '');
assert.ok(process.env.RELEASE_EVIDENCE && !existsSync(evidencia), 'Exigir evidencia nueva; nunca sobrescribir intentos');
const respaldoRuta = resolve(process.env.BACKUP_VERIFICATION ?? '');
const respaldo = JSON.parse(readFileSync(respaldoRuta, 'utf8'));
assert.ok(respaldo.fuenteEstable && respaldo.coincide, 'Respaldo sin restauración verificada');
const dump = join(dirname(respaldoRuta), 'production-previa.dump');
assert.equal(createHash('sha256').update(readFileSync(dump)).digest('hex'), respaldo.sha256, 'El dump no corresponde al respaldo verificado');
const tablas = Object.keys(respaldo.tablas).sort();
assert.ok(tablas.every(t => /^[a-z_]+$/.test(t)));
const quote = s => '"' + s.replaceAll('"', '""') + '"';
const db = new DataSource({type:'postgres',url:url.href,synchronize:false,migrationsRun:false,migrations:MIGRACIONES_ZAV,migrationsTableName:'typeorm_migraciones',migrationsTransactionMode:'all',logging:false});
let runner;
const informe = {fecha:new Date().toISOString(),modo,host:url.hostname,base:url.pathname,backupSha256:respaldo.sha256,estado:'NO_APLICADO'};
try {
  await db.initialize();
  runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query("SET LOCAL TIME ZONE 'UTC'; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='120s'");
  // Bloqueo breve: las escrituras concurrentes esperan; validación y DDL comparten transacción.
  await runner.query(`LOCK TABLE ${tablas.map(quote).join(',')} IN ACCESS EXCLUSIVE MODE`);
  const historial = {};
  for (const tabla of tablas) {
    const [huella] = await runner.query(`SELECT count(*)::int AS filas,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS huella FROM ${quote(tabla)} t`);
    assert.deepEqual(huella, respaldo.tablas[tabla], `La fuente cambió después del respaldo: ${tabla}`);
    if (tabla === 'typeorm_migraciones') continue;
    const columnas = await runner.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['public',tabla]);
    const ids = await runner.query(`SELECT id::text AS id FROM ${quote(tabla)}`);
    historial[tabla] = {columnas:columnas.map(c=>c.column_name),ids:ids.map(r=>r.id),huella};
  }
  const actuales = await runner.query('SELECT name FROM typeorm_migraciones ORDER BY timestamp');
  assert.deepEqual(actuales.map(m=>m.name), MIGRACIONES_ZAV.slice(0,7).map(M=>new M().name), 'La publicación requiere exactamente las siete migraciones anteriores');
  const executor = new MigrationExecutor(db,runner);
  executor.transaction = 'all';
  const ejecutadas = await executor.executePendingMigrations();
  assert.equal(ejecutadas.length,4);
  for (const [tabla,h] of Object.entries(historial)) {
    const [despues] = await runner.query(`SELECT count(*)::int AS filas,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS huella FROM (SELECT ${h.columnas.map(quote).join(',')} FROM ${quote(tabla)} WHERE id::text=ANY($1::text[])) t`,[h.ids]);
    assert.deepEqual(despues,h.huella,`La migración alteró datos históricos: ${tabla}`);
  }
  const [integridad] = await runner.query(`SELECT
    (SELECT count(*)::int FROM saldo_inventario WHERE cantidad_fisica<0) AS saldos_negativos,
    (SELECT count(*)::int FROM saldo_custodia WHERE cantidad<0 OR (vendedor_id IS NULL AND cantidad<>0)) AS custodias_invalidas,
    (SELECT count(*)::int FROM producto WHERE producto_comercial_id IS NULL) AS sku_sin_relacion,
    (SELECT count(*)::int FROM familia WHERE publicado) AS familias_publicadas,
    (SELECT count(*)::int FROM producto_comercial WHERE publicado) AS productos_publicados,
    (SELECT count(*)::int FROM typeorm_migraciones) AS migraciones`);
  assert.equal(integridad.saldos_negativos,0);
  assert.equal(integridad.custodias_invalidas,0);
  assert.equal(integridad.sku_sin_relacion,0);
  assert.equal(integridad.familias_publicadas,7);
  assert.equal(integridad.productos_publicados,13);
  assert.equal(integridad.migraciones,11);
  informe.ejecutadas = ejecutadas.map(m=>m.name);
  informe.integridad = integridad;
  informe.historialPreservado = true;
  await runner.commitTransaction();
  informe.estado = 'APLICADO';
} catch(error) {
  if(runner?.isTransactionActive) await runner.rollbackTransaction();
  informe.error = {codigo:error.code??'VALIDACION',mensaje:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[CONEXION]')};
  process.exitCode=1;
} finally {
  if(runner) await runner.release();
  if(db.isInitialized) await db.destroy();
  writeFileSync(evidencia,JSON.stringify(informe,null,2)+'\n');
  console.log(JSON.stringify(informe));
}
