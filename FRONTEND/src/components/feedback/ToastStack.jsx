import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../../hooks/useToast.js';

const toastVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

export const ToastStack = () => {
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), toast.duration ?? 4000),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [removeToast, toasts]);

  return (
    <div className="fixed right-4 top-4 z-[60] flex max-w-sm flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 text-white shadow-xl"
            role="status"
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && <p className="mt-1 text-xs text-slate-200">{toast.description}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
