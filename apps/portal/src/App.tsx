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
import { GoogleProfilePage } from '@/features/google/GoogleProfilePage';
import { BillingPage } from '@/features/billing/BillingPage';
import { GoogleCallbackPage } from '@/features/google/GoogleCallbackPage';
import { GoogleConnectPage } from '@/features/google/GoogleConnectPage';
import { TeamPage } from '@/features/team/TeamPage';
import { AcceptInvitePage } from '@/features/team/AcceptInvitePage';
import { FeatureGatePage } from '@/components/FeatureGate';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { CampaignDetailPage } from '@/features/campaigns/CampaignDetailPage';
import { FeedbackInboxPage } from '@/features/feedback/FeedbackInboxPage';
import { NewFeedbackRequestPage } from '@/features/feedback/NewFeedbackRequestPage';
import { MarketingPage } from '@/features/marketing/MarketingPage';
import { NewPostPage } from '@/features/marketing/NewPostPage';

function PortalLanding() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', fontFamily: 'sans-serif' }}>
      <img src="/moffu-logo.svg" alt="Moffu" width={120} style={{ marginBottom: 24 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Moffu Customer Portal</h1>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 32 }}>Manage your Google reviews and AI replies.</p>
      <a href="/auth/login" style={{ padding: '10px 24px', background: '#6C55E8', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
        Sign In
      </a>
    </div>
  );
}

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

        {/* Google connect — location picker after OAuth */}
        <Route path="/google/connect" element={<AuthGuard><GoogleConnectPage /></AuthGuard>} />

        {/* Protected dashboard routes */}
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route path="/dashboard" element={<OverviewPage />} />
          <Route path="/reviews"   element={<ReviewsPage />} />
          <Route path="/insights" element={<Navigate to="/insights/trends" replace />} />
          <Route path="/insights/trends"      element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/insights/ratings"     element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/insights/agent-rules" element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/google-profile" element={<FeatureGatePage feature="feature_google_profile"><GoogleProfilePage /></FeatureGatePage>} />
          <Route path="/brand-brain" element={<FeatureGatePage feature="feature_brand_brain"><BrandBrainPage /></FeatureGatePage>} />
          <Route path="/billing"   element={<BillingPage />} />
          <Route path="/plan"             element={<BillingPage />} />
          <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/account" element={<SettingsPage />} />
          <Route path="/settings/preferences" element={<SettingsPage />} />
          <Route path="/settings/integrations" element={<SettingsPage />} />
          <Route path="/team"      element={<FeatureGatePage feature="feature_team"><TeamPage /></FeatureGatePage>} />
          <Route path="/campaigns"     element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/feedback"      element={<FeedbackInboxPage />} />
          <Route path="/feedback/new"  element={<NewFeedbackRequestPage />} />
          <Route path="/marketing"     element={<MarketingPage />} />
          <Route path="/marketing/new" element={<NewPostPage />} />
        </Route>

        {/* Invite acceptance — no auth required to view */}
        <Route path="/invite/:token" element={<AcceptInvitePage />} />

        {/* Public landing — required so Paddle domain review can reach the
            root without hitting the AuthGuard login redirect */}
        <Route path="/" element={<PortalLanding />} />

        {/* Default redirects */}
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
