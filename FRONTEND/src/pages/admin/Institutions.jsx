import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  UserMinusIcon,
  ArrowUturnLeftIcon,
  ShieldExclamationIcon,
  UsersIcon,
  UserPlusIcon,
  NoSymbolIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { institutionService, studentService, userService, roleService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';
import { resolveMediaUrl } from '../../utils/media.js';

const INSTITUTION_STATUS_LABELS = {
  activa: 'Activa',
  inactiva: 'Inactiva',
  desafiliada: 'Desafiliada',
  sancionada: 'Sancionada',
};

const INSTITUTION_STATUS_CLASSES = {
  activa: '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-500/20 dark:!text-emerald-100',
  inactiva: '!bg-slate-200 !text-slate-700 dark:!bg-slate-700/60 dark:!text-slate-200',
  desafiliada: '!bg-amber-100 !text-amber-700 dark:!bg-amber-500/20 dark:!text-amber-100',
  sancionada: '!bg-rose-100 !text-rose-700 dark:!bg-rose-500/20 dark:!text-rose-100',
};

const ELIMINATED_BADGE_CLASS = '!bg-red-100 !text-red-700 dark:!bg-red-500/20 dark:!text-red-100';

const institutionSchema = z.object({
  nombre: z.string().min(1, 'Ingresa el nombre de la institución'),
  descripcion: z
    .string()
    .max(400, 'La descripción es demasiado extensa')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  direccion: z
    .string()
    .max(200, 'La dirección es demasiado extensa')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  ciudad: z
    .string()
    .max(80, 'La ciudad es demasiado extensa')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  email: z
    .string()
    .email('Ingresa un correo válido')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  telefono: z
    .string()
    .max(40, 'El teléfono es demasiado largo')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  estado: z.enum(['activa', 'inactiva', 'sancionada', 'desafiliada']).default('activa'),
});

const institutionStatusOptions = [
  { value: 'activa', label: 'Activa' },
  { value: 'inactiva', label: 'Inactiva' },
  { value: 'desafiliada', label: 'Desafiliada' },
  { value: 'sancionada', label: 'Sancionada' },
];

export const Institutions = () => {
  const institutionsEndpoint = '/institutions/?page_size=100&include_deleted=1';
  const {
    data: institutionsData = [],
    loading,
    refetch,
  } = useFetchWithAuth(institutionsEndpoint);
  const institutions = useMemo(
    () => (Array.isArray(institutionsData) ? institutionsData : []),
    [institutionsData],
  );
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [institutionToDelete, setInstitutionToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [removeCover, setRemoveCover] = useState(false);
  const [detailInstitution, setDetailInstitution] = useState(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [isDisaffiliateOpen, setDisaffiliateOpen] = useState(false);
  const [disaffiliationReason, setDisaffiliationReason] = useState('');
  const [institutionToDisaffiliate, setInstitutionToDisaffiliate] = useState(null);
  const [isReaffiliateOpen, setReaffiliateOpen] = useState(false);
  const [reaffiliateNote, setReaffiliateNote] = useState('');
  const [institutionToReaffiliate, setInstitutionToReaffiliate] = useState(null);
  const [isSanctionOpen, setSanctionOpen] = useState(false);
  const [institutionToSanction, setInstitutionToSanction] = useState(null);
  const [sanctionForm, setSanctionForm] = useState({ motivo: '', tipo: '', fecha_inicio: '', fecha_fin: '' });
  const [isProcessingAction, setProcessingAction] = useState(false);
  const [activeInstitution, setActiveInstitution] = useState(null);
  const [isStudentManagerOpen, setStudentManagerOpen] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableStudentsLoading, setAvailableStudentsLoading] = useState(false);
  const [selectedExistingStudent, setSelectedExistingStudent] = useState(null);
  const [assigningExistingStudent, setAssigningExistingStudent] = useState(false);
  const [studentFormMode, setStudentFormMode] = useState('create');
  const [studentForm, setStudentForm] = useState({
    nombres: '',
    apellidos: '',
    documento_identidad: '',
    fecha_nacimiento: '',
    genero: '',
    institucion_id: null,
    activo: true,
  });
  const [studentPhotoFile, setStudentPhotoFile] = useState(null);
  const [studentPhotoPreview, setStudentPhotoPreview] = useState('');
  const [studentRemovePhoto, setStudentRemovePhoto] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentManagerTab, setStudentManagerTab] = useState('list');
  const [isRepresentativeManagerOpen, setRepresentativeManagerOpen] = useState(false);
  const [representativesLoading, setRepresentativesLoading] = useState(false);
  const [representatives, setRepresentatives] = useState([]);
  const [availableRepresentatives,  setAvailableRepresentatives] = useState([]);
  const [availableRepresentativesLoading, setAvailableRepresentativesLoading] = useState(false);
  const [selectedExistingRepresentative, setSelectedExistingRepresentative] = useState(null);
  const [assigningExistingRepresentative, setAssigningExistingRepresentative] = useState(false);
  const [representativeFormMode, setRepresentativeFormMode] = useState('create');
  const [representativeForm, setRepresentativeForm] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    password: '',
    activo: true,
    institucion_id: null,
  });
  const [editingRepresentative, setEditingRepresentative] = useState(null);
  const [representativeSaving, setRepresentativeSaving] = useState(false);
  const [representativeRoleId, setRepresentativeRoleId] = useState(null);
  const [representativeManagerTab, setRepresentativeManagerTab] = useState('list');
  const [detailTab, setDetailTab] = useState('info');
  const [detailStudents, setDetailStudents] = useState([]);
  const [detailStudentsLoading, setDetailStudentsLoading] = useState(false);
  const [detailStudentIndex, setDetailStudentIndex] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      direccion: '',
      ciudad: '',
      email: '',
      telefono: '',
      estado: 'activa',
    },
  });

  const tabContainerClasses =
    'flex gap-2 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/60';
  const tabBaseClasses =
    'flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';
  const tabActiveClasses = 'bg-primary-500 text-white shadow-lg shadow-primary-500/30';
  const tabInactiveClasses =
    'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800/60';
  const carouselButtonClasses =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40';

  const closeModal = () => {
    setModalOpen(false);
    setSelectedInstitution(null);
    reset({
      nombre: '',
      descripcion: '',
      direccion: '',
      ciudad: '',
      email: '',
      telefono: '',
      estado: 'activa',
    });
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
  };

  const openCreateModal = () => {
    setModalMode('create');
    reset({
      nombre: '',
      descripcion: '',
      direccion: '',
      ciudad: '',
      email: '',
      telefono: '',
      estado: 'activa',
    });
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
    setModalOpen(true);
  };

  const openEditModal = (institution) => {
    setModalMode('edit');
    setSelectedInstitution(institution);
    reset({
      nombre: institution.nombre,
      descripcion: institution.descripcion ?? '',
      direccion: institution.direccion ?? '',
      ciudad: institution.ciudad ?? '',
      email: institution.email ?? '',
      telefono: institution.telefono ?? '',
      estado: institution.estado ?? 'activa',
    });
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview(resolveMediaUrl(institution.portada_url));
    setRemoveCover(false);
    setModalOpen(true);
  };

  const openDeleteModal = (institution) => {
    setInstitutionToDelete(institution);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setInstitutionToDelete(null);
    setDeleteOpen(false);
  };

  const openDetailModal = (institution) => {
    setDetailInstitution(institution);
    setDetailTab('info');
    setDetailStudents([]);
    setDetailStudentIndex(0);
    setDetailOpen(true);
  };

  const closeDetailModal = () => {
    setDetailInstitution(null);
    setDetailOpen(false);
    setDetailTab('info');
    setDetailStudents([]);
    setDetailStudentIndex(0);
    setDetailStudentsLoading(false);
  };

  const openDisaffiliateModal = (institution) => {
    setInstitutionToDisaffiliate(institution);
    setDisaffiliationReason('');
    setDisaffiliateOpen(true);
  };

  const closeDisaffiliateModal = () => {
    setInstitutionToDisaffiliate(null);
    setDisaffiliationReason('');
    setDisaffiliateOpen(false);
  };

  const openReaffiliateModal = (institution) => {
    setInstitutionToReaffiliate(institution);
    setReaffiliateNote('');
    setReaffiliateOpen(true);
  };

  const closeReaffiliateModal = () => {
    setInstitutionToReaffiliate(null);
    setReaffiliateNote('');
    setReaffiliateOpen(false);
  };

  const openSanctionModal = (institution) => {
    setInstitutionToSanction(institution);
    setSanctionForm({ motivo: '', tipo: '', fecha_inicio: '', fecha_fin: '' });
    setSanctionOpen(true);
  };

  const closeSanctionModal = () => {
    setInstitutionToSanction(null);
    setSanctionForm({ motivo: '', tipo: '', fecha_inicio: '', fecha_fin: '' });
    setSanctionOpen(false);
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

  const handleDisaffiliate = async () => {
    if (!institutionToDisaffiliate || !disaffiliationReason.trim()) {
      addToast({ title: 'Motivo requerido', description: 'Describe el motivo de desafiliación.', status: 'warning' });
      return;
    }
    setProcessingAction(true);
    try {
      await institutionService.disaffiliate(institutionToDisaffiliate.id, { motivo: disaffiliationReason.trim() });
      addToast({ title: 'Institución desafiliada', status: 'success' });
      closeDisaffiliateModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo desafiliar', description: error.message, status: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReaffiliate = async () => {
    if (!institutionToReaffiliate) return;
    setProcessingAction(true);
    try {
      await institutionService.reaffiliate(institutionToReaffiliate.id, reaffiliateNote ? { observaciones: reaffiliateNote } : {});
      addToast({ title: 'Institución reafiliada', status: 'success' });
      closeReaffiliateModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo reafiliar', description: error.message, status: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSanction = async () => {
    if (!institutionToSanction || !sanctionForm.motivo.trim() || !sanctionForm.tipo.trim()) {
      addToast({ title: 'Datos incompletos', description: 'Indica motivo y tipo de sanción.', status: 'warning' });
      return;
    }
    setProcessingAction(true);
    try {
      const payload = {
        motivo: sanctionForm.motivo.trim(),
        tipo: sanctionForm.tipo.trim(),
        fecha_inicio: sanctionForm.fecha_inicio ? new Date(sanctionForm.fecha_inicio).toISOString() : undefined,
        fecha_fin: sanctionForm.fecha_fin ? new Date(sanctionForm.fecha_fin).toISOString() : undefined,
      };
      await institutionService.sanction(institutionToSanction.id, payload);
      addToast({ title: 'Sanción aplicada', status: 'success' });
      closeSanctionModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo aplicar la sanción', description: error.message, status: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleLiftSanction = async (institution) => {
    setProcessingAction(true);
    try {
      await institutionService.liftSanction(institution.id, {});
      addToast({ title: 'Sanción levantada', status: 'success' });
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo levantar la sanción', description: error.message, status: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    const submission = new FormData();
    submission.append('nombre', formData.nombre.trim());
    if (formData.descripcion?.trim()) submission.append('descripcion', formData.descripcion.trim());
    if (formData.direccion?.trim()) submission.append('direccion', formData.direccion.trim());
    if (formData.ciudad?.trim()) submission.append('ciudad', formData.ciudad.trim());
    if (formData.email?.trim()) submission.append('email', formData.email.trim());
    if (formData.telefono?.trim()) submission.append('telefono', formData.telefono.trim());
    submission.append('estado', formData.estado ?? 'activa');
    if (coverFile) {
      submission.append('portada', coverFile);
    } else if (modalMode === 'edit' && removeCover) {
      submission.append('remove_portada', 'true');
    }

    try {
      if (modalMode === 'edit' && selectedInstitution) {
        await institutionService.update(selectedInstitution.id, submission);
        addToast({ title: 'Institución actualizada', status: 'success' });
      } else {
        await institutionService.create(submission);
        addToast({ title: 'Institución creada', status: 'success' });
      }
      closeModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo guardar la institución', description: error.message, status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!institutionToDelete) return;
    setIsDeleting(true);
    try {
      if (institutionToDelete.eliminado) {
        await institutionService.forceRemove(institutionToDelete.id);
        addToast({ title: 'Institución eliminada permanentemente', status: 'success' });
      } else {
        await institutionService.remove(institutionToDelete.id);
        addToast({ title: 'Institución eliminada', status: 'success' });
      }
      closeDeleteModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo eliminar la institución', description: error.message, status: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (institution) => {
    setProcessingAction(true);
    try {
      await institutionService.restore(institution.id);
      addToast({ title: 'Institución restaurada', status: 'success' });
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo restaurar la institución', description: error.message, status: 'error' });
    } finally {
      setProcessingAction(false);
    }
  };

  const resetStudentForm = useCallback(
    (institution) => {
      setStudentForm({
        nombres: '',
        apellidos: '',
        documento_identidad: '',
        fecha_nacimiento: '',
        genero: '',
        institucion_id: institution?.id ?? null,
        activo: true,
      });
      setStudentFormMode('create');
      setEditingStudent(null);
      setStudentPhotoFile(null);
      if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
      setStudentPhotoPreview('');
      setStudentRemovePhoto(false);
    },
    [studentPhotoPreview],
  );

  const fetchStudentsForInstitution = useCallback(
    async (institutionId) => {
      setStudentsLoading(true);
      try {
        const list = await studentService.list({ page_size: 100, institucion_id: institutionId });
        setStudents(Array.isArray(list) ? list : []);
      } catch (error) {
        addToast({ title: 'No se pudieron cargar los estudiantes', description: error.message, status: 'error' });
      } finally {
        setStudentsLoading(false);
      }
    },
    [addToast],
  );

  const fetchAvailableStudents = useCallback(async () => {
    setAvailableStudentsLoading(true);
    try {
      const list = await studentService.list({ page_size: 100, unassigned_only: true });
      setAvailableStudents(Array.isArray(list) ? list : []);
    } catch (error) {
      addToast({
        title: 'No se pudieron cargar los estudiantes disponibles',
        description: error.message,
        status: 'error',
      });
    } finally {
      setAvailableStudentsLoading(false);
    }
  }, [addToast]);

  const closeStudentManager = useCallback(() => {
    setStudentManagerOpen(false);
    setActiveInstitution(null);
    setStudents([]);
    setAvailableStudents([]);
    setSelectedExistingStudent(null);
    resetStudentForm(null);
    setStudentManagerTab('list');
  }, [resetStudentForm]);

  const openStudentManager = useCallback(
    (institution) => {
      setActiveInstitution(institution);
      resetStudentForm(institution);
      setStudentManagerTab('list');
      setStudentManagerOpen(true);
      fetchStudentsForInstitution(institution.id);
      fetchAvailableStudents();
    },
    [fetchAvailableStudents, fetchStudentsForInstitution, resetStudentForm],
  );

  const handleStudentFormChange = (field, value) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStudentPhotoSelect = (file) => {
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    if (file) {
      setStudentPhotoFile(file);
      setStudentPhotoPreview(URL.createObjectURL(file));
      setStudentRemovePhoto(false);
    } else {
      setStudentPhotoFile(null);
      setStudentPhotoPreview('');
    }
  };

  const handleStudentPhotoRemove = () => {
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    setStudentPhotoFile(null);
    setStudentPhotoPreview('');
    setStudentRemovePhoto(true);
  };

  const handleStudentSubmit = async () => {
    if (!activeInstitution) return;
    const nombres = studentForm.nombres.trim();
    const apellidos = studentForm.apellidos.trim();
    const fechaNacimiento = studentForm.fecha_nacimiento || null;
    if (!nombres || !apellidos || !fechaNacimiento) {
      addToast({ title: 'Datos incompletos', description: 'Completa nombres, apellidos y fecha de nacimiento.', status: 'warning' });
      return;
    }
    setStudentSaving(true);
    try {
      const submission = new FormData();
      submission.append('nombres', nombres);
      submission.append('apellidos', apellidos);
      submission.append('fecha_nacimiento', fechaNacimiento);
      const documento = studentForm.documento_identidad?.trim();
      if (documento) {
        submission.append('documento_identidad', documento);
      }
      const genero = studentForm.genero?.trim();
      if (genero) {
        submission.append('genero', genero);
      }
      const institucionDestino = studentForm.institucion_id ?? activeInstitution.id;
      if (institucionDestino) {
        submission.append('institucion_id', String(institucionDestino));
      }
      submission.append('activo', studentForm.activo ? 'true' : 'false');

      if (studentPhotoFile) {
        submission.append('foto', studentPhotoFile);
      } else if (studentFormMode === 'edit' && studentRemovePhoto) {
        submission.append('remove_foto', 'true');
      }

      if (studentFormMode === 'edit' && editingStudent) {
        await studentService.update(editingStudent.id, submission);
        addToast({ title: 'Estudiante actualizado', status: 'success' });
      } else {
        await studentService.create(submission);
        addToast({ title: 'Estudiante agregado', status: 'success' });
      }
      resetStudentForm(activeInstitution);
      setStudentManagerTab('list');
      await fetchStudentsForInstitution(activeInstitution.id);
      await fetchAvailableStudents();
    } catch (error) {
      addToast({ title: 'No se pudo guardar el estudiante', description: error.message, status: 'error' });
    } finally {
      setStudentSaving(false);
    }
  };

  const handleAssignExistingStudent = async () => {
    if (!activeInstitution || !selectedExistingStudent) {
      return;
    }
    setAssigningExistingStudent(true);
    try {
      await studentService.update(Number(selectedExistingStudent), {
        institucion_id: activeInstitution.id,
      });
      addToast({ title: 'Estudiante asignado', status: 'success' });
      setSelectedExistingStudent(null);
      await fetchStudentsForInstitution(activeInstitution.id);
      await fetchAvailableStudents();
    } catch (error) {
      addToast({ title: 'No se pudo asignar al estudiante', description: error.message, status: 'error' });
    } finally {
      setAssigningExistingStudent(false);
    }
  };

  const startEditStudent = (student) => {
    setStudentForm({
      nombres: student.nombres ?? '',
      apellidos: student.apellidos ?? '',
      documento_identidad: student.documento_identidad ?? '',
      fecha_nacimiento: student.fecha_nacimiento ? student.fecha_nacimiento.slice(0, 10) : '',
      genero: student.genero ?? '',
      institucion_id: student.institucion_id ?? activeInstitution?.id ?? null,
      activo: student.activo ?? true,
    });
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    setStudentPhotoFile(null);
    setStudentPhotoPreview(student.foto_url ? resolveMediaUrl(student.foto_url) : '');
    setStudentRemovePhoto(false);
    setEditingStudent(student);
    setStudentFormMode('edit');
    setStudentManagerTab('form');
  };

  const handleDetachStudent = async (student) => {
    setStudentsLoading(true);
    try {
      await studentService.update(student.id, { institucion_id: null });
      addToast({ title: 'Estudiante desvinculado', status: 'success' });
      await fetchStudentsForInstitution(activeInstitution?.id ?? student.institucion_id);
      await fetchAvailableStudents();
    } catch (error) {
      addToast({ title: 'No se pudo desvincular', description: error.message, status: 'error' });
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleRemoveStudent = async (student) => {
    setStudentsLoading(true);
    try {
      await studentService.remove(student.id);
      addToast({ title: 'Estudiante eliminado', status: 'success' });
      await fetchStudentsForInstitution(activeInstitution?.id ?? student.institucion_id);
      await fetchAvailableStudents();
    } catch (error) {
      addToast({ title: 'No se pudo eliminar', description: error.message, status: 'error' });
    } finally {
      setStudentsLoading(false);
    }
  };

  const resetRepresentativeForm = useCallback((institution) => {
    setRepresentativeForm({
      nombre_completo: '',
      email: '',
      telefono: '',
      password: '',
      activo: true,
      institucion_id: institution?.id ?? null,
    });
    setRepresentativeFormMode('create');
    setEditingRepresentative(null);
  }, []);

  const fetchRepresentativeRoleId = useCallback(async () => {
    if (representativeRoleId) {
      return representativeRoleId;
    }
    try {
      const roles = await roleService.list();
      const representativeRole = roles.find(
        (role) => role.nombre?.trim().toLowerCase() === 'representante educativo',
      );
      if (!representativeRole) {
        throw new Error('No se encontró el rol de representante educativo');
      }
      setRepresentativeRoleId(representativeRole.id);
      return representativeRole.id;
    } catch (error) {
      addToast({ title: 'No se pudo cargar el rol de representante', description: error.message, status: 'error' });
      throw error;
    }
  }, [addToast, representativeRoleId]);

  const fetchRepresentativesForInstitution = useCallback(
    async (institutionId) => {
      setRepresentativesLoading(true);
      try {
        const list = await userService.list({
          page_size: 100,
          roles: 'Representante educativo',
          institucion_id: institutionId,
          include_deleted: true,
        });
        setRepresentatives(Array.isArray(list) ? list : []);
      } catch (error) {
        addToast({ title: 'No se pudieron cargar los representantes', description: error.message, status: 'error' });
      } finally {
        setRepresentativesLoading(false);
      }
    },
    [addToast],
  );

  const fetchAvailableRepresentatives = useCallback(async () => {
    setAvailableRepresentativesLoading(true);
    try {
      const list = await userService.list({
        page_size: 100,
        roles: 'Representante educativo',
        unassigned_only: true,
        include_deleted: false,
      });
      setAvailableRepresentatives(Array.isArray(list) ? list : []);
    } catch (error) {
      addToast({
        title: 'No se pudieron cargar los representantes disponibles',
        description: error.message,
        status: 'error',
      });
    } finally {
      setAvailableRepresentativesLoading(false);
    }
  }, [addToast]);

  const closeRepresentativeManager = useCallback(() => {
    setRepresentativeManagerOpen(false);
    setRepresentatives([]);
    setAvailableRepresentatives([]);
    setSelectedExistingRepresentative(null);
    setActiveInstitution(null);
    resetRepresentativeForm(null);
    setRepresentativeManagerTab('list');
  }, [resetRepresentativeForm]);

  const openRepresentativeManager = useCallback(
    async (institution) => {
      try {
        const roleId = await fetchRepresentativeRoleId();
        if (!roleId) return;
        setActiveInstitution(institution);
        resetRepresentativeForm(institution);
        setRepresentativeManagerTab('list');
        setRepresentativeManagerOpen(true);
        await fetchRepresentativesForInstitution(institution.id);
        fetchAvailableRepresentatives();
      } catch (error) {
        // El toast ya se mostró en fetchRepresentativeRoleId
      }
    },
    [
      fetchAvailableRepresentatives,
      fetchRepresentativeRoleId,
      fetchRepresentativesForInstitution,
      resetRepresentativeForm,
    ],
  );

  const handleRepresentativeFormChange = (field, value) => {
    setRepresentativeForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRepresentativeSubmit = async () => {
    if (!activeInstitution) return;
    const roleId = await fetchRepresentativeRoleId();
    if (!roleId) return;
    const payloadBase = {
      nombre_completo: representativeForm.nombre_completo.trim(),
      email: representativeForm.email.trim(),
      telefono: representativeForm.telefono?.trim() || null,
      institucion_id: representativeForm.institucion_id ?? activeInstitution.id,
      activo: representativeForm.activo,
    };
    if (!payloadBase.nombre_completo || !payloadBase.email) {
      addToast({ title: 'Datos incompletos', description: 'Ingresa nombre y correo electrónico.', status: 'warning' });
      return;
    }
    setRepresentativeSaving(true);
    try {
      if (representativeFormMode === 'edit' && editingRepresentative) {
        const updatePayload = {
          ...payloadBase,
          rol_id: roleId,
        };
        if (representativeForm.password.trim()) {
          updatePayload.password = representativeForm.password.trim();
        }
        await userService.update(editingRepresentative.id, updatePayload);
        addToast({ title: 'Representante actualizado', status: 'success' });
      } else {
        const createPayload = {
          ...payloadBase,
          password: representativeForm.password.trim(),
          rol_id: roleId,
          send_welcome: false,
        };
        if (!createPayload.password) {
          addToast({ title: 'Contraseña requerida', description: 'Define una contraseña temporal para el nuevo usuario.', status: 'warning' });
          setRepresentativeSaving(false);
          return;
        }
        await userService.create(createPayload);
        addToast({ title: 'Representante creado', status: 'success' });
      }
      resetRepresentativeForm(activeInstitution);
      setRepresentativeManagerTab('list');
      await fetchRepresentativesForInstitution(activeInstitution.id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo guardar el representante', description: error.message, status: 'error' });
    } finally {
      setRepresentativeSaving(false);
    }
  };

  const handleAssignExistingRepresentative = async () => {
    if (!activeInstitution || !selectedExistingRepresentative) {
      return;
    }
    setAssigningExistingRepresentative(true);
    try {
      await userService.update(Number(selectedExistingRepresentative), {
        institucion_id: activeInstitution.id,
      });
      addToast({ title: 'Representante asignado', status: 'success' });
      setSelectedExistingRepresentative(null);
      await fetchRepresentativesForInstitution(activeInstitution.id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo asignar al representante', description: error.message, status: 'error' });
    } finally {
      setAssigningExistingRepresentative(false);
    }
  };

  const startEditRepresentative = (representative) => {
    setRepresentativeForm({
      nombre_completo: representative.nombre_completo ?? '',
      email: representative.email ?? '',
      telefono: representative.telefono ?? '',
      password: '',
      activo: representative.activo ?? true,
      institucion_id: representative.institucion_id ?? activeInstitution?.id ?? null,
    });
    setRepresentativeFormMode('edit');
    setEditingRepresentative(representative);
    setRepresentativeManagerTab('form');
  };

  const handleRepresentativeDetach = async (representative) => {
    setRepresentativesLoading(true);
    try {
      await userService.update(representative.id, { institucion_id: null });
      addToast({ title: 'Representante desvinculado', status: 'success' });
      await fetchRepresentativesForInstitution(activeInstitution?.id ?? representative.institucion_id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo desvincular', description: error.message, status: 'error' });
    } finally {
      setRepresentativesLoading(false);
    }
  };

  const handleRepresentativeRemove = async (representative) => {
    setRepresentativesLoading(true);
    try {
      await userService.remove(representative.id);
      addToast({ title: 'Representante eliminado', status: 'success' });
      await fetchRepresentativesForInstitution(activeInstitution?.id ?? representative.institucion_id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo eliminar', description: error.message, status: 'error' });
    } finally {
      setRepresentativesLoading(false);
    }
  };

  const handleRepresentativeRestore = async (representative) => {
    setRepresentativesLoading(true);
    try {
      await userService.restore(representative.id);
      addToast({ title: 'Representante restaurado', status: 'success' });
      await fetchRepresentativesForInstitution(activeInstitution?.id ?? representative.institucion_id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo restaurar', description: error.message, status: 'error' });
    } finally {
      setRepresentativesLoading(false);
    }
  };

  const handleRepresentativeForceRemove = async (representative) => {
    setRepresentativesLoading(true);
    try {
      await userService.forceRemove(representative.id);
      addToast({ title: 'Representante eliminado permanentemente', status: 'success' });
      await fetchRepresentativesForInstitution(activeInstitution?.id ?? representative.institucion_id);
      await fetchAvailableRepresentatives();
    } catch (error) {
      addToast({ title: 'No se pudo eliminar permanentemente', description: error.message, status: 'error' });
    } finally {
      setRepresentativesLoading(false);
    }
  };

  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return institutions;
    return institutions.filter((inst) =>
      inst.nombre.toLowerCase().includes(query) || (inst.ciudad ?? '').toLowerCase().includes(query),
    );
  }, [institutions, search]);

  const institutionOptions = useMemo(
    () =>
      institutions.map((institution) => ({
        value: institution.id,
        label: institution.nombre,
        disabled: Boolean(institution.eliminado),
      })),
    [institutions],
  );

  const genderOptions = useMemo(
    () => [
      { value: 'F', label: 'Femenino' },
      { value: 'M', label: 'Masculino' },
      { value: 'Otro', label: 'Otro' },
    ],
    [],
  );

  const getGenderLabel = (value) => {
    if (!value) return 'Sin definir';
    const match = genderOptions.find((option) => option.value === value);
    return match ? match.label : value;
  };

  const availableStudentOptions = useMemo(
    () =>
      availableStudents.map((student) => ({
        value: String(student.id),
        label: `${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || `ID ${student.id}`,
        description: student.documento_identidad ? `Documento: ${student.documento_identidad}` : undefined,
      })),
    [availableStudents],
  );

  const availableRepresentativeOptions = useMemo(
    () =>
      availableRepresentatives.map((user) => ({
        value: String(user.id),
        label: user.nombre_completo ?? user.email ?? `ID ${user.id}`,
        description: user.email ?? undefined,
      })),
    [availableRepresentatives],
  );

  useEffect(() => {
    return () => {
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  useEffect(() => {
    return () => {
      if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
    };
  }, [studentPhotoPreview]);

  useEffect(() => {
    if (!isDetailOpen || !detailInstitution?.id) {
      return undefined;
    }
    let isMounted = true;
    setDetailStudentsLoading(true);
    studentService
      .list({ page_size: 100, institucion_id: detailInstitution.id })
      .then((list) => {
        if (!isMounted) return;
        const normalized = Array.isArray(list) ? list : [];
        setDetailStudents(normalized);
        setDetailStudentIndex(0);
      })
      .catch((error) => {
        if (!isMounted) return;
        setDetailStudents([]);
        addToast({
          title: 'No se pudieron cargar los estudiantes',
          description: error.message,
          status: 'error',
        });
      })
      .finally(() => {
        if (isMounted) {
          setDetailStudentsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [addToast, detailInstitution?.id, isDetailOpen]);

  const goToPreviousDetailStudent = () => {
    setDetailStudentIndex((prev) => {
      if (!detailStudents.length) return 0;
      return prev === 0 ? detailStudents.length - 1 : prev - 1;
    });
  };

  const goToNextDetailStudent = () => {
    setDetailStudentIndex((prev) => {
      if (!detailStudents.length) return 0;
      return prev === detailStudents.length - 1 ? 0 : prev + 1;
    });
  };

  const currentDetailStudent = detailStudents[detailStudentIndex] ?? null;
  const detailStudentCount = detailStudents.length;
  const hasDetailStudents = detailStudentCount > 0;
  const currentStudentName =
    hasDetailStudents && currentDetailStudent
      ? `${currentDetailStudent.nombres ?? ''} ${currentDetailStudent.apellidos ?? ''}`.trim() || 'Sin nombre'
      : 'Sin estudiantes';
  const currentStudentPhoto =
    hasDetailStudents && currentDetailStudent?.foto_url
      ? resolveMediaUrl(currentDetailStudent.foto_url)
      : 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=800&q=80';
  const currentStudentDocument =
    hasDetailStudents && currentDetailStudent?.documento_identidad
      ? currentDetailStudent.documento_identidad
      : '—';
  const currentStudentBirth =
    hasDetailStudents && currentDetailStudent?.fecha_nacimiento
      ? new Date(currentDetailStudent.fecha_nacimiento).toLocaleDateString()
      : '—';
  const currentStudentGenderLabel =
    hasDetailStudents && currentDetailStudent?.genero
      ? getGenderLabel(currentDetailStudent.genero)
      : null;
  const currentStudentStatusLabel =
    hasDetailStudents && currentDetailStudent?.activo ? 'Activo' : 'Inactivo';
  const currentStudentStatusClass =
    hasDetailStudents && currentDetailStudent?.activo
      ? 'bg-emerald-300/30 text-white'
      : 'bg-rose-300/30 text-white';

  const actionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary-500 shadow-lg shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 dark:bg-slate-800 dark:text-primary-200';
  const dangerActionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-lg shadow-red-400/20 transition hover:-translate-y-0.5 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:bg-slate-800 dark:text-red-400';
  const warningActionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-amber-500 shadow-lg shadow-amber-400/20 transition hover:-translate-y-0.5 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 dark:bg-slate-800 dark:text-amber-300';

  const renderStatusBadge = (input) => {
    console.log(input)
    if (input && typeof input === 'object') {
      if (input.eliminado) {
        return (
          <Badge color="neutral" className={ELIMINATED_BADGE_CLASS}>
            ELIMINADA
          </Badge>
        );
      }
      if (input.sancion_activa) {
        return (
          <Badge color="neutral" className={INSTITUTION_STATUS_CLASSES.sancionada}>
            {INSTITUTION_STATUS_LABELS.sancionada.toUpperCase()}
          </Badge>
        );
      }
      return renderStatusBadge(input.estado);
    }

    if (!input) {
      return <Badge color="neutral">—</Badge>;
    }

    const normalized = String(input).toLowerCase();
    const label = INSTITUTION_STATUS_LABELS[normalized] ?? String(input);
    const className = INSTITUTION_STATUS_CLASSES[normalized];
    if (!className) {
      return <Badge color="neutral">{label.toUpperCase()}</Badge>;
    }
    const color = normalized === 'activa' ? 'accent' : 'neutral';
    return (
      <Badge color={color} className={className}>
        {label.toUpperCase()}
      </Badge>
    );
  };

  console.log(filteredInstitutions)

  return (

    <>
    <Card>
      <CardHeader
        title="Instituciones"
        description="Controla los colegios y academias asociadas."
        actions={
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
            <Button variant="gradient" size="sm" onClick={openCreateModal}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Nueva institución
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sky-500 hover:bg-sky-100/60"
              onClick={() => refetch()}
              disabled={loading}
            >
              <ArrowPathIcon className="h-4 w-4" aria-hidden />
              Refrescar
            </Button>
          </div>
        }
      />
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o ciudad" />
      </div>
      <DataTable
        columns={[
          {
            Header: 'Portada',
            accessor: 'portada_url',
            Cell: ({ value, row }) => (
              <div className="flex items-center gap-3">
                {value ? (
                  <img
                    src={resolveMediaUrl(value)}
                    alt={row.nombre}
                    className="h-12 w-16 rounded-2xl object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-12 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-200 to-rose-200 text-sm font-semibold text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">
                    {(row.nombre ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ),
          },
          { Header: 'Nombre', accessor: 'nombre' },
          { Header: 'Ciudad', accessor: 'ciudad', Cell: ({ value }) => value || '—' },
          { Header: 'Correo', accessor: 'email', Cell: ({ value }) => value || '—' },
          { Header: 'Teléfono', accessor: 'telefono', Cell: ({ value }) => value || '—' },
          {
            Header: 'Estado',
            accessor: 'estado',
            Cell: ({ value }) => renderStatusBadge(value),
          },
        ]}
        data={filteredInstitutions}
        emptyMessage={'Aún no hay instituciones registradas'}
        loading={loading}
        renderActions={(institution) => {
          const isDeleted = Boolean(institution.eliminado);
          return (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={`${actionButtonClass} text-sky-500`}
                onClick={() => openDetailModal(institution)}
                title="Ver detalle"
              >
                <EyeIcon className="h-5 w-5" aria-hidden />
              </button>
              {!isDeleted ? (
                <>
                  <button
                    type="button"
                    className={` ${actionButtonClass} text-green-500 `}
                    onClick={() => openEditModal(institution)}
                    title="Editar"
                  >
                    <PencilSquareIcon className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={` ${actionButtonClass} text-orange-500 `}
                    onClick={() => openStudentManager(institution)}
                    title="Gestionar estudiantes"
                  >
                    <UsersIcon className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={` ${actionButtonClass} text-fuchsia-800 `}
                    onClick={() => openRepresentativeManager(institution)}
                    title="Gestionar representantes"
                  >
                    <UserPlusIcon className="h-5 w-5" aria-hidden />
                  </button>
                  {institution.estado !== 'desafiliada' && (
                    <button
                      type="button"
                      className={warningActionButtonClass}
                      onClick={() => openDisaffiliateModal(institution)}
                      title="Desafiliar"
                    >
                      <UserMinusIcon className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                  {institution.estado === 'desafiliada' && (
                    <button
                      type="button"
                      className={actionButtonClass}
                      onClick={() => openReaffiliateModal(institution)}
                      title="Reafiliar"
                    >
                      <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className={warningActionButtonClass}
                    onClick={() => openSanctionModal(institution)}
                    title="Gestionar sanción"
                  >
                    <ShieldExclamationIcon className="h-5 w-5" aria-hidden />
                  </button>
                  {institution.sancion_activa && (
                    <button
                      type="button"
                      className={`${actionButtonClass} text-slate-500`}
                      onClick={() => handleLiftSanction(institution)}
                      title="Levantar sanción"
                      disabled={isProcessingAction}
                    >
                      <ArrowPathIcon className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className={dangerActionButtonClass}
                    onClick={() => openDeleteModal(institution)}
                    title="Eliminar"
                  >
                    <TrashIcon className="h-5 w-5" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${actionButtonClass} text-slate-500`}
                    onClick={() => handleRestore(institution)}
                    title="Restaurar institución"
                    disabled={isProcessingAction}
                  >
                    <ArrowPathIcon className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${dangerActionButtonClass} text-red-600`}
                    onClick={() => openDeleteModal(institution)}
                    title="Eliminar permanentemente"
                  >
                    <NoSymbolIcon className="h-5 w-5" aria-hidden />
                  </button>
                </>
              )}
            </div>
          );
        }}
      />
    </Card>
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        onConfirm={closeDetailModal}
        confirmLabel="Cerrar"
        confirmVariant="ghost"
        title={detailInstitution?.nombre ?? 'Detalle de la institución'}
        description="Información general y datos de contacto del registro seleccionado."
        size="lg"
        scrollable={false}
      >
        {detailInstitution ? (
          <div className="space-y-6">
            <div className={tabContainerClasses} role="tablist" aria-label="Detalle de la institución">
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'info'}
                className={`${tabBaseClasses} ${detailTab === 'info' ? tabActiveClasses : tabInactiveClasses}`}
                onClick={() => setDetailTab('info')}
              >
                Información
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'students'}
                className={`${tabBaseClasses} ${detailTab === 'students' ? tabActiveClasses : tabInactiveClasses}`}
                onClick={() => setDetailTab('students')}
              >
                Estudiantes
              </button>
            </div>
            {detailTab === 'info' ? (
              <>
                <div className="overflow-hidden rounded-3xl border border-white/40 shadow-xl dark:border-slate-700">
                  <img
                    src={
                      detailInstitution.portada_url
                        ? resolveMediaUrl(detailInstitution.portada_url)
                        : 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
                    }
                    alt={detailInstitution.nombre}
                    className="h-48 w-full object-cover"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Ciudad</p>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {detailInstitution.ciudad || '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Estado</p>
                    <div className="mt-1">{renderStatusBadge(detailInstitution)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Correo</p>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {detailInstitution.email || '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Teléfono</p>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {detailInstitution.telefono || '—'}
                    </p>
                  </div>
                  {detailInstitution.motivo_desafiliacion && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
                      <p className="text-xs uppercase tracking-widest text-amber-600 dark:text-amber-200">Motivo de desafiliación</p>
                      <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-100">
                        {detailInstitution.motivo_desafiliacion}
                      </p>
                      {detailInstitution.fecha_desafiliacion && (
                        <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-200/80">
                          {new Date(detailInstitution.fecha_desafiliacion).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                  {detailInstitution.fecha_reafiliacion && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                      <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-200">Reafiliada</p>
                      <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-100">
                        {new Date(detailInstitution.fecha_reafiliacion).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {detailInstitution.sancion_motivo && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
                      <p className="text-xs uppercase tracking-widest text-rose-600 dark:text-rose-200">Sanción</p>
                      <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-100">
                        {detailInstitution.sancion_tipo || 'Temporal'}
                      </p>
                      <p className="mt-1 text-sm text-rose-700 dark:text-rose-100">{detailInstitution.sancion_motivo}</p>
                      <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-200/80">
                        Vigencia: {detailInstitution.sancion_inicio ? new Date(detailInstitution.sancion_inicio).toLocaleDateString() : '—'}
                        {detailInstitution.sancion_fin ? ` – ${new Date(detailInstitution.sancion_fin).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                  )}
                </div>
                {detailInstitution.descripcion && (
                  <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Descripción</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {detailInstitution.descripcion}
                    </p>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Dirección</p>
                    <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                      {detailInstitution.direccion || '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Actualización</p>
                    <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                      {detailInstitution.actualizado_en
                        ? new Date(detailInstitution.actualizado_en).toLocaleString()
                        : '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Registrado el{' '}
                      {detailInstitution.creado_en
                        ? new Date(detailInstitution.creado_en).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Tarjetas de estudiantes</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Navega el carrusel para conocer a cada estudiante con un formato inspirado en tarjetas deportivas.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={carouselButtonClasses}
                      onClick={goToPreviousDetailStudent}
                      disabled={detailStudentCount <= 1 || detailStudentsLoading}
                      aria-label="Estudiante anterior"
                    >
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden />
                    </button>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      {detailStudentCount ? `${detailStudentIndex + 1} / ${detailStudentCount}` : '0 / 0'}
                    </span>
                    <button
                      type="button"
                      className={carouselButtonClasses}
                      onClick={goToNextDetailStudent}
                      disabled={detailStudentCount <= 1 || detailStudentsLoading}
                      aria-label="Siguiente estudiante"
                    >
                      <ChevronRightIcon className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>
                {detailStudentsLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    Cargando estudiantes…
                  </div>
                ) : !hasDetailStudents ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    No hay estudiantes registrados para esta institución.
                  </div>
                ) : (
                  <>
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-500 to-sky-500 p-6 text-white shadow-2xl">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_65%)] opacity-80" aria-hidden />
                      <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                        <div className="flex justify-center">
                          <img
                            src={currentStudentPhoto}
                            alt={currentStudentName}
                            className="h-64 w-64 rounded-[32px] border-4 border-white/60 object-cover shadow-2xl"
                          />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Estudiante</p>
                            <h4 className="mt-2 text-3xl font-black uppercase tracking-[0.25em]">{currentStudentName}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest ${currentStudentStatusClass}`}>
                              {currentStudentStatusLabel}
                            </span>
                            {currentStudentGenderLabel && (
                              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/90">
                                {currentStudentGenderLabel}
                              </span>
                            )}
                          </div>
                          <div className="grid gap-3 text-sm font-medium text-white/90">
                            <div className="flex items-center justify-between border-b border-white/20 pb-2">
                              <span className="uppercase tracking-widest text-white/60">Documento</span>
                              <span>{currentStudentDocument}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-white/20 pb-2">
                              <span className="uppercase tracking-widest text-white/60">Nacimiento</span>
                              <span>{currentStudentBirth}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-white/20 pb-2">
                              <span className="uppercase tracking-widest text-white/60">Institución</span>
                              <span>{detailInstitution?.nombre ?? '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      {detailStudents.map((student, index) => (
                        <span
                          key={student.id ?? index}
                          className={`h-1.5 rounded-full transition-all ${index === detailStudentIndex ? 'w-6 bg-white' : 'w-3 bg-white/40'}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetailOpen(false);
                          openStudentManager(detailInstitution);
                        }}
                      >
                        Gestionar estudiantes
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecciona una institución para ver su detalle.</p>
        )}
      </Modal>
      <Modal
        isOpen={isDisaffiliateOpen}
        onClose={closeDisaffiliateModal}
        onConfirm={handleDisaffiliate}
        confirmLabel={isProcessingAction ? 'Procesando…' : 'Desafiliar'}
        confirmDisabled={isProcessingAction}
        confirmVariant="danger"
        title="Desafiliar institución"
        description="El registro permanecerá visible pero sin acceso a torneos o eventos."
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Describe el motivo para dejar constancia en el historial consolidado.
        </p>
        <textarea
          value={disaffiliationReason}
          onChange={(event) => setDisaffiliationReason(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-slate-700 dark:bg-slate-900/70"
          placeholder="Motivo de desafiliación"
        />
      </Modal>
      <Modal
        isOpen={isReaffiliateOpen}
        onClose={closeReaffiliateModal}
        onConfirm={handleReaffiliate}
        confirmLabel={isProcessingAction ? 'Procesando…' : 'Reafiliar'}
        confirmDisabled={isProcessingAction}
        title="Reafiliar institución"
        description="Restituye los permisos y asociaciones previas de la institución."
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Puedes añadir una nota interna (opcional) sobre el proceso de reafiliación.
        </p>
        <textarea
          value={reaffiliateNote}
          onChange={(event) => setReaffiliateNote(event.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
          placeholder="Observaciones internas"
        />
      </Modal>
      <Modal
        isOpen={isSanctionOpen}
        onClose={closeSanctionModal}
        onConfirm={handleSanction}
        confirmLabel={isProcessingAction ? 'Procesando…' : 'Guardar sanción'}
        confirmDisabled={isProcessingAction}
        title="Sancionar institución"
        description="Registra los detalles de la sanción aplicada. Puedes dejar las fechas vacías si es indefinida."
      >
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Motivo</label>
            <textarea
              value={sanctionForm.motivo}
              onChange={(event) => setSanctionForm((prev) => ({ ...prev, motivo: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Describe la razón principal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</label>
            <input
              value={sanctionForm.tipo}
              onChange={(event) => setSanctionForm((prev) => ({ ...prev, tipo: event.target.value }))}
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-900/70"
              placeholder="Ej. Suspensión temporal"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Inicio</label>
              <input
                value={sanctionForm.fecha_inicio}
                onChange={(event) => setSanctionForm((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-900/70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Fin</label>
              <input
                value={sanctionForm.fecha_fin}
                onChange={(event) => setSanctionForm((prev) => ({ ...prev, fecha_fin: event.target.value }))}
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-900/70"
              />
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isStudentManagerOpen}
        onClose={closeStudentManager}
        onConfirm={studentManagerTab === 'form' ? handleStudentSubmit : closeStudentManager}
        confirmLabel={
          studentManagerTab === 'form'
            ? studentFormMode === 'edit'
              ? 'Actualizar estudiante'
              : 'Agregar estudiante'
            : 'Cerrar'
        }
        confirmVariant={studentManagerTab === 'form' ? 'primary' : 'ghost'}
        confirmDisabled={studentManagerTab === 'form' ? studentSaving || studentsLoading : false}
        confirmLoading={studentManagerTab === 'form' ? studentSaving : false}
        title={`Estudiantes de ${activeInstitution?.nombre ?? 'la institución'}`}
        description="Administra los estudiantes vinculados a la institución seleccionada."
        size="xl"
        scrollable
      >
        <div className="space-y-6">
          <div className={tabContainerClasses} role="tablist" aria-label="Gestión de estudiantes">
            <button
              type="button"
              role="tab"
              aria-selected={studentManagerTab === 'list'}
              className={`${tabBaseClasses} ${studentManagerTab === 'list' ? tabActiveClasses : tabInactiveClasses}`}
              onClick={() => setStudentManagerTab('list')}
            >
              Estudiantes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studentManagerTab === 'form'}
              className={`${tabBaseClasses} ${studentManagerTab === 'form' ? tabActiveClasses : tabInactiveClasses}`}
              onClick={() => {
                if (studentFormMode !== 'edit') {
                  resetStudentForm(activeInstitution);
                }
                setStudentManagerTab('form');
              }}
            >
              {studentFormMode === 'edit' ? 'Editar estudiante' : 'Agregar Estudiante'}
            </button>
          </div>
          {studentManagerTab === 'list' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Listado actual</h4>
               
              </div>
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Agregar desde estudiantes disponibles
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Selecciona un estudiante sin institución asignada para vincularlo rápidamente.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAssignExistingStudent}
                    disabled={!selectedExistingStudent || assigningExistingStudent || availableStudentsLoading}
                  >
                    {assigningExistingStudent ? 'Asignando…' : 'Asignar estudiante'}
                  </Button>
                </div>
                <Select
                  value={selectedExistingStudent}
                  onChange={setSelectedExistingStudent}
                  options={availableStudentOptions}
                  placeholder={availableStudentsLoading ? 'Cargando estudiantes…' : 'Selecciona un estudiante disponible'}
                  helperText="Solo se listan estudiantes sin institución asignada."
                  searchable
                  disabled={availableStudentsLoading || assigningExistingStudent}
                  emptyMessage={availableStudentsLoading ? 'Buscando estudiantes…' : 'No hay estudiantes sin institución.'}
                />
              </div>
              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {studentsLoading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-300">Cargando estudiantes…</p>
                ) : students.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    No hay estudiantes registrados para esta institución.
                  </p>
                ) : (
                  students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {`${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Documento: {student.documento_identidad || '—'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Nacimiento:{' '}
                          {student.fecha_nacimiento
                            ? new Date(student.fecha_nacimiento).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className={`${actionButtonClass} h-9 w-9`}
                          onClick={() => startEditStudent(student)}
                          title="Editar estudiante"
                          disabled={studentSaving || studentsLoading}
                        >
                          <PencilSquareIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`${warningActionButtonClass} h-9 w-9`}
                          onClick={() => handleDetachStudent(student)}
                          title="Desvincular de la institución"
                          disabled={studentSaving || studentsLoading}
                        >
                          <UserMinusIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`${dangerActionButtonClass} h-9 w-9`}
                          onClick={() => handleRemoveStudent(student)}
                          title="Eliminar estudiante"
                          disabled={studentSaving || studentsLoading}
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                    {studentFormMode === 'edit' ? 'Editar estudiante' : 'Nuevo estudiante'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStudentManagerTab('list')}
                    >
                      Volver al listado
                    </Button>
                    {studentFormMode === 'edit' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetStudentForm(activeInstitution)}
                        disabled={studentSaving}
                      >
                        Cancelar edición
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Completa los campos obligatorios para registrar o actualizar el estudiante.
                </p>
                <FileUpload
                  label="Foto del estudiante"
                  description="Carga una imagen cuadrada para identificar al atleta."
                  helperText="Formatos admitidos: JPG, PNG o WebP."
                  previewUrl={studentPhotoPreview}
                  onFileSelect={handleStudentPhotoSelect}
                  onRemove={handleStudentPhotoRemove}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Institución asignada"
                    value={studentForm.institucion_id}
                    onChange={(value) => handleStudentFormChange('institucion_id', value)}
                    options={institutionOptions}
                    searchable
                    helperText="Puedes mover al estudiante a otra institución."
                    placeholder="Selecciona una institución"
                  />
                  <Select
                    label="Género"
                    value={studentForm.genero ?? ''}
                    onChange={(value) => handleStudentFormChange('genero', value)}
                    options={genderOptions}
                    placeholder="Sin definir"
                    clearable
                  />
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Nombres
                    <input
                      type="text"
                      value={studentForm.nombres}
                      onChange={(event) => handleStudentFormChange('nombres', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Ej. María Fernanda"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Apellidos
                    <input
                      type="text"
                      value={studentForm.apellidos}
                      onChange={(event) => handleStudentFormChange('apellidos', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Ej. Pérez López"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Documento de identidad
                    <input
                      type="text"
                      value={studentForm.documento_identidad ?? ''}
                      onChange={(event) => handleStudentFormChange('documento_identidad', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Número de documento"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Fecha de nacimiento
                    <input
                      type="date"
                      value={studentForm.fecha_nacimiento ?? ''}
                      onChange={(event) => handleStudentFormChange('fecha_nacimiento', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <input
                    id="student-active"
                    type="checkbox"
                    checked={studentForm.activo}
                    onChange={(event) => handleStudentFormChange('activo', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-400"
                  />
                  <label htmlFor="student-active" className="flex-1 text-sm text-slate-600 dark:text-slate-200">
                    Estudiante activo
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isRepresentativeManagerOpen}
        onClose={closeRepresentativeManager}
        onConfirm={
          representativeManagerTab === 'form' ? handleRepresentativeSubmit : closeRepresentativeManager
        }
        confirmLabel={
          representativeManagerTab === 'form'
            ? representativeFormMode === 'edit'
              ? 'Actualizar representante'
              : 'Crear representante'
            : 'Cerrar'
        }
        confirmVariant={representativeManagerTab === 'form' ? 'primary' : 'ghost'}
        confirmDisabled={
          representativeManagerTab === 'form' ? representativeSaving || representativesLoading : false
        }
        confirmLoading={representativeManagerTab === 'form' ? representativeSaving : false}
        title={`Representantes de ${activeInstitution?.nombre ?? 'la institución'}`}
        description="Gestiona los usuarios con rol de representante educativo asignados a la institución."
        size="xl"
        scrollable
      >
        <div className="space-y-6">
          <div className={tabContainerClasses} role="tablist" aria-label="Gestión de representantes">
            <button
              type="button"
              role="tab"
              aria-selected={representativeManagerTab === 'list'}
              className={`${tabBaseClasses} ${
                representativeManagerTab === 'list' ? tabActiveClasses : tabInactiveClasses
              }`}
              onClick={() => setRepresentativeManagerTab('list')}
            >
              Representantes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={representativeManagerTab === 'form'}
              className={`${tabBaseClasses} ${
                representativeManagerTab === 'form' ? tabActiveClasses : tabInactiveClasses
              }`}
              onClick={() => {
                if (representativeFormMode !== 'edit') {
                  resetRepresentativeForm(activeInstitution);
                }
                setRepresentativeManagerTab('form');
              }}
            >
              {representativeFormMode === 'edit' ? 'Editar representante' : 'Agregar Representante'}
            </button>
          </div>
          {representativeManagerTab === 'list' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Representantes</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetRepresentativeForm(activeInstitution);
                    setRepresentativeManagerTab('form');
                  }}
                  disabled={representativeSaving}
                >
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Nuevo representante
                </Button>
              </div>
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Asignar representante existente
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Selecciona un usuario con rol de representante educativo sin institución asignada.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAssignExistingRepresentative}
                    disabled={
                      !selectedExistingRepresentative
                      || assigningExistingRepresentative
                      || availableRepresentativesLoading
                    }
                  >
                    {assigningExistingRepresentative ? 'Asignando…' : 'Asignar representante'}
                  </Button>
                </div>
                <Select
                  value={selectedExistingRepresentative}
                  onChange={setSelectedExistingRepresentative}
                  options={availableRepresentativeOptions}
                  placeholder={
                    availableRepresentativesLoading
                      ? 'Cargando representantes…'
                      : 'Selecciona un representante disponible'
                  }
                  helperText="Solo se muestran usuarios activos sin institución asignada."
                  searchable
                  disabled={availableRepresentativesLoading || assigningExistingRepresentative}
                  emptyMessage={
                    availableRepresentativesLoading
                      ? 'Buscando representantes…'
                      : 'No hay representantes disponibles.'
                  }
                />
              </div>
              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {representativesLoading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-300">Cargando representantes…</p>
                ) : representatives.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    No hay representantes educativos asignados.
                  </p>
                ) : (
                  representatives.map((representative) => {
                    const isDeleted = Boolean(representative.eliminado);
                    return (
                      <div
                        key={representative.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {representative.nombre_completo ?? 'Sin nombre'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-300">{representative.email ?? '—'}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                                representative.activo
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100'
                                  : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100'
                              }`}
                            >
                              {representative.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            {isDeleted && (
                              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100">
                                Eliminado
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!isDeleted && (
                            <button
                              type="button"
                              className={`${actionButtonClass} h-9 w-9`}
                              onClick={() => startEditRepresentative(representative)}
                              title="Editar representante"
                              disabled={representativeSaving || representativesLoading}
                            >
                              <PencilSquareIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          {!isDeleted && (
                            <button
                              type="button"
                              className={`${warningActionButtonClass} h-9 w-9`}
                              onClick={() => handleRepresentativeDetach(representative)}
                              title="Desvincular de la institución"
                              disabled={representativeSaving || representativesLoading}
                            >
                              <UserMinusIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          {!isDeleted && (
                            <button
                              type="button"
                              className={`${dangerActionButtonClass} h-9 w-9`}
                              onClick={() => handleRepresentativeRemove(representative)}
                              title="Eliminar representante"
                              disabled={representativeSaving || representativesLoading}
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          {isDeleted && (
                            <button
                              type="button"
                              className={`${actionButtonClass} h-9 w-9 text-slate-500`}
                              onClick={() => handleRepresentativeRestore(representative)}
                              title="Restaurar representante"
                              disabled={representativeSaving || representativesLoading}
                            >
                              <ArrowPathIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          {isDeleted && (
                            <button
                              type="button"
                              className={`${dangerActionButtonClass} h-9 w-9 text-red-600`}
                              onClick={() => handleRepresentativeForceRemove(representative)}
                              title="Eliminar permanentemente"
                              disabled={representativeSaving || representativesLoading}
                            >
                              <NoSymbolIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                    {representativeFormMode === 'edit' ? 'Editar representante' : 'Nuevo representante'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRepresentativeManagerTab('list')}
                    >
                      Volver al listado
                    </Button>
                    {representativeFormMode === 'edit' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetRepresentativeForm(activeInstitution)}
                        disabled={representativeSaving}
                      >
                        Cancelar edición
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200 md:col-span-2">
                    Nombre completo
                    <input
                      type="text"
                      value={representativeForm.nombre_completo}
                      onChange={(event) => handleRepresentativeFormChange('nombre_completo', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Ingresa el nombre y apellidos"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Correo electrónico
                    <input
                      type="email"
                      value={representativeForm.email}
                      onChange={(event) => handleRepresentativeFormChange('email', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="correo@institucion.edu"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Teléfono
                    <input
                      type="text"
                      value={representativeForm.telefono ?? ''}
                      onChange={(event) => handleRepresentativeFormChange('telefono', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder="Número de contacto"
                    />
                  </label>
                  <Select
                    label="Institución asignada"
                    value={representativeForm.institucion_id}
                    onChange={(value) => handleRepresentativeFormChange('institucion_id', value)}
                    options={institutionOptions}
                    searchable
                    placeholder="Selecciona una institución"
                    helperText="Se asignará automáticamente el rol de representante educativo."
                  />
                  <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-200">
                    Contraseña
                    <input
                      type="password"
                      value={representativeForm.password}
                      onChange={(event) => handleRepresentativeFormChange('password', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                      placeholder={representativeFormMode === 'edit' ? 'Mantener sin cambios' : 'Contraseña temporal'}
                    />
                    <span className="block text-xs text-slate-400">
                      {representativeFormMode === 'edit'
                        ? 'Déjalo vacío para conservar la contraseña actual.'
                        : 'Se enviará sin correo automático, compártela de forma manual.'}
                    </span>
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                    <input
                      id="representative-active"
                      type="checkbox"
                      checked={representativeForm.activo}
                      onChange={(event) => handleRepresentativeFormChange('activo', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-400"
                    />
                    <label htmlFor="representative-active" className="flex-1 text-sm text-slate-600 dark:text-slate-200">
                      Usuario activo
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={modalMode === 'edit' ? 'Actualizar' : 'Crear'}
        confirmDisabled={isSubmitting}
        confirmLoading={isSubmitting}
        title={modalMode === 'edit' ? 'Editar institución' : 'Registrar institución'}
        description={
          modalMode === 'edit'
            ? 'Actualiza los datos de la institución seleccionada.'
            : 'Ingresa la información básica de la nueva institución.'
        }
      >
        <form className="space-y-4 px-4" onSubmit={onSubmit}>
          <FileUpload
            label="Portada de la institución"
            description="Carga una imagen panorámica para destacar a la institución."
            helperText="Recomendado 1200x600 px."
            previewUrl={coverPreview}
            onFileSelect={handleCoverSelect}
            onRemove={handleCoverRemove}
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Nombre
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('nombre')}
              />
            </label>
            {errors.nombre && <span className="mt-1 block text-xs text-red-500">{errors.nombre.message}</span>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Ciudad
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('ciudad')}
                />
              </label>
              {errors.ciudad && <span className="mt-1 block text-xs text-red-500">{errors.ciudad.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Dirección
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('direccion')}
                />
              </label>
              {errors.direccion && <span className="mt-1 block text-xs text-red-500">{errors.direccion.message}</span>}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Correo
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('email')}
                />
              </label>
              {errors.email && <span className="mt-1 block text-xs text-red-500">{errors.email.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Teléfono
                <input
                  type="tel"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('telefono')}
                />
              </label>
              {errors.telefono && <span className="mt-1 block text-xs text-red-500">{errors.telefono.message}</span>}
            </div>
          </div>
          <Controller
            name="estado"
            control={control}
            render={({ field }) => (
              <Select
                label="Estado"
                options={institutionStatusOptions}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                clearable={false}
                error={errors.estado?.message}
              />
            )}
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
              Descripción
              <textarea
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...register('descripcion')}
              />
            </label>
            {errors.descripcion && <span className="mt-1 block text-xs text-red-500">{errors.descripcion.message}</span>}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        confirmLabel={
          isDeleting
            ? 'Eliminando…'
            : institutionToDelete?.eliminado
              ? 'Eliminar permanentemente'
              : 'Eliminar'
        }
        confirmVariant={institutionToDelete?.eliminado ? 'danger' : 'outline'}
        confirmDisabled={isDeleting}
        confirmLoading={isDeleting}
        title={
          institutionToDelete?.eliminado ? 'Eliminar permanentemente' : 'Enviar institución a la papelera'
        }
        description={
          institutionToDelete?.eliminado
            ? 'Esta acción removerá definitivamente todos los datos asociados.'
            : 'La institución se ocultará del panel y podrás restaurarla en cualquier momento.'
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Confirmas que deseas {institutionToDelete?.eliminado ? 'eliminar definitivamente' : 'mover a la papelera'} a{' '}
          <strong>{institutionToDelete?.nombre}</strong>?
        </p>
      </Modal>
    </>
    
  );
};
