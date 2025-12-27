import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellIcon,
  CheckIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { RouteNames, Roles } from '../../utils/constants.js';

const LEVEL_STYLES = {
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
};

const formatDateTime = (value) => {
  if (!value) return 'Hace un momento';
  try {
    return new Date(value).toLocaleString('es-EC', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return String(value);
  }
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();
  const {
    recent,
    unreadCount,
    markAsRead,
    markAllAsRead,
    remove,
    clear,
    refresh,
    loading,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const notifications = useMemo(
    () => (Array.isArray(recent) ? recent : []),
    [recent],
  );

  const toggleDropdown = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void refresh();
    }
  };

  const handleViewEvent = async (notification) => {
    if (!notification?.evento?.id) return;
    const eventId = notification.evento.id;
    await markAsRead(notification.id, true);
    setOpen(false);
    if (hasRole([Roles.ADMIN, Roles.COACH])) {
      navigate(`/admin/eventos/${eventId}/detalle`);
    } else if (hasRole([Roles.MANAGER])) {
      navigate(`${RouteNames.EVENT_REGISTRATION}?evento=${eventId}`);
    } else {
      navigate(RouteNames.DASHBOARD);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(RouteNames.NOTIFICATIONS);
  };

  const renderNotification = (notification) => {
    const levelClass = LEVEL_STYLES[(notification?.nivel ?? '').toLowerCase()] ??
      'bg-primary-500/10 text-primary-700 dark:bg-primary-400/10 dark:text-primary-200';
    const isUnread = notification?.leido === false;

    return (
      <li
        key={notification.id}
        className={`rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm shadow-sm transition dark:border-slate-700/70 dark:bg-slate-900/60 ${
          isUnread ? 'ring-2 ring-primary-300/60 dark:ring-primary-500/40' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${levelClass}`}>
            {notification?.tipo === 'evento' ? 'Evento' : 'Notificación'}
          </span>
          <button
            type="button"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:text-primary-600"
            onClick={() => remove(notification.id)}
            aria-label="Eliminar notificación"
          >
            <TrashIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {notification?.titulo ?? 'Notificación'}
        </p>
        {notification?.mensaje && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{notification.mensaje}</p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {formatDateTime(notification?.creado_en)}
        </p>
        {notification?.evento && (
          <div className="mt-3 rounded-2xl bg-slate-100/70 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {notification.evento.titulo}
            </p>
            {notification.evento.estado && (
              <p>Estado: {notification.evento.estado}</p>
            )}
            {notification.evento.deporte && <p>Deporte: {notification.evento.deporte}</p>}
            {(notification.evento.fecha_inscripcion_inicio || notification.evento.fecha_inscripcion_fin) && (
              <p>
                Inscripción: {notification.evento.fecha_inscripcion_inicio || 'N/D'} —{' '}
                {notification.evento.fecha_inscripcion_fin || 'N/D'}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleViewEvent(notification)}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-600"
            >
              <EyeIcon className="h-4 w-4" aria-hidden /> Ver evento
            </button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => markAsRead(notification.id, !notification.leido)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <CheckIcon className="h-4 w-4" aria-hidden />
            {notification.leido ? 'Marcar como no leída' : 'Marcar como leída'}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
        aria-label="Notificaciones"
      >
        <BellIcon className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-semibold text-white shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-3 w-96 max-w-sm rounded-3xl border border-slate-200/70 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Notificaciones</p>
            <button
              type="button"
              className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-300"
              onClick={handleViewAll}
            >
              Ver todas
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-800 dark:text-slate-200"
              onClick={() => markAllAsRead(true)}
            >
              <CheckIcon className="h-4 w-4" aria-hidden /> Marcar todo como leído
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-200"
              onClick={() => clear()}
            >
              <TrashIcon className="h-4 w-4" aria-hidden /> Limpiar
            </button>
          </div>
          <div className="mt-4 max-h-80 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Cargando notificaciones…</p>
            ) : notifications.length ? (
              <ul className="space-y-3">{notifications.map(renderNotification)}</ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                No tienes notificaciones recientes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
