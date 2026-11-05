export class GuardasOperativasCompatibles1791856980000 {
  name='GuardasOperativasCompatibles1791856980000';
  async up(q) {
    await q.query(`
      -- Los registros migrados mantienen LEGADO; las nuevas altas requieren revisión explícita.
      ALTER TABLE producto ALTER COLUMN validacion_comercial SET DEFAULT 'PROVISIONAL';
      CREATE FUNCTION revisar_precio_comercial() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.precio_bob IS DISTINCT FROM OLD.precio_bob AND NEW.validado_en IS NOT DISTINCT FROM OLD.validado_en THEN
          NEW.validacion_comercial:='PROVISIONAL'; NEW.validado_en:=NULL; NEW.validado_por:=NULL;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER revisar_precio_comercial BEFORE UPDATE OF precio_bob ON producto FOR EACH ROW EXECUTE FUNCTION revisar_precio_comercial();
      CREATE FUNCTION validar_presentacion_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtext('producto:'||NEW.producto_id::text));
        IF NOT EXISTS(SELECT 1 FROM producto p JOIN producto_comercial c ON c.id=p.producto_comercial_id JOIN familia f ON f.id=c.familia_id
          WHERE p.id=NEW.producto_id AND p.activo AND c.activo AND f.activo AND p.validacion_comercial<>'PROVISIONAL') THEN
          RAISE EXCEPTION 'Presentación no habilitada comercialmente para pedidos.' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER validar_presentacion_pedido BEFORE INSERT OR UPDATE OF producto_id,cantidad ON detalle_pedido FOR EACH ROW EXECUTE FUNCTION validar_presentacion_pedido();
      CREATE FUNCTION proteger_salida_fisica() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE producto uuid; condicion_actual text; vigente boolean; origen_codigo text; disponible bigint;
      BEGIN
        SELECT producto_id INTO producto FROM lote WHERE id=NEW.lote_id;
        PERFORM pg_advisory_xact_lock(hashtext('producto:'||producto::text));
        SELECT condicion,vence_el >= (now() AT TIME ZONE 'America/La_Paz')::date INTO condicion_actual,vigente FROM lote WHERE id=NEW.lote_id;
        IF NEW.origen_id IS NOT NULL THEN
          SELECT codigo INTO origen_codigo FROM ubicacion WHERE id=NEW.origen_id;
          SELECT cantidad_fisica INTO disponible FROM saldo_inventario WHERE lote_id=NEW.lote_id AND ubicacion_id=NEW.origen_id;
          IF COALESCE(disponible,0)<NEW.cantidad THEN
            RAISE EXCEPTION 'El movimiento produciría un saldo negativo.' USING ERRCODE='23514';
          END IF;
        END IF;
        IF NEW.tipo IN ('SALIDA_DIRECTA','CARGA','RETIRO') THEN
          IF condicion_actual<>'LIBERADO' OR NOT vigente THEN
            RAISE EXCEPTION 'El lote no es elegible para la salida.' USING ERRCODE='23514';
          END IF;
          IF NOT EXISTS(SELECT 1 FROM producto p JOIN producto_comercial c ON c.id=p.producto_comercial_id JOIN familia f ON f.id=c.familia_id
            WHERE p.id=producto AND p.activo AND c.activo AND f.activo AND p.validacion_comercial<>'PROVISIONAL') THEN
            RAISE EXCEPTION 'Presentación provisional o inactiva.' USING ERRCODE='23514';
          END IF;
        END IF;
        IF origen_codigo='DEVOLUCIONES_INSPECCION' AND (condicion_actual<>'LIBERADO' OR NOT vigente OR length(trim(COALESCE(NEW.motivo,'')))=0) THEN
          RAISE EXCEPTION 'La devolución requiere inspección, motivo, liberación y vigencia.' USING ERRCODE='23514';
        END IF;
        IF NEW.tipo IN ('SALIDA_DIRECTA','CARGA','DEVOLUCION','REVERSION') AND NEW.asignacion_operacion_id IS NULL THEN
          RAISE EXCEPTION 'La operación requiere asignación trazable.' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER proteger_salida_fisica BEFORE INSERT ON movimiento FOR EACH ROW EXECUTE FUNCTION proteger_salida_fisica();
      CREATE FUNCTION conservar_historial_operativo() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'El historial es inmutable; registre una reversión auditada.' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER conservar_historial BEFORE UPDATE OR DELETE ON movimiento FOR EACH ROW EXECUTE FUNCTION conservar_historial_operativo();
      CREATE TRIGGER conservar_historial BEFORE UPDATE OR DELETE ON detalle_operacion FOR EACH ROW EXECUTE FUNCTION conservar_historial_operativo();
      CREATE TRIGGER conservar_historial BEFORE UPDATE OR DELETE ON asignacion_operacion FOR EACH ROW EXECUTE FUNCTION conservar_historial_operativo();
      CREATE TRIGGER conservar_historial BEFORE UPDATE OR DELETE ON evento_operacion FOR EACH ROW EXECUTE FUNCTION conservar_historial_operativo();
      CREATE TRIGGER conservar_historial BEFORE UPDATE OR DELETE ON catalogo_auditoria FOR EACH ROW EXECUTE FUNCTION conservar_historial_operativo();
      CREATE FUNCTION conservar_operacion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'La operación conserva historial.' USING ERRCODE='23514'; END IF;
        IF (to_jsonb(NEW)-'estado') IS DISTINCT FROM (to_jsonb(OLD)-'estado') OR OLD.estado<>'PENDIENTE_RECEPCION' OR NEW.estado<>'CONFIRMADA'
          OR NOT EXISTS(SELECT 1 FROM evento_operacion WHERE operacion_id=OLD.id) THEN
          RAISE EXCEPTION 'La operación solo admite recepción auditada.' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER conservar_operacion BEFORE UPDATE OR DELETE ON operacion_inventario FOR EACH ROW EXECUTE FUNCTION conservar_operacion();
    `);
  }
  async down(){throw new Error('No retirar garantías de integridad; usar recuperación compatible.');}
}
