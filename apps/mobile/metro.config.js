const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
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
