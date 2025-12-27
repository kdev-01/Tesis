import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader, CardFooter } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { settingsService } from '../../services/settingsService.js';
import { useToast } from '../../hooks/useToast.js';
import { useAppConfig } from '../../context/AppConfigContext.jsx';

const configSchema = z.object({
  branding_name: z
    .string()
    .min(3, 'Ingresa un nombre para la plataforma')
    .max(80, 'El nombre es demasiado largo'),
  support_email: z.string().email('Correo inválido'),
  maintenance_mode: z.boolean(),
});

const sportSchema = z.object({
  nombre: z.string().min(3, 'Ingresa el nombre del deporte').max(80, 'El nombre es demasiado largo'),
  activo: z.boolean(),
});

const ageFieldSchema = z
  .string()
  .trim()
  .transform((value) => {
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  })
  .refine((value) => value === null || (!Number.isNaN(value) && value >= 0 && value <= 120), {
    message: 'Ingresa una edad entre 0 y 120 años',
  });

const categorySchema = z
  .object({
    deporte_id: z.string().min(1, 'Selecciona el deporte al que pertenece la categoría'),
    nombre: z.string().min(3, 'Ingresa el nombre de la categoría').max(80, 'El nombre es demasiado largo'),
    edad_minima: ageFieldSchema,
    edad_maxima: ageFieldSchema,
    activo: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (
      data.edad_minima !== null &&
      data.edad_maxima !== null &&
      data.edad_minima > data.edad_maxima
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edad_maxima'],
        message: 'La edad máxima debe ser mayor o igual a la edad mínima',
      });
    }
  });

const describeAgeRange = (minimum, maximum) => {
  if (minimum == null && maximum == null) {
    return 'Sin límites de edad configurados';
  }
  if (minimum != null && maximum != null) {
    return `De ${minimum} a ${maximum} años`;
  }
  if (minimum != null) {
    return `Desde ${minimum} años`;
  }
  return `Hasta ${maximum} años`;
};

export const Settings = () => {
  const { addToast } = useToast();
  const { config, refresh } = useAppConfig();

  const {
    register,
    control,
    handleSubmit: handleSubmitConfig,
    reset,
    formState: { errors, isSubmitting: isSavingConfig },
  } = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: {
      branding_name: config?.branding_name ?? '',
      support_email: config?.support_email ?? '',
      maintenance_mode: config?.maintenance_mode ?? false,
    },
  });

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [sportModalOpen, setSportModalOpen] = useState(false);
  const [sportModalMode, setSportModalMode] = useState('create');
  const [selectedSport, setSelectedSport] = useState(null);

  const {
    register: registerSport,
    control: sportControl,
    handleSubmit: handleSubmitSport,
    reset: resetSport,
    formState: { errors: sportErrors, isSubmitting: isSavingSport },
  } = useForm({
    resolver: zodResolver(sportSchema),
    defaultValues: { nombre: '', activo: true },
  });

  const [selectedSportId, setSelectedSportId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState('create');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const {
    register: registerCategory,
    control: categoryControl,
    handleSubmit: handleSubmitCategory,
    reset: resetCategory,
    formState: { errors: categoryErrors, isSubmitting: isSavingCategory },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      deporte_id: '',
      nombre: '',
      edad_minima: '',
      edad_maxima: '',
      activo: true,
    },
  });

  useEffect(() => {
    if (config) {
      reset({
        branding_name: config.branding_name ?? '',
        support_email: config.support_email ?? '',
        maintenance_mode: Boolean(config.maintenance_mode),
      });
      return;
    }
    settingsService
      .getSettings()
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          reset({
            branding_name: data.branding_name ?? '',
            support_email: data.support_email ?? '',
            maintenance_mode: Boolean(data.maintenance_mode),
          });
        }
      })
      .catch(() => {
        addToast({ title: 'No se pudieron cargar los ajustes', status: 'error' });
      });
  }, [addToast, config, reset]);

  const fetchSports = useCallback(async () => {
    setLoadingSports(true);
    try {
      const response = await settingsService.listSports();
      const catalog = Array.isArray(response) ? response : [];
      setSports(catalog);
      setSelectedSportId((current) => {
        if (current && catalog.some((sport) => sport.id === current)) {
          return current;
        }
        if (catalog.length > 0) {
          return catalog[0].id;
        }
        return null;
      });
    } catch (error) {
      setSports([]);
      setSelectedSportId(null);
      addToast({
        title: 'No se pudieron cargar los deportes',
        description: error.message,
        status: 'error',
      });
    } finally {
      setLoadingSports(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSports();
  }, [fetchSports]);

  const fetchCategories = useCallback(
    async (sportId) => {
      if (!sportId) {
        setCategories([]);
        return;
      }
      setLoadingCategories(true);
      try {
        const response = await settingsService.listCategories({ sportId });
        setCategories(Array.isArray(response) ? response : []);
      } catch (error) {
        setCategories([]);
        addToast({
          title: 'No se pudieron cargar las categorías',
          description: error.message,
          status: 'error',
        });
      } finally {
        setLoadingCategories(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    if (selectedSportId) {
      fetchCategories(selectedSportId);
    } else {
      setCategories([]);
    }
  }, [selectedSportId, fetchCategories]);

  const closeSportModal = useCallback(() => {
    setSportModalOpen(false);
    setSelectedSport(null);
    resetSport({ nombre: '', activo: true });
  }, [resetSport]);

  const openCreateSportModal = useCallback(() => {
    setSportModalMode('create');
    setSelectedSport(null);
    resetSport({ nombre: '', activo: true });
    setSportModalOpen(true);
  }, [resetSport]);

  const openEditSportModal = useCallback(
    (sport) => {
      setSportModalMode('edit');
      setSelectedSport(sport);
      resetSport({ nombre: sport.nombre ?? '', activo: Boolean(sport.activo) });
      setSportModalOpen(true);
    },
    [resetSport],
  );

  const saveSport = handleSubmitSport(async (formData) => {
    const payload = {
      nombre: formData.nombre.trim(),
      activo: Boolean(formData.activo),
    };
    try {
      if (sportModalMode === 'edit' && selectedSport) {
        await settingsService.updateSport(selectedSport.id, payload);
        addToast({ title: 'Deporte actualizado', status: 'success' });
      } else {
        await settingsService.createSport(payload);
        addToast({ title: 'Deporte creado', status: 'success' });
      }
      closeSportModal();
      await fetchSports();
    } catch (error) {
      addToast({
        title: 'No se pudo guardar el deporte',
        description: error.message,
        status: 'error',
      });
    }
  });

  const closeCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
    setSelectedCategory(null);
    resetCategory({
      deporte_id: selectedSportId ? String(selectedSportId) : '',
      nombre: '',
      edad_minima: '',
      edad_maxima: '',
      activo: true,
    });
  }, [resetCategory, selectedSportId]);

  const openCreateCategoryModal = useCallback(() => {
    if (!selectedSportId) {
      addToast({
        title: 'Selecciona un deporte antes de crear categorías',
        status: 'warning',
      });
      return;
    }
    setCategoryModalMode('create');
    setSelectedCategory(null);
    resetCategory({
      deporte_id: String(selectedSportId),
      nombre: '',
      edad_minima: '',
      edad_maxima: '',
      activo: true,
    });
    setCategoryModalOpen(true);
  }, [addToast, resetCategory, selectedSportId]);

  const openEditCategoryModal = useCallback(
    (category) => {
      setCategoryModalMode('edit');
      setSelectedCategory(category);
      resetCategory({
        deporte_id: String(category.deporte_id ?? ''),
        nombre: category.nombre ?? '',
        edad_minima: category.edad_minima != null ? String(category.edad_minima) : '',
        edad_maxima: category.edad_maxima != null ? String(category.edad_maxima) : '',
        activo: Boolean(category.activo),
      });
      setCategoryModalOpen(true);
    },
    [resetCategory],
  );

  const saveCategory = handleSubmitCategory(async (formData) => {
    const sportId = Number(formData.deporte_id);
    const payload = {
      nombre: formData.nombre.trim(),
      edad_minima: formData.edad_minima,
      edad_maxima: formData.edad_maxima,
      activo: Boolean(formData.activo),
    };
    try {
      if (categoryModalMode === 'edit' && selectedCategory) {
        await settingsService.updateCategory(selectedCategory.id, payload);
        addToast({ title: 'Categoría actualizada', status: 'success' });
      } else {
        await settingsService.createCategory({ ...payload, deporte_id: sportId });
        addToast({ title: 'Categoría creada', status: 'success' });
      }
      closeCategoryModal();
      await fetchCategories(sportId);
      setSelectedSportId((current) => current ?? sportId);
    } catch (error) {
      addToast({
        title: 'No se pudo guardar la categoría',
        description: error.message,
        status: 'error',
      });
    }
  });

  const configSubmit = handleSubmitConfig(async (formData) => {
    try {
      const payload = {
        branding_name: formData.branding_name.trim(),
        support_email: formData.support_email.trim(),
        maintenance_mode: Boolean(formData.maintenance_mode),
      };
      const updated = await settingsService.updateSettings(payload);
      await refresh();
      reset({
        branding_name: updated?.branding_name ?? payload.branding_name,
        support_email: updated?.support_email ?? payload.support_email,
        maintenance_mode: Boolean(updated?.maintenance_mode ?? payload.maintenance_mode),
      });
      addToast({ title: 'Parámetros actualizados', status: 'success' });
    } catch (error) {
      addToast({ title: 'No se pudo guardar', description: error.message, status: 'error' });
    }
  });

  const sportOptions = useMemo(
    () => sports.map((sport) => ({ value: String(sport.id), label: sport.nombre })),
    [sports],
  );

  const selectedSportData = useMemo(
    () => sports.find((sport) => sport.id === selectedSportId) ?? null,
    [sports, selectedSportId],
  );

  return (
    <div className="space-y-10">
      <Card as="form" onSubmit={configSubmit}>
        <CardHeader
          title="Ajustes"
          description="Personaliza la identidad de la plataforma y habilita el modo de mantenimiento cuando sea necesario."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Nombre visible de la plataforma
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('branding_name')}
            />
            {errors.branding_name && (
              <span className="mt-1 block text-xs text-red-500">{errors.branding_name.message}</span>
            )}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Correo de soporte
            <input
              type="email"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...register('support_email')}
            />
            {errors.support_email && (
              <span className="mt-1 block text-xs text-red-500">{errors.support_email.message}</span>
            )}
          </label>
          <Controller
            name="maintenance_mode"
            control={control}
            render={({ field }) => (
              <label className="md:col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <div>
                  <p className="font-semibold">Modo mantenimiento</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Bloquea el portal público y muestra un aviso temporal mientras realizas cambios críticos.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </label>
            )}
          />
        </div>
        <CardFooter>
          <Button type="submit" disabled={isSavingConfig}>
            {isSavingConfig ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Catálogo de deportes"
          description="Administra los deportes disponibles para los eventos y asignaciones de usuarios."
          actions={
            <Button variant="primary" size="sm" onClick={openCreateSportModal}>
              <PlusIcon className="h-4 w-4" />
              Nuevo deporte
            </Button>
          }
        />
        {loadingSports ? (
          <div className="flex justify-center py-10">
            <Spinner label="Cargando deportes…" />
          </div>
        ) : sports.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay deportes registrados todavía. Crea el primero para comenzar.
          </p>
        ) : (
          <ul className="space-y-3">
            {sports.map((sport) => (
              <li
                key={sport.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
              >
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-100">{sport.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sport.activo
                      ? 'Disponible para eventos y asignaciones.'
                      : 'Inactivo: no aparecerá en los formularios públicos.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={sport.activo ? 'success' : 'danger'}>
                    {sport.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => openEditSportModal(sport)}>
                    <PencilSquareIcon className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Categorías deportivas"
          description="Configura los rangos de edad y la disponibilidad de las categorías por deporte."
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateCategoryModal}
              disabled={!selectedSportId || sports.length === 0}
            >
              <PlusIcon className="h-4 w-4" />
              Nueva categoría
            </Button>
          }
        />
        {sports.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Agrega al menos un deporte para gestionar sus categorías.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-200 sm:flex-row sm:items-center">
              <span>Deporte</span>
              <select
                value={selectedSportId ? String(selectedSportId) : ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedSportId(value ? Number(value) : null);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800 sm:w-64"
              >
                <option value="">Selecciona un deporte</option>
                {sportOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedSportId == null ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecciona un deporte para ver y editar sus categorías.
              </p>
            ) : loadingCategories ? (
              <div className="flex justify-center py-8">
                <Spinner label="Cargando categorías…" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No hay categorías registradas para {selectedSportData?.nombre ?? 'este deporte'}.
              </p>
            ) : (
              <ul className="space-y-3">
                {categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/60"
                  >
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-100">{category.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {describeAgeRange(category.edad_minima, category.edad_maxima)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge color={category.activo ? 'success' : 'danger'}>
                        {category.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEditCategoryModal(category)}>
                        <PencilSquareIcon className="h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Modal
        isOpen={sportModalOpen}
        onClose={closeSportModal}
        title={sportModalMode === 'edit' ? 'Editar deporte' : 'Nuevo deporte'}
        confirmLabel={sportModalMode === 'edit' ? 'Actualizar' : 'Crear'}
        confirmDisabled={isSavingSport}
        confirmLoading={isSavingSport}
        onConfirm={saveSport}
      >
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Nombre del deporte
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerSport('nombre')}
            />
            {sportErrors.nombre && (
              <span className="mt-1 block text-xs text-red-500">{sportErrors.nombre.message}</span>
            )}
          </label>
          <Controller
            name="activo"
            control={sportControl}
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <div>
                  <p className="font-semibold">Disponible</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Controla si el deporte puede seleccionarse en los formularios del sistema.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </label>
            )}
          />
        </div>
      </Modal>

      <Modal
        isOpen={categoryModalOpen}
        onClose={closeCategoryModal}
        title={categoryModalMode === 'edit' ? 'Editar categoría' : 'Nueva categoría'}
        confirmLabel={categoryModalMode === 'edit' ? 'Actualizar' : 'Crear'}
        confirmDisabled={isSavingCategory}
        confirmLoading={isSavingCategory}
        onConfirm={saveCategory}
      >
        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Deporte
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerCategory('deporte_id')}
              disabled={categoryModalMode === 'edit'}
            >
              <option value="">Selecciona un deporte</option>
              {sportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {categoryErrors.deporte_id && (
              <span className="mt-1 block text-xs text-red-500">{categoryErrors.deporte_id.message}</span>
            )}
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
            Nombre de la categoría
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
              {...registerCategory('nombre')}
            />
            {categoryErrors.nombre && (
              <span className="mt-1 block text-xs text-red-500">{categoryErrors.nombre.message}</span>
            )}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
              Edad mínima sugerida
              <input
                type="number"
                min="0"
                max="120"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...registerCategory('edad_minima')}
              />
              {categoryErrors.edad_minima && (
                <span className="mt-1 block text-xs text-red-500">{categoryErrors.edad_minima.message}</span>
              )}
            </label>
            <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
              Edad máxima sugerida
              <input
                type="number"
                min="0"
                max="120"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
                {...registerCategory('edad_maxima')}
              />
              {categoryErrors.edad_maxima && (
                <span className="mt-1 block text-xs text-red-500">{categoryErrors.edad_maxima.message}</span>
              )}
            </label>
          </div>
          <Controller
            name="activo"
            control={categoryControl}
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <div>
                  <p className="font-semibold">Disponible</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Determina si la categoría estará disponible al crear o editar eventos.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              </label>
            )}
          />
        </div>
      </Modal>
    </div>
  );
};
