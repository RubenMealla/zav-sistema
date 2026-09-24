/**
 * Primera migracion de ZAV: seis tablas de inventario y ubicaciones iniciales.
 * La clase incluye una marca temporal de 13 digitos, como exige TypeORM.
 * Se ejecuta mediante scripts/migrar.mjs; no utilizar synchronize: true.
 */
export class InicialZav1790208000000 {
  name = 'InicialZav1790208000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE "usuario" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" VARCHAR(120) NOT NULL,
        "identificador" VARCHAR(120) NOT NULL,
        "contrasena_hash" VARCHAR(255) NOT NULL,
        "rol" VARCHAR(20) NOT NULL,
        "activo" BOOLEAN NOT NULL DEFAULT TRUE,
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_usuario_identificador" UNIQUE ("identificador"),
        CONSTRAINT "chk_usuario_rol" CHECK ("rol" IN ('ADMINISTRADOR', 'VENDEDOR')),
        CONSTRAINT "chk_usuario_identificador_minusculas" CHECK ("identificador" = lower("identificador"))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "producto" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" VARCHAR(40) NOT NULL,
        "nombre" VARCHAR(120) NOT NULL,
        "familia" VARCHAR(70) NOT NULL,
        "presentacion" VARCHAR(100) NOT NULL,
        "peso_gramos" INTEGER NOT NULL,
        "precio_bob" NUMERIC(12,2) NOT NULL,
        "activo" BOOLEAN NOT NULL DEFAULT TRUE,
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_producto_codigo" UNIQUE ("codigo"),
        CONSTRAINT "chk_producto_peso_gramos" CHECK ("peso_gramos" > 0),
        CONSTRAINT "chk_producto_precio_bob" CHECK ("precio_bob" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lote" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" VARCHAR(60) NOT NULL,
        "producto_id" UUID NOT NULL,
        "elaborado_el" DATE NOT NULL,
        "vence_el" DATE NOT NULL,
        "condicion" VARCHAR(20) NOT NULL DEFAULT 'RETENIDO',
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_lote_codigo" UNIQUE ("codigo"),
        CONSTRAINT "fk_lote_producto" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_lote_fechas" CHECK ("vence_el" > "elaborado_el"),
        CONSTRAINT "chk_lote_condicion" CHECK ("condicion" IN ('LIBERADO', 'RETENIDO', 'BLOQUEADO'))
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_lote_producto_id" ON "lote" ("producto_id")');

    await queryRunner.query(`
      CREATE TABLE "ubicacion" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codigo" VARCHAR(40) NOT NULL,
        "nombre" VARCHAR(100) NOT NULL,
        "clase" VARCHAR(20) NOT NULL,
        "permite_venta" BOOLEAN NOT NULL,
        "activa" BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT "uq_ubicacion_codigo" UNIQUE ("codigo"),
        CONSTRAINT "chk_ubicacion_clase" CHECK ("clase" IN ('AREA_FISICA', 'CUSTODIA_LOGICA'))
      )
    `);

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
      CREATE TABLE "movimiento" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "operacion_clave" UUID NOT NULL,
        "lote_id" UUID NOT NULL,
        "tipo" VARCHAR(30) NOT NULL,
        "origen_id" UUID,
        "destino_id" UUID,
        "cantidad" INTEGER NOT NULL,
        "usuario_id" UUID NOT NULL,
        "referencia" VARCHAR(80),
        "motivo" VARCHAR(250),
        "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_movimiento_operacion_clave" UNIQUE ("operacion_clave"),
        CONSTRAINT "fk_movimiento_lote" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_movimiento_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_movimiento_origen" FOREIGN KEY ("origen_id") REFERENCES "ubicacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_movimiento_destino" FOREIGN KEY ("destino_id") REFERENCES "ubicacion"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_movimiento_cantidad" CHECK ("cantidad" > 0),
        CONSTRAINT "chk_movimiento_ingreso" CHECK ("tipo" <> 'INGRESO' OR ("origen_id" IS NULL AND "destino_id" IS NOT NULL))
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_movimiento_lote_id" ON "movimiento" ("lote_id")');
    await queryRunner.query('CREATE INDEX "idx_movimiento_usuario_id" ON "movimiento" ("usuario_id")');

    // Valores de configuracion del sistema, no datos de operaciones de la empresa.
    await queryRunner.query(`
      INSERT INTO "ubicacion" ("codigo", "nombre", "clase", "permite_venta") VALUES
        ('PRODUCCION_ALMACENAMIENTO', 'Produccion y Almacenamiento', 'AREA_FISICA', FALSE),
        ('VENTA_DESPACHO', 'Venta y Despacho', 'AREA_FISICA', TRUE),
        ('EN_DISTRIBUCION', 'En distribucion', 'CUSTODIA_LOGICA', FALSE),
        ('RETENIDO', 'Retenido', 'CUSTODIA_LOGICA', FALSE)
    `);
  }

  async down(queryRunner) {
    // SOLO para un entorno de desarrollo descartable. Borra los datos de estas tablas.
    await queryRunner.query('DROP TABLE "movimiento"');
    await queryRunner.query('DROP TABLE "existencia"');
    await queryRunner.query('DROP TABLE "ubicacion"');
    await queryRunner.query('DROP TABLE "lote"');
    await queryRunner.query('DROP TABLE "producto"');
    await queryRunner.query('DROP TABLE "usuario"');
  }
}
