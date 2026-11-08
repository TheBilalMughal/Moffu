import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { refToSlug } from '@/lib/format';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { DateRangePicker } from '@/components/DateRangePicker';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  let g: string;
  if (h >= 5  && h < 12) g = `gm, ${name}.`;
  else if (h >= 12 && h < 17) g = `hey ${name}.`;
  else if (h >= 17 && h < 21) g = `sup ${name}.`;
  else g = `still up, ${name}?`;
  return g.charAt(0).toUpperCase() + g.slice(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface KpiData {
  totalOrgs: number;
  newOrgsThisMonth: number;
  totalUsers: number;
  newUsersThisMonth: number;
  activeSubs: number;
  mrrCents: number;
  mrrLastMonthCents: number;
  totalReviews: number;
  reviewsToday: number;
  connectedGoogle: number;
  aiDrafts: number;
}

interface DailyCount { date: string; count: number }
interface MonthlyCount { month: string; count: number }  // "YYYY-MM"
interface StatusCount { status: string; count: number }
interface PlanCount { slug: string; name: string; count: number; color: string; bar: string }

interface TopOrg {
  id: string;
  name: string;
  ref_id: string;
  createdAt: string;
  planName: string;
  planSlug: string;
  reviewCount: number;
}

interface AuditRow {
  id: string;
  action: string;
  resource_type: string | null;
  created_at: string;
  actorEmail: string;
  orgName: string;
}

interface ActionItem {
  id: string;
  kind: 'past_due' | 'google_failed' | 'no_connection';
  label: string;
  detail: string;
  href: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free:    'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth:  'bg-[#F0F9FF] text-[#0369A1]',
  scale:   'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_BAR: Record<string, string> = {
  free: '#D1D5DB', starter: '#3B82F6', growth: '#0EA5E9', scale: '#F97316',
};

const REVIEW_STATUS_COLOR: Record<string, { fill: string; label: string }> = {
  new:       { fill: '#6B7280', label: 'New' },
  pending:   { fill: '#F59E0B', label: 'Pending' },
  draft:     { fill: '#3B82F6', label: 'Draft Ready' },
  replied:   { fill: '#8B5CF6', label: 'Replied' },
  published: { fill: '#0EA5E9', label: 'Published' },
  ignored:   { fill: '#D1D5DB', label: 'Ignored' },
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number) {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}

function pctChange(current: number, previous: number): { sign: '+' | '-' | ''; value: string; up: boolean } {
  if (previous === 0 && current === 0) return { sign: '', value: '0%', up: true };
  if (previous === 0) return { sign: '+', value: '100%', up: true };
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return { sign: up ? '+' : '-', value: `${Math.abs(pct).toFixed(0)}%`, up };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function monthStart(monthsAgo = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isoToYYYYMM(iso: string) {
  return iso.slice(0, 7);
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function BarChart({ data, label, color = '#0D4C3C', height = 90 }: {
  data: { label: string; value: number }[];
  label?: string;
  color?: string;
  height?: number;
}) {
  const W = 400;
  const padL = 4;
  const padR = 4;
  const plotW = W - padL - padR;
  const labelH = data.length <= 15 ? 18 : 0;
  const totalH = height + labelH;

  const max = Math.max(...data.map(d => d.value), 1);
  // gentle grid: 3 horizontal lines at 25%, 50%, 75%
  const gridLines = [0.25, 0.5, 0.75, 1].map(f => Math.round(f * max));

  const n = data.length;
  const barW = Math.max(3, Math.floor((plotW / n) * 0.6));
  const slotW = plotW / n;

  return (
    <div>
      {label && <p className="text-xs text-[#9CA3AF] mb-2">{label}</p>}
      <svg viewBox={`0 0 ${W} ${totalH}`} className="w-full" style={{ height: totalH }}>
        {/* Grid lines */}
        {gridLines.map((v, i) => {
          const y = height - Math.round((v / max) * height);
          return (
            <line key={i} x1={padL} x2={W - padR} y1={y} y2={y}
              stroke="#F3F4F6" strokeWidth={1} />
          );
        })}

        {/* Baseline */}
        <line x1={padL} x2={W - padR} y1={height} y2={height}
          stroke="#E5EAE8" strokeWidth={1} />

        {/* Bars */}
        {data.map((d, i) => {
          const slotCenter = padL + i * slotW + slotW / 2;
          const x = slotCenter - barW / 2;
          const barH = d.value === 0 ? 0 : Math.max(3, Math.round((d.value / max) * (height - 4)));
          const y = height - barH;
          return (
            <g key={i}>
              {/* Background slot — subtle hover area feel */}
              <rect x={padL + i * slotW} y={0} width={slotW} height={height} fill="transparent" />
              {/* Bar */}
              {barH > 0 && (
                <rect x={x} y={y} width={barW} height={barH} rx={2}
                  fill={color} opacity={0.85} />
              )}
              {/* Zero-day dot */}
              {d.value === 0 && (
                <circle cx={slotCenter} cy={height - 1} r={1.5} fill="#E5EAE8" />
              )}
              {/* Label */}
              {data.length <= 15 && d.label && (
                <text x={slotCenter} y={height + 13} textAnchor="middle"
                  fontSize={9} fill="#9CA3AF">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ segments, size = 120 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5EAE8" strokeWidth={14} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="#9CA3AF">No data</text>
      </svg>
    );
  }

  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={14} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const thisOffset = offset;
        offset += dash;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={14}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-thisOffset + circumference * 0.25}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={16} fontWeight="700" fill="#111827">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#9CA3AF">total</text>
    </svg>
  );
}

function SparkLine({ data, color = '#0D4C3C' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, sparkData, icon, loading,
}: {
  label: string;
  value: string | number;
  sub?: string | undefined;
  trend?: { sign: '+' | '-' | ''; value: string; up: boolean } | undefined;
  sparkData?: number[] | undefined;
  icon: React.ReactNode;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl px-5 py-4 animate-pulse">
        <div className="h-3 bg-[#F3F4F6] rounded w-20 mb-3" />
        <div className="h-7 bg-[#F3F4F6] rounded w-16" />
      </div>
    );
  }
  return (
    <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl px-5 py-4 hover:border-[#D8CCFF] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide leading-tight">{label}</p>
        <div className="w-7 h-7 bg-[#D8CCFF] text-[#111111] flex items-center justify-center rounded-lg flex-shrink-0">{icon}</div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-[#111827] leading-none">{value}</p>
          {sub && <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${trend.up ? 'text-[#0369A1]' : 'text-red-600'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d={trend.up ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
              {trend.sign}{trend.value} this month
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <SparkLine data={sparkData} color={trend?.up === false ? '#DC2626' : '#6C55E8'} />
        )}
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Health Bar ────────────────────────────────────────────────────────────────

function HealthBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#374151]">{label}</span>
        <span className="text-xs font-semibold text-[#111827]">{count}</span>
      </div>
      <div className="w-full bg-[#F3F4F6] rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAdminAuthStore();
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.display_name) setProfileName(data.display_name); });
  }, [user?.id]);

  const displayName = profileName
    ?? user?.user_metadata?.display_name
    ?? user?.user_metadata?.full_name
    ?? user?.email?.split('@')[0]
    ?? 'admin';
  const greeting = getGreeting(displayName);

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [dailyOrgs, setDailyOrgs] = useState<DailyCount[]>([]);
  const [monthlyOrgs, setMonthlyOrgs] = useState<MonthlyCount[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<StatusCount[]>([]);
  const [planCounts, setPlanCounts] = useState<PlanCount[]>([]);
  const [googleStates, setGoogleStates] = useState<StatusCount[]>([]);
  const [subStates, setSubStates] = useState<StatusCount[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditRow[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // ── Fetch KPIs ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadKpis() {
      setKpiLoading(true);
      const ms = monthStart(0);
      const td = todayStart();
      const ago30 = daysAgo(30);

      // Phase 1: get internal user IDs + free plan ID to exclude from counts
      const [internalRes, freePlanRes] = await Promise.all([
        supabase.from('platform_members').select('user_id').eq('is_active', true),
        supabase.from('plans').select('id').eq('slug', 'free').single(),
      ]);
      const internalIds = ((internalRes.data ?? []) as { user_id: string }[]).map(m => m.user_id);
      const freePlanId = (freePlanRes.data as { id: string } | null)?.id ?? '';
      const internalFilter = internalIds.length > 0 ? `(${internalIds.join(',')})` : null;

      // Build filtered queries
      let usersAllQ   = supabase.from('profiles').select('id', { count: 'exact', head: true });
      let usersMonthQ = supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ms);
      let subsQ       = supabase.from('subscriptions').select('id, plan_id, billing_interval', { count: 'exact' }).eq('status', 'active');
      if (internalFilter) {
        usersAllQ   = usersAllQ.not('id', 'in', internalFilter);
        usersMonthQ = usersMonthQ.not('id', 'in', internalFilter);
        subsQ       = subsQ.not('user_id', 'in', internalFilter);
      }
      if (freePlanId) subsQ = subsQ.neq('plan_id', freePlanId);

      // Phase 2: all KPI queries in parallel
      const [
        orgsAll, orgsThisMonth,
        usersAll, usersThisMonth,
        activeSubsRes,
        reviewsAll, reviewsToday,
        connectedRes,
        aiDraftsRes,
        pricesRes,
      ] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', ms),
        usersAllQ,
        usersMonthQ,
        subsQ,
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).gte('created_at', td),
        supabase.from('google_connections').select('id', { count: 'exact', head: true }).eq('state', 'CONNECTED'),
        supabase.from('organization_usage').select('id', { count: 'exact', head: true }).eq('event_type', 'ai_draft').gte('created_at', ago30),
        supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('currency', 'USD'),
      ]);

      // Calculate MRR from paid subs (already filtered — no free, no internal)
      const activeSubs = (activeSubsRes.data ?? []) as { id: string; plan_id: string; billing_interval: string | null }[];
      const prices = (pricesRes.data ?? []) as { plan_id: string; billing_interval: string; amount_cents: number }[];
      const priceMap = new Map(prices.map(p => [`${p.plan_id}:${p.billing_interval}`, p.amount_cents]));
      const mrrCents = activeSubs.reduce((sum, s) => {
        const interval = s.billing_interval ?? 'monthly';
        const cents = priceMap.get(`${s.plan_id}:${interval}`) ?? 0;
        return sum + (interval === 'annual' ? Math.round(cents / 12) : cents);
      }, 0);

      setKpi({
        totalOrgs: orgsAll.count ?? 0,
        newOrgsThisMonth: orgsThisMonth.count ?? 0,
        totalUsers: usersAll.count ?? 0,
        newUsersThisMonth: usersThisMonth.count ?? 0,
        activeSubs: activeSubsRes.count ?? 0,
        mrrCents,
        mrrLastMonthCents: 0,
        totalReviews: reviewsAll.count ?? 0,
        reviewsToday: reviewsToday.count ?? 0,
        connectedGoogle: connectedRes.count ?? 0,
        aiDrafts: aiDraftsRes.count ?? 0,
      });
      setKpiLoading(false);
    }
    loadKpis();
  }, [refreshTick]);

  // ── Fetch Charts & Tables ───────────────────────────────────────────────────

  useEffect(() => {
    async function loadCharts() {
      setChartsLoading(true);
      const ago30 = daysAgo(30);
      const ago365 = daysAgo(365);

      const [
        orgs30dRes, orgs12mRes,
        reviewsStatusRes,
        plansRes, pricesRes, activeSubsFullRes,
        googleStatesRes, subStatesRes,
        recentOrgsRes,
        auditRes,
        pastDueOrgsRes, failedConnRes,
      ] = await Promise.all([
        supabase.from('organizations').select('created_at').gte('created_at', ago30).order('created_at'),
        supabase.from('organizations').select('created_at').gte('created_at', ago365).order('created_at'),
        supabase.from('reviews').select('status'),
        supabase.from('plans').select('id, slug, name').order('sort_order'),
        supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('currency', 'USD'),
        supabase.from('subscriptions').select('plan_id, billing_interval, status'),
        supabase.from('google_connections').select('state'),
        supabase.from('subscriptions').select('status'),
        supabase.from('organizations').select('id, name, created_at, ref_id').order('created_at', { ascending: false }).limit(8),
        supabase.from('audit_events').select('id, action, resource_type, actor_id, org_id, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('subscriptions').select('id, user_id').eq('status', 'past_due').limit(5),
        supabase.from('google_connections').select('id, org_id, state').in('state', ['REFRESH_FAILED', 'ERROR']).limit(5),
      ]);

      // Daily new orgs (30 days)
      const orgRows = (orgs30dRes.data ?? []) as { created_at: string }[];
      const days30: DailyCount[] = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const iso = d.toISOString().slice(0, 10);
        return { date: iso, count: 0 };
      });
      orgRows.forEach(r => {
        const day = r.created_at.slice(0, 10);
        const idx = days30.findIndex(d => d.date === day);
        if (idx >= 0) days30[idx]!.count++;
      });
      setDailyOrgs(days30);

      // Monthly new orgs (12 months)
      const orgRows12m = (orgs12mRes.data ?? []) as { created_at: string }[];
      const months12: MonthlyCount[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - (11 - i));
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { month: ym, count: 0 };
      });
      orgRows12m.forEach(r => {
        const ym = isoToYYYYMM(r.created_at);
        const idx = months12.findIndex(m => m.month === ym);
        if (idx >= 0) months12[idx]!.count++;
      });
      setMonthlyOrgs(months12);

      // Reviews by status
      const statusMap = new Map<string, number>();
      ((reviewsStatusRes.data ?? []) as { status: string }[]).forEach(r => {
        statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      });
      setReviewStatuses(Array.from(statusMap.entries()).map(([s, c]) => ({ status: s, count: c })));

      // Plan distribution
      const plans = (plansRes.data ?? []) as { id: string; slug: string; name: string }[];
      const prices = (pricesRes.data ?? []) as { plan_id: string; billing_interval: string; amount_cents: number }[];
      const activeSubs = (activeSubsFullRes.data ?? []) as { plan_id: string; billing_interval: string | null; status: string }[];
      const pmap = new Map(prices.map(p => [`${p.plan_id}:${p.billing_interval}`, p.amount_cents]));
      const planCountMap = new Map<string, number>();
      activeSubs.filter(s => s.status === 'active').forEach(s => {
        planCountMap.set(s.plan_id, (planCountMap.get(s.plan_id) ?? 0) + 1);
      });
      setPlanCounts(plans.map(p => ({
        slug: p.slug, name: p.name,
        count: planCountMap.get(p.id) ?? 0,
        color: PLAN_COLOR[p.slug] ?? 'bg-[#F3F4F6] text-[#374151]',
        bar: PLAN_BAR[p.slug] ?? '#9CA3AF',
      })));

      // Google connection states
      const gmap = new Map<string, number>();
      ((googleStatesRes.data ?? []) as { state: string }[]).forEach(r => {
        gmap.set(r.state, (gmap.get(r.state) ?? 0) + 1);
      });
      setGoogleStates(Array.from(gmap.entries()).map(([s, c]) => ({ status: s, count: c })));

      // Subscription states
      const smap = new Map<string, number>();
      ((subStatesRes.data ?? []) as { status: string }[]).forEach(r => {
        smap.set(r.status, (smap.get(r.status) ?? 0) + 1);
      });
      setSubStates(Array.from(smap.entries()).map(([s, c]) => ({ status: s, count: c })));

      // Top recent orgs — enrich with plan + review counts
      const recentOrgs = (recentOrgsRes.data ?? []) as { id: string; name: string; created_at: string; ref_id: string }[];
      const orgIds = recentOrgs.map(o => o.id);

      const [subsOwnerRes, reviewCountsRes] = await Promise.all([
        orgIds.length > 0
          ? supabase.from('org_members').select('org_id, user_id').eq('role', 'owner').in('org_id', orgIds)
          : { data: [] },
        orgIds.length > 0
          ? supabase.from('reviews').select('org_id').in('org_id', orgIds)
          : { data: [] },
      ]);

      const ownerMap = new Map<string, string>();
      ((subsOwnerRes.data ?? []) as { org_id: string; user_id: string }[]).forEach(r => ownerMap.set(r.org_id, r.user_id));

      const ownerIds = [...new Set(Array.from(ownerMap.values()))];
      const ownerSubsRes = ownerIds.length > 0
        ? await supabase.from('subscriptions').select('user_id, plan_id, status').eq('status', 'active').in('user_id', ownerIds)
        : { data: [] };
      const ownerPlanMap = new Map<string, string>();
      ((ownerSubsRes.data ?? []) as { user_id: string; plan_id: string }[]).forEach(r => ownerPlanMap.set(r.user_id, r.plan_id));

      const planById = new Map(plans.map(p => [p.id, p]));

      const reviewCounts = new Map<string, number>();
      ((reviewCountsRes.data ?? []) as { org_id: string }[]).forEach(r => {
        reviewCounts.set(r.org_id, (reviewCounts.get(r.org_id) ?? 0) + 1);
      });

      setTopOrgs(recentOrgs.map(o => {
        const ownerId = ownerMap.get(o.id) ?? '';
        const planId = ownerPlanMap.get(ownerId) ?? '';
        const plan = planById.get(planId);
        return {
          id: o.id,
          name: o.name,
          ref_id: o.ref_id,
          createdAt: o.created_at,
          planName: plan?.name ?? 'Free',
          planSlug: plan?.slug ?? 'free',
          reviewCount: reviewCounts.get(o.id) ?? 0,
        };
      }));

      // Audit events — enrich actor emails and org names
      type RawAudit = { id: string; action: string; resource_type: string | null; actor_id: string | null; org_id: string | null; created_at: string };
      const auditRows = (auditRes.data ?? []) as RawAudit[];
      const actorIds = [...new Set(auditRows.filter(r => r.actor_id).map(r => r.actor_id!))];
      const auditOrgIds = [...new Set(auditRows.filter(r => r.org_id).map(r => r.org_id!))];
      const [actorsRes, auditOrgsRes] = await Promise.all([
        actorIds.length > 0 ? supabase.from('profiles').select('id, email').in('id', actorIds) : { data: [] },
        auditOrgIds.length > 0 ? supabase.from('organizations').select('id, name').in('id', auditOrgIds) : { data: [] },
      ]);
      const actorEmail = new Map(((actorsRes.data ?? []) as { id: string; email: string }[]).map(a => [a.id, a.email]));
      const orgName = new Map(((auditOrgsRes.data ?? []) as { id: string; name: string }[]).map(o => [o.id, o.name]));
      setRecentAudit(auditRows.map(r => ({
        id: r.id,
        action: r.action,
        resource_type: r.resource_type,
        created_at: r.created_at,
        actorEmail: actorEmail.get(r.actor_id ?? '') ?? '—',
        orgName: orgName.get(r.org_id ?? '') ?? '—',
      })));

      // Action items
      const actionList: ActionItem[] = [];
      const pastDueSubs = (pastDueOrgsRes.data ?? []) as { id: string; user_id: string }[];
      pastDueSubs.slice(0, 3).forEach(s => {
        actionList.push({ id: s.id, kind: 'past_due', label: 'Past-due subscription', detail: `User ${s.user_id.slice(0, 8)}…`, href: '/billing' });
      });
      const failedConns = (failedConnRes.data ?? []) as { id: string; org_id: string; state: string }[];
      failedConns.slice(0, 3).forEach(c => {
        actionList.push({ id: c.id, kind: 'google_failed', label: 'Google connection failed', detail: `Org ${(c.org_id ?? '').slice(0, 8)}…`, href: '/clients' });
      });
      setActions(actionList);

      setChartsLoading(false);
    }
    loadCharts();
  }, [refreshTick]);

  // ── Derived chart data ─────────────────────────────────────────────────────

  const filteredDailyOrgs = useMemo(() => {
    if (!dateFrom && !dateTo) return dailyOrgs;
    return dailyOrgs.filter(d => (!dateFrom || d.date >= dateFrom) && (!dateTo || d.date <= dateTo));
  }, [dailyOrgs, dateFrom, dateTo]);

  const filteredMonthlyOrgs = useMemo(() => {
    if (!dateFrom && !dateTo) return monthlyOrgs;
    const fromYM = dateFrom ? dateFrom.slice(0, 7) : '';
    const toYM = dateTo ? dateTo.slice(0, 7) : '';
    return monthlyOrgs.filter(m => (!fromYM || m.month >= fromYM) && (!toYM || m.month <= toYM));
  }, [monthlyOrgs, dateFrom, dateTo]);

  const dailyBarData = useMemo(() =>
    filteredDailyOrgs.map((d, i) => ({
      label: i % 5 === 0 ? d.date.slice(5) : '',
      value: d.count,
    })), [filteredDailyOrgs]);

  const monthlyBarData = useMemo(() =>
    filteredMonthlyOrgs.map(m => ({
      label: MONTHS_SHORT[parseInt(m.month.slice(5, 7)) - 1] ?? '',
      value: m.count,
    })), [filteredMonthlyOrgs]);

  const donutSegments = useMemo(() =>
    reviewStatuses
      .filter(s => s.count > 0)
      .map(s => ({
        label: REVIEW_STATUS_COLOR[s.status]?.label ?? s.status,
        value: s.count,
        color: REVIEW_STATUS_COLOR[s.status]?.fill ?? '#9CA3AF',
      })), [reviewStatuses]);

  const totalGoogleConns = useMemo(() => googleStates.reduce((s, r) => s + r.count, 0), [googleStates]);
  const totalSubCount = useMemo(() => subStates.reduce((s, r) => s + r.count, 0), [subStates]);

  const sparkOrgs = useMemo(() => filteredMonthlyOrgs.map(m => m.count), [filteredMonthlyOrgs]);

  // ── Icons ──────────────────────────────────────────────────────────────────

  const icon = {
    orgs: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    users: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    subs: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    money: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    star: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>,
    today: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
    google: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>,
    ai: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>,
  };

  // ── Google / Sub state display helpers ────────────────────────────────────

  const GOOGLE_STATE_DISPLAY: Record<string, { label: string; color: string }> = {
    CONNECTED:      { label: 'Connected',      color: '#0EA5E9' },
    PENDING:        { label: 'Pending',         color: '#F59E0B' },
    REFRESH_FAILED: { label: 'Refresh Failed',  color: '#EF4444' },
    REVOKED:        { label: 'Revoked',         color: '#8B5CF6' },
    DISCONNECTED:   { label: 'Disconnected',    color: '#9CA3AF' },
    ERROR:          { label: 'Error',           color: '#DC2626' },
  };

  const SUB_STATE_DISPLAY: Record<string, { label: string; color: string }> = {
    active:   { label: 'Active',    color: '#0EA5E9' },
    trialing: { label: 'Trialing',  color: '#3B82F6' },
    past_due: { label: 'Past Due',  color: '#EF4444' },
    canceled: { label: 'Cancelled', color: '#9CA3AF' },
    paused:   { label: 'Paused',    color: '#F59E0B' },
  };

  const ACTION_ICON: Record<string, { bg: string; text: string; char: string }> = {
    past_due:     { bg: 'bg-red-100',    text: 'text-red-600',    char: '!' },
    google_failed:{ bg: 'bg-orange-100', text: 'text-orange-600', char: 'G' },
    no_connection:{ bg: 'bg-yellow-100', text: 'text-yellow-700', char: '~' },
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto px-7 py-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111111] leading-none">{greeting}</h1>
            <p className="text-xs text-[#6B7280] mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors px-2 py-1.5">
                Clear
              </button>
            )}
            <button
              onClick={() => setRefreshTick(t => t + 1)}
              className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#6C55E8] hover:border-[#6C55E8] transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
      </div>

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard loading={kpiLoading} label="Organizations" value={kpi?.totalOrgs ?? 0}
          trend={kpi ? pctChange(kpi.totalOrgs, Math.max(1, kpi.totalOrgs - kpi.newOrgsThisMonth)) : undefined}
          sub={kpi ? `+${kpi.newOrgsThisMonth} this month` : undefined}
          sparkData={sparkOrgs}
          icon={icon.orgs} />
        <KpiCard loading={kpiLoading} label="Customer Users" value={kpi?.totalUsers ?? 0}
          trend={kpi ? pctChange(kpi.totalUsers, Math.max(1, kpi.totalUsers - kpi.newUsersThisMonth)) : undefined}
          sub={kpi ? `+${kpi.newUsersThisMonth} this month` : undefined}
          icon={icon.users} />
        <KpiCard loading={kpiLoading} label="Paid Subscriptions" value={kpi?.activeSubs ?? 0}
          sub="active, paid plans only"
          icon={icon.subs} />
        <KpiCard loading={kpiLoading} label="Est. MRR" value={kpi ? fmtMoney(kpi.mrrCents) : '—'}
          sub="active subs, monthly"
          icon={icon.money} />
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <KpiCard loading={kpiLoading} label="Total Reviews" value={kpi?.totalReviews ?? 0}
          icon={icon.star} />
        <KpiCard loading={kpiLoading} label="Reviews Today" value={kpi?.reviewsToday ?? 0}
          sub="synced or published"
          icon={icon.today} />
        <KpiCard loading={kpiLoading} label="Google Connected" value={kpi?.connectedGoogle ?? 0}
          sub="active connections"
          icon={icon.google} />
        <KpiCard loading={kpiLoading} label="AI Drafts (30d)" value={kpi?.aiDrafts ?? 0}
          sub="last 30 days"
          icon={icon.ai} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* New Orgs — 30 days bar */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-5">
          <SectionHeader title="New Organizations" sub="Daily sign-ups, last 30 days" />
          {chartsLoading ? (
            <div className="h-24 bg-[#F3F4F6] animate-pulse rounded-lg" />
          ) : (
            <BarChart data={dailyBarData} color="#6C55E8" height={80} />
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F3F4F6]">
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{dateFrom || dateTo ? 'Period total' : '30-day total'}</p>
              <p className="text-sm font-bold text-[#111827]">{filteredDailyOrgs.reduce((s, d) => s + d.count, 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Peak day</p>
              <p className="text-sm font-bold text-[#111827]">{Math.max(...filteredDailyOrgs.map(d => d.count), 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Avg / day</p>
              <p className="text-sm font-bold text-[#111827]">
                {filteredDailyOrgs.length > 0 ? (filteredDailyOrgs.reduce((s, d) => s + d.count, 0) / filteredDailyOrgs.length).toFixed(1) : '0.0'}
              </p>
            </div>
          </div>
        </div>

        {/* Reviews by Status — donut */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-5">
          <SectionHeader title="Reviews by Status" />
          {chartsLoading ? (
            <div className="flex items-center justify-center h-32 bg-[#F3F4F6] animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-start gap-4">
              <DonutChart segments={donutSegments} size={110} />
              <div className="flex-1 space-y-1.5 pt-1">
                {donutSegments.map(seg => (
                  <div key={seg.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs text-[#374151]">{seg.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#111827]">{seg.value}</span>
                  </div>
                ))}
                {donutSegments.length === 0 && (
                  <p className="text-xs text-[#9CA3AF]">No reviews yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Monthly org growth — 12 months */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-5">
          <SectionHeader title="Growth Trend" sub="New organizations per month, last 12 months" />
          {chartsLoading ? (
            <div className="h-24 bg-[#F3F4F6] animate-pulse rounded-lg" />
          ) : (
            <BarChart data={monthlyBarData} color="#6C55E8" height={80} />
          )}
        </div>

        {/* Plan distribution */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-5">
          <SectionHeader title="Plan Distribution" sub="Active subscriptions" />
          {chartsLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-6 bg-[#F3F4F6] animate-pulse rounded" />)}
            </div>
          ) : planCounts.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">No plans data</p>
          ) : (
            <div className="space-y-3">
              {planCounts.map(p => {
                const max = Math.max(...planCounts.map(x => x.count), 1);
                return (
                  <div key={p.slug}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${p.color}`}>{p.name}</span>
                      <span className="text-xs font-bold text-[#111827]">{p.count}</span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${max > 0 ? (p.count / max) * 100 : 0}%`, backgroundColor: p.bar }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Platform Health + Top Orgs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Top Recent Orgs */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">Recent Clients</h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Latest 8 organizations</p>
            </div>
            <Link to="/clients" className="text-xs text-[#6C55E8] font-medium hover:underline">View all →</Link>
          </div>
          {chartsLoading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-[#F3F4F6] animate-pulse rounded" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  <th className="px-5 py-2.5 text-left font-semibold text-[#9CA3AF] uppercase tracking-wide text-[10px]">Organization</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[#9CA3AF] uppercase tracking-wide text-[10px]">Plan</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[#9CA3AF] uppercase tracking-wide text-[10px]">Reviews</th>
                  <th className="px-5 py-2.5 text-right font-semibold text-[#9CA3AF] uppercase tracking-wide text-[10px]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {topOrgs.map(org => (
                  <tr key={org.id} className="hover:bg-[#FAFAF7] transition-colors">
                    <td className="px-5 py-3">
                      <Link to={`/clients/${refToSlug(org.ref_id)}`} className="font-medium text-[#111827] hover:text-[#6C55E8] hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PLAN_COLOR[org.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                        {org.planName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[#374151]">{org.reviewCount}</td>
                    <td className="px-5 py-3 text-right text-[#9CA3AF]">
                      {new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {topOrgs.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-[#9CA3AF]">No organizations yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Platform Health */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-5">
          <SectionHeader title="Platform Health" />
          {chartsLoading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-[#F3F4F6] animate-pulse rounded"/>)}</div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Google Connections</p>
              {Object.entries(GOOGLE_STATE_DISPLAY).map(([state, { label, color }]) => {
                const sc = googleStates.find(s => s.status === state);
                if (!sc) return null;
                return <HealthBar key={state} label={label} count={sc.count} total={totalGoogleConns} color={color} />;
              })}
              {googleStates.length === 0 && <p className="text-xs text-[#9CA3AF] mb-3">No connections yet</p>}

              <div className="mt-4 mb-2 border-t border-[#F3F4F6] pt-3">
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Subscription States</p>
                {Object.entries(SUB_STATE_DISPLAY).map(([state, { label, color }]) => {
                  const sc = subStates.find(s => s.status === state);
                  if (!sc) return null;
                  return <HealthBar key={state} label={label} count={sc.count} total={totalSubCount} color={color} />;
                })}
                {subStates.length === 0 && <p className="text-xs text-[#9CA3AF]">No subscriptions yet</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Audit + Actions + Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Audit Events */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Recent Activity</h2>
            <Link to="/audit" className="text-xs text-[#6C55E8] font-medium hover:underline">View audit log →</Link>
          </div>
          {chartsLoading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-[#F3F4F6] animate-pulse rounded"/>)}
            </div>
          ) : recentAudit.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No activity yet.</div>
          ) : (
            <ul className="divide-y divide-[#F9FAFB]">
              {recentAudit.map(ev => (
                <li key={ev.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#FAFAF7] transition-colors">
                  <div className="w-6 h-6 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#111827]">{ev.action.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ev.orgName !== '—' && <span className="text-[10px] text-[#9CA3AF] truncate">{ev.orgName}</span>}
                      {ev.actorEmail !== '—' && <span className="text-[10px] text-[#9CA3AF] truncate">{ev.actorEmail}</span>}
                      {ev.resource_type && <span className="text-[10px] bg-[#F3F4F6] text-[#6B7280] px-1 rounded">{ev.resource_type}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 whitespace-nowrap">{timeAgo(ev.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Required + Quick Actions */}
        <div className="space-y-4">
          {/* Action Required */}
          <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Action Required</h2>
              {actions.length > 0 && (
                <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-lg">{actions.length}</span>
              )}
            </div>
            {chartsLoading ? (
              <div className="px-5 py-4 space-y-2">
                {[1,2].map(i => <div key={i} className="h-10 bg-[#F3F4F6] animate-pulse rounded"/>)}
              </div>
            ) : actions.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <div className="w-8 h-8 rounded-full bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <p className="text-xs text-[#9CA3AF]">All clear — no issues.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F9FAFB]">
                {actions.map(item => {
                  const style = ACTION_ICON[item.kind] ?? { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', char: '!' };
                  return (
                    <li key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFAF7] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${style.bg} ${style.text}`}>
                          {style.char}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[#111827]">{item.label}</p>
                          <p className="text-[10px] text-[#9CA3AF]">{item.detail}</p>
                        </div>
                      </div>
                      <Link to={item.href} className="text-[10px] font-medium text-[#6C55E8] hover:underline flex-shrink-0 ml-2">View →</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-semibold text-[#111827]">Quick Actions</h2>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { to: '/clients',   label: 'Clients',         desc: 'Browse & manage' },
                { to: '/billing',   label: 'Subscriptions',   desc: 'View all plans' },
                { to: '/mrr',       label: 'MRR',             desc: 'Revenue overview' },
                { to: '/payments',  label: 'Payments',        desc: 'Transaction log' },
                { to: '/users',     label: 'Team',            desc: 'Admin members' },
                { to: '/audit',     label: 'Audit Logs',      desc: 'Activity history' },
              ].map(link => (
                <Link key={link.to} to={link.to}
                  className="border border-[#E5E7EB] rounded-lg p-3 hover:bg-[#FAFAF7] hover:border-[#6C55E8] transition-colors group">
                  <p className="text-xs font-semibold text-[#111827] group-hover:text-[#6C55E8]">{link.label}</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

