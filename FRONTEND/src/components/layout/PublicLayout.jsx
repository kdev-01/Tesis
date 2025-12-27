import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicNavbar } from '../navigation/PublicNavbar.jsx';
import { Footer } from './Footer.jsx';
import { ToastStack } from '../feedback/ToastStack.jsx';
import { useAppConfig } from '../../context/AppConfigContext.jsx';

export const PublicLayout = () => {
  const { config } = useAppConfig();
  const isMaintenance = Boolean(config?.maintenance_mode);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PublicNavbar />
      {isMaintenance && (
        <div className="bg-amber-500 py-2 text-center text-sm font-medium text-white">
          Estamos realizando tareas de mantenimiento. Algunos servicios pueden no estar disponibles temporalmente.
        </div>
      )}
      <main id="contenido" className="mx-auto max-w-6xl px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <ToastStack />
    </div>
  );
};
