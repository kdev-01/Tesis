import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { RouteNames } from '../../utils/constants.js';

export const NotFound = () => (
  <section className="flex flex-col items-center gap-6 text-center">
    <p className="text-8xl font-display text-primary-500">404</p>
    <p className="text-lg text-slate-600 dark:text-slate-300">No encontramos la página que buscas.</p>
    <NavLink to={RouteNames.HOME}>
      <Button>Volver al inicio</Button>
    </NavLink>
  </section>
);
