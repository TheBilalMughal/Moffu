import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="h-8 w-8 animate-spin rounded-sm border-2 border-brand-500 border-t-transparent" />
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

/**
 * Requires both authentication AND a completed org.
 * Users with no org are redirected to /onboard.
 * Users with an onboarding-status org can still access the dashboard
 * (they may navigate freely after creating the org).
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();
  const { orgId, checked, check } = useOrgStore();
  const location = useLocation();

  useEffect(() => {
    if (status === 'authenticated' && !checked) {
      check();
    }
  }, [status, checked, check]);

  if (status === 'loading' || (status === 'authenticated' && !checked)) {
    return <Spinner />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!orgId) {
    return <Navigate to="/onboard" replace />;
  }

  return <>{children}</>;
}
