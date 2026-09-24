import { DataSource } from 'typeorm';
import { InicialZav1790208000000 } from '../migrations/1790208000000-inicial.mjs';

// Proteccion adicional: no es posible identificar la rama de Neon con SELECT.
// Comprobar en el panel Connect que DATABASE_URL pertenece a development.
if (process.argv.slice(2).join(' ') !== '--aplicar-development') {
  console.error('Uso: node --env-file=.env scripts/migrar.mjs --aplicar-development');
  console.error('Antes de continuar, comprueba en Neon que DATABASE_URL corresponde a development.');
  process.exitCode = 1;
} else if (process.env.NODE_ENV === 'production') {
  console.error('No se ejecutan migraciones de desarrollo con NODE_ENV=production.');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no esta configurada.');
  process.exitCode = 1;
} else {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migraciones',
    migrationsTransactionMode: 'all',
    migrations: [InicialZav1790208000000],
    logging: false,
  });

  try {
    await dataSource.initialize();
    const ejecutadas = await dataSource.runMigrations();
    console.log('Migraciones ejecutadas:', ejecutadas.length);
    for (const migracion of ejecutadas) console.log(' -', migracion.name);
    if (ejecutadas.length === 0) console.log('No hay migraciones pendientes.');
  } catch (error) {
    console.error('No se pudo ejecutar la migracion.');
    console.error('Codigo:', error?.code ?? 'SIN_CODIGO');
    console.error('Detalle:', error?.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[URL_OCULTA]') ?? 'No disponible');
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
