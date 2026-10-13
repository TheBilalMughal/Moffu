import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="h-8 w-8 animate-spin rounded-xl border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

/** Redirects unauthenticated users to login. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();
  const location = useLocation();

  if (status === 'loading') return <Spinner />;

  if (status === 'unauthenticated') {
    return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}

/** Redirects authenticated users away from auth pages. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();

  if (status === 'loading') return <Spinner />;

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

