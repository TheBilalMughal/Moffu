import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

interface OrgDetail {
  id: string;
  ref_id: string;
  name: string;
  created_at: string;
  status: string | null;
}

interface SubDetail {
  id: string;
  plan_id: string;
  plan: string;
  planName: string;
  status: string;
  period_end: string | null;
  cancel_at_period_end: boolean;
}

interface UsageDetail {
  aiDrafts: number;
  published: number;
  limit: number;
}

interface MonthBucket {
  label: string;
  isoKey: string;
  drafts: number;
  published: number;
}

interface RawEvent {
  event_type: string;
  created_at: string;
}

type ChartPeriod = '1m' | '3m' | '6m' | 'custom';

interface MemberRow {
  user_id: string;
  role: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
}

interface GoogleConn {
  id: string;
  google_email: string | null;
  state: string;
  connected_at: string;
}

interface PlanOption {
  id: string;
  slug: string;
  name: string;
}

interface SubHistory {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface OrgOverride {
  id: string;
  ai_drafts_per_month: number | null;
  published_replies_per_month: number | null;
  max_locations: number | null;
  max_team_members: number | null;
  campaign_emails_per_month: number | null;
  custom_price_cents: number | null;
  billing_interval: string | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
}

interface OverrideForm {
  ai_drafts: string;
  ai_drafts_unlimited: boolean;
  replies: string;
  replies_unlimited: boolean;
  locations: string;
  team_members: string;
  campaign_emails: string;
  campaign_emails_unlimited: boolean;
  custom_price: string;
  billing_interval: string;
  contract_start: string;
  contract_end: string;
  notes: string;
}

const PLAN_LIMIT: Record<string, number> = {
  free: 50, starter: 200, pro: 500, enterprise: 2000,
};

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!; const curr = pts[i]!;
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function buildMonthlyBuckets(events: RawEvent[], monthCount: number): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ label: monthLabel(d), isoKey, drafts: 0, published: 0 });
  }
  events.forEach((r) => {
    const isoKey = r.created_at.slice(0, 7);
    const b = buckets.find((x) => x.isoKey === isoKey);
    if (!b) return;
    if (r.event_type === 'ai_draft') b.drafts++;
    else b.published++;
  });
  return buckets;
}

function buildDailyBuckets(events: RawEvent[], fromIso: string, toIso: string): MonthBucket[] {
  const from = new Date(fromIso + 'T00:00:00');
  const to = new Date(toIso + 'T23:59:59');
  const buckets: MonthBucket[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const isoKey = cur.toISOString().slice(0, 10);
    const d = cur.getDate();
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][cur.getMonth()]!;
    buckets.push({ label: `${d} ${mon}`, isoKey, drafts: 0, published: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  events.forEach((r) => {
    const isoKey = r.created_at.slice(0, 10);
    const b = buckets.find((x) => x.isoKey === isoKey);
    if (!b) return;
    if (r.event_type === 'ai_draft') b.drafts++;
    else b.published++;
  });
  return buckets;
}

interface UsageTrendChartProps {
  events: RawEvent[];
  aiDrafts: number;
  published: number;
  members: number;
  connections: number;
  usagePct: number;
  usageLimit: number;
}

function UsageTrendChart({ events, aiDrafts, published, members, connections, usagePct, usageLimit }: UsageTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>('6m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const buckets = useMemo<MonthBucket[]>(() => {
    if (period === '1m') return buildMonthlyBuckets(events, 1);
    if (period === '3m') return buildMonthlyBuckets(events, 3);
    if (period === '6m') return buildMonthlyBuckets(events, 6);
    if (period === 'custom' && customFrom && customTo) {
      const daysDiff = Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000) + 1;
      if (daysDiff <= 60) return buildDailyBuckets(events, customFrom, customTo);
      // monthly for longer ranges
      const from = new Date(customFrom + 'T00:00:00');
      const to = new Date(customTo + 'T23:59:59');
      const result: MonthBucket[] = [];
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) {
        const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        result.push({ label: monthLabel(cur), isoKey, drafts: 0, published: 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
      events.forEach((r) => {
        const isoKey = r.created_at.slice(0, 7);
        const b = result.find((x) => x.isoKey === isoKey);
        if (!b) return;
        if (r.event_type === 'ai_draft') b.drafts++;
        else b.published++;
      });
      return result;
    }
    return buildMonthlyBuckets(events, 6);
  }, [events, period, customFrom, customTo]);

  const W = 1000; const H = 130;
  const PAD = { top: 10, right: 8, bottom: 28, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = useMemo(() => Math.max(...buckets.map((b) => Math.max(b.drafts, b.published)), 1), [buckets]);
  const yTicks = useMemo(() => Array.from({ length: 5 }, (_, i) => Math.round((maxVal * i) / 4)), [maxVal]);

  const draftPts = useMemo(() => buckets.map((b, i) => ({
    x: PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (b.drafts / maxVal) * innerH,
  })), [buckets, maxVal]);

  const pubPts = useMemo(() => buckets.map((b, i) => ({
    x: PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (b.published / maxVal) * innerH,
  })), [buckets, maxVal]);

  const draftLine = smoothPath(draftPts);
  const pubLine = smoothPath(pubPts);

  const draftArea = draftPts.length > 1
    ? `${draftLine} L ${draftPts[draftPts.length - 1]!.x} ${PAD.top + innerH} L ${draftPts[0]!.x} ${PAD.top + innerH} Z`
    : '';

  const hasData = buckets.some((b) => b.drafts > 0 || b.published > 0);

  return (
    <div className="bg-white shadow-sm rounded-xl">
      <div className="px-6 pt-5 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#111827]">{aiDrafts + published}</span>
              <span className="text-sm text-[#9CA3AF]">total events this month</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-[#0D4C3C]" />
                <span className="text-xs text-[#6B7280]">AI Drafts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-[#10B981]" />
                <span className="text-xs text-[#6B7280]">Published</span>
              </div>
            </div>
          </div>
          {/* Period switcher */}
          <div className="flex items-center gap-1.5">
            <div className="flex bg-[#F3F4F6] rounded-lg p-0.5">
              {([['1m', 'This Month'], ['3m', '3 Months'], ['6m', '6 Months']] as [ChartPeriod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setPeriod(key); setShowDatePicker(false); }}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    period === key ? 'bg-white shadow-sm text-[#111827]' : 'text-[#6B7280] hover:text-[#374151]'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => { setPeriod('custom'); setShowDatePicker(true); }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  period === 'custom' ? 'bg-white shadow-sm text-[#111827]' : 'text-[#6B7280] hover:text-[#374151]'
                }`}
              >
                Custom
              </button>
            </div>
            {period === 'custom' && showDatePicker && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs border border-[#E5EAE8] rounded px-2 py-1 text-[#374151] focus:outline-none focus:border-[#0D4C3C]"
                />
                <span className="text-xs text-[#9CA3AF]">—</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs border border-[#E5EAE8] rounded px-2 py-1 text-[#374151] focus:outline-none focus:border-[#0D4C3C]"
                />
              </div>
            )}
          </div>
        </div>

        {/* SVG chart */}
        {!hasData ? (
          <div className="flex items-center justify-center h-32 bg-[#FAFAFA] rounded-lg mt-3">
            <p className="text-xs text-[#9CA3AF]">No usage data yet.</p>
          </div>
        ) : (
          <div className="relative w-full mt-3" onMouseLeave={() => setHovered(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="adminDraftGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0D4C3C" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0D4C3C" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {yTicks.map((v) => {
                const y = PAD.top + innerH - (v / maxVal) * innerH;
                return (
                  <g key={v}>
                    <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#F3F4F6" strokeWidth={1} />
                    <text x={PAD.left + 4} y={y - 3} fontSize={9} fill="#D1D5DB">{v}</text>
                  </g>
                );
              })}

              {/* Hover crosshair */}
              {hovered !== null && draftPts[hovered] && (
                <line
                  x1={draftPts[hovered]!.x} y1={PAD.top}
                  x2={draftPts[hovered]!.x} y2={PAD.top + innerH}
                  stroke="#0D4C3C" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4}
                />
              )}

              {/* Draft area + line */}
              {draftArea && <path d={draftArea} fill="url(#adminDraftGrad)" />}
              <path d={draftLine} fill="none" stroke="#0D4C3C" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

              {/* Published line */}
              <path d={pubLine} fill="none" stroke="#10B981" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

              {/* X labels */}
              {buckets.map((b, i) => {
                const x = PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW;
                return (
                  <text key={b.label} x={x} y={H - 6} textAnchor="middle" fontSize={10} fill="#9CA3AF">{b.label}</text>
                );
              })}

              {/* Hover zones + dots */}
              {draftPts.map((p, i) => (
                <g key={i} onMouseEnter={() => setHovered(i)} style={{ cursor: 'default' }}>
                  <rect x={p.x - (innerW / buckets.length / 2)} y={PAD.top} width={innerW / buckets.length} height={innerH} fill="transparent" />
                  {(hovered === i || buckets[i]!.drafts > 0) && (
                    <circle cx={p.x} cy={p.y} r={hovered === i ? 4.5 : 3} fill="#0D4C3C" stroke="white" strokeWidth={1.5} />
                  )}
                  {(hovered === i || buckets[i]!.published > 0) && (
                    <circle cx={pubPts[i]!.x} cy={pubPts[i]!.y} r={hovered === i ? 4.5 : 3} fill="#10B981" stroke="white" strokeWidth={1.5} />
                  )}
                </g>
              ))}
            </svg>

            {/* Hover tooltip */}
            {hovered !== null && buckets[hovered] && draftPts[hovered] && (() => {
              const b = buckets[hovered]!;
              const px = (draftPts[hovered]!.x / W) * 100;
              const alignRight = px > 70;
              return (
                <div
                  className="absolute top-2 pointer-events-none z-10 bg-[#111827] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
                  style={{ left: alignRight ? 'auto' : `calc(${px}% + 8px)`, right: alignRight ? `calc(${100 - px}% + 8px)` : 'auto' }}
                >
                  <p className="font-semibold text-white/80">{b.label}</p>
                  <p className="mt-0.5">{b.drafts} AI draft{b.drafts !== 1 ? 's' : ''}</p>
                  <p className="text-[#10B981]">{b.published} published</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Stat strip */}
      <div className="flex items-center bg-[#F9FAFB] rounded-b-xl border-t border-[#E5EAE8]">
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">AI Drafts (mo.)</p>
          <p className="text-lg font-bold text-[#111827]">{aiDrafts}</p>
        </div>
        <div className="w-px h-8 bg-[#E5EAE8] flex-shrink-0" />
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Published (mo.)</p>
          <p className="text-lg font-bold text-[#111827]">{published}</p>
        </div>
        <div className="w-px h-8 bg-[#E5EAE8] flex-shrink-0" />
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Usage</p>
          <p className="text-lg font-bold text-[#111827]">{aiDrafts}<span className="text-sm font-normal text-[#9CA3AF]">/{usageLimit}</span></p>
          <div className="w-full bg-[#E5EAE8] rounded-full h-1 mt-1">
            <div className={`h-1 rounded-full ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-[#0D4C3C]'}`} style={{ width: `${usagePct}%` }} />
          </div>
        </div>
        <div className="w-px h-8 bg-[#E5EAE8] flex-shrink-0" />
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">Team Members</p>
          <p className="text-lg font-bold text-[#111827]">{members}</p>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5">{connections} Google conn.</p>
        </div>
      </div>
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { platformRole } = useAdminAuthStore();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [usage, setUsage] = useState<UsageDetail | null>(null);
  const [rawUsageEvents, setRawUsageEvents] = useState<RawEvent[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [connections, setConnections] = useState<GoogleConn[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [subHistory, setSubHistory] = useState<SubHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Override state
  const [override, setOverride] = useState<OrgOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    ai_drafts: '', ai_drafts_unlimited: false,
    replies: '', replies_unlimited: false,
    locations: '', team_members: '',
    campaign_emails: '', campaign_emails_unlimited: false,
    custom_price: '', billing_interval: 'monthly',
    contract_start: '', contract_end: '', notes: '',
  });
  const [savingOverride, setSavingOverride] = useState(false);
  const [clearingOverride, setClearingOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideEditing, setOverrideEditing] = useState(false);

  // Actions
  const [toggling, setToggling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonateErr, setImpersonateErr] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    if (!id) { setNotFound(true); setLoading(false); return; }

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id, ref_id, name, created_at, status')
      .eq('ref_id', id)
      .maybeSingle();

    if (!orgRow) { setNotFound(true); setLoading(false); return; }
    setOrg(orgRow as OrgDetail);

    const { data: memberOrgRows } = await supabase
      .from('org_members')
      .select('user_id, role, created_at')
      .eq('org_id', orgRow.id);

    const orgMemberRows = memberOrgRows ?? [];
    const memberUserIds = orgMemberRows.map((m: { user_id: string }) => m.user_id);
    const ownerRow = orgMemberRows.find((m: { role: string }) => m.role === 'owner');
    const ownerUserId = ownerRow?.user_id ?? null;

    if (memberUserIds.length === 0) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

    const [plansRes, subsRes, profilesRes, emailsRes, usageAiRes, usagePubRes, usageHistRes, connRes, auditRes] = await Promise.all([
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      ownerUserId
        ? supabase.from('subscriptions')
            .select('id, user_id, plan_id, status, current_period_end, cancel_at_period_end')
            .eq('user_id', ownerUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('id, display_name').in('id', memberUserIds),
      memberUserIds.length > 0
        ? supabase.rpc('get_users_email', { user_ids: memberUserIds })
        : Promise.resolve({ data: [] }),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true }).in('user_id', memberUserIds).eq('event_type', 'ai_draft').gte('created_at', monthStart),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true }).in('user_id', memberUserIds).eq('event_type', 'published_reply').gte('created_at', monthStart),
      supabase.from('usage_events').select('event_type, created_at').in('user_id', memberUserIds).in('event_type', ['ai_draft', 'published_reply']).gte('created_at', twelveMonthsAgo),
      supabase.from('google_connections').select('id, google_email, state, connected_at').in('user_id', memberUserIds),
      supabase.from('audit_events').select('id, action, metadata, created_at').eq('org_id', orgRow.id).eq('resource_type', 'subscription').order('created_at', { ascending: false }).limit(20),
    ]);

    type PlanRow = { id: string; slug: string; name: string };
    const allPlans: PlanOption[] = (plansRes.data ?? []) as PlanOption[];
    setPlans(allPlans);
    const planById = new Map<string, PlanRow>(allPlans.map((p) => [p.id, p]));

    const subData = subsRes.data as { id: string; user_id: string; plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
    const planSlug = subData ? (planById.get(subData.plan_id)?.slug ?? 'free') : 'free';
    const planName = subData ? (planById.get(subData.plan_id)?.name ?? 'Free') : 'Free';

    const subDetail: SubDetail = {
      id: subData?.id ?? '',
      plan_id: subData?.plan_id ?? '',
      plan: planSlug,
      planName,
      status: subData?.status ?? 'active',
      period_end: subData?.current_period_end ?? null,
      cancel_at_period_end: subData?.cancel_at_period_end ?? false,
    };
    setSub(subDetail);
    setSelectedPlanId(subData?.plan_id ?? '');

    setUsage({
      aiDrafts: usageAiRes.count ?? 0,
      published: usagePubRes.count ?? 0,
      limit: PLAN_LIMIT[planSlug] ?? 50,
    });

    type HistRow = { event_type: string; created_at: string };
    setRawUsageEvents((usageHistRes.data ?? []) as HistRow[]);

    type ConnRow = { id: string; google_email: string | null; state: string; connected_at: string };
    setConnections((connRes.data ?? []) as ConnRow[]);

    type AuditRow = { id: string; action: string; metadata: Record<string, unknown> | null; created_at: string };
    setSubHistory((auditRes.data ?? []) as AuditRow[]);

    type ProfileRow = { id: string; display_name: string | null };
    const profileById = new Map<string, ProfileRow>(
      (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p]),
    );
    const emailById = new Map<string, string>(
      (emailsRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]),
    );

    type OrgMemberRow = { user_id: string; role: string; created_at: string };
    setMembers((orgMemberRows as OrgMemberRow[]).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: profileById.get(m.user_id)?.display_name ?? null,
      email: emailById.get(m.user_id) ?? null,
      created_at: m.created_at,
    })));

    // Load override
    const { data: ov } = await supabase
      .from('org_plan_overrides')
      .select('id, ai_drafts_per_month, published_replies_per_month, max_locations, max_team_members, campaign_emails_per_month, custom_price_cents, billing_interval, contract_start, contract_end, notes')
      .eq('org_id', orgRow.id)
      .maybeSingle();

    if (ov) {
      setOverride(ov as OrgOverride);
      setOverrideForm({
        ai_drafts: ov.ai_drafts_per_month !== null && ov.ai_drafts_per_month !== -1 ? String(ov.ai_drafts_per_month) : '',
        ai_drafts_unlimited: ov.ai_drafts_per_month === -1,
        replies: ov.published_replies_per_month !== null && ov.published_replies_per_month !== -1 ? String(ov.published_replies_per_month) : '',
        replies_unlimited: ov.published_replies_per_month === -1,
        locations: ov.max_locations !== null ? String(ov.max_locations) : '',
        team_members: ov.max_team_members !== null ? String(ov.max_team_members) : '',
        campaign_emails: ov.campaign_emails_per_month !== null && ov.campaign_emails_per_month !== -1 ? String(ov.campaign_emails_per_month) : '',
        campaign_emails_unlimited: ov.campaign_emails_per_month === -1,
        custom_price: ov.custom_price_cents !== null ? String(ov.custom_price_cents / 100) : '',
        billing_interval: ov.billing_interval ?? 'monthly',
        contract_start: ov.contract_start ?? '',
        contract_end: ov.contract_end ?? '',
        notes: ov.notes ?? '',
      });
    } else {
      setOverride(null);
    }

    setLoading(false);
  }

  function overrideFieldVal(unlim: boolean, val: string): number | null {
    if (unlim) return -1;
    const n = parseInt(val);
    return isNaN(n) ? null : n;
  }

  async function handleSaveOverride() {
    if (!org) return;
    setSavingOverride(true);
    setOverrideMsg(null);

    const payload = {
      org_id: org.id,
      ai_drafts_per_month:         overrideFieldVal(overrideForm.ai_drafts_unlimited, overrideForm.ai_drafts),
      published_replies_per_month: overrideFieldVal(overrideForm.replies_unlimited, overrideForm.replies),
      max_locations:    overrideForm.locations   ? parseInt(overrideForm.locations)   : null,
      max_team_members: overrideForm.team_members ? parseInt(overrideForm.team_members) : null,
      campaign_emails_per_month: overrideFieldVal(overrideForm.campaign_emails_unlimited, overrideForm.campaign_emails),
      custom_price_cents: overrideForm.custom_price ? Math.round(parseFloat(overrideForm.custom_price) * 100) : null,
      billing_interval:  overrideForm.billing_interval || null,
      contract_start:    overrideForm.contract_start || null,
      contract_end:      overrideForm.contract_end || null,
      notes:             overrideForm.notes.trim() || null,
    };

    const { error } = await supabase
      .from('org_plan_overrides')
      .upsert(payload, { onConflict: 'org_id' });

    setSavingOverride(false);
    if (error) { setOverrideMsg(`Error: ${error.message}`); return; }
    setOverrideEditing(false);
    setOverrideMsg(null);
    load();
  }

  async function handleClearOverride() {
    if (!org || !override) return;
    setClearingOverride(true);
    setOverrideMsg(null);
    const { error } = await supabase.from('org_plan_overrides').delete().eq('org_id', org.id);
    setClearingOverride(false);
    if (error) { setOverrideMsg(`Error: ${error.message}`); return; }
    setOverrideEditing(false);
    setOverrideMsg(null);
    load();
  }

  async function handleToggleStatus() {
    if (!org) return;
    setToggling(true);
    const newStatus = org.status === 'suspended' ? 'active' : 'suspended';
    await supabase.from('organizations').update({ status: newStatus }).eq('id', org.id);
    setToggling(false);
    load();
  }

  async function handleChangePlan() {
    if (!sub || !selectedPlanId || selectedPlanId === sub.plan_id) return;
    setChangingPlan(true);
    setPlanMsg(null);
    const { error } = await supabase
      .from('subscriptions')
      .update({ plan_id: selectedPlanId })
      .eq('id', sub.id);
    setChangingPlan(false);
    setPlanMsg(error ? `Error: ${error.message}` : 'Plan updated.');
    if (!error) load();
  }

  async function handleImpersonate(userId: string) {
    setImpersonating(userId);
    setImpersonateErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${env.supabaseUrl}/functions/v1/admin-impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': env.supabaseAnonKey,
        },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) { setImpersonateErr(data.error ?? 'Impersonation failed'); return; }
      window.open(data.action_link, '_blank', 'noopener,noreferrer');
    } catch {
      setImpersonateErr('Network error');
    } finally {
      setImpersonating(null);
    }
  }

  function canImpersonate() {
    return ['super_admin', 'admin', 'support'].includes(platformRole ?? '');
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="h-4 bg-[#E5EAE8] rounded animate-pulse w-48 mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 bg-[#E5EAE8] rounded-xl animate-pulse" />)}
        </div>
        <div className="h-48 bg-[#E5EAE8] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="px-8 py-8">
        <Link to="/clients" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Clients
        </Link>
        <p className="text-sm text-[#9CA3AF]">Client not found.</p>
      </div>
    );
  }

  const isActive = org.status !== 'suspended';
  const statusColor = isActive ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]';
  const usagePct = usage ? Math.min(Math.round((usage.aiDrafts / usage.limit) * 100), 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <Link to="/clients" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#111827]">{org.name}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusColor}`}>
              {isActive ? 'Active' : 'Suspended'}
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">{formatId(org.ref_id)} · Since {formatDate(org.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {sub?.plan && (
            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
              {sub.planName}
            </span>
          )}
          <button
            onClick={handleToggleStatus}
            disabled={toggling}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50 ${
              isActive ? 'bg-[#FEF2F2] text-red-700 hover:bg-red-100' : 'bg-[#ECFDF5] text-[#065F46] hover:bg-green-100'
            }`}
          >
            {toggling ? '…' : isActive ? 'Suspend' : 'Reactivate'}
          </button>
        </div>
      </div>

      {/* Chart + Stats (top of page) */}
      <div className="mb-4">
        <UsageTrendChart
          events={rawUsageEvents}
          aiDrafts={usage?.aiDrafts ?? 0}
          published={usage?.published ?? 0}
          members={members.length}
          connections={connections.length}
          usagePct={usagePct}
          usageLimit={usage?.limit ?? 50}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Org Info */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Organisation</h2>
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">ID</dt>
              <dd className="font-mono text-xs text-[#374151]">{formatId(org.ref_id)}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Name</dt>
              <dd className="text-sm text-[#111827]">{org.name}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Created</dt>
              <dd className="text-sm text-[#374151]">{formatDate(org.created_at)}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Status</dt>
              <dd>
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusColor}`}>
                  {isActive ? 'Active' : 'Suspended'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Subscription + Plan Change */}
        <div className="bg-white shadow-sm rounded-xl">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Subscription</h2>
            {sub?.cancel_at_period_end && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">Cancels at period end</span>
            )}
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Plan</dt>
              <dd className="flex items-center gap-2 flex-1">
                {sub ? (
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                    {sub.planName}
                  </span>
                ) : <span className="text-[#9CA3AF]">Free</span>}
              </dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Status</dt>
              <dd>
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${
                  sub?.status === 'active' ? 'bg-[#ECFDF5] text-[#065F46]' :
                  sub?.status === 'trialing' ? 'bg-[#EFF6FF] text-[#1D4ED8]' :
                  sub?.status === 'past_due' ? 'bg-[#FEF2F2] text-[#991B1B]' :
                  'bg-[#F3F4F6] text-[#374151]'
                }`}>{sub?.status ?? 'none'}</span>
              </dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Period end</dt>
              <dd className="text-sm text-[#374151]">{sub?.period_end ? formatDate(sub.period_end) : '—'}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Limit</dt>
              <dd className="text-sm text-[#374151]">{usage?.limit ?? 50} drafts / month</dd>
            </div>
          </dl>

          {/* Plan Override */}
          {plans.length > 0 && (
            <div className="px-6 py-4 border-t border-[#F3F4F6] bg-[#F8FAF9]">
              <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Change Plan</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Dropdown
                    fullWidth
                    value={selectedPlanId}
                    onChange={setSelectedPlanId}
                    options={plans.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </div>
                <button
                  onClick={handleChangePlan}
                  disabled={changingPlan || !selectedPlanId || selectedPlanId === sub?.plan_id}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 rounded transition-colors"
                >
                  {changingPlan ? '…' : 'Apply'}
                </button>
              </div>
              {planMsg && (
                <p className={`mt-2 text-xs ${planMsg.startsWith('Error') ? 'text-red-600' : 'text-[#0D4C3C]'}`}>{planMsg}</p>
              )}
            </div>
          )}

          {/* Subscription history */}
          <div className="border-t border-[#F3F4F6]">
            <div className="px-6 py-3 bg-[#F8FAF9] flex items-center justify-between">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">History</p>
              <span className="text-[10px] text-[#9CA3AF]">{subHistory.length} event{subHistory.length !== 1 ? 's' : ''}</span>
            </div>
            {subHistory.length === 0 ? (
              <p className="px-6 py-5 text-xs text-[#9CA3AF] text-center">No subscription events logged.</p>
            ) : (
              <div className="divide-y divide-[#F9FAFB]">
                {subHistory.map((h) => {
                  const meta = h.metadata ?? {};
                  const label = String(meta.action_label ?? h.action).replace(/_/g, ' ');
                  const planFrom = meta.from_plan as string | undefined;
                  const planTo = meta.to_plan as string | undefined;
                  return (
                    <div key={h.id} className="px-6 py-3 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0D4C3C] flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#374151] capitalize font-medium">{label}</p>
                        {planFrom && planTo && (
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                            <span className={`font-semibold ${PLAN_COLOR[planFrom]?.includes('text') ? '' : ''}`}>{planFrom}</span>
                            {' → '}
                            <span className="font-semibold">{planTo}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{formatDate(h.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Connections */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Google Connections</h2>
        </div>
        {connections.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No Google accounts connected.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Google Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">State</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Connected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {connections.map((g) => {
                const stateColor = g.state === 'CONNECTED'
                  ? 'bg-[#ECFDF5] text-[#065F46]'
                  : g.state === 'DISCONNECTED'
                  ? 'bg-[#F3F4F6] text-[#374151]'
                  : 'bg-[#FEF2F2] text-[#991B1B]';
                return (
                  <tr key={g.id} className="hover:bg-[#F8FAF9]">
                    <td className="px-5 py-3.5 text-[#374151]">{g.google_email ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${stateColor}`}>{g.state}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{formatDate(g.connected_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Custom Override */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#111827]">Custom Override</h2>
            {override && !overrideEditing && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">Active</span>
            )}
          </div>
          {!overrideEditing && (
            <button
              onClick={() => { setOverrideMsg(null); setOverrideEditing(true); }}
              className="px-3 py-1.5 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C]/30 rounded-lg hover:bg-[#E6F2EE] transition-colors"
            >
              {override ? 'Edit' : 'Set Override'}
            </button>
          )}
        </div>

        {/* Read-only summary */}
        {!overrideEditing && (
          <div className="px-6 py-5">
            {!override ? (
              <p className="text-sm text-[#9CA3AF]">No override set — client uses plan defaults.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                {[
                  { label: 'AI Drafts / mo', value: override.ai_drafts_per_month === -1 ? 'Unlimited' : override.ai_drafts_per_month != null ? String(override.ai_drafts_per_month) : '—' },
                  { label: 'Replies / mo',   value: override.published_replies_per_month === -1 ? 'Unlimited' : override.published_replies_per_month != null ? String(override.published_replies_per_month) : '—' },
                  { label: 'Campaign Emails / mo', value: override.campaign_emails_per_month === -1 ? 'Unlimited' : override.campaign_emails_per_month != null ? String(override.campaign_emails_per_month) : '—' },
                  { label: 'Max Locations',  value: override.max_locations != null ? String(override.max_locations) : '—' },
                  { label: 'Max Members',    value: override.max_team_members != null ? String(override.max_team_members) : '—' },
                  { label: 'Custom Price',   value: override.custom_price_cents != null ? `$${(override.custom_price_cents / 100).toFixed(0)}/${override.billing_interval ?? 'mo'}` : '—' },
                  { label: 'Contract Start', value: override.contract_start ?? '—' },
                  { label: 'Contract End',   value: override.contract_end ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm text-[#111827]">{value}</p>
                  </div>
                ))}
                {override.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-0.5">Notes</p>
                    <p className="text-xs text-[#374151]">{override.notes}</p>
                  </div>
                )}
              </div>
            )}
            {overrideMsg && (
              <p className={`mt-3 text-xs ${overrideMsg.startsWith('Error') ? 'text-red-600' : 'text-[#0D4C3C]'}`}>{overrideMsg}</p>
            )}
          </div>
        )}

        {/* Edit form */}
        {overrideEditing && (
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">

              {/* AI Drafts */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#374151]">AI Drafts / month</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={overrideForm.ai_drafts_unlimited}
                      onChange={e => setOverrideForm(f => ({ ...f, ai_drafts_unlimited: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                    <span className="text-xs text-[#6B7280]">Unlimited</span>
                  </label>
                </div>
                <input type="number" min="0" disabled={overrideForm.ai_drafts_unlimited}
                  value={overrideForm.ai_drafts}
                  onChange={e => setOverrideForm(f => ({ ...f, ai_drafts: e.target.value }))}
                  placeholder="blank = use plan"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
              </div>

              {/* Replies */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#374151]">Published Replies / month</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={overrideForm.replies_unlimited}
                      onChange={e => setOverrideForm(f => ({ ...f, replies_unlimited: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                    <span className="text-xs text-[#6B7280]">Unlimited</span>
                  </label>
                </div>
                <input type="number" min="0" disabled={overrideForm.replies_unlimited}
                  value={overrideForm.replies}
                  onChange={e => setOverrideForm(f => ({ ...f, replies: e.target.value }))}
                  placeholder="blank = use plan"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
              </div>

              {/* Locations */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Max Locations</label>
                <input type="number" min="1"
                  value={overrideForm.locations}
                  onChange={e => setOverrideForm(f => ({ ...f, locations: e.target.value }))}
                  placeholder="blank = use plan"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
              </div>

              {/* Team members */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Max Team Members</label>
                <input type="number" min="1"
                  value={overrideForm.team_members}
                  onChange={e => setOverrideForm(f => ({ ...f, team_members: e.target.value }))}
                  placeholder="blank = use plan"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
              </div>

              {/* Campaign emails */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#374151]">Campaign Emails / month</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={overrideForm.campaign_emails_unlimited}
                      onChange={e => setOverrideForm(f => ({ ...f, campaign_emails_unlimited: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                    <span className="text-xs text-[#6B7280]">Unlimited</span>
                  </label>
                </div>
                <input type="number" min="0" disabled={overrideForm.campaign_emails_unlimited}
                  value={overrideForm.campaign_emails}
                  onChange={e => setOverrideForm(f => ({ ...f, campaign_emails: e.target.value }))}
                  placeholder="blank = use plan"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
              </div>

              {/* Custom price */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Custom Price (USD)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">$</span>
                    <input type="number" min="0" step="0.01"
                      value={overrideForm.custom_price}
                      onChange={e => setOverrideForm(f => ({ ...f, custom_price: e.target.value }))}
                      placeholder="e.g. 299"
                      className="w-full pl-6 pr-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                  </div>
                  <select value={overrideForm.billing_interval}
                    onChange={e => setOverrideForm(f => ({ ...f, billing_interval: e.target.value }))}
                    className="px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] bg-white">
                    <option value="monthly">/ month</option>
                    <option value="annual">/ year</option>
                  </select>
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-1">Informational only — billing handled via Stripe or invoice.</p>
              </div>

              {/* Contract dates */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Contract Start</label>
                <input type="date"
                  value={overrideForm.contract_start}
                  onChange={e => setOverrideForm(f => ({ ...f, contract_start: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Contract End</label>
                <input type="date"
                  value={overrideForm.contract_end}
                  onChange={e => setOverrideForm(f => ({ ...f, contract_end: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
              </div>

            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-[#374151] mb-1">Internal Notes</label>
              <textarea rows={3}
                value={overrideForm.notes}
                onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Negotiated by sales, includes onboarding support, renews Dec 2025"
                className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {override && (
                  <button
                    onClick={handleClearOverride}
                    disabled={clearingOverride}
                    className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {clearingOverride ? 'Clearing…' : 'Clear Override'}
                  </button>
                )}
                {overrideMsg && (
                  <p className={`text-xs ${overrideMsg.startsWith('Error') ? 'text-red-600' : 'text-[#0D4C3C]'}`}>{overrideMsg}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setOverrideEditing(false); setOverrideMsg(null); }}
                  className="px-3 py-2 text-xs font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOverride}
                  disabled={savingOverride}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingOverride ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Team Members</h2>
        </div>
        {impersonateErr && (
          <div className="mx-6 mt-3 px-3 py-2 bg-[#FEF2F2] text-red-700 text-xs rounded-lg">{impersonateErr}</div>
        )}
        {members.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No members found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Joined</th>
                {canImpersonate() && <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {members.map((m) => (
                <tr key={m.user_id} className="hover:bg-[#F8FAF9]">
                  <td className="px-5 py-3.5 font-medium text-[#111827]">{m.display_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[#374151] text-xs">{m.email ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${m.role === 'owner' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{formatDate(m.created_at)}</td>
                  {canImpersonate() && (
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleImpersonate(m.user_id)}
                        disabled={impersonating === m.user_id}
                        title={`Impersonate ${m.display_name ?? m.email ?? 'user'} in the portal`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F8FAF9] hover:border-[#0D4C3C] hover:text-[#0D4C3C] transition-colors disabled:opacity-50">
                        {impersonating === m.user_id
                          ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        }
                        {impersonating === m.user_id ? 'Opening…' : 'Impersonate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
