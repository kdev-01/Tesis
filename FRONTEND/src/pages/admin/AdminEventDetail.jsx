import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EnvelopeIcon,
  EyeIcon,
  NewspaperIcon,
  PresentationChartBarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { eventService, institutionService } from '../../services/dataService.js';
import { EventAuditPanel } from '../../components/events/EventAuditPanel.jsx';
import { useToastContext } from '../../context/ToastContext.jsx';
import { resolveMediaUrl } from '../../utils/media.js';
import { Modal } from '../../components/ui/Modal.jsx';

const formatDate = (value) => {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

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

const PHASE_BADGE_COLORS = {
  group: 'neutral',
  quarterfinal: 'accent',
  semifinal: 'warning',
  final: 'primary',
  third_place: 'success',
};

const formatDateTime = (dateValue, timeValue, endTimeValue) => {
  try {
    if (!dateValue) return 'N/D';
    const date = new Date(dateValue);
    const formatter = new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const datePart = formatter.format(date);
    if (!timeValue) return datePart;
    const [startHours, startMinutes] = timeValue.split(':').map(Number);
    const startTime = Number.isNaN(startHours)
      ? null
      : `${String(startHours).padStart(2, '0')}:${String(startMinutes ?? 0).padStart(2, '0')}`;
    let endTime = null;
    if (endTimeValue) {
      const [endHours, endMinutes] = endTimeValue.split(':').map(Number);
      if (!Number.isNaN(endHours)) {
        endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes ?? 0).padStart(2, '0')}`;
      }
    }
    if (startTime && endTime) {
      return `${datePart} · ${startTime} - ${endTime}`;
    }
    if (startTime) {
      return `${datePart} · ${startTime}`;
    }
    return datePart;
  } catch (error) {
    return 'N/D';
  }
};

const toInputDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch (error) {
    return '';
  }
};

const formatStage = (stage) => {
  switch ((stage ?? '').toLowerCase()) {
    case 'borrador':
      return 'Etapa de planificación';
    case 'inscripcion':
      return 'Etapa de inscripción';
    case 'auditoria':
      return 'Etapa de auditoría';
    case 'campeonato':
      return 'Etapa de campeonato';
    case 'finalizado':
      return 'Evento finalizado';
    case 'archivado':
      return 'Evento archivado';
    default:
      return 'Etapa no disponible';
  }
};

const STAGE_BADGE_COLORS = {
  borrador: 'neutral',
  inscripcion: 'accent',
  auditoria: 'warning',
  campeonato: 'success',
  finalizado: 'neutral',
  archivado: 'neutral',
};

const REGISTRATION_FILTER_OPTIONS = [
  { value: 'todas', label: 'Todas las instituciones' },
  { value: 'aceptada', label: 'Aceptadas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'rechazada', label: 'Rechazadas' },
];

const TABS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'registration', label: 'Inscripción' },
  { id: 'audit', label: 'Auditoría' },
  { id: 'championship', label: 'Campeonato' },
];

// Configuración de campos para el MVP
// Configuración de campos para el MVP
const MVP_TABS = [
  { id: 'general', label: 'General', icon: null },
  { id: 'attack', label: 'Ataque', icon: null },
  { id: 'distribution', label: 'Distribución', icon: null },
  { id: 'defense', label: 'Defensa', icon: null },
  { id: 'keeper', label: 'Portero', icon: null },
];

const MVP_FIELDS_CONFIG = [
  { 
    tab: 'general',
    section: 'Info', 
    fields: ['role_selection'], // Campo virtual para el dropdown
    type: 'select', 
    options: [
        { value: '', label: 'Seleccionar...' },
        { value: 'role_Keeper', label: 'Portero' },
        { value: 'role_Defender', label: 'Defensa' },
        { value: 'role_Midfielder', label: 'Mediocampo' },
        { value: 'role_Attacker', label: 'Delantero' },
    ]
  },
  { tab: 'general', section: 'Resumen', fields: ['rating'], type: 'number', readOnly: true },
  { tab: 'general', section: 'Rendimiento', fields: ['minutes_played', 'goals', 'assists', 'was_fouled'], type: 'number' },
  
  { tab: 'attack', section: 'Disparos', fields: ['total_shots', 'shot_on_target', 'shot_off_target', 'blocked_shots'], type: 'number' },
  { tab: 'attack', section: 'Oportunidades', fields: ['shot_accuracy', 'chances_created'], type: 'number' },

  { tab: 'distribution', section: 'Pases', fields: ['touches', 'pass_success', 'key_passes'], type: 'number' },
  { tab: 'distribution', section: 'Juego', fields: ['crosses', 'dribbles_succeeded'], type: 'number' },

  { tab: 'defense', section: 'Entradas', fields: ['tackles_attempted', 'tackles_succeeded', 'interceptions', 'recoveries'], type: 'number' },
  { tab: 'defense', section: 'Duelos', fields: ['duels_won', 'aerials_won'], type: 'number' },

  { tab: 'keeper', section: 'Paradas', fields: ['saves', 'saves_inside_box', 'diving_save'], type: 'number' },
  { tab: 'keeper', section: 'Juego Aéreo', fields: ['punches', 'throws', 'goals_conceded'], type: 'number' },

  { type: 'hidden', fields: ['mvp'], value: false },
  // Campos reales ocultos para mapeo
  { type: 'hidden', fields: ['role_Keeper', 'role_Defender', 'role_Midfielder', 'role_Attacker'], value: false } 
];

// Función helper para aplanar la estructura de campos para la tabla
const FLAT_FIELDS = MVP_FIELDS_CONFIG.flatMap(g => g.type !== 'hidden' ? g.fields.map(f => ({ key: f, type: g.type, section: g.section, readOnly: g.readOnly })) : []);

export const AdminEventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToastContext();
  const numericEventId = Number(eventId) || null;

  const [activeTab, setActiveTab] = useState('summary');
  const [eventData, setEventData] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleMeta, setScheduleMeta] = useState(null);
  const [institutionsLoaded, setInstitutionsLoaded] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState(null);
  const [registrationFilter, setRegistrationFilter] = useState('todas');
  const [sendingNotifications, setSendingNotifications] = useState({});
  const [removingInstitutions, setRemovingInstitutions] = useState({});
  const [selectableInstitutions, setSelectableInstitutions] = useState([]);
  const [loadingSelectableInstitutions, setLoadingSelectableInstitutions] = useState(false);
  const [addInstitutionModal, setAddInstitutionModal] = useState({ open: false, selected: null });
  const [addingInstitution, setAddingInstitution] = useState(false);
  const [scheduleFilters, setScheduleFilters] = useState({
    fase: 'todas',
    serie: 'todas',
    cancha: 'todas',
    fecha: 'todas',
  });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    horaInicio: '',
    horaFin: '',
    duracionHoras: '',
    descansoMinDias: '',
    force: false,
  });
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [teamPreview, setTeamPreview] = useState({ open: false, team: null, stats: null });
  const [resultModal, setResultModal] = useState({
    open: false,
    match: null,
    localScore: '',
    visitorScore: '',
    winnerId: null,
    criterio: 'puntos',
    publishNews: true,
    submitting: false,
    loadingPlayers: false,
    playersConfig: null,
    playerStats: {},
  });
  const [publishingNewsId, setPublishingNewsId] = useState(null);
  const [standingsModal, setStandingsModal] = useState({
    open: false,
    loading: false,
    tables: [],
  });
  const [timelineModal, setTimelineModal] = useState({ open: false, values: {} });
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [performanceModal, setPerformanceModal] = useState({ open: false, match: null });
  const [savingPerformance, setSavingPerformance] = useState(false);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [activePerformanceTab, setActivePerformanceTab] = useState('general');
  const [playersStats, setPlayersStats] = useState([]);

  // Cargar datos (Sin Backend - Solo Mock Inicial)
  useEffect(() => {
    if (performanceModal.open && performanceModal.match) {
      setActivePerformanceTab('general'); // Reset tab
      loadPerformanceData();
    } else {
      setPlayersStats([]); // Limpiar al cerrar
    }
  }, [performanceModal.open, performanceModal.match]);

  const loadPerformanceData = useCallback(async () => {
    setLoadingPerformance(true);
    try {
        const match = performanceModal.match;
        // 1. Obtener datos existentes del backend
        const existingData = await eventService.getMatchPerformance(match.id);

        console.log("Existing Data:", existingData);
        
        const dataMap = new Map(existingData.map(d => [d.id_estudiante, d]));

        // 2. Mapear jugadores del partido
         const localPlayers = (match.equipo_local?.estudiantes ?? []).map(p => ({
          ...p, team: match.equipo_local?.nombre_equipo, isLocal: true
        }));
        const visitorPlayers = (match.equipo_visitante?.estudiantes ?? []).map(p => ({
          ...p, team: match.equipo_visitante?.nombre_equipo, isLocal: false
        }));
        
        const allPlayers = [...localPlayers, ...visitorPlayers];

        // 3. Mezclar estructura base con datos existentes
        const mergedStats = allPlayers.map((student, index) => {
          const stats = {};
          // Correctly get student ID from enrollment object BEFORE lookup
          const studentId = student.estudiante?.id ?? student.id; 
          
          
          const existing = dataMap.get(studentId);
          
          if (index === 0) { // Log only first one using index
             console.log("DEBUG: loadPerformanceData studentId lookup", {
                 studentName: student.nombres,
                 derivedStudentId: studentId,
                 enrollmentId: student.id,
                 estudianteObjId: student.estudiante?.id,
                 foundInMap: !!existing,
                 mapKeys: Array.from(dataMap.keys())
             });
          }

          MVP_FIELDS_CONFIG.forEach(group => {
              group.fields.forEach(f => {
                  if (f === 'role_selection') return; // Skip virtual field
                  if (existing && existing[f] !== undefined) {
                      stats[f] = existing[f];
                  } else {
                      if (group.type === 'checkbox') stats[f] = false;
                      else if (group.type === 'number') stats[f] = 0;
                  }
              });
          });
          
          // Determine Role Selection
          let selectedRole = '';
          if (stats['role_Keeper']) selectedRole = 'role_Keeper';
          else if (stats['role_Defender']) selectedRole = 'role_Defender';
          else if (stats['role_Midfielder']) selectedRole = 'role_Midfielder';
          else if (stats['role_Attacker']) selectedRole = 'role_Attacker';
          stats.role_selection = selectedRole;
          
          // MVP Flag
          stats.mvp = existing?.mvp ?? false;
          
          return {
            id: studentId,
            nombre: `${student.nombres} ${student.apellidos}`,
            team: student.team,
            isLocal: student.isLocal,
            ...stats
          };
        });

        setPlayersStats(mergedStats);
    } catch (err) {
        addToast({ title: 'Error cargando datos', description: err.message, status: 'error' });
    } finally {
        setLoadingPerformance(false);
    }
  }, [performanceModal.match, addToast]);

  const handlePerformanceStatChange = (id, field, value, type) => {
    const finalValue = type === 'checkbox' ? value : (type === 'select' ? value : Number(value));
    setPlayersStats(prev => prev.map(p => {
      if (p.id !== id) return p;

      // Handle Role Selection Dropdown
      if (field === 'role_selection') {
          const roles = ['role_Attacker', 'role_Defender', 'role_Keeper', 'role_Midfielder'];
          const updates = { role_selection: value };
          roles.forEach(r => {
              updates[r] = (r === value); // Set true only if matches selection
          });
          return { ...p, ...updates };
      }

      const newStats = { ...p, [field]: finalValue };
      return newStats;
    }));
  };

  const handleSavePerformance = async () => {
    if (!performanceModal.match) return;
    setSavingPerformance(true);
    try {
        const payload = playersStats.map(p => {
            // Mapear al esquema del backend
            const { id, nombre, team, isLocal, role_selection, ...rest } = p;
            return {
                id_estudiante: id,
                ...rest
            };
        });

        await eventService.saveMatchPerformance(performanceModal.match.id, payload);
        addToast({ title: 'Datos guardados', description: 'El rendimiento se actualizó correctamente.', status: 'success' });
        // Opcional: Cerrar o mantener abierto? "Los datos siempre se pueden editar y guardar"
        // setPerformanceModal({ open: false, match: null }); 
    } catch (err) {
        addToast({ title: 'Error al guardar', description: err.message, status: 'error' });
    } finally {
        setSavingPerformance(false);
    }
  };

  const handleCalculateMVP = async () => {
      if (!performanceModal.match) return;
      setLoadingPerformance(true); // Bloquear tabla
      try {
          // Primero guardamos lo actual para asegurar que el cálculo use lo último en pantalla
          // O el backend usa lo que hay en DB? "Al dar click... bloquear".
          // Asumimos que primero guardamos, luego calculamos. 
          // O enviamos todo para cálculo? El endpoint de cálculo usa lo de la DB.
          // Por seguridad, guardamos primero silenciosamente.
          
           const payload = playersStats.map(p => {
              const { id, nombre, team, isLocal, role_selection, ...rest } = p;
              return { id_estudiante: id, ...rest };
           });
           await eventService.saveMatchPerformance(performanceModal.match.id, payload);

           // Ahora calculamos
           const updatedStats = await eventService.calculateMatchMVP(performanceModal.match.id);
           
           // Actualizamos el estado con los nuevos ratings y flags
           // Mapeamos de vuelta
           const dataMap = new Map(updatedStats.map(d => [d.id_estudiante, d]));
           
           setPlayersStats(prev => prev.map(p => {
               const coming = dataMap.get(p.id);
               if (coming) {
                   return { ...p, rating: coming.rating, mvp: coming.mvp };
               }
               return p;
           }));

           addToast({ title: 'MVP Calculado', description: 'Se han actualizado los ratings.', status: 'success' });

      } catch (err) {
          addToast({ title: 'Error calculando MVP', description: err.message, status: 'error' });
      } finally {
          setLoadingPerformance(false);
      }
  };

  useEffect(() => {
    setInstitutions([]);
    setSchedule([]);
    setInstitutionsLoaded(false);
    setScheduleLoaded(false);
  }, [numericEventId]);

  const refreshInstitutions = useCallback(async () => {
    if (!numericEventId) return;
    setLoadingInstitutions(true);
    try {
      const data = await eventService.listEventInstitutions(numericEventId);
      setInstitutions(Array.isArray(data) ? data : []);
      setSendingNotifications({});
      setRemovingInstitutions({});
    } catch (err) {
      addToast({
        title: 'No se pudieron cargar las instituciones',
        description: err?.message,
        status: 'error',
      });
      setInstitutions([]);
    } finally {
      setInstitutionsLoaded(true);
      setLoadingInstitutions(false);
    }
  }, [addToast, numericEventId]);

  const refreshSchedule = useCallback(async () => {
    if (!numericEventId) return;
    setLoadingSchedule(true);
    try {
      const { matches, meta } = await eventService.getSchedule(numericEventId);
      setSchedule(Array.isArray(matches) ? matches : []);
      setScheduleMeta(meta ?? null);
    } catch (err) {
      addToast({
        title: 'No se pudo cargar el cronograma',
        description: err?.message,
        status: 'error',
      });
      setSchedule([]);
      setScheduleMeta(null);
    } finally {
      setScheduleLoaded(true);
      setLoadingSchedule(false);
    }
  }, [addToast, numericEventId]);

  const upsertMatchInSchedule = useCallback((updatedMatch) => {
    setSchedule((prev) => {
      if (!updatedMatch) return prev;
      const exists = prev.some((item) => item.id === updatedMatch.id);
      if (exists) {
        return prev.map((item) => (item.id === updatedMatch.id ? updatedMatch : item));
      }
      return [...prev, updatedMatch];
    });
  }, []);

  const handlePublishMatchNews = useCallback(
    async (matchId) => {
      if (!numericEventId || !matchId) return;
      setPublishingNewsId(matchId);
      try {
        const { match: updated, meta } = await eventService.publishMatchNews(
          numericEventId,
          matchId,
        );
        if (updated) {
          upsertMatchInSchedule(updated);
          addToast({
            title: 'Noticia publicada',
            description: 'El enfrentamiento se envió a Noticias y la página pública.',
            status: 'success',
          });
          if (meta?.extra?.news_id) {
            addToast({
              title: 'Publicación creada',
              description: 'Puedes encontrar la nota en la sección de Noticias.',
              status: 'info',
            });
          }
          void refreshSchedule();
        }
      } catch (err) {
        addToast({
          title: 'No se pudo publicar la noticia',
          description: err?.message,
          status: 'error',
        });
      } finally {
        setPublishingNewsId(null);
      }
    },
    [addToast, numericEventId, refreshSchedule, upsertMatchInSchedule],
  );

  const handleOpenStandings = useCallback(async () => {
    if (!numericEventId) return;
    setStandingsModal((prev) => ({ ...prev, open: true, loading: true }));
    try {
      const tables = await eventService.getStandings(numericEventId);
      setStandingsModal({ open: true, loading: false, tables: Array.isArray(tables) ? tables : [] });
    } catch (err) {
      addToast({
        title: 'No se pudo cargar la tabla de posiciones',
        description: err?.message,
        status: 'error',
      });
      setStandingsModal((prev) => ({ ...prev, loading: false, tables: [] }));
    }
  }, [addToast, numericEventId]);

  const handleCloseStandings = useCallback(
    () => setStandingsModal((prev) => ({ ...prev, open: false })),
    [],
  );

  const handleOpenResultModal = useCallback((match) => {
    if (!match) return;
    const defaultWinner = match.ganador?.id ?? match.equipo_local?.id ?? null;
    setResultModal({
      open: true,
      match,
      localScore: Number.isFinite(match.puntaje_local) ? match.puntaje_local : '',
      visitorScore: Number.isFinite(match.puntaje_visitante) ? match.puntaje_visitante : '',
      winnerId: defaultWinner,
      criterio: match.criterio_resultado ?? 'puntos',
      publishNews: !match?.noticia_publicada,
      submitting: false,
      loadingPlayers: true,
      playersConfig: null,
      playerStats: {},
    });

    eventService.getMatchPlayers(numericEventId, match.id)
      .then((config) => {
         const stats = {};
         if (config?.players) {
             config.players.forEach((p) => {
                 stats[p.id] = {
                     goles: p.goles ?? 0,
                     puntos: p.puntos ?? 0,
                     faltas: p.faltas ?? 0,
                     tarjetas_amarillas: p.tarjetas_amarillas ?? 0,
                     tarjetas_rojas: p.tarjetas_rojas ?? 0,
                 };
             });
         }
         setResultModal((prev) => ({
             ...prev,
             loadingPlayers: false,
             playersConfig: config,
             playerStats: stats,
         }));
      })
      .catch((err) => {
         addToast({
            title: 'No se pudieron cargar los jugadores',
            description: err?.message,
            status: 'error',
         });
         setResultModal((prev) => ({ ...prev, loadingPlayers: false, open: false }));
      });
  }, [numericEventId, addToast]);

  const handleCloseResultModal = useCallback(() => {
    setResultModal({
      open: false,
      match: null,
      localScore: '',
      visitorScore: '',
      winnerId: null,
      criterio: 'puntos',
      publishNews: true,
      submitting: false,
    });
  }, []);

  const handleSubmitResult = useCallback(async () => {
    if (!numericEventId || !resultModal.match) return;
    
    setResultModal((prev) => ({ ...prev, submitting: true }));
    try {
      const resultsWithId = Object.entries(resultModal.playerStats).map(([sId, stats]) => ({
         estudiante_id: Number(sId),
         ...stats
      }));

      const { match: updated, meta } = await eventService.registerDetailedMatchResult(
         numericEventId, 
         resultModal.match.id, 
         {
            results: resultsWithId,
            publish_news: Boolean(resultModal.publishNews),
            criterio: resultModal.criterio,
         }
      );

      if (updated) {
        upsertMatchInSchedule(updated);
        addToast({
          title: 'Resultado registrado',
          description: 'El resultado se calculó y guardó correctamente.',
          status: 'success',
        });
        if (meta?.extra?.news_id) {
          addToast({
            title: 'Noticia publicada',
            description: 'Se creó una publicación en la sección de Noticias.',
            status: 'info',
          });
        }
        void refreshSchedule();
      }
      handleCloseResultModal();
    } catch (err) {
      addToast({
        title: 'No se pudo registrar el resultado',
        description: err?.message,
        status: 'error',
      });
    } finally {
      setResultModal((prev) => ({ ...prev, submitting: false }));
    }
  }, [addToast, handleCloseResultModal, numericEventId, refreshSchedule, resultModal, upsertMatchInSchedule]);

  const canRegisterResult = useCallback(
    (match) => {
      if (!match) return false;
      const estadoPartido = (match.estado ?? '').toLowerCase();
      if (['finalizado', 'completado'].includes(estadoPartido)) return false;
      if (!match.equipo_local?.id || !match.equipo_visitante?.id) return false;
      const currentStage = (eventData?.etapa_actual ?? '').toLowerCase();
      const stageAllowed = ['campeonato', 'finalizado'].includes(currentStage);
      if (!stageAllowed) return false;
      if (!match.fecha) return stageAllowed;
      const scheduled = new Date(`${match.fecha}T${match.hora ?? '00:00'}`);
      if (Number.isNaN(scheduled.getTime())) return stageAllowed;
      return scheduled.getTime() <= Date.now();
    },
    [eventData?.etapa_actual],
  );

  const handleOpenTimelineModal = useCallback(() => {
    if (!eventData) return;
    setTimelineModal({
      open: true,
      values: {
        fecha_inscripcion_inicio: toInputDate(eventData.fecha_inscripcion_inicio),
        fecha_inscripcion_fin: toInputDate(eventData.fecha_inscripcion_fin),
        fecha_auditoria_inicio: toInputDate(eventData.fecha_auditoria_inicio),
        fecha_auditoria_fin: toInputDate(eventData.fecha_auditoria_fin),
        fecha_campeonato_inicio: toInputDate(eventData.fecha_campeonato_inicio),
        fecha_campeonato_fin: toInputDate(eventData.fecha_campeonato_fin),
      },
    });
  }, [eventData]);

  const handleCloseTimelineModal = () => {
    setTimelineModal({ open: false, values: {} });
  };

  const handleTimelineFieldChange = (field, value) => {
    setTimelineModal((previous) => ({
      ...previous,
      values: { ...previous.values, [field]: value },
    }));
  };

  const handleSaveTimeline = async () => {
    if (!numericEventId) return;
    setSavingTimeline(true);
    try {
      const payload = Object.entries(timelineModal.values ?? {}).reduce(
        (acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        },
        {},
      );
      const updated = await eventService.updateTimeline(numericEventId, payload);
      setEventData(updated ?? eventData);
      addToast({
        title: 'Cronograma actualizado',
        description: 'Las fechas del evento se actualizaron correctamente.',
        status: 'success',
      });
      handleCloseTimelineModal();
    } catch (timelineError) {
      addToast({
        title: 'No se pudo actualizar el cronograma',
        description: timelineError?.message,
        status: 'error',
      });
    } finally {
      setSavingTimeline(false);
    }
  };

  const invitedInstitutionIds = useMemo(
    () => new Set((institutions ?? []).map((item) => Number(item?.institucion_id))),
    [institutions],
  );

  const availableInstitutionOptions = useMemo(
    () =>
      (selectableInstitutions ?? [])
        .filter((institution) => !invitedInstitutionIds.has(Number(institution.id)))
        .map((institution) => ({
          value: institution.id,
          label: institution.nombre ?? `ID ${institution.id}`,
          description: institution.ciudad ? `Ciudad: ${institution.ciudad}` : undefined,
        })),
    [selectableInstitutions, invitedInstitutionIds],
  );

  const schedulePhaseOptions = useMemo(
    () => {
      const phases = new Set(
        (schedule ?? [])
          .map((item) => (item?.fase ? String(item.fase) : null))
          .filter((value) => value),
      );
      return [
        { value: 'todas', label: 'Todas las fases' },
        ...Array.from(phases).map((phase) => ({
          value: phase,
          label: formatPhaseLabel(phase),
        })),
      ];
    },
    [schedule],
  );

  const scheduleSeriesOptions = useMemo(
    () => {
      const series = new Set(
        (schedule ?? [])
          .map((item) => (item?.serie ? String(item.serie) : null))
          .filter((value) => value),
      );
      return [
        { value: 'todas', label: 'Todas las series' },
        ...Array.from(series).map((serie) => ({ value: serie, label: serie })),
      ];
    },
    [schedule],
  );

  const scheduleCourtOptions = useMemo(
    () => {
      const courts = new Set(
        (schedule ?? []).map((item) => item?.escenario_nombre || 'Sin asignar'),
      );
      return [
        { value: 'todas', label: 'Todos los escenarios' },
        ...Array.from(courts).map((court) => ({ value: court, label: court })),
      ];
    },
    [schedule],
  );

  const scheduleDateOptions = useMemo(
    () => {
      const dates = Array.from(
        new Set((schedule ?? []).map((item) => item?.fecha).filter((value) => value)),
      ).sort();
      return [
        { value: 'todas', label: 'Todas las fechas' },
        ...dates.map((dateValue) => ({
          value: dateValue,
          label: new Date(dateValue).toLocaleDateString('es-EC'),
        })),
      ];
    },
    [schedule],
  );

  const filteredSchedule = useMemo(
    () =>
      (schedule ?? []).filter((match) => {
        if (
          scheduleFilters.fase !== 'todas'
          && (match?.fase ?? 'group') !== scheduleFilters.fase
        ) {
          return false;
        }
        if (
          scheduleFilters.serie !== 'todas'
          && (match?.serie ?? '') !== scheduleFilters.serie
        ) {
          return false;
        }
        const courtName = match?.escenario_nombre || 'Sin asignar';
        if (scheduleFilters.cancha !== 'todas' && courtName !== scheduleFilters.cancha) {
          return false;
        }
        if (
          scheduleFilters.fecha !== 'todas'
          && (match?.fecha ?? null) !== scheduleFilters.fecha
        ) {
          return false;
        }
        return true;
      }),
    [schedule, scheduleFilters],
  );

  const scheduleStats = useMemo(() => {
    if (!schedule?.length) {
      return {
        totalMatches: 0,
        usedDays: 0,
        lastDate: null,
        withinRange: true,
      };
    }
    const uniqueDates = Array.from(
      new Set(schedule.map((item) => item?.fecha).filter((value) => value)),
    ).sort();
    const lastDate = uniqueDates.length ? uniqueDates[uniqueDates.length - 1] : null;
    let withinRange = true;
    if (lastDate && eventData?.fecha_campeonato_fin) {
      withinRange = new Date(lastDate) <= new Date(eventData.fecha_campeonato_fin);
    }
    return {
      totalMatches: schedule.length,
      usedDays: uniqueDates.length,
      lastDate,
      withinRange,
    };
  }, [schedule, eventData?.fecha_campeonato_fin]);

  const scheduleExtra = useMemo(() => scheduleMeta?.extra ?? {}, [scheduleMeta]);
  const nextScheduleStage = useMemo(
    () => (scheduleExtra?.next_stage ?? '').toLowerCase(),
    [scheduleExtra?.next_stage],
  );
  const allowInitialSchedule = schedule.length === 0;
  const canGenerateNextStage = Boolean(
    !allowInitialSchedule && nextScheduleStage && nextScheduleStage !== 'group',
  );

  const buildTeamStats = useCallback(
    (team) => {
      if (!team?.id) return null;
      const teamId = team.id;
      const matchesForTeam = schedule.filter(
        (item) => item?.equipo_local?.id === teamId || item?.equipo_visitante?.id === teamId,
      );
      const wins = matchesForTeam.filter((item) => item?.ganador?.id === teamId).length;
      const played = matchesForTeam.filter(
        (item) => (item?.estado ?? '').toLowerCase() === 'finalizado',
      ).length;
      const history = matchesForTeam
        .slice()
        .sort((a, b) => new Date(a.fecha ?? a.creado_en ?? 0) - new Date(b.fecha ?? b.creado_en ?? 0))
        .map((item) => {
          const isLocal = item?.equipo_local?.id === teamId;
          const opponent = isLocal
            ? item?.equipo_visitante?.nombre_equipo ?? item?.placeholder_visitante ?? 'Por definir'
            : item?.equipo_local?.nombre_equipo ?? item?.placeholder_local ?? 'Por definir';
          const resultLabel = item?.ganador?.id
            ? item.ganador.id === teamId
              ? 'Ganado'
              : 'Perdido'
            : 'Pendiente';
          return {
            id: item.id,
            opponent,
            result: resultLabel,
            score: `${Number.isFinite(item?.puntaje_local) ? item.puntaje_local : '-'}-${
              Number.isFinite(item?.puntaje_visitante) ? item.puntaje_visitante : '-'
            }`,
            date: item.fecha,
          };
        });
      return {
        wins,
        played,
        history,
        students: team.estudiantes ?? [],
      };
    },
    [schedule],
  );

  const handleOpenTeamPreview = useCallback(
    (team) => {
      if (!team) return;
      const stats = buildTeamStats(team);
      setTeamPreview({ open: true, team, stats });
    },
    [buildTeamStats],
  );

  const handleCloseTeamPreview = useCallback(
    () => setTeamPreview({ open: false, team: null, stats: null }),
    [],
  );

  const handleOpenScheduleModal = useCallback(() => {
    if (!allowInitialSchedule && !canGenerateNextStage) return;
    setScheduleForm((prev) => ({
      ...prev,
      force: false,
    }));
    setScheduleModalOpen(true);
  }, [allowInitialSchedule, canGenerateNextStage]);

  const handleGenerateSchedule = useCallback(async () => {
    if (!numericEventId) return;
    setGeneratingSchedule(true);
    try {
      const payload = {};
      if (scheduleForm.horaInicio) {
        payload.hora_inicio = scheduleForm.horaInicio;
      }
      if (scheduleForm.horaFin) {
        payload.hora_fin = scheduleForm.horaFin;
      }
      if (scheduleForm.duracionHoras !== '') {
        const parsedDuration = Number(scheduleForm.duracionHoras);
        if (!Number.isNaN(parsedDuration)) {
          payload.duracion_horas = parsedDuration;
        }
      }
      if (scheduleForm.descansoMinDias !== '') {
        const parsedRest = Number(scheduleForm.descansoMinDias);
        if (!Number.isNaN(parsedRest)) {
          payload.descanso_min_dias = parsedRest;
        }
      }
      if (scheduleForm.force) {
        payload.force = true;
      }
      const { matches, meta } = await eventService.generateSchedule(
        numericEventId,
        Object.keys(payload).length ? payload : {},
      );
      setSchedule(Array.isArray(matches) ? matches : []);
      setScheduleMeta(meta ?? null);
      addToast({
        title: 'Calendario generado',
        description: 'La programación se actualizó correctamente.',
        status: 'success',
      });
      setScheduleModalOpen(false);
    } catch (error) {
      addToast({
        title: 'No se pudo generar el calendario',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    } finally {
      setGeneratingSchedule(false);
    }
  }, [addToast, numericEventId, scheduleForm]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!numericEventId) return;
    setDeletingSchedule(true);
    try {
      await eventService.deleteSchedule(numericEventId);
      setSchedule([]);
      setScheduleMeta(null);
      addToast({
        title: 'Calendario eliminado',
        description: 'Se eliminaron todos los partidos programados.',
        status: 'success',
      });
    } catch (error) {
      addToast({
        title: 'No se pudo eliminar el calendario',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
    } finally {
      setDeletingSchedule(false);
    }
  }, [addToast, numericEventId]);

  const handleSendNotification = useCallback(
    async (institution) => {
      if (!numericEventId || !institution?.institucion_id) {
        addToast({
          title: 'No se pudo enviar la notificación',
          description: 'No se encontró la institución seleccionada.',
          status: 'error',
        });
        return;
      }
      const institutionId = Number(institution.institucion_id);
      const notificationType = 'recordatorio';
      setSendingNotifications((prev) => ({ ...prev, [institutionId]: true }));
      try {
        await eventService.notifyInstitution(numericEventId, institutionId, { tipo: notificationType });
        addToast({
          title: 'Recordatorio enviado',
          description: 'Se envió un recordatorio de inscripción.',
          status: 'success',
        });
      } catch (error) {
        addToast({
          title: 'No se pudo enviar la notificación',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      } finally {
        setSendingNotifications((prev) => ({ ...prev, [institutionId]: false }));
      }
    },
    [addToast, numericEventId],
  );

  const handleRemoveInstitution = useCallback(
    async (institution) => {
      if (!numericEventId || !institution?.institucion_id) {
        addToast({
          title: 'No se pudo quitar la institución',
          description: 'No se encontró la institución seleccionada.',
          status: 'error',
        });
        return;
      }
      const institutionId = Number(institution.institucion_id);
      const confirmed = window.confirm(
        `¿Deseas quitar la institución "${institution.institucion_nombre ?? 'Sin nombre'}" del evento?`,
      );
      if (!confirmed) return;
      setRemovingInstitutions((prev) => ({ ...prev, [institutionId]: true }));
      try {
        await eventService.removeInstitution(numericEventId, institutionId);
        addToast({
          title: 'Institución retirada',
          description: 'La institución ya no forma parte del evento.',
          status: 'success',
        });
        await refreshInstitutions();
      } catch (error) {
        addToast({
          title: 'No se pudo quitar la institución',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      } finally {
        setRemovingInstitutions((prev) => {
          const next = { ...prev };
          delete next[institutionId];
          return next;
        });
      }
    },
    [addToast, numericEventId, refreshInstitutions],
  );

  const handleOpenAddInstitution = useCallback(async () => {
    if (!numericEventId) return;
    setAddInstitutionModal({ open: true, selected: null });
    try {
      setLoadingSelectableInstitutions(true);
      const list = await institutionService.listSelectable();
      setSelectableInstitutions(Array.isArray(list) ? list : []);
    } catch (err) {
      addToast({
        title: 'No se pudieron cargar las instituciones disponibles',
        description: err?.message,
        status: 'error',
      });
      setSelectableInstitutions([]);
    } finally {
      setLoadingSelectableInstitutions(false);
    }
  }, [addToast, numericEventId]);

  const handleCloseAddInstitution = useCallback(() => {
    setAddInstitutionModal({ open: false, selected: null });
  }, []);

  const handleConfirmAddInstitution = useCallback(async () => {
    if (!numericEventId || !addInstitutionModal.selected) return;
    setAddingInstitution(true);
    try {
      await eventService.addInstitution(numericEventId, {
        institucion_id: Number(addInstitutionModal.selected),
      });
      addToast({
        title: 'Institución invitada',
        description: 'Se envió la invitación automáticamente.',
        status: 'success',
      });
      setSelectableInstitutions((prev) =>
        Array.isArray(prev)
          ? prev.filter((item) => Number(item.id) !== Number(addInstitutionModal.selected))
          : prev,
      );
      setAddInstitutionModal({ open: false, selected: null });
      await refreshInstitutions();
    } catch (error) {
      addToast({
        title: 'No se pudo agregar la institución',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setAddingInstitution(false);
    }
  }, [addInstitutionModal.selected, addToast, numericEventId, refreshInstitutions]);

  useEffect(() => {
    if (!numericEventId) {
      setError('Identificador de evento inválido');
      return;
    }
    const loadEvent = async () => {
      setLoadingEvent(true);
      setError(null);
      try {
        const data = await eventService.getById(numericEventId, { includeInstitutions: false });
        setEventData(data);
      } catch (err) {
        const message = err?.message ?? 'No se pudo cargar el evento';
        setError(message);
        addToast({ title: 'No se pudo cargar el evento', description: message, status: 'error' });
      } finally {
        setLoadingEvent(false);
      }
    };
    void loadEvent();
  }, [addToast, numericEventId]);

  useEffect(() => {
    if (!numericEventId) return;
    const needsInstitutions = ['registration', 'audit'].includes(activeTab);
    if (needsInstitutions && !institutionsLoaded && !loadingInstitutions) {
      void refreshInstitutions();
    }
  }, [activeTab, institutionsLoaded, loadingInstitutions, numericEventId, refreshInstitutions]);

  useEffect(() => {
    if (!numericEventId) return;
    if (activeTab === 'championship' && !scheduleLoaded && !loadingSchedule) {
      void refreshSchedule();
    }
  }, [activeTab, loadingSchedule, numericEventId, refreshSchedule, scheduleLoaded]);

  const stage = useMemo(
    () => (eventData?.etapa_actual ?? '').toLowerCase(),
    [eventData?.etapa_actual],
  );
  const isAuditStage = stage === 'auditoria';
  const isChampionshipStage = stage === 'campeonato';
  const stageBadgeColor = STAGE_BADGE_COLORS[stage] ?? 'neutral';
  const visibleTabs = useMemo(() => {
    const allowed = new Set(['summary', 'registration']);
    if (['auditoria', 'campeonato', 'finalizado', 'archivado'].includes(stage)) {
      allowed.add('audit');
    }
    if (['campeonato', 'finalizado'].includes(stage)) {
      allowed.add('championship');
    }
    return TABS.filter((tab) => allowed.has(tab.id));
  }, [stage]);
  const canAccessAudit = visibleTabs.some((tab) => tab.id === 'audit');
  const canAccessChampionship = visibleTabs.some((tab) => tab.id === 'championship');

  useEffect(() => {
    const allowedIds = visibleTabs.map((tab) => tab.id);
    if (!allowedIds.includes(activeTab)) {
      setActiveTab(allowedIds[0] ?? 'summary');
    }
  }, [activeTab, visibleTabs]);

  const approvedInstitutions = useMemo(
    () => institutions.filter((institution) => institution?.estado_auditoria === 'aprobada'),
    [institutions],
  );

  const filteredInstitutions = useMemo(() => {
    if (registrationFilter === 'todas') {
      return institutions;
    }
    const target = registrationFilter.toLowerCase();
    return institutions.filter(
      (institution) => (institution?.estado_invitacion ?? '').toLowerCase() === target,
    );
  }, [institutions, registrationFilter]);

  if (!numericEventId) {
    return (
      <Card>
        <CardHeader title="Detalle de evento" description="No se pudo identificar el evento solicitado." />
        <div className="p-4">
          <Button type="button" onClick={() => navigate('/admin/eventos')}>
            Volver a eventos
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={eventData?.titulo ?? 'Detalle de evento'}
          description={eventData?.descripcion ?? 'Consulta la información general y el progreso del evento.'}
          actions={
            <div className="flex items-center gap-3">
              <Badge color={stageBadgeColor}>{formatStage(stage)}</Badge>
              <Button type="button" variant="primary" size="sm" onClick={handleOpenTimelineModal} disabled={!eventData}>
                Actualizar cronograma
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin/eventos')}>
                Volver
              </Button>
            </div>
          }
        />
        <div className="space-y-6 p-4">
        {loadingEvent ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">Cargando información del evento…</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 rounded-3xl bg-slate-100/70 p-3 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
              <span>Inscripción: {formatDate(eventData?.fecha_inscripcion_inicio)} — {formatDate(eventData?.fecha_inscripcion_fin)}</span>
              <span>Auditoría: {formatDate(eventData?.fecha_auditoria_inicio)} — {formatDate(eventData?.fecha_auditoria_fin)}</span>
              <span>
                Campeonato: {formatDate(eventData?.fecha_campeonato_inicio)} — {formatDate(eventData?.fecha_campeonato_fin)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {canAccessAudit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isAuditStage}
                  onClick={() => setActiveTab('audit')}
                  title={isAuditStage ? undefined : 'Disponible durante la etapa de auditoría'}
                >
                  Gestionar auditoría
                </Button>
              )}
              {canAccessChampionship && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isChampionshipStage}
                  onClick={() => setActiveTab('championship')}
                  title={isChampionshipStage ? undefined : 'Disponible durante la etapa de campeonato'}
                >
                  Gestionar campeonato
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'summary' && (
              <div className="space-y-4">
                {eventData?.imagen_portada_url && (
                  <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Imagen del evento</h3>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
                      <img
                        src={resolveMediaUrl(eventData.imagen_portada_url)}
                        alt={`Portada de ${eventData?.titulo ?? 'evento'}`}
                        className="h-auto w-full max-h-80 object-cover"
                      />
                    </div>
                  </section>
                )}
                <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Información general</h3>
                  <dl className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                    <div>
                      <dt className="font-medium text-slate-700 dark:text-slate-100">Deporte</dt>
                      <dd>{eventData?.deporte?.nombre ?? 'No especificado'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-700 dark:text-slate-100">Sexo del evento</dt>
                      <dd>{eventData?.sexo_evento ?? 'Mixto'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-700 dark:text-slate-100">Categorías</dt>
                      <dd>
                        {eventData?.categorias?.length
                          ? eventData.categorias.map((category) => category?.nombre ?? 'N/D').join(', ')
                          : 'Sin categorías registradas'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-700 dark:text-slate-100">Escenarios</dt>
                      <dd>
                        {eventData?.escenarios?.length
                          ? eventData.escenarios
                              .map((item) => item?.nombre_escenario ?? item?.escenario?.nombre ?? 'N/D')
                              .join(', ')
                          : 'Sin escenarios registrados'}
                      </dd>
                    </div>
                    {eventData?.documento_planeacion_url && (
                      <div className="md:col-span-2">
                        <dt className="font-medium text-slate-700 dark:text-slate-100">Documento de planificación</dt>
                        <dd>
                          <a
                            href={resolveMediaUrl(eventData.documento_planeacion_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline dark:text-primary-300"
                          >
                            Ver documento
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Participación</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {institutions.length} instituciones invitadas · {approvedInstitutions.length} instituciones aprobadas ·{' '}
                    {institutions.reduce((acc, item) => acc + (item?.cantidad_inscritos ?? 0), 0)} estudiantes registrados
                  </p>
                </section>
              </div>
            )}
            {activeTab === 'registration' && (
              <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Instituciones inscritas</h3>
                {loadingInstitutions ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">Cargando instituciones…</p>
                ) : institutions.length ? (
                  <>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Mostrando {filteredInstitutions.length} de {institutions.length} instituciones invitadas.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAddInstitution}
                          disabled={loadingInstitutions || loadingSelectableInstitutions}
                          title={
                            loadingSelectableInstitutions
                              ? 'Cargando instituciones disponibles'
                              : 'Invitar una nueva institución'
                          }
                        >
                          Agregar institución
                        </Button>
                      </div>
                      <Select
                        value={registrationFilter}
                        onChange={(value) => setRegistrationFilter(value ?? 'todas')}
                        options={REGISTRATION_FILTER_OPTIONS}
                        placeholder="Filtrar por estado"
                        clearable={false}
                        className="w-full max-w-xs"
                      />
                    </div>
                    {filteredInstitutions.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                              <th className="px-3 py-2">Institución</th>
                              <th className="px-3 py-2">Estado invitación</th>
                              <th className="px-3 py-2">Estado auditoría</th>
                              <th className="px-3 py-2">Participantes</th>
                              <th className="px-3 py-2">Documentación</th>
                              <th className="px-3 py-2">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInstitutions.map((institution) => {
                              const rowKey = institution.evento_institucion_id ?? institution.institucion_id;
                              const invitationState = (institution.estado_invitacion ?? '').toLowerCase();
                              const institutionId = Number(institution.institucion_id ?? 0);
                              const isSending = Boolean(sendingNotifications[institutionId]);
                              const isRemoving = Boolean(removingInstitutions[institutionId]);
                              const buttonLabel = 'Enviar recordatorio';
                              return (
                                <tr key={rowKey} className="border-t border-slate-200 dark:border-slate-700">
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                    {institution.institucion_nombre ?? 'Sin nombre'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge
                                      color={
                                        invitationState === 'aceptada'
                                          ? 'success'
                                          : invitationState === 'rechazada'
                                          ? 'danger'
                                          : 'neutral'
                                      }
                                    >
                                      {institution.estado_invitacion ?? 'Pendiente'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge
                                      color={
                                        institution.estado_auditoria === 'aprobada'
                                          ? 'success'
                                          : institution.estado_auditoria === 'rechazada'
                                          ? 'danger'
                                          : institution.estado_auditoria === 'correccion'
                                          ? 'warning'
                                          : 'neutral'
                                      }
                                    >
                                      {institution.estado_auditoria ?? 'Sin revisar'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                    {institution.cantidad_inscritos ?? 0}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge
                                      color={
                                        institution.documentacion_completa === true
                                          ? 'success'
                                          : institution.documentacion_completa === false
                                          ? 'warning'
                                          : 'neutral'
                                      }
                                    >
                                      {institution.documentacion_completa === true
                                        ? 'Completa'
                                        : institution.documentacion_completa === false
                                        ? 'Incompleta'
                                        : 'Por revisar'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSendNotification(institution)}
                                        disabled={isSending || isRemoving}
                                        aria-label={buttonLabel}
                                        className="border border-slate-200 bg-white/90 px-2 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60"
                                      >
                                        {isSending ? (
                                          <span className="text-xs font-semibold">Enviando…</span>
                                        ) : (
                                          <>
                                            <EnvelopeIcon className="h-5 w-5 text-sky-600 dark:text-sky-300" aria-hidden />
                                            <span className="sr-only">{buttonLabel}</span>
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveInstitution(institution)}
                                        disabled={isRemoving || isSending}
                                        aria-label="Quitar institución"
                                        className="border border-slate-200 bg-white/90 px-2 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60"
                                      >
                                        {isRemoving ? (
                                          <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                                            Quitando…
                                          </span>
                                        ) : (
                                          <>
                                            <TrashIcon className="h-5 w-5 text-rose-600 dark:text-rose-300" aria-hidden />
                                            <span className="sr-only">Quitar institución</span>
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                        No hay instituciones con el filtro seleccionado.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">Aún no hay instituciones inscritas.</p>
                )}
              </section>
            )}
            {activeTab === 'audit' && (
              <EventAuditPanel
                eventId={numericEventId}
                institutions={institutions}
                loading={loadingInstitutions}
                onRefresh={refreshInstitutions}
                currentStage={stage}
                auditStart={eventData?.fecha_auditoria_inicio}
                auditEnd={eventData?.fecha_auditoria_fin}
              />
            )}
            {activeTab === 'championship' && (
              <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Cronograma de partidos</h3>
                  <Button type="button" size="sm" variant="ghost" onClick={handleOpenStandings}>
                    <PresentationChartBarIcon className="mr-2 h-4 w-4" />
                    Tabla de posiciones
                  </Button>
                </div>
                {!isChampionshipStage && (
                  <p className="mt-2 rounded-3xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-100">
                    La gestión del campeonato se habilitará durante la etapa correspondiente. Revisa las fechas programadas para preparar el calendario.
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                    <Badge color="primary">Partidos: {scheduleStats.totalMatches}</Badge>
                    <Badge color={scheduleStats.withinRange ? 'success' : 'warning'}>
                      Días programados: {scheduleStats.usedDays}
                    </Badge>
                    {scheduleStats.lastDate && (
                      <span>
                        Último encuentro: {new Date(scheduleStats.lastDate).toLocaleDateString('es-EC')}
                      </span>
                    )}
                    {!scheduleStats.withinRange && (
                      <span className="font-semibold text-amber-600 dark:text-amber-300">
                        Advertencia: excede la fecha fin del evento
                      </span>
                    )}
                  </div>
                  {isChampionshipStage && allowInitialSchedule && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="primary" size="sm" onClick={handleOpenScheduleModal}>
                        Generar calendario
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSchedule}
                        disabled={Boolean(deletingSchedule)}
                      >
                        {deletingSchedule ? 'Eliminando…' : 'Eliminar calendario'}
                      </Button>
                    </div>
                  )}
                  {isChampionshipStage && canGenerateNextStage && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="primary" size="sm" onClick={handleOpenScheduleModal}>
                        Generar siguiente etapa
                      </Button>
                    </div>
                  )}
                </div>
                {canGenerateNextStage && (
                  <div className="mt-3 rounded-3xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100">
                    La fase actual finalizó. Genera el calendario de {formatPhaseLabel(nextScheduleStage)} para continuar el campeonato.
                  </div>
                )}
                {loadingSchedule ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">Cargando cronograma…</p>
                ) : schedule.length ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Select
                        label="Fase"
                        value={scheduleFilters.fase}
                        onChange={(value) =>
                          setScheduleFilters((prev) => ({ ...prev, fase: value ?? 'todas' }))
                        }
                        options={schedulePhaseOptions}
                        clearable={false}
                      />
                      <Select
                        label="Serie"
                        value={scheduleFilters.serie}
                        onChange={(value) =>
                          setScheduleFilters((prev) => ({ ...prev, serie: value ?? 'todas' }))
                        }
                        options={scheduleSeriesOptions}
                        clearable={false}
                      />
                      <Select
                        label="Escenario"
                        value={scheduleFilters.cancha}
                        onChange={(value) =>
                          setScheduleFilters((prev) => ({ ...prev, cancha: value ?? 'todas' }))
                        }
                        options={scheduleCourtOptions}
                        clearable={false}
                      />
                      <Select
                        label="Fecha"
                        value={scheduleFilters.fecha}
                        onChange={(value) =>
                          setScheduleFilters((prev) => ({ ...prev, fecha: value ?? 'todas' }))
                        }
                        options={scheduleDateOptions}
                        clearable={false}
                      />
                    </div>
                    {filteredSchedule.length ? (
                      <div className="mt-4 space-y-3">
                        {filteredSchedule.map((match) => {
                          const localName =
                            match?.equipo_local?.nombre_equipo
                            ?? match?.placeholder_local
                            ?? 'Por definir';
                          const visitorName =
                            match?.equipo_visitante?.nombre_equipo
                            ?? match?.placeholder_visitante
                            ?? 'Por definir';
                          const phaseKey = (match?.fase ?? '').toLowerCase();
                          const phaseColor = PHASE_BADGE_COLORS[phaseKey] ?? 'neutral';
                          const estadoPartido = (match?.estado ?? '').toLowerCase();
                          const localResultLabel =
                            match?.resultado_local
                            ?? (match?.ganador?.id === match?.equipo_local?.id
                              ? 'ganado'
                              : match?.ganador
                              ? 'perdido'
                              : null);
                          const visitorResultLabel =
                            match?.resultado_visitante
                            ?? (match?.ganador?.id === match?.equipo_visitante?.id
                              ? 'ganado'
                              : match?.ganador
                              ? 'perdido'
                              : null);
                          const hasScores = Number.isFinite(match?.puntaje_local)
                            && Number.isFinite(match?.puntaje_visitante);
                          const matchDateTime = match?.fecha
                            ? new Date(`${match.fecha}T${match.hora ?? '00:00'}`)
                            : null;
                          const hasOccurred = matchDateTime
                            ? matchDateTime.getTime() <= Date.now()
                            : false;
                          const highlightMatch = hasScores || hasOccurred;
                          const cardClasses = highlightMatch
                            ? 'space-y-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-3 dark:border-emerald-500/40 dark:bg-emerald-900/30'
                            : 'space-y-2 rounded-2xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/60 dark:bg-slate-900/60';
                          const canPublishNews = !match?.noticia_publicada && hasScores;
                          const canEditResult = true; // Permite editar siempre los resultados
                          return (
                            <div
                              key={match.id}
                              className={cardClasses}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                                    {localName} vs {visitorName}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-300">
                                    {match?.categoria?.nombre ?? 'Categoría no asignada'} ·{' '}
                                    {match?.escenario_nombre ?? 'Escenario por definir'}
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
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {match?.fase && (
                                  <Badge color={phaseColor}>{formatPhaseLabel(match.fase)}</Badge>
                                )}
                                {match?.serie && <Badge color="neutral">{match.serie}</Badge>}
                                {match?.ronda && <Badge color="accent">{match.ronda}</Badge>}
                                {match?.llave && <Badge color="neutral">Llave {match.llave}</Badge>}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="flex items-center justify-between rounded-2xl bg-slate-100/70 p-3 text-sm dark:bg-slate-800/60">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-700 dark:text-slate-100">{localName}</p>
                                      {match?.equipo_local && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTeamPreview(match.equipo_local)}
                                          className="text-slate-500 transition hover:text-primary-600"
                                          title="Ver detalle rápido"
                                        >
                                          <EyeIcon className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                    {localResultLabel && (
                                      <Badge color={localResultLabel === 'ganado' ? 'success' : localResultLabel === 'empate' ? 'accent' : 'neutral'}>
                                        {localResultLabel === 'ganado'
                                          ? 'Ganó'
                                          : localResultLabel === 'empate'
                                          ? 'Empate'
                                          : 'Perdió'}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    {Number.isFinite(match?.puntaje_local) ? match.puntaje_local : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-slate-100/70 p-3 text-sm dark:bg-slate-800/60">
                                  <div className="space-y-1 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <p className="font-semibold text-slate-700 dark:text-slate-100">{visitorName}</p>
                                      {match?.equipo_visitante && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTeamPreview(match.equipo_visitante)}
                                          className="text-slate-500 transition hover:text-primary-600"
                                          title="Ver detalle rápido"
                                        >
                                          <EyeIcon className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                    {visitorResultLabel && (
                                      <Badge color={visitorResultLabel === 'ganado' ? 'success' : visitorResultLabel === 'empate' ? 'accent' : 'neutral'}>
                                        {visitorResultLabel === 'ganado'
                                          ? 'Ganó'
                                          : visitorResultLabel === 'empate'
                                          ? 'Empate'
                                          : 'Perdió'}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    {Number.isFinite(match?.puntaje_visitante) ? match.puntaje_visitante : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs text-slate-500 dark:text-slate-300">
                                  {match?.criterio_resultado && (
                                    <span className="mr-2">Criterio: {match.criterio_resultado}</span>
                                  )}
                                  {match?.ganador?.nombre_equipo && (
                                    <span className="font-semibold text-slate-700 dark:text-slate-100">
                                      Ganador: {match.ganador.nombre_equipo}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {canPublishNews && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePublishMatchNews(match.id)}
                                      disabled={publishingNewsId === match.id}
                                    >
                                      <NewspaperIcon className="mr-2 h-4 w-4" />
                                      {publishingNewsId === match.id ? 'Publicando…' : 'Publicar noticia'}
                                    </Button>
                                  )}
                                  {canEditResult && (
                                    <Button type="button" variant={match.estado === 'completado' ? 'ghost' : 'primary'} size="sm" onClick={() => handleOpenResultModal(match)}>
                                      {match.estado === 'completado' ? 'Editar resultado' : 'Registrar resultado'}
                                    </Button>
                                  )}
                                  {<Button
                                      size="sm"
                                      variant="outline" 
                                      onClick={() => setPerformanceModal({ open: true, match: match })}
                                    >
                                        MVP
                                    </Button>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                        No hay partidos que coincidan con los filtros seleccionados.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
                    Aún no se han programado partidos para el evento.
                  </p>
                )}
              </section>
            )}
          </>
        )}
        </div>
      </Card>
      <Modal
        isOpen={resultModal.open}
        onClose={handleCloseResultModal}
        onConfirm={handleSubmitResult}
        confirmLabel={resultModal.submitting ? 'Guardando…' : 'Guardar resultado'}
        confirmDisabled={resultModal.submitting || resultModal.loadingPlayers}
        title="Registrar resultado"
        description="Ingresa las estadísticas de los jugadores para calcular automáticamente el marcador."
        size="7xl"
      >
        {resultModal.loadingPlayers ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-slate-500">Cargando jugadores…</p>
          </div>
        ) : resultModal.playersConfig ? (
          <div className="space-y-6">
             {/* Debug info (hidden in prod) */}
             {/* <div className="text-xs text-slate-400">Sport detected: {resultModal.playersConfig.deporte_nombre}</div> */}
             
            <div className="flex flex-col gap-8 md:flex-row">
              {['local', 'visitor'].map((side) => {
                const teamId =
                  side === 'local'
                    ? resultModal.playersConfig.local_team_id
                    : resultModal.playersConfig.visitor_team_id;
                const teamName =
                  side === 'local'
                    ? resultModal.match?.equipo_local?.nombre_equipo
                    : resultModal.match?.equipo_visitante?.nombre_equipo;
                const players = (resultModal.playersConfig.players || []).filter(
                  (p) => p.equipo_id === teamId,
                );
                
                // Sport detection logic
                const sportName = (resultModal.playersConfig.deporte_nombre || '').toLowerCase();
                const isSoccer = sportName.includes('futs') || sportName.includes('fut') || sportName.includes('fútbol');
                
                console.log('Sport detected:', sportName);

                return (
                  <div key={side} className="flex-1 space-y-2">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 uppercase border-b pb-1 px-1">
                        {teamName}
                    </h4>
                    <div className="relative overflow-x-auto border rounded-xl shadow-sm bg-white dark:bg-slate-800">
                      <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 sticky top-0 z-20">
                          <tr>
                            <th className="px-3 py-3 sticky left-0 bg-slate-200 dark:bg-slate-800 z-30 border-r dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Jugador
                            </th>
                            {isSoccer ? (
                              <>
                                <th className="px-2 py-3 text-center min-w-[3rem] border-r dark:border-slate-600">G</th>
                                <th className="px-2 py-3 text-center min-w-[3rem] border-r dark:border-slate-600">TA</th>
                                <th className="px-2 py-3 text-center min-w-[3rem] border-r dark:border-slate-600">TR</th>
                              </>
                            ) : (
                              <>
                                <th className="px-2 py-3 text-center min-w-[3rem] border-r dark:border-slate-600">Pts</th>
                                <th className="px-2 py-3 text-center min-w-[3rem] border-r dark:border-slate-600">Faltas</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {players.map((p) => {
                            const stats = resultModal.playerStats[p.id] || {};
                            
                            // Handler uses functional update to avoid stale closures
                            const handleValChange = (field, valStr) => {
                              const val = valStr === '' ? 0 : Number(valStr);
                              setResultModal((prev) => ({
                                ...prev,
                                playerStats: {
                                  ...prev.playerStats,
                                  [p.id]: {
                                    ...prev.playerStats[p.id],
                                    [field]: val 
                                  },
                                },
                              }));
                            };

                            return (
                              <tr key={p.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 z-20 font-medium text-slate-700 dark:text-slate-200 border-r dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <div className="flex flex-col">
                                        <span>{p.nombres}</span>
                                        <span className="text-[10px] font-normal text-slate-400">{p.apellidos}</span>
                                    </div>
                                </td>
                                {isSoccer ? (
                                  <>
                                    <td className="px-1 py-1 text-center border-r dark:border-slate-700/50">
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500 hover:border-slate-300 transition-all font-semibold"
                                        value={stats.goles ?? ''}
                                        onChange={(e) => handleValChange('goles', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </td>
                                    <td className="px-1 py-1 text-center border-r dark:border-slate-700/50">
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-yellow-400 hover:border-slate-300 transition-all"
                                        value={stats.tarjetas_amarillas ?? ''}
                                        onChange={(e) => handleValChange('tarjetas_amarillas', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </td>
                                    <td className="px-1 py-1 text-center border-r dark:border-slate-700/50">
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-red-500 hover:border-slate-300 transition-all"
                                        value={stats.tarjetas_rojas ?? ''}
                                        onChange={(e) => handleValChange('tarjetas_rojas', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-1 py-1 text-center border-r dark:border-slate-700/50">
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500 hover:border-slate-300 transition-all font-semibold"
                                        value={stats.puntos ?? ''}
                                        onChange={(e) => handleValChange('puntos', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </td>
                                    <td className="px-1 py-1 text-center border-r dark:border-slate-700/50">
                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500 hover:border-slate-300 transition-all"
                                        value={stats.faltas ?? ''}
                                        onChange={(e) => handleValChange('faltas', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Criterio del resultado
                </label>
                <input
                  type="text"
                  maxLength={50}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  value={resultModal.criterio ?? ''}
                  onChange={(event) =>
                    setResultModal((prev) => ({ ...prev, criterio: event.target.value || '' }))
                  }
                  placeholder="Ej: Penales, Tiempo extra…"
                />
              </div>
              <div className="flex items-center">
                {!resultModal.match?.noticia_publicada ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(resultModal.publishNews)}
                      onChange={(event) =>
                        setResultModal((prev) => ({ ...prev, publishNews: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900"
                    />
                    Publicar resultado automáticamente en Noticias
                  </label>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    La noticia de este enfrentamiento ya fue publicada.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No se pudieron cargar los datos del partido.
          </p>
        )}
      </Modal>
      <Modal
        isOpen={standingsModal.open}
        onClose={handleCloseStandings}
        onConfirm={handleCloseStandings}
        confirmLabel="Cerrar"
        title="Tabla de posiciones"
        description="Consulta el rendimiento actualizado de los equipos por serie."
        size="lg"
      >
        {standingsModal.loading ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">Cargando posiciones…</p>
        ) : standingsModal.tables.length ? (
          <div className="space-y-4">
            {standingsModal.tables.map((table) => (
              <div
                key={table.serie ?? 'general'}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Serie {table.serie ?? 'General'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Resultados al día.</p>
                  </div>
                  <Badge color="primary">{table.posiciones?.length ?? 0} equipos</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-700">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Pos</th>
                        <th className="px-3 py-2 text-left">Equipo</th>
                        <th className="px-3 py-2 text-center">PJ</th>
                        <th className="px-3 py-2 text-center">G</th>
                        <th className="px-3 py-2 text-center">E</th>
                        <th className="px-3 py-2 text-center">P</th>
                        <th className="px-3 py-2 text-center">GF</th>
                        <th className="px-3 py-2 text-center">GC</th>
                        <th className="px-3 py-2 text-center">DG</th>
                        <th className="px-3 py-2 text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(table.posiciones ?? []).map((row, index) => (
                        <tr key={row.equipo_id ?? index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-100">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800 dark:text-white">
                              {row.equipo_nombre ?? 'Equipo sin nombre'}
                            </p>
                            {row.institucion_nombre && (
                              <p className="text-xs text-slate-500 dark:text-slate-300">{row.institucion_nombre}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{row.partidos_jugados ?? 0}</td>
                          <td className="px-3 py-2 text-center">{row.ganados ?? 0}</td>
                          <td className="px-3 py-2 text-center">{row.empatados ?? 0}</td>
                          <td className="px-3 py-2 text-center">{row.perdidos ?? 0}</td>
                          <td className="px-3 py-2 text-center">{row.goles_a_favor ?? 0}</td>
                          <td className="px-3 py-2 text-center">{row.goles_en_contra ?? 0}</td>
                          <td className="px-3 py-2 text-center font-semibold">{row.diferencia ?? 0}</td>
                          <td className="px-3 py-2 text-center font-bold text-primary-700 dark:text-primary-300">
                            {row.puntos ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Aún no hay resultados suficientes para generar la tabla de posiciones.
          </p>
        )}
      </Modal>
      <Modal
        isOpen={timelineModal.open}
        onClose={handleCloseTimelineModal}
        onConfirm={handleSaveTimeline}
        confirmLabel={savingTimeline ? 'Guardando…' : 'Actualizar fechas'}
        confirmDisabled={savingTimeline}
        title="Actualizar cronograma"
        description="Extiende el cierre de inscripción o auditoría. Si las nuevas fechas chocan con el campeonato podrás ajustarlas aquí mismo."
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Inicio de inscripción</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_inscripcion_inicio ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_inscripcion_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Cierre de inscripción</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_inscripcion_fin ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_inscripcion_fin', event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Inicio de auditoría</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_auditoria_inicio ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_auditoria_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Fin de auditoría</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_auditoria_fin ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_auditoria_fin', event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Inicio del campeonato</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_campeonato_inicio ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_campeonato_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Fin del campeonato</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_campeonato_fin ?? ''}
                onChange={(event) => handleTimelineFieldChange('fecha_campeonato_fin', event.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={addInstitutionModal.open}
        onClose={handleCloseAddInstitution}
        title="Agregar institución invitada"
        description="Selecciona una institución activa para enviar la invitación automáticamente."
        confirmLabel="Invitar institución"
        confirmVariant="primary"
        confirmDisabled={addingInstitution || !addInstitutionModal.selected}
        confirmLoading={addingInstitution}
        onConfirm={handleConfirmAddInstitution}
      >
        {loadingSelectableInstitutions ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">Cargando instituciones disponibles…</p>
        ) : availableInstitutionOptions.length ? (
          <Select
            label="Institución"
            value={addInstitutionModal.selected}
            onChange={(value) => setAddInstitutionModal((prev) => ({ ...prev, selected: value }))}
            options={availableInstitutionOptions}
            placeholder="Selecciona una institución"
            className="w-full pb-10"
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            No hay instituciones activas disponibles para invitar en este momento.
          </p>
        )}
      </Modal>
      <Modal
        isOpen={teamPreview.open}
        onClose={handleCloseTeamPreview}
        onConfirm={handleCloseTeamPreview}
        confirmLabel="Cerrar"
        title={teamPreview.team?.nombre_equipo ?? 'Institución participante'}
        description="Consulta información rápida del equipo dentro del evento."
      >
        {teamPreview.team ? (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>
              Partidos ganados:{' '}
              <span className="font-semibold">
                {teamPreview.stats?.wins ?? 0}
              </span>{' '}
              de {teamPreview.stats?.played ?? 0}
            </p>
            <div>
              <p className="font-semibold">Historial reciente</p>
              {teamPreview.stats?.history?.length ? (
                <ul className="mt-2 space-y-1">
                  {teamPreview.stats.history.slice(-5).map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/60">
                      <div>
                        <p className="font-medium">vs {item.opponent}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          {item.date ? formatDate(item.date) : 'Fecha por confirmar'} · Resultado: {item.result}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">{item.score}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">Aún no registra enfrentamientos.</p>
              )}
            </div>
            <div>
              <p className="font-semibold">Estudiantes registrados</p>
              {teamPreview.stats?.students?.length ? (
                <ul className="mt-2 grid gap-1 md:grid-cols-2">
                  {teamPreview.stats.students.slice(0, 8).map((student) => (
                    <li key={student.id} className="rounded-lg bg-slate-100/60 px-3 py-2 text-xs dark:bg-slate-800/50">
                      {student.nombres} {student.apellidos}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">Sin estudiantes registrados para este equipo.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Selecciona un equipo para ver su detalle.</p>
        )}
      </Modal>
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Generar calendario automático"
        description="Configura parámetros opcionales para la programación. Deja los campos vacíos para reutilizar la configuración vigente."
        confirmLabel="Generar"
        confirmVariant="primary"
        confirmLoading={generatingSchedule}
        confirmDisabled={generatingSchedule}
        onConfirm={handleGenerateSchedule}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Hora de inicio
            </label>
            <input
              type="time"
              value={scheduleForm.horaInicio}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, horaInicio: event.target.value }))
              }
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-white p-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Hora de finalización
            </label>
            <input
              type="time"
              value={scheduleForm.horaFin}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, horaFin: event.target.value }))
              }
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-white p-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Duración por partido (horas)
            </label>
            <input
              type="number"
              min="1"
              value={scheduleForm.duracionHoras}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, duracionHoras: event.target.value }))
              }
              placeholder="Ej. 2"
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-white p-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Descanso mínimo (días)
            </label>
            <input
              type="number"
              min="0"
              value={scheduleForm.descansoMinDias}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, descansoMinDias: event.target.value }))
              }
              placeholder="Ej. 1"
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-white p-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          {allowInitialSchedule && schedule.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scheduleForm.force}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, force: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900"
              />
              Reemplazar el calendario existente
            </label>
          )}
        </div>
      </Modal>


      {/* Modal de Performance MVP Integrado - Tabla Ancha */}
      <Modal
        isOpen={performanceModal.open}
        onClose={() => setPerformanceModal({ open: false, match: null })}
        title="Estadísticas de Partido"
        description="Edita las métricas de rendimiento para todos los jugadores."
        size="7xl"
        footer={
          <div className="flex justify-end gap-3 mt-4">
             <Button 
                variant="outline" 
                onClick={() => setPerformanceModal({ open: false, match: null })}
                disabled={loadingPerformance || savingPerformance}
             >
                Cerrar
             </Button>
             <Button 
                variant="accent" 
                onClick={handleCalculateMVP}
                disabled={loadingPerformance || savingPerformance}
             >
                {loadingPerformance ? 'Calculando...' : 'Seleccionar MVP'}
             </Button>
             <Button 
                variant="primary" 
                onClick={handleSavePerformance}
                disabled={loadingPerformance || savingPerformance}
             >
                {savingPerformance ? 'Guardando...' : 'Guardar'}
             </Button>
          </div>
        }
      >
        {loadingPerformance ? (
          <p className="text-center p-4 text-slate-500">Preparando tabla de jugadores...</p>
        ) : (
          <div className="flex flex-col gap-4 h-[70vh]">
            
            {/* Tabs de Navegación */}
            <div className="flex space-x-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-700/50">
                {MVP_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActivePerformanceTab(tab.id)}
                        className={`
                            w-full rounded-lg py-2.5 text-sm font-medium leading-5
                            ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                            ${
                            activePerformanceTab === tab.id
                                ? 'bg-white text-primary-700 shadow dark:bg-slate-800 dark:text-primary-300'
                                : 'text-slate-600 hover:bg-white/[0.12] hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {['Local', 'Visitante'].map((teamType) => {
                const isLocalTeam = teamType === 'Local';
                const teamName = isLocalTeam 
                    ? performanceModal.match?.equipo_local?.nombre_equipo 
                    : performanceModal.match?.equipo_visitante?.nombre_equipo;
                
                // Filtrar jugadores por equipo
                const teamPlayers = playersStats.filter(p => p.isLocal === isLocalTeam);
                
                // Filtrar campos por la pestaña activa
                const currentFields = MVP_FIELDS_CONFIG.filter(f => f.tab === activePerformanceTab);
                
                // Flatten fields for table header
                const tableColumns = currentFields.flatMap(g => g.fields.map(f => ({ key: f, ...g })));

                if (teamPlayers.length === 0) return (
                    <div key={teamType} className="text-sm text-slate-400 p-2">
                        No hay jugadores registrados en el equipo {teamType}.
                    </div>
                );

                return (
                    <div key={teamType} className="space-y-2">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 uppercase border-b pb-1 px-1">
                        {teamName || 'Equipo'}
                    </h3>
                    
                    {/* Contenedor con scroll horizontal para la tabla */}
                    <div className="relative overflow-x-auto border rounded-2xl shadow-sm bg-white dark:bg-slate-800">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 sticky top-0 z-20">
                            <tr>
                            {/* Columna Fija: Nombre del Jugador */}
                            <th className="px-3 py-3 sticky left-0 bg-slate-200 dark:bg-slate-800 z-30 border-r dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-48">
                                Jugador
                            </th>
                            {/* Columnas Dinámicas de Estadísticas */}
                            {tableColumns.map(f => (
                                <th key={f.key} className="px-2 py-3 text-center min-w-[6rem] border-r dark:border-slate-600 last:border-0" title={f.key}>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="font-bold">
                                            {f.key === 'role_selection' ? 'Posición' : f.key.replace('role_', '').replace(/_/g, ' ').substring(0, 10)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal lowercase">{f.section}</span>
                                    </div>
                                </th>
                            ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {teamPlayers.map(player => (
                            <tr key={player.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                {/* Celda Fija: Nombre del Jugador */}
                                <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 z-20 font-medium text-slate-700 dark:text-slate-200 border-r dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="flex items-center gap-2">
                                    <div className="truncate w-40" title={player.nombre}>
                                        {player.nombre}
                                    </div>
                                    {player.mvp && <span className="flex-shrink-0 inline-flex items-center rounded-md bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800 border border-yellow-200">MVP</span>}
                                </div>
                                </td>
                                {/* Celdas de Inputs */}
                                {tableColumns.map(f => (
                                <td key={f.key} className={`px-1 py-1 text-center border-r dark:border-slate-700/50 last:border-0 ${f.key === 'rating' ? 'bg-slate-50 dark:bg-slate-800' : ''}`}>
                                    {f.type === 'select' ? (
                                        <select
                                            className="w-full text-xs border-0 rounded px-1 py-1 bg-transparent focus:ring-1 focus:ring-primary-500 cursor-pointer"
                                            value={player[f.key] || ''}
                                            onChange={(e) => handlePerformanceStatChange(player.id, f.key, e.target.value, 'select')}
                                            disabled={loadingPerformance}
                                        >
                                            {f.options.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : f.type === 'checkbox' ? (
                                    <div className="flex justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-50"
                                            checked={!!player[f.key]}
                                            onChange={(e) => handlePerformanceStatChange(player.id, f.key, e.target.checked, 'checkbox')}
                                            disabled={loadingPerformance} 
                                        />
                                    </div>
                                    ) : (
                                    <input 
                                        type="number" 
                                        className={`w-full min-w-[3rem] text-center text-xs border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none transition-all ${f.readOnly ? 'font-bold text-slate-500 cursor-not-allowed' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500'}`}
                                        value={player[f.key]}
                                        onChange={(e) => !f.readOnly && handlePerformanceStatChange(player.id, f.key, e.target.value, 'number')}
                                        onFocus={(e) => !f.readOnly && e.target.select()}
                                        readOnly={f.readOnly}
                                        disabled={loadingPerformance} 
                                    />
                                    )}
                                </td>
                                ))}
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    </div>
                );
                })}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
