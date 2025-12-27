import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { eventService } from '../../services/dataService.js';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useLiveAnnouncer } from '../../hooks/useLiveAnnouncer.js';
import { Button } from '../../components/ui/Button.jsx';

const PAGE_SIZE = 6;

export const Events = () => {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { announce } = useLiveAnnouncer();

  const filteredEvents = useMemo(() => {
    if (!search) return events;
    return events.filter((event) => event.name?.toLowerCase().includes(search.toLowerCase()));
  }, [events, search]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    eventService
      .listEvents({ page, pageSize: PAGE_SIZE, search })
      .then((data) => {
        if (!isMounted) return;
        setEvents(data);
        announce(`Se cargaron ${data.length} eventos`);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [announce, page, search]);

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="section-title">Eventos deportivos</h1>
        <div className="flex w-full max-w-sm items-center gap-3">
          <SearchInput value={search} onChange={(value) => setSearch(value)} placeholder="Buscar eventos" />
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-red-100 p-4 text-sm text-red-700">{error}</p>}
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-700/60" />
            ))
          : filteredEvents.map((event, index) => (
              <motion.article
                key={event.id ?? index}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/60"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                <div className="relative h-44 overflow-hidden">
                  <motion.img
                    src="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80"
                    alt={event.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <Badge className="absolute left-4 top-4 bg-white/80 text-primary-600">{event.sport?.name ?? 'Multideporte'}</Badge>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{event.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{event.description ?? 'Próximo evento con atletas destacados.'}</p>
                  <div className="mt-auto flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{new Date(event.start_date ?? Date.now()).toLocaleDateString()}</span>
                    <span>{event.location?.name ?? 'Por confirmar'}</span>
                  </div>
                </div>
              </motion.article>
            ))}
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))} onPageChange={setPage} />
      {!loading && filteredEvents.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl bg-slate-100 p-10 text-center dark:bg-slate-800/60">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">No encontramos eventos con ese criterio.</p>
          <Button variant="outline" onClick={() => setSearch('')}>
            Limpiar búsqueda
          </Button>
        </div>
      )}
    </section>
  );
};
