/**
 * Sustituye la tabla de saldos mutables por una proyeccion derivada de movimientos.
 * Antes de borrar la tabla valida que el historial reconstruya exactamente el saldo
 * y que no existan cantidades comprometidas (los pedidos aun no forman parte de E2).
 */
export class SaldosDerivados1790380800000 {
  name = 'SaldosDerivados1790380800000';

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
          RAISE EXCEPTION 'No se puede migrar: existencia no coincide con movimientos o hay cantidades comprometidas.';
        END IF;
      END $$;
    `);

    await queryRunner.query('DROP TABLE "existencia"');

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

    await queryRunner.query(`
      CREATE TABLE "existencia" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "lote_id" UUID NOT NULL,
        "ubicacion_id" UUID NOT NULL,
        "cantidad_fisica" INTEGER NOT NULL,
        "cantidad_comprometida" INTEGER NOT NULL DEFAULT 0,
        "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_existencia_lote_ubicacion" UNIQUE ("lote_id", "ubicacion_id"),
        CONSTRAINT "fk_existencia_lote" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_existencia_ubicacion" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_existencia_cantidad_fisica" CHECK ("cantidad_fisica" >= 0),
        CONSTRAINT "chk_existencia_cantidad_comprometida" CHECK ("cantidad_comprometida" >= 0 AND "cantidad_comprometida" <= "cantidad_fisica")
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_existencia_ubicacion_id" ON "existencia" ("ubicacion_id")');

    await queryRunner.query(`
      WITH cambios AS (
        SELECT lote_id, destino_id AS ubicacion_id, cantidad::integer AS delta
        FROM movimiento
        WHERE destino_id IS NOT NULL
        UNION ALL
        SELECT lote_id, origen_id AS ubicacion_id, -cantidad::integer AS delta
        FROM movimiento
        WHERE origen_id IS NOT NULL
      )
      INSERT INTO existencia (lote_id, ubicacion_id, cantidad_fisica, cantidad_comprometida)
      SELECT lote_id, ubicacion_id, SUM(delta)::integer, 0
      FROM cambios
      GROUP BY lote_id, ubicacion_id
      HAVING SUM(delta) > 0
    `);
  }
}
