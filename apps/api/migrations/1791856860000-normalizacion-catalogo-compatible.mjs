// Corrección descubierta en QA real con locale C: lower no convierte Á en á.
// Se añade una migración, sin reescribir la ya ensayada en Neon.
export class NormalizacionCatalogoCompatible1791856860000 {
  name = 'NormalizacionCatalogoCompatible1791856860000';
  async up(q) {
    await q.query(`
      CREATE OR REPLACE FUNCTION normalizar_catalogo(text) RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT lower(regexp_replace(btrim(translate(normalize($1,NFC),
          'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑáàäâãéèëêíìïîóòöôõúùüûñ',
          'AAAAAEEEEIIIIOOOOOUUUUNaaaaaeeeeiiiiooooouuuun')), '\\s+', ' ', 'g'))
      $$;
      UPDATE familia SET nombre=nombre;
      UPDATE producto_comercial SET nombre=nombre;
      CREATE FUNCTION vincular_catalogo_sku() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE familia_actual uuid; comercial_actual uuid;
      BEGIN
        IF NEW.producto_comercial_id IS NULL OR
          (TG_OP='UPDATE' AND (NEW.nombre,NEW.familia) IS DISTINCT FROM (OLD.nombre,OLD.familia)
            AND NEW.producto_comercial_id IS NOT DISTINCT FROM OLD.producto_comercial_id) THEN
          INSERT INTO familia(nombre) VALUES (NEW.familia)
            ON CONFLICT(nombre_normalizado) DO UPDATE SET nombre=familia.nombre RETURNING id INTO familia_actual;
          INSERT INTO producto_comercial(familia_id,nombre) VALUES (familia_actual,NEW.nombre)
            ON CONFLICT(familia_id,nombre_normalizado) DO UPDATE SET nombre=producto_comercial.nombre RETURNING id INTO comercial_actual;
          NEW.producto_comercial_id=comercial_actual;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER vincular_catalogo_sku BEFORE INSERT OR UPDATE OF nombre,familia ON producto
        FOR EACH ROW EXECUTE FUNCTION vincular_catalogo_sku();
    `);
  }
  async down() { throw new Error('Conservar catálogo e historial; utilizar recuperación compatible.'); }
}
