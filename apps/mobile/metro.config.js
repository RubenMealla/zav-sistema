const path = require('node:path');
const { createHash } = require('node:crypto');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Metro no debe reutilizar código con variables públicas de otra compilación.
const entornoPublico = Object.entries(process.env)
  .filter(([nombre]) => nombre.startsWith('EXPO_PUBLIC_'))
  .sort(([a], [b]) => a.localeCompare(b));
const huellaEntorno = createHash('sha256').update(JSON.stringify(entornoPublico)).digest('hex');
config.cacheVersion = `${config.cacheVersion ?? ''}:zav:${huellaEntorno}`;
if (process.env.EXPO_PUBLIC_BUILD_CHANNEL !== 'qa') {
  const sustituciones = new Map([
    [path.resolve(__dirname, 'src/components/consola-qa.tsx'), 'src/lib/qa-desactivado.ts'],
    [path.resolve(__dirname, 'src/lib/diagnostico-qa.ts'), 'src/lib/qa-desactivado.ts'],
    [path.resolve(__dirname, 'src/lib/configuracion-api.ts'), 'src/lib/configuracion-api-release.ts'],
  ]);
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resultado = context.resolveRequest(context, moduleName, platform);
    const sustituto = resultado.type === 'sourceFile' && sustituciones.get(path.resolve(resultado.filePath));
    return sustituto ? { type: 'sourceFile', filePath: path.resolve(__dirname, sustituto) } : resultado;
  };
}
module.exports = config;
