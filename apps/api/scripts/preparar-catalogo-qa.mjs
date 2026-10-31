import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import * as argon2 from 'argon2';

// Base nueva y vacía del servicio QA; nunca altera usuarios empresariales.
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(process.env.NODE_ENV, 'development');
assert.match(url.hostname, /^ep-tiny-butterfly-b6lxt7mt(-pooler)?\.c-2\.sa-east-1\.aws\.neon\.tech$/);
assert.equal(url.pathname, '/zav_catalogo_qa');
const secretos = JSON.parse(await readFile('../../backups/catalogo-qa-secrets.json', 'utf8'));
const db = new pg.Client({ connectionString: url.href });
try {
  await db.connect();
  const { rows: [version] } = await db.query('SELECT count(*)::int AS total FROM typeorm_migraciones');
  assert.equal(version.total, 11, 'Primero debe terminar el despliegue y sus migraciones QA.');
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(440196, 74)');
  for (const [rol, identificador, password] of [
    ['ADMINISTRADOR', 'admin.catalogo@zav.test', secretos.adminPassword],
    ['VENDEDOR', 'vendedor.catalogo@zav.test', secretos.vendorPassword],
  ]) {
    assert.ok(password.length >= 24);
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await db.query(`INSERT INTO usuario(nombre,identificador,contrasena_hash,rol)
      VALUES($1,$2,$3,$4) ON CONFLICT(identificador) DO NOTHING`,
    [`QA sintético ${rol}`, identificador, hash, rol]);
    const { rows: [usuario] } = await db.query('SELECT rol,contrasena_hash FROM usuario WHERE identificador=$1', [identificador]);
    assert.equal(usuario.rol, rol);
    assert.ok(await argon2.verify(usuario.contrasena_hash, password), 'La cuenta existente utiliza otra credencial; no se sobrescribe.');
  }
  await db.query('COMMIT');
  console.log(JSON.stringify({ base: url.pathname, migraciones: version.total, cuentasSinteticas: 2 }));
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await db.end();
}
