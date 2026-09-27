/**
 * Historial auditable de cambios de condicion del lote.
 * Separa la habilitacion comercial de la ubicacion fisica del producto.
 */
export class LoteCondicionHistorial1790294400000 {
  name = 'LoteCondicionHistorial1790294400000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE "lote_condicion_historial" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "operacion_clave" UUID NOT NULL,
        "lote_id" UUID NOT NULL,
        "condicion_anterior" VARCHAR(20) NOT NULL,
        "condicion_nueva" VARCHAR(20) NOT NULL,
        "usuario_id" UUID NOT NULL,
        "motivo" VARCHAR(250) NOT NULL,
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_lote_condicion_operacion_clave" UNIQUE ("operacion_clave"),
        CONSTRAINT "fk_lote_condicion_lote" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_lote_condicion_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_lote_condicion_anterior" CHECK ("condicion_anterior" IN ('LIBERADO', 'RETENIDO', 'BLOQUEADO')),
        CONSTRAINT "chk_lote_condicion_nueva" CHECK ("condicion_nueva" IN ('LIBERADO', 'RETENIDO', 'BLOQUEADO')),
        CONSTRAINT "chk_lote_condicion_cambio" CHECK ("condicion_anterior" <> "condicion_nueva")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_lote_condicion_historial_lote" ON "lote_condicion_historial" ("lote_id", "creado_en" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_lote_condicion_historial_usuario" ON "lote_condicion_historial" ("usuario_id")',
    );
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE "lote_condicion_historial"');
  }
}
