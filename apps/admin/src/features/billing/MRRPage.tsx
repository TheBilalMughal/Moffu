import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubRaw {
  id: string;
  plan_id: string;
  status: string;
  billing_interval: string | null;
  created_at: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface PriceRaw { plan_id: string; billing_interval: string; amount_cents: number }
interface PlanRaw  { id: string; slug: string; name: string }

interface EnrichedSub {
  id: string;
  planId: string;
  planSlug: string;
  planName: string;
  amountCents: number;
  status: string;
  interval: string;
  createdAt: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth: 'bg-[#F0FDF4] text-[#15803D]',
  scale: 'bg-[#FFF7ED] text-[#C2410C]',
};
const PLAN_BAR: Record<string, string> = {
  free: '#D1D5DB', starter: '#3B82F6', growth: '#10B981', scale: '#F97316',
};
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoToDate(s: string) { return s ? new Date(s + 'T00:00:00') : null; }
function dateToIso(d: Date): string { return d.toISOString().split('T')[0] ?? ''; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtLabel(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMoney(cents: number, short = false): string {
  if (cents === 0) return '$0';
  const v = cents / 100;
  if (short && v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function today(): string { return new Date().toISOString().split('T')[0] ?? ''; }
function monthStart(monthsAgo = 0): string {
  const n = new Date(); return dateToIso(new Date(n.getFullYear(), n.getMonth() - monthsAgo, 1));
}

// ── Date Range Picker (exact same style as portal ReviewsPage) ─────────────────

function CalMonth({ year, month, from, to, hovered, onDay, onHover }: {
  year: number; month: number; from: Date | null; to: Date | null; hovered: Date | null;
  onDay: (d: Date) => void; onHover: (d: Date | null) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = new Date();
  const rangeEnd = to ?? hovered;
  function inRange(d: Date) {
    if (!from || !rangeEnd) return false;
    const [lo, hi] = from <= rangeEnd ? [from, rangeEnd] : [rangeEnd, from];
    return d > lo && d < hi;
  }
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="w-[216px]">
      <p className="text-xs font-semibold text-[#111827] text-center mb-3">{MONTHS_LONG[month]} {year}</p>
      <div className="grid grid-cols-7">
        {DAYS_SHORT.map((d) => <div key={d} className="h-7 flex items-center justify-center text-[10px] font-medium text-[#9CA3AF]">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="h-7"/>;
          const isStart = !!from && sameDay(d, from);
          const isEnd   = !!rangeEnd && sameDay(d, rangeEnd);
          const range   = inRange(d);
          const isToday = sameDay(d, todayDate);
          return (
            <div key={d.getTime()} onMouseEnter={() => onHover(d)} onMouseLeave={() => onHover(null)} onClick={() => onDay(d)}
              className={['h-7 flex items-center justify-center text-xs cursor-pointer select-none transition-colors',
                isStart || isEnd ? 'bg-[#0D4C3C] text-white font-semibold rounded-md' : '',
                range ? 'bg-[#E6F2EE] text-[#0D4C3C]' : '',
                !isStart && !isEnd && !range ? 'text-[#374151] hover:bg-[#F3F4F6] rounded-md' : '',
                isToday && !isStart && !isEnd ? 'font-bold underline decoration-dotted' : '',
              ].join(' ')}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePicker({ from, to, onChange }: {
  from: string; to: string; onChange: (f: string, t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'from'|'to'>('from');
  const [hovered, setHovered] = useState<Date | null>(null);
  const todayDate = new Date();
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const fromDate = isoToDate(from); const toDate = isoToDate(to);
  const hasValue = !!(from || to);
  const label = from && to ? `${fmtLabel(from)} – ${fmtLabel(to)}` : from ? `From ${fmtLabel(from)}` : 'Date range';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn);
  }, []);

  function handleDay(d: Date) {
    if (selecting === 'from' || !fromDate) { onChange(dateToIso(d), ''); setSelecting('to'); }
    else {
      const [lo, hi] = d >= fromDate ? [fromDate, d] : [d, fromDate];
      onChange(dateToIso(lo), dateToIso(hi)); setSelecting('from'); setOpen(false);
    }
  }
  function preset(f: Date, t: Date) { onChange(dateToIso(f), dateToIso(t)); setSelecting('from'); setOpen(false); }
  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border transition-colors ${hasValue ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-medium' : 'border-[#E5EAE8] text-[#374151] hover:border-[#0D4C3C] hover:text-[#0D4C3C]'}`}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span>{label}</span>
        {hasValue && (
          <span onClick={(e) => { e.stopPropagation(); onChange('', ''); setSelecting('from'); }} className="ml-0.5 hover:text-red-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-[200] bg-white shadow-sm rounded-xl shadow-lg p-4 min-w-max">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); }}
              className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span className="text-xs font-medium text-[#374151]">{MONTHS_LONG[viewMonth]} {viewYear}</span>
            <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); }}
              className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <div className="flex gap-6">
            <CalMonth year={viewYear} month={viewMonth} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered}/>
            <div className="w-px bg-[#F3F4F6]"/>
            <CalMonth year={nextY} month={nextM} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered}/>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">{selecting === 'from' ? 'Select start date' : 'Select end date'}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => { const t = new Date(); preset(new Date(t.getFullYear(), t.getMonth(), 1), t); }} className="text-xs text-[#0D4C3C] font-medium hover:underline">This month</button>
              <button onClick={() => { const t = new Date(); const a = new Date(t); a.setDate(t.getDate() - 29); preset(a, t); }} className="text-xs text-[#0D4C3C] font-medium hover:underline">Last 30 days</button>
              <button onClick={() => { const t = new Date(); const a = new Date(t); a.setDate(t.getDate() - 89); preset(a, t); }} className="text-xs text-[#0D4C3C] font-medium hover:underline">Last 90 days</button>
              {hasValue && <button onClick={() => { onChange('', ''); setSelecting('from'); }} className="text-xs text-[#9CA3AF] hover:text-red-500">Clear</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG Sparkline (MRR trend) ──────────────────────────────────────────────────

function MRRTrendChart({ data }: { data: { label: string; mrr: number; churn: number }[] }) {
  const W = 620; const H = 160;
  const pad = { t: 20, b: 36, l: 48, r: 16 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const maxVal = Math.max(...data.map((d) => d.mrr), 1);
  const slotW = innerW / n;
  const barW = Math.max(slotW * 0.55, 6);
  const churnBarW = barW * 0.6;

  // Y-axis labels (3 levels)
  const yTicks = [0, 0.5, 1];

  function barX(i: number) { return pad.l + slotW * i + slotW / 2; }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Horizontal gridlines + y-axis labels */}
        {yTicks.map((p) => {
          const y = pad.t + (1 - p) * innerH;
          const val = Math.round((p * maxVal) / 100);
          return (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1"/>
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="8" fill="#9CA3AF">
                {p === 0 ? '$0' : `$${val}k`}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="#E5EAE8" strokeWidth="1"/>

        {/* Bars */}
        {data.map((d, i) => {
          const x = barX(i);
          const mrrH = Math.max((d.mrr / maxVal) * innerH, d.mrr > 0 ? 2 : 0);
          const churnH = Math.max((d.churn / maxVal) * innerH * 0.4, d.churn > 0 ? 2 : 0);
          const isLast = i === n - 1;
          return (
            <g key={`${d.label}-${i}`}>
              {/* MRR bar */}
              <rect
                x={x - barW / 2} y={pad.t + innerH - mrrH}
                width={barW} height={mrrH}
                fill={isLast ? '#0D4C3C' : '#B8D4CD'} rx="3"
              />
              {/* Churn bar (below baseline) */}
              {d.churn > 0 && (
                <rect
                  x={x - churnBarW / 2} y={pad.t + innerH + 1}
                  width={churnBarW} height={churnH}
                  fill="#FCA5A5" rx="2"
                />
              )}
              {/* MRR value label on bar if tall enough */}
              {mrrH > 18 && (
                <text x={x} y={pad.t + innerH - mrrH + 11} textAnchor="middle" fontSize="8" fill={isLast ? 'white' : '#6B7280'} fontWeight="600">
                  ${Math.round(d.mrr / 100)}
                </text>
              )}
              {/* Month label */}
              <text x={x} y={H - 8} textAnchor="middle" fontSize="9" fill={isLast ? '#0D4C3C' : '#9CA3AF'} fontWeight={isLast ? '600' : '400'}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Mini Donut ────────────────────────────────────────────────────────────────

function MiniDonut({ pct, color }: { pct: number; color: string }) {
  const r = 15.9; const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4"/>
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"/>
    </svg>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportCSV(subs: EnrichedSub[], dateFrom: string, dateTo: string) {
  const headers = ['ID', 'Plan', 'Interval', 'Status', 'MRR (USD)', 'Period End', 'Created', 'Cancel At Period End'];
  const rows = subs.map((s) => [
    s.id, s.planName, s.interval, s.status,
    (s.amountCents / 100).toFixed(2),
    s.periodEnd, s.createdAt, s.cancelAtPeriodEnd ? 'Yes' : 'No',
  ]);
  const meta = [`"Date range: ${dateFrom || 'all'} to ${dateTo || 'all'}"`];
  const csv = [...meta, [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = `mrr-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MRRPage() {
  const [subs, setSubs] = useState<EnrichedSub[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(monthStart(0));
  const [dateTo, setDateTo] = useState(today());
  const [planFilter, setPlanFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [subsRes, plansRes, pricesRes] = await Promise.all([
      supabase.from('subscriptions').select(
        'id, plan_id, status, billing_interval, created_at, current_period_end, cancel_at_period_end'
      ).order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('currency', 'USD'),
    ]);

    const allPlans = (plansRes.data ?? []) as PlanRaw[];
    const planById = new Map(allPlans.map((p) => [p.id, p]));
    const priceMap = new Map<string, number>();
    ((pricesRes.data ?? []) as PriceRaw[]).forEach((p) =>
      priceMap.set(`${p.plan_id}:${p.billing_interval}`, p.amount_cents));

    const enriched: EnrichedSub[] = ((subsRes.data ?? []) as SubRaw[]).map((s) => {
      const plan = planById.get(s.plan_id);
      const interval = s.billing_interval ?? 'monthly';
      const amountCents = priceMap.get(`${s.plan_id}:${interval}`) ?? priceMap.get(`${s.plan_id}:monthly`) ?? 0;
      return {
        id: s.id, planId: s.plan_id,
        planSlug: plan?.slug ?? 'free',
        planName: plan?.name ?? 'Free',
        amountCents, status: s.status, interval,
        createdAt: s.created_at,
        periodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
      };
    });

    setSubs(enriched);
    setLoading(false);
  }

  // Apply plan/interval filters (not date — date is for movements only)
  const filtered = useMemo(() => {
    let r = subs;
    if (planFilter) r = r.filter((s) => s.planSlug === planFilter);
    if (intervalFilter) r = r.filter((s) => s.interval === intervalFilter);
    return r;
  }, [subs, planFilter, intervalFilter]);

  // KPIs — Total MRR is always current state
  const kpis = useMemo(() => {
    const active = filtered.filter((s) => s.status === 'active');
    const paid = active.filter((s) => s.planSlug !== 'free');
    const totalMRR = paid.reduce((sum, s) => sum + s.amountCents, 0);
    const arpu = paid.length > 0 ? Math.round(totalMRR / paid.length) : 0;

    // Period movements using dateFrom/dateTo (empty = all-time)
    const from = dateFrom || '2000-01-01'; const to = dateTo || today();
    const newSubs = paid.filter((s) => s.createdAt.slice(0, 10) >= from && s.createdAt.slice(0, 10) <= to);
    const newMRR = newSubs.reduce((sum, s) => sum + s.amountCents, 0);

    // Churn: canceled OR cancel_at_period_end with period_end in range
    const churnedSubs = filtered.filter((s) =>
      s.planSlug !== 'free' &&
      (s.status === 'canceled' || s.cancelAtPeriodEnd) &&
      s.periodEnd.slice(0, 10) >= from && s.periodEnd.slice(0, 10) <= to
    );
    const churnMRR = churnedSubs.reduce((sum, s) => sum + s.amountCents, 0);
    const netMRR = newMRR - churnMRR;

    // Monthly churn rate for LTV
    const churnRate = paid.length > 0 ? churnedSubs.length / paid.length : 0;
    const ltv = churnRate > 0 ? Math.round(arpu / churnRate) : 0;

    // Opening MRR approximation
    const openingMRR = Math.max(0, totalMRR - newMRR + churnMRR);

    return {
      totalMRR, arr: totalMRR * 12,
      paidCount: paid.length, arpu, ltv,
      newMRR, newCount: newSubs.length,
      churnMRR, churnCount: churnedSubs.length,
      netMRR, churnRate,
      openingMRR,
      atRisk: paid.filter((s) => s.cancelAtPeriodEnd || s.status === 'past_due').length,
    };
  }, [filtered, dateFrom, dateTo]);

  // Plan breakdown
  const planBreakdown = useMemo(() => {
    const slugs = ['free', 'starter', 'growth', 'scale'];
    const NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', scale: 'Scale' };
    const active = filtered.filter((s) => s.status === 'active');
    const total = active.length || 1;
    return slugs.map((slug) => {
      const rows = active.filter((s) => s.planSlug === slug);
      const mrr = rows.reduce((sum, s) => sum + s.amountCents, 0);
      return { slug, name: NAMES[slug], count: rows.length, mrr, pct: Math.round((rows.length / total) * 100) };
    });
  }, [filtered]);

  const maxPlanMRR = Math.max(...planBreakdown.map((d) => d.mrr), 1);

  // 12-month trend
  const trendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthsAgo = 11 - i;
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
      const fromIso = dateToIso(from); const toIso = dateToIso(to);

      const newPaid = filtered.filter(
        (s) => s.planSlug !== 'free' && s.status === 'active' &&
               s.createdAt.slice(0, 10) >= fromIso && s.createdAt.slice(0, 10) <= toIso
      );
      const churnedMonth = filtered.filter(
        (s) => s.planSlug !== 'free' && (s.status === 'canceled' || s.cancelAtPeriodEnd) &&
               s.periodEnd.slice(0, 10) >= fromIso && s.periodEnd.slice(0, 10) <= toIso
      );
      return {
        label: MONTHS_SHORT[from.getMonth()] ?? '',
        mrr: newPaid.reduce((sum, s) => sum + s.amountCents, 0),
        churn: churnedMonth.reduce((sum, s) => sum + s.amountCents, 0),
      };
    });
  }, [filtered]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  const planOpts = [
    { value: '', label: 'All Plans' },
    { value: 'free', label: 'Free' },
    { value: 'starter', label: 'Starter' },
    { value: 'growth', label: 'Growth' },
    { value: 'scale', label: 'Scale' },
  ];
  const intervalOpts = [
    { value: '', label: 'All Intervals' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'annual', label: 'Annual' },
  ];

  return (
    <div className="h-full overflow-y-auto px-8 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">MRR Dashboard</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Monthly recurring revenue and growth metrics.</p>
        </div>
        <button onClick={() => exportCSV(filtered, dateFrom, dateTo)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}/>
        <Dropdown options={planOpts} value={planFilter} onChange={setPlanFilter} placeholder="All Plans" clearable/>
        <Dropdown options={intervalOpts} value={intervalFilter} onChange={setIntervalFilter} placeholder="All Intervals" clearable/>
        {(planFilter || intervalFilter) && (
          <button onClick={() => { setPlanFilter(''); setIntervalFilter(''); }}
            className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors px-2 py-1.5">
            Clear filters
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Total MRR',     value: fmtMoney(kpis.totalMRR), sub: `${fmtMoney(kpis.arr)} ARR`,             color: '' },
          { label: 'New MRR',       value: fmtMoney(kpis.newMRR),   sub: `${kpis.newCount} new in period`,        color: kpis.newMRR > 0 ? 'text-[#0D4C3C]' : '' },
          { label: 'Churned MRR',   value: fmtMoney(kpis.churnMRR), sub: `${kpis.churnCount} churn in period`,    color: kpis.churnMRR > 0 ? 'text-red-600' : '' },
          { label: 'Net MRR',       value: (kpis.netMRR >= 0 ? '+' : '') + fmtMoney(kpis.netMRR), sub: 'New − Churned', color: kpis.netMRR > 0 ? 'text-[#0D4C3C]' : kpis.netMRR < 0 ? 'text-red-600' : '' },
          { label: 'ARPU',          value: fmtMoney(kpis.arpu),     sub: 'avg revenue / user',                    color: '' },
          { label: 'LTV Estimate',  value: kpis.ltv > 0 ? fmtMoney(kpis.ltv) : 'N/A', sub: kpis.churnRate > 0 ? `${(kpis.churnRate * 100).toFixed(1)}% mo. churn` : 'need churn data', color: '' },
        ].map((c) => (
          <div key={c.label} className="bg-white shadow-sm rounded-xl px-4 py-4">
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color || 'text-[#111827]'}`}>{c.value}</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* MRR Movements Waterfall */}
      <div className="bg-white shadow-sm rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-[#111827] mb-1">MRR Movements</h2>
        <p className="text-xs text-[#9CA3AF] mb-5">{dateFrom && dateTo ? `${fmtLabel(dateFrom)} — ${fmtLabel(dateTo)}` : 'All time'}</p>
        <div className="flex items-stretch gap-2">
          {/* Opening */}
          <div className="flex-1 bg-[#F8FAF9] rounded-lg p-3 text-center">
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1">Opening MRR</p>
            <p className="text-lg font-bold text-[#111827]">{fmtMoney(kpis.openingMRR, true)}</p>
          </div>

          <div className="flex items-center text-[#9CA3AF] px-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </div>

          {/* New */}
          <div className="flex-1 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 text-center">
            <p className="text-[10px] text-[#15803D] uppercase tracking-wide mb-1">+ New</p>
            <p className="text-lg font-bold text-[#15803D]">+{fmtMoney(kpis.newMRR, true)}</p>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">{kpis.newCount} subscriptions</p>
          </div>

          <div className="flex items-center text-[#9CA3AF] px-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </div>

          {/* Churn */}
          <div className="flex-1 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 text-center">
            <p className="text-[10px] text-[#991B1B] uppercase tracking-wide mb-1">− Churned</p>
            <p className="text-lg font-bold text-[#991B1B]">-{fmtMoney(kpis.churnMRR, true)}</p>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">{kpis.churnCount} lost</p>
          </div>

          <div className="flex items-center text-[#9CA3AF] px-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </div>

          {/* Net Change */}
          <div className={`flex-1 rounded-lg p-3 text-center border ${kpis.netMRR >= 0 ? 'bg-[#E6F2EE] border-[#0D4C3C]/20' : 'bg-[#FEF2F2] border-red-200'}`}>
            <p className={`text-[10px] uppercase tracking-wide mb-1 ${kpis.netMRR >= 0 ? 'text-[#0D4C3C]' : 'text-[#991B1B]'}`}>Net Change</p>
            <p className={`text-lg font-bold ${kpis.netMRR >= 0 ? 'text-[#0D4C3C]' : 'text-[#991B1B]'}`}>
              {kpis.netMRR >= 0 ? '+' : ''}{fmtMoney(kpis.netMRR, true)}
            </p>
          </div>

          <div className="flex items-center text-[#9CA3AF] px-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </div>

          {/* Closing */}
          <div className="flex-1 bg-[#0D4C3C] rounded-lg p-3 text-center">
            <p className="text-[10px] text-[#A7C9C0] uppercase tracking-wide mb-1">Closing MRR</p>
            <p className="text-lg font-bold text-white">{fmtMoney(kpis.totalMRR, true)}</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        {/* Trend chart */}
        <div className="col-span-3 bg-white shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-[#111827]">New MRR — 12 Month Trend</h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0D4C3C] inline-block"/>Current month
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FCA5A5] inline-block"/>Churn
              </span>
            </div>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">New paid subscriptions acquired each month</p>
          <MRRTrendChart data={trendData}/>
        </div>

        {/* Plan breakdown */}
        <div className="col-span-2 bg-white shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#111827] mb-4">MRR by Plan</h2>
          <div className="space-y-4">
            {planBreakdown.map((d) => (
              <div key={d.slug}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[d.slug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{d.name}</span>
                    <span className="text-xs text-[#9CA3AF]">{d.count}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">{fmtMoney(d.mrr, true)}<span className="text-xs font-normal text-[#9CA3AF]">/mo</span></span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: d.mrr > 0 ? `${(d.mrr / maxPlanMRR) * 100}%` : '2px', backgroundColor: PLAN_BAR[d.slug] ?? '#9CA3AF' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Mix */}
      <div className="bg-white shadow-sm rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#111827] mb-5">Plan Mix</h2>
        <div className="grid grid-cols-4 gap-6">
          {planBreakdown.map((d) => (
            <div key={d.slug} className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <MiniDonut pct={d.pct} color={PLAN_BAR[d.slug] ?? '#9CA3AF'}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-[#111827]">{d.pct}%</span>
                </div>
              </div>
              <div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded inline-block mb-1 ${PLAN_COLOR[d.slug] ?? ''}`}>{d.name}</span>
                <p className="text-sm font-bold text-[#111827]">{d.count} <span className="text-xs font-normal text-[#9CA3AF]">active</span></p>
                <p className="text-xs text-[#9CA3AF]">{fmtMoney(d.mrr, true)}/mo</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
