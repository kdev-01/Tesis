import { appConfig } from '../config/env.js';
import { parseError } from '../utils/errors.js';
import { secureStorage } from '../utils/storage.js';

const DEFAULT_RETRY_ATTEMPTS = 2;

export const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

export const httpClient = async (
  path,
  { method = 'GET', body, headers = {}, signal, retry = DEFAULT_RETRY_ATTEMPTS, auth = true, token } = {},
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const finalHeaders = { ...headers };
    const isFormData = body instanceof FormData;
    if (!isFormData && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    let authToken = token;
    if (auth && !authToken) {
      const cached = secureStorage.get(appConfig.storageKey);
      authToken = cached?.tokens?.accessToken ?? null;
    }
    if (auth && authToken) {
      finalHeaders.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      method,
      headers: finalHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: signal ?? controller.signal,
    });

    if (response.ok) {
      if (response.status === 204) {
        return { data: null };
      }
      const data = await response.json();
      return data;
    }

    if (retry > 0 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return httpClient(path, { method, body, headers, signal, retry: retry - 1, auth });
    }

    throw await parseError(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La petición tardó demasiado y fue cancelada.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
