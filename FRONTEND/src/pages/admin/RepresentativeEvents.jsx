import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardFooter } from '../../components/ui/Card.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { eventService, studentService } from '../../services/dataService.js';
import { useToastContext } from '../../context/ToastContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { resolveMediaUrl } from '../../utils/media.js';
import { formatAgeRange, resolveAgeRange } from '../../utils/age.js';

const formatStage = (stage) => {
  switch ((stage ?? '').toLowerCase()) {
    case 'borrador':
      return 'Planificación';
    case 'inscripcion':
      return 'Inscripción abierta';
    case 'auditoria':
      return 'En auditoría';
    case 'campeonato':
      return 'Campeonato en curso';
    case 'finalizado':
      return 'Evento finalizado';
    case 'archivado':
      return 'Evento archivado';
    default:
      return 'Etapa no disponible';
  }
};

const formatDate = (value) => {
  if (!value) return 'Sin definir';
  try {
    return new Date(value).toLocaleDateString('es-EC');
  } catch (error) {
    return String(value);
  }
};

const STAGE_TABS = [
  { id: 'inscripcion', label: 'Inscripción' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'campeonato', label: 'Campeonato' },
  { id: 'borrador', label: 'Próximos' },
  { id: 'finalizado', label: 'Finalizados' },
  { id: 'archivado', label: 'Archivados' },
];

const STAGE_ORDER = STAGE_TABS.map((tab) => tab.id);

const STAGE_COLORS = {
  inscripcion: 'accent',
  auditoria: 'warning',
  campeonato: 'success',
  borrador: 'neutral',
  finalizado: 'neutral',
  archivado: 'neutral',
};

const EVENT_STAGE_TABS = [
  { id: 'inscripcion', label: 'Inscripción' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'campeonato', label: 'Campeonato' },
];

const PHASE_COLORS = {
  group: 'neutral',
  quarterfinal: 'accent',
  semifinal: 'warning',
  final: 'primary',
  third_place: 'success',
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

const resolveTeamName = (team, placeholder) =>
  team?.nombre_equipo ?? placeholder ?? 'Equipo por definir';

const AUDIT_STATUS_META = {
  aprobada: { label: 'Documentación aprobada', color: 'success' },
  correccion: { label: 'Correcciones solicitadas', color: 'warning' },
  rechazada: { label: 'Auditoría rechazada', color: 'danger' },
  pendiente: { label: 'En revisión', color: 'neutral' },
};

const DOCUMENT_STATUS_META = {
  aprobado: { label: 'Aprobado', color: 'success' },
  correccion: { label: 'Corrección', color: 'warning' },
  rechazada: { label: 'Rechazado', color: 'danger' },
  pendiente: { label: 'Pendiente', color: 'neutral' },
};

const getStageKey = (stage) => {
  const normalized = (stage ?? '').toLowerCase();
  return STAGE_ORDER.includes(normalized) ? normalized : 'borrador';
};

const PARTICIPANTS_PER_PAGE = 4;

export const RepresentativeEvents = () => {
  const { addToast } = useToastContext();
  const { user } = useAuth();
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingRegistration, setLoadingRegistration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingRegistration, setSyncingRegistration] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [activeStage, setActiveStage] = useState('inscripcion');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [students, setStudents] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loadingDocumentTypes, setLoadingDocumentTypes] = useState(true);
  const [documentQueue, setDocumentQueue] = useState([]);
  const [documentUploadResults, setDocumentUploadResults] = useState([]);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [debouncedParticipantSearch, setDebouncedParticipantSearch] =
    useState('');
  const [participantPage, setParticipantPage] = useState(1);
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);
  const [loadingEventDetail, setLoadingEventDetail] = useState(false);
  const [eventDetailsCache, setEventDetailsCache] = useState({});
  const [currentEventDetail, setCurrentEventDetail] = useState(null);
  const [activeEventTab, setActiveEventTab] = useState('inscripcion');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleMatches, setScheduleMatches] = useState([]);
    const [resultModal, setResultModal] = useState({
      open: false,
      match: null,
      localScore: '',
      visitorScore: '',
      winnerId: null,
      criterio: 'puntos',
      publishNews: true,
      submitting: false,
    });
    const [publishingNewsId, setPublishingNewsId] = useState(null);

  const institutionId = user?.institucion_id ?? null;

  const fetchInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const data = await eventService.listMyInvitations();
      setInvitations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('No se pudieron cargar las invitaciones', error);
      addToast({
        title: 'Error al cargar invitaciones',
        description: error.message,
        status: 'error',
      });
    } finally {
      setLoadingInvitations(false);
    }
  };

  const fetchStudents = async () => {
    if (!institutionId) return;
    try {
      const list = await studentService.list({
        page_size: 100,
        institucion_id: institutionId,
      });
      setStudents(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('No se pudieron cargar los estudiantes', error);
      addToast({
        title: 'Error al cargar estudiantes',
        description: error.message,
        status: 'error',
      });
    }
  };

  const loadDocumentTypes = async () => {
    try {
      setLoadingDocumentTypes(true);
      const types = await eventService.listDocumentTypes();
      setDocumentTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error('No se pudieron cargar los tipos de documento', error);
      addToast({
        title: 'Error al cargar requisitos',
        description: error.message,
        status: 'error',
      });
    } finally {
      setLoadingDocumentTypes(false);
    }
  };

  const fetchRegistration = async (eventId) => {
    if (!eventId) {
      setSnapshot(null);
      setSelectedStudentIds([]);
      return;
    }
    try {
      setLoadingRegistration(true);
      const data = await eventService.getMyRegistration(eventId);
      setSnapshot(data ?? null);
      const registeredStudents = Array.isArray(data?.estudiantes)
        ? data.estudiantes
            .map((student) => Number(student.id))
            .filter((studentId) => Number.isFinite(studentId) && studentId > 0)
        : [];
      setSelectedStudentIds(Array.from(new Set(registeredStudents)));
    } catch (error) {
      console.error('No se pudo cargar la inscripción', error);
      addToast({
        title: 'Error al cargar inscripción',
        description: error.message,
        status: 'error',
      });
    } finally {
      setLoadingRegistration(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
    fetchStudents();
    loadDocumentTypes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEventId) {
      fetchRegistration(selectedEventId);
    }
  }, [selectedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedParticipantSearch(participantSearch.trim().toLowerCase());
      setParticipantPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [participantSearch]);

  useEffect(() => {
    setParticipantSearch('');
    setParticipantPage(1);
  }, [selectedEventId]);

  useEffect(() => {
    setDocumentQueue([]);
    setDocumentUploadResults([]);
  }, [selectedEventId]);

  useEffect(() => {
    const allowedIds = new Set(selectedStudentIds);
    setDocumentQueue((current) =>
      current.filter((item) => allowedIds.has(item.studentId)),
    );
    setDocumentUploadResults((current) =>
      current.filter((item) => allowedIds.has(item.studentId)),
    );
  }, [selectedStudentIds]);

  const currentStage = ['inscripcion', 'auditoria', 'campeonato'].includes(
    (snapshot?.etapa_actual ?? '').toLowerCase(),
  )
    ? (snapshot?.etapa_actual ?? '').toLowerCase()
    : 'inscripcion';
  useEffect(() => {
    if (!currentStage) return;
    setActiveEventTab(currentStage);
  }, [currentStage]);

  useEffect(() => {
    if (activeEventTab !== 'campeonato' || !selectedEventId) {
      setScheduleMatches([]);
      return;
    }
    let cancelled = false;
    const loadSchedule = async () => {
      try {
        setLoadingSchedule(true);
        const { matches } = await eventService.getSchedule(selectedEventId);
        if (cancelled) return;
        setScheduleMatches(Array.isArray(matches) ? matches : []);
      } catch (error) {
        if (cancelled) return;
        console.error('No se pudo cargar el calendario', error);
        addToast({
          title: 'Error al cargar calendario',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
      } finally {
        if (!cancelled) {
          setLoadingSchedule(false);
        }
      }
    };
    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [activeEventTab, selectedEventId, addToast]);

  const updateScheduleMatch = (updatedMatch) => {
    setScheduleMatches((prev) => {
      if (!updatedMatch) return prev;
      const exists = prev.some((item) => item.id === updatedMatch.id);
      if (exists) {
        return prev.map((item) => (item.id === updatedMatch.id ? updatedMatch : item));
      }
      return [...prev, updatedMatch];
    });
  };

  const canRegisterResult = (match) => {
    if (!match) return false;
    const estado = (match.estado ?? '').toLowerCase();
    if (['finalizado', 'completado'].includes(estado)) return false;
    const stageAllowed = ['campeonato', 'finalizado'].includes((currentStage ?? '').toLowerCase());
    if (!stageAllowed) return false;
    const involvesInstitution =
      match?.equipo_local?.institucion_id === institutionId
      || match?.equipo_visitante?.institucion_id === institutionId;
    if (!involvesInstitution) return false;
    if (!match.fecha) return true;
    const scheduled = new Date(`${match.fecha}T${match.hora ?? '00:00'}`);
    if (Number.isNaN(scheduled.getTime())) return stageAllowed;
    return scheduled.getTime() <= Date.now();
  };

  const handleOpenResultModal = (match) => {
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
      });
    };

  const handleCloseResultModal = () => {
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
};

  const handleSubmitResult = async () => {
    if (!selectedEventId || !resultModal.match) return;
    const localScore = Number(resultModal.localScore);
    const visitorScore = Number(resultModal.visitorScore);
    if (!Number.isFinite(localScore) || localScore < 0 || !Number.isFinite(visitorScore) || visitorScore < 0) {
      addToast({
        title: 'Revisa los puntajes',
        description: 'Los puntajes deben ser números positivos.',
        status: 'warning',
      });
      return;
    }
    const winnerId = Number(resultModal.winnerId);
    if (!Number.isFinite(winnerId)) {
      addToast({
        title: 'Selecciona al equipo ganador',
        description: 'Elige uno de los equipos participantes.',
        status: 'warning',
      });
      return;
    }
    setResultModal((prev) => ({ ...prev, submitting: true }));
    try {
      const { match: updated, meta } = await eventService.registerMatchResult(selectedEventId, resultModal.match.id, {
        puntaje_local: localScore,
        puntaje_visitante: visitorScore,
        criterio_resultado: resultModal.criterio,
        ganador_inscripcion_id: winnerId,
        publicar_noticia: Boolean(resultModal.publishNews),
      });
      updateScheduleMatch(updated);
      addToast({
        title: 'Resultado registrado',
        description: 'El marcador se guardó correctamente.',
        status: 'success',
      });
      if (meta?.extra?.news_id) {
        addToast({
          title: 'Noticia publicada',
          description: 'El resultado se compartió en la sección pública de noticias.',
          status: 'info',
        });
      }
      handleCloseResultModal();
    } catch (error) {
      addToast({
        title: 'No se pudo registrar el resultado',
        description: error?.message ?? 'Inténtalo nuevamente en unos minutos.',
        status: 'error',
      });
      } finally {
        setResultModal((prev) => ({ ...prev, submitting: false }));
      }
    };

    const handlePublishMatchNews = async (matchId) => {
      if (!selectedEventId || !matchId) return;
      setPublishingNewsId(matchId);
      try {
        const { match: updated, meta } = await eventService.publishMatchNews(
          selectedEventId,
          matchId,
        );
        if (updated) {
          updateScheduleMatch(updated);
          addToast({
            title: 'Noticia publicada',
            description: 'El resultado se compartió en Noticias y en la página pública.',
            status: 'success',
          });
          if (meta?.extra?.news_id) {
            addToast({
              title: 'Publicación creada',
              description: 'La nota ya está disponible en el módulo de Noticias.',
              status: 'info',
            });
          }
        }
      } catch (error) {
        addToast({
          title: 'No se pudo publicar la noticia',
          description: error?.message ?? 'Inténtalo nuevamente en unos minutos.',
          status: 'error',
        });
      } finally {
        setPublishingNewsId(null);
      }
    };

  const auditState = (snapshot?.estado_auditoria ?? '').toLowerCase();
  const canManageRegistration =
    currentStage === 'inscripcion' ||
    (currentStage === 'auditoria' &&
      ['pendiente', 'correccion', 'aprobada'].includes(auditState));
  const isLocked =
    Boolean(snapshot?.edicion_bloqueada) || !canManageRegistration;

  const invitationsByStage = useMemo(() => {
    const groups = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, []]));
    for (const invitation of invitations) {
      const key = getStageKey(invitation?.etapa_actual);
      groups[key].push(invitation);
    }
    return groups;
  }, [invitations]);

  const availableStages = useMemo(
    () =>
      STAGE_ORDER.filter(
        (stage) => (invitationsByStage[stage] ?? []).length > 0,
      ),
    [invitationsByStage],
  );

  const stageInvitations = useMemo(
    () => invitationsByStage[activeStage] ?? [],
    [activeStage, invitationsByStage],
  );

  const cachedSelectedEventDetail = useMemo(
    () =>
      selectedEventId
        ? eventDetailsCache[String(selectedEventId)] ?? null
        : null,
    [eventDetailsCache, selectedEventId],
  );

  useEffect(() => {
    if (!invitations.length) {
      setActiveStage('inscripcion');
      setSelectedEventId(null);
      return;
    }
    if (!availableStages.includes(activeStage)) {
      const nextStage = availableStages[0] ?? 'inscripcion';
      setActiveStage(nextStage);
    }
  }, [availableStages, activeStage, invitations.length]);

  useEffect(() => {
    if (!stageInvitations.length) {
      setSelectedEventId(null);
      return;
    }
    if (
      !stageInvitations.some(
        (invitation) => invitation.evento_id === selectedEventId,
      )
    ) {
      setSelectedEventId(stageInvitations[0]?.evento_id ?? null);
    }
  }, [stageInvitations, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setCurrentEventDetail(null);
      return;
    }
    if (cachedSelectedEventDetail) {
      setCurrentEventDetail(cachedSelectedEventDetail);
      return;
    }

    let cancelled = false;
    const cacheKey = String(selectedEventId);

    const loadDetail = async () => {
      try {
        const detail = await eventService.getById(selectedEventId);
        if (cancelled) return;
        setEventDetailsCache((prev) => ({ ...prev, [cacheKey]: detail }));
        setCurrentEventDetail(detail ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error(
          'No se pudo cargar el detalle del evento seleccionado',
          error,
        );
        addToast({
          title: 'Error al obtener detalles del evento',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          status: 'error',
        });
        setCurrentEventDetail(null);
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId, cachedSelectedEventDetail, addToast]);
  const ageRange = useMemo(
    () => resolveAgeRange(currentEventDetail ?? snapshot ?? null),
    [currentEventDetail, snapshot],
  );
  const groupedSchedule = useMemo(() => {
    return scheduleMatches.reduce((acc, match) => {
      const key = match.fecha ?? 'Por definir';
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});
  }, [scheduleMatches]);
  const ageFilterConfig = useMemo(() => {
    const categoriesSource = Array.isArray(currentEventDetail?.categorias)
      ? currentEventDetail.categorias
      : Array.isArray(snapshot?.categorias)
      ? snapshot.categorias
      : [];
    const categories = categoriesSource ?? [];
    const hasUnboundedCategory = categories.some(
      (category) =>
        category &&
        category.edad_minima == null &&
        category.edad_maxima == null,
    );
    const bounds = categories
      .filter(
        (category) =>
          category &&
          (category.edad_minima != null || category.edad_maxima != null),
      )
      .map((category) => ({
        min: category.edad_minima ?? null,
        max: category.edad_maxima ?? null,
      }));
    const shouldFilter = bounds.length > 0 && !hasUnboundedCategory;
    const referenceRaw =
      currentEventDetail?.fecha_campeonato_inicio ??
      currentEventDetail?.fecha_auditoria_inicio ??
      currentEventDetail?.fecha_inscripcion_fin ??
      currentEventDetail?.fecha_inscripcion_inicio ??
      null;
    const parsedReference = referenceRaw ? new Date(referenceRaw) : new Date();
    const referenceDate = Number.isNaN(parsedReference.getTime())
      ? new Date()
      : parsedReference;
    return {
      shouldFilter,
      bounds,
      referenceDate,
    };
  }, [currentEventDetail, snapshot]);

  const availableStudents = useMemo(() => {
    const list = Array.isArray(students) ? students : [];
    const normalizedSex = (snapshot?.sexo_evento ?? 'MX')
      ?.toString()
      .toUpperCase();

    const calculateAge = (birthDateValue) => {
      if (!birthDateValue) return null;
      const birthDate = new Date(birthDateValue);
      if (Number.isNaN(birthDate.getTime())) {
        return null;
      }
      let age =
        ageFilterConfig.referenceDate.getFullYear() - birthDate.getFullYear();
      const hasHadBirthday =
        ageFilterConfig.referenceDate.getMonth() > birthDate.getMonth() ||
        (ageFilterConfig.referenceDate.getMonth() === birthDate.getMonth() &&
          ageFilterConfig.referenceDate.getDate() >= birthDate.getDate());
      if (!hasHadBirthday) {
        age -= 1;
      }
      return age;
    };

    return list.filter((student) => {
      if (normalizedSex && normalizedSex !== 'MX') {
        const studentGender = (student.genero ?? '').toString().toUpperCase();
        if (studentGender !== normalizedSex) {
          return false;
        }
      }

      if (ageFilterConfig.shouldFilter) {
        const age = calculateAge(student.fecha_nacimiento);
        if (age == null) {
          return false;
        }
        const matchesAge = ageFilterConfig.bounds.some(({ min, max }) => {
          if (min != null && age < min) return false;
          if (max != null && age > max) return false;
          return true;
        });
        if (!matchesAge) {
          return false;
        }
      }

      return true;
    });
  }, [students, snapshot, ageFilterConfig]);

  useEffect(() => {
    const allowedIds = new Set(availableStudents.map((student) => student.id));
    setSelectedStudentIds((current) => {
      const filtered = current.filter((id) => allowedIds.has(id));
      return filtered.length === current.length ? current : filtered;
    });
  }, [availableStudents]);
  const studentMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(students) ? students : []).forEach((student) => {
      map.set(student.id, student);
    });
    return map;
  }, [students]);

  const ageFilterActive = ageFilterConfig.shouldFilter;
  const studentDocuments = useMemo(() => {
    const map = new Map();
    (snapshot?.estudiantes ?? []).forEach((student) => {
      map.set(
        student.id,
        Array.isArray(student.documentos) ? student.documentos : [],
      );
    });
    return map;
  }, [snapshot]);

  const registeredStudentIds = useMemo(
    () => new Set((snapshot?.estudiantes ?? []).map((student) => student.id)),
    [snapshot],
  );

  const queuedDocumentsByKey = useMemo(() => {
    const map = new Map();
    documentQueue.forEach((item) => {
      const key = `${item.studentId}-${item.documentType}`;
      map.set(key, item);
    });
    return map;
  }, [documentQueue]);

  const uploadResultsByKey = useMemo(() => {
    const map = new Map();
    documentUploadResults.forEach((result) => {
      const key = `${result.studentId}-${result.documentType}`;
      map.set(key, result);
    });
    return map;
  }, [documentUploadResults]);

  const uploadResultSummary = useMemo(() => {
    let success = 0;
    let failure = 0;

    documentUploadResults.forEach((result) => {
      if (result.success) {
        success += 1;
      } else {
        failure += 1;
      }
    });

    return { success, failure, total: documentUploadResults.length };
  }, [documentUploadResults]);

  const totalQueuedDocuments = documentQueue.length;
  const hasQueuedDocuments = totalQueuedDocuments > 0;

  const participantRecords = useMemo(() => {
    return (Array.isArray(selectedStudentIds) ? selectedStudentIds : []).map(
      (studentId) => {
        const studentInfo = studentMap.get(studentId);
        const documents = studentDocuments.get(studentId) ?? [];
        const membershipExists = registeredStudentIds.has(studentId);
        return {
          id: studentId,
          info: studentInfo,
          documents,
          membershipExists,
        };
      },
    );
  }, [selectedStudentIds, studentMap, studentDocuments, registeredStudentIds]);

  const filteredParticipants = useMemo(() => {
    if (!debouncedParticipantSearch) return participantRecords;
    return participantRecords.filter(({ info }) => {
      const fullText = `${info?.nombres ?? ''} ${info?.apellidos ?? ''} ${
        info?.documento_identidad ?? ''
      }`.toLowerCase();
      return fullText.includes(debouncedParticipantSearch);
    });
  }, [participantRecords, debouncedParticipantSearch]);

  const totalParticipantPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil((filteredParticipants.length || 0) / PARTICIPANTS_PER_PAGE),
      ),
    [filteredParticipants],
  );

  useEffect(() => {
    if (participantPage > totalParticipantPages) {
      setParticipantPage(totalParticipantPages);
    }
  }, [participantPage, totalParticipantPages]);

  const paginatedParticipants = useMemo(() => {
    const start = (participantPage - 1) * PARTICIPANTS_PER_PAGE;
    return filteredParticipants.slice(start, start + PARTICIPANTS_PER_PAGE);
  }, [filteredParticipants, participantPage]);

  const totalParticipants = useMemo(
    () => (Array.isArray(selectedStudentIds) ? selectedStudentIds.length : 0),
    [selectedStudentIds],
  );

  const handleOpenEventDetail = async (eventIdOverride = null) => {
    const targetEventId = eventIdOverride ?? selectedEventId;
    if (!targetEventId) return;
    const cacheKey = String(targetEventId);
    const cached = eventDetailsCache[cacheKey];
    if (cached) {
      setEventDetail(cached);
      setEventDetailModalOpen(true);
      return;
    }
    setEventDetail(null);
    setEventDetailModalOpen(true);
    setLoadingEventDetail(true);
    try {
      const detail = await eventService.getById(targetEventId);
      setEventDetail(detail);
      setEventDetailsCache((prev) => ({ ...prev, [cacheKey]: detail }));
      if (targetEventId === selectedEventId) {
        setCurrentEventDetail(detail);
      }
    } catch (error) {
      console.error('No se pudo cargar el detalle del evento', error);
      addToast({
        title: 'No se pudo cargar el evento',
        description: error?.message ?? 'Intenta nuevamente más tarde.',
        status: 'error',
      });
      setEventDetail(null);
    } finally {
      setLoadingEventDetail(false);
    }
  };

  const buildRegistrationPayload = () => {
    if (!Array.isArray(selectedStudentIds)) {
      return { estudiantes: [] };
    }
    const normalized = selectedStudentIds
      .map((studentId) => Number(studentId))
      .filter((studentId) => Number.isFinite(studentId) && studentId > 0);
    return { estudiantes: normalized };
  };

  const persistRegistration = async ({
    silent = false,
    showToast = true,
  } = {}) => {
    if (!selectedEventId) return null;
    const setBusy = silent ? setSyncingRegistration : setSaving;
    setBusy(true);
    try {
      const payload = buildRegistrationPayload();
      const response = await eventService.updateMyRegistration(
        selectedEventId,
        payload,
      );
      if (showToast) {
        addToast({ title: 'Inscripción actualizada', status: 'success' });
      }
      await fetchRegistration(selectedEventId);
      return response;
    } catch (error) {
      console.error('No se pudo guardar la inscripción', error);
      addToast({
        title: showToast
          ? 'Error al guardar'
          : 'No se pudo sincronizar la inscripción',
        description: error.message,
        status: 'error',
      });
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEventId) return;
    try {
      await persistRegistration();
    } catch (error) {
      // El manejo de errores se realiza dentro de persistRegistration
    }
  };

  const handleRemoveStudent = (studentId) => {
    if (isLocked) return;
    setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
  };

  const queueDocumentSelection = (studentId, documentType, file) => {
    if (!file || !selectedEventId) return;

    const isPdf =
      file.type === 'application/pdf' ||
      (file.name && file.name.toLowerCase().endsWith('.pdf'));

    if (!isPdf) {
      const message = 'Solo se permiten archivos en formato PDF.';
      addToast({
        title: 'Formato incorrecto',
        description: message,
        status: 'warning',
      });
      setDocumentUploadResults((prev) => [
        ...prev.filter(
          (item) =>
            item.studentId !== studentId || item.documentType !== documentType,
        ),
        {
          studentId,
          documentType,
          success: false,
          message,
        },
      ]);
      return;
    }

    setDocumentQueue((prev) => {
      const next = prev.filter(
        (item) =>
          item.studentId !== studentId || item.documentType !== documentType,
      );
      next.push({ studentId, documentType, file });
      return next;
    });
    setDocumentUploadResults((prev) =>
      prev.filter(
        (item) =>
          item.studentId !== studentId || item.documentType !== documentType,
      ),
    );
  };

  const handleClearQueuedDocuments = () => {
    setDocumentQueue([]);
  };

  const handleSendQueuedDocuments = async () => {
    if (!selectedEventId || !hasQueuedDocuments) return;
    setSendingDocuments(true);
    try {
      const hasPendingMembership = documentQueue.some(
        (item) => !registeredStudentIds.has(item.studentId),
      );

      if (hasPendingMembership) {
        try {
          await persistRegistration({ silent: true, showToast: false });
          await fetchRegistration(selectedEventId);
        } catch (syncError) {
          setSendingDocuments(false);
          addToast({
            title: 'No se pudo sincronizar la inscripción',
            description: syncError.message,
            status: 'error',
          });
          return;
        }
      }

      const formData = new FormData();
      const metadata = documentQueue.map((item) => ({
        estudiante_id: item.studentId,
        tipo_documento: item.documentType,
      }));
      formData.append('metadata', JSON.stringify({ documentos: metadata }));
      documentQueue.forEach(({ file }, index) => {
        formData.append(
          'archivos',
          file,
          file.name || `documento-${index + 1}.pdf`,
        );
      });

      const response = await eventService.uploadStudentDocumentsBatch(
        selectedEventId,
        formData,
      );

      const results = Array.isArray(response?.resultados)
        ? response.resultados.map((item) => ({
            studentId: item.estudiante_id,
            documentType: item.tipo_documento,
            success: Boolean(item.exito),
            message: item.mensaje ?? '',
          }))
        : [];

      setDocumentUploadResults(results);

      const successfulKeys = new Set(
        results
          .filter((item) => item.success)
          .map((item) => `${item.studentId}-${item.documentType}`),
      );
      setDocumentQueue((prev) =>
        prev.filter(
          (item) =>
            !successfulKeys.has(`${item.studentId}-${item.documentType}`),
        ),
      );

      const summary = response?.resumen;
      if (summary?.exitosos) {
        addToast({
          title: 'Documentos cargados',
          description: `${summary.exitosos} documento(s) cargados correctamente.`,
          status: 'success',
        });
      }
      if (summary?.fallidos) {
        addToast({
          title: 'Algunos documentos no se cargaron',
          description:
            summary.fallidos === 1
              ? '1 documento presentó errores.'
              : `${summary.fallidos} documentos presentaron errores.`,
          status: 'warning',
        });
      }

      await fetchRegistration(selectedEventId);
    } catch (error) {
      console.error('No se pudieron cargar los documentos', error);
      addToast({
        title: 'Error al cargar documentos',
        description: error.message,
        status: 'error',
      });
    } finally {
      setSendingDocuments(false);
    }
  };

  const stageBadgeColor = isLocked
    ? 'neutral'
    : STAGE_COLORS[currentStage] ?? 'accent';

  return (
    <Card>
      <CardHeader
        title="Eventos de mi institución"
        description="Consulta el estado de cada convocatoria y gestiona la inscripción de tus estudiantes cuando la etapa esté disponible."
        actions={
          snapshot && (
            <div className="flex items-center gap-2">
              <Badge color={stageBadgeColor}>
                {formatStage(snapshot.etapa_actual)}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEventDetail(selectedEventId)}
                disabled={!selectedEventId}
              >
                Ver detalles del evento
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
            Eventos por etapa
          </h3>
          {loadingInvitations ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Cargando eventos…
            </p>
          ) : invitations.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                {STAGE_TABS.map((tab) => {
                  if (!availableStages.includes(tab.id)) return null;
                  const isActive = activeStage === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveStage(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary-500 text-white shadow'
                          : 'bg-slate-100 text-slate-600 hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {stageInvitations.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {stageInvitations.map((invitation) => {
                    const isSelected = invitation.evento_id === selectedEventId;
                    const invitationStage = getStageKey(
                      invitation.etapa_actual,
                    );
                    const invitationState = (
                      invitation.estado_invitacion ?? ''
                    ).toLowerCase();
                    const invitationStateColor =
                      invitationState === 'aceptada'
                        ? 'accent'
                        : invitationState === 'rechazada'
                        ? 'danger'
                        : 'neutral';
                    const handleCardSelect = () =>
                      setSelectedEventId(invitation.evento_id);
                    const handleCardKeyDown = (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleCardSelect();
                      }
                    };
                    const invitationAgeRange = resolveAgeRange(invitation);
                    return (
                      <div
                        key={invitation.evento_id}
                        role="button"
                        tabIndex={0}
                        onClick={handleCardSelect}
                        onKeyDown={handleCardKeyDown}
                        className={`w-full cursor-pointer rounded-3xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 shadow-sm dark:border-primary-400/70 dark:bg-primary-500/10'
                            : 'border-slate-200 bg-white/80 hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                              {invitation.titulo}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              {formatStage(invitation.etapa_actual)} ·{' '}
                              {invitation.deporte?.nombre ?? 'Sin deporte'}
                            </p>
                          </div>
                          <Badge color={invitationStateColor}>
                            {invitation.estado_invitacion ?? 'Pendiente'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
                          <span>
                            Inscripción:{' '}
                            {formatDate(invitation.fecha_inscripcion_inicio)} —{' '}
                            {formatDate(invitation.fecha_inscripcion_fin)}
                          </span>
                          <Badge
                            color={STAGE_COLORS[invitationStage] ?? 'neutral'}
                          >
                            {formatStage(invitation.etapa_actual)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
                          <span>
                            {invitation.cantidad_inscritos ?? 0} participantes
                            registrados
                          </span>
                          <span className="text-left md:text-right">
                            Rango de edad:{' '}
                            {formatAgeRange(
                              invitationAgeRange.min,
                              invitationAgeRange.max,
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                isSelected
                                  ? 'font-semibold text-primary-600 dark:text-primary-300'
                                  : 'font-medium text-slate-500 dark:text-slate-300'
                              }
                            >
                              {isSelected ? 'Seleccionado' : 'Gestionar'}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenEventDetail(invitation.evento_id);
                              }}
                            >
                              Ver detalles
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  No hay eventos en esta etapa por el momento.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Aún no tienes invitaciones asignadas. Consulta con el
              administrador del torneo.
            </p>
          )}
        </section>
        {loadingRegistration ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Cargando información de inscripción…
          </p>
        ) : snapshot ? (
          <>
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                {EVENT_STAGE_TABS.map((tab) => {
                  const isActiveTab = activeEventTab === tab.id;
                  const isAvailable = currentStage === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (isAvailable) setActiveEventTab(tab.id);
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400 ${
                        isActiveTab
                          ? 'bg-primary-500 text-white shadow'
                          : isAvailable
                          ? 'bg-slate-100 text-slate-600 hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-800 dark:text-slate-200'
                          : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                Solo puedes gestionar la etapa activa del evento: {formatStage(currentStage)}.
              </p>
            </div>
            {activeEventTab === 'campeonato' ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Organización del evento
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-200">
                      <li>Etapa actual: {formatStage(currentStage)}</li>
                      <li>
                        Deporte:{' '}
                        {currentEventDetail?.deporte?.nombre ?? snapshot?.deporte?.nombre ?? 'No definido'}
                      </li>
                      <li>
                        Periodo académico:{' '}
                        {currentEventDetail?.periodo_academico ?? snapshot?.periodo_academico ?? 'No definido'}
                      </li>
                      <li>
                        Calendario del campeonato:{' '}
                        {formatDate(currentEventDetail?.fecha_campeonato_inicio ?? snapshot?.fecha_campeonato_inicio)}
                        {' - '}
                        {formatDate(currentEventDetail?.fecha_campeonato_fin ?? snapshot?.fecha_campeonato_fin)}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Institución participante
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-200">
                      <li>
                        Institución:{' '}
                        {user?.institucion_nombre ?? user?.institucion ?? 'Tu institución'}
                      </li>
                      <li>Participantes registrados: {totalParticipants}</li>
                      <li>
                        Estado de auditoría:{' '}
                        {AUDIT_STATUS_META[auditState]?.label ?? 'Sin revisión'}
                      </li>
                      {snapshot?.ultima_revision_enviada_en && (
                        <li>
                          Última revisión: {formatDate(snapshot.ultima_revision_enviada_en)}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Calendario del campeonato
                    </p>
                    <Badge color={STAGE_COLORS[currentStage] ?? 'accent'}>
                      {formatStage(currentStage)}
                    </Badge>
                  </div>
                  {loadingSchedule ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                      Cargando calendario…
                    </p>
                  ) : scheduleMatches.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                      Aún no se han programado partidos para este evento.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {Object.entries(groupedSchedule).map(([dateKey, dayMatches]) => (
                        <div key={dateKey} className="space-y-2">
                          <Badge color="primary">
                            {dateKey === 'Por definir'
                              ? 'Por definir'
                              : new Date(dateKey).toLocaleDateString()}
                          </Badge>
                          <div className="grid gap-3">
                            {dayMatches.map((match) => {
                              const homeName = resolveTeamName(
                                match.equipo_local,
                                match.placeholder_local,
                              );
                              const awayName = resolveTeamName(
                                match.equipo_visitante,
                                match.placeholder_visitante,
                              );
                                const phaseKey = (match?.fase ?? '').toLowerCase();
                                const phaseColor = PHASE_COLORS[phaseKey] ?? 'neutral';
                                const estadoPartido = (match?.estado ?? '').toLowerCase();
                                const localResult =
                                  match?.resultado_local
                                ?? (match?.ganador?.id === match?.equipo_local?.id
                                  ? 'ganado'
                                  : match?.ganador
                                  ? 'perdido'
                                  : null);
                              const visitorResult =
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
                                  ? 'rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-900/30'
                                  : 'rounded-3xl border border-slate-200/70 bg-slate-50/60 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50';
                                const canPublishNews = !match?.noticia_publicada && hasScores;
                                const allowResult = canRegisterResult(match);
                                return (
                                  <div
                                    key={match.id}
                                    className={cardClasses}
                                  >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
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
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                                    {match.fase && (
                                      <Badge color={phaseColor}>{formatPhaseLabel(match.fase)}</Badge>
                                    )}
                                    {match.serie && <Badge color="neutral">{match.serie}</Badge>}
                                    {match.llave && <Badge color="neutral">Llave {match.llave}</Badge>}
                                  </div>
                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div className="flex items-center justify-between rounded-2xl bg-white/80 p-3 text-sm shadow-sm dark:bg-slate-800/70">
                                      <div className="space-y-1">
                                        <p className="font-semibold text-slate-700 dark:text-slate-100">{homeName}</p>
                                        {localResult && (
                                          <Badge color={localResult === 'ganado' ? 'success' : localResult === 'empate' ? 'accent' : 'neutral'}>
                                            {localResult === 'ganado'
                                              ? 'Ganó'
                                              : localResult === 'empate'
                                              ? 'Empate'
                                              : 'Perdió'}
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                                        {Number.isFinite(match?.puntaje_local) ? match.puntaje_local : '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl bg-white/80 p-3 text-sm shadow-sm dark:bg-slate-800/70">
                                      <div className="space-y-1 text-right">
                                        <p className="font-semibold text-slate-700 dark:text-slate-100">{awayName}</p>
                                        {visitorResult && (
                                          <Badge color={visitorResult === 'ganado' ? 'success' : visitorResult === 'empate' ? 'accent' : 'neutral'}>
                                            {visitorResult === 'ganado'
                                              ? 'Ganó'
                                              : visitorResult === 'empate'
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
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
                                    <div>
                                      <p>Escenario: {match.escenario_nombre ?? 'Por confirmar'}</p>
                                      {match.observaciones && <p>Notas: {match.observaciones}</p>}
                                    {match.ganador?.nombre_equipo && (
                                      <p className="font-semibold text-slate-700 dark:text-slate-100">
                                        Ganador: {match.ganador.nombre_equipo}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {canPublishNews && (
                                      <Button
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={() => handlePublishMatchNews(match.id)}
                                        disabled={publishingNewsId === match.id}
                                      >
                                        {publishingNewsId === match.id ? 'Publicando…' : 'Publicar noticia'}
                                      </Button>
                                    )}
                                    {allowResult && (
                                      <Button size="sm" type="button" onClick={() => handleOpenResultModal(match)}>
                                        Registrar resultado
                                      </Button>
                                    )}
                                  </div>
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
              </div>
            ) : (
              <>
            {currentStage === 'inscripcion' && (
              <p className="rounded-3xl bg-primary-50 p-4 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-100">
                La etapa de inscripción está activa. Asegúrate de adjuntar los
                documentos en PDF para cada estudiante antes del cierre.
              </p>
            )}
            {currentStage === 'auditoria' && (
              <p className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                El evento está en auditoría. Puedes actualizar tu listado de
                participantes y volver a subir documentos mientras atiendes las
                observaciones del administrador.
              </p>
            )}
            {(snapshot.estado_auditoria || snapshot.mensaje_auditoria) && (
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge color={AUDIT_STATUS_META[auditState]?.color ?? 'neutral'}>
                    {AUDIT_STATUS_META[auditState]?.label ?? 'Estado sin definir'}
                  </Badge>
                  {snapshot.ultima_revision_enviada_en && (
                    <span className="text-xs text-slate-500 dark:text-slate-300">
                      Última actualización:{' '}
                      {formatDate(snapshot.ultima_revision_enviada_en)}
                    </span>
                  )}
                </div>
                {snapshot.mensaje_auditoria && (
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    Observaciones: {snapshot.mensaje_auditoria}
                  </p>
                )}
              </div>
            )}
            {isLocked &&
              !['inscripcion', 'auditoria'].includes(currentStage) && (
                <p className="rounded-3xl bg-slate-100/80 p-4 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                  Las inscripciones están cerradas. Solo puedes consultar la
                  información registrada del evento.
                </p>
              )}
            <div className="rounded-3xl bg-slate-100/70 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <p>
                <span className="font-semibold">
                  Participantes registrados:
                </span>{' '}
                {totalParticipants}
              </p>
              <p>
                <span className="font-semibold">Rango de edad permitido:</span>{' '}
                {formatAgeRange(ageRange.min, ageRange.max)}
              </p>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <Select
                  label="Estudiantes participantes"
                  multiple
                  searchable
                  options={availableStudents.map((student) => ({
                    value: student.id,
                    label:
                      `${student.nombres ?? ''} ${
                        student.apellidos ?? ''
                      }`.trim() || `ID ${student.id}`,
                    description: student.documento_identidad
                      ? `Documento: ${student.documento_identidad}`
                      : undefined,
                  }))}
                  value={selectedStudentIds}
                  onChange={(value) => {
                    if (!Array.isArray(value)) {
                      setSelectedStudentIds([]);
                      return;
                    }
                    const seen = new Set();
                    const normalized = [];
                    value.forEach((studentId) => {
                      const numericId = Number(studentId);
                      if (
                        Number.isFinite(numericId) &&
                        numericId > 0 &&
                        !seen.has(numericId)
                      ) {
                        seen.add(numericId);
                        normalized.push(numericId);
                      }
                    });
                    setSelectedStudentIds(normalized);
                  }}
                  disabled={isLocked}
                  placeholder="Selecciona estudiantes de tu institución"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  Solo se muestran estudiantes de tu institución que cumplen con
                  el sexo permitido por el evento
                  {ageFilterActive
                    ? ` y con el rango de edad permitido (${formatAgeRange(
                        ageRange.min,
                        ageRange.max,
                      )}).`
                    : '.'}
                {ageFilterActive
                  ? ' Verifica que la fecha de nacimiento de cada estudiante esté registrada correctamente.'
                  : ''}{' '}
                Prepara todos los documentos y envíalos en lote cuando estés
                listo. Tu inscripción se sincronizará automáticamente al
                enviar los archivos.
              </p>
            </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <SearchInput
                    value={participantSearch}
                    onChange={setParticipantSearch}
                    placeholder="Buscar participantes seleccionados"
                    label="Buscar participantes"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Mostrando {paginatedParticipants.length} de{' '}
                    {filteredParticipants.length} participantes seleccionados
                  </p>
                </div>
                {(hasQueuedDocuments || uploadResultSummary.total > 0) && (
                  <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-200">
                    {hasQueuedDocuments && (
                      <p>
                        Documentos pendientes por enviar:{' '}
                        <span className="font-semibold text-primary-600 dark:text-primary-300">
                          {totalQueuedDocuments}
                        </span>
                      </p>
                    )}
                    {uploadResultSummary.total > 0 && (
                      <p className="mt-1">
                        Último envío: {uploadResultSummary.success} cargado(s),{' '}
                        {uploadResultSummary.failure} con observaciones.
                      </p>
                    )}
                  </div>
                )}
                {paginatedParticipants.length > 0 ? (
                  paginatedParticipants.map(
                    ({
                      id: studentId,
                      info: studentInfo,
                      documents,
                      membershipExists,
                    }) => {
                      const normalizedDocuments = new Map();
                      (Array.isArray(documents) ? documents : []).forEach(
                        (doc) => {
                          const key = (doc?.tipo_documento ?? '')
                            .toString()
                            .toLowerCase();
                          if (key && !normalizedDocuments.has(key)) {
                            normalizedDocuments.set(key, doc);
                          }
                        },
                      );
                      const totalRequired = documentTypes.length;
                      const hasAllDocs =
                        totalRequired > 0 &&
                        documentTypes.every((docType) =>
                          normalizedDocuments.has(
                            (docType.id ?? '').toString().toLowerCase(),
                          ),
                        );
                      const fullName =
                        `${studentInfo?.nombres ?? ''} ${
                          studentInfo?.apellidos ?? ''
                        }`.trim() || `ID ${studentId}`;
                      return (
                        <div
                          key={studentId}
                          className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {studentInfo?.foto_url && (
                                <img
                                  src={resolveMediaUrl(studentInfo.foto_url)}
                                  alt={`Foto de ${fullName}`}
                                  className="h-12 w-12 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                />
                              )}
                              <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                                  {fullName}
                                </p>
                                {studentInfo?.documento_identidad && (
                                  <p className="text-xs text-slate-500 dark:text-slate-300">
                                    Documento: {studentInfo.documento_identidad}
                                  </p>
                                )}
                                {studentInfo?.fecha_nacimiento && (
                                  <p className="text-xs text-slate-500 dark:text-slate-300">
                                    Edad:{' '}
                                    {(() => {
                                      const birthDate = new Date(
                                        studentInfo.fecha_nacimiento,
                                      );
                                      const today = new Date();
                                      let age =
                                        today.getFullYear() -
                                        birthDate.getFullYear();
                                      const monthDiff =
                                        today.getMonth() - birthDate.getMonth();
                                      if (
                                        monthDiff < 0 ||
                                        (monthDiff === 0 &&
                                          today.getDate() < birthDate.getDate())
                                      ) {
                                        age--;
                                      }
                                      return age;
                                    })()}{' '}
                                    años
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {totalRequired > 0 ? (
                                <Badge
                                  color={hasAllDocs ? 'success' : 'warning'}
                                >
                                  {hasAllDocs
                                    ? 'Documentación completa'
                                    : 'Documentos pendientes'}
                                </Badge>
                              ) : (
                                <Badge color="neutral">
                                  Requisitos no configurados
                                </Badge>
                              )}
                              {!isLocked && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveStudent(studentId)}
                                >
                                  Quitar
                                </Button>
                              )}
                            </div>
                          </div>
                          {!membershipExists && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                              El estudiante se agregará automáticamente al
                              enviar sus documentos.
                            </p>
                          )}
                          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {loadingDocumentTypes ? (
                              <p className="text-xs text-slate-500 dark:text-slate-300 sm:col-span-2 lg:col-span-3">
                                Cargando requisitos de documentos…
                              </p>
                            ) : documentTypes.length ? (
                              documentTypes.map((docType) => {
                                const rawId = (docType.id ?? '').toString();
                                const normalizedId = rawId.toLowerCase();
                                const existingDoc =
                                  normalizedDocuments.get(normalizedId) ?? null;
                                const reviewState = (
                                  existingDoc?.estado_revision ?? 'pendiente'
                                ).toLowerCase();
                                const reviewMeta =
                                  DOCUMENT_STATUS_META[reviewState] ??
                                  DOCUMENT_STATUS_META.pendiente;
                                const reviewNote = existingDoc?.observaciones_revision;
                                
                                const documentUrl = existingDoc?.archivo_url
                                  ? resolveMediaUrl(existingDoc.archivo_url)
                                  : null;
                                const uploadKey = `${studentId}-${normalizedId}`;
                                const queuedDocument =
                                  queuedDocumentsByKey.get(uploadKey) ?? null;
                                const uploadResult =
                                  uploadResultsByKey.get(uploadKey) ?? null;
                                const disabledUpload =
                                  !canManageRegistration ||
                                  sendingDocuments ||
                                  isLocked;
                                let helperMessage =
                                  'Selecciona un archivo en formato PDF para agregarlo al envío masivo.';
                                if (!canManageRegistration) {
                                  helperMessage =
                                    'La etapa actual no permite cargar documentos.';
                                } else if (sendingDocuments) {
                                  helperMessage = 'Enviando documentos seleccionados…';
                                } else if (queuedDocument) {
                                  helperMessage = 'Documento listo para enviar.';
                                } else if (!membershipExists) {
                                  helperMessage =
                                    'Se guardará tu inscripción antes de enviar los documentos.';
                                }
                                return (
                                  <div
                                    key={normalizedId || rawId}
                                    className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-800/40"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        {docType?.etiqueta ?? rawId}
                                      </p>
                                      {existingDoc && (
                                        <Badge color={reviewMeta.color} size="sm">
                                          {reviewMeta.label}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-1 space-y-1 text-xs">
                                      {documentUrl ? (
                                        <>
                                          <a
                                            href={documentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-primary-600 hover:underline dark:text-primary-300"
                                          >
                                            Ver documento actual
                                          </a>
                                          {reviewNote && (
                                              <p
                                                className={`mt-1 rounded p-1.5 font-medium ${
                                                  ['correccion', 'rechazada'].includes(
                                                    reviewState,
                                                  )
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                                }`}
                                              >
                                                Observación: {reviewNote}
                                              </p>
                                            )}
                                        </>
                                      ) : (
                                        <p className="text-amber-600 dark:text-amber-300">
                                          Pendiente de carga
                                        </p>
                                      )}
                                      {queuedDocument && (
                                        <p className="text-primary-600 dark:text-primary-300">
                                          Listo para enviar:{' '}
                                          <span className="font-semibold">
                                            {queuedDocument.file?.name ??
                                              'Documento PDF'}
                                          </span>
                                        </p>
                                      )}
                                      {uploadResult && (
                                        <p
                                          className={
                                            uploadResult.success
                                              ? 'text-emerald-600 dark:text-emerald-300'
                                              : 'text-red-600 dark:text-red-300'
                                          }
                                        >
                                          {uploadResult.success
                                            ? 'Documento cargado correctamente.'
                                            : uploadResult.message ||
                                              'No se pudo cargar el documento.'}
                                        </p>
                                      )}
                                    </div>
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      className="mt-3 block w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-xs font-semibold text-slate-600 transition hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 dark:file:bg-primary-600"
                                      disabled={disabledUpload}
                                      title="Sube un archivo PDF"
                                      onChange={(event) => {
                                        const file =
                                          event.target.files?.[0] ?? null;
                                        if (file && !disabledUpload) {
                                          queueDocumentSelection(
                                            studentId,
                                            normalizedId,
                                            file,
                                          );
                                        }
                                        event.target.value = '';
                                      }}
                                    />
                                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                                      {helperMessage}
                                    </p>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-500 dark:text-slate-300 sm:col-span-2 lg:col-span-3">
                                No se configuraron requisitos de documentos para
                                este evento.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    {selectedStudentIds.length
                      ? 'No hay participantes que coincidan con la búsqueda.'
                      : 'Selecciona estudiantes para comenzar el registro.'}
                  </p>
                )}
                <Pagination
                  page={participantPage}
                  totalPages={totalParticipantPages}
                  onPageChange={setParticipantPage}
                />
              </div>
            </div>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Selecciona un evento para gestionar tu registro.
          </p>
        )}
      </div>
      {activeEventTab !== 'campeonato' && snapshot ? (
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="ghost"
              disabled={!hasQueuedDocuments || sendingDocuments}
              onClick={handleClearQueuedDocuments}
            >
              Limpiar selección
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                isLocked ||
                sendingDocuments ||
                !hasQueuedDocuments ||
                !selectedEventId ||
                !canManageRegistration
              }
              onClick={handleSendQueuedDocuments}
            >
              {sendingDocuments
                ? 'Enviando documentos…'
                : `Enviar ${totalQueuedDocuments} documento${
                    totalQueuedDocuments === 1 ? '' : 's'
                  }`}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                isLocked ||
                saving ||
                syncingRegistration ||
                !selectedEventId ||
                sendingDocuments
              }
              onClick={handleSave}
            >
              {saving
                ? 'Guardando…'
                : syncingRegistration
                ? 'Sincronizando…'
                : 'Guardar cambios'}
            </Button>
          </div>
        </CardFooter>
      ) : null}
      <Modal
        isOpen={resultModal.open}
        onClose={handleCloseResultModal}
        onConfirm={handleSubmitResult}
        confirmLabel={resultModal.submitting ? 'Guardando…' : 'Guardar resultado'}
        confirmDisabled={resultModal.submitting}
        title="Registrar resultado"
        description="Actualiza el marcador del partido para que avance el calendario."
      >
        {resultModal.match ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Puntaje local</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  value={resultModal.localScore}
                  onChange={(event) =>
                    setResultModal((prev) => ({ ...prev, localScore: event.target.value ?? '' }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Puntaje visitante</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  value={resultModal.visitorScore}
                  onChange={(event) =>
                    setResultModal((prev) => ({ ...prev, visitorScore: event.target.value ?? '' }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Equipo ganador</label>
                <Select
                  value={resultModal.winnerId}
                  onChange={(value) =>
                    setResultModal((prev) => ({ ...prev, winnerId: value ? Number(value) : null }))
                  }
                  options={[
                    {
                      value: resultModal.match?.equipo_local?.id,
                      label: resultModal.match?.equipo_local?.nombre_equipo ?? 'Equipo local',
                    },
                    {
                      value: resultModal.match?.equipo_visitante?.id,
                      label: resultModal.match?.equipo_visitante?.nombre_equipo ?? 'Equipo visitante',
                    },
                  ].filter((option) => option.value)}
                  placeholder="Selecciona al ganador"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Criterio</label>
                <input
                  type="text"
                  maxLength={50}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  value={resultModal.criterio ?? ''}
                  onChange={(event) =>
                    setResultModal((prev) => ({ ...prev, criterio: event.target.value || '' }))
                  }
                  placeholder="puntos, penales…"
                />
              </div>
            </div>
              {!resultModal.match?.noticia_publicada ? (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(resultModal.publishNews)}
                    onChange={(event) =>
                      setResultModal((prev) => ({ ...prev, publishNews: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-900"
                  />
                  Publicar resultado en Noticias
                </label>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  La noticia de este partido ya fue publicada.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Selecciona un partido para registrar el marcador.</p>
          )}
      </Modal>
      <Modal
        isOpen={eventDetailModalOpen}
        onClose={() => setEventDetailModalOpen(false)}
        title={eventDetail?.titulo ?? 'Detalle del evento'}
        description="Consulta la información general del evento seleccionado."
        confirmLabel="Cerrar"
        onConfirm={() => setEventDetailModalOpen(false)}
        confirmVariant="primary"
        size="lg"
      >
        {loadingEventDetail ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Cargando detalles del evento…
          </p>
        ) : eventDetail ? (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>
              <span className="font-semibold">Descripción:</span>{' '}
              {eventDetail.descripcion || 'Sin descripción disponible'}
            </p>
            <p>
              <span className="font-semibold">Deporte:</span>{' '}
              {eventDetail.deporte?.nombre ?? 'No asignado'}
            </p>
            <p>
              <span className="font-semibold">Periodo académico:</span>{' '}
              {eventDetail.periodo_academico ?? 'No definido'}
            </p>
            <p>
              <span className="font-semibold">Rango de edad permitido:</span>{' '}
              {formatAgeRange(
                resolveAgeRange(eventDetail).min,
                resolveAgeRange(eventDetail).max,
              )}
            </p>
            <p>
              <span className="font-semibold">Estado actual:</span>{' '}
              {formatStage(eventDetail.estado)}
            </p>
            {eventDetail.documento_planeacion_url && (
              <p>
                <span className="font-semibold">Reglamento:</span>{' '}
                <a
                  href={resolveMediaUrl(eventDetail.documento_planeacion_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline hover:text-primary-700 dark:text-primary-300"
                >
                  Ver o descargar documento
                </a>
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Inicio de inscripción:</span>{' '}
                {formatDate(eventDetail.fecha_inscripcion_inicio)}
              </p>
              <p>
                <span className="font-semibold">Cierre de inscripción:</span>{' '}
                {formatDate(eventDetail.fecha_inscripcion_fin)}
              </p>
              <p>
                <span className="font-semibold">Inicio de auditoría:</span>{' '}
                {formatDate(eventDetail.fecha_auditoria_inicio)}
              </p>
              <p>
                <span className="font-semibold">Cierre de auditoría:</span>{' '}
                {formatDate(eventDetail.fecha_auditoria_fin)}
              </p>
              <p>
                <span className="font-semibold">Inicio de campeonato:</span>{' '}
                {formatDate(eventDetail.fecha_campeonato_inicio)}
              </p>
              <p>
                <span className="font-semibold">Fin de campeonato:</span>{' '}
                {formatDate(eventDetail.fecha_campeonato_fin)}
              </p>
            </div>
            {Array.isArray(eventDetail.categorias) &&
              eventDetail.categorias.length > 0 && (
                <div>
                  <p className="font-semibold">Categorías:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {eventDetail.categorias.map((category) => (
                      <li key={category.id ?? category.nombre}>
                        {category.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {Array.isArray(eventDetail.escenarios) &&
              eventDetail.escenarios.length > 0 && (
                <div>
                  <p className="font-semibold">Escenarios:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {eventDetail.escenarios.map((scenario) => (
                      <li key={scenario.id ?? scenario.nombre_escenario}>
                        {scenario.nombre_escenario ??
                          scenario.escenario_nombre ??
                          'Escenario sin nombre'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            No se pudo cargar la información del evento seleccionado.
          </p>
        )}
      </Modal>
    </Card>
  );
};
