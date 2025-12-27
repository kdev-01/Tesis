import React from 'react';
import { NavLink } from 'react-router-dom';
import { RouteNames } from '../../utils/constants.js';
import { useAppConfig } from '../../context/AppConfigContext.jsx';

export const Footer = () => {
  const { config } = useAppConfig();
  const brandingName = config?.branding_name ?? 'Agxport Live';
  const supportEmail = config?.support_email ?? null;

  return (
    <footer className="mt-16 bg-slate-900 text-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-display">{brandingName}</p>
          <p className="text-sm text-slate-400">
            Gestión inteligente de eventos deportivos estudiantiles.
            {supportEmail && (
              <span className="block text-xs text-slate-500">
                Contacto: <a href={`mailto:${supportEmail}`} className="hover:text-primary-300">{supportEmail}</a>
              </span>
            )}
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to={RouteNames.ABOUT} className="hover:text-primary-300">
            Nosotros
          </NavLink>
          <NavLink to={RouteNames.EVENTS} className="hover:text-primary-300">
            Eventos
          </NavLink>
          <NavLink to={RouteNames.NEWS} className="hover:text-primary-300">
            Noticias
          </NavLink>
        </nav>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Federación Deportiva Provincial Estudiantil de Napo</p>
      </div>
    </footer>
  );
};
