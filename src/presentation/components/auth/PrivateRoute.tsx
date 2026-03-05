// ─── Presentation: PrivateRoute ──────────────────────────────────────────────
// Protects routes that require authentication.
// Shows a loading spinner while the user is being rehydrated from localStorage.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/domain/auth/entities/User';

interface PrivateRouteProps {
  /** If provided, only users with one of these roles can access the route */
  allowedRoles?: UserRole[];
}

export function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
