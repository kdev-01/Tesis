import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Squares2X2Icon,
  UsersIcon,
  BuildingOffice2Icon,
  TrophyIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  NewspaperIcon,
  ShieldCheckIcon,
  MapPinIcon,
  XMarkIcon,
  UserGroupIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { RouteNames, Roles } from '../../utils/constants.js';
import { useAppConfig } from '../../context/AppConfigContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const managementLinks = [
  { to: RouteNames.DASHBOARD, label: 'Dashboard', icon: Squares2X2Icon },
  { to: '/admin/usuarios', label: 'Usuarios', icon: UsersIcon },
  { to: RouteNames.ROLES, label: 'Roles', icon: ShieldCheckIcon },
  { to: '/admin/instituciones', label: 'Instituciones', icon: BuildingOffice2Icon },
  { to: '/admin/estudiantes', label: 'Estudiantes', icon: UserCircleIcon },
  { to: '/admin/escenarios', label: 'Escenarios', icon: MapPinIcon },
  { to: '/admin/eventos/administracion', label: 'Eventos', icon: TrophyIcon },
  { to: RouteNames.NOTIFICATIONS, label: 'Notificaciones', icon: BellAlertIcon },
  { to: '/admin/noticias', label: 'Noticias', icon: NewspaperIcon },
  { to: '/admin/ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
  { to: '/admin/perfil', label: 'Perfil', icon: UserCircleIcon },
];

const educationalLinks = [
  { to: RouteNames.DASHBOARD, label: 'Dashboard', icon: Squares2X2Icon },
  { to: RouteNames.EDUCATIONAL_PORTAL, label: 'Estudiantes e Institución', icon: UserGroupIcon },
  { to: RouteNames.EVENT_INVITATIONS, label: 'Invitaciones', icon: TrophyIcon },
  { to: RouteNames.EVENT_REGISTRATION, label: 'Eventos', icon: UsersIcon },
  { to: RouteNames.EVENT_FIXTURE, label: 'Calendario', icon: MapPinIcon },
  { to: RouteNames.NOTIFICATIONS, label: 'Notificaciones', icon: BellAlertIcon },
  { to: '/admin/perfil', label: 'Perfil', icon: UserCircleIcon },
];

const SidebarContent = ({ brandingName, links, description, onNavigate, showCloseButton = false }) => (
  <div className="flex h-full flex-col gap-6">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-lg font-display text-primary-600">{brandingName}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {showCloseButton && (
        <button
          type="button"
          onClick={onNavigate}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary-200 hover:text-primary-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400 dark:border-slate-700 dark:text-slate-200"
          aria-label="Cerrar menú de navegación"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
    <nav className="flex flex-1 flex-col gap-2 text-sm font-medium">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === RouteNames.DASHBOARD}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
              isActive
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/40'
                : 'text-slate-600 hover:bg-primary-500/10 hover:text-primary-600 dark:text-slate-300'
            }`
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  </div>
);

export const AdminSidebar = ({ isMobileOpen = false, onClose = () => {} }) => {
  const { config } = useAppConfig();
  const { hasRole } = useAuth();
  const brandingName = config?.branding_name ?? 'Panel deportivo';
  const isManagementPortal = hasRole([Roles.ADMIN]);
  const links = isManagementPortal ? managementLinks : educationalLinks;
  const description = isManagementPortal
    ? 'Gestiona la plataforma de manera integral.'
    : 'Administra los recursos asignados a tu institución educativa.';

  return (
    <>
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-72 flex-col gap-4 overflow-y-auto rounded-none lg:rounded-r-3xl bg-white/60 p-6 shadow-xl backdrop-blur dark:bg-slate-900/70 z-40"
      >
        <SidebarContent brandingName={brandingName} links={links} description={description} />
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="mobile-sidebar"
            className="fixed inset-0 z-50 flex lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="relative z-10 flex h-full w-72 flex-col gap-4 overflow-y-auto bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-slate-900/90"
            >
              <SidebarContent
                brandingName={brandingName}
                links={links}
                description={description}
                onNavigate={onClose}
                showCloseButton
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
