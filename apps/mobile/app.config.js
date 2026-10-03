module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      mapsConfigured: Boolean(mapsKey),
    },
    android: {
      ...config.android,
      ...(mapsKey
        ? {
            config: {
              ...(config.android?.config ?? {}),
              googleMaps: { apiKey: mapsKey },
            },
          }
        : {}),
    },
  };
};
