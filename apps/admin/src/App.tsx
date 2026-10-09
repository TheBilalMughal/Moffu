import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { adminAuthService } from '@/features/auth/auth.service';
import { AdminAuthGuard } from '@/components/AuthGuard';
import { AdminLoginPage } from '@/features/auth/pages/AdminLoginPage';

/** Placeholder — replaced in Phase 7 */
function AdminDashboardPlaceholder() {
  const { user, platformRole } = useAdminAuthStore();

  async function handleLogout() {
    await adminAuthService.logout();
    window.location.replace('/auth/login');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-4">
      <div className="space-y-1 rounded-md bg-white px-4 py-3 text-sm shadow-sm">
        <div className="text-neutral-600">
          Signed in as <strong>{user?.email}</strong>
        </div>
        <div className="text-neutral-400">
          Platform role: <strong>{platformRole ?? '—'}</strong>
        </div>
      </div>
      <p className="text-neutral-400 text-sm">Admin Dashboard — Phase 7 (not yet implemented)</p>
      <button
        onClick={handleLogout}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        Sign out
      </button>
    </div>
  );
}

export function App() {
  const initialize = useAdminAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/login" element={<AdminLoginPage />} />
        <Route
          path="/"
          element={
            <AdminAuthGuard>
              <AdminDashboardPlaceholder />
            </AdminAuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
