import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronUpDownIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const normalizeOptions = (options) =>
  (options ?? []).map((option) => ({
    value: option.value,
    label: option.label ?? String(option.value ?? ''),
    description: option.description,
    disabled: Boolean(option.disabled),
  }));

export const Select = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder = 'Selecciona una opción',
  helperText,
  error,
  options = [],
  multiple = false,
  searchable = false,
  searchPlaceholder = 'Buscar…',
  disabled = false,
  clearable = true,
  className,
  emptyMessage = 'Sin resultados',
}) => {
  const selectId = useId();
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

  const valueKeys = useMemo(() => {
    if (multiple) {
      return new Set((Array.isArray(value) ? value : []).map((item) => String(item ?? '')));
    }
    if (value === null || value === undefined || value === '') {
      return new Set();
    }
    return new Set([String(value)]);
  }, [multiple, value]);

  const selectedOptions = useMemo(
    () => normalizedOptions.filter((option) => valueKeys.has(String(option.value ?? ''))),
    [normalizedOptions, valueKeys],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) {
      return normalizedOptions;
    }
    const term = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter((option) => {
      const label = option.label?.toLowerCase?.() ?? '';
      const description = option.description?.toLowerCase?.() ?? '';
      return label.includes(term) || description.includes(term);
    });
  }, [normalizedOptions, searchTerm, searchable]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        onBlur?.(event);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen]);

  const toggleOption = (option) => {
    if (disabled || option.disabled) return;
    if (multiple) {
      const current = Array.isArray(value) ? [...value] : [];
      const optionKey = String(option.value ?? '');
      const exists = current.some((item) => String(item ?? '') === optionKey);
      const next = exists
        ? current.filter((item) => String(item ?? '') !== optionKey)
        : [...current, option.value];
      onChange?.(next);
    } else {
      const nextValue = valueKeys.has(String(option.value ?? '')) ? null : option.value;
      onChange?.(nextValue);
      setIsOpen(false);
    }
  };

  const clearSelection = (event) => {
    event.stopPropagation();
    if (disabled) return;
    onChange?.(multiple ? [] : null);
    setIsOpen(false);
  };

  const removeChip = (event, option) => {
    event.stopPropagation();
    if (disabled || !multiple) return;
    const next = (Array.isArray(value) ? value : []).filter(
      (item) => String(item ?? '') !== String(option.value ?? ''),
    );
    onChange?.(next);
  };

  const selectedLabel = !multiple && selectedOptions.length > 0 ? selectedOptions[0].label : '';

  return (
    <div className={clsx('space-y-2', className)} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-600 dark:text-slate-200">
          {label}
        </label>
      )}
      <div
        className={clsx(
          'relative rounded-2xl border bg-white/70 transition focus-within:ring-2 focus-within:ring-primary-200 dark:bg-slate-800',
          error ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700',
          disabled && 'opacity-60',
        )}
      >
        <button
          type="button"
          id={selectId}
          name={name}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-700 focus:outline-none dark:text-slate-200"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="min-w-0 flex-1">
            {multiple ? (
              selectedOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.map((option) => (
                    <span
                      key={String(option.value)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/20 dark:text-primary-100"
                    >
                      {option.label}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={(event) => removeChip(event, option)}
                          className="rounded-full p-0.5 text-primary-600 transition hover:bg-primary-200/60 focus:outline-none dark:text-primary-100 dark:hover:bg-primary-500/30"
                          aria-label={`Quitar ${option.label}`}
                        >
                          <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="block truncate text-slate-400">{placeholder}</span>
              )
            ) : selectedLabel ? (
              <span className="block truncate">{selectedLabel}</span>
            ) : (
              <span className="block truncate text-slate-400">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {clearable && !disabled && ((multiple && selectedOptions.length > 0) || (!multiple && selectedLabel)) && (
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Limpiar selección"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden />
              </button>
            )}
            <ChevronUpDownIcon className="h-5 w-5 text-slate-400" aria-hidden />
          </div>
        </button>
        {isOpen && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {searchable && (
              <div className="border-b border-slate-200 p-3 dark:border-slate-700">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
            )}
            <ul
              role="listbox"
              aria-multiselectable={multiple || undefined}
              className="max-h-60 overflow-y-auto py-2"
            >
              {filteredOptions.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-400">{emptyMessage}</li>
              )}
              {filteredOptions.map((option) => {
                const optionKey = String(option.value ?? '');
                const isSelected = valueKeys.has(optionKey);
                return (
                  <li key={optionKey} className="px-2">
                    <button
                      type="button"
                      onClick={() => toggleOption(option)}
                      disabled={option.disabled}
                      className={clsx(
                        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition focus:outline-none',
                        option.disabled
                          ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                          : isSelected
                              ? 'bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-100'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-slate-400 dark:text-slate-400">{option.description}</span>
                        )}
                      </div>
                      {isSelected && <CheckIcon className="h-5 w-5" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {helperText && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

Select.displayName = 'Select';
