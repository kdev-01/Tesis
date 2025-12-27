import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { eventService } from '../../services/dataService.js';
import { useToastContext } from '../../context/ToastContext.jsx';

const formatPhaseLabel = (phase) => {
  switch ((phase ?? '').toLowerCase()) {
    case 'group':
      return 'Fase de grupos';
    case 'quarterfinal':
      return 'Cuartos de final';
    case 'semifinal':
      return 'Semifinal';
    case 'final':
      return 'Final';
    case 'third_place':
      return 'Tercer puesto';
    default:
      return 'Etapa por definir';
  }
};

const PHASE_COLORS = {
  group: 'neutral',
  quarterfinal: 'accent',
  semifinal: 'warning',
  final: 'primary',
  third_place: 'success',
};

const formatDateTime = (fecha, horaInicio, horaFin) => {
  try {
    if (!fecha) return 'Por definir';
    const dateInstance = new Date(`${fecha}T${horaInicio ?? '00:00:00'}`);
    const dateLabel = dateInstance.toLocaleDateString();
    if (!horaInicio) return dateLabel;
    const startLabel = dateInstance.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (!horaFin) {
      return `${dateLabel} · ${startLabel}`;
    }
    const endInstance = new Date(`${fecha}T${horaFin}`);
    const endLabel = endInstance.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateLabel} · ${startLabel} - ${endLabel}`;
  } catch (error) {
    return `${fecha ?? ''} ${horaInicio ?? ''}`.trim() || 'Por definir';
  }
};

const resolveTeamName = (team, placeholder) => team?.nombre_equipo ?? placeholder ?? 'Equipo por definir';

export const RepresentativeFixture = () => {
  const { addToast } = useToastContext();
  const [invitations, setInvitations] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [matches, setMatches] = useState([]);

  const fetchInvitations = async () => {
    try {
      const data = await eventService.listMyInvitations();
      setInvitations(Array.isArray(data) ? data : []);
      const championshipEvents = data?.filter((item) => item.habilitado_campeonato) ?? [];
      if (!selectedEventId && championshipEvents.length > 0) {
        setSelectedEventId(championshipEvents[0].evento_id ?? null);
      }
    } catch (error) {
      console.error('No se pudieron cargar las invitaciones', error);
      addToast({ title: 'Error al cargar eventos', description: error.message, status: 'error' });
    }
  };

  const fetchFixture = async (eventId) => {
    if (!eventId) {
      setMatches([]);
      return;
    }
    try {
      setLoadingFixture(true);
      const { matches } = await eventService.getSchedule(eventId);
      setMatches(Array.isArray(matches) ? matches : []);
    } catch (error) {
      console.error('No se pudo cargar el calendario', error);
      addToast({ title: 'Error al cargar calendario', description: error.message, status: 'error' });
    } finally {
      setLoadingFixture(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEventId) {
      fetchFixture(selectedEventId);
    }
  }, [selectedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventOptions = useMemo(
    () =>
      invitations
        .filter((item) => item.habilitado_campeonato)
        .map((item) => ({
          value: item.evento_id,
          label: item.titulo,
          description: 'Calendario habilitado',
        })),
    [invitations],
  );

  const groupedMatches = useMemo(() => {
    return matches.reduce((acc, match) => {
      const key = match.fecha ?? 'Por definir';
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});
  }, [matches]);

  if (!eventOptions.length) {
    return (
      <Card>
        <CardHeader title="Calendario del campeonato" />
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Aún no tienes calendarios disponibles. Cuando tu institución sea aprobada para el campeonato, el fixture aparecerá
          aquí.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Calendario del campeonato"
        description="Consulta la programación oficial de tus encuentros." />
      <div className="space-y-6">
        <Select
          label="Selecciona un evento"
          options={eventOptions}
          value={selectedEventId}
          onChange={(value) => setSelectedEventId(value ? Number(value) : null)}
        />
        {loadingFixture ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">Cargando calendario…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Aún no se han programado partidos para este evento.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMatches).map(([dateKey, dayMatches]) => (
              <div key={dateKey} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge color="primary">{dateKey === 'Por definir' ? 'Por definir' : new Date(dateKey).toLocaleDateString()}</Badge>
                </div>
                <div className="grid gap-4">
                  {dayMatches.map((match) => {
                    const homeName = resolveTeamName(match.equipo_local, match.placeholder_local);
                    const awayName = resolveTeamName(match.equipo_visitante, match.placeholder_visitante);
                    const phaseKey = (match?.fase ?? '').toLowerCase();
                    const phaseColor = PHASE_COLORS[phaseKey] ?? 'neutral';
                    const estadoPartido = (match?.estado ?? '').toLowerCase();
                    return (
                      <div
                        key={match.id}
                        className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                              {homeName} vs {awayName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              {match.categoria?.nombre ?? 'Categoría por definir'} ·{' '}
                              {match.ronda ?? 'Ronda general'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge color="accent">
                              {formatDateTime(match.fecha, match.hora, match.hora_fin)}
                            </Badge>
                            {estadoPartido && estadoPartido !== 'programado' && (
                              <Badge color={estadoPartido === 'completado' ? 'success' : 'neutral'}>
                                {match.estado}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                          {match.fase && (
                            <Badge color={phaseColor}>{formatPhaseLabel(match.fase)}</Badge>
                          )}
                          {match.serie && <Badge color="neutral">{match.serie}</Badge>}
                          {match.llave && <Badge color="neutral">Llave {match.llave}</Badge>}
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                          <p>
                            Escenario: {match.escenario_nombre ?? 'Por confirmar'}
                          </p>
                          {match.observaciones && <p>Notas: {match.observaciones}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
