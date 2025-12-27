import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '../services/httpClient.js';
import { useAuth } from './useAuth.js';

const CACHE_TTL = 30_000;
const responseCache = new Map();

export const useFetchWithAuth = (path, { immediate = true, options = {} } = {}) => {
  const { refreshSession } = useAuth();
  const [state, setState] = useState({ data: null, meta: null, loading: immediate, error: null });
  const abortController = useRef(null);

  // Guarda las opciones en un ref para no romper la identidad de execute
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Si quieres re-disparar el fetch cuando cambien las opciones,
  // usa una clave memorizada (evita objetos inline distintos).
  const optionsKey = useMemo(() => JSON.stringify(options), [options]);
  const cacheKeyRef = useRef(`${path}::${optionsKey}`);
  useEffect(() => {
    cacheKeyRef.current = `${path}::${optionsKey}`;
  }, [path, optionsKey]);

  const execute = useCallback(
    async (override = {}) => {
      // Cancela petición previa
      if (abortController.current) {
        abortController.current.abort('new-request');
      }
      const controller = new AbortController();
      abortController.current = controller;

      setState(prev => ({ ...prev, loading: true, error: null }));

      const baseOptions = optionsRef.current;
      const cacheEnabled = override.cache ?? baseOptions.cache ?? true;
      const cacheTtl = override.cacheTtl ?? baseOptions.cacheTtl ?? CACHE_TTL;
      const forceRefresh = override.forceRefresh ?? false;
      const cacheKey = cacheKeyRef.current;

      if (cacheEnabled && !forceRefresh) {
        const cached = responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTtl) {
          setState({ data: cached.data, meta: cached.meta, loading: false, error: null });
          return cached.data;
        }
      }

      try {
        const response = await httpClient(path, {
          ...baseOptions,
          ...override,
          signal: controller.signal,
        });
        const data = response?.data ?? response;
        const meta = response?.meta ?? null;
        setState({ data, meta, loading: false, error: null });
        if (cacheEnabled) {
          responseCache.set(cacheKey, { data, meta, timestamp: Date.now() });
        }
        return data;
      } catch (error) {
        if (error?.status === 401) {
          try {
            await refreshSession({ silent: false });
            const retry = await httpClient(path, {
              ...baseOptions,
              ...override,
              signal: controller.signal,
            });
            const data = retry?.data ?? retry;
            const meta = retry?.meta ?? null;
            setState({ data, meta, loading: false, error: null });

            return data;
          } catch (refreshError) {
            setState({ data: null, meta: null, loading: false, error: refreshError });
            throw refreshError;
          }
        }
        if (error?.name === 'AbortError') {
          setState(prev => ({ ...prev, loading: false }));
        } else {
          setState({ data: null, meta: null, loading: false, error });
        }
        throw error;
      }
    },
    // 👇 ya no depende de `options`
    [path, refreshSession],
  );

  useEffect(() => {
    if (immediate) {
      // Ejecuta al montar y cuando cambie path u optionsKey
      execute();
    }
    return () => {
      abortController.current?.abort('component-unmount');
    };
    // 👇 evita depender de `execute` para no crear bucles
  }, [immediate, path, optionsKey]); 

  return {
    ...state,
    refetch: execute,
    cancel: () => abortController.current?.abort('manual-cancel'),
  };
};
