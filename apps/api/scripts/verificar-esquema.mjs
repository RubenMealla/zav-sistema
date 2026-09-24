import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no esta configurada.');
  process.exitCode = 1;
} else {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const requeridas = ['usuario', 'producto', 'lote', 'ubicacion', 'existencia', 'movimiento'];
    const tablas = await client.query(`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = current_schema() AND tablename = ANY($1)
    `, [requeridas]);
    const encontradas = new Set(tablas.rows.map((fila) => fila.tablename));
    const faltantes = requeridas.filter((nombre) => !encontradas.has(nombre));
    if (faltantes.length) throw new Error(`Faltan tablas: ${faltantes.join(', ')}`);

    const fks = await client.query(`
      SELECT count(*)::integer AS total
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = current_schema() AND c.contype = 'f'
        AND c.conrelid IN ('lote'::regclass, 'existencia'::regclass, 'movimiento'::regclass)
    `);
    if (fks.rows[0].total !== 7) throw new Error(`Claves foraneas: esperadas 7, encontradas ${fks.rows[0].total}`);

    const ubicaciones = await client.query(`SELECT codigo FROM ubicacion ORDER BY codigo`);
    const codigos = new Set(ubicaciones.rows.map((fila) => fila.codigo));
    for (const codigo of ['PRODUCCION_ALMACENAMIENTO', 'VENTA_DESPACHO', 'EN_DISTRIBUCION', 'RETENIDO']) {
      if (!codigos.has(codigo)) throw new Error(`Falta ubicacion inicial: ${codigo}`);
    }
    const migraciones = await client.query('SELECT name FROM "typeorm_migraciones" ORDER BY "timestamp"');
    if (!migraciones.rows.some((fila) => fila.name === 'InicialZav1790208000000')) {
      throw new Error('No se encontro el registro de la migracion inicial.');
    }
    console.log('Esquema comprobado: 6 tablas, 7 claves foraneas, 4 ubicaciones iniciales y migracion registrada.');
    console.log('Esta prueba no verifica todavia ingresos de lotes ni transacciones de inventario.');
  } catch (error) {
    console.error('No se pudo verificar el esquema:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
