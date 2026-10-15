module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL?.trim();
  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
