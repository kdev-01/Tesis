import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { RouteNames } from '../../utils/constants.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAppConfig } from '../../context/AppConfigContext.jsx';
import clsx from 'clsx';

const links = [
  { to: RouteNames.HOME, label: 'Inicio' },
  { to: RouteNames.ABOUT, label: 'Nosotros' },
  { to: RouteNames.EVENTS, label: 'Eventos' },
  { to: RouteNames.NEWS, label: 'Noticias' },
];

export const PublicNavbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { config } = useAppConfig();
  const brandingName = config?.branding_name ?? 'Agxport Live';

  return (
    <header className="sticky top-0 z-40 bg-white/80 shadow backdrop-blur dark:bg-slate-900/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to={RouteNames.HOME} className="text-2xl font-display text-primary-600">
          {brandingName}
        </NavLink>
        <div className="flex items-center gap-6">
          <ul className="hidden items-center gap-5 text-sm font-semibold text-slate-600 md:flex dark:text-slate-200">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    clsx('transition-colors hover:text-primary-500', isActive && 'text-primary-500')
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={toggleTheme} aria-label="Cambiar tema">
              {theme === 'dark' ? '🌙' : '☀️'}
            </Button>
            <NavLink
              to={isAuthenticated ? RouteNames.DASHBOARD : RouteNames.LOGIN}
              className="inline-flex"
              aria-label={isAuthenticated ? 'Ir al panel administrativo' : 'Iniciar sesión'}
            >
              <span
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
              >
                {isAuthenticated ? 'Panel' : 'Ingresar'}
              </span>
            </NavLink>
          </div>
        </div>
      </nav>
    </header>
  );
};
