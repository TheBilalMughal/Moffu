import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/features/auth/auth.store';

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAdminAuthStore();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <div className="h-8 w-8 animate-spin rounded-sm border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth/login" replace />;
  }

  if (status === 'unauthorized') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm space-y-3 rounded-lg border border-danger-DEFAULT/30 bg-danger-light p-6 text-center">
          <h2 className="font-semibold text-danger-dark">Access denied</h2>
          <p className="text-sm text-danger-dark">
            This account does not have platform admin access.
          </p>
          <button
            onClick={() => useAdminAuthStore.getState().initialize()}
            className="text-sm text-danger-dark underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
