module.exports = ({ config }) => {
  const mapStyleUrl =
    process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() ||
    'https://tiles.openfreemap.org/styles/liberty';

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      mapProvider: 'OPENFREEMAP',
      mapStyleUrl,
    },
  };
};
