import React, { useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button.jsx';
import { Spinner } from '../ui/Spinner.jsx';

const visibilityClasses = {
  md: {
    table: 'hidden md:block',
    cards: 'grid gap-4 md:hidden',
  },
  lg: {
    table: 'hidden lg:block',
    cards: 'grid gap-4 lg:hidden',
  },
  sm: {
    table: 'hidden sm:block',
    cards: 'grid gap-4 sm:hidden',
  },
};

const normalizeOptions = (options, defaultValue) => {
  const unique = new Set([defaultValue, ...(options ?? [])]);
  return Array.from(unique)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
};

const renderCellValue = (column, row) => {
  const rawValue = row?.[column.accessor];
  return typeof column.Cell === 'function' ? column.Cell({ value: rawValue, row }) : rawValue;
};

export const DataTable = ({
  columns,
  data,
  emptyMessage = 'Sin registros',
  renderActions,
  pageSizeOptions = [5, 10, 20],
  defaultPageSize = 10,
  responsiveBreakpoint = 'md',
  loading = false,
  loadingRows = 6,
}) => {
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const options = useMemo(() => normalizeOptions(pageSizeOptions, defaultPageSize), [pageSizeOptions, defaultPageSize]);
  const initialPageSize = useMemo(
    () => (options.includes(Number(defaultPageSize)) ? Number(defaultPageSize) : options[0] ?? 10),
    [options, defaultPageSize],
  );
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const selectId = useId();

  useEffect(() => {
    setPageSize((current) => (options.includes(current) ? current : initialPageSize));
  }, [options, initialPageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(safeData.length / pageSize)), [safeData.length, pageSize]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, safeData.length]);

  const startIndex = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize]);
  const paginatedData = useMemo(
    () => safeData.slice(startIndex, startIndex + pageSize),
    [safeData, startIndex, pageSize],
  );

  const tableVisibility = visibilityClasses[responsiveBreakpoint] ?? visibilityClasses.md;
  const hasData = safeData.length > 0;
  const showLoadingState = loading && !hasData;
  const showEmptyState = !loading && paginatedData.length === 0;

  const goToPage = (page) => {
    setCurrentPage((prev) => {
      if (page < 1) return 1;
      if (page > totalPages) return totalPages;
      return page;
    });
  };

  const fromItem = safeData.length === 0 ? 0 : startIndex + 1;
  const toItem = Math.min(startIndex + paginatedData.length, safeData.length);
  const skeletonRows = useMemo(() => Array.from({ length: loadingRows }, (_, index) => index), [loadingRows]);
  const skeletonWidthClasses = useMemo(
    () => ['max-w-[160px]', 'max-w-[120px]', 'max-w-[200px]', 'max-w-[100px]', 'max-w-[180px]', 'max-w-[140px]'],
    [],
  );

  const showOverlaySpinner = Boolean(loading);

  return (
    <div
      className="relative space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/40"
      aria-busy={loading}
    >
      {showOverlaySpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/70">
          <Spinner label="Cargando datos…" />
        </div>
      )}
      <div className={clsx('overflow-x-auto', tableVisibility.table)}>
        <motion.table className="min-w-full table-auto divide-y divide-slate-200 dark:divide-slate-700" layout>
          <thead className="bg-slate-50/80 backdrop-blur dark:bg-slate-800/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.accessor}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300',
                    column.className,
                  )}
                >
                  {column.Header}
                </th>
              ))}
              {renderActions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/80 dark:divide-slate-700 dark:bg-slate-900/40">
            {showLoadingState ? (
              skeletonRows.map((rowIndex) => (
                <tr key={`loading-row-${rowIndex}`} className="opacity-80">
                  {columns.map((column, columnIndex) => (
                    <td
                      key={`${column.accessor}-loading-${rowIndex}`}
                      className={clsx(
                        'px-4 py-4 align-middle text-sm text-slate-700 dark:text-slate-200',
                        column.cellClassName,
                      )}
                    >
                      <div
                        className={clsx(
                          'h-3 w-full animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/60',
                          skeletonWidthClasses[(columnIndex + rowIndex) % skeletonWidthClasses.length],
                        )}
                      />
                    </td>
                  ))}
                  {renderActions && (
                    <td className="px-4 py-4 text-right align-middle">
                      <div className="ml-auto h-3 w-16 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/60" />
                    </td>
                  )}
                </tr>
              ))
            ) : showEmptyState ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-4 py-6 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <motion.tr key={row.id ?? JSON.stringify(row)} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {columns.map((column) => (
                    <td
                      key={column.accessor}
                      className={clsx(
                        'px-4 py-4 align-middle text-sm text-slate-700 dark:text-slate-200',
                        column.cellClassName,
                      )}
                    >
                      {renderCellValue(column, row)}
                    </td>
                  ))}
                  {renderActions && <td className="px-4 py-4 text-right align-middle">{renderActions(row)}</td>}
                </motion.tr>
              ))
            )}
          </tbody>
        </motion.table>
      </div>

      <div className={tableVisibility.cards}>
        {showLoadingState ? (
          skeletonRows.map((rowIndex) => (
            <div
              key={`loading-card-${rowIndex}`}
              className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="space-y-3">
                {columns.map((column, columnIndex) => (
                  <div
                    key={`${column.accessor}-card-skeleton-${rowIndex}`}
                    className="flex flex-col rounded-2xl bg-slate-50/80 p-3 dark:bg-slate-800/50"
                  >
                    <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/60" />
                    <div
                      className={clsx(
                        'mt-3 h-3 w-full animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/60',
                        skeletonWidthClasses[(columnIndex + rowIndex) % skeletonWidthClasses.length],
                      )}
                    />
                  </div>
                ))}
              </div>
              {renderActions && (
                <div className="mt-4 flex justify-end">
                  <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/60" />
                </div>
              )}
            </div>
          ))
        ) : showEmptyState ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            {emptyMessage}
          </p>
        ) : (
          <AnimatePresence>
            {paginatedData.map((row) => (
              <motion.article
                key={row.id ?? JSON.stringify(row)}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <dl className="grid gap-3">
                  {columns.map((column) => (
                    <div key={column.accessor} className="flex flex-col rounded-2xl bg-slate-50/80 p-3 dark:bg-slate-800/50">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {column.Header}
                      </dt>
                      <dd className="mt-2 text-sm text-slate-700 dark:text-slate-100">{renderCellValue(column, row)}</dd>
                    </div>
                  ))}
                </dl>
                {renderActions && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {renderActions(row)}
                  </div>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-xs uppercase tracking-wide text-slate-400">
            Filas por página
          </label>
          <select
            id={selectId}
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <p>
            Mostrando <span className="font-semibold text-primary-600 dark:text-primary-300">{fromItem}</span> -{' '}
            <span className="font-semibold text-primary-600 dark:text-primary-300">{toItem}</span> de{' '}
            <span className="font-semibold text-primary-600 dark:text-primary-300">{safeData.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || showLoadingState}
            >
              Anterior
            </Button>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Página {currentPage} de {totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || showLoadingState}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
