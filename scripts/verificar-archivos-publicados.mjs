import { execFileSync } from 'node:child_process';

const archivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const prohibidos = archivos.filter(ruta => {
  const nombre = ruta.split('/').at(-1);
  return (/^\.env(?:\.|$)/.test(nombre) && !nombre.endsWith('.example')) ||
    /\.(?:pem|key|p8|p12|pfx|jks|keystore|dump)$/i.test(nombre) ||
    /(?:^|\/)(?:credentials|secrets|backups|node_modules|\.next|\.expo|\.idea)\//.test(ruta) ||
    /(?:service-account.*|.*-service-account|firebase-adminsdk.*)\.json$/i.test(nombre);
});
if (prohibidos.length) {
  console.error('Archivos privados o generados incluidos en Git:\n' + prohibidos.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${archivos.length} archivos versionados: sin archivos privados ni directorios generados.`);
}
