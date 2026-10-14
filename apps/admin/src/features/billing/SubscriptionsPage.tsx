import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

interface SubRow {
  id: string;
  userId: string;
  planId: string;
  planSlug: string;
  planName: string;
  amountCents: number;
  status: string;
  interval: string | null;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  orgId: string | null;
  orgRefId: string | null;
  orgName: string | null;
  ownerEmail: string | null;
}

const PLAN_COLOR: Record<string, string> = {
  free:       'bg-[#F3F4F6] text-[#374151]',
  starter:    'bg-[#EFF6FF] text-[#1D4ED8]',
  growth:     'bg-[#F0FDF4] text-[#15803D]',
  scale:      'bg-[#FFF7ED] text-[#C2410C]',
  pro:        'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-[#ECFDF5] text-[#065F46]',
  trialing:  'bg-[#EFF6FF] text-[#1D4ED8]',
  past_due:  'bg-[#FEF2F2] text-[#991B1B]',
  canceled:  'bg-[#F3F4F6] text-[#374151]',
  unpaid:    'bg-[#FEF3C7] text-[#92400E]',
  paused:    'bg-[#F3F4F6] text-[#6B7280]',
};

function fmt(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function SubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'plan' | 'status' | 'period_end' | 'amount'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    const [subsRes, plansRes, pricesRes, orgMembersRes] = await Promise.all([
      supabase.from('subscriptions').select('id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name'),
      supabase.from('plan_prices').select('plan_id, interval, amount_cents').eq('currency', 'USD'),
      supabase.from('org_members').select('user_id, org_id, role').eq('role', 'owner'),
    ]);

    type SubRaw = { id: string; user_id: string; plan_id: string; status: string; billing_interval: string | null; current_period_start: string; current_period_end: string; cancel_at_period_end: boolean; stripe_subscription_id: string | null; stripe_customer_id: string | null; created_at: string };
    type PlanRaw = { id: string; slug: string; name: string };
    type PriceRaw = { plan_id: string; interval: string; amount_cents: number };
    type OrgMemberRaw = { user_id: string; org_id: string; role: string };

    const subs = (subsRes.data ?? []) as SubRaw[];
    const planById = new Map<string, PlanRaw>((plansRes.data ?? []).map((p: PlanRaw) => [p.id, p]));
    const priceMap = new Map<string, number>();
    (pricesRes.data ?? []).forEach((p: PriceRaw) => { priceMap.set(`${p.plan_id}:${p.interval}`, p.amount_cents); });
    const orgByOwner = new Map<string, string>((orgMembersRes.data ?? []).map((m: OrgMemberRaw) => [m.user_id, m.org_id]));

    const ownerUserIds = subs.map((s) => s.user_id);
    const orgIds = [...new Set([...orgByOwner.values()])];

    const [orgsRes, profilesRes, emailsRes] = await Promise.all([
      orgIds.length > 0 ? supabase.from('organizations').select('id, ref_id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
      ownerUserIds.length > 0 ? supabase.from('profiles').select('id, display_name').in('id', ownerUserIds) : Promise.resolve({ data: [] }),
      ownerUserIds.length > 0 ? supabase.rpc('get_users_email', { user_ids: ownerUserIds }) : Promise.resolve({ data: [] }),
    ]);

    type OrgRaw = { id: string; ref_id: string | null; name: string };
    const orgById = new Map<string, OrgRaw>((orgsRes.data ?? []).map((o: OrgRaw) => [o.id, o]));
    const emailById = new Map<string, string>((emailsRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));

    const enriched: SubRow[] = subs.map((s) => {
      const plan = planById.get(s.plan_id);
      const interval = s.billing_interval ?? 'monthly';
      const amountCents = priceMap.get(`${s.plan_id}:${interval}`) ?? priceMap.get(`${s.plan_id}:monthly`) ?? 0;
      const orgId = orgByOwner.get(s.user_id) ?? null;
      const org = orgId ? orgById.get(orgId) : null;
      return {
        id: s.id,
        userId: s.user_id,
        planId: s.plan_id,
        planSlug: plan?.slug ?? 'free',
        planName: plan?.name ?? 'Free',
        amountCents,
        status: s.status,
        interval: s.billing_interval,
        periodStart: s.current_period_start,
        periodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        stripeSubId: s.stripe_subscription_id,
        stripeCustomerId: s.stripe_customer_id,
        createdAt: s.created_at,
        orgId: orgId,
        orgRefId: org?.ref_id ?? null,
        orgName: org?.name ?? null,
        ownerEmail: emailById.get(s.user_id) ?? null,
      };
    });

    setRows(enriched);
    setLoading(false);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((s) => (s.orgName ?? '').toLowerCase().includes(q) || (s.ownerEmail ?? '').toLowerCase().includes(q));
    }
    if (planFilter) r = r.filter((s) => s.planSlug === planFilter);
    if (statusFilter) r = r.filter((s) => s.status === statusFilter);
    if (intervalFilter) r = r.filter((s) => (s.interval ?? 'monthly') === intervalFilter);

    return [...r].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'created') cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortBy === 'plan') cmp = a.planSlug.localeCompare(b.planSlug);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'period_end') cmp = a.periodEnd.localeCompare(b.periodEnd);
      else if (sortBy === 'amount') cmp = a.amountCents - b.amountCents;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, planFilter, statusFilter, intervalFilter, sortBy, sortDir]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.planSlug !== 'free' && r.status === 'active');
    const mrr = paid.reduce((sum, r) => sum + (r.interval === 'annual' ? Math.round(r.amountCents / 12) : r.amountCents), 0);
    const arr = mrr * 12;
    return { total: rows.length, paid: paid.length, free: rows.filter((r) => r.planSlug === 'free').length, mrr, arr };
  }, [rows]);

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg className={`w-3 h-3 ml-1 flex-shrink-0 transition-opacity ${sortBy === col ? 'opacity-100' : 'opacity-30'}`} viewBox="0 0 12 12" fill="currentColor">
      {sortDir === 'asc' && sortBy === col
        ? <path d="M6 2l4 5H2z"/>
        : <path d="M6 10L2 5h8z"/>}
    </svg>
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Subscriptions</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{rows.length} total subscriptions across all clients.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, sub: 'all subscriptions' },
          { label: 'Paid', value: stats.paid, sub: 'active paid plans' },
          { label: 'Free', value: stats.free, sub: 'on free plan' },
          { label: 'Est. MRR', value: fmt(stats.mrr), sub: fmt(stats.arr) + ' ARR' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
            <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-[#111827] mt-1">{s.value}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="search" placeholder="Search client or email…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"/>
        </div>
        <Dropdown clearable placeholder="All plans" value={planFilter} onChange={setPlanFilter}
          options={[{ value:'free',label:'Free' },{ value:'starter',label:'Starter' },{ value:'growth',label:'Growth' },{ value:'scale',label:'Scale' }]}/>
        <Dropdown clearable placeholder="All statuses" value={statusFilter} onChange={setStatusFilter}
          options={[{ value:'active',label:'Active' },{ value:'trialing',label:'Trialing' },{ value:'past_due',label:'Past Due' },{ value:'canceled',label:'Canceled' },{ value:'paused',label:'Paused' }]}/>
        <Dropdown clearable placeholder="All intervals" value={intervalFilter} onChange={setIntervalFilter}
          options={[{ value:'monthly',label:'Monthly' },{ value:'annual',label:'Annual' }]}/>
        {(search || planFilter || statusFilter || intervalFilter) && (
          <button onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setIntervalFilter(''); }}
            className="text-xs text-[#6B7280] hover:text-[#111827] flex items-center gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left">
                <button onClick={() => toggleSort('plan')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                  Plan <SortIcon col="plan"/>
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button onClick={() => toggleSort('status')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                  Status <SortIcon col="status"/>
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Interval</th>
              <th className="px-5 py-3 text-left">
                <button onClick={() => toggleSort('amount')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                  Amount <SortIcon col="amount"/>
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button onClick={() => toggleSort('period_end')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                  Period End <SortIcon col="period_end"/>
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button onClick={() => toggleSort('created')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                  Created <SortIcon col="created"/>
                </button>
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-20"/></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                  {search || planFilter || statusFilter || intervalFilter ? 'No subscriptions match your filters.' : 'No subscriptions yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-[#9CA3AF]">{formatId(s.orgRefId)}</span>
                  </td>
                  <td className="px-5 py-4">
                    {s.orgRefId ? (
                      <Link to={`/clients/${s.orgRefId}`} className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline">
                        {s.orgName ?? '—'}
                      </Link>
                    ) : (
                      <span className="font-medium text-[#111827]">{s.orgName ?? <span className="text-[#9CA3AF]">No org</span>}</span>
                    )}
                    {s.ownerEmail && <p className="text-xs text-[#9CA3AF] mt-0.5">{s.ownerEmail}</p>}
                    {s.cancelAtPeriodEnd && (
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">Cancels at period end</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded capitalize ${PLAN_COLOR[s.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {s.planName}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${STATUS_COLOR[s.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {s.interval ? (
                      <span className="text-xs text-[#374151] capitalize">{s.interval}</span>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-[#111827]">{fmt(s.amountCents)}</span>
                    {s.interval === 'annual' && s.amountCents > 0 && (
                      <p className="text-[10px] text-[#9CA3AF]">{fmt(Math.round(s.amountCents / 12))}/mo</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#9CA3AF]">
                    {s.periodEnd && new Date(s.periodEnd).getFullYear() > 2100 ? '—' : formatDate(s.periodEnd)}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#9CA3AF]">{formatDate(s.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    {s.orgRefId ? (
                      <Link to={`/clients/${s.orgRefId}`} className="text-xs font-medium text-[#0D4C3C] hover:underline">View</Link>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#F8FAF9]">
            <p className="text-xs text-[#9CA3AF]">Showing {filtered.length} of {rows.length} subscriptions</p>
          </div>
        )}
      </div>
    </div>
  );
}
