/**
 * E3: incorpora Cliente, Pedido y DetallePedido y cierra la semantica de Movimiento.
 *
 * La disponibilidad comercial no se persiste: se calcula a partir del saldo fisico
 * derivado de Movimiento menos los detalles de pedidos en estado REGISTRADO.
 */
export class PedidosDistribucion1790470800000 {
  name = 'PedidosDistribucion1790470800000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE "cliente" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" VARCHAR(140) NOT NULL,
        "telefono" VARCHAR(30),
        "direccion" VARCHAR(240) NOT NULL,
        "activo" BOOLEAN NOT NULL DEFAULT TRUE,
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "chk_cliente_nombre" CHECK (length(trim("nombre")) > 0),
        CONSTRAINT "chk_cliente_direccion" CHECK (length(trim("direccion")) > 0)
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_cliente_nombre" ON "cliente" ("nombre")');

    await queryRunner.query(`
      CREATE TABLE "pedido" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "cliente_id" UUID NOT NULL,
        "vendedor_id" UUID NOT NULL,
        "estado" VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO',
        "direccion_entrega" VARCHAR(240) NOT NULL,
        "observacion" VARCHAR(300),
        "retiro_operacion_clave" UUID,
        "retirado_en" TIMESTAMPTZ,
        "entrega_operacion_clave" UUID,
        "entregado_en" TIMESTAMPTZ,
        "entrega_latitud" NUMERIC(9,6),
        "entrega_longitud" NUMERIC(9,6),
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pedido_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_pedido_vendedor" FOREIGN KEY ("vendedor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_pedido_estado" CHECK ("estado" IN ('REGISTRADO', 'EN_DISTRIBUCION', 'ENTREGADO')),
        CONSTRAINT "chk_pedido_direccion" CHECK (length(trim("direccion_entrega")) > 0),
        CONSTRAINT "chk_pedido_latitud" CHECK ("entrega_latitud" IS NULL OR ("entrega_latitud" >= -90 AND "entrega_latitud" <= 90)),
        CONSTRAINT "chk_pedido_longitud" CHECK ("entrega_longitud" IS NULL OR ("entrega_longitud" >= -180 AND "entrega_longitud" <= 180)),
        CONSTRAINT "uq_pedido_retiro_operacion" UNIQUE ("retiro_operacion_clave"),
        CONSTRAINT "uq_pedido_entrega_operacion" UNIQUE ("entrega_operacion_clave")
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_pedido_cliente_id" ON "pedido" ("cliente_id")');
    await queryRunner.query('CREATE INDEX "idx_pedido_vendedor_estado" ON "pedido" ("vendedor_id", "estado")');
    await queryRunner.query('CREATE INDEX "idx_pedido_creado_en" ON "pedido" ("creado_en" DESC)');

    await queryRunner.query(`
      CREATE TABLE "detalle_pedido" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pedido_id" UUID NOT NULL,
        "producto_id" UUID NOT NULL,
        "cantidad" INTEGER NOT NULL,
        "precio_unitario_bob" NUMERIC(12,2) NOT NULL,
        CONSTRAINT "fk_detalle_pedido_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_detalle_pedido_producto" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_detalle_pedido_producto" UNIQUE ("pedido_id", "producto_id"),
        CONSTRAINT "chk_detalle_pedido_cantidad" CHECK ("cantidad" > 0),
        CONSTRAINT "chk_detalle_pedido_precio" CHECK ("precio_unitario_bob" >= 0)
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_detalle_pedido_producto_id" ON "detalle_pedido" ("producto_id")');

    await queryRunner.query('ALTER TABLE "movimiento" DROP CONSTRAINT IF EXISTS "chk_movimiento_ingreso"');
    await queryRunner.query(`
      ALTER TABLE "movimiento"
      ADD CONSTRAINT "chk_movimiento_tipo"
      CHECK ("tipo" IN ('INGRESO', 'TRASLADO', 'RETIRO', 'ENTREGA'))
    `);
    await queryRunner.query(`
      ALTER TABLE "movimiento"
      ADD CONSTRAINT "chk_movimiento_estructura"
      CHECK (
        ("tipo" = 'INGRESO' AND "origen_id" IS NULL AND "destino_id" IS NOT NULL)
        OR
        ("tipo" IN ('TRASLADO', 'RETIRO') AND "origen_id" IS NOT NULL AND "destino_id" IS NOT NULL AND "origen_id" <> "destino_id")
        OR
        ("tipo" = 'ENTREGA' AND "origen_id" IS NOT NULL AND "destino_id" IS NULL)
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_movimiento_tipo_referencia" ON "movimiento" ("tipo", "referencia")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_movimiento_tipo_referencia"');
    await queryRunner.query('ALTER TABLE "movimiento" DROP CONSTRAINT IF EXISTS "chk_movimiento_estructura"');
    await queryRunner.query('ALTER TABLE "movimiento" DROP CONSTRAINT IF EXISTS "chk_movimiento_tipo"');
    await queryRunner.query(`
      ALTER TABLE "movimiento"
      ADD CONSTRAINT "chk_movimiento_ingreso"
      CHECK ("tipo" <> 'INGRESO' OR ("origen_id" IS NULL AND "destino_id" IS NOT NULL))
    `);
    await queryRunner.query('DROP TABLE "detalle_pedido"');
    await queryRunner.query('DROP TABLE "pedido"');
    await queryRunner.query('DROP TABLE "cliente"');
  }
}
