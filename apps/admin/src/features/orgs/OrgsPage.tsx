import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';

interface Org {
  id: string;
  display_id: number | null;
  name: string;
  created_at: string;
  plan: string | null;
  status: string | null;
  owner_email: string | null;
  member_count: number;
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

export function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, display_id, name, created_at')
        .order('created_at', { ascending: false });

      if (!orgRows) { setLoading(false); return; }

      const orgIds = orgRows.map((o: { id: string }) => o.id);

      const [subsRes, membersRes] = await Promise.all([
        supabase.from('subscriptions').select('org_id, plan, status').in('org_id', orgIds),
        supabase.from('org_members').select('org_id, user_id, role').in('org_id', orgIds),
      ]);

      const subsByOrg = new Map<string, { plan: string; status: string }>();
      (subsRes.data ?? []).forEach((s: { org_id: string; plan: string; status: string }) => subsByOrg.set(s.org_id, s));

      const memberCountByOrg = new Map<string, number>();
      (membersRes.data ?? []).forEach((m: { org_id: string }) => {
        memberCountByOrg.set(m.org_id, (memberCountByOrg.get(m.org_id) ?? 0) + 1);
      });

      // Get owner emails — owner role in org_members → profile
      const ownerPairs = (membersRes.data ?? [])
        .filter((m: { role: string }) => m.role === 'owner')
        .map((m: { org_id: string; user_id: string }) => ({ orgId: m.org_id, userId: m.user_id }));

      const ownerIds = [...new Set(ownerPairs.map((p: { userId: string }) => p.userId))];
      const { data: profileRows } = ownerIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', ownerIds)
        : { data: [] };

      const emailById = new Map<string, string>();
      (profileRows ?? []).forEach((p: { id: string; email: string }) => emailById.set(p.id, p.email));

      const ownerEmailByOrg = new Map<string, string>();
      ownerPairs.forEach(({ orgId, userId }: { orgId: string; userId: string }) => {
        if (!ownerEmailByOrg.has(orgId)) ownerEmailByOrg.set(orgId, emailById.get(userId) ?? '—');
      });

      const enriched: Org[] = orgRows.map((o: { id: string; display_id: number | null; name: string; created_at: string }) => {
        const sub = subsByOrg.get(o.id);
        return {
          id: o.id,
          display_id: o.display_id ?? null,
          name: o.name,
          created_at: o.created_at,
          plan: sub?.plan ?? null,
          status: sub?.status ?? null,
          owner_email: ownerEmailByOrg.get(o.id) ?? null,
          member_count: memberCountByOrg.get(o.id) ?? 0,
        };
      });

      setOrgs(enriched);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = orgs.filter((o) => {
    const matchSearch =
      search.trim() === '' ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.owner_email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || o.plan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Organizations</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{orgs.length} organizations on the platform.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search orgs or owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
          />
        </div>
        <Dropdown
          clearable
          placeholder="All plans"
          value={planFilter === 'all' ? '' : planFilter}
          onChange={(v) => setPlanFilter(v === '' ? 'all' : v)}
          options={[
            { value: 'free',       label: 'Free'       },
            { value: 'starter',    label: 'Starter'    },
            { value: 'pro',        label: 'Pro'        },
            { value: 'enterprise', label: 'Enterprise' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Organization</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Owner</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Plan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Members</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                  {search || planFilter !== 'all' ? 'No orgs match your filters.' : 'No organizations yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr key={org.id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-[#6B7280]">
                      {org.display_id != null ? `#${org.display_id}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {org.display_id != null ? (
                      <Link
                        to={`/organizations/${org.display_id}`}
                        className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline"
                      >
                        {org.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-[#111827]">{org.name}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[#374151]">{org.owner_email ?? '—'}</td>
                  <td className="px-5 py-4">
                    {org.plan ? (
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[org.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                        {org.plan}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[#374151]">{org.member_count}</td>
                  <td className="px-5 py-4 text-[#9CA3AF]">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
