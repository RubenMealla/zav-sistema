/**
 * E3: extensión geográfica para Cliente, despacho, planificación y comprobación de entrega.
 *
 * No crea nuevas entidades principales. Añade coordenadas opcionales y conserva
 * la captura real de entrega separada del destino esperado.
 */
export class GeolocalizacionDistribucion1790557200000 {
  name = 'GeolocalizacionDistribucion1790557200000';

  async up(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "cliente"
        ADD COLUMN "latitud" NUMERIC(9,6),
        ADD COLUMN "longitud" NUMERIC(9,6),
        ADD COLUMN "ubicacion_confirmada_en" TIMESTAMPTZ,
        ADD CONSTRAINT "chk_cliente_latitud"
          CHECK ("latitud" IS NULL OR ("latitud" >= -90 AND "latitud" <= 90)),
        ADD CONSTRAINT "chk_cliente_longitud"
          CHECK ("longitud" IS NULL OR ("longitud" >= -180 AND "longitud" <= 180)),
        ADD CONSTRAINT "chk_cliente_coordenadas_pareja"
          CHECK (("latitud" IS NULL) = ("longitud" IS NULL))
    `);

    await queryRunner.query(`
      ALTER TABLE "ubicacion"
        ADD COLUMN "latitud" NUMERIC(9,6),
        ADD COLUMN "longitud" NUMERIC(9,6),
        ADD CONSTRAINT "chk_ubicacion_latitud_geo"
          CHECK ("latitud" IS NULL OR ("latitud" >= -90 AND "latitud" <= 90)),
        ADD CONSTRAINT "chk_ubicacion_longitud_geo"
          CHECK ("longitud" IS NULL OR ("longitud" >= -180 AND "longitud" <= 180)),
        ADD CONSTRAINT "chk_ubicacion_coordenadas_pareja"
          CHECK (("latitud" IS NULL) = ("longitud" IS NULL)),
        ADD CONSTRAINT "chk_ubicacion_geo_area_fisica"
          CHECK ("latitud" IS NULL OR "clase" = 'AREA_FISICA')
    `);

    await queryRunner.query(`
      ALTER TABLE "pedido"
        ADD COLUMN "destino_latitud" NUMERIC(9,6),
        ADD COLUMN "destino_longitud" NUMERIC(9,6),
        ADD COLUMN "entrega_precision_m" NUMERIC(10,2),
        ADD COLUMN "entrega_distancia_destino_m" NUMERIC(12,2),
        ADD COLUMN "entrega_observacion" VARCHAR(300),
        ADD CONSTRAINT "chk_pedido_destino_latitud"
          CHECK ("destino_latitud" IS NULL OR ("destino_latitud" >= -90 AND "destino_latitud" <= 90)),
        ADD CONSTRAINT "chk_pedido_destino_longitud"
          CHECK ("destino_longitud" IS NULL OR ("destino_longitud" >= -180 AND "destino_longitud" <= 180)),
        ADD CONSTRAINT "chk_pedido_destino_pareja"
          CHECK (("destino_latitud" IS NULL) = ("destino_longitud" IS NULL)),
        ADD CONSTRAINT "chk_pedido_entrega_precision"
          CHECK ("entrega_precision_m" IS NULL OR "entrega_precision_m" >= 0),
        ADD CONSTRAINT "chk_pedido_entrega_distancia"
          CHECK ("entrega_distancia_destino_m" IS NULL OR "entrega_distancia_destino_m" >= 0)
    `);

    await queryRunner.query(`
      UPDATE "pedido" pe
      SET "destino_latitud" = c."latitud",
          "destino_longitud" = c."longitud"
      FROM "cliente" c
      WHERE c."id" = pe."cliente_id"
        AND c."latitud" IS NOT NULL
        AND c."longitud" IS NOT NULL
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      ALTER TABLE "pedido"
        DROP CONSTRAINT IF EXISTS "chk_pedido_entrega_distancia",
        DROP CONSTRAINT IF EXISTS "chk_pedido_entrega_precision",
        DROP CONSTRAINT IF EXISTS "chk_pedido_destino_pareja",
        DROP CONSTRAINT IF EXISTS "chk_pedido_destino_longitud",
        DROP CONSTRAINT IF EXISTS "chk_pedido_destino_latitud",
        DROP COLUMN IF EXISTS "entrega_observacion",
        DROP COLUMN IF EXISTS "entrega_distancia_destino_m",
        DROP COLUMN IF EXISTS "entrega_precision_m",
        DROP COLUMN IF EXISTS "destino_longitud",
        DROP COLUMN IF EXISTS "destino_latitud"
    `);

    await queryRunner.query(`
      ALTER TABLE "ubicacion"
        DROP CONSTRAINT IF EXISTS "chk_ubicacion_geo_area_fisica",
        DROP CONSTRAINT IF EXISTS "chk_ubicacion_coordenadas_pareja",
        DROP CONSTRAINT IF EXISTS "chk_ubicacion_longitud_geo",
        DROP CONSTRAINT IF EXISTS "chk_ubicacion_latitud_geo",
        DROP COLUMN IF EXISTS "longitud",
        DROP COLUMN IF EXISTS "latitud"
    `);

    await queryRunner.query(`
      ALTER TABLE "cliente"
        DROP CONSTRAINT IF EXISTS "chk_cliente_coordenadas_pareja",
        DROP CONSTRAINT IF EXISTS "chk_cliente_longitud",
        DROP CONSTRAINT IF EXISTS "chk_cliente_latitud",
        DROP COLUMN IF EXISTS "ubicacion_confirmada_en",
        DROP COLUMN IF EXISTS "longitud",
        DROP COLUMN IF EXISTS "latitud"
    `);
  }
}
