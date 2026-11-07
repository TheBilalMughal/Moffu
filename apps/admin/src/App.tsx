import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { AdminAuthGuard } from '@/components/AuthGuard';
import { AdminLoginPage } from '@/features/auth/pages/AdminLoginPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ClientsPage } from '@/features/orgs/ClientsPage';
import { ClientDetailPage } from '@/features/orgs/ClientDetailPage';
import { PlatformMembersPage } from '@/features/platform-members/PlatformMembersPage';
import { TeamMemberDetailPage } from '@/features/platform-members/TeamMemberDetailPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { SubscriptionsPage } from '@/features/billing/SubscriptionsPage';
import { PaymentsPage } from '@/features/billing/PaymentsPage';
import { MRRPage } from '@/features/billing/MRRPage';
import { CouponsPage } from '@/features/billing/CouponsPage';
import { UsagePage } from '@/features/analytics/UsagePage';
import { BroadcastPage } from '@/features/broadcasts/BroadcastPage';
import { FeatureFlagsPage } from '@/features/flags/FeatureFlagsPage';
import { WaitlistPage } from '@/features/waitlist/WaitlistPage';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { AISettingsPage } from '@/features/settings/AISettingsPage';
import { GoogleSettingsPage } from '@/features/settings/GoogleSettingsPage';
import { PackagesSettingsPage } from '@/features/settings/PackagesSettingsPage';
import { SyncSettingsPage } from '@/features/settings/SyncSettingsPage';
import { GeneralSettingsPage } from '@/features/settings/GeneralSettingsPage';
import { EmailSettingsPage } from '@/features/settings/EmailSettingsPage';
import { SecuritySettingsPage } from '@/features/settings/SecuritySettingsPage';
import { ClientLogoPage } from '@/features/settings/ClientLogoPage';
import { RefundsPage } from '@/features/billing/RefundsPage';
import { ReportsPage } from '@/features/analytics/ReportsPage';
import { IntegrationsHealthPage } from '@/features/platform/IntegrationsHealthPage';

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
              <AdminLayout />
            </AdminAuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="users" element={<PlatformMembersPage />} />
          <Route path="users/:id" element={<TeamMemberDetailPage />} />
          <Route path="billing" element={<SubscriptionsPage />} />
          <Route path="mrr" element={<MRRPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="refunds" element={<RefundsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="broadcasts" element={<BroadcastPage />} />
          <Route path="waitlist" element={<WaitlistPage />} />
          <Route path="flags" element={<FeatureFlagsPage />} />
          <Route path="integrations" element={<IntegrationsHealthPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="website/client-logo" replace />} />
            {/* Website tab */}
            <Route path="website" element={<Navigate to="website/client-logo" replace />} />
            <Route path="website/client-logo" element={<ClientLogoPage />} />
            {/* General tab */}
            <Route path="general" element={<GeneralSettingsPage />} />
            {/* API tab */}
            <Route path="api" element={<Navigate to="api/ai" replace />} />
            <Route path="api/ai"     element={<AISettingsPage />} />
            <Route path="api/google" element={<GoogleSettingsPage />} />
            <Route path="api/sync"   element={<SyncSettingsPage />} />
            {/* Notifications tab */}
            <Route path="notifications" element={<Navigate to="notifications/email" replace />} />
            <Route path="notifications/email" element={<EmailSettingsPage />} />
            {/* Security tab */}
            <Route path="security" element={<SecuritySettingsPage />} />
            {/* Legacy redirects */}
            <Route path="packages" element={<Navigate to="/settings/general" replace />} />
            <Route path="ai"       element={<Navigate to="/settings/api/ai"   replace />} />
            <Route path="google"   element={<Navigate to="/settings/api/google" replace />} />
            <Route path="sync"     element={<Navigate to="/settings/api/sync"   replace />} />
            <Route path="email"    element={<Navigate to="/settings/notifications/email" replace />} />
          </Route>
          {/* Legacy redirects */}
          <Route path="team" element={<Navigate to="/users" replace />} />
          <Route path="team/:id" element={<Navigate to="/users" replace />} />
          <Route path="platform-team" element={<Navigate to="/users" replace />} />
          <Route path="user-management" element={<Navigate to="/users" replace />} />
          <Route path="user-management/:id" element={<Navigate to="/users" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
