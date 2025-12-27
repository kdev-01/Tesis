import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { notificationService } from '../../services/dataService.js';
import { useToastContext } from '../../context/ToastContext.jsx';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { RouteNames, Roles } from '../../utils/constants.js';

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
  { id: 'read', label: 'Leídas' },
];

const LEVEL_BADGE = {
  info: 'accent',
  warning: 'warning',
  danger: 'danger',
  success: 'success',
};

const formatDateTime = (value) => {
  if (!value) return 'Hace un momento';
  try {
    return new Date(value).toLocaleString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return String(value);
  }
};

const EMPTY_META = { total: 0, page: 1, page_size: 10 };

export const Notifications = () => {
  const navigate = useNavigate();
  const { addToast } = useToastContext();
  const { hasRole } = useAuth();
  const { refresh: refreshSummary } = useNotifications();

  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const pageSize = meta?.page_size ?? 10;

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchValue.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchValue]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta: responseMeta } = await notificationService.list({
        page,
        pageSize,
        status,
        search: searchTerm,
      });
      setNotifications(Array.isArray(data) ? data : []);
      setMeta(responseMeta ?? { ...EMPTY_META, page, page_size: pageSize });
    } catch (error) {
      console.error('No se pudieron obtener las notificaciones', error);
      addToast({
        title: 'No se pudieron obtener las notificaciones',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
      setNotifications([]);
      setMeta({ ...EMPTY_META, page, page_size: pageSize });
    } finally {
      setLoading(false);
    }
  }, [addToast, page, pageSize, searchTerm, status]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const totalPages = useMemo(() => {
    if (!meta || !meta.page_size) return 1;
    return Math.max(1, Math.ceil((meta.total ?? 0) / meta.page_size));
  }, [meta]);

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const handleMarkNotification = async (notificationId, read) => {
    if (!notificationId) return;
    try {
      await notificationService.markAsRead(notificationId, read);
      await fetchNotifications();
      await refreshSummary();
      addToast({
        title: read ? 'Notificación marcada como leída' : 'Notificación marcada como no leída',
        status: 'success',
      });
    } catch (error) {
      console.error('No se pudo actualizar la notificación', error);
      addToast({
        title: 'No se pudo actualizar la notificación',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    }
  };

  const handleRemoveNotification = async (notificationId) => {
    if (!notificationId) return;
    try {
      await notificationService.remove(notificationId);
      await fetchNotifications();
      await refreshSummary();
      addToast({ title: 'Notificación eliminada', status: 'success' });
    } catch (error) {
      console.error('No se pudo eliminar la notificación', error);
      addToast({
        title: 'No se pudo eliminar la notificación',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    }
  };

  const handleMarkAll = async (read = true) => {
    try {
      await notificationService.markAll({ read });
      await fetchNotifications();
      await refreshSummary();
      addToast({
        title: read ? 'Todas las notificaciones fueron marcadas como leídas' : 'Actualización completa',
        status: 'success',
      });
    } catch (error) {
      console.error('No se pudieron actualizar las notificaciones', error);
      addToast({
        title: 'No se pudieron actualizar las notificaciones',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    }
  };

  const handleClear = async () => {
    try {
      await notificationService.clear();
      await fetchNotifications();
      await refreshSummary();
      addToast({ title: 'Notificaciones limpiadas', status: 'success' });
    } catch (error) {
      console.error('No se pudieron limpiar las notificaciones', error);
      addToast({
        title: 'No se pudieron limpiar las notificaciones',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    }
  };

  const handleViewEvent = async (notification) => {
    if (!notification?.evento?.id) return;
    await handleMarkNotification(notification.id, true);
    if (hasRole([Roles.ADMIN, Roles.COACH])) {
      navigate(`/admin/eventos/${notification.evento.id}/detalle`);
    } else if (hasRole([Roles.MANAGER])) {
      navigate(`${RouteNames.EVENT_REGISTRATION}?evento=${notification.evento.id}`);
    } else {
      navigate(RouteNames.DASHBOARD);
    }
  };

  const renderNotification = (notification) => {
    const badgeLevel = LEVEL_BADGE[(notification?.nivel ?? '').toLowerCase()] ?? 'neutral';
    const isUnread = notification?.leido === false;

    return (
      <div
        key={notification.id}
        className={`rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-sm transition dark:border-slate-700/60 dark:bg-slate-900/70 ${
          isUnread ? 'ring-2 ring-primary-200/60 dark:ring-primary-500/40' : ''
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge color={badgeLevel}>{notification?.tipo === 'evento' ? 'Evento' : 'General'}</Badge>
              {isUnread && <Badge color="accent">Nueva</Badge>}
            </div>
            <h4 className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {notification?.titulo ?? 'Notificación'}
            </h4>
            {notification?.mensaje && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{notification.mensaje}</p>
            )}
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {formatDateTime(notification?.creado_en)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveNotification(notification.id)}
            >
              <TrashIcon className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMarkNotification(notification.id, !notification.leido)}
            >
              <CheckIcon className="h-4 w-4" aria-hidden />
              {notification.leido ? 'Marcar como no leída' : 'Marcar como leída'}
            </Button>
          </div>
        </div>
        {notification?.evento && (
          <div className="mt-4 rounded-2xl border border-slate-200/60 bg-slate-100/60 p-4 text-sm dark:border-slate-700/60 dark:bg-slate-800/60">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{notification.evento.titulo}</p>
            <div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              {notification.evento.estado && <span>Estado: {notification.evento.estado}</span>}
              {notification.evento.deporte && <span>Deporte: {notification.evento.deporte}</span>}
              {notification.evento.fecha_inscripcion_inicio && (
                <span>Inicio inscripción: {notification.evento.fecha_inscripcion_inicio}</span>
              )}
              {notification.evento.fecha_inscripcion_fin && (
                <span>Cierre inscripción: {notification.evento.fecha_inscripcion_fin}</span>
              )}
            </div>
            <Button
              type="button"
              className="mt-3 inline-flex items-center gap-2"
              onClick={() => handleViewEvent(notification)}
            >
              <EyeIcon className="h-4 w-4" aria-hidden /> Ver evento
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Centro de notificaciones"
        description="Consulta todas las alertas enviadas por el sistema y gestiona su estado."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => handleMarkAll(true)}>
              <CheckIcon className="h-4 w-4" aria-hidden /> Marcar todo como leído
            </Button>
            <Button variant="danger" onClick={handleClear}>
              <TrashIcon className="h-4 w-4" aria-hidden /> Limpiar
            </Button>
          </div>
        )}
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Buscar notificaciones" />
         
        </div>
         <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const isActive = status === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleStatusChange(filter.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-500 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">Cargando notificaciones…</p>
        ) : notifications.length ? (
          <div className="space-y-4">{notifications.map(renderNotification)}</div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            No hay notificaciones para mostrar con los filtros seleccionados.
          </p>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </Card>
  );
};
