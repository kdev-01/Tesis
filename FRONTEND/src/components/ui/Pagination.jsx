import React from 'react';
import { Button } from './Button.jsx';

export const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Página anterior"
      >
        Anterior
      </Button>
      <span className="rounded-full bg-slate-900/10 px-4 py-2 text-sm font-semibold dark:bg-white/10">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Página siguiente"
      >
        Siguiente
      </Button>
    </div>
  );
};
