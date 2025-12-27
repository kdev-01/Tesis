import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { settingsService } from '../services/settingsService.js';

const AppConfigContext = createContext();

export const AppConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await settingsService.getPublicSettings();
      setConfig(data && Object.keys(data).length > 0 ? data : null);
      setError(null);
    } catch (err) {
      console.error('No se pudieron cargar los ajustes públicos', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const value = useMemo(
    () => ({
      config,
      isLoading,
      error,
      refresh: fetchConfig,
      setConfig,
    }),
    [config, error, fetchConfig, isLoading],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig debe utilizarse dentro de AppConfigProvider');
  }
  return context;
};
