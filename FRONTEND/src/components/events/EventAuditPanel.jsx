import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { DataTable } from '../data-display/DataTable.jsx';
import { Modal } from '../ui/Modal.jsx';
import { useToastContext } from '../../context/ToastContext.jsx';
import { eventService } from '../../services/dataService.js';
import { resolveMediaUrl } from '../../utils/media.js';
import { SearchInput } from '../ui/SearchInput.jsx';
import { Select } from '../ui/Select.jsx';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const toInputDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const booleanLabel = (value) => (value ? 'Sí' : 'No');

const STAGE_LABELS = {
  borrador: 'En planificación',
  inscripcion: 'Inscripción abierta',
  auditoria: 'Auditoría en proceso',
  campeonato: 'Campeonato en curso',
  finalizado: 'Evento finalizado',
  archivado: 'Evento archivado',
};

const INVITATION_LABELS = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

const DOCUMENT_REVIEW_STATUS_META = {
  pendiente: { label: 'Pendiente', color: 'neutral' },
  aprobado: { label: 'Aprobado', color: 'success' },
  correccion: { label: 'Corrección requerida', color: 'warning' },
};

const STUDENT_STATUS_META = {
  complete: {
    label: 'Documentación completa',
    color: 'success',
    description: 'Todos los documentos han sido aprobados.',
  },
  correction: {
    label: 'Corrección requerida',
    color: 'warning',
    description: 'Hay observaciones que requieren ajustes.',
  },
  pending: {
    label: 'Pendiente de revisión',
    color: 'neutral',
    description: 'Hay documentos sin revisión o sin estado definido.',
  },
  missing: {
    label: 'Sin documentos adjuntos',
    color: 'neutral',
    description: 'La institución aún no adjunta documentación para el estudiante.',
  },
};

const STUDENT_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estudiantes' },
  { value: 'complete', label: 'Documentación completa' },
  { value: 'pending', label: 'Pendiente de revisión' },
  { value: 'correction', label: 'Con observaciones' },
  { value: 'missing', label: 'Sin documentos' },
];

const calculateAge = (birthdate) => {
  if (!birthdate) return null;
  const dateValue = new Date(birthdate);
  if (Number.isNaN(dateValue.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dateValue.getFullYear();
  const monthDiff = today.getMonth() - dateValue.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateValue.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const getInitials = (firstName, lastName) => {
  const names = `${firstName ?? ''} ${lastName ?? ''}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!names.length) return 'AG';
  const initials = names.slice(0, 2).map((item) => item.charAt(0).toUpperCase());
  return initials.join('');
};

const AuditStatusBadge = ({ status }) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'aprobada') {
    return (
      <Badge color="accent">
        <CheckCircleIcon className="mr-1 h-4 w-4" aria-hidden /> Aprobada
      </Badge>
    );
  }
  if (normalized === 'rechazada') {
    return (
      <Badge color="primary">
        <XCircleIcon className="mr-1 h-4 w-4" aria-hidden /> Rechazada
      </Badge>
    );
  }
  if (normalized === 'correccion') {
    return (
      <Badge color="primary">
        <ExclamationTriangleIcon className="mr-1 h-4 w-4" aria-hidden /> Corrección
      </Badge>
    );
  }
  return <Badge color="neutral">Pendiente</Badge>;
};

export const EventAuditPanel = ({
  eventId,
  institutions,
  loading = false,
  onRefresh,
  currentStage,
  auditStart,
  auditEnd,
}) => {
  const { addToast } = useToastContext();
  const [detailModal, setDetailModal] = useState({
    open: false,
    institution: null,
    loading: false,
    data: null,
  });
  const [documentReviews, setDocumentReviews] = useState(new Map());
  const [savingDocumentReviews, setSavingDocumentReviews] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const [extensionModal, setExtensionModal] = useState({
    open: false,
    institution: null,
    deadline: '',
  });
  const [savingExtension, setSavingExtension] = useState(false);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [bulkDecisionModal, setBulkDecisionModal] = useState({
    open: false,
    decision: null,
    motivo: '',
  });
  const [savingBulkDecision, setSavingBulkDecision] = useState(false);
  const [decisionModal, setDecisionModal] = useState({
    open: false,
    institution: null,
    decision: null,
    motivo: '',
  });
  const [savingDecision, setSavingDecision] = useState(false);
  const [search, setSearch] = useState('');

  const institutionRows = useMemo(
    () =>
      (Array.isArray(institutions) ? institutions : []).map((institution) => {
        const rowId =
          institution?.evento_institucion_id
          ?? institution?.id
          ?? institution?.institucion_id;
        return {
          id: rowId ?? institution?.id,
          ...institution,
        };
      }),
    [institutions],
  );

  const snapshotToReviewMap = (snapshot) => {
    const map = new Map();
    (snapshot?.estudiantes ?? []).forEach((student) => {
      (student?.documentos ?? []).forEach((document) => {
        const estado = (document?.estado_revision ?? 'pendiente').toLowerCase();
        map.set(Number(document?.id), {
          estado: DOCUMENT_REVIEW_STATUS_META[estado] ? estado : 'pendiente',
          observaciones: document?.observaciones_revision ?? '',
        });
      });
    });
    return map;
  };

  const filteredInstitutions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return institutionRows;
    }
    return institutionRows.filter((institution) => {
      const name = institution?.institucion_nombre?.toLowerCase() ?? '';
      const invitation = (institution?.estado_invitacion ?? '').toLowerCase();
      const auditState = (institution?.estado_auditoria ?? '').toLowerCase();
      return [name, invitation, auditState].some((value) => value.includes(term));
    });
  }, [institutionRows, search]);

  const normalizedStage = String(currentStage ?? '').toLowerCase();
  const isAuditStage = normalizedStage === 'auditoria';
  const isRegistrationStage = normalizedStage === 'inscripcion';
  const canEditDocuments = isAuditStage || isRegistrationStage;
  const stageLabel = STAGE_LABELS[normalizedStage] ?? 'Etapa no disponible';

  const resolveRowId = useCallback((row) => {
    const candidate = row?.id ?? row?.evento_institucion_id ?? row?.institucion_id;
    const numericId = Number(candidate);
    if (Number.isFinite(numericId) && numericId > 0) return numericId;
    return candidate ? String(candidate) : null;
  }, []);

  const isRowSelectableForDecision = useCallback(
    (row) => {
      const invitationAccepted = String(row?.estado_invitacion ?? '').toLowerCase() === 'aceptada';
      return isAuditStage && invitationAccepted && resolveRowId(row) !== null;
    },
    [isAuditStage, resolveRowId],
  );

  const selectableIds = useMemo(
    () =>
      institutionRows
        .filter((row) => isRowSelectableForDecision(row))
        .map((row) => resolveRowId(row))
        .filter(Boolean),
    [institutionRows, isRowSelectableForDecision, resolveRowId],
  );

  const selectedSet = useMemo(
    () => new Set(selectedInstitutions.map((id) => id)),
    [selectedInstitutions],
  );

  useEffect(() => {
    if (!isAuditStage) {
      setSelectedInstitutions([]);
      return;
    }
    const allowed = new Set(selectableIds);
    setSelectedInstitutions((current) => current.filter((id) => allowed.has(id)));
  }, [isAuditStage, selectableIds]);

  const selectedCount = selectedInstitutions.length;
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));

  const handleToggleSelectAll = useCallback(
    (checked) => {
      setSelectedInstitutions(checked ? selectableIds : []);
    },
    [selectableIds],
  );

  const handleToggleRow = useCallback(
    (row) => {
      const rowId = resolveRowId(row);
      if (!rowId || !isRowSelectableForDecision(row)) return;
      setSelectedInstitutions((current) => {
        const next = new Set(current);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return Array.from(next);
      });
    },
    [isRowSelectableForDecision, resolveRowId],
  );

  const auditWindow = useMemo(() => {
    const start = formatDate(auditStart);
    const end = formatDate(auditEnd);
    if (start === '—' && end === '—') {
      return null;
    }
    return `${start} — ${end}`;
  }, [auditStart, auditEnd]);

  const handleRefresh = async () => {
    if (!eventId || typeof onRefresh !== 'function') return;
    await onRefresh();
  };

  const handleOpenDetail = async (institution) => {
    if (!eventId || !institution?.institucion_id) return;
    setDetailModal({ open: true, institution, loading: true, data: null });
    setDocumentReviews(new Map());
    setStudentSearch('');
    setStudentFilter('all');
    try {
      const snapshot = await eventService.getInstitutionRegistration(
        eventId,
        institution.institucion_id,
      );
      setDetailModal({ open: true, institution, loading: false, data: snapshot });
      setDocumentReviews(snapshotToReviewMap(snapshot));
    } catch (error) {
      addToast({
        title: 'Error al obtener la inscripción',
        description: error?.message,
        status: 'error',
      });
      setDetailModal({ open: false, institution: null, loading: false, data: null });
      setDocumentReviews(new Map());
    }
  };

  const handleCloseDetail = () => {
    setDetailModal({ open: false, institution: null, loading: false, data: null });
    setDocumentReviews(new Map());
    setStudentSearch('');
    setStudentFilter('all');
  };

  const handleDocumentReviewChange = (documentId, changes) => {
    setDocumentReviews((prev) => {
      const next = new Map(prev);
      const current = next.get(documentId) ?? { estado: 'pendiente', observaciones: '' };
      next.set(documentId, { ...current, ...changes });
      return next;
    });
  };

  const handleOpenExtension = (institution) => {
    if (!institution) return;
    const suggested =
      institution?.fecha_inscripcion_extendida ?? institution?.fecha_inscripcion_fin ?? '';
    setExtensionModal({
      open: true,
      institution,
      deadline: toInputDate(suggested),
    });
  };

  const handleSaveExtension = async () => {
    if (!eventId || !extensionModal.institution?.institucion_id) return;
    const normalizedDeadline = extensionModal.deadline?.trim();
    const parsedDeadline = normalizedDeadline ? new Date(normalizedDeadline) : null;
    const parsedAuditEnd = auditEnd ? new Date(auditEnd) : null;

    if (parsedDeadline && Number.isNaN(parsedDeadline.getTime())) {
      addToast({
        title: 'Fecha inválida',
        description: 'Ingresa una fecha válida para la prórroga de inscripción.',
        status: 'error',
      });
      return;
    }

    if (parsedDeadline && parsedAuditEnd && parsedDeadline > parsedAuditEnd) {
      addToast({
        title: 'Prórroga fuera de rango',
        description: 'La nueva fecha no puede superar el cierre de auditoría.',
        status: 'warning',
      });
      return;
    }

    try {
      setSavingExtension(true);
      await eventService.extendInstitutionRegistration(
        eventId,
        extensionModal.institution.institucion_id,
        { fecha_inscripcion_extendida: normalizedDeadline || null },
      );
      addToast({ title: 'Prórroga guardada', status: 'success' });
      setExtensionModal({ open: false, institution: null, deadline: '' });
      await handleRefresh();
    } catch (error) {
      addToast({
        title: 'No se pudo actualizar la prórroga',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setSavingExtension(false);
    }
  };

  const handleOpenDecision = (institution, decision) => {
    setDecisionModal({
      open: true,
      institution,
      decision,
      motivo: decision === 'rechazar' ? institution?.motivo_rechazo ?? '' : '',
    });
  };

  const handleSubmitDecision = async () => {
    if (!eventId || !decisionModal.institution?.institucion_id || !decisionModal.decision) {
      return;
    }
    if (decisionModal.decision === 'rechazar' && !decisionModal.motivo.trim()) {
      addToast({
        title: 'Indica el motivo de rechazo',
        status: 'warning',
        description: 'Debes especificar un motivo para rechazar la participación.',
      });
      return;
    }
    try {
      setSavingDecision(true);
      await eventService.auditInstitution(eventId, decisionModal.institution.institucion_id, {
        decision: decisionModal.decision,
        motivo: decisionModal.motivo?.trim() || null,
      });
      addToast({ title: 'Auditoría registrada', status: 'success' });
      setDecisionModal({ open: false, institution: null, decision: null, motivo: '' });
      await handleRefresh();
    } catch (error) {
      addToast({
        title: 'Error al registrar la auditoría',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setSavingDecision(false);
    }
  };

  const handleOpenBulkDecision = (decision) => {
    if (!selectedCount) return;
    setBulkDecisionModal({ open: true, decision, motivo: decision === 'rechazar' ? '' : '' });
  };

  const handleSubmitBulkDecision = async () => {
    if (!eventId || !bulkDecisionModal.decision || !selectedCount) return;
    if (bulkDecisionModal.decision === 'rechazar' && !bulkDecisionModal.motivo.trim()) {
      addToast({
        title: 'Indica el motivo de rechazo',
        status: 'warning',
        description: 'Debes especificar un motivo para rechazar la participación.',
      });
      return;
    }
    try {
      setSavingBulkDecision(true);
      const response = await eventService.auditInstitutionsBatch(eventId, {
        decision: bulkDecisionModal.decision,
        motivo: bulkDecisionModal.motivo?.trim() || null,
        instituciones: selectedInstitutions
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      });
      const updatedCount = Array.isArray(response) ? response.length : 0;
      addToast({
        title: 'Decisión grupal registrada',
        description:
          updatedCount === 1
            ? 'Se actualizó 1 institución.'
            : `Se actualizaron ${updatedCount} instituciones.`,
        status: 'success',
      });
      setBulkDecisionModal({ open: false, decision: null, motivo: '' });
      setSelectedInstitutions([]);
      await handleRefresh();
    } catch (error) {
      addToast({
        title: 'No se pudo aplicar la decisión grupal',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setSavingBulkDecision(false);
    }
  };

  const handleSubmitDocumentReviews = async () => {
    if (!eventId || !detailModal.institution?.institucion_id) {
      return;
    }
    const payload = {
      documentos: Array.from(documentReviews.entries()).map(([docId, review]) => ({
        documento_id: Number(docId),
        estado: review?.estado ?? 'pendiente',
        observaciones: review?.observaciones?.trim() || null,
      })),
    };
    if (!payload.documentos.length) {
      addToast({ title: 'No hay cambios para guardar', status: 'info' });
      return;
    }
    try {
      setSavingDocumentReviews(true);
      const snapshot = await eventService.reviewInstitutionDocuments(
        eventId,
        detailModal.institution.institucion_id,
        payload,
      );
      addToast({ title: 'Revisión guardada', status: 'success' });
      setDetailModal((prev) => ({ ...prev, data: snapshot }));
      setDocumentReviews(snapshotToReviewMap(snapshot));
      await handleRefresh();
    } catch (error) {
      addToast({
        title: 'No se pudo guardar la revisión',
        description: error?.message,
        status: 'error',
      });
    } finally {
      setSavingDocumentReviews(false);
    }
  };

  const resolveDocumentState = useCallback(
    (document) => {
      const docId = Number(document?.id ?? 0);
      if (docId && documentReviews.has(docId)) {
        const stored = documentReviews.get(docId);
        return String(stored?.estado ?? 'pendiente').toLowerCase();
      }
      return String(document?.estado_revision ?? 'pendiente').toLowerCase();
    },
    [documentReviews],
  );

  const resolveStudentStatus = useCallback(
    (student) => {
      const documents = Array.isArray(student?.documentos) ? student.documentos : [];
      if (!documents.length) {
        return 'missing';
      }
      const states = documents.map((document) => resolveDocumentState(document));
      if (states.every((state) => state === 'aprobado')) {
        return 'complete';
      }
      if (states.some((state) => state === 'correccion')) {
        return 'correction';
      }
      return 'pending';
    },
    [resolveDocumentState],
  );

  const filteredStudents = useMemo(() => {
    const list = Array.isArray(detailModal.data?.estudiantes)
      ? detailModal.data.estudiantes
      : [];
    const term = studentSearch.trim().toLowerCase();
    return list
      .map((student) => ({ student, status: resolveStudentStatus(student) }))
      .filter(({ student, status }) => {
        if (studentFilter !== 'all' && status !== studentFilter) {
          return false;
        }
        if (!term) {
          return true;
        }
        const fullName = `${student.nombres ?? ''} ${student.apellidos ?? ''}`
          .trim()
          .toLowerCase();
        const identity = String(student.documento_identidad ?? '')
          .trim()
          .toLowerCase();
        return fullName.includes(term) || identity.includes(term);
      });
  }, [detailModal.data?.estudiantes, studentFilter, studentSearch, resolveStudentStatus]);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        Header: 'Institución',
        accessor: 'institucion_nombre',
        Cell: ({ value, row }) => {
          const displayName = value ?? `ID ${row.institucion_id}`;
          const coverUrl = row?.institucion_portada_url
            ? resolveMediaUrl(row.institucion_portada_url)
            : null;
          const initials = String(displayName ?? '')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
            .padEnd(2, '·');
          return (
            <div className="flex items-center gap-3">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={`Logotipo de ${displayName}`}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {initials}
                </div>
              )}
              <span className="font-semibold text-slate-700 dark:text-slate-100">{displayName}</span>
            </div>
          );
        },
      },
      {
        Header: 'Estado invitación',
        accessor: 'estado_invitacion',
        Cell: ({ value }) =>
          INVITATION_LABELS[String(value ?? '').toLowerCase()] ?? '—',
      },
      {
        Header: 'Estado auditoría',
        accessor: 'estado_auditoria',
        Cell: ({ value }) => <AuditStatusBadge status={value} />,
      },
      {
        Header: 'Participantes',
        accessor: 'cantidad_inscritos',
      },
      {
        Header: 'Sexo válido',
        accessor: 'sexo_valido',
        Cell: ({ value }) => booleanLabel(value),
      },
      {
        Header: 'Documentación completa',
        accessor: 'documentacion_completa',
        Cell: ({ value }) => {
          if (value === true) return 'Sí';
          if (value === false) return 'No';
          return 'Pendiente';
        },
      },
      {
        Header: 'Última actualización',
        accessor: 'ultima_version_enviada_en',
        Cell: ({ value }) => formatDateTime(value),
      },
      {
        Header: 'Observaciones',
        accessor: 'motivo_rechazo',
        Cell: ({ value }) => value ?? '—',
        className: 'max-w-xs',
      },
    ];

    if (isAuditStage) {
      baseColumns.unshift({
        Header: (
          <div className="flex justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              aria-label="Seleccionar todas las instituciones"
              checked={allSelected}
              onChange={(event) => handleToggleSelectAll(event.target.checked)}
            />
          </div>
        ),
        accessor: '__selection__',
        className: 'w-14',
        cellClassName: 'w-14',
        Cell: ({ row }) => {
          const rowId = resolveRowId(row);
          const disabled = !isRowSelectableForDecision(row);
          const checked = rowId ? selectedSet.has(rowId) : false;
          return (
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                aria-label="Seleccionar institución"
                disabled={disabled}
                checked={checked}
                onChange={() => handleToggleRow(row)}
              />
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [
    allSelected,
    handleToggleRow,
    handleToggleSelectAll,
    isAuditStage,
    isRowSelectableForDecision,
    resolveRowId,
    selectedSet,
  ]);

  const renderRowActions = (row) => {
    const invitationAccepted = String(row.estado_invitacion ?? '').toLowerCase() === 'aceptada';
    const alreadyApproved = String(row.estado_auditoria ?? '').toLowerCase() === 'aprobada';
    const alreadyRejected = String(row.estado_auditoria ?? '').toLowerCase() === 'rechazada';
    const canApproveOrReject = invitationAccepted && isAuditStage;
    const canRequestFix = invitationAccepted && isRegistrationStage;

    const actionButtons = [
      {
        key: 'view',
        label: 'Ver inscripción',
        icon: EyeIcon,
        onClick: () => handleOpenDetail(row),
        disabled: false,
        className: 'text-sky-600 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800/60',
        hidden: false,
      },
      {
        key: 'extend',
        label: 'Extender inscripción',
        icon: ClockIcon,
        onClick: () => handleOpenExtension(row),
        disabled: !isAuditStage,
        className: 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-slate-800/60',
        hidden: false,
      },
      {
        key: 'approve',
        label: 'Aprobar',
        icon: CheckCircleIcon,
        onClick: () => handleOpenDecision(row, 'aprobar'),
        disabled: !canApproveOrReject || alreadyApproved,
        className: 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-800/60',
        hidden: !canApproveOrReject,
      },
      {
        key: 'reject',
        label: 'Rechazar',
        icon: XCircleIcon,
        onClick: () => handleOpenDecision(row, 'rechazar'),
        disabled: !canApproveOrReject || alreadyRejected,
        className: 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-800/60',
        hidden: !canApproveOrReject,
      },
      {
        key: 'warn',
        label: 'Solicitar corrección',
        icon: ExclamationTriangleIcon,
        onClick: () => handleOpenDecision(row, 'corregir'),
        disabled: !canRequestFix,
        className: 'text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-slate-800/60',
        hidden: !canRequestFix,
      },
    ];

    const visibleActions = actionButtons.filter((action) => !action.hidden);
    if (!visibleActions.length) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {visibleActions.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
            aria-label={action.label}
            className={`w-full justify-center sm:w-auto border border-slate-200 bg-white/90 px-2 py-2 shadow-sm transition hover:-translate-y-0 hover:shadow ${action.className} dark:border-slate-700 dark:bg-slate-900/60`}
          >
            <action.icon className="h-5 w-5" aria-hidden />
            <span className="sr-only">{action.label}</span>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Auditoría de inscripciones"
          description="Revisa la participación de cada institución, gestiona las prórrogas de inscripción y registra las decisiones del comité."
          actions={
            <div className="flex items-center gap-2">
              <Badge color={isAuditStage ? 'accent' : 'neutral'}>{stageLabel}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || !eventId}
                title="Actualizar información"
                aria-label="Actualizar información"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                <span className="sr-only">Actualizar información</span>
              </Button>
            </div>
          }
        />
        <div className="space-y-4">
          {!isAuditStage && (
            <p className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
              Actualmente el evento se encuentra en etapa "{stageLabel}". Solo podrás aprobar o rechazar inscripciones
              durante la etapa de auditoría{auditWindow ? ` (${auditWindow})` : ''}. Aprovecha este tiempo para revisar y
              comunicar ajustes a las instituciones.
            </p>
          )}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-sm">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por institución, invitación o auditoría"
                label="Buscar instituciones"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </Button>
            )}
          </div>
          {isAuditStage && (
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40 md:flex-row md:items-center md:justify-between">
              <p className="text-slate-700 dark:text-slate-200">
                {selectedCount
                  ? `${selectedCount} institución(es) listas para decisión grupal.`
                  : 'Selecciona las instituciones que deseas aprobar o rechazar en lote.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!selectedCount || savingBulkDecision}
                  onClick={() => handleOpenBulkDecision('aprobar')}
                >
                  {savingBulkDecision ? 'Procesando…' : 'Aprobar seleccionadas'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!selectedCount || savingBulkDecision}
                  onClick={() => handleOpenBulkDecision('rechazar')}
                  className="text-rose-600 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-slate-800/60"
                >
                  {savingBulkDecision ? 'Procesando…' : 'Rechazar seleccionadas'}
                </Button>
              </div>
            </div>
          )}
          <DataTable
            data={filteredInstitutions}
            columns={columns}
            emptyMessage={
              search.trim()
                ? 'No se encontraron instituciones que coincidan con la búsqueda.'
                : 'No hay instituciones invitadas para este evento.'
            }
            loading={loading}
            renderActions={renderRowActions}
            defaultPageSize={5}
            responsiveBreakpoint="lg"
          />
        </div>
      </Card>

      <Modal
        isOpen={detailModal.open}
        onClose={handleCloseDetail}
        title={`Inscripción de ${detailModal.institution?.institucion_nombre ?? 'institución'}`}
        description="Consulta los estudiantes inscritos y la documentación enviada por la institución."
        footer={
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!canEditDocuments && (
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Solo podrás guardar revisiones durante la etapa de inscripción o auditoría.
              </p>
            )}
            <div className="flex justify-end gap-2 sm:ml-auto">
              <Button variant="ghost" onClick={handleCloseDetail}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitDocumentReviews}
                disabled={
                  savingDocumentReviews || !documentReviews.size || !canEditDocuments
                }
              >
                {savingDocumentReviews ? 'Guardando…' : 'Guardar revisión'}
              </Button>
            </div>
          </div>
        }
        size="xl"
      >
        {detailModal.loading ? (
          <p className="text-sm text-slate-500">Cargando información de inscripción…</p>
        ) : detailModal.data ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Plazo de inscripción de la institución
                  </p>
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(
                      detailModal.data.fecha_inscripcion_extendida ?? detailModal.data.fecha_inscripcion_fin,
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    La fecha no puede superar el cierre de auditoría: {formatDate(auditEnd)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenExtension(detailModal.institution)}
                  disabled={!isAuditStage}
                  className="self-start md:self-center"
                >
                  Gestionar prórroga
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <SearchInput
                  value={studentSearch}
                  onChange={setStudentSearch}
                  placeholder="Buscar por nombre o cédula"
                  label="Buscar estudiantes"
                />
              </div>
              <div className="md:w-60">
                <Select
                  label="Filtrar por estado"
                  options={STUDENT_FILTER_OPTIONS}
                  value={studentFilter}
                  onChange={(value) => setStudentFilter(value ?? 'all')}
                  clearable={false}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
              <span>
                Estudiantes registrados: {' '}
                <span className="font-semibold text-primary-600 dark:text-primary-300">
                  {detailModal.data.estudiantes?.length ?? 0}
                </span>
              </span>
              <span>
                Mostrando{' '}
                <span className="font-semibold text-primary-600 dark:text-primary-300">
                  {filteredStudents.length}
                </span>{' '}
                {studentFilter === 'all' ? 'estudiantes.' : 'coincidencias con el filtro.'}
              </span>
            </div>
            {filteredStudents.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredStudents.map(({ student, status }) => {
                  const documents = Array.isArray(student.documentos) ? student.documentos : [];
                  const statusMeta = STUDENT_STATUS_META[status] ?? STUDENT_STATUS_META.pending;
                  const age = calculateAge(student.fecha_nacimiento);
                  const approvedCount = documents.filter((document) => resolveDocumentState(document) === 'aprobado').length;
                  const correctionCount = documents.filter((document) => resolveDocumentState(document) === 'correccion').length;
                  const pendingCount = documents.length - approvedCount - correctionCount;
                  const registeredLabel = student.creado_en
                    ? new Date(student.creado_en).toLocaleDateString('es-EC')
                    : null;
                  return (
                    <article
                      key={student.id}
                      className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {student.foto_url ? (
                            <img
                              src={resolveMediaUrl(student.foto_url)}
                              alt={`${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || 'Estudiante'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(student.nombres, student.apellidos)
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              {`${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || `ID ${student.id}`}
                            </h4>
                            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                              {student.documento_identidad
                                ? `Cédula: ${student.documento_identidad}`
                                : 'Cédula no registrada'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge color={student.activo === false ? 'neutral' : 'accent'}>
                              {student.activo === false ? 'Inactivo' : 'Activo'}
                            </Badge>
                            {student.genero ? <Badge variant="outline">{student.genero}</Badge> : null}
                            {age !== null ? <Badge variant="outline">{age} años</Badge> : null}
                            <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-300">
                            <span>
                              Documentos: {documents.length} · Aprobados: {approvedCount}
                            </span>
                            {correctionCount > 0 ? <span>Correcciones: {correctionCount}</span> : null}
                            {pendingCount > 0 ? <span>Pendientes: {pendingCount}</span> : null}
                            {registeredLabel ? <span>Registrado el {registeredLabel}</span> : null}
                          </div>
                        </div>
                      </div>
                      {documents.length ? (
                        <div className="space-y-3">
                          {documents.map((document) => {
                            const docId = Number(document?.id);
                            const storedReview = documentReviews.get(docId);
                            const currentState = resolveDocumentState(document);
                            const reviewState = {
                              estado: storedReview?.estado ?? currentState,
                              observaciones:
                                storedReview?.observaciones ?? (document?.observaciones_revision ?? ''),
                            };
                            const stateMeta =
                              DOCUMENT_REVIEW_STATUS_META[reviewState.estado] || DOCUMENT_REVIEW_STATUS_META.pendiente;
                            const documentUrl = document?.archivo_url
                              ? resolveMediaUrl(document.archivo_url)
                              : null;
                            return (
                              <div
                                key={document.id}
                                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1 text-sm text-slate-600 dark:text-slate-200">
                                    <p className="font-semibold text-slate-700 dark:text-slate-100">
                                      {document.tipo_documento ?? 'Documento'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-300">
                                      Actualizado: {formatDateTime(document.subido_en)}
                                    </p>
                                    {document?.revisado_en ? (
                                      <p className="text-xs text-slate-500 dark:text-slate-300">
                                        Última revisión: {formatDateTime(document.revisado_en)}
                                      </p>
                                    ) : null}
                                    {document?.revisado_por_nombre ? (
                                      <p className="text-xs text-slate-500 dark:text-slate-300">
                                        Revisado por: {document.revisado_por_nombre}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <Badge color={stateMeta.color}>{stateMeta.label}</Badge>
                                    {documentUrl ? (
                                      <a
                                        href={documentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-300"
                                      >
                                        Ver documento
                                      </a>
                                    ) : (
                                      <span className="text-xs text-slate-500 dark:text-slate-300">
                                        Archivo no disponible
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-200">
                                    <span>Estado de revisión</span>
                                    <select
                                      value={reviewState.estado}
                                      onChange={(event) =>
                                        handleDocumentReviewChange(docId, {
                                          estado: event.target.value,
                                        })
                                      }
                                      disabled={!canEditDocuments || savingDocumentReviews}
                                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                                    >
                                      <option value="pendiente">Pendiente</option>
                                      <option value="aprobado">Aprobado</option>
                                      <option value="correccion">Requiere corrección</option>
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-200 md:col-span-2">
                                    <span>Observaciones para la institución</span>
                                    <textarea
                                      rows={3}
                                      value={reviewState.observaciones}
                                      onChange={(event) =>
                                        handleDocumentReviewChange(docId, {
                                          observaciones: event.target.value,
                                        })
                                      }
                                      disabled={!canEditDocuments || savingDocumentReviews}
                                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                                      placeholder="Añade comentarios para la institución (opcional)"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                          La institución aún no cargó documentos para este estudiante.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : detailModal.data.estudiantes?.length ? (
              <p className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                No se encontraron estudiantes que coincidan con la búsqueda o el filtro aplicado.
              </p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">La institución aún no registra estudiantes.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No se encontró información de inscripción.</p>
        )}
      </Modal>

      <Modal
        isOpen={extensionModal.open}
        onClose={() => setExtensionModal({ open: false, institution: null, deadline: '' })}
        title="Prórroga de inscripción"
        description="Extiende el tiempo de inscripción de la institución durante la etapa de auditoría."
        confirmLabel="Guardar prórroga"
        confirmVariant="primary"
        confirmDisabled={savingExtension}
        confirmLoading={savingExtension}
        onConfirm={handleSaveExtension}
      >
        <div className="space-y-3 text-sm">
          <label className="space-y-2">
            <span className="font-semibold text-slate-600 dark:text-slate-200">Nueva fecha de cierre</span>
            <input
              type="date"
              value={extensionModal.deadline}
              onChange={(event) => setExtensionModal((prev) => ({ ...prev, deadline: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Si dejas el campo vacío, la institución usará el cierre general del evento. La fecha extendida no puede ser mayor que {formatDate(auditEnd)}.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={decisionModal.open}
        onClose={() => setDecisionModal({ open: false, institution: null, decision: null, motivo: '' })}
        title="Registrar decisión de auditoría"
        description="Confirma la acción que deseas aplicar para la institución seleccionada."
        confirmLabel="Confirmar"
        confirmVariant="primary"
        confirmDisabled={savingDecision || !isAuditStage}
        confirmLoading={savingDecision}
        onConfirm={handleSubmitDecision}
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
          <p>
            Acción seleccionada:{' '}
            <strong>
              {decisionModal.decision === 'aprobar'
                ? 'Aprobar participación'
                : decisionModal.decision === 'rechazar'
                ? 'Rechazar participación'
                : 'Solicitar corrección'}
            </strong>
          </p>
          {decisionModal.decision === 'rechazar' || decisionModal.decision === 'corregir' ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                Detalla el motivo (se enviará a la institución)
              </span>
              <textarea
                rows={4}
                value={decisionModal.motivo}
                onChange={(event) => setDecisionModal((prev) => ({ ...prev, motivo: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                placeholder="Incluye observaciones claras para la institución"
              />
            </label>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Al aprobar, la institución pasará a la etapa de campeonato cuando corresponda.
            </p>
          )}
          {!isAuditStage && (
            <p className="text-xs font-medium text-amber-600">
              Solo podrás confirmar decisiones durante la etapa de auditoría.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={bulkDecisionModal.open}
        onClose={() => setBulkDecisionModal({ open: false, decision: null, motivo: '' })}
        title="Aplicar decisión grupal"
        description="Confirma la acción que se aplicará a todas las instituciones seleccionadas."
        confirmLabel={savingBulkDecision ? 'Procesando…' : 'Aplicar decisión'}
        confirmVariant="primary"
        confirmDisabled={savingBulkDecision || !isAuditStage || !selectedCount}
        confirmLoading={savingBulkDecision}
        onConfirm={handleSubmitBulkDecision}
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
          <p>
            Instituciones seleccionadas:{' '}
            <strong>{selectedCount}</strong>
          </p>
          <p>
            Acción seleccionada:{' '}
            <strong>
              {bulkDecisionModal.decision === 'rechazar'
                ? 'Rechazar participación'
                : 'Aprobar participación'}
            </strong>
          </p>
          {bulkDecisionModal.decision === 'rechazar' ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                Detalla el motivo (se enviará a las instituciones)
              </span>
              <textarea
                rows={4}
                value={bulkDecisionModal.motivo}
                onChange={(event) => setBulkDecisionModal((prev) => ({ ...prev, motivo: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                placeholder="Incluye observaciones claras para la institución"
              />
            </label>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Todas las instituciones seleccionadas pasarán a la etapa siguiente del evento.
            </p>
          )}
          {!isAuditStage && (
            <p className="text-xs font-medium text-amber-600">
              Solo podrás confirmar decisiones durante la etapa de auditoría.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
};

