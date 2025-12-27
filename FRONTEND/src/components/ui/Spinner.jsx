import React from 'react';
import clsx from 'clsx';

const SIZE_MAP = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export const Spinner = ({ label, size = 'md', className, labelClassName }) => {
  const sizeClasses = SIZE_MAP[size] ?? SIZE_MAP.md;
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2', className)} role="status" aria-live="polite">
      <span
        className={clsx(
          'inline-block animate-spin rounded-full border-solid border-transparent border-t-primary-500',
          sizeClasses,
        )}
      />
      {label ? (
        <span className={clsx('text-xs font-medium text-slate-500 dark:text-slate-300', labelClassName)}>{label}</span>
      ) : null}
    </div>
  );
};

Spinner.displayName = 'Spinner';
