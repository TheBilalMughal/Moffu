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
import { CompetitorPage } from '@/features/google/CompetitorPage';
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
import { ComplaintsPage } from '@/features/dashboard/pages/ComplaintsPage';


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
          <Route path="/reviews/complaints" element={<ComplaintsPage />} />
          <Route path="/insights" element={<Navigate to="/insights/trends" replace />} />
          <Route path="/insights/trends"      element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/insights/ratings"     element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/insights/agent-rules" element={<FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage>} />
          <Route path="/google-profile" element={<FeatureGatePage feature="feature_google_profile"><GoogleProfilePage /></FeatureGatePage>} />
          <Route path="/competitors" element={<FeatureGatePage feature="feature_google_profile"><CompetitorPage /></FeatureGatePage>} />
          <Route path="/brand-brain" element={<FeatureGatePage feature="feature_brand_brain"><BrandBrainPage /></FeatureGatePage>} />
          <Route path="/billing"   element={<BillingPage />} />
          <Route path="/plan"             element={<BillingPage />} />
          <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/account" element={<SettingsPage />} />
          <Route path="/settings/preferences" element={<SettingsPage />} />
          <Route path="/settings/integrations" element={<SettingsPage />} />
          <Route path="/team"      element={<FeatureGatePage feature="feature_team"><TeamPage /></FeatureGatePage>} />
          <Route path="/campaigns"     element={<FeatureGatePage feature="feature_campaigns"><CampaignsPage /></FeatureGatePage>} />
          <Route path="/campaigns/:id" element={<FeatureGatePage feature="feature_campaigns"><CampaignDetailPage /></FeatureGatePage>} />
          <Route path="/feedback"      element={<FeatureGatePage feature="feature_feedback"><FeedbackInboxPage /></FeatureGatePage>} />
          <Route path="/feedback/new"  element={<FeatureGatePage feature="feature_feedback"><NewFeedbackRequestPage /></FeatureGatePage>} />
          <Route path="/marketing"     element={<FeatureGatePage feature="feature_marketing"><MarketingPage /></FeatureGatePage>} />
          <Route path="/marketing/new" element={<FeatureGatePage feature="feature_marketing"><NewPostPage /></FeatureGatePage>} />
        </Route>

        {/* Invite acceptance — no auth required to view */}
        <Route path="/invite/:token" element={<AcceptInvitePage />} />

        {/* Root → login */}
        <Route path="/" element={<Navigate to="/auth/login" replace />} />

        {/* Default redirects */}
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
