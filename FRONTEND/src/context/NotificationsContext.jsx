import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { notificationService } from '../services/dataService.js';
import { useToastContext } from './ToastContext.jsx';
import { useAuth } from '../hooks/useAuth.js';

const EMPTY_SUMMARY = { total_sin_leer: 0, recientes: [] };

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToastContext();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    setLoading(true);
    try {
      const data = await notificationService.summary({ limit: 5 });
      if (!data || typeof data !== 'object') {
        setSummary(EMPTY_SUMMARY);
        return;
      }
      const recent = Array.isArray(data.recientes) ? data.recientes : [];
      setSummary({
        total_sin_leer: Number.parseInt(data.total_sin_leer ?? 0, 10) || 0,
        recientes: recent,
      });
    } catch (error) {
      console.error('No se pudieron cargar las notificaciones', error);
      addToast({
        title: 'No se pudieron cargar las notificaciones',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [addToast, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setSummary(EMPTY_SUMMARY);
    }
  }, [isAuthenticated, refresh]);

  const markAsRead = useCallback(
    async (notificationId, read = true) => {
      if (!notificationId) return;
      try {
        await notificationService.markAsRead(notificationId, read);
        await refresh();
      } catch (error) {
        console.error('No se pudo actualizar la notificación', error);
        addToast({
          title: 'No se pudo actualizar la notificación',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      }
    },
    [addToast, refresh],
  );

  const markAllAsRead = useCallback(
    async (read = true) => {
      try {
        await notificationService.markAll({ read });
        await refresh();
      } catch (error) {
        console.error('No se pudieron actualizar las notificaciones', error);
        addToast({
          title: 'No se pudieron actualizar las notificaciones',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      }
    },
    [addToast, refresh],
  );

  const remove = useCallback(
    async (notificationId) => {
      if (!notificationId) return;
      try {
        await notificationService.remove(notificationId);
        await refresh();
      } catch (error) {
        console.error('No se pudo eliminar la notificación', error);
        addToast({
          title: 'No se pudo eliminar la notificación',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      }
    },
    [addToast, refresh],
  );

  const clear = useCallback(async () => {
    try {
      await notificationService.clear();
      await refresh();
    } catch (error) {
      console.error('No se pudieron limpiar las notificaciones', error);
      addToast({
        title: 'No se pudieron limpiar las notificaciones',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    }
  }, [addToast, refresh]);

  const value = useMemo(
    () => ({
      summary,
      unreadCount: summary?.total_sin_leer ?? 0,
      recent: Array.isArray(summary?.recientes) ? summary.recientes : [],
      refresh,
      loading,
      markAsRead,
      markAllAsRead,
      remove,
      clear,
    }),
    [clear, loading, markAllAsRead, markAsRead, refresh, summary],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  }
  return context;
};
