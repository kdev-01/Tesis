import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MegaphoneIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { useToast } from '../../hooks/useToast.js';
import { newsService } from '../../services/dataService.js';
import { resolveMediaUrl } from '../../utils/media.js';

const NEWS_STATES = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'programado', label: 'Programado' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'archivado', label: 'Archivado' },
];

const NEWS_SCHEMA = z.object({
  titulo: z
    .string({ required_error: 'Ingresa un titular' })
    .min(3, 'El titular debe tener al menos 3 caracteres')
    .trim(),
  resumen: z
    .string()
    .max(500, 'El resumen debe tener máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  contenido: z
    .string({ required_error: 'Describe el contenido de la noticia' })
    .min(10, 'Describe el contenido de la noticia'),
  categoria: z.string().optional().or(z.literal('')),
  etiquetas: z.string().optional().or(z.literal('')),
  destacado: z.boolean().default(false),
  estado: z.enum(['borrador', 'programado', 'publicado', 'archivado']),
  fecha_publicacion: z.string().optional().or(z.literal('')),
  slug: z.string().optional().or(z.literal('')),
  orden: z.string().optional().or(z.literal('')),
});

const DEFAULT_FORM_VALUES = {
  titulo: '',
  resumen: '',
  contenido: '',
  categoria: '',
  etiquetas: '',
  destacado: false,
  estado: 'borrador',
  fecha_publicacion: '',
  slug: '',
  orden: '',
};

const PAGE_SIZE = 12;

const ADMIN_NEWS_ORDER = {
  orderBy: 'fecha_publicacion',
  order: 'desc',
};

const STATUS_LABELS = {
  borrador: 'Borrador',
  programado: 'Programado',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const STATUS_COLOR = {
  borrador: 'neutral',
  programado: 'accent',
  publicado: 'primary',
  archivado: 'neutral',
};

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const AdminNews = () => {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [options, setOptions] = useState({ categories: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    estado: 'todos',
    categoria: 'todas',
    page: 1,
  });
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentNews, setCurrentNews] = useState(null);
  const [isSaving, setSaving] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [newsToDelete, setNewsToDelete] = useState(null);
  const [isDeleting, setDeleting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [removeCover, setRemoveCover] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(NEWS_SCHEMA),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const releaseCoverPreview = useCallback(() => {
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
  }, [coverPreview]);

  const categoryOptions = useMemo(() => {
    const base = [{ value: 'todas', label: 'Todas las categorías' }];
    return base.concat(
      (options.categories ?? []).map((category) => ({
        value: category,
        label: category,
      })),
    );
  }, [options.categories]);

  const updateFilters = useCallback((patch, { resetPage = true } = {}) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page !== undefined ? patch.page : resetPage ? 1 : prev.page,
    }));
  }, []);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await newsService.listAdmin({
        page: filters.page,
        pageSize: PAGE_SIZE,
        search: filters.search,
        estados: filters.estado !== 'todos' ? [filters.estado] : undefined,
        categoria:
          filters.categoria !== 'todas' ? filters.categoria : undefined,
        orderBy: ADMIN_NEWS_ORDER.orderBy,
        order: ADMIN_NEWS_ORDER.order,
      });
      setItems(Array.isArray(response.data) ? response.data : []);
      setMeta(response.meta ?? null);
      setOptions({
        categories: response.meta?.extra?.categories ?? [],
        tags: response.meta?.extra?.tags ?? [],
      });
    } catch (requestError) {
      setItems([]);
      setMeta(null);
      setOptions({ categories: [], tags: [] });
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(
    () => () => {
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
    },
    [coverPreview],
  );

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentNews(null);
    reset(DEFAULT_FORM_VALUES);
    releaseCoverPreview();
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
    setModalOpen(true);
  };

  const openEditModal = (news) => {
    setModalMode('edit');
    setCurrentNews(news);
    releaseCoverPreview();
    reset({
      titulo: news.titulo ?? '',
      resumen: news.resumen ?? '',
      contenido: news.contenido ?? '',
      categoria: news.categoria ?? '',
      etiquetas: (news.etiquetas ?? []).join(', '),
      destacado: Boolean(news.destacado),
      estado: news.estado ?? 'borrador',
      fecha_publicacion: formatDateTimeLocal(news.fecha_publicacion),
      slug: news.slug ?? '',
      orden:
        news.orden !== null && news.orden !== undefined
          ? String(news.orden)
          : '',
    });
    setCoverFile(null);
    setCoverPreview(
      news.imagen_portada_url ? resolveMediaUrl(news.imagen_portada_url) : '',
    );
    setRemoveCover(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentNews(null);
    reset(DEFAULT_FORM_VALUES);
    releaseCoverPreview();
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(false);
  };

  const handleCoverSelect = (file) => {
    releaseCoverPreview();
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
    releaseCoverPreview();
    setCoverFile(null);
    setCoverPreview('');
    setRemoveCover(true);
  };

  const handleSave = handleSubmit(async (values) => {
    setSaving(true);
    const metadata = {
      titulo: values.titulo.trim(),
      resumen: values.resumen?.trim() || null,
      contenido: values.contenido.trim(),
      categoria: values.categoria?.trim() || null,
      etiquetas: values.etiquetas
        ? values.etiquetas
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      destacado: values.destacado,
      estado: values.estado,
      fecha_publicacion: toIsoDate(values.fecha_publicacion),
      slug: values.slug?.trim() || undefined,
      orden: values.orden ? Number(values.orden) : undefined,
    };

    try {
      const submission = {
        metadata,
        coverImage: coverFile,
        removeCover: removeCover && !coverFile,
      };

      if (modalMode === 'create') {
        await newsService.create(submission);
        addToast({
          title: 'Noticia creada',
          description: 'El comunicado quedó guardado correctamente.',
        });
      } else if (currentNews) {
        await newsService.update(currentNews.id, submission);
        addToast({
          title: 'Noticia actualizada',
          description: 'Los cambios fueron guardados.',
        });
      }
      closeModal();
      fetchNews();
    } catch (saveError) {
      addToast({
        title: 'No se pudo guardar',
        description:
          saveError?.message ?? 'Revisa la información e inténtalo nuevamente.',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  });

  const openDeleteModal = (news) => {
    setNewsToDelete(news);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setNewsToDelete(null);
  };

  const handleDelete = async () => {
    if (!newsToDelete) return;
    setDeleting(true);
    try {
      await newsService.remove(newsToDelete.id);
      addToast({
        title: 'Noticia eliminada',
        description: 'El comunicado se archivó correctamente.',
      });
      closeDeleteModal();
      fetchNews();
    } catch (deleteError) {
      addToast({
        title: 'No se pudo eliminar',
        description:
          deleteError?.message ?? 'Intenta nuevamente en unos segundos.',
        variant: 'danger',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleStateChange = async (news, nextState) => {
    setProcessingId(news.id);
    try {
      await newsService.changeState(news.id, {
        estado: nextState,
        fecha_publicacion:
          nextState === 'publicado'
            ? new Date().toISOString()
            : news.fecha_publicacion,
      });
      addToast({
        title: 'Estado actualizado',
        description: `La noticia pasó a ${STATUS_LABELS[nextState]}.`,
      });
      fetchNews();
    } catch (stateError) {
      addToast({
        title: 'No se pudo actualizar',
        description:
          stateError?.message ?? 'Intenta nuevamente en unos instantes.',
        variant: 'danger',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      estado: 'todos',
      categoria: 'todas',
      page: 1,
    });
  };

  const totalPages = useMemo(() => {
    const total = meta?.total ?? 0;
    return total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  }, [meta]);

  return (
    <>
      <Card>
        <CardHeader
          title="Noticias"
          description="Gestiona comunicados oficiales, resúmenes post-evento y piezas destacadas para el portal público."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={clearFilters}>
            <ArrowPathIcon className="h-4 w-4" aria-hidden /> Limpiar filtros
          </Button>
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4" aria-hidden /> Nueva noticia
          </Button>
            </div>
          }
        />


        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex w-full flex-col gap-3">
            <div className="w-full md:max-w-md">
              <SearchInput
                value={filters.search}
                onChange={(value) => updateFilters({ search: value })}
                placeholder="Buscar por titular o contenido"
              />
            </div>
          </div>
        </div>

        {loading && (
          <p className="mt-8 text-sm text-slate-500">Cargando noticias…</p>
        )}
        {error && !loading && (
          <p className="mt-8 text-sm text-red-500">
            Ocurrió un problema al cargar la información. Intenta nuevamente.
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="mt-8 text-sm text-slate-500">
            No hay noticias registradas con los filtros aplicados.
          </p>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-8 grid gap-4">
            {items.map((news) => {
              const coverUrl = news.imagen_portada_url
                ? resolveMediaUrl(news.imagen_portada_url)
                : '';
              return (
                <article
                  key={news.id}
                  className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:border-primary-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-1 flex-col gap-4 md:flex-row md:gap-6">
                      {coverUrl && (
                        <div className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700">
                          <img
                            src={coverUrl}
                            alt={`Portada de ${news.titulo}`}
                            className="h-36 w-60 object-cover md:h-40"
                          />
                        </div>
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color={STATUS_COLOR[news.estado] ?? 'neutral'}>
                            {STATUS_LABELS[news.estado] ?? news.estado}
                          </Badge>
                          {news.destacado && (
                            <Badge color="accent">Destacada</Badge>
                          )}
                          {news.categoria && (
                            <Badge color="primary">{news.categoria}</Badge>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                          {news.titulo}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {news.resumen ??
                            `${news.contenido?.slice(0, 220) ?? ''}${
                              news.contenido && news.contenido.length > 220
                                ? '…'
                                : ''
                            }`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Creada el{' '}
                            {news.creado_en
                              ? new Date(news.creado_en).toLocaleString()
                              : 'sin registro'}
                          </span>
                          {news.fecha_publicacion && (
                            <span>
                              • Publicación{' '}
                              {new Date(
                                news.fecha_publicacion,
                              ).toLocaleString()}
                            </span>
                          )}
                          <span>• Orden {news.orden ?? 0}</span>
                        </div>
                        {Array.isArray(news.etiquetas) &&
                          news.etiquetas.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {news.etiquetas.map((tag) => (
                                <Badge
                                  key={`${news.id}-${tag}`}
                                  color="neutral"
                                  className="!uppercase tracking-normal"
                                >
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(news)}
                      >
                        <PencilSquareIcon className="h-4 w-4" aria-hidden />{' '}
                        Editar
                      </Button>
                      {news.estado !== 'publicado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStateChange(news, 'publicado')}
                          disabled={processingId === news.id}
                        >
                          <MegaphoneIcon className="h-4 w-4" aria-hidden />{' '}
                          Publicar
                        </Button>
                      )}
                      {news.estado !== 'borrador' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStateChange(news, 'borrador')}
                          disabled={processingId === news.id}
                        >
                          <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />{' '}
                          Borrador
                        </Button>
                      )}
                      {news.estado !== 'archivado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStateChange(news, 'archivado')}
                          disabled={processingId === news.id}
                        >
                          <ArchiveBoxIcon className="h-4 w-4" aria-hidden />{' '}
                          Archivar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(news)}
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

        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Página {filters.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateFilters(
                    { page: Math.max(1, filters.page - 1) },
                    { resetPage: false },
                  )
                }
                disabled={filters.page <= 1 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateFilters(
                    { page: Math.min(totalPages, filters.page + 1) },
                    { resetPage: false },
                  )
                }
                disabled={filters.page >= totalPages || loading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Nueva noticia' : 'Editar noticia'}
        description="Gestiona el contenido que se mostrará en el portal público de AGXport."
        onConfirm={handleSave}
        confirmLoading={isSaving}
        confirmLabel={modalMode === 'create' ? 'Crear' : 'Guardar cambios'}
        size="xl"
      >
        <div className="grid gap-4 px-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
              Titular
            </label>
            <input
              type="text"
              {...register('titulo')}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
            />
            {errors.titulo && (
              <p className="mt-1 text-xs text-red-500">
                {errors.titulo.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Resumen
              </label>
              <textarea
                rows={3}
                {...register('resumen')}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
              {errors.resumen && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.resumen.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Categoría
              </label>
              <input
                type="text"
                {...register('categoria')}
                placeholder="Ej. Comunicados, Eventos"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
              Contenido
            </label>
            <textarea
              rows={6}
              {...register('contenido')}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
            />
            {errors.contenido && (
              <p className="mt-1 text-xs text-red-500">
                {errors.contenido.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Etiquetas
              </label>
              <input
                type="text"
                {...register('etiquetas')}
                placeholder="Separadas por coma: evento, final"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Slug personalizado
              </label>
              <input
                type="text"
                {...register('slug')}
                placeholder="opcional-cobertura-final"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Estado
              </label>
              <select
                {...register('estado')}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              >
                {NEWS_STATES.filter((option) => option.value !== 'todos').map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </select>
              {errors.estado && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.estado.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Fecha publicación
              </label>
              <input
                type="datetime-local"
                {...register('fecha_publicacion')}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
              {errors.fecha_publicacion && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.fecha_publicacion.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-200">
                Orden
              </label>
              <input
                type="number"
                {...register('orden')}
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900/60"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="destacado"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                  />
                  Destacar en el portal público
                </label>
              )}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        title="Confirmar eliminación"
        description="La noticia dejará de mostrarse en el portal. Puedes volver a crearla más adelante si lo necesitas."
        onConfirm={handleDelete}
        confirmLoading={isDeleting}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Deseas eliminar la noticia «{newsToDelete?.titulo}»? Esta acción se
          puede revertir solo creando una nueva.
        </p>
      </Modal>
    </>
  );
};
