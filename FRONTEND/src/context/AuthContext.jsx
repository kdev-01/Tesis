import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService.js';
import { secureStorage } from '../utils/storage.js';
import { appConfig } from '../config/env.js';
import { useToastContext } from './ToastContext.jsx';
import { ACCESSIBLE_MESSAGES, RouteNames } from '../utils/constants.js';
import { useLiveAnnouncer } from '../hooks/useLiveAnnouncer.js';

const AuthContext = createContext();
export { AuthContext };

const normalizeSessionResponse = (session) => {
  const payload = session?.data ?? session;
  if (!payload) {
    return { user: null, tokens: null };
  }

  const user = payload.user ?? null;
  const rawTokens = payload.tokens ?? null;
  if (!rawTokens) {
    return { user, tokens: null };
  }

  const accessToken = rawTokens.access_token ?? rawTokens.accessToken ?? null;
  const refreshToken = rawTokens.refresh_token ?? rawTokens.refreshToken ?? null;
  if (!accessToken || !refreshToken) {
    return { user, tokens: null };
  }

  const now = Date.now();
  const expiresInSeconds = Number.parseInt(rawTokens.expires_in ?? rawTokens.expiresIn ?? 0, 10);
  const refreshInSeconds = Number.parseInt(rawTokens.refresh_expires_in ?? rawTokens.refreshExpiresIn ?? 0, 10);
  const accessExpiresAt = expiresInSeconds ? now + expiresInSeconds * 1000 : null;
  const refreshExpiresAt = refreshInSeconds ? now + refreshInSeconds * 1000 : null;

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      tokenType: rawTokens.token_type ?? rawTokens.tokenType ?? 'bearer',
      expiresIn: expiresInSeconds,
      refreshExpiresIn: refreshInSeconds,
      accessExpiresAt,
      refreshExpiresAt,
    },
  };
};

const isTimestampExpired = (timestamp) => typeof timestamp === 'number' && timestamp > 0 && timestamp <= Date.now();

const initialState = {
  status: 'idle',
  user: null,
  tokens: null,
  error: null,
  isInitialized: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null };
    case 'LOGIN_SUCCESS':
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        user: action.payload.user,
        tokens: action.payload.tokens,
        error: null,
        isInitialized: true,
      };
    case 'LOGOUT':
      return { ...initialState, isInitialized: true };
    case 'ERROR':
      return { ...state, status: 'error', error: action.payload, isInitialized: true };
    case 'RESTORE':
      return {
        ...state,
        status: action.payload.user ? 'authenticated' : 'idle',
        user: action.payload.user,
        tokens: action.payload.tokens,
        isInitialized: true,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const { addToast } = useToastContext();
  const { announce } = useLiveAnnouncer();
  const refreshTimer = useRef(null);
  const refreshSessionRef = useRef(null);
  const [state, dispatch] = useReducer(reducer, initialState);

  const scheduleRefresh = useCallback((tokens) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
    if (!tokens?.accessExpiresAt || !tokens?.refreshToken) {
      return;
    }
    const now = Date.now();
    const delay = tokens.accessExpiresAt - now - 60000;
    if (delay <= 0) {
      refreshSessionRef.current?.({ silent: true }).catch((error) => {
        console.error('No se pudo refrescar la sesión automáticamente', error);
        dispatch({ type: 'ERROR', payload: error });
      });
      return;
    }
    refreshTimer.current = setTimeout(() => {
      refreshSessionRef.current?.({ silent: true }).catch((error) => {
        console.error('No se pudo refrescar la sesión automáticamente', error);
        dispatch({ type: 'ERROR', payload: error });
      });
    }, Math.max(delay, 10000));
  }, []);

  useEffect(() => {
    const cached = secureStorage.get(appConfig.storageKey);
    if (cached?.tokens?.refreshExpiresAt && isTimestampExpired(cached.tokens.refreshExpiresAt)) {
      secureStorage.remove(appConfig.storageKey);
      dispatch({ type: 'RESTORE', payload: { user: null, tokens: null } });
    } else if (cached?.user && cached?.tokens) {
      dispatch({ type: 'RESTORE', payload: cached });
      scheduleRefresh(cached.tokens);
    } else {
      dispatch({ type: 'RESTORE', payload: { user: null, tokens: null } });
    }
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, [scheduleRefresh]);

  const persistSession = useCallback((session) => {
    if (!session?.user || !session.tokens) {
      secureStorage.remove(appConfig.storageKey);
      return;
    }
    const ttl = session.tokens.refreshExpiresAt ? session.tokens.refreshExpiresAt - Date.now() : undefined;
    secureStorage.set(appConfig.storageKey, session, ttl && ttl > 0 ? ttl : undefined);
  }, []);

  const login = useCallback(
    async (credentials) => {
      dispatch({ type: 'LOADING' });
      try {
        const sessionResponse = await authService.login(credentials);
        const normalized = normalizeSessionResponse(sessionResponse);
        dispatch({ type: 'LOGIN_SUCCESS', payload: normalized });
        persistSession(normalized);
        scheduleRefresh(normalized.tokens);
        addToast({ title: 'Bienvenido', description: ACCESSIBLE_MESSAGES.LOGGED_IN, status: 'success' });
        announce(ACCESSIBLE_MESSAGES.LOGGED_IN);
        navigate(RouteNames.DASHBOARD, { replace: true });
      } catch (error) {
        dispatch({ type: 'ERROR', payload: error });
        addToast({ title: 'Acceso denegado', description: error.message, status: 'error' });
        throw error;
      }
    },
    [addToast, navigate, persistSession, scheduleRefresh],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Error al cerrar sesión en el servidor', error);
    } finally {
      secureStorage.remove(appConfig.storageKey);
      dispatch({ type: 'LOGOUT' });
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      addToast({ title: 'Sesión cerrada', description: ACCESSIBLE_MESSAGES.LOGGED_OUT, status: 'info' });
      announce(ACCESSIBLE_MESSAGES.LOGGED_OUT);
      navigate(RouteNames.HOME, { replace: true });
    }
  }, [addToast, navigate]);

  const refreshSession = useCallback(
    async ({ silent = false } = {}) => {
      const cached = state.user && state.tokens ? { user: state.user, tokens: state.tokens } : secureStorage.get(appConfig.storageKey);
      const refreshToken = cached?.tokens?.refreshToken;

      if (!refreshToken) {
        if (!silent) {
          addToast({ title: 'Sesión expirada', description: 'Vuelve a iniciar sesión para continuar.', status: 'warning' });
        }
        dispatch({ type: 'LOGOUT' });
        secureStorage.remove(appConfig.storageKey);
        navigate(RouteNames.LOGIN);
        throw new Error('No hay token de actualización disponible.');
      }

      if (cached?.tokens?.refreshExpiresAt && isTimestampExpired(cached.tokens.refreshExpiresAt)) {
        if (!silent) {
          addToast({ title: 'Sesión expirada', description: 'Vuelve a iniciar sesión para continuar.', status: 'warning' });
        }
        dispatch({ type: 'LOGOUT' });
        secureStorage.remove(appConfig.storageKey);
        navigate(RouteNames.LOGIN);
        throw new Error('La sesión ha expirado.');
      }

      try {
        const sessionResponse = await authService.refresh(refreshToken);
        const normalized = normalizeSessionResponse(sessionResponse);
        dispatch({ type: 'REFRESH_SUCCESS', payload: normalized });
        persistSession(normalized);
        scheduleRefresh(normalized.tokens);
        return normalized.user;
      } catch (error) {
        if (!silent) {
          addToast({ title: 'Sesión expirada', description: 'Vuelve a iniciar sesión para continuar.', status: 'warning' });
        }
        dispatch({ type: 'LOGOUT' });
        secureStorage.remove(appConfig.storageKey);
        navigate(RouteNames.LOGIN);
        throw error;
      }
    },
    [addToast, navigate, persistSession, scheduleRefresh, state.tokens, state.user],
  );

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  const hasRole = useCallback(
    (role) => {
      const userRoles = (state.user?.roles ?? []).map((value) => value?.toLowerCase?.() ?? value);
      if (!role) return !!state.user;
      if (Array.isArray(role)) {
        return role.some((target) => userRoles.includes((target ?? '').toLowerCase()));
      }
      return userRoles.includes((role ?? '').toLowerCase());
    },
    [state.user],
  );

  const hasPermission = useCallback(
    (permission) => {
      const userPermissions = (state.user?.permisos ?? []).map((value) => value?.toLowerCase?.() ?? value);
      if (!permission) return !!state.user;
      if (Array.isArray(permission)) {
        return permission.some((target) => userPermissions.includes((target ?? '').toLowerCase()));
      }
      return userPermissions.includes((permission ?? '').toLowerCase());
    },
    [state.user],
  );

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated:
        state.status === 'authenticated' && Boolean(state.user && state.tokens?.accessToken),
      login,
      logout,
      refreshSession,
      hasRole,
      hasPermission,
      roles: state.user?.roles ?? [],
      permissions: state.user?.permisos ?? [],
      setAuthenticatedUser: (user) => {
        if (!state.tokens) return;
        const normalized = { user, tokens: state.tokens };
        dispatch({ type: 'REFRESH_SUCCESS', payload: normalized });
        persistSession(normalized);
        scheduleRefresh(state.tokens);
      },
    }),
    [hasPermission, hasRole, login, logout, refreshSession, scheduleRefresh, state, persistSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  }
  return context;
};

export const useAuthenticatedUser = () => {
  const { user } = useAuthContext();
  return user;
};

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useAuthContext();
  return isAuthenticated;
};
