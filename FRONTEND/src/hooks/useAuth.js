import { useAuthContext, useAuthenticatedUser, useIsAuthenticated } from '../context/AuthContext.jsx';

export const useAuth = () => useAuthContext();
export const useAuthUser = () => useAuthenticatedUser();
export const useAuthGuard = () => useIsAuthenticated();
