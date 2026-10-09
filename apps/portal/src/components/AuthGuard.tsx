/**
 * Route guard: redirects unauthenticated users to login.
 * Renders children only when session is confirmed.
 * Shows a loading state while session initializes.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-sm border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}

/** Redirect authenticated users away from auth pages */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-sm border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
