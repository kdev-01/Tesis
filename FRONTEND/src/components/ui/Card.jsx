import React from 'react';
import clsx from 'clsx';

export const Card = ({ as: Component = 'div', className, children, ...props }) => (
  <Component
    className={clsx(
      'card-pattern relative overflow-hidden rounded-3xl border border-white/10 bg-white/80 p-6 shadow-sporty backdrop-blur-md dark:border-white/5 dark:bg-slate-900/60',
      className,
    )}
    {...props}
  >
    {children}
  </Component>
);

export const CardHeader = ({ title, description, actions }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      {title && <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>}
      {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

export const CardFooter = ({ children, className }) => (
  <div className={clsx('mt-6 border-t border-slate-200/60 pt-4 dark:border-slate-700/60', className)}>{children}</div>
);
