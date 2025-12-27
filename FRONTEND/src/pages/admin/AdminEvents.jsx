import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  PaperClipIcon,
  ListBulletIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { eventService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';
import { resolveMediaUrl } from '../../utils/media.js';

const validateDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const SEX_OPTIONS = [
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' },
  { value: 'MX', label: 'Mixto' },
];

const eventSchema = z
  .object({
    titulo: z.string().min(3, 'Ingresa un nombre para el evento'),
    descripcion: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((value) => value?.trim() ?? ''),
    sexo_evento: z.enum(['F', 'M', 'MX'], {
      required_error: 'Selecciona el sexo del evento',
    }),
    deporte_id: z.string().min(1, 'Selecciona un deporte'),
    categorias: z.array(z.string()).min(1, 'Selecciona al menos una categoría'),
    escenarios: z.array(z.string()).optional().default([]),
    estado: z.string().optional(),
    fecha_inscripcion_inicio: z
      .string()
      .min(1, 'Ingresa la fecha de apertura de inscripciones'),
    fecha_inscripcion_fin: z
      .string()
      .min(1, 'Ingresa la fecha de cierre de inscripciones'),
    fecha_auditoria_inicio: z
      .string()
      .min(1, 'Ingresa la fecha de inicio de auditoría'),
    fecha_auditoria_fin: z
      .string()
      .min(1, 'Ingresa la fecha de fin de auditoría'),
    fecha_campeonato_inicio: z
      .string()
      .min(1, 'Ingresa la fecha de inicio del campeonato'),
    fecha_campeonato_fin: z
      .string()
      .min(1, 'Ingresa la fecha de fin del campeonato'),
    instituciones_invitadas: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    const registrationStart = validateDateValue(data.fecha_inscripcion_inicio);
    const registrationEnd = validateDateValue(data.fecha_inscripcion_fin);
    const auditStart = validateDateValue(data.fecha_auditoria_inicio);
    const auditEnd = validateDateValue(data.fecha_auditoria_fin);
    const championshipStart = validateDateValue(data.fecha_campeonato_inicio);
    const championshipEnd = validateDateValue(data.fecha_campeonato_fin);

    if (!registrationStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de apertura inválida',
        path: ['fecha_inscripcion_inicio'],
      });
    }
    if (!registrationEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de cierre inválida',
        path: ['fecha_inscripcion_fin'],
      });
    }
    if (
      registrationStart &&
      registrationEnd &&
      registrationStart >= registrationEnd
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El inicio de inscripciones debe ser anterior al cierre',
        path: ['fecha_inscripcion_inicio'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El cierre debe ser posterior al inicio',
        path: ['fecha_inscripcion_fin'],
      });
    }

    if (!auditStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de inicio de auditoría inválida',
        path: ['fecha_auditoria_inicio'],
      });
    }
    if (!auditEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de fin de auditoría inválida',
        path: ['fecha_auditoria_fin'],
      });
    }
    if (auditStart && auditEnd && auditStart >= auditEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La auditoría debe finalizar después de iniciar',
        path: ['fecha_auditoria_fin'],
      });
    }
    if (registrationEnd && auditStart && auditStart <= registrationEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La auditoría debe iniciar luego del cierre de inscripciones',
        path: ['fecha_auditoria_inicio'],
      });
    }
    if (registrationEnd && auditEnd && auditEnd <= registrationEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'La auditoría debe finalizar luego del cierre de inscripciones',
        path: ['fecha_auditoria_fin'],
      });
    }

    if (!championshipStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de inicio de campeonato inválida',
        path: ['fecha_campeonato_inicio'],
      });
    }
    if (!championshipEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fecha de fin de campeonato inválida',
        path: ['fecha_campeonato_fin'],
      });
    }
    if (
      championshipStart &&
      championshipEnd &&
      championshipStart >= championshipEnd
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El inicio del campeonato debe ser anterior al fin',
        path: ['fecha_campeonato_inicio'],
      });
    }
    if (auditEnd && championshipStart && championshipStart <= auditEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El campeonato debe iniciar después de la auditoría',
        path: ['fecha_campeonato_inicio'],
      });
    }

    const escenarios = Array.isArray(data.escenarios) ? data.escenarios : [];
    const seen = new Set();
    escenarios.forEach((value, index) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecciona escenarios válidos',
          path: ['escenarios', index],
        });
        return;
      }
      if (seen.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No puedes repetir el mismo escenario',
          path: ['escenarios', index],
        });
        return;
      }
      seen.add(normalized);
    });
  });

const SEX_LABELS = {
  F: 'Femenino',
  M: 'Masculino',
  MX: 'Mixto',
};

const EVENT_STAGE_LABELS = {
  borrador: 'Planificación',
  inscripcion: 'Inscripción',
  auditoria: 'Auditoría',
  campeonato: 'Campeonato',
  finalizado: 'Finalizado',
  archivado: 'Archivado',
};

const EVENT_STAGE_BADGES = {
  borrador: 'neutral',
  inscripcion: 'accent',
  auditoria: 'warning',
  campeonato: 'success',
  finalizado: 'neutral',
  archivado: 'neutral',
};

const defaultEventForm = {
  titulo: '',
  descripcion: '',
  sexo_evento: 'MX',
  deporte_id: '',
  categorias: [],
  escenarios: [],
  estado: 'borrador',
  fecha_campeonato_inicio: '',
  fecha_campeonato_fin: '',
  fecha_inscripcion_inicio: '',
  fecha_inscripcion_fin: '',
  fecha_auditoria_inicio: '',
  fecha_auditoria_fin: '',
  instituciones_invitadas: [],
};

const EVENT_STATE_OPTIONS = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'inscripcion', label: 'Inscripción' },
  { value: 'auditoria', label: 'Auditoría' },
  { value: 'campeonato', label: 'Campeonato' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'archivado', label: 'Archivado' },
];

const STATE_BADGE_COLOR = {
  borrador: 'neutral',
  inscripcion: 'accent',
  auditoria: 'warning',
  campeonato: 'success',
  finalizado: 'neutral',
  archivado: 'neutral',
};

const EVENT_FORM_TABS = [
  { id: 'general', label: 'Información general' },
  { id: 'logistics', label: 'Logística y sedes' },
  { id: 'schedule', label: 'Cronograma' },
  { id: 'media', label: 'Material de apoyo' },
];

const EVENT_HIDEABLE_COLUMNS = [
  'deporte',
  'sexo_evento',
  'categorias',
  'escenarios',
  'instituciones_invitadas',
  'fecha_inscripcion_inicio',
  'fecha_inscripcion_fin',
  'fecha_auditoria_inicio',
  'fecha_auditoria_fin',
  'fecha_campeonato_inicio',
  'fecha_campeonato_fin',
  'etapa_actual',
  'estado',
];

const DEFAULT_VISIBLE_COLUMNS = [
  'deporte',
  'estado',
  'fecha_inscripcion_inicio',
  'fecha_inscripcion_fin',
  'fecha_auditoria_inicio',
  'fecha_auditoria_fin',
];

const Spinner = () => (
  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-[2px] border-primary-500 border-t-transparent" />
);

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return value;
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

const calculateDayDifference = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
};

export const AdminEvents = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const {
    data: eventsData = [],
    loading: eventsLoading,
    refetch: refetchEvents,
  } = useFetchWithAuth('/events/?page_size=100&manageable=true');

  const {
    data: sportsData = [],
    loading: sportsLoading,
    error: sportsError,
    refetch: refetchSports,
  } = useFetchWithAuth('/events/sports');

  const {
    data: scenariosData = [],
    loading: scenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios,
  } = useFetchWithAuth('/scenarios/?page_size=100');

  const {
    data: institutionsData = [],
    loading: institutionsLoading,
    error: institutionsError,
    refetch: refetchInstitutions,
  } = useFetchWithAuth('/institutions/?page_size=100');

  const events = useMemo(
    () => (Array.isArray(eventsData) ? eventsData : []),
    [eventsData],
  );
  const sports = useMemo(
    () => (Array.isArray(sportsData) ? sportsData : []),
    [sportsData],
  );
  const institutions = useMemo(
    () => (Array.isArray(institutionsData) ? institutionsData : []),
    [institutionsData],
  );
  const scenarios = useMemo(
    () => (Array.isArray(scenariosData) ? scenariosData : []),
    [scenariosData],
  );
  const [isColumnMenuOpen, setColumnMenuOpen] = useState(false);

  useEffect(() => {
    if (institutionsError) {
      addToast({
        title: 'No se pudieron cargar las instituciones',
        description: institutionsError.message,
        status: 'error',
      });
    }
  }, [addToast]);

  useEffect(() => {
    if (sportsError) {
      addToast({
        title: 'No se pudieron cargar los deportes',
        description: sportsError.message,
        status: 'error',
      });
    }
  }, [addToast]);

  useEffect(() => {
    if (scenariosError) {
      addToast({
        title: 'No se pudieron cargar los escenarios',
        description: scenariosError.message,
        status: 'error',
      });
    }
  }, [addToast]);

  useEffect(() => {
    if (!isColumnMenuOpen) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (
        columnFilterRef.current &&
        !columnFilterRef.current.contains(event.target)
      ) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnMenuOpen]);

  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentEvent, setCurrentEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    event: null,
    values: {},
    manualAuditStart: false,
  });
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [planningDocument, setPlanningDocument] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [removeCover, setRemoveCover] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState(EVENT_FORM_TABS[0].id);
  const [customScenarios, setCustomScenarios] = useState([]);
  const [extraScenarioOptions, setExtraScenarioOptions] = useState([]);
  const [newCustomScenario, setNewCustomScenario] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(DEFAULT_VISIBLE_COLUMNS),
  );
  const columnFilterRef = useRef(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: { ...defaultEventForm },
  });
  const watchedRegistrationStart = watch('fecha_inscripcion_inicio');
  const watchedRegistrationEnd = watch('fecha_inscripcion_fin');
  const watchedAuditStart = watch('fecha_auditoria_inicio');
  const watchedAuditEnd = watch('fecha_auditoria_fin');
  const watchedChampionshipStart = watch('fecha_campeonato_inicio');
  const watchedChampionshipEnd = watch('fecha_campeonato_fin');
  const lastRegistrationStartRef = useRef('');
  const skipInitialAutofillRef = useRef(false);
  const timelineOffsetsRef = useRef({
    registrationDuration: 3,
    registrationToAuditGap: 3,
    auditDuration: 3,
    auditToChampionshipGap: 3,
    championshipDuration: 3,
  });
  const lastAutoDatesRef = useRef({
    registrationEnd: '',
    auditStart: '',
    auditEnd: '',
    championshipStart: '',
    championshipEnd: '',
  });

  useEffect(() => {
    const registrationDuration = calculateDayDifference(
      watchedRegistrationStart,
      watchedRegistrationEnd,
    );
    const registrationToAuditGap = calculateDayDifference(
      watchedRegistrationEnd,
      watchedAuditStart,
    );
    const auditDuration = calculateDayDifference(watchedAuditStart, watchedAuditEnd);
    const auditToChampionshipGap = calculateDayDifference(
      watchedAuditEnd,
      watchedChampionshipStart,
    );
    const championshipDuration = calculateDayDifference(
      watchedChampionshipStart,
      watchedChampionshipEnd,
    );

    timelineOffsetsRef.current = {
      registrationDuration:
        registrationDuration ?? timelineOffsetsRef.current.registrationDuration ?? 3,
      registrationToAuditGap:
        registrationToAuditGap ?? timelineOffsetsRef.current.registrationToAuditGap ?? 3,
      auditDuration: auditDuration ?? timelineOffsetsRef.current.auditDuration ?? 3,
      auditToChampionshipGap:
        auditToChampionshipGap ?? timelineOffsetsRef.current.auditToChampionshipGap ?? 3,
      championshipDuration:
        championshipDuration ?? timelineOffsetsRef.current.championshipDuration ?? 3,
    };
  }, [
    watchedRegistrationStart,
    watchedRegistrationEnd,
    watchedAuditStart,
    watchedAuditEnd,
    watchedChampionshipStart,
    watchedChampionshipEnd,
  ]);

  useEffect(() => {
    if (!watchedRegistrationStart) {
      lastRegistrationStartRef.current = '';
      lastAutoDatesRef.current = {
        registrationEnd: '',
        auditStart: '',
        auditEnd: '',
        championshipStart: '',
        championshipEnd: '',
      };
      return;
    }

    const baseDate = new Date(watchedRegistrationStart);
    if (Number.isNaN(baseDate.getTime())) return;

    const addDays = (value, days) => {
      const date = value instanceof Date ? new Date(value) : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      date.setDate(date.getDate() + Number(days ?? 0));
      return date.toISOString().slice(0, 10);
    };

    if (skipInitialAutofillRef.current) {
      skipInitialAutofillRef.current = false;
      lastRegistrationStartRef.current = watchedRegistrationStart;
      lastAutoDatesRef.current = {
        registrationEnd: watchedRegistrationEnd ?? '',
        auditStart: watchedAuditStart ?? '',
        auditEnd: watchedAuditEnd ?? '',
        championshipStart: watchedChampionshipStart ?? '',
        championshipEnd: watchedChampionshipEnd ?? '',
      };
      return;
    }

    const hasStartChanged = watchedRegistrationStart !== lastRegistrationStartRef.current;
    lastRegistrationStartRef.current = watchedRegistrationStart;

    const offsets = timelineOffsetsRef.current;
    const autoRegistrationEnd = addDays(baseDate, offsets.registrationDuration ?? 0);
    const autoAuditStart = autoRegistrationEnd
      ? addDays(autoRegistrationEnd, offsets.registrationToAuditGap ?? 0)
      : '';
    const autoAuditEnd = autoAuditStart
      ? addDays(autoAuditStart, offsets.auditDuration ?? 0)
      : '';
    const autoChampionshipStart = autoAuditEnd
      ? addDays(autoAuditEnd, offsets.auditToChampionshipGap ?? 0)
      : '';
    const autoChampionshipEnd = autoChampionshipStart
      ? addDays(autoChampionshipStart, offsets.championshipDuration ?? 0)
      : '';

    const previous = lastAutoDatesRef.current;
    const shouldUpdate = (currentValue, previousValue) =>
      !currentValue || currentValue === previousValue || hasStartChanged;

    if (autoRegistrationEnd && shouldUpdate(watchedRegistrationEnd, previous.registrationEnd)) {
      setValue('fecha_inscripcion_fin', autoRegistrationEnd, { shouldValidate: true });
    }
    if (autoAuditStart && shouldUpdate(watchedAuditStart, previous.auditStart)) {
      setValue('fecha_auditoria_inicio', autoAuditStart, { shouldValidate: true });
    }
    if (autoAuditEnd && shouldUpdate(watchedAuditEnd, previous.auditEnd)) {
      setValue('fecha_auditoria_fin', autoAuditEnd, { shouldValidate: true });
    }
    if (autoChampionshipStart && shouldUpdate(watchedChampionshipStart, previous.championshipStart)) {
      setValue('fecha_campeonato_inicio', autoChampionshipStart, { shouldValidate: true });
    }
    if (autoChampionshipEnd && shouldUpdate(watchedChampionshipEnd, previous.championshipEnd)) {
      setValue('fecha_campeonato_fin', autoChampionshipEnd, { shouldValidate: true });
    }

    lastAutoDatesRef.current = {
      registrationEnd: autoRegistrationEnd,
      auditStart: autoAuditStart,
      auditEnd: autoAuditEnd,
      championshipStart: autoChampionshipStart,
      championshipEnd: autoChampionshipEnd,
    };
  }, [
    watchedRegistrationStart,
    watchedRegistrationEnd,
    watchedAuditStart,
    watchedAuditEnd,
    watchedChampionshipStart,
    watchedChampionshipEnd,
    setValue,
  ]);

  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(
    () => () => {
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    },
    [coverPreview],
  );

  const institutionOptions = useMemo(
    () =>
      institutions.map((institution) => ({
        value: String(institution.id),
        label: institution.nombre,
        description: institution.ciudad ?? institution.email ?? undefined,
      })),
    [institutions],
  );

  const sportOptions = useMemo(
    () =>
      sports.map((sport) => ({ value: String(sport.id), label: sport.nombre })),
    [sports],
  );

  const categoryOptions = useMemo(
    () =>
      availableCategories.map((category) => ({
        value: String(category.id),
        label: category.nombre,
      })),
    [availableCategories],
  );

  const scenarioLookup = useMemo(() => {
    const map = new Map();
    scenarios.forEach((scenario) => {
      map.set(String(scenario.id), scenario);
    });
    extraScenarioOptions.forEach((option) => {
      if (!map.has(option.value)) {
        map.set(option.value, { id: option.value, nombre: option.label });
      }
    });
    return map;
  }, [scenarios, extraScenarioOptions]);

  const scenarioOptions = useMemo(() => {
    const baseOptions = scenarios.map((scenario) => ({
      value: String(scenario.id),
      label: scenario.nombre,
      description: scenario.ciudad ?? scenario.direccion ?? undefined,
    }));
    const extraOptions = extraScenarioOptions.filter(
      (option) => !baseOptions.some((item) => item.value === option.value),
    );
    return [...baseOptions, ...extraOptions];
  }, [scenarios, extraScenarioOptions]);

  useEffect(() => {
    setExtraScenarioOptions((prev) =>
      prev.filter(
        (option) =>
          !scenarios.some((scenario) => String(scenario.id) === option.value),
      ),
    );
  }, [scenarios]);

  const selectedSportId = watch('deporte_id');

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return events;
    }
    return events.filter((event) => {
      const title = event?.titulo?.toLowerCase() ?? '';
      const sportName = event?.deporte?.nombre?.toLowerCase() ?? '';
      const categoryNames = Array.isArray(event?.categorias)
        ? event.categorias
            .map((item) => item?.nombre ?? '')
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        : '';
      const stageLabel =
        EVENT_STAGE_LABELS[event?.etapa_actual]?.toLowerCase() ?? '';
      const stateLabel = event?.estado?.toLowerCase() ?? '';
      const invitedNames = Array.isArray(event?.instituciones_invitadas)
        ? event.instituciones_invitadas
            .map((item) => item?.nombre ?? '')
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        : '';
      const scenarioNames = Array.isArray(event?.escenarios)
        ? event.escenarios
            .map((item) => item?.nombre_escenario ?? '')
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        : '';
      return [
        title,
        sportName,
        categoryNames,
        stageLabel,
        stateLabel,
        invitedNames,
        scenarioNames,
      ].some((value) => value.includes(term));
    });
  }, [events, search]);

  const hasSearchTerm = Boolean(search.trim());

  const columnDefinitions = useMemo(
    () => [
      {
        Header: '',
        accessor: 'imagen_portada_url',
        hideable: false,
        Cell: ({ value, row }) => (
          <div className="flex items-center gap-3">
            {value ? (
              <img
                src={resolveMediaUrl(value)}
                alt={row.titulo}
                className="h-12 w-16 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-12 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-200 to-rose-200 text-sm font-semibold text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">
                {(row.titulo ?? '?').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        ),
      },
      { Header: 'Evento', accessor: 'titulo', hideable: false },
      {
        Header: 'Deporte',
        accessor: 'deporte',
        hideable: true,
        Cell: ({ value }) => value?.nombre ?? '—',
      },
      {
        Header: 'Sexo',
        accessor: 'sexo_evento',
        hideable: true,
        Cell: ({ value }) => SEX_LABELS[value] ?? '—',
      },
      {
        Header: 'Categorías',
        accessor: 'categorias',
        hideable: true,
        Cell: ({ value }) =>
          Array.isArray(value) && value.length
            ? value
                .map((item) => item?.nombre ?? '')
                .filter(Boolean)
                .join(', ')
            : '—',
      },
      {
        Header: 'Escenarios',
        accessor: 'escenarios',
        hideable: true,
        Cell: ({ value }) =>
          Array.isArray(value) && value.length
            ? value
                .map((item) => item?.nombre_escenario ?? '')
                .filter(Boolean)
                .join(', ')
            : '—',
      },
      {
        Header: 'Invitadas',
        accessor: 'instituciones_invitadas',
        hideable: true,
        Cell: ({ row }) =>
          row.instituciones_invitadas?.length ? (
            <div className="flex flex-wrap gap-1">
              {row.instituciones_invitadas.map((inst) => (
                <span
                  key={`${row.id}-${inst.institucion_id}`}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {inst.nombre ?? `ID ${inst.institucion_id}`}
                </span>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
      {
        Header: 'Apertura inscripciones',
        accessor: 'fecha_inscripcion_inicio',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Cierre inscripciones',
        accessor: 'fecha_inscripcion_fin',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Inicio auditoría',
        accessor: 'fecha_auditoria_inicio',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Fin auditoría',
        accessor: 'fecha_auditoria_fin',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Inicio campeonato',
        accessor: 'fecha_campeonato_inicio',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Fin campeonato',
        accessor: 'fecha_campeonato_fin',
        hideable: true,
        Cell: ({ value }) => formatDate(value),
      },
      {
        Header: 'Etapa',
        accessor: 'etapa_actual',
        hideable: true,
        Cell: ({ value }) => (
          <Badge color={EVENT_STAGE_BADGES[value] ?? 'neutral'}>
            {EVENT_STAGE_LABELS[value] ?? 'Sin etapa'}
          </Badge>
        ),
      },
      {
        Header: 'Estado',
        accessor: 'estado',
        hideable: true,
        Cell: ({ value }) => (
          <Badge color={STATE_BADGE_COLOR[value] ?? 'neutral'}>
            {value ?? 'Borrador'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const columnsToRender = useMemo(
    () =>
      columnDefinitions.filter(
        (column) => !column.hideable || visibleColumns.has(column.accessor),
      ),
    [columnDefinitions, visibleColumns],
  );

  const tableEmptyMessage = hasSearchTerm
    ? 'No se encontraron eventos que coincidan con la búsqueda'
    : 'No hay eventos disponibles';

  const toggleColumn = (accessor) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (next.has(accessor)) {
        next.delete(accessor);
      } else {
        next.add(accessor);
      }
      return next;
    });
  };

  const handleResetColumns = () => {
    setVisibleColumns(new Set(EVENT_HIDEABLE_COLUMNS));
    setColumnMenuOpen(false);
  };

  const openTimelineModal = (event) => {
    if (!event) return;
    setTimelineModal({
      open: true,
      event,
      manualAuditStart: false,
      values: {
        fecha_inscripcion_inicio: toInputDate(event.fecha_inscripcion_inicio),
        fecha_inscripcion_fin: toInputDate(event.fecha_inscripcion_fin),
        fecha_auditoria_inicio: toInputDate(event.fecha_auditoria_inicio),
        fecha_auditoria_fin: toInputDate(event.fecha_auditoria_fin),
        fecha_campeonato_inicio: toInputDate(event.fecha_campeonato_inicio),
        fecha_campeonato_fin: toInputDate(event.fecha_campeonato_fin),
      },
    });
  };

  const closeTimelineModal = () => {
    setTimelineModal({ open: false, event: null, values: {}, manualAuditStart: false });
  };

  const handleTimelineChange = (field, value) => {
    setTimelineModal((previous) => {
      const nextValues = { ...previous.values, [field]: value };
      let manualAuditStart = previous.manualAuditStart || field === 'fecha_auditoria_inicio';

      if (field === 'fecha_inscripcion_fin' && !manualAuditStart) {
        const originalRegistrationEnd = toInputDate(previous.event?.fecha_inscripcion_fin);
        const originalAuditStart = toInputDate(previous.event?.fecha_auditoria_inicio);
        const gap = calculateDayDifference(originalRegistrationEnd, originalAuditStart);

        const baseDate = new Date(value);
        if (!Number.isNaN(baseDate.getTime())) {
          const adjusted = new Date(baseDate);
          adjusted.setDate(
            adjusted.getDate() + (Number.isFinite(gap) ? gap : 1),
          );
          nextValues.fecha_auditoria_inicio = adjusted.toISOString().slice(0, 10);
        }

        if (
          nextValues.fecha_auditoria_inicio &&
          value &&
          new Date(nextValues.fecha_auditoria_inicio) <= new Date(value)
        ) {
          const fallback = new Date(value);
          fallback.setDate(fallback.getDate() + 1);
          nextValues.fecha_auditoria_inicio = fallback.toISOString().slice(0, 10);
        }
      }

      return {
        ...previous,
        manualAuditStart,
        values: nextValues,
      };
    });
  };

  const handleSubmitTimeline = async () => {
    if (!timelineModal.event?.id) return;
    setSavingTimeline(true);
    try {
      const payload = Object.entries(timelineModal.values ?? {}).reduce(
        (acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        },
        {},
      );
      const updated = await eventService.updateTimeline(
        timelineModal.event.id,
        payload,
      );
      addToast({
        title: 'Cronograma actualizado',
        description: 'Las fechas del evento fueron actualizadas exitosamente.',
        status: 'success',
      });
      await refetchEvents();
      if (updated?.id === currentEvent?.id) {
        setCurrentEvent(updated);
      }
      closeTimelineModal();
    } catch (error) {
      addToast({
        title: 'No se pudo actualizar el cronograma',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setSavingTimeline(false);
    }
  };

  const renderEventActions = (event) => (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-md transition hover:-translate-y-0.5 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
        onClick={() => navigate(`/admin/eventos/${event?.id}/detalle`)}
        aria-label={`Visualizar ${event?.titulo ?? 'evento'}`}
      >
        <EyeIcon className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-amber-600 shadow-md transition hover:-translate-y-0.5 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-300"
        onClick={() => openTimelineModal(event)}
        aria-label={`Actualizar cronograma de ${event?.titulo ?? 'evento'}`}
      >
        <ArrowPathIcon className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary-500 shadow-md transition hover:-translate-y-0.5 hover:bg-primary-50 dark:bg-slate-800"
        onClick={() => openEditModal(event)}
        aria-label={`Editar ${event?.titulo ?? 'evento'}`}
      >
        <PencilSquareIcon className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:-translate-y-0.5 hover:bg-red-50 dark:bg-slate-800"
        onClick={() => openDeleteModal(event)}
        aria-label={`Eliminar ${event?.titulo ?? 'evento'}`}
      >
        <TrashIcon className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );

  const loadCategories = useCallback(
    async (sportId, { preselect = [] } = {}) => {
      if (!sportId) {
        setAvailableCategories([]);
        setValue('categorias', []);
        return;
      }

      setCategoriesLoading(true);
      try {
        const data = await eventService.listCategoriesBySport(Number(sportId));
        setAvailableCategories(data);
        const desired = preselect.length ? preselect : [];
        const validIds = desired.filter((value) =>
          data.some((item) => String(item.id) === String(value)),
        );
        setValue('categorias', validIds);
      } catch (error) {
        setAvailableCategories([]);
        setValue('categorias', []);
        addToast({
          title: 'No se pudieron cargar las categorías',
          description: error.message,
          status: 'error',
        });
      } finally {
        setCategoriesLoading(false);
      }
    },
    [addToast, setValue],
  );

  const resetEventFormState = () => {
    setModalOpen(false);
    setModalMode('create');
    setCurrentEvent(null);
    setPlanningDocument(null);
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
    reset({ ...defaultEventForm });
    setAvailableCategories([]);
    setCustomScenarios([]);
    setExtraScenarioOptions([]);
    setActiveFormTab(EVENT_FORM_TABS[0].id);
    setNewCustomScenario('');
  };

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentEvent(null);
    setPlanningDocument(null);
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
    skipInitialAutofillRef.current = true;
    lastRegistrationStartRef.current = '';
    timelineOffsetsRef.current = {
      registrationDuration: 3,
      registrationToAuditGap: 3,
      auditDuration: 3,
      auditToChampionshipGap: 3,
      championshipDuration: 3,
    };
    reset({ ...defaultEventForm });
    setAvailableCategories([]);
    void refetchSports();
    void refetchScenarios();
    void refetchInstitutions();
    setCustomScenarios([]);
    setExtraScenarioOptions([]);
    setActiveFormTab(EVENT_FORM_TABS[0].id);
    setNewCustomScenario('');
    setModalOpen(true);
  };

  const openEditModal = (event) => {
    setModalMode('edit');
    setCurrentEvent(event);
    setPlanningDocument(null);
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview(
      event.imagen_portada_url ? resolveMediaUrl(event.imagen_portada_url) : '',
    );
    setRemoveCover(false);
    skipInitialAutofillRef.current = true;
    const registrationDuration = calculateDayDifference(
      event.fecha_inscripcion_inicio,
      event.fecha_inscripcion_fin,
    );
    const registrationToAuditGap = calculateDayDifference(
      event.fecha_inscripcion_fin,
      event.fecha_auditoria_inicio,
    );
    const auditDuration = calculateDayDifference(
      event.fecha_auditoria_inicio,
      event.fecha_auditoria_fin,
    );
    const auditToChampionshipGap = calculateDayDifference(
      event.fecha_auditoria_fin,
      event.fecha_campeonato_inicio,
    );
    const championshipDuration = calculateDayDifference(
      event.fecha_campeonato_inicio,
      event.fecha_campeonato_fin,
    );
    timelineOffsetsRef.current = {
      registrationDuration: registrationDuration ?? timelineOffsetsRef.current.registrationDuration ?? 3,
      registrationToAuditGap:
        registrationToAuditGap ?? timelineOffsetsRef.current.registrationToAuditGap ?? 3,
      auditDuration: auditDuration ?? timelineOffsetsRef.current.auditDuration ?? 3,
      auditToChampionshipGap:
        auditToChampionshipGap ?? timelineOffsetsRef.current.auditToChampionshipGap ?? 3,
      championshipDuration:
        championshipDuration ?? timelineOffsetsRef.current.championshipDuration ?? 3,
    };
    const sportId = event?.deporte?.id ? String(event.deporte.id) : '';
    const categoryIds = Array.isArray(event.categorias)
      ? event.categorias.map((item) => String(item.id))
      : [];
    const invitedInstitutions = Array.isArray(event.instituciones_invitadas)
      ? event.instituciones_invitadas.map((item) => String(item.institucion_id))
      : [];
    const scenarioIds = [];
    const manualScenarioOptions = [];
    const customScenarioNames = [];
    if (Array.isArray(event.escenarios)) {
      event.escenarios.forEach((item) => {
        if (item.escenario_id) {
          const value = String(item.escenario_id);
          scenarioIds.push(value);
          if (!scenarios.some((scenario) => String(scenario.id) === value)) {
            manualScenarioOptions.push({
              value,
              label: item.nombre_escenario ?? `Escenario #${value}`,
            });
          }
        } else if (item.nombre_escenario) {
          customScenarioNames.push(item.nombre_escenario);
        }
      });
    }

    reset({
      titulo: event.titulo ?? '',
      descripcion: event.descripcion ?? '',
      sexo_evento: event.sexo_evento ?? 'MX',
      deporte_id: sportId,
      categorias: categoryIds,
      escenarios: scenarioIds,
      estado: event.estado ?? 'borrador',
      fecha_campeonato_inicio: event.fecha_campeonato_inicio ?? '',
      fecha_campeonato_fin: event.fecha_campeonato_fin ?? '',
      fecha_inscripcion_inicio: event.fecha_inscripcion_inicio ?? '',
      fecha_inscripcion_fin: event.fecha_inscripcion_fin ?? '',
      fecha_auditoria_inicio: event.fecha_auditoria_inicio ?? '',
      fecha_auditoria_fin: event.fecha_auditoria_fin ?? '',
      instituciones_invitadas: invitedInstitutions,
    });
    setCustomScenarios(customScenarioNames);
    setExtraScenarioOptions(manualScenarioOptions);
    void refetchSports();
    void refetchScenarios();
    void refetchInstitutions();
    void loadCategories(sportId, { preselect: categoryIds });
    setActiveFormTab(EVENT_FORM_TABS[0].id);
    setNewCustomScenario('');
    setModalOpen(true);
  };

  const closeModal = () => {
    resetEventFormState();
  };

  const openDeleteModal = (event) => {
    setEventToDelete(event);
  };

  const closeDeleteModal = () => {
    setEventToDelete(null);
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    const wasHistorical = [
      'inscripcion',
      'auditoria',
      'campeonato',
      'finalizado',
      'archivado',
    ].includes(eventToDelete.estado);
    try {
      await eventService.remove(eventToDelete.id);
      addToast({
        title: 'Evento eliminado',
        status: 'success',
        description: wasHistorical
          ? 'El evento fue archivado y permanece disponible en el historial.'
          : 'El evento se eliminó definitivamente del registro.',
      });
      setEventToDelete(null);
      await refetchEvents();
    } catch (error) {
      addToast({
        title: 'No se pudo eliminar el evento',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCoverSelect = (file) => {
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setRemoveCover(false);
    } else {
      setCoverFile(null);
      setCoverPreview('');
    }
  };

  const handleCoverRemove = () => {
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(true);
  };

  const handleAddCustomScenario = () => {
    const trimmed = newCustomScenario.trim();
    if (!trimmed) {
      addToast({
        title: 'Nombre requerido',
        description: 'Ingresa el nombre del escenario personalizado.',
        status: 'warning',
      });
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (customScenarios.some((name) => name.toLowerCase() === normalized)) {
      addToast({
        title: 'Escenario duplicado',
        description: 'Ya agregaste este escenario personalizado.',
        status: 'warning',
      });
      return;
    }
    setCustomScenarios((prev) => [...prev, trimmed]);
    setNewCustomScenario('');
  };

  const handleRemoveCustomScenario = (index) => {
    setCustomScenarios((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    const invitedIds = Array.isArray(formData.instituciones_invitadas)
      ? formData.instituciones_invitadas
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const parsedSportId = Number.parseInt(formData.deporte_id, 10);
    const sportId = Number.isNaN(parsedSportId) ? undefined : parsedSportId;
    const categoryIds = Array.isArray(formData.categorias)
      ? formData.categorias
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];
    const scenariosPayload = [];
    if (Array.isArray(formData.escenarios)) {
      formData.escenarios.forEach((value) => {
        const normalized = String(value ?? '').trim();
        if (!normalized) return;
        const parsedId = Number.parseInt(normalized, 10);
        if (!Number.isNaN(parsedId) && parsedId > 0) {
          const scenarioRecord = scenarioLookup.get(normalized);
          scenariosPayload.push({
            escenario_id: parsedId,
            nombre_escenario:
              scenarioRecord?.nombre ?? scenarioRecord?.label ?? undefined,
          });
        }
      });
    }
    if (Array.isArray(customScenarios)) {
      customScenarios.forEach((name) => {
        const trimmed = name?.trim();
        if (trimmed) {
          scenariosPayload.push({ nombre_escenario: trimmed });
        }
      });
    }

    const metadata = {
      titulo: formData.titulo.trim(),
      descripcion: formData.descripcion?.trim() || undefined,
      sexo_evento: formData.sexo_evento,
      deporte_id: sportId,
      categorias: categoryIds,
      escenarios: scenariosPayload,
      estado: formData.estado || 'borrador',
      fecha_campeonato_inicio: formData.fecha_campeonato_inicio || undefined,
      fecha_campeonato_fin: formData.fecha_campeonato_fin || undefined,
      fecha_inscripcion_inicio: formData.fecha_inscripcion_inicio || undefined,
      fecha_inscripcion_fin: formData.fecha_inscripcion_fin || undefined,
      fecha_auditoria_inicio: formData.fecha_auditoria_inicio || undefined,
      fecha_auditoria_fin: formData.fecha_auditoria_fin || undefined,
      instituciones_invitadas: invitedIds,
    };

    try {
      const submissionPayload = {
        metadata,
        planningDocument,
        coverImage: coverFile,
      };

      if (modalMode === 'edit' && currentEvent) {
        if (removeCover && !coverFile) {
          submissionPayload.metadata = {
            ...metadata,
            remove_cover_image: true,
          };
        }
        await eventService.update(currentEvent.id, { ...submissionPayload });
        addToast({
          title: 'Evento actualizado',
          status: 'success',
          description: 'Los cambios se guardaron correctamente.',
        });
      } else {
        await eventService.create({
          metadata,
          planningDocument,
          coverImage: coverFile,
        });
        addToast({
          title: 'Evento creado',
          status: 'success',
          description:
            'Se notificó a las instituciones invitadas sobre el nuevo evento.',
        });
      }
      resetEventFormState();
      await refetchEvents();
    } catch (error) {
      addToast({
        title:
          modalMode === 'edit'
            ? 'No se pudo actualizar el evento'
            : 'No se pudo crear el evento',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const tabHasErrors = useMemo(
    () => ({
      general: Boolean(
        errors.titulo ||
          errors.deporte_id ||
          errors.sexo_evento ||
          errors.estado ||
          errors.categorias,
      ),
      logistics: Boolean(
        (Array.isArray(errors.escenarios) &&
          errors.escenarios.some((error) => Boolean(error))) ||
          errors.instituciones_invitadas,
      ),
      schedule: Boolean(
        errors.fecha_inscripcion_inicio ||
          errors.fecha_inscripcion_fin ||
          errors.fecha_auditoria_inicio ||
          errors.fecha_auditoria_fin ||
          errors.fecha_campeonato_inicio ||
          errors.fecha_campeonato_fin,
      ),
      media: false,
    }),
    [errors],
  );

  return (
    <>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Eventos deportivos"
            description="Administra los eventos programados y mantén informadas a las instituciones invitadas."
            actions={
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
                <Button variant="gradient" size="sm" onClick={openCreateModal}>
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Nuevo evento
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sky-500 hover:bg-sky-100/60"
                  onClick={() => refetchEvents()}
                  disabled={eventsLoading}
                >
                  <ArrowPathIcon className="h-4 w-4" aria-hidden />
                  Refrescar
                </Button>
              </div>
            }
          />
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-md">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por título, deporte o institución"
                label="Buscar eventos"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <div className="relative" ref={columnFilterRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!px-3"
                  onClick={() => setColumnMenuOpen((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={isColumnMenuOpen}
                >
                  <ViewColumnsIcon className="h-5 w-5" aria-hidden />
                  <span className="ml-2 hidden text-sm font-medium md:inline">
                    Columnas
                  </span>
                </Button>
                {isColumnMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Columnas visibles
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      {columnDefinitions
                        .filter((column) => column.hideable)
                        .map((column) => {
                          const isChecked = visibleColumns.has(column.accessor);
                          return (
                            <label
                              key={column.accessor}
                              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <span>{column.Header}</span>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                checked={isChecked}
                                onChange={() => toggleColumn(column.accessor)}
                              />
                            </label>
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={handleResetColumns}
                      className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Restablecer
                    </button>
                  </div>
                )}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    viewMode === 'table'
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  aria-pressed={viewMode === 'table'}
                >
                  <ListBulletIcon className="h-4 w-4" aria-hidden />
                  <span className="hidden md:inline">Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    viewMode === 'grid'
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  aria-pressed={viewMode === 'grid'}
                >
                  <Squares2X2Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden md:inline">Tarjetas</span>
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <DataTable
              columns={columnsToRender}
              data={filteredEvents}
              emptyMessage={tableEmptyMessage}
              loading={eventsLoading}
              renderActions={renderEventActions}
            />
          ) : (
            <div className="mt-4">
              {eventsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`event-skeleton-${index}`}
                      className="h-64 rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                      <div className="mt-4 space-y-2">
                        <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                  {tableEmptyMessage}
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEvents.map((event) => {
                    const coverUrl = event?.imagen_portada_url
                      ? resolveMediaUrl(event.imagen_portada_url)
                      : '';
                    const invitedPreview = Array.isArray(
                      event?.instituciones_invitadas,
                    )
                      ? event.instituciones_invitadas.slice(0, 4)
                      : [];
                    const totalInstitutions =
                      event?.instituciones_invitadas?.length ?? 0;
                    const scenarioSummary = Array.isArray(event?.escenarios)
                      ? event.escenarios
                          .map((item) => item?.nombre_escenario ?? '')
                          .filter(Boolean)
                          .join(', ')
                      : '';
                    const categorySummary = Array.isArray(event?.categorias)
                      ? event.categorias
                          .map((item) => item?.nombre ?? '')
                          .filter(Boolean)
                          .join(', ')
                      : '';
                    return (
                      <article
                        key={event.id ?? event.titulo}
                        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-sm transition hover:border-primary-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/60"
                      >
                        <div className="relative">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={`Portada de ${event.titulo}`}
                              className="h-44 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-44 w-full items-center justify-center bg-gradient-to-r from-sky-200 to-rose-200 text-lg font-semibold text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200">
                              {(event.titulo ?? 'EV').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                            <Badge
                              color={
                                EVENT_STAGE_BADGES[event.etapa_actual] ??
                                'neutral'
                              }
                            >
                              {EVENT_STAGE_LABELS[event.etapa_actual] ??
                                'Sin etapa'}
                            </Badge>
                            <Badge
                              color={
                                STATE_BADGE_COLOR[event.estado] ?? 'neutral'
                              }
                            >
                              {event.estado ?? 'Borrador'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                              {event.titulo}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-300">
                              {event.deporte?.nombre ?? 'Deporte por confirmar'}{' '}
                              • {SEX_LABELS[event.sexo_evento] ?? 'Mixto'}
                            </p>
                          </div>
                          {categorySummary && (
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              Categorías: {categorySummary}
                            </p>
                          )}
                          {scenarioSummary && (
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              Escenarios: {scenarioSummary}
                            </p>
                          )}
                          <div className="grid gap-2 text-xs text-slate-500 dark:text-slate-300 sm:grid-cols-2">
                            <div>
                              <p className="font-semibold uppercase text-slate-400 dark:text-slate-500">
                                Inscripciones
                              </p>
                              <p>
                                {formatDate(event.fecha_inscripcion_inicio)} —{' '}
                                {formatDate(event.fecha_inscripcion_fin)}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase text-slate-400 dark:text-slate-500">
                                Campeonato
                              </p>
                              <p>
                                {formatDate(event.fecha_campeonato_inicio)} —{' '}
                                {formatDate(event.fecha_campeonato_fin)}
                              </p>
                            </div>
                          </div>
                          {invitedPreview.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {invitedPreview.map((inst) => (
                                <span
                                  key={`${event.id}-${inst.institucion_id}`}
                                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {inst.nombre ?? `ID ${inst.institucion_id}`}
                                </span>
                              ))}
                              {totalInstitutions > invitedPreview.length && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  +{totalInstitutions - invitedPreview.length}{' '}
                                  más
                                </span>
                              )}
                            </div>
                          )}
                          <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-slate-600 hover:text-primary-600 dark:text-slate-200"
                              onClick={() => navigate(`/admin/eventos/${event?.id}/detalle`)}
                              aria-label={`Visualizar ${event?.titulo ?? 'evento'}`}
                            >
                              <EyeIcon className="h-4 w-4" aria-hidden /> Ver detalle
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 dark:text-amber-400"
                              onClick={() => openTimelineModal(event)}
                              aria-label={`Actualizar cronograma de ${event?.titulo ?? 'evento'}`}
                            >
                              <ArrowPathIcon className="h-4 w-4" aria-hidden /> Cronograma
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              onClick={() => openEditModal(event)}
                              aria-label={`Editar ${event?.titulo ?? 'evento'}`}
                            >
                              <PencilSquareIcon className="h-4 w-4" aria-hidden /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              onClick={() => openDeleteModal(event)}
                              aria-label={`Eliminar ${event?.titulo ?? 'evento'}`}
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden /> Eliminar
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={
          isSubmitting
            ? 'Guardando…'
            : modalMode === 'edit'
            ? 'Guardar cambios'
            : 'Registrar evento'
        }
        confirmDisabled={isSubmitting}
        title={
          modalMode === 'edit'
            ? 'Editar evento deportivo'
            : 'Nuevo evento deportivo'
        }
        description={
          modalMode === 'edit'
            ? 'Actualiza la información del evento y notifica a las instituciones involucradas.'
            : 'Registra un evento deportivo y envía invitaciones a las instituciones seleccionadas.'
        }
        size="xl"
      >
        <form className="space-y-6 px-2" onSubmit={onSubmit}>
          <div
            className="rounded-3xl bg-slate-100/80 p-1 dark:bg-slate-800/40"
            role="tablist"
            aria-label="Secciones del formulario de eventos"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EVENT_FORM_TABS.map((tab) => {
                const isActive = activeFormTab === tab.id;
                const hasError = tabHasErrors[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`event-form-${tab.id}`}
                    onClick={() => setActiveFormTab(tab.id)}
                    className={`flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400 ${
                      isActive
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/40'
                        : 'bg-white text-slate-600 hover:bg-primary-500/10 hover:text-primary-600 dark:bg-slate-900/60 dark:text-slate-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {hasError && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeFormTab === 'general' && (
            <div
              id="event-form-general"
              role="tabpanel"
              aria-label="Información general del evento"
              className="space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Nombre del evento
                  </label>
                  <input
                    {...register('titulo')}
                    type="text"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                    placeholder="Ej. Juegos Intercolegiados"
                  />
                  {errors.titulo && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.titulo.message}
                    </p>
                  )}
                </div>
                <div>
                  <Controller
                    name="deporte_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Deporte"
                        options={sportOptions}
                        value={field.value ?? ''}
                        onChange={(value) => {
                          field.onChange(value ?? '');
                          loadCategories(value ?? '');
                        }}
                        placeholder={
                          sportsLoading
                            ? 'Cargando deportes…'
                            : 'Selecciona un deporte'
                        }
                      />
                    )}
                  />
                  {errors.deporte_id && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.deporte_id.message}
                    </p>
                  )}
                  {sportsLoading && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <Spinner /> Actualizando listado de deportes…
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="sexo_evento"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Sexo del evento"
                      options={SEX_OPTIONS}
                      value={field.value ?? 'MX'}
                      onChange={(value) => field.onChange(value ?? 'MX')}
                      placeholder="Selecciona el tipo de evento"
                    />
                  )}
                />
                <Controller
                  name="estado"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Estado del evento"
                      options={EVENT_STATE_OPTIONS}
                      value={field.value ?? 'borrador'}
                      onChange={(value) => field.onChange(value ?? 'borrador')}
                      placeholder="Selecciona un estado"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Descripción
                </label>
                <textarea
                  {...register('descripcion')}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  placeholder="Describe objetivos, fases o detalles logísticos."
                />
              </div>

              <Controller
                name="categorias"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Categorías permitidas"
                    multiple
                    options={categoryOptions}
                    value={field.value ?? []}
                    onChange={(value) => field.onChange(value ?? [])}
                    placeholder={
                      !selectedSportId
                        ? 'Selecciona un deporte para listar categorías'
                        : categoriesLoading
                        ? 'Cargando categorías…'
                        : 'Selecciona una o varias categorías'
                    }
                    disabled={!selectedSportId || categoriesLoading}
                  />
                )}
              />
              {errors.categorias && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.categorias.message}
                </p>
              )}
              {selectedSportId &&
                !categoriesLoading &&
                categoryOptions.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    No hay categorías activas para este deporte.
                  </p>
                )}
            </div>
          )}

          {activeFormTab === 'logistics' && (
            <div
              id="event-form-logistics"
              role="tabpanel"
              aria-label="Logística del evento"
              className="space-y-6"
            >
              <Controller
                name="escenarios"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Escenarios disponibles"
                    multiple
                    searchable
                    options={scenarioOptions}
                    value={Array.isArray(field.value) ? field.value : []}
                    onChange={(value) => field.onChange(value ?? [])}
                    placeholder={
                      scenariosLoading
                        ? 'Cargando escenarios…'
                        : 'Selecciona uno o varios escenarios registrados'
                    }
                  />
                )}
              />
              {Array.isArray(errors.escenarios) &&
                errors.escenarios.some((error) => error?.message) && (
                  <p className="-mt-2 text-xs text-red-500">
                    {errors.escenarios.find((error) => error?.message)
                      ?.message ?? 'Selecciona escenarios válidos'}
                  </p>
                )}
              {scenariosLoading && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <Spinner /> Actualizando listado de escenarios…
                </p>
              )}

              <div className="space-y-3 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Escenarios personalizados
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Úsalos cuando la sede no esté registrada en el catálogo
                      oficial.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <input
                      type="text"
                      value={newCustomScenario}
                      onChange={(event) =>
                        setNewCustomScenario(event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Ej. Coliseo Principal"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddCustomScenario}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
                {customScenarios.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {customScenarios.map((name, index) => (
                      <li
                        key={`${name}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                      >
                        <span className="text-slate-700 dark:text-slate-200">
                          {name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCustomScenario(index)}
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Aún no has agregado escenarios personalizados para este
                    evento.
                  </p>
                )}
              </div>

              <Controller
                name="instituciones_invitadas"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Instituciones educativas invitadas"
                    multiple
                    searchable
                    options={institutionOptions}
                    value={field.value ?? []}
                    onChange={(value) => field.onChange(value ?? [])}
                    placeholder={
                      institutionsLoading
                        ? 'Cargando instituciones…'
                        : 'Selecciona una o varias instituciones'
                    }
                  />
                )}
              />
              {errors.instituciones_invitadas && (
                <p className="-mt-2 text-xs text-red-500">
                  Selecciona instituciones válidas
                </p>
              )}
              {institutionsLoading && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <Spinner /> Actualizando listado de instituciones…
                </p>
              )}
            </div>
          )}

          {activeFormTab === 'schedule' && (
            <div
              id="event-form-schedule"
              role="tabpanel"
              aria-label="Cronograma del evento"
              className="space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Apertura de inscripciones
                  </label>
                  <input
                    {...register('fecha_inscripcion_inicio')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_inscripcion_inicio && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_inscripcion_inicio.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Cierre de inscripciones
                  </label>
                  <input
                    {...register('fecha_inscripcion_fin')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_inscripcion_fin && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_inscripcion_fin.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Inicio de auditoría
                  </label>
                  <input
                    {...register('fecha_auditoria_inicio')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_auditoria_inicio && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_auditoria_inicio.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Fin de auditoría
                  </label>
                  <input
                    {...register('fecha_auditoria_fin')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_auditoria_fin && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_auditoria_fin.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Inicio del campeonato
                  </label>
                  <input
                    {...register('fecha_campeonato_inicio')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_campeonato_inicio && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_campeonato_inicio.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Fin del campeonato
                  </label>
                  <input
                    {...register('fecha_campeonato_fin')}
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {errors.fecha_campeonato_fin && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fecha_campeonato_fin.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeFormTab === 'media' && (
            <div
              id="event-form-media"
              role="tabpanel"
              aria-label="Material de apoyo del evento"
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Documento de planeación inicial
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.odt"
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-200 dark:text-slate-200 dark:file:bg-primary-500/20 dark:file:text-primary-100"
                  onChange={(event) =>
                    setPlanningDocument(event.target.files?.[0] ?? null)
                  }
                />
                {modalMode === 'edit' &&
                  currentEvent?.documento_planeacion_url && (
                    <a
                      href={resolveMediaUrl(
                        currentEvent.documento_planeacion_url,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300"
                    >
                      <PaperClipIcon className="h-4 w-4" aria-hidden />
                      Ver documento actual
                    </a>
                  )}
              </div>

              <FileUpload
                label="Imagen representativa"
                description="Sube una fotografía del evento para identificarlo visualmente."
                helperText="Formatos admitidos: JPG, PNG, WebP o GIF."
                accept="image/png,image/jpeg,image/webp,image/gif"
                previewUrl={coverPreview}
                onFileSelect={(file) => handleCoverSelect(file)}
                onRemove={coverPreview ? handleCoverRemove : undefined}
              />
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={timelineModal.open}
        onClose={closeTimelineModal}
        onConfirm={handleSubmitTimeline}
        confirmLabel={savingTimeline ? 'Actualizando…' : 'Actualizar cronograma'}
        confirmDisabled={savingTimeline}
        title="Actualizar cronograma"
        description="Extiende las fechas de inscripción o auditoría. Si hay conflicto con el campeonato, también puedes ajustar sus fechas."
        size="md"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Inicio de inscripción
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_inscripcion_inicio ?? ''}
                onChange={(event) => handleTimelineChange('fecha_inscripcion_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Cierre de inscripción
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_inscripcion_fin ?? ''}
                onChange={(event) => handleTimelineChange('fecha_inscripcion_fin', event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Inicio de auditoría
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_auditoria_inicio ?? ''}
                onChange={(event) => handleTimelineChange('fecha_auditoria_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Fin de auditoría
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_auditoria_fin ?? ''}
                onChange={(event) => handleTimelineChange('fecha_auditoria_fin', event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Inicio del campeonato
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_campeonato_inicio ?? ''}
                onChange={(event) => handleTimelineChange('fecha_campeonato_inicio', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Fin del campeonato
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                value={timelineModal.values.fecha_campeonato_fin ?? ''}
                onChange={(event) => handleTimelineChange('fecha_campeonato_fin', event.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(eventToDelete)}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        confirmLabel={isDeleting ? 'Eliminando…' : 'Eliminar'}
        confirmDisabled={isDeleting}
        title={
          [
            'inscripcion',
            'auditoria',
            'campeonato',
            'finalizado',
            'archivado',
          ].includes(eventToDelete?.estado ?? '')
            ? 'Archivar evento'
            : 'Eliminar evento'
        }
        description={
          [
            'inscripcion',
            'auditoria',
            'campeonato',
            'finalizado',
            'archivado',
          ].includes(eventToDelete?.estado ?? '')
            ? 'El evento se marcará como archivado para preservar su historial.'
            : 'Esta acción eliminará el evento de manera permanente.'
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Confirmas que deseas{' '}
          {[
            'inscripcion',
            'auditoria',
            'campeonato',
            'finalizado',
            'archivado',
          ].includes(eventToDelete?.estado ?? '')
            ? 'archivar'
            : 'eliminar'}{' '}
          el evento <strong>{eventToDelete?.titulo}</strong>?
        </p>
      </Modal>
    </>
  );
};
