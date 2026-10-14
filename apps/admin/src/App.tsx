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
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="audit" element={<AuditPage />} />
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
