// Incremental: conserva IDs, columnas y relaciones del SKU histórico.
export class CatalogoAdministrable1791856800000 {
  name = 'CatalogoAdministrable1791856800000';

  async up(q) {
    await q.query(`
      CREATE FUNCTION normalizar_catalogo(text) RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT translate(lower(regexp_replace(btrim($1), '\\s+', ' ', 'g')),
          'áàäâãéèëêíìïîóòöôõúùüûñ', 'aaaaaeeeeiiiiooooouuuun')
      $$;
      CREATE TABLE imagen_catalogo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 5242880),
        tipo varchar(30) NOT NULL CHECK (tipo IN ('image/png','image/jpeg','image/webp')),
        sha256 varchar(64) NOT NULL UNIQUE,
        ancho int NOT NULL CHECK (ancho BETWEEN 1 AND 4096),
        alto int NOT NULL CHECK (alto BETWEEN 1 AND 4096),
        usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
        creado_en timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE familia (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(70) NOT NULL CHECK (length(btrim(nombre)) > 0),
        nombre_normalizado text GENERATED ALWAYS AS (normalizar_catalogo(nombre)) STORED UNIQUE,
        slug varchar(100) UNIQUE,
        descripcion varchar(1500) NOT NULL DEFAULT '',
        imagen_original varchar(180),
        imagen_id uuid REFERENCES imagen_catalogo(id) ON DELETE RESTRICT,
        activo boolean NOT NULL DEFAULT true,
        publicado boolean NOT NULL DEFAULT false,
        orden int NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 100000),
        creado_en timestamptz NOT NULL DEFAULT now(),
        actualizado_en timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE producto_comercial (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        familia_id uuid NOT NULL REFERENCES familia(id) ON DELETE RESTRICT,
        nombre varchar(120) NOT NULL CHECK (length(btrim(nombre)) > 0),
        nombre_normalizado text GENERATED ALWAYS AS (normalizar_catalogo(nombre)) STORED,
        descripcion varchar(1500) NOT NULL DEFAULT '',
        caracteristicas varchar(2000) NOT NULL DEFAULT '',
        imagen_original varchar(180),
        imagen_id uuid REFERENCES imagen_catalogo(id) ON DELETE RESTRICT,
        activo boolean NOT NULL DEFAULT true,
        publicado boolean NOT NULL DEFAULT false,
        orden int NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 100000),
        creado_en timestamptz NOT NULL DEFAULT now(),
        actualizado_en timestamptz NOT NULL DEFAULT now(),
        UNIQUE (familia_id, nombre_normalizado)
      );
      ALTER TABLE producto
        ADD COLUMN producto_comercial_id uuid REFERENCES producto_comercial(id) ON DELETE RESTRICT,
        ADD COLUMN tipo_empaque varchar(100) NOT NULL DEFAULT 'Sin especificar',
        ADD COLUMN validacion_comercial varchar(20) NOT NULL DEFAULT 'LEGADO'
          CHECK (validacion_comercial IN ('LEGADO','PROVISIONAL','VALIDADO')),
        ADD COLUMN validado_por uuid REFERENCES usuario(id) ON DELETE RESTRICT,
        ADD COLUMN validado_en timestamptz;
      CREATE INDEX idx_producto_comercial_id ON producto(producto_comercial_id);
      CREATE INDEX idx_familia_publicacion ON familia(publicado, activo, orden, id);
      CREATE INDEX idx_comercial_publicacion ON producto_comercial(familia_id, publicado, activo, orden, id);
      CREATE TABLE catalogo_auditoria (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entidad varchar(30) NOT NULL,
        entidad_id uuid NOT NULL,
        usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
        anterior jsonb,
        posterior jsonb NOT NULL,
        creado_en timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_catalogo_auditoria_entidad ON catalogo_auditoria(entidad, entidad_id, creado_en);
    `);

    // Primero los datos confirmados. Sin precios, pesos o SKU inventados.
    const familias = [
      ['mortadelas', 'Mortadelas', 'Tres productos del catálogo fotográfico ZAV.', [
        ['Mortadela Jamonada', 'mortadela-jamonada'], ['Mortadela Primavera', 'mortadela-primavera'], ['Mortadela Tradicional', 'mortadela-tradicional']]],
      ['chorizos', 'Chorizos', 'Coctelero, parrillero, precocido y tipo español.', [
        ['Chorizo Coctelero', 'chorizo-coctelero'], ['Chorizo Parrillero', 'chorizo-parrillero'], ['Chorizo Precocido', 'chorizo-precocido'], ['Chorizo Tipo Español', 'chorizo-tipo-espanol']]],
      ['salchichas', 'Salchichas', 'Productos tipo Súper Pancho y tipo Viena.', [
        ['Salchicha Tipo Súper Pancho', 'salchicha-tipo-super-pancho'], ['Salchicha Tipo Viena', 'salchicha-tipo-viena']]],
      ['morcillas', 'Morcillas', 'Morcilla artesanal dentro del catálogo ZAV.', [['Morcilla Artesanal', 'morcilla-artesanal']]],
      ['jamones', 'Jamones', 'Jamón cocido light del catálogo fotográfico.', [['Jamón Cocido Light', 'jamon-cocido-light']]],
      ['tocinos-ahumados', 'Tocinos y ahumados', 'Tocino ahumado del catálogo ZAV.', [['Tocino Ahumado', 'tocino-ahumado']]],
      ['fiambres-especiales', 'Fiambres especiales', 'Queso de chancho dentro de la línea de fiambres especiales.', [['Queso de Chancho', 'queso-de-chancho']]],
    ];
    for (const [orden, [slug, nombre, descripcion, productos]] of familias.entries()) {
      const [familia] = await q.query(
        `INSERT INTO familia (slug,nombre,descripcion,publicado,orden,imagen_original)
         VALUES ($1,$2,$3,true,$4,$5) RETURNING id`,
        [slug, nombre, descripcion, orden, `/catalogo-original/${productos[0][1]}.png`],
      );
      for (const [indice, [producto, archivo]] of productos.entries()) {
        await q.query(
          `INSERT INTO producto_comercial (familia_id,nombre,imagen_original,publicado,orden)
           VALUES ($1,$2,$3,true,$4)`,
          [familia.id, producto, `/catalogo-original/${archivo}.png`, indice],
        );
      }
    }
    await q.query(`
      INSERT INTO familia(nombre)
        SELECT DISTINCT ON (normalizar_catalogo(familia)) familia FROM producto ORDER BY normalizar_catalogo(familia), id
        ON CONFLICT (nombre_normalizado) DO NOTHING;
      INSERT INTO producto_comercial(familia_id,nombre)
        SELECT DISTINCT ON (f.id,normalizar_catalogo(p.nombre)) f.id,p.nombre
        FROM producto p JOIN familia f ON f.nombre_normalizado=normalizar_catalogo(p.familia)
        ORDER BY f.id,normalizar_catalogo(p.nombre),p.id
        ON CONFLICT (familia_id,nombre_normalizado) DO NOTHING;
      UPDATE producto p SET producto_comercial_id=c.id
        FROM producto_comercial c JOIN familia f ON f.id=c.familia_id
        WHERE f.nombre_normalizado=normalizar_catalogo(p.familia)
          AND c.nombre_normalizado=normalizar_catalogo(p.nombre);

      CREATE FUNCTION proteger_identidad_sku() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
          RAISE EXCEPTION 'El código SKU es permanente; cree una presentación nueva.' USING ERRCODE='23514';
        END IF;
        IF (NEW.nombre,NEW.familia,NEW.presentacion,NEW.peso_gramos,NEW.producto_comercial_id,NEW.tipo_empaque)
          IS DISTINCT FROM (OLD.nombre,OLD.familia,OLD.presentacion,OLD.peso_gramos,OLD.producto_comercial_id,OLD.tipo_empaque)
          AND (EXISTS(SELECT 1 FROM lote WHERE producto_id=OLD.id)
            OR EXISTS(SELECT 1 FROM detalle_pedido WHERE producto_id=OLD.id)) THEN
          RAISE EXCEPTION 'La presentación tiene historial; cree otro SKU para cambiar su identidad.' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER proteger_identidad_sku BEFORE UPDATE ON producto
        FOR EACH ROW EXECUTE FUNCTION proteger_identidad_sku();
    `);
  }

  async down() {
    throw new Error('Migración incremental: conservar historial y volver al código compatible. Restaurar datos solo mediante el procedimiento de recuperación verificado.');
  }
}
