import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../navigation/AdminSidebar.jsx';
import { ToastStack } from '../feedback/ToastStack.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../ui/Button.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { NotificationBell } from '../notifications/NotificationBell.jsx';

export const AdminLayout = () => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gradient-to-r from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Sidebar fijo */}
      <AdminSidebar isMobileOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Contenido con margen a la izquierda para no ser cubierto */}
      <main className="flex min-w-0 flex-1 flex-col lg:pl-80">
        <section className="flex flex-1 flex-col overflow-hidden bg-white/85 p-4 shadow-2xl backdrop-blur dark:bg-slate-900/70 sm:p-6">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 focus-visible:outline-primary-400 dark:border-slate-700 dark:text-slate-200 lg:hidden"
                aria-label="Abrir menú de navegación"
              >
                <Bars3Icon className="h-5 w-5" aria-hidden />
              </Button>
              <div>
                <p className="text-xl font-display text-primary-600 sm:text-2xl">
                  Hola, {user?.nombre_completo ?? user?.email}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Gestiona la información en tiempo real.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <NotificationBell />
              <Button variant="ghost" onClick={toggleTheme} aria-label="Cambiar tema del panel">
                {theme === 'dark' ? '🌙' : '☀️'}
              </Button>
              <Button variant="outline" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </header>

          {/* Contenido scrollable */}
          <div className="mt-6 flex-1 overflow-y-auto">
            <div className="flex w-full flex-col gap-6 pb-6 sm:px-2 lg:px-4">
              <Outlet />
            </div>
          </div>
        </section>

        <ToastStack />
      </main>
    </div>
  );
};
