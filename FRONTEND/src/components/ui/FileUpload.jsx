import React, { useId, useRef } from 'react';
import { PhotoIcon, ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export const FileUpload = ({
  label,
  description,
  accept = 'image/*',
  onFileSelect,
  onRemove,
  previewUrl,
  helperText,
  error,
  className,
}) => {
  const inputRef = useRef(null);
  const inputId = useId();

  const handleSelect = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const triggerFileDialog = () => {
    inputRef.current?.click();
  };

  return (
    <div className={clsx('space-y-3', className)}>
      {label && <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>}
      {description && <p className="text-xs text-slate-500 dark:text-slate-300">{description}</p>}

      <div className="relative overflow-hidden rounded-3xl border border-dashed border-primary-200 bg-gradient-to-r from-sky-50 via-rose-50 to-purple-50 p-4 shadow-inner dark:border-primary-500/40 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/70 shadow-sm dark:bg-slate-900/80">
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
            ) : (
              <PhotoIcon className="h-12 w-12 text-primary-400" aria-hidden />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {previewUrl ? 'Actualiza la imagen destacada' : 'Arrastra una imagen o selecciónala desde tu dispositivo'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerFileDialog}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-rose-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
              >
                <ArrowUpTrayIcon className="h-4 w-4" aria-hidden />
                Seleccionar imagen
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white/80 px-4 py-2 text-sm font-semibold text-red-500 transition hover:border-red-400 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:border-red-500/60 dark:bg-transparent dark:text-red-400"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden />
                  Quitar
                </button>
              )}
            </div>
            {helperText && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleSelect}
        />
      </div>
    </div>
  );
};

FileUpload.displayName = 'FileUpload';
