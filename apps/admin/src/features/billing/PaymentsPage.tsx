import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

type Tab = 'transactions' | 'refunds';

interface BillingRecord {
  id: string;
  userId: string;
  orgRefId: string | null;
  orgName: string | null;
  ownerEmail: string | null;
  planSlug: string;
  planName: string;
  interval: string | null;
  amountCents: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  stripeSubId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
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
  active:   'bg-[#ECFDF5] text-[#065F46]',
  trialing: 'bg-[#EFF6FF] text-[#1D4ED8]',
  past_due: 'bg-[#FEF2F2] text-[#991B1B]',
  canceled: 'bg-[#F3F4F6] text-[#374151]',
  unpaid:   'bg-[#FEF3C7] text-[#92400E]',
  paused:   'bg-[#F3F4F6] text-[#6B7280]',
};

function fmt(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('transactions');
  const [rows, setRows] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'amount' | 'plan' | 'status'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    const [subsRes, plansRes, pricesRes, orgMembersRes] = await Promise.all([
      supabase.from('subscriptions').select('id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id, created_at').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name'),
      supabase.from('plan_prices').select('plan_id, interval, amount_cents').eq('currency', 'USD'),
      supabase.from('org_members').select('user_id, org_id, role').eq('role', 'owner'),
    ]);

    type SubRaw = { id: string; user_id: string; plan_id: string; status: string; billing_interval: string | null; current_period_start: string; current_period_end: string; stripe_subscription_id: string | null; stripe_customer_id: string | null; created_at: string };
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

    const [orgsRes, emailsRes] = await Promise.all([
      orgIds.length > 0 ? supabase.from('organizations').select('id, ref_id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
      ownerUserIds.length > 0 ? supabase.rpc('get_users_email', { user_ids: ownerUserIds }) : Promise.resolve({ data: [] }),
    ]);

    type OrgRaw = { id: string; ref_id: string | null; name: string };
    const orgById = new Map<string, OrgRaw>((orgsRes.data ?? []).map((o: OrgRaw) => [o.id, o]));
    const emailById = new Map<string, string>((emailsRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));

    const enriched: BillingRecord[] = subs.map((s) => {
      const plan = planById.get(s.plan_id);
      const interval = s.billing_interval ?? 'monthly';
      const amountCents = priceMap.get(`${s.plan_id}:${interval}`) ?? priceMap.get(`${s.plan_id}:monthly`) ?? 0;
      const orgId = orgByOwner.get(s.user_id) ?? null;
      const org = orgId ? orgById.get(orgId) : null;
      return {
        id: s.id,
        userId: s.user_id,
        orgRefId: org?.ref_id ?? null,
        orgName: org?.name ?? null,
        ownerEmail: emailById.get(s.user_id) ?? null,
        planSlug: plan?.slug ?? 'free',
        planName: plan?.name ?? 'Free',
        interval: s.billing_interval,
        amountCents,
        status: s.status,
        periodStart: s.current_period_start,
        periodEnd: s.current_period_end,
        stripeSubId: s.stripe_subscription_id,
        stripeCustomerId: s.stripe_customer_id,
        createdAt: s.created_at,
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
    if (dateFrom) r = r.filter((s) => s.createdAt >= dateFrom);
    if (dateTo) r = r.filter((s) => s.createdAt <= dateTo + 'T23:59:59');

    return [...r].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'created') cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortBy === 'plan') cmp = a.planSlug.localeCompare(b.planSlug);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'amount') cmp = a.amountCents - b.amountCents;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, planFilter, statusFilter, intervalFilter, dateFrom, dateTo, sortBy, sortDir]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.planSlug !== 'free' && r.status === 'active');
    const mrr = paid.reduce((sum, r) => sum + (r.interval === 'annual' ? Math.round(r.amountCents / 12) : r.amountCents), 0);
    const totalBilled = paid.reduce((sum, r) => sum + r.amountCents, 0);
    return { mrr, totalBilled, paidCount: paid.length };
  }, [rows]);

  const hasStripe = rows.some((r) => r.stripeSubId);
  const hasActiveFilters = search || planFilter || statusFilter || intervalFilter || dateFrom || dateTo;

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg className={`w-3 h-3 ml-1 flex-shrink-0 transition-opacity ${sortBy === col ? 'opacity-100' : 'opacity-30'}`} viewBox="0 0 12 12" fill="currentColor">
      {sortDir === 'asc' && sortBy === col ? <path d="M6 2l4 5H2z"/> : <path d="M6 10L2 5h8z"/>}
    </svg>
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Payments & Refunds</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Billing records from active subscriptions. Live transactions require Stripe integration.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">MRR</p>
          <p className="text-2xl font-bold text-[#111827] mt-1">{fmt(stats.mrr)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">monthly recurring</p>
        </div>
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">ARR</p>
          <p className="text-2xl font-bold text-[#111827] mt-1">{fmt(stats.mrr * 12)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">annual run rate</p>
        </div>
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">Paying Clients</p>
          <p className="text-2xl font-bold text-[#111827] mt-1">{stats.paidCount}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">active paid subs</p>
        </div>
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">Refunds</p>
          <p className="text-2xl font-bold text-[#111827] mt-1">$0</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">requires Stripe</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAE8] mb-5">
        {(['transactions', 'refunds'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[#0D4C3C] text-[#0D4C3C]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}>
            {t === 'transactions' ? 'Billing Records' : 'Refunds'}
          </button>
        ))}
      </div>

      {tab === 'refunds' ? (
        <div className="bg-white border border-[#E5EAE8] rounded-xl flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-[#374151]">No refund records yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1.5 max-w-xs">Refund history will appear here once Stripe is connected and payment processing is active.</p>
          {!hasStripe && (
            <span className="mt-4 inline-block px-3 py-1.5 text-xs font-semibold bg-[#FEF3C7] text-[#92400E] rounded-lg">Stripe not yet configured</span>
          )}
        </div>
      ) : (
        <>
          {/* Stripe notice */}
          {!hasStripe && (
            <div className="flex items-start gap-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-4 py-3 mb-5 text-sm text-[#92400E]">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <span>Showing subscription-based billing estimates. Actual charge history requires Stripe integration (Phase 6).</span>
            </div>
          )}

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
              options={[{ value:'active',label:'Active' },{ value:'trialing',label:'Trialing' },{ value:'past_due',label:'Past Due' },{ value:'canceled',label:'Canceled' }]}/>
            <Dropdown clearable placeholder="All intervals" value={intervalFilter} onChange={setIntervalFilter}
              options={[{ value:'monthly',label:'Monthly' },{ value:'annual',label:'Annual' }]}/>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-[#E5EAE8] rounded-lg px-2.5 py-2 text-[#374151] focus:outline-none focus:border-[#0D4C3C] bg-white"/>
              <span className="text-xs text-[#9CA3AF]">—</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-[#E5EAE8] rounded-lg px-2.5 py-2 text-[#374151] focus:outline-none focus:border-[#0D4C3C] bg-white"/>
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setIntervalFilter(''); setDateFrom(''); setDateTo(''); }}
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
                    <button onClick={() => toggleSort('amount')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                      Amount <SortIcon col="amount"/>
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Interval</th>
                  <th className="px-5 py-3 text-left">
                    <button onClick={() => toggleSort('status')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                      Status <SortIcon col="status"/>
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Period Start</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Period End</th>
                  <th className="px-5 py-3 text-left">
                    <button onClick={() => toggleSort('created')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">
                      Subscribed <SortIcon col="created"/>
                    </button>
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-20"/></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {hasActiveFilters ? 'No records match your filters.' : 'No billing records yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-[#9CA3AF]">{formatId(r.orgRefId)}</span>
                      </td>
                      <td className="px-5 py-4">
                        {r.orgRefId ? (
                          <Link to={`/clients/${r.orgRefId}`} className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline">
                            {r.orgName ?? '—'}
                          </Link>
                        ) : (
                          <span className="text-[#9CA3AF]">No org</span>
                        )}
                        {r.ownerEmail && <p className="text-xs text-[#9CA3AF] mt-0.5">{r.ownerEmail}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[r.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                          {r.planName}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#111827]">{fmt(r.amountCents)}</span>
                        {r.interval === 'annual' && r.amountCents > 0 && (
                          <p className="text-[10px] text-[#9CA3AF]">{fmt(Math.round(r.amountCents / 12))}/mo</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-[#374151] capitalize">{r.interval ?? '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${STATUS_COLOR[r.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#9CA3AF]">{formatDate(r.periodStart)}</td>
                      <td className="px-5 py-4 text-xs text-[#9CA3AF]">
                        {r.periodEnd && new Date(r.periodEnd).getFullYear() > 2100 ? '—' : formatDate(r.periodEnd)}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#9CA3AF]">{formatDate(r.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {r.orgRefId ? (
                            <Link to={`/clients/${r.orgRefId}`} className="text-xs font-medium text-[#0D4C3C] hover:underline">View</Link>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">—</span>
                          )}
                          {r.stripeCustomerId && (
                            <>
                              <span className="text-[#E5EAE8]">|</span>
                              <span className="text-xs font-mono text-[#9CA3AF]" title={r.stripeCustomerId}>Stripe</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#F8FAF9] flex items-center justify-between">
                <p className="text-xs text-[#9CA3AF]">Showing {filtered.length} of {rows.length} billing records</p>
                <p className="text-xs text-[#374151] font-medium">
                  Total: {fmt(filtered.reduce((s, r) => s + r.amountCents, 0))}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
