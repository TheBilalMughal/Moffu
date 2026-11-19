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
import { GoogleGrowthPage } from '@/features/google/GoogleGrowthPage';
import { CompetitorPage } from '@/features/google/CompetitorPage';
import { GeoRankPage } from '@/features/google/GeoRankPage';
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
import { DigestPage } from '@/features/digest/DigestPage';
import { PortalPageGate, PortalPageVisibilityProvider } from '@/components/PortalPageVisibility';


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
        <Route element={<AuthGuard><PortalPageVisibilityProvider><DashboardLayout /></PortalPageVisibilityProvider></AuthGuard>}>
          <Route path="/dashboard" element={<PortalPageGate pageKey="overview"><OverviewPage /></PortalPageGate>} />
          <Route path="/reviews"   element={<PortalPageGate pageKey="reviews"><ReviewsPage /></PortalPageGate>} />
          <Route path="/reviews/complaints" element={<PortalPageGate pageKey="complaints"><ComplaintsPage /></PortalPageGate>} />
          <Route path="/insights" element={<Navigate to="/insights/trends" replace />} />
          <Route path="/insights/trends"      element={<PortalPageGate pageKey="insights_trends"><FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/insights/ratings"     element={<PortalPageGate pageKey="insights_ratings"><FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/insights/agent-rules" element={<PortalPageGate pageKey="insights_agent_rules"><FeatureGatePage feature="feature_insights"><InsightsPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/google-profile" element={<PortalPageGate pageKey="google_profile"><FeatureGatePage feature="feature_google_profile"><GoogleProfilePage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/google-growth" element={<PortalPageGate pageKey="seo_leads"><FeatureGatePage feature="feature_google_profile"><GoogleGrowthPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/georank" element={<PortalPageGate pageKey="georank"><FeatureGatePage feature="feature_google_profile"><GeoRankPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/competitors" element={<PortalPageGate pageKey="competitors"><FeatureGatePage feature="feature_google_profile"><CompetitorPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/brand-brain" element={<PortalPageGate pageKey="brand_brain"><FeatureGatePage feature="feature_brand_brain"><BrandBrainPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/billing"   element={<PortalPageGate pageKey="billing"><BillingPage /></PortalPageGate>} />
          <Route path="/plan"             element={<PortalPageGate pageKey="plan"><BillingPage /></PortalPageGate>} />
          <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/account" element={<PortalPageGate pageKey="account"><SettingsPage /></PortalPageGate>} />
          <Route path="/settings/preferences" element={<PortalPageGate pageKey="preferences"><SettingsPage /></PortalPageGate>} />
          <Route path="/settings/integrations" element={<PortalPageGate pageKey="integrations"><SettingsPage /></PortalPageGate>} />
          <Route path="/team"      element={<PortalPageGate pageKey="team"><FeatureGatePage feature="feature_team"><TeamPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/campaigns"     element={<PortalPageGate pageKey="campaigns"><FeatureGatePage feature="feature_campaigns"><CampaignsPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/campaigns/:id" element={<PortalPageGate pageKey="campaigns"><FeatureGatePage feature="feature_campaigns"><CampaignDetailPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/feedback"      element={<PortalPageGate pageKey="feedback"><FeatureGatePage feature="feature_feedback"><FeedbackInboxPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/feedback/new"  element={<PortalPageGate pageKey="feedback"><FeatureGatePage feature="feature_feedback"><NewFeedbackRequestPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/marketing"     element={<PortalPageGate pageKey="marketing"><FeatureGatePage feature="feature_marketing"><MarketingPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/marketing/new" element={<PortalPageGate pageKey="marketing"><FeatureGatePage feature="feature_marketing"><NewPostPage /></FeatureGatePage></PortalPageGate>} />
          <Route path="/digest" element={<PortalPageGate pageKey="monthly_digest"><DigestPage /></PortalPageGate>} />
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
