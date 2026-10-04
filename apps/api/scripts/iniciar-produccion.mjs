import { DataSource } from 'typeorm';
import { MIGRACIONES_ZAV } from './migraciones.mjs';

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
    const ejecutadas = await dataSource.runMigrations();
    console.log(`Migraciones development ejecutadas: ${ejecutadas.length}`);
    for (const migracion of ejecutadas) console.log(` - ${migracion.name}`);
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
