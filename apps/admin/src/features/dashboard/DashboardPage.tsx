import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  totalOrgs: number;
  totalUsers: number;
  totalReviews: number;
  activeConnections: number;
}

interface ActionItem {
  id: string;
  type: 'inactive_org' | 'no_connection' | 'overdue_subscription';
  label: string;
  detail: string;
  href: string;
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{label}</p>
        <div className="w-8 h-8 bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center rounded-lg">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-[#111827]">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [orgsRes, usersRes, reviewsRes, connRes] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
        supabase.from('google_connections').select('id', { count: 'exact', head: true }).eq('status', 'CONNECTED'),
      ]);

      setStats({
        totalOrgs: orgsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        totalReviews: reviewsRes.count ?? 0,
        activeConnections: connRes.count ?? 0,
      });

      // Action required: orgs without active Google connection
      const actionItems: ActionItem[] = [];

      const { data: orgsNoConn } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(5);

      const { data: connectedOrgIds } = await supabase
        .from('google_connections')
        .select('org_id')
        .eq('status', 'CONNECTED');

      const connectedSet = new Set((connectedOrgIds ?? []).map((c: { org_id: string | null }) => c.org_id));

      (orgsNoConn ?? []).forEach((org: { id: string; name: string }) => {
        if (!connectedSet.has(org.id)) {
          actionItems.push({
            id: org.id,
            type: 'no_connection',
            label: org.name,
            detail: 'No Google Business Profile connected',
            href: `/organizations`,
          });
        }
      });

      setActions(actionItems.slice(0, 5));
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Platform overview and health.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5EAE8] rounded-xl px-6 py-5 animate-pulse">
              <div className="h-3 bg-[#E5EAE8] rounded w-24 mb-3" />
              <div className="h-8 bg-[#E5EAE8] rounded w-12" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Organizations"
              value={stats?.totalOrgs ?? 0}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            />
            <StatCard
              label="Users"
              value={stats?.totalUsers ?? 0}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard
              label="Total Reviews"
              value={stats?.totalReviews ?? 0}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>}
            />
            <StatCard
              label="Active Connections"
              value={stats?.activeConnections ?? 0}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
            />
          </>
        )}
      </div>

      {/* Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Action Required</h2>
            {actions.length > 0 && (
              <span className="text-xs font-semibold text-white bg-red-500 px-2 py-0.5 rounded">{actions.length}</span>
            )}
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#9CA3AF]">Loading…</div>
          ) : actions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No issues requiring attention.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {actions.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{item.label}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{item.detail}</p>
                  </div>
                  <Link
                    to={item.href}
                    className="text-xs font-medium text-[#0D4C3C] hover:underline flex-shrink-0 ml-4"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8]">
            <h2 className="text-sm font-semibold text-[#111827]">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { to: '/organizations', label: 'View all orgs', desc: 'Browse & manage organizations' },
              { to: '/platform-team', label: 'Platform team', desc: 'Manage admin team members' },
              { to: '/roles', label: 'Roles & permissions', desc: 'Edit permission matrix' },
              { to: '/audit', label: 'Audit logs', desc: 'Review recent platform activity' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="border border-[#E5EAE8] rounded-lg p-4 hover:bg-[#F8FAF9] hover:border-[#0D4C3C] transition-colors group"
              >
                <p className="text-sm font-semibold text-[#111827] group-hover:text-[#0D4C3C]">{link.label}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
