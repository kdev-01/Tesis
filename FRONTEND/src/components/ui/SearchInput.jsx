import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export const SearchInput = ({ value, onChange, placeholder = 'Buscar…', label = 'Buscar' }) => (
  <label className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
    <span className="sr-only">{label}</span>
    <MagnifyingGlassIcon className="h-5 w-5 text-primary-500" aria-hidden />
    <input
      className="w-full bg-transparent text-sm focus:outline-none"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);
