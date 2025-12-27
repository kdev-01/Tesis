import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { RouteNames } from '../../utils/constants.js';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { buildQueryString } from '../../services/httpClient.js';

const ENTITY_LABELS = {
  instituciones: 'Instituciones',
  estudiantes: 'Estudiantes',
  usuarios: 'Usuarios',
  escenarios: 'Escenarios',
  torneos: 'Eventos',
  sesiones: 'Sesiones',
};

const SEVERITY_CLASSES = {
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100',
  info: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-100',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
};

const HISTORY_PAGE_SIZE = 12;

const HISTORY_SEVERITY_LABELS = {
  danger: 'Crítico',
  warning: 'Alerta',
  info: 'Informativo',
  success: 'Éxito',
};

const DEFAULT_HISTORY_SEVERITIES = ['danger', 'warning', 'info', 'success'];

const EVENT_STATUS_CONFIG = {
  borrador: {
    label: 'Planificación',
    color: 'neutral',
    description: 'Eventos en etapa de preparación y coordinación inicial.',
  },
  inscripcion: {
    label: 'Inscripción abierta',
    color: 'accent',
    description: 'Recibiendo postulaciones y confirmando participantes.',
  },
  auditoria: {
    label: 'Auditoría',
    color: 'warning',
    description: 'Revisión y validación de documentación enviada.',
  },
  campeonato: {
    label: 'En campeonato',
    color: 'success',
    description: 'Competencias y llaves activas en progreso.',
  },
  finalizado: {
    label: 'Finalizados',
    color: 'primary',
    description: 'Eventos concluidos y con resultados publicados.',
  },
  archivado: {
    label: 'Archivados',
    color: 'neutral',
    description: 'Histórico disponible para consulta.',
  },
};

const ACTIVE_EVENT_STATES = ['borrador', 'inscripcion', 'auditoria', 'campeonato'];

const STATUS_BAR_CLASS = {
  primary: 'bg-primary-500',
  accent: 'bg-cyan-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  neutral: 'bg-slate-400',
};

const formatDate = (value) => {
  try {
    return new Date(value ?? Date.now()).toLocaleDateString();
  } catch (error) {
    return '—';
  }
};

const formatDateTime = (value) => {
  try {
    return new Date(value ?? Date.now()).toLocaleString();
  } catch (error) {
    return '—';
  }
};

const formatMetadataValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

export const Dashboard = () => {
  const {
    data: eventsData = [],
    meta: eventsMeta,
    loading: loadingEvents,
  } = useFetchWithAuth('/events/?page_size=200');
  const {
    data: usersData = [],
    meta: usersMeta,
    loading: loadingUsers,
  } = useFetchWithAuth('/users/?page_size=1');
  const [historyFilters, setHistoryFilters] = useState({
    search: '',
    severity: null,
    entity: null,
    order: 'desc',
    page: 1,
  });

  const historyQuery = useMemo(() => {
    const query = buildQueryString({
      page: historyFilters.page,
      page_size: HISTORY_PAGE_SIZE,
      search: historyFilters.search?.trim() || undefined,
      severidad: historyFilters.severity || undefined,
      entidad: historyFilters.entity || undefined,
      order: historyFilters.order,
    });
    return `/history/${query}`;
  }, [historyFilters]);

  const {
    data: historyData = [],
    meta: historyMeta,
    loading: loadingHistory,
    refetch: refetchHistory,
  } = useFetchWithAuth(historyQuery);
  const { user, hasPermission, hasRole } = useAuth();

  const events = useMemo(() => (Array.isArray(eventsData) ? eventsData : []), [eventsData]);
  const eventsMetaTotal = eventsMeta?.total;
  const totalEvents = eventsMetaTotal ?? events.length;
  const usersMetaTotal = usersMeta?.total;
  const totalUsers = useMemo(
    () => usersMetaTotal ?? (Array.isArray(usersData) ? usersData.length : 0),
    [usersMetaTotal, usersData],
  );

  const eventsByStatus = useMemo(() => {
    const counters = Object.fromEntries(
      Object.keys(EVENT_STATUS_CONFIG).map((state) => [state, 0]),
    );
    events.forEach((event) => {
      const state = String(event?.estado ?? '').toLowerCase();
      if (state in counters) {
        counters[state] += 1;
      } else {
        counters[state] = (counters[state] ?? 0) + 1;
      }
    });
    return counters;
  }, [events]);

  const otherStatusCount = useMemo(
    () =>
      Object.entries(eventsByStatus).reduce((sum, [state, value]) => {
        if (state in EVENT_STATUS_CONFIG) {
          return sum;
        }
        return sum + (value ?? 0);
      }, 0),
    [eventsByStatus],
  );

  const activeEventsCount = useMemo(
    () => ACTIVE_EVENT_STATES.reduce((sum, state) => sum + (eventsByStatus[state] ?? 0), 0),
    [eventsByStatus],
  );

  const eventStatusEntries = useMemo(() => {
    const base = Object.entries(EVENT_STATUS_CONFIG).map(([state, config]) => {
      const count = eventsByStatus[state] ?? 0;
      const percent = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
      return { state, ...config, count, percent };
    });
    if (otherStatusCount > 0) {
      const percent = totalEvents > 0 ? Math.round((otherStatusCount / totalEvents) * 100) : 0;
      base.push({
        state: 'otros',
        label: 'Otros estados',
        color: 'neutral',
        description: 'Incluye estados personalizados o registros históricos.',
        count: otherStatusCount,
        percent,
      });
    }
    return base;
  }, [eventsByStatus, otherStatusCount, totalEvents]);

  const stats = useMemo(() => {
    const formattedActive = loadingEvents ? '—' : activeEventsCount.toLocaleString();
    const formattedUsers = loadingUsers ? '—' : totalUsers.toLocaleString();
    const ratio =
      loadingEvents || loadingUsers || activeEventsCount === 0
        ? '—'
        : `${Math.max(1, Math.round(totalUsers / Math.max(activeEventsCount, 1)))}:1`;
    return [
      {
        title: 'Eventos activos',
        value: formattedActive,
        description: 'Campeonatos abiertos en la federación',
      },
      {
        title: 'Usuarios registrados',
        value: formattedUsers,
        description: 'Personal operativo y administrativo',
      },
      {
        title: 'Ratio staff/evento',
        value: ratio,
        description: 'Colaboradores por evento activo',
      },
    ];
  }, [activeEventsCount, loadingEvents, loadingUsers, totalUsers]);

  const upcomingEvents = useMemo(() => {
    if (events.length === 0) {
      return [];
    }
    const now = Date.now();
    return events
      .map((event) => {
        const candidateDates = [
          event.fecha_campeonato_inicio,
          event.fecha_inscripcion_inicio,
          event.fecha_auditoria_inicio,
          event.fecha_campeonato_fin,
          event.fecha_inscripcion_fin,
        ]
          .map((value) => (value ? new Date(value) : null))
          .filter((date) => date && !Number.isNaN(date.getTime()));
        const first = candidateDates.length
          ? candidateDates.sort((a, b) => a.getTime() - b.getTime())[0]
          : null;
        return {
          ...event,
          start_date: first ? first.toISOString() : null,
        };
      })
      .filter((event) => {
        if (!event.start_date) return false;
        const time = new Date(event.start_date).getTime();
        return !Number.isNaN(time) && time >= now - 86_400_000; // considera eventos recientes
      })
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(0, 6);
  }, [events]);

  const historyRecords = useMemo(
    () => (Array.isArray(historyData) ? historyData : []),
    [historyData],
  );

  const severityOptions = useMemo(() => {
    const extras = Array.isArray(historyMeta?.extra?.severidades)
      ? historyMeta.extra.severidades.filter(Boolean)
      : [];
    const values = [...DEFAULT_HISTORY_SEVERITIES];
    extras.forEach((value) => {
      if (value && !values.includes(value)) {
        values.push(value);
      }
    });
    return values.map((value) => ({
      value,
      label: HISTORY_SEVERITY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1),
    }));
  }, [historyMeta]);

  const entityOptions = useMemo(() => {
    const options = Array.isArray(historyMeta?.extra?.entidades) ? historyMeta.extra.entidades : [];
    return options.map((value) => ({
      value,
      label: ENTITY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1),
    }));
  }, [historyMeta]);

  const totalHistory = historyMeta?.total ?? historyRecords.length ?? 0;
  const currentHistoryPage = historyMeta?.page ?? historyFilters.page;
  const historyPageSize = historyMeta?.page_size ?? HISTORY_PAGE_SIZE;
  const totalHistoryPages = totalHistory > 0 ? Math.max(1, Math.ceil(totalHistory / historyPageSize)) : 1;
  const historyRangeStart = totalHistory === 0 ? 0 : (currentHistoryPage - 1) * historyPageSize + 1;
  const historyRangeEnd =
    totalHistory === 0
      ? 0
      : Math.min(totalHistory, historyRangeStart + Math.max(historyRecords.length, 1) - 1);

  useEffect(() => {
    if (historyMeta?.page && historyMeta.page !== historyFilters.page) {
      setHistoryFilters((prev) => ({ ...prev, page: historyMeta.page }));
    }
  }, [historyMeta?.page, historyFilters.page]);

  const handleHistorySearch = useCallback((value) => {
    setHistoryFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleSeverityChange = useCallback((value) => {
    setHistoryFilters((prev) => ({ ...prev, severity: value || null, page: 1 }));
  }, []);

  const handleEntityChange = useCallback((value) => {
    setHistoryFilters((prev) => ({ ...prev, entity: value || null, page: 1 }));
  }, []);

  const toggleHistoryOrder = useCallback(() => {
    setHistoryFilters((prev) => ({ ...prev, order: prev.order === 'desc' ? 'asc' : 'desc', page: 1 }));
  }, []);

  const handleHistoryPageChange = useCallback((page) => {
    setHistoryFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleClearHistoryFilters = useCallback(() => {
    setHistoryFilters({ search: '', severity: null, entity: null, order: 'desc', page: 1 });
  }, []);

  const hasActiveHistoryFilters = Boolean(
    historyFilters.search?.trim() || historyFilters.severity || historyFilters.entity || historyFilters.order !== 'desc',
  );

  const quickActions = useMemo(() => {
    const actions = [];
    if (hasPermission(['manage_users', 'manage_permissions'])) {
      actions.push({ label: 'Gestionar usuarios', to: '/admin/usuarios', description: 'Crear, editar o invitar miembros nuevos.' });
    }
    if (hasPermission('manage_roles')) {
      actions.push({ label: 'Roles y permisos', to: RouteNames.ROLES, description: 'Define accesos por módulos.' });
    }
    if (hasPermission(['manage_events']) || hasRole(['Representante de comisión'])) {
      actions.push({ label: 'Eventos', to: '/admin/eventos', description: 'Planifica calendarios y llaves de juego.' });
    }
    if (hasPermission(['manage_institutions']) || hasRole(['Representante educativo'])) {
      actions.push({ label: 'Instituciones', to: '/admin/instituciones', description: 'Actualiza datos académicos y delegados.' });
    }
    return actions;
  }, [hasPermission, hasRole]);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-r from-primary-500 via-primary-500/90 to-accent/90 p-8 text-white shadow-xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-sm uppercase tracking-widest text-white/70">Panel deportivo</p>
          <h2 className="mt-3 text-3xl font-display">
            ¡Hola {user?.nombre_completo?.split(' ')[0] ?? 'equipo'}! Tus métricas se actualizan en tiempo real.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Revisa la agenda de competencias y coordina a tu equipo desde un único lugar.
          </p>
        </motion.div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <motion.div
            key={stat.title}
            className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-slate-100 dark:bg-slate-900/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-sm uppercase tracking-widest text-slate-500">{stat.title}</p>
            <p className="mt-4 text-4xl font-display text-primary-600">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{stat.description}</p>
          </motion.div>
        ))}
      </section>

      <Card>
        <CardHeader
          title="Estados de eventos"
          description="Monitorea cuántos campeonatos tienes en cada fase y detecta cuellos de botella con anticipación."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {eventStatusEntries.map((status) => (
            <div
              key={status.state}
              className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{status.label}</p>
                  <p className="mt-3 text-3xl font-display text-primary-600">
                    {loadingEvents ? '—' : status.count.toLocaleString()}
                  </p>
                </div>
                <Badge color={status.color ?? 'neutral'}>
                  {loadingEvents || totalEvents === 0 ? '0%' : `${status.percent}%`}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{status.description}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${STATUS_BAR_CLASS[status.color] ?? STATUS_BAR_CLASS.neutral}`}
                  style={{
                    width:
                      loadingEvents || totalEvents === 0
                        ? '0%'
                        : `${Math.min(100, Math.max(0, status.percent))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Próximos eventos" description="Supervisa los eventos agendados para las próximas semanas." />
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingEvents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay eventos programados. Puedes crear uno desde la sección de eventos.
              </p>
            ) : (
              upcomingEvents.map((event) => {
                const statusKey = String(event.estado ?? '').toLowerCase();
                const statusConfig = EVENT_STATUS_CONFIG[statusKey];
                const statusLabel = statusConfig?.label ?? event.estado ?? 'Planificado';
                return (
                  <div key={event.id} className="rounded-2xl border border-slate-100 p-4 shadow-sm dark:border-slate-800">
                    <p className="text-xs uppercase tracking-wide text-primary-500">{formatDate(event.start_date)}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{event.name ?? event.titulo}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {event.sport?.name ?? event.deporte ?? 'Multideporte'}
                    </p>
                    <Badge className="mt-3 inline-flex" color={statusConfig?.color ?? 'neutral'}>
                      {statusLabel}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Accesos rápidos" description="Llega más rápido a los módulos que usas a diario." />
          <div className="space-y-3">
            {quickActions.length === 0 && (
              <p className="text-sm text-slate-500">No tienes acciones directas disponibles con tu rol actual.</p>
            )}
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex flex-col rounded-2xl border border-slate-100 p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/60 dark:border-slate-800 dark:hover:border-primary-500/60 dark:hover:bg-primary-500/10"
              >
                <span className="text-sm font-semibold text-primary-600">{action.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-300">{action.description}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Historial de actividad"
          description="Consulta los últimos movimientos registrados en la plataforma."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleHistoryOrder}
                className="text-slate-600 hover:bg-slate-100/80 dark:text-slate-200"
              >
                {historyFilters.order === 'desc' ? 'Recientes primero' : 'Antiguos primero'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchHistory()}
                disabled={loadingHistory}
                className="text-slate-600 hover:bg-slate-100/80 dark:text-slate-200"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Actualizar
              </Button>
            </div>
          }
        />
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-[220px] flex-1">
                <SearchInput
                  value={historyFilters.search}
                  onChange={handleHistorySearch}
                  placeholder="Buscar por descripción, actor o entidad"
                  label="Buscar en historial"
                />
              </div>
              <div className="md:w-52">
                <Select
                  label="Entidad"
                  value={historyFilters.entity}
                  onChange={handleEntityChange}
                  options={entityOptions}
                  placeholder="Todas las entidades"
                  clearable
                />
              </div>
              <div className="md:w-52">
                <Select
                  label="Severidad"
                  value={historyFilters.severity}
                  onChange={handleSeverityChange}
                  options={severityOptions}
                  placeholder="Todas las severidades"
                  clearable
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistoryFilters}
                disabled={!hasActiveHistoryFilters}
                className="text-slate-600 hover:bg-slate-100/80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {loadingHistory ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Cargando historial…
              </p>
            ) : historyRecords.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Aún no hay eventos registrados en el historial.
              </p>
            ) : (
              historyRecords.map((event) => {
                const severityClass =
                  SEVERITY_CLASSES[event.severidad] ??
                  'bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
                const metadataEntries = Object.entries(event.metadata ?? {}).filter(([, value]) => {
                  if (value === null || value === undefined) return false;
                  if (typeof value === 'string') return value.trim().length > 0;
                  if (Array.isArray(value)) return value.length > 0;
                  if (typeof value === 'object') return Object.keys(value).length > 0;
                  return true;
                });
                return (
                  <article
                    key={event.id}
                    className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-400" aria-hidden />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                          {ENTITY_LABELS[event.entidad] ?? event.entidad ?? 'Sin entidad'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 ${severityClass}`}>
                          {(event.severidad ?? 'info').toUpperCase()}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                          {formatDateTime(event.registrado_en)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {event.descripcion ?? event.accion ?? 'Movimiento registrado'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                        {event.actor_nombre && <span>Por {event.actor_nombre}</span>}
                        {event.accion && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                            {event.accion}
                          </span>
                        )}
                        {metadataEntries.map(([key, value]) => (
                          <span
                            key={`${event.id}-${key}`}
                            className="rounded-full bg-slate-50 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-200"
                          >
                            {`${key}: ${formatMetadataValue(value)}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
            <p>
              {totalHistory === 0
                ? 'Sin movimientos registrados.'
                : `Mostrando ${historyRangeStart.toLocaleString()}–${historyRangeEnd.toLocaleString()} de ${totalHistory.toLocaleString()} actividades`}
            </p>
            <Pagination
              page={currentHistoryPage}
              totalPages={totalHistoryPages}
              onPageChange={handleHistoryPageChange}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
