import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Roles, RouteNames } from '../utils/constants.js';

export const ProtectedRoute = ({
  allowedRoles = [Roles.ADMIN, Roles.MANAGER, Roles.COACH],
  redirectTo = RouteNames.HOME,
  children,
}) => {
  const location = useLocation();
  const { isAuthenticated, hasRole, status, isInitialized } = useAuth();

  if (!isInitialized || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={RouteNames.LOGIN} state={{ from: location }} replace />;
  }

  if (!hasRole(allowedRoles)) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
};
