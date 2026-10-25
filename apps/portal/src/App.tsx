import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { authService } from '@/features/auth/auth.service';
import { AuthGuard, GuestGuard } from '@/components/AuthGuard';
import { useOrgStore } from '@/features/onboarding/org.store';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { DashboardLayout } from '@/features/dashboard/DashboardLayout';
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage';
import { ReviewsPage } from '@/features/dashboard/pages/ReviewsPage';
import { SettingsPage } from '@/features/dashboard/pages/SettingsPage';
import { BrandBrainPage } from '@/features/brand-brain/BrandBrainPage';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { BillingPage } from '@/features/billing/BillingPage';
import { GoogleCallbackPage } from '@/features/google/GoogleCallbackPage';
import { TeamPage } from '@/features/team/TeamPage';
import { AcceptInvitePage } from '@/features/team/AcceptInvitePage';
import { FeatureGatePage } from '@/components/FeatureGate';

export function App() {
  const initialize  = useAuthStore((s) => s.initialize);
  const authStatus  = useAuthStore((s) => s.status);
  const user        = useAuthStore((s) => s.user);
  const ensureOrg   = useOrgStore((s) => s.ensureOrg);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  // Silently create org for new users on first authenticated load
  useEffect(() => {
    if (authStatus === 'authenticated' && user) {
      ensureOrg(user);
    }
  }, [authStatus, user, ensureOrg]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes — guests only */}
        <Route path="/auth/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/auth/signup" element={<Navigate to="/auth/login" replace />} />
        <Route path="/auth/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />

        {/* Supabase redirect handlers */}
        <Route path="/auth/verify" element={<VerifyEmailPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Google OAuth callback */}
        <Route path="/auth/google/callback" element={<AuthGuard><GoogleCallbackPage /></AuthGuard>} />

        {/* Protected dashboard routes */}
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route path="/dashboard" element={<OverviewPage />} />
          <Route path="/reviews"   element={<ReviewsPage />} />
          <Route path="/insights"  element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/brand-brain" element={<FeatureGatePage feature="feature_brand_brain"><BrandBrainPage /></FeatureGatePage>} />
          <Route path="/billing"   element={<BillingPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
          <Route path="/team"      element={<FeatureGatePage feature="feature_team"><TeamPage /></FeatureGatePage>} />
        </Route>

        {/* Invite acceptance — no auth required to view */}
        <Route path="/invite/:token" element={<AcceptInvitePage />} />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
