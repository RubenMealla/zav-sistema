/**
 * Etapa 1 de la migracion de inventario.
 *
 * Valida que Existencia y Movimiento representen el mismo saldo y crea la
 * proyeccion saldo_inventario sin eliminar aun la tabla anterior. Esto permite
 * desplegar el codigo nuevo sin una ventana donde API y esquema sean incompatibles.
 */
export class SaldoInventarioVista1790380800000 {
  name = 'SaldoInventarioVista1790380800000';

  async up(queryRunner) {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          WITH cambios AS (
            SELECT lote_id, destino_id AS ubicacion_id, cantidad::integer AS delta
            FROM movimiento
            WHERE destino_id IS NOT NULL
            UNION ALL
            SELECT lote_id, origen_id AS ubicacion_id, -cantidad::integer AS delta
            FROM movimiento
            WHERE origen_id IS NOT NULL
          ),
          calculado AS (
            SELECT lote_id, ubicacion_id, SUM(delta)::integer AS cantidad_fisica
            FROM cambios
            GROUP BY lote_id, ubicacion_id
          )
          SELECT 1
          FROM existencia e
          FULL JOIN calculado c
            ON c.lote_id = e.lote_id AND c.ubicacion_id = e.ubicacion_id
          WHERE COALESCE(e.cantidad_fisica, 0) <> COALESCE(c.cantidad_fisica, 0)
             OR COALESCE(e.cantidad_comprometida, 0) <> 0
        ) THEN
          RAISE EXCEPTION 'No se puede preparar saldo_inventario: existencia no coincide con movimientos o hay cantidades comprometidas.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE VIEW "saldo_inventario" AS
      WITH cambios AS (
        SELECT lote_id, destino_id AS ubicacion_id, cantidad::integer AS delta
        FROM movimiento
        WHERE destino_id IS NOT NULL
        UNION ALL
        SELECT lote_id, origen_id AS ubicacion_id, -cantidad::integer AS delta
        FROM movimiento
        WHERE origen_id IS NOT NULL
      )
      SELECT
        lote_id,
        ubicacion_id,
        SUM(delta)::integer AS cantidad_fisica,
        0::integer AS cantidad_comprometida
      FROM cambios
      GROUP BY lote_id, ubicacion_id
      HAVING SUM(delta) <> 0
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP VIEW "saldo_inventario"');
  }
}
