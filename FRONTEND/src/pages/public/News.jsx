import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { newsService } from '../../services/dataService.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';

export const News = () => {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    categoria: 'todas',
    tags: [],
    destacado: 'todas',
    orderBy: 'fecha_publicacion',
  });
  const [meta, setMeta] = useState(null);
  const [options, setOptions] = useState({ categories: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categoryOptions = useMemo(() => {
    const base = [{ value: 'todas', label: 'Todas las categorías' }];
    return base.concat((options.categories ?? []).map((category) => ({ value: category, label: category })));
  }, [options.categories]);

  const tagOptions = useMemo(
    () => (options.tags ?? []).map((tag) => ({ value: tag, label: tag })),
    [options.tags],
  );

  const featuredOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas las noticias' },
      { value: 'destacadas', label: 'Solo destacadas' },
      { value: 'regulares', label: 'Noticias recientes' },
    ],
    [],
  );

  const orderOptions = useMemo(
    () => [
      { value: 'fecha_publicacion', label: 'Más recientes' },
      { value: 'orden', label: 'Orden personalizado' },
      { value: 'creado_en', label: 'Fecha de creación' },
    ],
    [],
  );

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await newsService.list({
        page: 1,
        pageSize: 9,
        search: filters.search,
        categoria: filters.categoria !== 'todas' ? filters.categoria : undefined,
        destacado:
          filters.destacado === 'destacadas'
            ? true
            : filters.destacado === 'regulares'
            ? false
            : undefined,
        tags: filters.tags,
        orderBy: filters.orderBy,
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

  const clearFilters = () => {
    setFilters({ search: '', categoria: 'todas', tags: [], destacado: 'todas', orderBy: 'fecha_publicacion' });
  };

  const hasResults = items.length > 0;

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="section-title">Noticias y comunicados</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Cobertura oficial, comunicados de última hora y resúmenes post-evento.
          </p>
        </div>
        <div className="w-full max-w-md">
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            placeholder="Buscar noticias"
          />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Categoría"
          options={categoryOptions}
          value={filters.categoria}
          onChange={(value) => setFilters((prev) => ({ ...prev, categoria: value ?? 'todas' }))}
        />
        <Select
          label="Etiquetas"
          options={tagOptions}
          multiple
          searchable
          value={filters.tags}
          onChange={(value) => setFilters((prev) => ({ ...prev, tags: Array.isArray(value) ? value : [] }))}
          placeholder="Selecciona etiquetas"
        />
        <Select
          label="Destacados"
          options={featuredOptions}
          value={filters.destacado}
          onChange={(value) => setFilters((prev) => ({ ...prev, destacado: value ?? 'todas' }))}
        />
        <Select
          label="Orden"
          options={orderOptions}
          value={filters.orderBy}
          onChange={(value) => setFilters((prev) => ({ ...prev, orderBy: value ?? 'fecha_publicacion' }))}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Restablecer filtros
        </Button>
        {meta?.total !== undefined && (
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {meta.total} resultados disponibles
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <motion.article
            key={item.id ?? `${item.slug ?? 'news'}-${index}`}
            className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900/60"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {item.destacado ? <Badge color="accent">Destacada</Badge> : <Badge color="neutral">Actualidad</Badge>}
                {item.categoria && <Badge color="primary">{item.categoria}</Badge>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.titulo}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {item.resumen ?? `${item.contenido?.slice(0, 180) ?? ''}${item.contenido && item.contenido.length > 180 ? '…' : ''}`}
              </p>
              {Array.isArray(item.etiquetas) && item.etiquetas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.etiquetas.slice(0, 4).map((tag) => (
                    <Badge key={`${item.id ?? item.slug}-${tag}`} color="neutral" className="!uppercase tracking-normal">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
              {item.fecha_publicacion
                ? `Publicado el ${new Date(item.fecha_publicacion).toLocaleDateString()}`
                : 'Fecha de publicación por confirmar'}
            </p>
          </motion.article>
        ))}
      </div>
      {loading && <p className="mt-10 text-center text-sm text-slate-500">Cargando noticias…</p>}
      {!loading && !hasResults && (
        <p className="mt-10 text-center text-sm text-slate-500">Sin resultados. Ajusta tus filtros.</p>
      )}
      {error && (
        <p className="mt-6 text-center text-sm text-red-500">
          Ocurrió un problema al cargar las noticias. Intenta nuevamente más tarde.
        </p>
      )}
    </section>
  );
};
