const { withAndroidManifest } = require('expo/config-plugins');

// Solo el APK QA admite conexiones HTTP a la API de la red local.
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const aplicacion = mod.modResults.manifest.application?.[0];
    if (!aplicacion) {
      throw new Error('No se encontró la aplicación en AndroidManifest.xml');
    }
    aplicacion.$ = {
      ...aplicacion.$,
      'android:usesCleartextTraffic': 'true',
    };
    return mod;
  });
