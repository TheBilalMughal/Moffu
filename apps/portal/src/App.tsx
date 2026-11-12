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
    <div style={{ minHeight: '100vh', background: '#D8CCFF', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: '-0.03em' }}>Moffu</span>
        <a href="/auth/login" style={{ padding: '9px 20px', background: '#111827', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          Sign In →
        </a>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111827', borderRadius: 8, padding: '6px 14px', marginBottom: 32 }}>
          <span style={{ background: '#6C55E8', color: '#fff', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 4 }}>New</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>AI Google Review Management</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, lineHeight: 1.08, color: '#111827', marginBottom: 20, letterSpacing: '-0.03em' }}>
          Reply to every review.<br />Sound human. Do nothing.
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(17,24,39,0.6)', lineHeight: 1.65, marginBottom: 40, maxWidth: 480 }}>
          Moffu connects to your Google Business Profile and drafts AI replies in your brand voice — approved by you before anything goes live.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/auth/login" style={{ padding: '12px 28px', background: '#6C55E8', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
            Sign in to your account
          </a>
          <a href="https://moffu.pro" style={{ padding: '12px 28px', background: 'rgba(17,24,39,0.08)', color: '#111827', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Learn more
          </a>
        </div>

        {/* Feature chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 48 }}>
          {['AI-drafted replies', 'Brand Brain tone control', 'Multi-location support', 'One-click approval', 'Review campaigns', 'Response analytics'].map(f => (
            <span key={f} style={{ background: 'rgba(17,24,39,0.07)', color: '#111827', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8 }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: 'rgba(17,24,39,0.4)' }}>
        © {new Date().getFullYear()} Moffu · <a href="https://moffu.pro" style={{ color: 'rgba(17,24,39,0.4)', textDecoration: 'none' }}>moffu.pro</a>
      </footer>
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
