import React from 'react';
import clsx from 'clsx';

export const Badge = ({ color = 'primary', children, className }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest',
      {
        primary: 'bg-primary-100 text-primary-700 dark:bg-primary-800/40 dark:text-primary-200',
        accent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-800/40 dark:text-cyan-200',
        neutral: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-200',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-800/30 dark:text-amber-200',
        danger: 'bg-red-100 text-red-700 dark:bg-red-800/40 dark:text-red-200',
      }[color] ?? 'bg-primary-100 text-primary-700',
      className,
    )}
  >
    {children}
  </span>
);
