const REQUIRED_ENV_VARS = ['VITE_API_BASE_URL'];

const readEnv = () => {
  const config = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
    storageKey: 'agxport:session',
    refreshWindowSeconds: Number.parseInt(import.meta.env.VITE_REFRESH_WINDOW_SECONDS ?? '840', 10),
  };

  REQUIRED_ENV_VARS.forEach((key) => {
    if (!import.meta.env[key]) {
      console.warn(`Variable de entorno faltante: ${key}. Se usará el valor por defecto.`);
    }
  });

  return config;
};

export const appConfig = readEnv();
