/**
 * E3 cierre: baja lógica de clientes y ciclo de vida auditable de pedidos.
 *
 * Cliente ya contaba con el indicador activo; esta migración no duplica ese concepto.
 * Pedido incorpora CANCELADO solo antes del retiro y conserva fecha/motivo.
 */
export class CierreClientesPedidosE31791104400000 {
  name = 'CierreClientesPedidosE31791104400000';

  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "pedido"
        DROP CONSTRAINT IF EXISTS "chk_pedido_estado",
        ADD COLUMN IF NOT EXISTS "cancelado_en" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "cancelacion_motivo" VARCHAR(300),
        ADD CONSTRAINT "chk_pedido_estado"
          CHECK ("estado" IN ('REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO', 'CANCELADO'))
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      UPDATE "pedido"
      SET "estado" = 'REGISTRADO',
          "cancelado_en" = NULL,
          "cancelacion_motivo" = NULL
      WHERE "estado" = 'CANCELADO'
    `);

    await queryRunner.query(`
      ALTER TABLE "pedido"
        DROP CONSTRAINT IF EXISTS "chk_pedido_estado",
        ADD CONSTRAINT "chk_pedido_estado"
          CHECK ("estado" IN ('REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO')),
        DROP COLUMN IF EXISTS "cancelacion_motivo",
        DROP COLUMN IF EXISTS "cancelado_en"
    `);
  }
}
