import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { institutionService, studentService } from '../../services/dataService.js';
import { resolveMediaUrl } from '../../utils/media.js';

const institutionSchema = z.object({
  nombre: z.string().min(3, 'Ingresa el nombre de la institución'),
  descripcion: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? ''),
  direccion: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? ''),
  ciudad: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? ''),
  telefono: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? ''),
  email: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? '')
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Correo electrónico inválido',
    }),
});

const studentSchema = z.object({
  nombres: z.string().min(1, 'Ingresa los nombres'),
  apellidos: z.string().min(1, 'Ingresa los apellidos'),
  documento_identidad: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() ?? ''),
  fecha_nacimiento: z.string().min(1, 'Selecciona la fecha de nacimiento'),
  genero: z
    .enum(['M', 'F', 'Otro'])
    .optional()
    .or(z.literal(''))
    .transform((value) => value || ''),
  activo: z.boolean().default(true),
});

const GENDER_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  ...GENDER_OPTIONS,
];

const calculateAge = (dateString) => {
  if (!dateString) return null;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
};

const getInitials = (nombres = '', apellidos = '') => {
  const parts = `${nombres} ${apellidos}`.trim().split(' ');
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  return initials || 'JR';
};

export const RepresentativeInstitutionStudents = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const institutionId = user?.institucion_id ?? null;
  const [activeTab, setActiveTab] = useState('institution');

  const [institution, setInstitution] = useState(null);
  const [loadingInstitution, setLoadingInstitution] = useState(false);
  const [savingInstitution, setSavingInstitution] = useState(false);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');

  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState('create');
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentPhotoFile, setStudentPhotoFile] = useState(null);
  const [studentPhotoPreview, setStudentPhotoPreview] = useState('');
  const [removeStudentPhoto, setRemoveStudentPhoto] = useState(false);

  const {
    register: registerInstitution,
    handleSubmit: handleInstitutionSubmit,
    reset: resetInstitution,
    formState: { errors: institutionErrors },
  } = useForm({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      email: '',
    },
  });

  const {
    register: registerStudent,
    control: controlStudent,
    handleSubmit: handleStudentSubmit,
    reset: resetStudentForm,
    setValue: setStudentValue,
    watch: watchStudent,
    formState: { errors: studentErrors, isSubmitting: isSavingStudent },
  } = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    },
  });

  const fetchInstitution = useCallback(async () => {
    if (!institutionId) return;
    try {
      setLoadingInstitution(true);
      const data = await institutionService.get(institutionId);
      setInstitution(data);
      resetInstitution({
        nombre: data?.nombre ?? '',
        descripcion: data?.descripcion ?? '',
        direccion: data?.direccion ?? '',
        ciudad: data?.ciudad ?? '',
        telefono: data?.telefono ?? '',
        email: data?.email ?? '',
      });
    } catch (error) {
      console.error('No se pudo cargar la institución', error);
      addToast({ title: 'No se pudo cargar la institución', description: error.message, status: 'error' });
    } finally {
      setLoadingInstitution(false);
    }
  }, [institutionId, resetInstitution, addToast]);

  const fetchStudents = useCallback(async () => {
    if (!institutionId) return;
    try {
      setLoadingStudents(true);
      const list = await studentService.list({ page_size: 90, institucion_id: institutionId });
      setStudents(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('No se pudieron cargar los estudiantes', error);
      addToast({ title: 'No se pudieron cargar los estudiantes', description: error.message, status: 'error' });
    } finally {
      setLoadingStudents(false);
    }
  }, [institutionId, addToast]);

  useEffect(() => {
    fetchInstitution();
    fetchStudents();
  }, [fetchInstitution, fetchStudents]);

  useEffect(
    () => () => {
      if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(studentPhotoPreview);
      }
    },
    [studentPhotoPreview],
  );

  const closeStudentModal = () => {
    setStudentModalOpen(false);
    setStudentModalMode('create');
    setEditingStudent(null);
    resetStudentForm({
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    });
    setStudentPhotoFile(null);
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    setStudentPhotoPreview('');
    setRemoveStudentPhoto(false);
  };

  const openCreateStudentModal = () => {
    setStudentModalMode('create');
    setEditingStudent(null);
    resetStudentForm({
      nombres: '',
      apellidos: '',
      documento_identidad: '',
      fecha_nacimiento: '',
      genero: '',
      activo: true,
    });
    setStudentPhotoFile(null);
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    setStudentPhotoPreview('');
    setRemoveStudentPhoto(false);
    setStudentModalOpen(true);
  };

  const studentActive = watchStudent('activo');

  const openEditStudentModal = (student) => {
    if (!student) return;
    setStudentModalMode('edit');
    setEditingStudent(student);
    resetStudentForm({
      nombres: student.nombres ?? '',
      apellidos: student.apellidos ?? '',
      documento_identidad: student.documento_identidad ?? '',
      fecha_nacimiento: student.fecha_nacimiento ? student.fecha_nacimiento.slice(0, 10) : '',
      genero: student.genero ?? '',
      activo: Boolean(student.activo),
    });
    setStudentPhotoFile(null);
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    setStudentPhotoPreview(student.foto_url ? resolveMediaUrl(student.foto_url) : '');
    setRemoveStudentPhoto(false);
    setStudentModalOpen(true);
  };

  const handleStudentPhotoSelect = (file) => {
    if (studentPhotoPreview && studentPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(studentPhotoPreview);
    }
    if (file) {
      setStudentPhotoFile(file);
      setStudentPhotoPreview(URL.createObjectURL(file));
      setRemoveStudentPhoto(false);
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
    setRemoveStudentPhoto(true);
  };

  const onSubmitInstitution = handleInstitutionSubmit(async (formData) => {
    if (!institutionId) return;
    setSavingInstitution(true);
    const submission = new FormData();
    submission.append('nombre', formData.nombre.trim());
    if (formData.descripcion) submission.append('descripcion', formData.descripcion);
    if (formData.direccion) submission.append('direccion', formData.direccion);
    if (formData.ciudad) submission.append('ciudad', formData.ciudad);
    if (formData.telefono) submission.append('telefono', formData.telefono);
    if (formData.email) submission.append('email', formData.email);
    submission.append('estado', institution?.estado ?? 'activa');
    try {
      await institutionService.update(institutionId, submission);
      addToast({ title: 'Institución actualizada', status: 'success' });
      await fetchInstitution();
    } catch (error) {
      console.error('No se pudo actualizar la institución', error);
      addToast({ title: 'No se pudo actualizar la institución', description: error.message, status: 'error' });
    } finally {
      setSavingInstitution(false);
    }
  });

  const onSubmitStudent = handleStudentSubmit(async (formData) => {
    if (!institutionId) {
      addToast({
        title: 'No se puede registrar',
        description: 'Tu usuario no tiene una institución asociada.',
        status: 'error',
      });
      return;
    }
    const submission = new FormData();
    submission.append('institucion_id', String(institutionId));
    submission.append('nombres', formData.nombres.trim());
    submission.append('apellidos', formData.apellidos.trim());
    submission.append('fecha_nacimiento', formData.fecha_nacimiento);
    submission.append('activo', formData.activo ? 'true' : 'false');
    if (formData.documento_identidad) {
      submission.append('documento_identidad', formData.documento_identidad);
    }
    if (formData.genero) {
      submission.append('genero', formData.genero);
    }
    if (studentPhotoFile) {
      submission.append('foto', studentPhotoFile);
    } else if (studentModalMode === 'edit' && removeStudentPhoto) {
      submission.append('remove_foto', 'true');
    }

    try {
      if (studentModalMode === 'edit' && editingStudent) {
        await studentService.update(editingStudent.id, submission);
        addToast({ title: 'Estudiante actualizado', status: 'success' });
      } else {
        await studentService.create(submission);
        addToast({ title: 'Estudiante registrado', status: 'success' });
      }
      closeStudentModal();
      await fetchStudents();
    } catch (error) {
      console.error('No se pudo guardar el estudiante', error);
      addToast({ title: 'No se pudo guardar el estudiante', description: error.message, status: 'error' });
    }
  });

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students
      .filter((student) => {
        if (genderFilter === 'all') return true;
        return (student.genero ?? '').toLowerCase() === genderFilter.toLowerCase();
      })
      .filter((student) => {
        if (!query) return true;
        const fullName = `${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim().toLowerCase();
        const document = (student.documento_identidad ?? '').toLowerCase();
        return fullName.includes(query) || document.includes(query);
      });
  }, [students, search, genderFilter]);

  const tabButtonBase =
    'flex-1 rounded-2xl border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400';
  const tabActive = 'border-transparent bg-primary-500 text-white shadow-lg';
  const tabInactive = 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300';

  return (
    <>
     <Card>
      <CardHeader
        title="Estudiantes e Institución"
        description="Consulta y actualiza la información de tu institución y de tus estudiantes registrados."
        actions={
          activeTab === 'students' ? (
            <Button type="button" onClick={openCreateStudentModal}>
              Agregar estudiante
            </Button>
          ) : null
        }
      />
      {!institutionId ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Tu usuario no tiene una institución asociada actualmente. Contacta al administrador para continuar.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-2 rounded-3xl bg-slate-100/70 p-2 dark:bg-slate-800/50 sm:flex-row">
            <button
              type="button"
              className={`${tabButtonBase} ${activeTab === 'institution' ? tabActive : tabInactive}`}
              onClick={() => setActiveTab('institution')}
            >
              Institución
            </button>
            <button
              type="button"
              className={`${tabButtonBase} ${activeTab === 'students' ? tabActive : tabInactive}`}
              onClick={() => setActiveTab('students')}
            >
              Estudiantes
            </button>
          </div>

          {activeTab === 'institution' ? (
            <div className="space-y-6">
              {loadingInstitution ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">Cargando información de la institución…</p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Nombre oficial</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{institution?.nombre ?? 'Sin registrar'}</p>
                      <p className="mt-3 text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Estado</p>
                      <Badge className="mt-1" color={institution?.estado === 'activa' ? 'accent' : 'neutral'}>
                        {institution?.estado ?? 'Sin estado'}
                      </Badge>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Descripción</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {institution?.descripcion?.trim() || 'Agrega una descripción para destacar tu institución.'}
                      </p>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={onSubmitInstitution}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Nombre de la institución
                      <input
                        type="text"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                        {...registerInstitution('nombre')}
                      />
                      {institutionErrors.nombre && (
                        <span className="mt-1 block text-xs text-red-500">{institutionErrors.nombre.message}</span>
                      )}
                    </label>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Descripción
                      <textarea
                        rows={3}
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                        {...registerInstitution('descripcion')}
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Ciudad
                        <input
                          type="text"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                          {...registerInstitution('ciudad')}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Dirección
                        <input
                          type="text"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                          {...registerInstitution('direccion')}
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Teléfono de contacto
                        <input
                          type="text"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                          {...registerInstitution('telefono')}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Correo institucional
                        <input
                          type="email"
                          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                          {...registerInstitution('email')}
                        />
                        {institutionErrors.email && (
                          <span className="mt-1 block text-xs text-red-500">{institutionErrors.email.message}</span>
                        )}
                      </label>
                    </div>
                    <Button type="submit" disabled={savingInstitution}>
                      {savingInstitution ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Búsqueda
                    </label>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por nombre o documento"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                    />
                  </div>
                  <div className="sm:w-64">
                    <Select
                      label="Filtrar por sexo"
                      options={FILTER_OPTIONS}
                      value={genderFilter}
                      onChange={(value) => setGenderFilter(value ?? 'all')}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span>Estudiantes totales:</span>
                  <Badge variant="outline">{students.length}</Badge>
                </div>
              </div>

              {loadingStudents ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">Cargando estudiantes…</p>
              ) : filteredStudents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  No se encontraron estudiantes con los filtros aplicados.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredStudents.map((student) => {
                    const age = calculateAge(student.fecha_nacimiento);
                    return (
                      <div
                        key={student.id}
                        className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900"
                      >
                        <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary-500 via-amber-500 to-rose-500">
                          {student.foto_url ? (
                            <img
                              src={resolveMediaUrl(student.foto_url)}
                              alt={`${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || 'Estudiante'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-4xl font-bold text-white/80">
                              {getInitials(student.nombres, student.apellidos)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 text-white">
                            <p className="text-lg font-semibold">
                              {`${student.nombres ?? ''} ${student.apellidos ?? ''}`.trim() || 'Sin nombre'}
                            </p>
                            <p className="text-xs uppercase tracking-widest text-white/80">
                              {student.documento_identidad ? `Documento: ${student.documento_identidad}` : 'Sin documento registrado'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between gap-4 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={student.activo ? 'accent' : 'neutral'}>
                              {student.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {student.genero ? <Badge variant="outline">{student.genero}</Badge> : null}
                            {age !== null ? <Badge variant="outline">{age} años</Badge> : null}
                          </div>
                          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Fecha de nacimiento:</span>{' '}
                              {student.fecha_nacimiento ? new Date(student.fecha_nacimiento).toLocaleDateString() : 'Sin registrar'}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Registrado el:</span>{' '}
                              {student.creado_en ? new Date(student.creado_en).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              {institution?.nombre ?? 'Mi institución'}
                            </span>
                            <Button type="button" variant="outline" size="sm" onClick={() => openEditStudentModal(student)}>
                              Editar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      
    </Card>

    <Modal
        isOpen={studentModalOpen}
        onClose={closeStudentModal}
        onConfirm={onSubmitStudent}
        confirmLabel={isSavingStudent ? 'Guardando…' : studentModalMode === 'edit' ? 'Actualizar estudiante' : 'Registrar estudiante'}
        confirmDisabled={isSavingStudent}
        confirmLoading={isSavingStudent}
        title={studentModalMode === 'edit' ? 'Editar estudiante' : 'Nuevo estudiante'}
        description={
          studentModalMode === 'edit'
            ? 'Actualiza la información del estudiante seleccionado.'
            : 'Completa los datos para agregar un nuevo estudiante a tu institución.'
        }
        size="lg"
      >
        <form className="space-y-5 px-2" onSubmit={onSubmitStudent}>
          <FileUpload
            label="Foto del estudiante"
            description="Carga una imagen para identificar al estudiante en la tarjeta."
            helperText="Formatos admitidos: JPG, PNG o WebP."
            previewUrl={studentPhotoPreview}
            onFileSelect={handleStudentPhotoSelect}
            onRemove={studentPhotoPreview ? handleStudentPhotoRemove : undefined}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Nombres
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                {...registerStudent('nombres')}
              />
              {studentErrors.nombres && (
                <span className="mt-1 block text-xs text-red-500">{studentErrors.nombres.message}</span>
              )}
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Apellidos
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                {...registerStudent('apellidos')}
              />
              {studentErrors.apellidos && (
                <span className="mt-1 block text-xs text-red-500">{studentErrors.apellidos.message}</span>
              )}
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Documento de identidad
            <input
              type="text"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
              {...registerStudent('documento_identidad')}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Fecha de nacimiento
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/70"
                {...registerStudent('fecha_nacimiento')}
              />
              {studentErrors.fecha_nacimiento && (
                <span className="mt-1 block text-xs text-red-500">{studentErrors.fecha_nacimiento.message}</span>
              )}
            </label>
            <Controller
              name="genero"
              control={controlStudent}
              render={({ field }) => (
                <Select
                  label="Sexo"
                  options={GENDER_OPTIONS}
                  value={field.value || ''}
                  onChange={(value) => field.onChange(value ?? '')}
                  placeholder="Selecciona una opción"
                />
              )}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(studentActive)}
              onChange={(event) => setStudentValue('activo', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
            />
            Estudiante activo en la institución
          </label>
        </form>
      </Modal>
    </>
   
  );
};

RepresentativeInstitutionStudents.displayName = 'RepresentativeInstitutionStudents';

