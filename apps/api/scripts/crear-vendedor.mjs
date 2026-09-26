import pg from 'pg';
import * as argon2 from 'argon2';

// Uso local: establecer VENDEDOR_NOMBRE, VENDEDOR_IDENTIFICADOR y
// VENDEDOR_PASSWORD temporalmente en la sesion de PowerShell.
// Nunca escribir contrasenas en Git.
const nombre = process.env.VENDEDOR_NOMBRE?.trim();
const identificador = process.env.VENDEDOR_IDENTIFICADOR?.trim().toLowerCase();
const contrasena = process.env.VENDEDOR_PASSWORD;
const confirmacion = process.argv.slice(2).join(' ') === '--crear-en-development';

if (!confirmacion || process.env.NODE_ENV === 'production') {
  console.error(
    'Uso: node --env-file=.env scripts/crear-vendedor.mjs --crear-en-development. Verifica que DATABASE_URL corresponde a development.',
  );
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL || !nombre || !identificador || !contrasena) {
  console.error(
    'Faltan DATABASE_URL, VENDEDOR_NOMBRE, VENDEDOR_IDENTIFICADOR o VENDEDOR_PASSWORD.',
  );
  process.exitCode = 1;
} else if (
  nombre.length > 120 ||
  !/^[a-z0-9._@-]{3,120}$/.test(identificador) ||
  contrasena.length < 12 ||
  contrasena.length > 128
) {
  console.error(
    'Nombre (max 120), identificador (3-120) o contrasena (12-128) invalidos.',
  );
  process.exitCode = 1;
} else {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    const existente = await client.query(
      'SELECT id, rol FROM usuario WHERE identificador = $1 LIMIT 1',
      [identificador],
    );

    if (existente.rowCount) {
      throw new Error('El identificador ya existe.');
    }

    const hash = await argon2.hash(contrasena, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await client.query(
      "INSERT INTO usuario (nombre, identificador, contrasena_hash, rol) VALUES ($1, $2, $3, 'VENDEDOR')",
      [nombre, identificador, hash],
    );

    await client.query('COMMIT');
    console.log('Cuenta VENDEDOR de desarrollo creada. Verifica su acceso mediante login.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(
      error?.code === '23505'
        ? 'El identificador ya existe.'
        : 'No fue posible crear el vendedor. Revisa los datos y el estado de la BD.',
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
