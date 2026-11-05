export class OperacionesCustodia1791856920000 {
  name = 'OperacionesCustodia1791856920000';
  async up(q) {
    await q.query(`
      ALTER TABLE cliente ADD COLUMN es_consumidor_final boolean NOT NULL DEFAULT false;
      CREATE UNIQUE INDEX uq_consumidor_final ON cliente(es_consumidor_final) WHERE es_consumidor_final;
      INSERT INTO cliente(nombre,direccion,activo,es_consumidor_final)
        VALUES ('Consumidor final','Entrega directa sin domicilio registrado',false,true);
      CREATE FUNCTION proteger_consumidor_final() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.es_consumidor_final OR (TG_OP='UPDATE' AND NEW.es_consumidor_final) THEN
          RAISE EXCEPTION 'El cliente especial de salidas directas es permanente.' USING ERRCODE='23514';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER proteger_consumidor_final BEFORE UPDATE OR DELETE ON cliente
        FOR EACH ROW EXECUTE FUNCTION proteger_consumidor_final();
      CREATE FUNCTION impedir_pedido_consumidor_final() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS(SELECT 1 FROM cliente WHERE id=NEW.cliente_id AND es_consumidor_final) THEN
          RAISE EXCEPTION 'Consumidor final solo admite salidas directas.' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER impedir_pedido_consumidor_final BEFORE INSERT OR UPDATE OF cliente_id ON pedido
        FOR EACH ROW EXECUTE FUNCTION impedir_pedido_consumidor_final();
      INSERT INTO ubicacion(codigo,nombre,clase,permite_venta)
        VALUES ('DEVOLUCIONES_INSPECCION','Devoluciones pendientes de inspección','AREA_FISICA',false)
        ON CONFLICT(codigo) DO NOTHING;

      CREATE TABLE operacion_inventario (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        operacion_clave uuid NOT NULL UNIQUE,
        tipo varchar(24) NOT NULL CHECK(tipo IN ('SALIDA_DIRECTA','CARGA','DEVOLUCION','REVERSION')),
        estado varchar(24) NOT NULL CHECK(estado IN ('CONFIRMADA','PENDIENTE_RECEPCION')),
        usuario_id uuid NOT NULL REFERENCES usuario(id),
        vendedor_id uuid REFERENCES usuario(id),
        cliente_id uuid REFERENCES cliente(id),
        solicitud jsonb NOT NULL,
        latitud numeric(9,6) CHECK(latitud BETWEEN -90 AND 90),
        longitud numeric(9,6) CHECK(longitud BETWEEN -180 AND 180),
        precision_m numeric(10,2) CHECK(precision_m >= 0),
        motivo varchar(300),
        revierte_id uuid UNIQUE REFERENCES operacion_inventario(id),
        creado_en timestamptz NOT NULL DEFAULT now(),
        CHECK ((latitud IS NULL)=(longitud IS NULL)),
        CHECK (tipo<>'SALIDA_DIRECTA' OR (cliente_id IS NOT NULL AND latitud IS NOT NULL)),
        CHECK (tipo NOT IN ('CARGA','DEVOLUCION') OR vendedor_id IS NOT NULL)
      );
      CREATE INDEX idx_operacion_vendedor_fecha ON operacion_inventario(vendedor_id,creado_en DESC);
      CREATE TABLE detalle_operacion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        operacion_id uuid NOT NULL REFERENCES operacion_inventario(id),
        producto_id uuid NOT NULL REFERENCES producto(id),
        cantidad int NOT NULL CHECK(cantidad>0),
        producto_historico jsonb NOT NULL,
        precio_unitario_bob numeric(12,2) CHECK(precio_unitario_bob>=0),
        UNIQUE(operacion_id,producto_id)
      );
      CREATE INDEX idx_detalle_operacion_producto ON detalle_operacion(producto_id);
      CREATE TABLE asignacion_operacion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        detalle_id uuid NOT NULL REFERENCES detalle_operacion(id),
        lote_id uuid NOT NULL REFERENCES lote(id),
        cantidad int NOT NULL CHECK(cantidad>0),
        condicion_al_registrar varchar(20) NOT NULL,
        UNIQUE(detalle_id,lote_id)
      );
      CREATE INDEX idx_asignacion_lote ON asignacion_operacion(lote_id);
      CREATE TABLE evento_operacion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        operacion_id uuid NOT NULL REFERENCES operacion_inventario(id),
        operacion_clave uuid NOT NULL UNIQUE,
        usuario_id uuid NOT NULL REFERENCES usuario(id),
        accion varchar(30) NOT NULL,
        solicitud jsonb NOT NULL,
        creado_en timestamptz NOT NULL DEFAULT now(),
        UNIQUE(operacion_id,accion)
      );
      ALTER TABLE movimiento ADD COLUMN asignacion_operacion_id uuid UNIQUE REFERENCES asignacion_operacion(id);
      ALTER TABLE movimiento DROP CONSTRAINT chk_movimiento_tipo, DROP CONSTRAINT chk_movimiento_estructura;
      ALTER TABLE movimiento ADD CONSTRAINT chk_movimiento_tipo
        CHECK(tipo IN ('INGRESO','TRASLADO','RETIRO','ENTREGA','SALIDA_DIRECTA','CARGA','DEVOLUCION','REVERSION'));
      ALTER TABLE movimiento ADD CONSTRAINT chk_movimiento_estructura CHECK(
        (tipo IN ('INGRESO','REVERSION') AND origen_id IS NULL AND destino_id IS NOT NULL) OR
        (tipo IN ('TRASLADO','RETIRO','CARGA','DEVOLUCION') AND origen_id IS NOT NULL AND destino_id IS NOT NULL AND origen_id<>destino_id) OR
        (tipo IN ('ENTREGA','SALIDA_DIRECTA') AND origen_id IS NOT NULL AND destino_id IS NULL));

      -- No backfill that guesses ownership: legacy custody follows the original pedido reference.
      CREATE VIEW saldo_custodia AS
        WITH trazado AS (
          SELECT m.*, COALESCE(o.vendedor_id,p.vendedor_id) AS vendedor_id,
            CASE WHEN p.id IS NOT NULL THEN 'PEDIDO' ELSE 'LIBRE' END AS finalidad
          FROM movimiento m
          LEFT JOIN asignacion_operacion a ON a.id=m.asignacion_operacion_id
          LEFT JOIN detalle_operacion d ON d.id=a.detalle_id
          LEFT JOIN operacion_inventario o ON o.id=d.operacion_id
          LEFT JOIN pedido p ON m.tipo IN ('RETIRO','ENTREGA') AND m.referencia=p.id::text
        )
        SELECT t.vendedor_id,t.lote_id,t.finalidad,
          sum(CASE WHEN dst.codigo='EN_DISTRIBUCION' THEN t.cantidad ELSE 0 END
             -CASE WHEN src.codigo='EN_DISTRIBUCION' THEN t.cantidad ELSE 0 END)::int AS cantidad
        FROM trazado t
        LEFT JOIN ubicacion src ON src.id=t.origen_id
        LEFT JOIN ubicacion dst ON dst.id=t.destino_id
        WHERE src.codigo='EN_DISTRIBUCION' OR dst.codigo='EN_DISTRIBUCION'
        GROUP BY t.vendedor_id,t.lote_id,t.finalidad;

      CREATE VIEW custodia_libre AS
        WITH pendiente AS (
          SELECT o.vendedor_id,a.lote_id,sum(a.cantidad)::int AS cantidad
          FROM operacion_inventario o JOIN detalle_operacion d ON d.operacion_id=o.id
          JOIN asignacion_operacion a ON a.detalle_id=d.id
          WHERE o.estado='PENDIENTE_RECEPCION' AND o.tipo IN ('CARGA','DEVOLUCION')
          GROUP BY o.vendedor_id,a.lote_id
        )
        SELECT s.vendedor_id,s.lote_id,s.cantidad AS fisico,
          COALESCE(p.cantidad,0)::int AS pendiente,
          (s.cantidad-COALESCE(p.cantidad,0))::int AS disponible
        FROM saldo_custodia s LEFT JOIN pendiente p USING(vendedor_id,lote_id)
        WHERE s.finalidad='LIBRE';
    `);
  }
  async down() {
    throw new Error('Conservar movimientos y custodia; recuperación por migración compatible o respaldo verificado.');
  }
}
