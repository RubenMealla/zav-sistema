import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';

// Solo lee la fuente. La restauración exige una base local nueva, nunca sobrescribe otra.
const origen = new URL(process.env.DATABASE_URL ?? '');
const destino = new URL(process.env.RESTORE_DATABASE_URL ?? '');
if (!['127.0.0.1','localhost'].includes(destino.hostname) || !/^\/zav_restore_[a-z0-9_]+$/.test(destino.pathname)) {
  throw new Error('La restauración exige PostgreSQL local y una base nueva zav_restore_*.');
}
if (origen.hostname.includes('-pooler')) throw new Error('Utiliza conexión directa para respaldar.');
const bin = process.env.PG_BIN;
const carpeta = resolve(process.env.BACKUP_DIR ?? '../../backups/catalogo-salidas');
const archivo = join(carpeta,'production-previa.dump');
if (!bin || existsSync(archivo)) throw new Error('PG_BIN requerido; no se reemplazan respaldos existentes.');
mkdirSync(carpeta,{recursive:true});

function ejecutar(nombre,args,url) {
  const resultado=spawnSync(join(bin,`${nombre}${process.platform==='win32'?'.exe':''}`),args,{
    env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1),PGSSLMODE:url.searchParams.get('sslmode')??'prefer'},
    encoding:'utf8',windowsHide:true,
  });
  if(resultado.status!==0) throw new Error(`${nombre} falló (${resultado.status}): ${(resultado.stderr??'').replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[CONEXION]')}`);
}

async function huellas(url) {
  const cliente=new pg.Client({connectionString:url.toString()});
  await cliente.connect();
  try {
    await cliente.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL TIME ZONE 'UTC'");
    const tablas=await cliente.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    const resultado={};
    for(const {tablename} of tablas.rows) {
      const nombre='"'+tablename.replaceAll('"','""')+'"';
      const consulta=await cliente.query(`SELECT count(*)::int AS filas,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS huella FROM public.${nombre} t`);
      resultado[tablename]=consulta.rows[0];
    }
    await cliente.query('COMMIT');
    return resultado;
  }finally{await cliente.end();}
}

const antes=await huellas(origen);
ejecutar('pg_dump',['--format=custom','--no-owner','--no-acl','--file',archivo],origen);
ejecutar('createdb',['--maintenance-db=postgres',destino.pathname.slice(1)],destino);
ejecutar('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname',destino.pathname.slice(1),archivo],destino);
const restaurado=await huellas(destino);
const despues=await huellas(origen);
const fuenteEstable=JSON.stringify(antes)===JSON.stringify(despues);
const coincide=JSON.stringify(antes)===JSON.stringify(restaurado);
const evidencia={fechaUtc:new Date().toISOString(),archivo,sha256:createHash('sha256').update(readFileSync(archivo)).digest('hex'),baseRestaurada:destino.pathname.slice(1),fuenteEstable,coincide,tablas:restaurado};
writeFileSync(join(carpeta,'verificacion.json'),JSON.stringify(evidencia,null,2)+'\n');
console.log(JSON.stringify(evidencia,null,2));
if(!fuenteEstable||!coincide) throw new Error('No se certifica el respaldo: fuente cambió durante la copia o las huellas no coinciden.');
