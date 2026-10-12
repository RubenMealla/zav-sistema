const compilacionQa = process.env.EXPO_PUBLIC_BUILD_CHANNEL === 'qa';

module.exports = ({ config }) => {
  const mapStyleUrl =
    process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() ||
    'https://tiles.openfreemap.org/styles/liberty';

  return {
    ...config,
    name: compilacionQa ? 'ZAV Vendedor QA' : config.name,
    android: {
      ...config.android,
      softwareKeyboardLayoutMode: compilacionQa ? 'resize' : config.android?.softwareKeyboardLayoutMode,
      package: compilacionQa
        ? 'bo.zav.gestion.vendedor.qa'
        : config.android?.package,
    },
    androidStatusBar: compilacionQa
      ? { ...config.androidStatusBar, translucent: false }
      : config.androidStatusBar,
    plugins: compilacionQa
      ? [...(config.plugins ?? []), './plugins/with-qa-local-network']
      : config.plugins,
    extra: {
      ...(config.extra ?? {}),
      mapProvider: 'OPENFREEMAP',
      mapStyleUrl,
    },
  };
};
