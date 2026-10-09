import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { authService } from '@/features/auth/auth.service';
import { AuthGuard, GuestGuard } from '@/components/AuthGuard';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';

/** Placeholder — replaced in Phase 2+ */
function DashboardPlaceholder() {
  const { user } = useAuthStore();

  async function handleLogout() {
    await authService.logout();
    window.location.replace('/auth/login');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 p-4">
      <div className="rounded-md bg-neutral-100 px-4 py-2 text-sm text-neutral-600">
        Signed in as <strong>{user?.email}</strong>
      </div>
      <p className="text-neutral-400 text-sm">Dashboard — Phase 2 (not yet implemented)</p>
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
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes — guests only */}
        <Route
          path="/auth/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route
          path="/auth/signup"
          element={
            <GuestGuard>
              <SignupPage />
            </GuestGuard>
          }
        />
        <Route
          path="/auth/forgot-password"
          element={
            <GuestGuard>
              <ForgotPasswordPage />
            </GuestGuard>
          }
        />
        {/* These handle Supabase redirects — no guard needed */}
        <Route path="/auth/verify" element={<VerifyEmailPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardPlaceholder />
            </AuthGuard>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
