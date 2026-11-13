import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatDate, formatId, refToSlug } from '@/lib/format';

interface Client {
  id: string;
  ref_id: string | null;
  name: string;
  created_at: string;
  plan: string | null;
  plan_limit: number;
  plan_limit_unlimited: boolean;
  status: string | null;
  owner_email: string | null;
  member_count: number;
  usage: number;
  gbp_configured: boolean;
}

const PLAN_COLOR: Record<string, string> = {
  free:       'text-[#374151]',
  starter:    'text-[#1D4ED8]',
  growth:     'text-[#15803D]',
  scale:      'text-[#C2410C]',
  pro:        'text-[#15803D]',
  enterprise: 'text-[#C2410C]',
};

const PLAN_LIMIT: Record<string, number> = {
  free:       50,
  starter:    200,
  growth:     500,
  scale:      2000,
  pro:        500,
  enterprise: 2000,
};

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gbpFilter, setGbpFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Client | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendNote, setSuspendNote] = useState('');

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

    // Fetch GBP configured orgs:
    // google_locations → connection_id → google_connections → user_id → userToOrg → org_id
    const { data: connRows } = await supabase
      .from('google_connections')
      .select('id, user_id')
      .in('user_id', allMemberIds);

    const connToOrg = new Map<string, string>();
    (connRows ?? []).forEach((c: { id: string; user_id: string }) => {
      const orgId = userToOrg.get(c.user_id);
      if (orgId) connToOrg.set(c.id, orgId);
    });

    const connIds = [...connToOrg.keys()];
    let gbpConfiguredOrgs = new Set<string>();
    if (connIds.length > 0) {
      const { data: locRows } = await supabase
        .from('google_locations')
        .select('connection_id')
        .eq('is_selected', true)
        .in('connection_id', connIds);
      (locRows ?? []).forEach((l: { connection_id: string }) => {
        const orgId = connToOrg.get(l.connection_id);
        if (orgId) gbpConfiguredOrgs.add(orgId);
      });
    }

    const [plansRes, subsRes, emailRes, usageRes, overridesRes] = await Promise.all([
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
      supabase.from('org_plan_overrides').select('org_id, ai_drafts_per_month').in('org_id', orgIds),
    ]);

    const planSlugById = new Map<string, string>(
      (plansRes.data ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]),
    );

    const overrideByOrg = new Map<string, { ai_drafts_per_month: number | null }>(
      (overridesRes.data ?? []).map((o: { org_id: string; ai_drafts_per_month: number | null }) => [o.org_id, o]),
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
      const ov = overrideByOrg.get(o.id);
      let planLimit = PLAN_LIMIT[plan] ?? 50;
      let planLimitUnlimited = false;
      if (ov?.ai_drafts_per_month === -1) {
        planLimitUnlimited = true;
      } else if (ov?.ai_drafts_per_month != null) {
        planLimit = ov.ai_drafts_per_month;
      }
      return {
        id: o.id,
        ref_id: o.ref_id ?? null,
        name: o.name,
        created_at: o.created_at,
        plan,
        plan_limit: planLimit,
        plan_limit_unlimited: planLimitUnlimited,
        status: o.status ?? null,
        owner_email: ownerUserId ? (emailByUser.get(ownerUserId) ?? null) : null,
        member_count: memberCountByOrg.get(o.id) ?? 0,
        usage: usageByOrg.get(o.id) ?? 0,
        gbp_configured: gbpConfiguredOrgs.has(o.id),
      };
    });

    setClients(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDeactivate(client: Client) {
    if (client.status !== 'suspended') {
      setSuspendReason('');
      setSuspendNote('');
      setSuspendTarget(client);
      return;
    }
    setDeactivating(client.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('organizations').update({ status: 'active' }).eq('id', client.id);
    if (user) {
      await supabase.from('audit_events').insert({
        actor_user_id: user.id, action: 'admin_reactivate_org',
        resource_type: 'organization', resource_id: client.id,
        metadata: { org_name: client.name },
      });
    }
    setDeactivating(null);
    load();
  }

  async function handleConfirmSuspend() {
    if (!suspendTarget || !suspendReason) return;
    setDeactivating(suspendTarget.id);
    setSuspendTarget(null);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('organizations').update({ status: 'suspended' }).eq('id', suspendTarget.id);
    if (user) {
      await supabase.from('audit_events').insert({
        actor_user_id: user.id, action: 'admin_suspend_org',
        resource_type: 'organization', resource_id: suspendTarget.id,
        metadata: { org_name: suspendTarget.name, reason: suspendReason, note: suspendNote || null },
      });
    }
    setDeactivating(null);
    load();
  }

  function clearFilters() {
    setSearch('');
    setPlanFilter('');
    setStatusFilter('');
    setGbpFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const hasFilters = search.trim() !== '' || planFilter !== '' || statusFilter !== '' || gbpFilter !== '' || dateFrom !== '' || dateTo !== '';

  const filtered = clients.filter((c) => {
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.owner_email ?? '').toLowerCase().includes(q)) return false;
    }
    if (planFilter !== '' && c.plan !== planFilter) return false;
    if (statusFilter === 'active' && c.status === 'suspended') return false;
    if (statusFilter === 'suspended' && c.status !== 'suspended') return false;
    if (gbpFilter === 'configured' && !c.gbp_configured) return false;
    if (gbpFilter === 'not_set_up' && c.gbp_configured) return false;
    if (dateFrom !== '') {
      const created = new Date(c.created_at);
      const from = new Date(dateFrom + 'T00:00:00');
      if (created < from) return false;
    }
    if (dateTo !== '') {
      const created = new Date(c.created_at);
      const to = new Date(dateTo + 'T23:59:59');
      if (created > to) return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#111827]">Clients</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{clients.length} clients on the platform.</p>
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 px-8 pb-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search clients or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 pl-9 pr-3 py-2 text-sm shadow-sm rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8]"
          />
        </div>

        {/* Plan */}
        <Dropdown
          clearable
          placeholder="All plans"
          value={planFilter}
          onChange={(v) => setPlanFilter(v)}
          options={[
            { value: 'free',    label: 'Free'    },
            { value: 'starter', label: 'Starter' },
            { value: 'growth',  label: 'Growth'  },
            { value: 'scale',   label: 'Scale'   },
          ]}
        />

        {/* Status */}
        <Dropdown
          clearable
          placeholder="All statuses"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: 'active',    label: 'Active'    },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />

        {/* GBP Status */}
        <Dropdown
          clearable
          placeholder="GBP: All"
          value={gbpFilter}
          onChange={(v) => setGbpFilter(v)}
          options={[
            { value: 'configured',  label: 'Configured'  },
            { value: 'not_set_up',  label: 'Not Set Up'  },
          ]}
        />

        {/* Date range — Joined */}
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-[#6B7280] hover:text-[#111827] px-2 py-2 transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-[#9CA3AF]">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 px-8 py-4">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF7] border-b border-[#E5E7EB] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client Name</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Plan</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">GBP Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Members</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Joined</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Usage</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-5 py-1.5">
                          <div className="h-3.5 bg-[#E5E7EB] rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {hasFilters ? 'No clients match your filters.' : 'No clients yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isSuspended = c.status === 'suspended';
                    return (
                      <tr key={c.id} className="hover:bg-[#FAFAF7] transition-colors">
                        <td className="px-5 py-1.5">
                          <span className="font-mono text-xs text-[#6B7280]">{formatId(c.ref_id)}</span>
                        </td>
                        <td className="px-5 py-1.5">
                          {c.ref_id != null ? (
                            <Link to={`/clients/${refToSlug(c.ref_id)}`} className="font-medium text-[#111827] hover:text-[#6C55E8] hover:underline">
                              {c.name}
                            </Link>
                          ) : (
                            <p className="font-medium text-[#111827]">{c.name}</p>
                          )}
                        </td>
                        <td className="px-5 py-1.5 text-[#374151] text-xs">{c.owner_email ?? '—'}</td>
                        <td className="px-5 py-1.5">
                          <span className={`text-xs font-semibold ${PLAN_COLOR[c.plan ?? 'free'] ?? 'text-[#374151]'}`}>
                            {(c.plan ?? 'free').charAt(0).toUpperCase() + (c.plan ?? 'free').slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-1.5">
                          {c.gbp_configured ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] flex-shrink-0" />
                              Configured
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB] flex-shrink-0" />
                              Not Set Up
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-1.5 text-[#374151]">{c.member_count}</td>
                        <td className="px-5 py-1.5 text-[#9CA3AF] text-xs">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-[#374151]">{c.usage}</span>
                            <span className="text-xs text-[#9CA3AF]">/ {c.plan_limit_unlimited ? '∞' : c.plan_limit}</span>
                          </div>
                        </td>
                        <td className="px-5 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {c.ref_id != null ? (
                              <Link to={`/clients/${refToSlug(c.ref_id)}`} className="text-xs font-medium text-[#6C55E8] hover:underline">View</Link>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">View</span>
                            )}
                            <span className="text-[#E5E7EB]">|</span>
                            <button
                              onClick={() => handleDeactivate(c)}
                              disabled={deactivating === c.id}
                              className={`text-xs font-medium hover:underline disabled:opacity-50 ${isSuspended ? 'text-[#6C55E8]' : 'text-red-600'}`}
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

      {/* ── Suspend Confirmation Modal ── */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSuspendTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#111827] mb-1">Suspend {suspendTarget.name}?</h2>
            <p className="text-sm text-[#6B7280] mb-5">The organization will lose access to the portal. Select a reason before proceeding.</p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Reason <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  className="w-full appearance-none border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8] bg-white pr-8"
                >
                  <option value="">Select a reason…</option>
                  <option value="payment_issue">Payment issue</option>
                  <option value="policy_violation">Policy violation</option>
                  <option value="fraud_suspicion">Fraud suspicion</option>
                  <option value="spam_abuse">Spam / abuse</option>
                  <option value="account_request">Account request (customer asked)</option>
                  <option value="other">Other</option>
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Additional note <span className="text-[#9CA3AF] font-normal">(optional)</span></label>
              <textarea
                value={suspendNote}
                onChange={e => setSuspendNote(e.target.value)}
                placeholder="Add context visible in the audit log…"
                rows={3}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSuspendTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuspend}
                disabled={!suspendReason}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Suspend Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
