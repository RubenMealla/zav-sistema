
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL no esta configurada.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();

  const result = await client.query(`
    SELECT
      current_database() AS base_datos,
      current_user AS usuario,
      current_setting('server_version') AS version_postgresql,
      current_timestamp AS fecha_servidor
  `);

  const datos = result.rows[0];

  console.log('Conexion PostgreSQL correcta.');
  console.log('Base de datos:', datos.base_datos);
  console.log('Usuario:', datos.usuario);
  console.log('Version PostgreSQL:', datos.version_postgresql);
  console.log('Fecha del servidor:', datos.fecha_servidor);
} catch (error) {
  console.error('No se pudo verificar la conexion PostgreSQL.');
  console.error('Codigo de error:', error.code ?? 'NO_DISPONIBLE');

  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}