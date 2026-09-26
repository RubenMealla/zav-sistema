import * as argon2 from 'argon2';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { InicialZav1790208000000 } from '../migrations/1790208000000-inicial.mjs';

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de pruebas ${nombre}.`);
  return valor;
}

function validarBaseAislada() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Las pruebas E2E solo pueden preparar la base con NODE_ENV=test.');
  }

  const cadena = requerida('DATABASE_URL');
  const url = new URL(cadena);
  const base = url.pathname.replace(/^\//, '');

  if (!['localhost', '127.0.0.1'].includes(url.hostname) || base !== 'zav_test') {
    throw new Error(
      'DATABASE_URL debe apuntar a PostgreSQL local y a la base aislada zav_test. Se rechazo cualquier otra base.',
    );
  }

  return cadena;
}

export default async function prepararBaseE2E() {
  const cadena = validarBaseAislada();
  const adminIdentificador = requerida('QA_ADMIN_IDENTIFICADOR').toLowerCase();
  const adminPassword = requerida('QA_ADMIN_PASSWORD');
  const vendedorIdentificador = requerida('QA_VENDEDOR_IDENTIFICADOR').toLowerCase();
  const vendedorPassword = requerida('QA_VENDEDOR_PASSWORD');

  const cliente = new pg.Client({ connectionString: cadena });
  await cliente.connect();

  try {
    const actual = await cliente.query('SELECT current_database() AS nombre');
    if (actual.rows[0]?.nombre !== 'zav_test') {
      throw new Error('La base conectada no es zav_test.');
    }

    await cliente.query('DROP SCHEMA public CASCADE');
    await cliente.query('CREATE SCHEMA public');
  } finally {
    await cliente.end();
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: cadena,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migraciones',
    migrationsTransactionMode: 'all',
    migrations: [InicialZav1790208000000],
    logging: false,
  });

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }

  const [adminHash, vendedorHash] = await Promise.all([
    argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
    argon2.hash(vendedorPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
  ]);

  const semillas = new pg.Client({ connectionString: cadena });
  await semillas.connect();
  try {
    await semillas.query(
      `INSERT INTO usuario (nombre, identificador, contrasena_hash, rol)
       VALUES
         ('Administrador QA', $1, $2, 'ADMINISTRADOR'),
         ('Vendedor QA', $3, $4, 'VENDEDOR')`,
      [adminIdentificador, adminHash, vendedorIdentificador, vendedorHash],
    );
  } finally {
    await semillas.end();
  }

  console.log('QA E2E: base aislada zav_test recreada, migrada y sembrada con cuentas sinteticas.');
}
