import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

interface Client {
  id: string;
  ref_id: string | null;
  name: string;
  created_at: string;
  plan: string | null;
  plan_limit: number;
  status: string | null;
  owner_email: string | null;
  member_count: number;
  usage: number;
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_LIMIT: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 500,
  enterprise: 2000,
};

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [deactivating, setDeactivating] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const { data: orgRows, error: orgErr } = await supabase
      .from('organizations')
      .select('id, ref_id, name, created_at, status')
      .order('created_at', { ascending: false });

    if (orgErr || !orgRows || orgRows.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const orgIds = orgRows.map((o: { id: string }) => o.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: memberRows } = await supabase
      .from('org_members')
      .select('org_id, user_id, role')
      .in('org_id', orgIds);

    const memberCountByOrg = new Map<string, number>();
    const userToOrg = new Map<string, string>();
    const ownerUserIdByOrg = new Map<string, string>();

    (memberRows ?? []).forEach((m: { org_id: string; user_id: string; role: string }) => {
      memberCountByOrg.set(m.org_id, (memberCountByOrg.get(m.org_id) ?? 0) + 1);
      if (!userToOrg.has(m.user_id)) userToOrg.set(m.user_id, m.org_id);
      if (m.role === 'owner') ownerUserIdByOrg.set(m.org_id, m.user_id);
    });

    const ownerIds = [...new Set(ownerUserIdByOrg.values())];
    const allMemberIds = [...userToOrg.keys()];

    const [plansRes, subsRes, emailRes, usageRes] = await Promise.all([
      supabase.from('plans').select('id, slug'),
      ownerIds.length > 0
        ? supabase.from('subscriptions').select('user_id, plan_id, status').in('user_id', ownerIds)
        : Promise.resolve({ data: [] }),
      ownerIds.length > 0
        ? supabase.rpc('get_users_email', { user_ids: ownerIds })
        : Promise.resolve({ data: [] }),
      allMemberIds.length > 0
        ? supabase.from('usage_events').select('user_id').in('user_id', allMemberIds).eq('event_type', 'ai_draft').gte('created_at', monthStart)
        : Promise.resolve({ data: [] }),
    ]);

    const planSlugById = new Map<string, string>(
      (plansRes.data ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]),
    );

    const subByOwner = new Map<string, { plan: string; status: string }>();
    (subsRes.data ?? []).forEach((s: { user_id: string; plan_id: string; status: string }) => {
      subByOwner.set(s.user_id, { plan: planSlugById.get(s.plan_id) ?? 'free', status: s.status });
    });

    const emailByUser = new Map<string, string>(
      (emailRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]),
    );

    const usageByOrg = new Map<string, number>();
    (usageRes.data ?? []).forEach((r: { user_id: string }) => {
      const orgId = userToOrg.get(r.user_id);
      if (orgId) usageByOrg.set(orgId, (usageByOrg.get(orgId) ?? 0) + 1);
    });

    const enriched: Client[] = orgRows.map((o: { id: string; ref_id: string | null; name: string; created_at: string; status: string | null }) => {
      const ownerUserId = ownerUserIdByOrg.get(o.id);
      const sub = ownerUserId ? subByOwner.get(ownerUserId) : null;
      const plan = sub?.plan ?? 'free';
      return {
        id: o.id,
        ref_id: o.ref_id ?? null,
        name: o.name,
        created_at: o.created_at,
        plan,
        plan_limit: PLAN_LIMIT[plan] ?? 50,
        status: o.status ?? null,
        owner_email: ownerUserId ? (emailByUser.get(ownerUserId) ?? null) : null,
        member_count: memberCountByOrg.get(o.id) ?? 0,
        usage: usageByOrg.get(o.id) ?? 0,
      };
    });

    setClients(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDeactivate(client: Client) {
    setDeactivating(client.id);
    const newStatus = client.status === 'active' ? 'suspended' : 'active';
    await supabase.from('organizations').update({ status: newStatus }).eq('id', client.id);
    setDeactivating(null);
    load();
  }

  const filtered = clients.filter((c) => {
    const matchSearch =
      search.trim() === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.owner_email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || c.plan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#111827]">Clients</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{clients.length} clients on the platform.</p>
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search clients or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm shadow-sm rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
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

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 px-8 py-4">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client Name</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Plan</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Members</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Created</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Usage</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-1.5">
                          <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {search || planFilter !== 'all' ? 'No clients match your filters.' : 'No clients yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isSuspended = c.status === 'suspended';
                    return (
                      <tr key={c.id} className="hover:bg-[#F8FAF9] transition-colors">
                        <td className="px-5 py-1.5">
                          <span className="font-mono text-xs text-[#6B7280]">{formatId(c.ref_id)}</span>
                        </td>
                        <td className="px-5 py-1.5">
                          {c.ref_id != null ? (
                            <Link to={`/clients/${c.ref_id}`} className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline">
                              {c.name}
                            </Link>
                          ) : (
                            <p className="font-medium text-[#111827]">{c.name}</p>
                          )}
                        </td>
                        <td className="px-5 py-1.5 text-[#374151] text-xs">{c.owner_email ?? '—'}</td>
                        <td className="px-5 py-1.5">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[c.plan ?? 'free'] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                            {c.plan ?? 'free'}
                          </span>
                        </td>
                        <td className="px-5 py-1.5 text-[#374151]">{c.member_count}</td>
                        <td className="px-5 py-1.5 text-[#9CA3AF] text-xs">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-[#374151]">{c.usage}</span>
                            <span className="text-xs text-[#9CA3AF]">/ {c.plan_limit}</span>
                          </div>
                        </td>
                        <td className="px-5 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {c.ref_id != null ? (
                              <Link to={`/clients/${c.ref_id}`} className="text-xs font-medium text-[#0D4C3C] hover:underline">View</Link>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">View</span>
                            )}
                            <span className="text-[#E5EAE8]">|</span>
                            <button
                              onClick={() => handleDeactivate(c)}
                              disabled={deactivating === c.id}
                              className={`text-xs font-medium hover:underline disabled:opacity-50 ${isSuspended ? 'text-[#0D4C3C]' : 'text-red-600'}`}
                            >
                              {deactivating === c.id ? '…' : isSuspended ? 'Reactivate' : 'Deactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
