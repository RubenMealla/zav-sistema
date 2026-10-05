import { DataSource } from 'typeorm';
import { MIGRACIONES_ZAV } from './migraciones.mjs';

const USUARIOS_DEMO_DEVELOPMENT = [
  {
    nombre: 'Administrador Demo',
    identificador: 'admin@saf.ts',
    contrasenaHash:
      '$argon2id$v=19$m=19456,t=2,p=1$z+CzHneu4M+3dD7Hor19tw$Sgesj0sYXIaug5ZzTQpexigsu5OL0CFygEJOEyit8Mo',
    rol: 'ADMINISTRADOR',
  },
  {
    nombre: 'Vendedor Demo',
    identificador: 'vendedor@saf.ts',
    contrasenaHash:
      '$argon2id$v=19$m=19456,t=2,p=1$21wNKfjHj/Sdqe4BYl9Saw$GQT8qOOMOdY5mJRZJ/YenXJxjlzBMrNlyMY9znR8JpM',
    rol: 'VENDEDOR',
  },
];

async function prepararDevelopment(dataSource) {
  const ejecutadas = await dataSource.runMigrations();
  console.log(`Migraciones development ejecutadas: ${ejecutadas.length}`);
  for (const migracion of ejecutadas) console.log(` - ${migracion.name}`);

  for (const usuario of USUARIOS_DEMO_DEVELOPMENT) {
    await dataSource.query(
      `INSERT INTO usuario (nombre, identificador, contrasena_hash, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (identificador)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         contrasena_hash = EXCLUDED.contrasena_hash,
         rol = EXCLUDED.rol,
         activo = true`,
      [usuario.nombre, usuario.identificador, usuario.contrasenaHash, usuario.rol],
    );
  }
  console.log('Usuarios demo development actualizados: admin@saf.ts y vendedor@saf.ts');
}

async function migrarDevelopment() {
  if (process.env.ZAV_ENTORNO !== 'development') return;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada para el backend development.');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migraciones',
    migrationsTransactionMode: 'all',
    migrations: MIGRACIONES_ZAV,
    logging: false,
  });

  await dataSource.initialize();
  try {
    await prepararDevelopment(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

try {
  await migrarDevelopment();
  await import('../dist/main.js');
} catch (error) {
  console.error('No fue posible iniciar la API.');
  console.error('Codigo:', error?.code ?? 'SIN_CODIGO');
  console.error(
    'Detalle:',
    error?.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[URL_OCULTA]') ?? 'No disponible',
  );
  process.exitCode = 1;
}
