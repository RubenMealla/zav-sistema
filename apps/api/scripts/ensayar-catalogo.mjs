import { DataSource } from 'typeorm';
import { mkdir,writeFile } from 'node:fs/promises';
import { MIGRACIONES_ZAV } from './migraciones.mjs';

const url=new URL(process.env.DATABASE_URL??'');
const ensayo='ep-tiny-butterfly-b6lxt7mt.c-2.sa-east-1.aws.neon.tech';
const local=['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname==='/zav_restore_catalogo_20261012';
if(!local&&url.hostname!==ensayo.replace('.c-2','-pooler.c-2')&&url.hostname!==ensayo) throw new Error('Solo se admite la rama Neon de ensayo verificada o la restauración local.');
if(!local)url.hostname=ensayo;
const db=new DataSource({type:'postgres',url:url.href,migrations:MIGRACIONES_ZAV,migrationsTableName:'typeorm_migraciones',migrationsTransactionMode:'all',synchronize:false,logging:false});
// Proyecciones del esquema anterior: las columnas nuevas no alteran la huella histórica.
const proyecciones={
  producto:'id,codigo,nombre,familia,presentacion,peso_gramos,precio_bob,activo,creado_en,actualizado_en',
  cliente:'id,nombre,telefono,direccion,activo,creado_en,actualizado_en,latitud,longitud,ubicacion_confirmada_en',
  movimiento:'id,operacion_clave,lote_id,tipo,origen_id,destino_id,cantidad,usuario_id,referencia,motivo,creado_en',
  lote:'*',pedido:'*',detalle_pedido:'*',usuario:'*',lote_condicion_historial:'*',
};
async function huellas(ids){
  const resultado={};
  for(const [tabla,columnas] of Object.entries(proyecciones)) {
    const filas=ids[tabla];
    const [r]=await db.query(`SELECT count(*)::int AS filas,md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY id),'sin filas')) AS huella FROM (SELECT ${columnas} FROM ${tabla} WHERE id=ANY($1::uuid[])) t`,[filas]);resultado[tabla]=r;
  }
  return resultado;
}
try {
  await db.initialize();await db.query("SET TIME ZONE 'UTC'");
  const ids={};for(const tabla of Object.keys(proyecciones))ids[tabla]=(await db.query(`SELECT id FROM ${tabla}`)).map(r=>r.id);
  const antes=await huellas(ids);const ejecutadas=await db.runMigrations();const despues=await huellas(ids);
  const preservado=JSON.stringify(antes)===JSON.stringify(despues);
  const [integridad]=await db.query(`SELECT (SELECT count(*)::int FROM saldo_inventario WHERE cantidad_fisica<0) AS saldos_negativos,
    (SELECT count(*)::int FROM producto WHERE producto_comercial_id IS NULL) AS sku_sin_relacion,
    (SELECT count(*)::int FROM familia WHERE publicado AND activo) AS familias_publicadas,
    (SELECT count(*)::int FROM producto_comercial c JOIN familia f ON f.id=c.familia_id WHERE c.publicado AND c.activo AND f.publicado AND f.activo) AS productos_publicados`);
  const informe={fecha:new Date().toISOString(),host:url.hostname,base:url.pathname,ejecutadas:ejecutadas.map(m=>m.name),preservado,antes,despues,integridad};
  await mkdir('../../backups/catalogo-salidas-20261012',{recursive:true});
  await writeFile(`../../backups/catalogo-salidas-20261012/migracion-${local?'restauracion':'neon-ensayo'}.json`,JSON.stringify(informe,null,2));
  console.log(JSON.stringify({ejecutadas:informe.ejecutadas,preservado,integridad}));
  if(!preservado||integridad.saldos_negativos||integridad.sku_sin_relacion)throw new Error('La verificación de integridad no pasó.');
} finally {if(db.isInitialized)await db.destroy();}
