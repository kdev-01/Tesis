import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, ArrowPathIcon, EyeIcon, PencilSquareIcon, TrashIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/data-display/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { useFetchWithAuth } from '../../hooks/useFetchWithAuth.js';
import { studentService } from '../../services/dataService.js';
import { useToast } from '../../hooks/useToast.js';
import { resolveMediaUrl } from '../../utils/media.js';

const studentSchema = z.object({
  institucion_id: z.string().min(1, 'Selecciona una institución'),
  nombres: z.string().min(1, 'Ingresa los nombres'),
  apellidos: z.string().min(1, 'Ingresa los apellidos'),
  documento_identidad: z
    .string()
    .max(50, 'El documento es demasiado largo')
    .optional()
    .or(z.literal(''))
    .transform((value) => value.trim()),
  fecha_nacimiento: z.string().min(1, 'Selecciona la fecha de nacimiento'),
  genero: z.enum(['M', 'F', 'Otro']).optional().or(z.literal('')).transform((value) => value || null),
  activo: z.boolean().optional(),
});

export const Players = () => {
  const studentsEndpoint = '/students/?page_size=100&include_deleted=1';
  const { data: studentsData, loading, refetch } = useFetchWithAuth(studentsEndpoint);
  const { data: institutionsData } = useFetchWithAuth('/institutions/?page_size=100');
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({ isOpen: false, action: null, student: null });
  const [isStatusProcessing, setIsStatusProcessing] = useState(false);
  const statusActionConfig = useMemo(() => {
    if (!statusModal.action || !statusModal.student) {
      return {
        title: 'Gestionar estudiante',
        description: '',
        confirmLabel: 'Confirmar',
        confirmVariant: 'primary',
        message: (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Selecciona un estudiante para gestionar su estado.
          </p>
        ),
      };
    }
    const displayName = `${statusModal.student.nombres ?? ''} ${statusModal.student.apellidos ?? ''}`.trim()
      || statusModal.student.documento_identidad
      || `ID ${statusModal.student.id}`;
    switch (statusModal.action) {
      case 'restore':
        return {
          title: 'Restaurar estudiante',
          description: 'El estudiante volverá a aparecer como activo en los listados.',
          confirmLabel: 'Restaurar',
          confirmVariant: 'primary',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas restaurar a <strong>{displayName}</strong>? Podrá ser asignado nuevamente a eventos.
            </p>
          ),
        };
      case 'force-delete':
        return {
          title: 'Eliminar permanentemente',
          description: 'Esta acción es definitiva y eliminará todos los datos asociados.',
          confirmLabel: 'Eliminar permanentemente',
          confirmVariant: 'danger',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar de forma permanente a <strong>{displayName}</strong>? Esta acción no se puede deshacer.
            </p>
          ),
        };
      case 'delete':
      default:
        return {
          title: 'Eliminar estudiante',
          description: 'El estudiante se marcará como eliminado y podrás restaurarlo luego.',
          confirmLabel: 'Eliminar',
          confirmVariant: 'outline',
          message: (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar a <strong>{displayName}</strong>? El registro permanecerá oculto hasta que lo restaures.
            </p>
          ),
        };
    }
  }, [statusModal.action, statusModal.student]);
  const [detailStudent, setDetailStudent] = useState(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);

  const students = useMemo(
    () => (Array.isArray(studentsData) ? studentsData : []),
    [studentsData],
  );
  const institutions = useMemo(
    () => (Array.isArray(institutionsData) ? institutionsData : []),
    [institutionsData],
  );

  const institutionOptions = useMemo(
    () =>
      institutions.map((institution) => ({
        value: String(institution.id),
        label: institution.nombre,
        description: institution.ciudad ?? undefined,
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      institucion_id: '',
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setSelectedStudent(null);
    reset({
      institucion_id: '',
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    });
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    setRemovePhoto(false);
  };

  const openCreateModal = () => {
    setModalMode('create');
    reset({
      institucion_id: '',
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    });
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    setRemovePhoto(false);
    setModalOpen(true);
  };

  const openEditModal = (student) => {
    if (student?.eliminado) {
      addToast({
        title: 'Estudiante eliminado',
        description: 'Restaura al estudiante antes de intentar editarlo.',
        status: 'info',
      });
      return;
    }
    setModalMode('edit');
    setSelectedStudent(student);
    reset({
      institucion_id: String(student.institucion_id ?? ''),
      nombres: student.nombres,
      apellidos: student.apellidos,
      documento_identidad: student.documento_identidad ?? '',
      fecha_nacimiento: student.fecha_nacimiento ? student.fecha_nacimiento.slice(0, 10) : '',
      genero: student.genero ?? '',
      activo: student.activo,
    });
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(student.foto_url ? resolveMediaUrl(student.foto_url) : '');
    setRemovePhoto(false);
    setModalOpen(true);
  };

  const openStatusModal = (student, action) => {
    setStatusModal({ isOpen: true, student, action });
  };

  const closeStatusModal = () => {
    setStatusModal({ isOpen: false, student: null, action: null });
  };

  const openDetailModal = (student) => {
    setDetailStudent(student);
    setDetailOpen(true);
  };

  const closeDetailModal = () => {
    setDetailStudent(null);
    setDetailOpen(false);
  };

  const handlePhotoSelect = (file) => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setRemovePhoto(false);
    } else {
      setPhotoFile(null);
      setPhotoPreview('');
    }
  };

  const handlePhotoRemove = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    setRemovePhoto(true);
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    const submission = new FormData();
    submission.append('institucion_id', formData.institucion_id);
    submission.append('nombres', formData.nombres.trim());
    submission.append('apellidos', formData.apellidos.trim());
    submission.append('fecha_nacimiento', formData.fecha_nacimiento);
    submission.append('activo', (formData.activo ?? true) ? 'true' : 'false');

    const documento = formData.documento_identidad?.trim();
    if (documento) {
      submission.append('documento_identidad', documento);
    }

    const genero = formData.genero?.trim();
    if (genero) {
      submission.append('genero', genero);
    }

    if (photoFile) {
      submission.append('foto', photoFile);
    } else if (modalMode === 'edit' && removePhoto) {
      submission.append('remove_foto', 'true');
    }

    try {
      if (modalMode === 'edit' && selectedStudent) {
        await studentService.update(selectedStudent.id, submission);
        addToast({ title: 'Estudiante actualizado', status: 'success' });
      } else {
        await studentService.create(submission);
        addToast({ title: 'Estudiante registrado', status: 'success' });
      }
      closeModal();
      await refetch();
    } catch (error) {
      addToast({ title: 'No se pudo guardar al estudiante', description: error.message, status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleStatusAction = async () => {
    if (!statusModal.student || !statusModal.action) return;
    setIsStatusProcessing(true);
    const actionMessages = {
      delete: { success: 'Estudiante eliminado', error: 'No se pudo eliminar al estudiante' },
      restore: { success: 'Estudiante restaurado', error: 'No se pudo restaurar al estudiante' },
      'force-delete': {
        success: 'Estudiante eliminado permanentemente',
        error: 'No se pudo eliminar permanentemente al estudiante',
      },
    };
    try {
      if (statusModal.action === 'delete') {
        await studentService.remove(statusModal.student.id);
      } else if (statusModal.action === 'restore') {
        await studentService.restore(statusModal.student.id);
      } else if (statusModal.action === 'force-delete') {
        await studentService.forceRemove(statusModal.student.id);
      }
      addToast({
        title: actionMessages[statusModal.action]?.success ?? 'Acción completada',
        status: 'success',
      });
      closeStatusModal();
      await refetch();
    } catch (error) {
      addToast({
        title: actionMessages[statusModal.action]?.error ?? 'No se pudo completar la acción',
        description: error.message,
        status: 'error',
      });
    } finally {
      setIsStatusProcessing(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      `${student.nombres} ${student.apellidos}`.toLowerCase().includes(query) ||
      (student.documento_identidad ?? '').toLowerCase().includes(query),
    );
  }, [students, search]);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const actionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary-500 shadow-lg shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 dark:bg-slate-800 dark:text-primary-200';
  const dangerActionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-lg shadow-red-400/20 transition hover:-translate-y-0.5 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:bg-slate-800 dark:text-red-400';

  return (

    <>
     <Card>
      <CardHeader
        title="Estudiantes"
        description="Monitorea el rendimiento y la inscripción de estudiantes."
        actions={
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-gradient-to-r from-sky-100 via-rose-100 to-purple-100 p-1.5 shadow-inner dark:from-slate-800 dark:via-slate-800/70 dark:to-slate-900">
            <Button variant="gradient" size="sm" onClick={openCreateModal}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Nuevo estudiante
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
      <div className="mb-6 w-full md:max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o documento" />
      </div>
      <DataTable
        columns={[
          {
            Header: 'Jugador',
            accessor: 'nombres',
            Cell: ({ row }) => {
              const initials = `${row.nombres?.[0] ?? ''}${row.apellidos?.[0] ?? ''}`.trim() || 'JR';
              return (
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-gradient-to-br from-sky-200 via-rose-200 to-purple-200 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 dark:text-slate-200">
                    {row.foto_url ? (
                      <img
                        src={resolveMediaUrl(row.foto_url)}
                        alt={`${row.nombres} ${row.apellidos}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-100">{`${row.nombres} ${row.apellidos}`.trim()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{row.documento_identidad || 'Sin documento'}</p>
                  </div>
                </div>
              );
            },
          },
          {
            Header: 'Institución',
            accessor: 'institucion',
            Cell: ({ row }) => row.institucion?.nombre ?? 'Sin asignar',
          },
          {
            Header: 'Fecha de nacimiento',
            accessor: 'fecha_nacimiento',
            Cell: ({ value }) => (value ? new Date(value).toLocaleDateString() : '—'),
          },
           {
            Header: 'Identificacion',
            accessor: 'documento_identidad',
            Cell: ({ row }) => row.documento_identidad ?? 'Sin asignar',
          },
          {
            Header: 'Género',
            accessor: 'genero',
            Cell: ({ value }) => (value ? <Badge>{value}</Badge> : <Badge color="neutral">No definido</Badge>),
          },
          {
            Header: 'Estado',
            accessor: 'activo',
            Cell: ({ row }) => {
              if (row.eliminado) {
                return (
                  <Badge className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                    Eliminado
                  </Badge>
                );
              }
              return (
                <Badge color={row.activo ? 'accent' : 'neutral'}>
                  {row.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              );
            },
          },
        ]}
        data={filteredStudents}
        emptyMessage={
          search.trim()
            ? 'No se encontraron jugadores que coincidan con la búsqueda'
            : 'No se han registrado jugadores'
        }
        loading={loading}
        renderActions={(student) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={`${actionButtonClass} text-sky-500`}
              onClick={() => openDetailModal(student)}
              title="Ver detalle"
            >
              <EyeIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={`${actionButtonClass} ${student.eliminado ? 'pointer-events-none opacity-50' : ''}`}
              onClick={() => openEditModal(student)}
              title={student.eliminado ? 'Restaurar antes de editar' : 'Editar'}
              disabled={student.eliminado}
            >
              <PencilSquareIcon className="h-5 w-5" aria-hidden />
            </button>
            {student.eliminado ? (
              <>
                <button
                  type="button"
                  className={`${actionButtonClass} text-slate-500`}
                  onClick={() => openStatusModal(student, 'restore')}
                  title="Restaurar"
                >
                  <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={dangerActionButtonClass}
                  onClick={() => openStatusModal(student, 'force-delete')}
                  title="Eliminar permanentemente"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                className={dangerActionButtonClass}
                onClick={() => openStatusModal(student, 'delete')}
                title="Eliminar"
              >
                <TrashIcon className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        )}
      />

     


    </Card>

     <Modal
        isOpen={isDetailOpen}
        onClose={closeDetailModal}
        onConfirm={closeDetailModal}
        confirmLabel="Cerrar"
        confirmVariant="ghost"
        title={detailStudent ? `${detailStudent.nombres} ${detailStudent.apellidos}`.trim() : 'Detalle del estudiante'}
        description="Información general del jugador seleccionado."
        size="lg"
        scrollable={false}
      >
        {detailStudent ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
              <div className="h-40 w-40 overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-sky-200 via-rose-200 to-purple-200 shadow-xl dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
                <img
                  src={
                    detailStudent.foto_url
                      ? resolveMediaUrl(detailStudent.foto_url)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(`${detailStudent.nombres} ${detailStudent.apellidos}`.trim() || 'J')}`
                  }
                  alt={`${detailStudent.nombres} ${detailStudent.apellidos}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 text-center md:text-left">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {`${detailStudent.nombres} ${detailStudent.apellidos}`.trim()}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {detailStudent.institucion?.nombre ?? 'Sin institución asignada'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {detailStudent.eliminado ? (
                    <Badge className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                      Eliminado
                    </Badge>
                  ) : (
                    <Badge color={detailStudent.activo ? 'accent' : 'neutral'}>
                      {detailStudent.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  )}
                  {detailStudent.genero ? <Badge color="neutral">{detailStudent.genero}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Documento</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailStudent.documento_identidad || 'No registrado'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Fecha de nacimiento</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailStudent.fecha_nacimiento ? new Date(detailStudent.fecha_nacimiento).toLocaleDateString() : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Creado</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailStudent.creado_en ? new Date(detailStudent.creado_en).toLocaleString() : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Actualizado</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {detailStudent.actualizado_en ? new Date(detailStudent.actualizado_en).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Selecciona un registro para ver los detalles.</p>
        )}
      </Modal>

      
    <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={onSubmit}
        confirmLabel={modalMode === 'edit' ? 'Actualizar' : 'Registrar'}
        confirmDisabled={isSubmitting}
        confirmLoading={isSubmitting}
        title={modalMode === 'edit' ? 'Editar estudiante' : 'Registrar estudiante'}
        description={
          modalMode === 'edit'
            ? 'Actualiza los datos del estudiante seleccionado.'
            : 'Ingresa la información de un nuevo estudiante.'
        }
      >
        <form className="space-y-6 px-4" onSubmit={onSubmit}>
          <FileUpload
            label="Foto del estudiante"
            description="Carga una imagen cuadrada para identificar al atleta."
            helperText="Formatos recomendados: JPG, PNG o WebP."
            previewUrl={photoPreview}
            onFileSelect={handlePhotoSelect}
            onRemove={handlePhotoRemove}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Controller
                name="institucion_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Institución"
                    placeholder="Selecciona una institución"
                    options={institutionOptions}
                    value={field.value || null}
                    onChange={(newValue) => field.onChange(newValue ?? '')}
                    onBlur={field.onBlur}
                    searchable
                    helperText="Puedes escribir para filtrar por nombre o ciudad."
                    error={errors.institucion_id?.message}
                  />
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Nombres
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('nombres')}
                />
              </label>
              {errors.nombres && <span className="mt-1 block text-xs text-red-500">{errors.nombres.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Apellidos
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('apellidos')}
                />
              </label>
              {errors.apellidos && <span className="mt-1 block text-xs text-red-500">{errors.apellidos.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Documento de identidad
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('documento_identidad')}
                />
              </label>
              {errors.documento_identidad && (
                <span className="mt-1 block text-xs text-red-500">{errors.documento_identidad.message}</span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                Fecha de nacimiento
                <input
                  type="date"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                  {...register('fecha_nacimiento')}
                />
              </label>
              {errors.fecha_nacimiento && (
                <span className="mt-1 block text-xs text-red-500">{errors.fecha_nacimiento.message}</span>
              )}
            </div>
            <div>
              <Controller
                name="genero"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Género"
                    placeholder="No especificado"
                    options={genderOptions}
                    value={field.value || null}
                    onChange={(newValue) => field.onChange(newValue ?? '')}
                    onBlur={field.onBlur}
                    error={errors.genero?.message}
                  />
                )}
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <input type="checkbox" className="h-4 w-4" {...register('activo')} /> Estudiante activo
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={statusModal.isOpen}
        onClose={closeStatusModal}
        onConfirm={handleStatusAction}
        confirmLabel={statusActionConfig.confirmLabel}
        confirmVariant={statusActionConfig.confirmVariant}
        confirmDisabled={isStatusProcessing}
        confirmLoading={isStatusProcessing}
        title={statusActionConfig.title}
        description={statusActionConfig.description}
      >
        {statusActionConfig.message}
      </Modal>
    </>

  );
};
