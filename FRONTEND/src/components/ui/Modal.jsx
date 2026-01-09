import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button.jsx';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full mx-4',
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  children,
  confirmDisabled = false,
  confirmLoading = false,
  confirmVariant = 'primary',
  /** Nuevo: controla el ancho máximo del modal */
  size = 'md',
  /** Nuevo: si el contenido puede desbordar (activa scroll interno) */
  scrollable = true,
  footer = null,
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur sm:px-6 sm:py-10"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={backdropVariants}
        aria-modal="true"
        role="dialog"
        onClick={(e) => {
          // Cierre al hacer click fuera del panel
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <motion.div
          className={[
            'w-full',
            SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
            'overflow-hidden rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8',
            'max-h-[85vh]', // limita altura si el contenido crece
          ].join(' ')}
          variants={modalVariants}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
              {description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
              )}
            </div>
            <Button variant="ghost" onClick={onClose} aria-label="Cerrar">
              ✕
            </Button>
          </div>

          {/* Si hay poco contenido, no crece; si hay mucho, solo esta área hace scroll */}
          <div
            className={[
              'mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-200',
              scrollable ? 'overflow-y-auto' : '',
              scrollable ? 'max-h-[60vh]' : '', // maneja el scroll interno
            ].join(' ')}
          >
            {children}
          </div>

          {footer ? (
            footer
          ) : (
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={onConfirm} disabled={confirmDisabled || confirmLoading} variant={confirmVariant}>
                {confirmLoading ? 'Procesando…' : confirmLabel}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
