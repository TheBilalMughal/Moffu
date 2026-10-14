import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BillingRecord {
  subId: string;
  userId: string;
  orgId: string | null;
  orgRefId: string | null;
  orgName: string | null;
  ownerEmail: string | null;
  planSlug: string;
  planName: string;
  amountCents: number;
  interval: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  stripeSubId: string | null;
  nextChargeCents: number;
  nextChargeDate: string | null;
}

interface SavedFilter {
  name: string;
  plan: string;
  status: string;
  interval: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth: 'bg-[#F0FDF4] text-[#15803D]',
  scale: 'bg-[#FFF7ED] text-[#C2410C]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_BAR: Record<string, string> = {
  free: '#D1D5DB', starter: '#3B82F6', growth: '#10B981', scale: '#F97316', pro: '#10B981', enterprise: '#F97316',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-[#ECFDF5] text-[#065F46]',
  trialing: 'bg-[#EFF6FF] text-[#1D4ED8]',
  past_due: 'bg-[#FEF2F2] text-[#991B1B]',
  canceled: 'bg-[#F3F4F6] text-[#374151]',
  unpaid: 'bg-[#FEF3C7] text-[#92400E]',
  paused: 'bg-[#F3F4F6] text-[#6B7280]',
};

const PAGE_SIZE = 25;
const LS_SAVED = 'admin_pay_saved_filters';

function fmt(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function loadSaved(): SavedFilter[] {
  try { return JSON.parse(localStorage.getItem(LS_SAVED) ?? '[]'); } catch { return []; }
}

function exportCSV(rows: BillingRecord[]) {
  const headers = ['ID', 'Client', 'Email', 'Plan', 'Status', 'Interval', 'Amount', 'Next Charge', 'Period Start', 'Period End', 'Stripe Sub', 'Created'];
  const data = rows.map((r) => [
    formatId(r.orgRefId), r.orgName ?? '', r.ownerEmail ?? '',
    r.planName, r.status, r.interval ?? '—',
    (r.amountCents / 100).toFixed(2),
    r.nextChargeCents > 0 ? (r.nextChargeCents / 100).toFixed(2) : '—',
    r.periodStart, r.periodEnd,
    r.stripeSubId ?? '—', r.createdAt,
  ]);
  const csv = [headers, ...data]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── MRR Trend Chart (SVG) ──────────────────────────────────────────────────────

function MrrTrendChart({ records }: { records: BillingRecord[] }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      return { isoKey, label };
    });
  }, []);

  const data = useMemo(() => {
    return months.map(({ isoKey, label }) => {
      const inMonth = records.filter((r) => r.status === 'active' && r.createdAt.slice(0, 7) <= isoKey && (r.periodEnd.slice(0, 7) >= isoKey || r.periodEnd > isoKey));
      const mrr = inMonth.reduce((s, r) => s + (r.interval === 'annual' ? Math.round(r.amountCents / 12) : r.amountCents), 0);
      return { label, mrr };
    });
  }, [records, months]);

  const maxMrr = Math.max(...data.map((d) => d.mrr), 1);
  const W = 560; const H = 120; const PAD_L = 48; const PAD_R = 12; const PAD_T = 12; const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const pts = data.map((d, i) => ({
    x: PAD_L + (i / (data.length - 1)) * plotW,
    y: PAD_T + plotH - (d.mrr / maxMrr) * plotH,
    mrr: d.mrr, label: d.label,
  }));

  function smoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';
    let d = `M ${points[0]!.x},${points[0]!.y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!; const curr = points[i]!;
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
    }
    return d;
  }

  const linePath = smoothPath(pts);
  const areaPath = linePath + ` L ${pts[pts.length - 1]!.x},${PAD_T + plotH} L ${pts[0]!.x},${PAD_T + plotH} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD_T + plotH - f * plotH,
    label: fmt(Math.round(maxMrr * f)),
  }));

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl p-5 mb-5">
      <h3 className="text-sm font-semibold text-[#111827] mb-4">MRR Trend — Last 12 Months</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D4C3C" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#0D4C3C" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke="#F3F4F6" strokeWidth="1"/>
            <text x={PAD_L - 4} y={g.y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{g.label}</text>
          </g>
        ))}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#9CA3AF">{p.label}</text>
        ))}
        <path d={areaPath} fill="url(#mrrGrad)"/>
        <path d={linePath} fill="none" stroke="#0D4C3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#0D4C3C"/>
            <title>{p.label}: {fmt(p.mrr)}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Revenue by Plan Chart ──────────────────────────────────────────────────────

function RevByPlanChart({ records }: { records: BillingRecord[] }) {
  const plans = ['free', 'starter', 'growth', 'scale'];
  const PLAN_NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', scale: 'Scale' };
  const data = plans.map((slug) => {
    const planRows = records.filter((r) => r.planSlug === slug && r.status === 'active');
    const mrr = planRows.reduce((s, r) => s + (r.interval === 'annual' ? Math.round(r.amountCents / 12) : r.amountCents), 0);
    return { slug, mrr, count: planRows.length };
  }).filter((d) => d.mrr > 0 || d.count > 0);

  const maxMrr = Math.max(...data.map((d) => d.mrr), 1);

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl p-5 mb-5">
      <h3 className="text-sm font-semibold text-[#111827] mb-4">Revenue by Plan</h3>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.slug} className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded w-16 text-center ${PLAN_COLOR[d.slug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{PLAN_NAMES[d.slug]}</span>
            <div className="flex-1 bg-[#F3F4F6] rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${(d.mrr / maxMrr) * 100}%`, backgroundColor: PLAN_BAR[d.slug] ?? '#9CA3AF' }}/>
            </div>
            <span className="text-xs font-semibold text-[#374151] w-16 text-right">{fmt(d.mrr)}/mo</span>
            <span className="text-xs text-[#9CA3AF] w-12 text-right">{d.count} clients</span>
          </div>
        ))}
        {data.length === 0 && <p className="text-xs text-[#9CA3AF] text-center py-4">No active paid subscriptions yet.</p>}
      </div>
    </div>
  );
}

// ── Saved Filters Popover ──────────────────────────────────────────────────────

function SavedFiltersPopover({ current, onLoad, onClose }: {
  current: Omit<SavedFilter, 'name'>;
  onLoad: (f: SavedFilter) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<SavedFilter[]>(loadSaved());
  const [name, setName] = useState('');

  function saveNow() {
    if (!name.trim()) return;
    const next: SavedFilter[] = [...saved, { name: name.trim(), ...current }];
    localStorage.setItem(LS_SAVED, JSON.stringify(next));
    setSaved(next); setName('');
  }

  function remove(i: number) {
    const next = saved.filter((_, idx) => idx !== i);
    localStorage.setItem(LS_SAVED, JSON.stringify(next));
    setSaved(next);
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5EAE8] rounded-xl shadow-lg z-30 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F3F4F6]">
        <p className="text-xs font-semibold text-[#374151] mb-2">Save current filters</p>
        <div className="flex gap-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Filter name…"
            className="flex-1 text-xs border border-[#E5EAE8] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#0D4C3C]"/>
          <button onClick={saveNow} disabled={!name.trim()}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-40 rounded-lg transition-colors">Save</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {saved.length === 0 ? (
          <p className="px-4 py-4 text-xs text-[#9CA3AF] text-center">No saved filters yet.</p>
        ) : (
          <div className="divide-y divide-[#F9FAFB]">
            {saved.map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                <button onClick={() => { onLoad(s); onClose(); }} className="flex-1 text-xs text-left font-medium text-[#374151] hover:text-[#0D4C3C] truncate">{s.name}</button>
                <button onClick={() => remove(i)} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function PaymentsPage() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'billing' | 'refunds'>('billing');

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<'created' | 'plan' | 'status' | 'amount' | 'next_charge'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);

  // Saved filters
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [subsRes, plansRes, pricesRes, orgMembersRes] = await Promise.all([
      supabase.from('subscriptions').select('id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, created_at').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      supabase.from('plan_prices').select('plan_id, interval, amount_cents').eq('currency', 'USD'),
      supabase.from('org_members').select('user_id, org_id').eq('role', 'owner'),
    ]);

    type SubRaw = { id: string; user_id: string; plan_id: string; status: string; billing_interval: string | null; current_period_start: string; current_period_end: string; cancel_at_period_end: boolean; stripe_subscription_id: string | null; created_at: string };
    type PlanRaw = { id: string; slug: string; name: string };
    type PriceRaw = { plan_id: string; interval: string; amount_cents: number };
    type OrgMemberRaw = { user_id: string; org_id: string };

    const subs = (subsRes.data ?? []) as SubRaw[];
    const allPlans = (plansRes.data ?? []) as PlanRaw[];
    const planById = new Map<string, PlanRaw>(allPlans.map((p) => [p.id, p]));
    const priceMap = new Map<string, number>();
    (pricesRes.data ?? []).forEach((p: PriceRaw) => priceMap.set(`${p.plan_id}:${p.interval}`, p.amount_cents));
    const orgByOwner = new Map<string, string>((orgMembersRes.data ?? []).map((m: OrgMemberRaw) => [m.user_id, m.org_id]));

    const orgIds = [...new Set([...orgByOwner.values()])];
    const ownerUserIds = subs.map((s) => s.user_id);

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
      const periodEnd = new Date(s.current_period_end);
      const nextChargeDate = s.status === 'active' && periodEnd.getFullYear() < 2100
        ? s.current_period_end : null;
      return {
        subId: s.id, userId: s.user_id,
        orgId, orgRefId: org?.ref_id ?? null, orgName: org?.name ?? null,
        ownerEmail: emailById.get(s.user_id) ?? null,
        planSlug: plan?.slug ?? 'free', planName: plan?.name ?? 'Free',
        amountCents, interval: s.billing_interval,
        status: s.status,
        periodStart: s.current_period_start, periodEnd: s.current_period_end,
        createdAt: s.created_at,
        stripeSubId: s.stripe_subscription_id,
        nextChargeCents: s.status === 'active' ? amountCents : 0,
        nextChargeDate,
      };
    });

    setRecords(enriched);
    setLoading(false);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    let r = records;
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
      else if (sortBy === 'next_charge') cmp = (a.nextChargeDate ?? '').localeCompare(b.nextChargeDate ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [records, search, planFilter, statusFilter, intervalFilter, dateFrom, dateTo, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const paid = records.filter((r) => r.planSlug !== 'free' && r.status === 'active');
    const mrr = paid.reduce((s, r) => s + (r.interval === 'annual' ? Math.round(r.amountCents / 12) : r.amountCents), 0);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const newPaid = records.filter((r) => r.planSlug !== 'free' && r.createdAt >= thisMonthStart).length;
    const churned = records.filter((r) => ['past_due', 'canceled'].includes(r.status) && r.planSlug !== 'free').length;
    return { mrr, arr: mrr * 12, payingClients: paid.length, newPaid, churned };
  }, [records]);

  const hasStripe = records.some((r) => r.stripeSubId);
  const hasActiveFilters = search || planFilter || statusFilter || intervalFilter || dateFrom || dateTo;
  const filteredTotal = filtered.reduce((s, r) => s + (r.planSlug !== 'free' ? r.amountCents : 0), 0);

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg className={`w-3 h-3 ml-1 flex-shrink-0 ${sortBy === col ? 'opacity-100' : 'opacity-25'}`} viewBox="0 0 12 12" fill="currentColor">
      {sortDir === 'asc' && sortBy === col ? <path d="M6 2l4 5H2z"/> : <path d="M6 10L2 5h8z"/>}
    </svg>
  );

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Payments &amp; Refunds</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Billing records derived from active subscriptions.</p>
        </div>
        <div className="flex items-center gap-2 relative">
          {activeTab === 'billing' && (
            <>
              <div className="relative">
                <button onClick={() => setShowSaved((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                  Saved Filters
                </button>
                {showSaved && (
                  <SavedFiltersPopover
                    current={{ plan: planFilter, status: statusFilter, interval: intervalFilter, search, dateFrom, dateTo }}
                    onLoad={(f) => { setPlanFilter(f.plan); setStatusFilter(f.status); setIntervalFilter(f.interval); setSearch(f.search); setDateFrom(f.dateFrom); setDateTo(f.dateTo); setPage(1); }}
                    onClose={() => setShowSaved(false)}
                  />
                )}
              </div>
              <button onClick={() => exportCSV(filtered)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'MRR', value: fmt(stats.mrr), sub: 'monthly recurring' },
          { label: 'ARR', value: fmt(stats.arr), sub: 'annual run rate' },
          { label: 'Paying Clients', value: stats.payingClients, sub: 'active paid plans' },
          { label: 'New This Month', value: stats.newPaid, sub: 'new paid subs' },
          { label: 'Churned', value: stats.churned, sub: 'past due or canceled' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E5EAE8] rounded-xl px-4 py-4">
            <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-[#111827] mt-1">{s.value}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {!loading && (
        <>
          <MrrTrendChart records={records}/>
          <RevByPlanChart records={records}/>
        </>
      )}

      {/* No Stripe banner */}
      {!loading && !hasStripe && (
        <div className="flex items-start gap-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-5 py-4 mb-5">
          <svg className="w-4 h-4 text-[#92400E] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <p className="text-xs font-semibold text-[#92400E]">Stripe not yet configured</p>
            <p className="text-xs text-[#92400E]/80 mt-0.5">No Stripe subscription IDs found. These records are derived from Supabase data. Connect Stripe in Phase 6 to enable live payment tracking, invoices, and refunds.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAE8] mb-5">
        {(['billing', 'refunds'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'border-[#0D4C3C] text-[#0D4C3C]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}>
            {tab === 'billing' ? 'Billing Records' : 'Refunds'}
          </button>
        ))}
      </div>

      {activeTab === 'refunds' && (
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-8 py-12 text-center">
          <svg className="w-10 h-10 text-[#E5EAE8] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          <p className="text-sm font-semibold text-[#374151] mb-1">Stripe not yet configured</p>
          <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto">Refund management will be available after Stripe integration is configured in Phase 6. All refunds will be tracked, audited, and reconciled here.</p>
        </div>
      )}

      {activeTab === 'billing' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="search" placeholder="Search client or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"/>
            </div>
            <Dropdown clearable placeholder="All plans" value={planFilter} onChange={(v) => { setPlanFilter(v); setPage(1); }}
              options={[{ value:'free',label:'Free' },{ value:'starter',label:'Starter' },{ value:'growth',label:'Growth' },{ value:'scale',label:'Scale' }]}/>
            <Dropdown clearable placeholder="All statuses" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[{ value:'active',label:'Active' },{ value:'trialing',label:'Trialing' },{ value:'past_due',label:'Past Due' },{ value:'canceled',label:'Canceled' },{ value:'paused',label:'Paused' }]}/>
            <Dropdown clearable placeholder="All intervals" value={intervalFilter} onChange={(v) => { setIntervalFilter(v); setPage(1); }}
              options={[{ value:'monthly',label:'Monthly' },{ value:'annual',label:'Annual' }]}/>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="text-xs border border-[#E5EAE8] rounded-xl px-3 py-2 text-[#374151] focus:outline-none focus:border-[#0D4C3C]"/>
            <span className="text-xs text-[#9CA3AF]">—</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="text-xs border border-[#E5EAE8] rounded-xl px-3 py-2 text-[#374151] focus:outline-none focus:border-[#0D4C3C]"/>
            {hasActiveFilters && (
              <button onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setIntervalFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('plan')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Plan <SortIcon col="plan"/></button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('status')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Status <SortIcon col="status"/></button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Interval</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('amount')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Amount <SortIcon col="amount"/></button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('next_charge')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Next Charge <SortIcon col="next_charge"/></button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('created')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Created <SortIcon col="created"/></button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Stripe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (<td key={j} className="px-4 py-4"><div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-16"/></td>))}</tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                    {hasActiveFilters ? 'No records match your filters.' : 'No billing records yet.'}
                  </td></tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.subId} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-[#9CA3AF]">{formatId(r.orgRefId)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          {r.orgRefId ? (
                            <Link to={`/clients/${r.orgRefId}`} className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline text-sm">{r.orgName ?? '—'}</Link>
                          ) : (
                            <span className="font-medium text-[#111827] text-sm">{r.orgName ?? <span className="text-[#9CA3AF]">No org</span>}</span>
                          )}
                          {r.ownerEmail && <p className="text-xs text-[#9CA3AF] mt-0.5 truncate max-w-[160px]">{r.ownerEmail}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[r.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{r.planName}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${STATUS_COLOR[r.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{r.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#374151] capitalize">{r.interval ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium text-[#111827]">{r.planSlug === 'free' ? <span className="text-[#9CA3AF]">Free</span> : fmt(r.amountCents)}</span>
                        {r.interval === 'annual' && r.amountCents > 0 && (
                          <p className="text-[10px] text-[#9CA3AF]">{fmt(Math.round(r.amountCents / 12))}/mo</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.nextChargeDate ? (
                          <div>
                            <p className="text-xs font-medium text-[#374151]">{fmt(r.nextChargeCents)}</p>
                            <p className="text-[10px] text-[#9CA3AF]">{formatDate(r.nextChargeDate)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#9CA3AF]">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {r.stripeSubId ? (
                          <span className="font-mono text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{r.stripeSubId.slice(0, 14)}…</span>
                        ) : (
                          <span className="text-xs text-[#D1D5DB]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer with total + pagination */}
            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#F8FAF9] flex items-center justify-between">
                {totalPages > 1 ? (
                  <p className="text-xs text-[#9CA3AF]">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                ) : (
                  <p className="text-xs text-[#9CA3AF]">Showing {filtered.length} of {records.length}</p>
                )}
                <div className="flex items-center gap-6">
                  {filteredTotal > 0 && (
                    <p className="text-xs font-semibold text-[#374151]">
                      Filtered total: <span className="text-[#0D4C3C]">{fmt(filteredTotal)}</span>
                    </p>
                  )}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button disabled={page === 1} onClick={() => setPage(1)}
                        className="p-1.5 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                      </button>
                      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                        className="p-1.5 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                        const p = start + i;
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`w-7 h-7 text-xs rounded transition-colors ${p === page ? 'bg-[#0D4C3C] text-white' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}>
                            {p}
                          </button>
                        );
                      })}
                      <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                        className="p-1.5 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </button>
                      <button disabled={page === totalPages} onClick={() => setPage(totalPages)}
                        className="p-1.5 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
