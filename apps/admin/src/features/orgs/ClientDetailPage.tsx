import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { Dropdown } from '@/components/Dropdown';
import { DateRangePicker } from '@/components/DateRangePicker';
import { formatDate, formatId } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgDetail { id: string; ref_id: string; name: string; created_at: string; status: string | null; }
interface SubDetail { id: string; plan_id: string; plan: string; planName: string; status: string; period_end: string | null; cancel_at_period_end: boolean; }
interface UsageDetail { aiDrafts: number; published: number; limit: number; }
interface MonthBucket { label: string; isoKey: string; drafts: number; published: number; }
interface RawEvent { event_type: string; created_at: string; }
type ChartPeriod = '1m' | '3m' | '6m' | 'custom';
interface MemberRow { user_id: string; role: string; display_name: string | null; email: string | null; created_at: string; }
interface GoogleConn { id: string; google_email: string | null; state: string; connected_at: string; }
interface GoogleLocation { id: string; connection_id: string; display_name: string | null; address: string | null; is_selected: boolean; }
interface PlanOption { id: string; slug: string; name: string; }
interface SubHistory { id: string; action: string; metadata: Record<string, unknown> | null; created_at: string; }
interface OrgOverride {
  id: string; ai_drafts_per_month: number | null; published_replies_per_month: number | null;
  max_locations: number | null; max_team_members: number | null; campaign_emails_per_month: number | null;
  custom_price_cents: number | null; billing_interval: string | null; contract_start: string | null; contract_end: string | null; notes: string | null;
}
interface OverrideForm {
  ai_drafts: string; ai_drafts_unlimited: boolean; replies: string; replies_unlimited: boolean;
  locations: string; team_members: string; campaign_emails: string; campaign_emails_unlimited: boolean;
  custom_price: string; billing_interval: string; contract_start: string; contract_end: string; notes: string;
}
interface AuditEvent { id: string; action: string; actor_user_id: string | null; metadata: Record<string, unknown> | null; created_at: string; }
interface PageView { id: string; user_id: string; ip: string; path: string; user_agent: string | null; created_at: string; }
interface RefundRow {
  id: string; amount_cents: number | null; reason: string; status: string; admin_note: string | null;
  reviewed_at: string | null; processed_at: string | null; created_at: string;
}
interface SupportNote { id: string; author_id: string; body: string; created_at: string; }

type OrgTab = 'overview' | 'subscription' | 'members' | 'google' | 'ai-activity' | 'refunds' | 'activity' | 'ip-activity' | 'support';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]', starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth: 'bg-[#F0FDF4] text-[#15803D]', scale: 'bg-[#FFF7ED] text-[#C2410C]',
  pro: 'bg-[#F0FDF4] text-[#15803D]', enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_LIMIT: Record<string, number> = {
  free: 50, starter: 200, growth: 500, scale: 2000, pro: 500, enterprise: 2000,
};

const REFUND_STATUS_COLOR: Record<string, string> = {
  REQUESTED:    'bg-[#EFF6FF] text-[#1D4ED8]',
  UNDER_REVIEW: 'bg-[#FFF7ED] text-[#C2410C]',
  APPROVED:     'bg-[#ECFDF5] text-[#065F46]',
  REJECTED:     'bg-[#FEF2F2] text-[#991B1B]',
  PROCESSING:   'bg-[#F3E8FF] text-[#7C3AED]',
  REFUNDED:     'bg-[#ECFDF5] text-[#065F46]',
  FAILED:       'bg-[#FEF2F2] text-[#991B1B]',
};

// ── UsageTrendChart ───────────────────────────────────────────────────────────

function UsageTrendChart({
  events, aiDrafts, published, members, connections, usagePct, usageLimit,
}: {
  events: RawEvent[]; aiDrafts: number; published: number;
  members: number; connections: number; usagePct: number; usageLimit: number;
}) {
  const [period, setPeriod] = useState<ChartPeriod>('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const buckets: MonthBucket[] = useMemo(() => {
    const now = new Date();
    let months = 3;
    if (period === '1m') months = 1;
    else if (period === '6m') months = 6;
    else if (period === 'custom' && customFrom && customTo) {
      const fromD = new Date(customFrom); const toD = new Date(customTo);
      months = Math.max(1, Math.ceil((toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    }
    const result: MonthBucket[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
        isoKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        drafts: 0, published: 0,
      });
    }
    for (const ev of events) {
      const key = ev.created_at.slice(0, 7);
      const b = result.find(r => r.isoKey === key);
      if (!b) continue;
      if (ev.event_type === 'ai_draft') b.drafts++;
      else if (ev.event_type === 'published_reply') b.published++;
    }
    return result;
  }, [events, period, customFrom, customTo]);

  const maxVal = Math.max(...buckets.flatMap(b => [b.drafts, b.published]), 1);
  const W = 400; const H = 90; const padL = 4; const padR = 4; const plotW = W - padL - padR;
  const n = buckets.length; const slotW = plotW / n; const barW = Math.max(3, Math.floor(slotW * 0.35));

  return (
    <div className="bg-white shadow-sm rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">AI Drafts (mo)</p>
            <p className="text-xl font-bold text-[#111827]">{aiDrafts}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Replies (mo)</p>
            <p className="text-xl font-bold text-[#111827]">{published}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Members</p>
            <p className="text-xl font-bold text-[#111827]">{members}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Connected</p>
            <p className="text-xl font-bold text-[#111827]">{connections}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Quota</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-20 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div className="h-full bg-[#111111] rounded-full" style={{ width: `${usagePct}%` }} />
              </div>
              <span className="text-xs font-semibold text-[#374151]">{usagePct}%</span>
              <span className="text-[10px] text-[#9CA3AF]">/{usageLimit === 999999 ? '∞' : usageLimit}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 gap-0.5">
            {(['1m', '3m', '6m'] as Exclude<ChartPeriod,'custom'>[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${period === p ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}>
                {p}
              </button>
            ))}
            <DateRangePicker
              from={customFrom}
              to={customTo}
              onChange={(f, t) => { setCustomFrom(f); setCustomTo(t); if (f && t) setPeriod('custom'); }}
              alignRight
            />
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={padL} x2={W - padR} y1={H - f * H} y2={H - f * H} stroke="#F3F4F6" strokeWidth="0.5" />
          ))}
          <line x1={padL} x2={W - padR} y1={H} y2={H} stroke="#E5EAE8" strokeWidth="1" />
          {buckets.map((b, i) => {
            const cx = padL + i * slotW + slotW / 2;
            const dH = Math.max(0, (b.drafts / maxVal) * H);
            const pH = Math.max(0, (b.published / maxVal) * H);
            return (
              <g key={b.isoKey}>
                {b.drafts > 0 && <rect x={cx - barW - 1} y={H - dH} width={barW} height={dH} fill="#6C55E8" rx="1" />}
                {b.drafts === 0 && <circle cx={cx - barW / 2 - 0.5} cy={H} r="1.5" fill="#9CA3AF" />}
                {b.published > 0 && <rect x={cx + 1} y={H - pH} width={barW} height={pH} fill="#6EE7B7" rx="1" />}
                {b.published === 0 && <circle cx={cx + barW / 2 + 0.5} cy={H} r="1.5" fill="#D1FAE5" />}
                {buckets.length <= 12 && (
                  <text x={cx} y={H + 14} textAnchor="middle" fontSize="7" fill="#9CA3AF">{b.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[#111111]" /><span className="text-[10px] text-[#9CA3AF]">AI Drafts</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[#6EE7B7]" /><span className="text-[10px] text-[#9CA3AF]">Replies</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const platformRole = useAdminAuthStore(s => s.platformRole);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<OrgTab>('overview');

  // Core data
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [usage, setUsage] = useState<UsageDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [connections, setConnections] = useState<GoogleConn[]>([]);
  const [googleLocations, setGoogleLocations] = useState<GoogleLocation[]>([]);
  const [rawUsageEvents, setRawUsageEvents] = useState<RawEvent[]>([]);
  const [subHistory, setSubHistory] = useState<SubHistory[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);

  // Override
  const [override, setOverride] = useState<OrgOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    ai_drafts: '', ai_drafts_unlimited: false, replies: '', replies_unlimited: false,
    locations: '', team_members: '', campaign_emails: '', campaign_emails_unlimited: false,
    custom_price: '', billing_interval: 'monthly', contract_start: '', contract_end: '', notes: '',
  });
  const [savingOverride, setSavingOverride] = useState(false);
  const [clearingOverride, setClearingOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideEditing, setOverrideEditing] = useState(false);

  // Suspension modal
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendNote, setSuspendNote] = useState('');
  const [toggling, setToggling] = useState(false);

  // Plan change
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  // Impersonation
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonateErr, setImpersonateErr] = useState<string | null>(null);

  // Activity tab
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Refunds tab
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundStatusFilter, setRefundStatusFilter] = useState('all');
  const [updatingRefund, setUpdatingRefund] = useState<string | null>(null);
  const [refundMsg, setRefundMsg] = useState<string | null>(null);

  // Support tab
  const [supportNotes, setSupportNotes] = useState<SupportNote[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);

  // IP Activity tab
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [pageViewsLoading, setPageViewsLoading] = useState(false);

  useEffect(() => { load(); }, [id]);

  // Lazy-load tab data on first visit
  useEffect(() => {
    if (!org) return;
    if (activeTab === 'activity' && auditEvents.length === 0 && !auditLoading) loadAudit();
    if (activeTab === 'refunds' && refunds.length === 0 && !refundsLoading) loadRefunds();
    if (activeTab === 'support' && supportNotes.length === 0 && !supportLoading) loadSupport();
    if (activeTab === 'ip-activity' && pageViews.length === 0 && !pageViewsLoading) loadPageViews();
  }, [activeTab, org]);

  async function load() {
    setLoading(true);
    if (!id) { setNotFound(true); setLoading(false); return; }

    // id param is the slug form (e.g. "00002"); reconstruct full ref_id for lookup
    const { data: orgRow } = await supabase
      .from('organizations').select('id, ref_id, name, created_at, status')
      .eq('ref_id', `ORG-${id}`).maybeSingle();
    if (!orgRow) { setNotFound(true); setLoading(false); return; }
    setOrg(orgRow as OrgDetail);

    const { data: memberOrgRows } = await supabase
      .from('org_members').select('user_id, role, created_at').eq('org_id', orgRow.id);
    const orgMemberRows = memberOrgRows ?? [];
    const memberUserIds = orgMemberRows.map((m: { user_id: string }) => m.user_id);
    const ownerRow = orgMemberRows.find((m: { role: string }) => m.role === 'owner');
    const ownerUserId = ownerRow?.user_id ?? null;

    if (memberUserIds.length === 0) { setLoading(false); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

    const [plansRes, subsRes, profilesRes, emailsRes, usageAiRes, usagePubRes, usageHistRes, connRes, auditRes] = await Promise.all([
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      ownerUserId
        ? supabase.from('subscriptions').select('id, user_id, plan_id, status, current_period_end, cancel_at_period_end')
            .eq('user_id', ownerUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('id, display_name').in('id', memberUserIds),
      memberUserIds.length > 0
        ? supabase.rpc('get_users_email', { user_ids: memberUserIds })
        : Promise.resolve({ data: [] }),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true })
        .in('user_id', memberUserIds).eq('event_type', 'ai_draft').gte('created_at', monthStart),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true })
        .in('user_id', memberUserIds).eq('event_type', 'published_reply').gte('created_at', monthStart),
      supabase.from('usage_events').select('event_type, created_at').in('user_id', memberUserIds)
        .in('event_type', ['ai_draft', 'published_reply']).gte('created_at', twelveMonthsAgo),
      supabase.from('google_connections').select('id, google_email, state, connected_at').in('user_id', memberUserIds),
      supabase.from('audit_events').select('id, action, metadata, created_at')
        .eq('org_id', orgRow.id).eq('resource_type', 'subscription')
        .order('created_at', { ascending: false }).limit(20),
    ]);

    type PlanRow = { id: string; slug: string; name: string };
    const allPlans: PlanOption[] = (plansRes.data ?? []) as PlanOption[];
    setPlans(allPlans);
    const planById = new Map<string, PlanRow>(allPlans.map((p) => [p.id, p]));

    const subData = subsRes.data as { id: string; user_id: string; plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
    const planSlug = subData ? (planById.get(subData.plan_id)?.slug ?? 'free') : 'free';
    const planName = subData ? (planById.get(subData.plan_id)?.name ?? 'Free') : 'Free';

    setSub({ id: subData?.id ?? '', plan_id: subData?.plan_id ?? '', plan: planSlug, planName, status: subData?.status ?? 'active', period_end: subData?.current_period_end ?? null, cancel_at_period_end: subData?.cancel_at_period_end ?? false });
    setSelectedPlanId(subData?.plan_id ?? '');
    setUsage({ aiDrafts: usageAiRes.count ?? 0, published: usagePubRes.count ?? 0, limit: PLAN_LIMIT[planSlug] ?? 50 });

    type HistRow = { event_type: string; created_at: string };
    setRawUsageEvents((usageHistRes.data ?? []) as HistRow[]);

    type ConnRow = { id: string; google_email: string | null; state: string; connected_at: string };
    const connData = (connRes.data ?? []) as ConnRow[];
    setConnections(connData);

    const connIds = connData.map(c => c.id);
    if (connIds.length > 0) {
      const { data: locData } = await supabase
        .from('google_locations')
        .select('id, connection_id, display_name, address, is_selected')
        .in('connection_id', connIds);
      setGoogleLocations((locData ?? []) as GoogleLocation[]);
    } else {
      setGoogleLocations([]);
    }

    type AuditRow = { id: string; action: string; metadata: Record<string, unknown> | null; created_at: string };
    setSubHistory((auditRes.data ?? []) as AuditRow[]);

    type ProfileRow = { id: string; display_name: string | null };
    const profileById = new Map<string, ProfileRow>((profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p]));
    const emailById = new Map<string, string>((emailsRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));

    type OrgMemberRow = { user_id: string; role: string; created_at: string };
    setMembers((orgMemberRows as OrgMemberRow[]).map(m => ({
      user_id: m.user_id, role: m.role,
      display_name: profileById.get(m.user_id)?.display_name ?? null,
      email: emailById.get(m.user_id) ?? null, created_at: m.created_at,
    })));

    const { data: ov } = await supabase.from('org_plan_overrides')
      .select('id, ai_drafts_per_month, published_replies_per_month, max_locations, max_team_members, campaign_emails_per_month, custom_price_cents, billing_interval, contract_start, contract_end, notes')
      .eq('org_id', orgRow.id).maybeSingle();

    if (ov) {
      setOverride(ov as OrgOverride);
      setUsage(prev => {
        if (!prev) return prev;
        if (ov.ai_drafts_per_month === -1) return { ...prev, limit: 999999 };
        if (ov.ai_drafts_per_month != null) return { ...prev, limit: ov.ai_drafts_per_month };
        return prev;
      });
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
        contract_start: ov.contract_start ?? '', contract_end: ov.contract_end ?? '', notes: ov.notes ?? '',
      });
    } else {
      setOverride(null);
    }

    setLoading(false);
  }

  async function loadAudit() {
    if (!org) return;
    setAuditLoading(true);
    const { data } = await supabase.from('audit_events')
      .select('id, action, actor_user_id, metadata, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditEvents((data ?? []) as AuditEvent[]);
    setAuditLoading(false);
  }

  async function loadRefunds() {
    if (!org) return;
    setRefundsLoading(true);
    const { data } = await supabase.from('refund_requests')
      .select('id, amount_cents, reason, status, admin_note, reviewed_at, processed_at, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false });
    setRefunds((data ?? []) as RefundRow[]);
    setRefundsLoading(false);
  }

  async function loadSupport() {
    if (!org) return;
    setSupportLoading(true);
    const { data } = await supabase.from('org_support_notes')
      .select('id, author_id, body, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false });
    setSupportNotes((data ?? []) as SupportNote[]);
    setSupportLoading(false);
  }

  async function loadPageViews() {
    if (!org) return;
    setPageViewsLoading(true);
    // Get all user_ids for this org
    const { data: memberRows } = await supabase
      .from('org_members').select('user_id').eq('org_id', org.id);
    const userIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) { setPageViewsLoading(false); return; }
    const { data } = await supabase
      .from('page_views')
      .select('id, user_id, ip, path, user_agent, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(500);
    setPageViews((data ?? []) as PageView[]);
    setPageViewsLoading(false);
  }

  function overrideFieldVal(unlim: boolean, val: string): number | null {
    if (unlim) return -1;
    const n = parseInt(val);
    return isNaN(n) ? null : n;
  }

  async function handleSaveOverride() {
    if (!org) return;
    setSavingOverride(true); setOverrideMsg(null);
    const payload = {
      org_id: org.id,
      ai_drafts_per_month: overrideFieldVal(overrideForm.ai_drafts_unlimited, overrideForm.ai_drafts),
      published_replies_per_month: overrideFieldVal(overrideForm.replies_unlimited, overrideForm.replies),
      max_locations: overrideForm.locations ? parseInt(overrideForm.locations) : null,
      max_team_members: overrideForm.team_members ? parseInt(overrideForm.team_members) : null,
      campaign_emails_per_month: overrideFieldVal(overrideForm.campaign_emails_unlimited, overrideForm.campaign_emails),
      custom_price_cents: overrideForm.custom_price ? Math.round(parseFloat(overrideForm.custom_price) * 100) : null,
      billing_interval: overrideForm.billing_interval || null,
      contract_start: overrideForm.contract_start || null, contract_end: overrideForm.contract_end || null,
      notes: overrideForm.notes.trim() || null,
    };
    const { error } = await supabase.from('org_plan_overrides').upsert(payload, { onConflict: 'org_id' });
    setSavingOverride(false);
    if (error) { setOverrideMsg(`Error: ${error.message}`); return; }
    setOverrideEditing(false); setOverrideMsg(null); load();
  }

  async function handleClearOverride() {
    if (!org || !override) return;
    setClearingOverride(true); setOverrideMsg(null);
    const { error } = await supabase.from('org_plan_overrides').delete().eq('org_id', org.id);
    setClearingOverride(false);
    if (error) { setOverrideMsg(`Error: ${error.message}`); return; }
    setOverrideEditing(false); setOverrideMsg(null); load();
  }

  async function handleToggleStatus() {
    if (!org) return;
    if (org.status !== 'suspended') {
      // Open modal to collect reason before suspending
      setSuspendReason('');
      setSuspendNote('');
      setShowSuspendModal(true);
      return;
    }
    // Reactivate — no modal needed
    setToggling(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('organizations').update({ status: 'active' }).eq('id', org.id);
    if (user) {
      await supabase.from('audit_events').insert({
        actor_user_id: user.id, action: 'admin_reactivate_org',
        resource_type: 'organization', resource_id: org.id,
        metadata: { org_name: org.name },
      });
    }
    setToggling(false); load();
  }

  async function handleConfirmSuspend() {
    if (!org || !suspendReason) return;
    setToggling(true);
    setShowSuspendModal(false);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('organizations').update({ status: 'suspended' }).eq('id', org.id);
    if (user) {
      await supabase.from('audit_events').insert({
        actor_user_id: user.id, action: 'admin_suspend_org',
        resource_type: 'organization', resource_id: org.id,
        metadata: { org_name: org.name, reason: suspendReason, note: suspendNote || null },
      });
    }
    setToggling(false); load();
  }

  async function handleChangePlan() {
    if (!sub || !selectedPlanId || selectedPlanId === sub.plan_id) return;
    setChangingPlan(true); setPlanMsg(null);
    const { error } = await supabase.from('subscriptions').update({ plan_id: selectedPlanId }).eq('id', sub.id);
    setChangingPlan(false);
    setPlanMsg(error ? `Error: ${error.message}` : 'Plan updated.');
    if (!error) load();
  }

  async function handleImpersonate(userId: string) {
    setImpersonating(userId); setImpersonateErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${env.supabaseUrl}/functions/v1/admin-impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': env.supabaseAnonKey },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) { setImpersonateErr(data.error ?? 'Impersonation failed'); return; }
      window.open(data.action_link, '_blank', 'noopener,noreferrer');
    } catch { setImpersonateErr('Network error'); }
    finally { setImpersonating(null); }
  }

  async function handleUpdateRefundStatus(refundId: string, newStatus: string, note?: string) {
    setUpdatingRefund(refundId); setRefundMsg(null);
    const payload: Record<string, unknown> = { status: newStatus };
    if (note !== undefined) payload.admin_note = note;
    if (['APPROVED', 'REJECTED'].includes(newStatus)) payload.reviewed_at = new Date().toISOString();
    if (['REFUNDED', 'FAILED'].includes(newStatus)) payload.processed_at = new Date().toISOString();
    const { error } = await supabase.from('refund_requests').update(payload).eq('id', refundId);
    setUpdatingRefund(null);
    if (error) { setRefundMsg(`Error: ${error.message}`); return; }
    loadRefunds();
  }

  async function handleAddNote() {
    if (!org || !newNote.trim()) return;
    setSavingNote(true); setNoteMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNoteMsg('Not authenticated'); setSavingNote(false); return; }
    const { error } = await supabase.from('org_support_notes').insert({ org_id: org.id, author_id: user.id, body: newNote.trim() });
    setSavingNote(false);
    if (error) { setNoteMsg(`Error: ${error.message}`); return; }
    setNewNote(''); loadSupport();
  }

  function canImpersonate() { return ['owner', 'super_admin', 'admin', 'support'].includes(platformRole ?? ''); }

  if (loading) return (
    <div className="px-8 py-8">
      <div className="h-4 bg-[#E5E7EB] rounded animate-pulse w-48 mb-8" />
      <div className="grid grid-cols-3 gap-4 mb-6">{[0,1,2].map(i => <div key={i} className="h-24 bg-[#E5E7EB] rounded-xl animate-pulse" />)}</div>
      <div className="h-48 bg-[#E5E7EB] rounded-xl animate-pulse" />
    </div>
  );

  if (notFound || !org) return (
    <div className="px-8 py-8">
      <Link to="/clients" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Clients
      </Link>
      <p className="text-sm text-[#9CA3AF]">Client not found.</p>
    </div>
  );

  const isActive = org.status !== 'suspended';
  const statusColor = isActive ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]';
  const usagePct = usage ? Math.min(Math.round((usage.aiDrafts / usage.limit) * 100), 100) : 0;

  const TABS: { id: OrgTab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'members', label: 'Members', badge: members.length },
    { id: 'google', label: 'Google', badge: connections.length },
    { id: 'ai-activity', label: 'AI Activity' },
    { id: 'refunds', label: 'Refunds' },
    { id: 'activity', label: 'Activity' },
    { id: 'ip-activity', label: 'IP Activity' },
    { id: 'support', label: 'Support' },
  ];

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <Link to="/clients" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#111827]">{org.name}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusColor}`}>{isActive ? 'Active' : 'Suspended'}</span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">{formatId(org.ref_id)} · Since {formatDate(org.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {sub?.plan && <span className={`inline-block px-3 py-1 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{sub.planName}</span>}
          <button onClick={handleToggleStatus} disabled={toggling}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50 ${isActive ? 'bg-[#FEF2F2] text-red-700 hover:bg-red-100' : 'bg-[#ECFDF5] text-[#065F46] hover:bg-green-100'}`}>
            {toggling ? '…' : isActive ? 'Suspend' : 'Reactivate'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'border-[#6C55E8] text-[#6C55E8]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E5E7EB] text-[#374151]">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <UsageTrendChart events={rawUsageEvents} aiDrafts={usage?.aiDrafts ?? 0} published={usage?.published ?? 0}
            members={members.length} connections={connections.length} usagePct={usagePct} usageLimit={usage?.limit ?? 50} />
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]"><h2 className="text-sm font-semibold text-[#111827]">Organisation</h2></div>
            <dl className="divide-y divide-[#F3F4F6]">
              {[
                { label: 'ID', value: <span className="font-mono text-xs">{formatId(org.ref_id)}</span> },
                { label: 'Name', value: org.name },
                { label: 'Created', value: formatDate(org.created_at) },
                { label: 'Status', value: <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusColor}`}>{isActive ? 'Active' : 'Suspended'}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="px-6 py-3.5 flex items-center gap-4">
                  <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">{label}</dt>
                  <dd className="text-sm text-[#374151]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* ── Subscription Tab ── */}
      {activeTab === 'subscription' && (
        <div className="space-y-4">
          {/* Subscription card */}
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Subscription</h2>
              {sub?.cancel_at_period_end && <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">Cancels at period end</span>}
            </div>
            <dl className="divide-y divide-[#F3F4F6]">
              {[
                { label: 'Plan', value: sub ? <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{sub.planName}</span> : <span className="text-[#9CA3AF]">Free</span> },
                { label: 'Status', value: <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${sub?.status === 'active' ? 'bg-[#ECFDF5] text-[#065F46]' : sub?.status === 'trialing' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : sub?.status === 'past_due' ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#F3F4F6] text-[#374151]'}`}>{sub?.status ?? 'none'}</span> },
                { label: 'Period end', value: sub?.period_end ? formatDate(sub.period_end) : '—' },
                { label: 'Limit', value: override?.ai_drafts_per_month === -1 ? 'Unlimited drafts / month' : override?.ai_drafts_per_month != null ? `${override.ai_drafts_per_month} drafts / month` : `${usage?.limit ?? 50} drafts / month` },
              ].map(({ label, value }) => (
                <div key={label} className="px-6 py-3.5 flex items-center gap-4">
                  <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">{label}</dt>
                  <dd className="text-sm text-[#374151]">{value}</dd>
                </div>
              ))}
              {override?.custom_price_cents != null && (
                <div className="px-6 py-3.5 flex items-center gap-4">
                  <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Price</dt>
                  <dd className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827]">${(override.custom_price_cents / 100).toFixed(2).replace(/\.00$/, '')}/{override.billing_interval === 'annual' ? 'yr' : 'mo'}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#C2410C]">Scale</span>
                  </dd>
                </div>
              )}
            </dl>
            {/* Change Plan */}
            {plans.length > 0 && (
              <div className="px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAF7]">
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Change Plan</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Dropdown fullWidth value={selectedPlanId} onChange={setSelectedPlanId} options={plans.map(p => ({ value: p.id, label: p.name }))} /></div>
                  <button onClick={handleChangePlan} disabled={changingPlan || !selectedPlanId || selectedPlanId === sub?.plan_id}
                    className="px-3 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#6C55E8] disabled:opacity-50 rounded transition-colors">
                    {changingPlan ? '…' : 'Apply'}
                  </button>
                </div>
                {planMsg && <p className={`mt-2 text-xs ${planMsg.startsWith('Error') ? 'text-red-600' : 'text-[#6C55E8]'}`}>{planMsg}</p>}
              </div>
            )}
            {/* History */}
            <div className="border-t border-[#F3F4F6]">
              <div className="px-6 py-3 bg-[#FAFAF7] flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">History</p>
                <span className="text-[10px] text-[#9CA3AF]">{subHistory.length} event{subHistory.length !== 1 ? 's' : ''}</span>
              </div>
              {subHistory.length === 0 ? (
                <p className="px-6 py-5 text-xs text-[#9CA3AF] text-center">No subscription events logged.</p>
              ) : (
                <div className="divide-y divide-[#F9FAFB]">
                  {subHistory.map(h => {
                    const meta = h.metadata ?? {};
                    const label = String(meta.action_label ?? h.action).replace(/_/g, ' ');
                    const planFrom = meta.from_plan as string | undefined;
                    const planTo = meta.to_plan as string | undefined;
                    return (
                      <div key={h.id} className="px-6 py-3 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#111111] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#374151] capitalize font-medium">{label}</p>
                          {planFrom && planTo && <p className="text-[10px] text-[#9CA3AF] mt-0.5"><span className="font-semibold">{planFrom}</span>{' → '}<span className="font-semibold">{planTo}</span></p>}
                        </div>
                        <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{formatDate(h.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Custom Override */}
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#111827]">Custom Override</h2>
                {override && !overrideEditing && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">Active</span>}
              </div>
              {!overrideEditing && (
                <button onClick={() => { setOverrideMsg(null); setOverrideEditing(true); }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#6C55E8] border border-[#6C55E8]/30 rounded-lg hover:bg-[#D8CCFF] transition-colors">
                  {override ? 'Edit' : 'Set Override'}
                </button>
              )}
            </div>
            {!overrideEditing && (
              <div className="px-6 py-5">
                {!override ? (
                  <p className="text-sm text-[#9CA3AF]">No override set — client uses plan defaults.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                    {[
                      { label: 'AI Drafts / mo', value: override.ai_drafts_per_month === -1 ? 'Unlimited' : override.ai_drafts_per_month != null ? String(override.ai_drafts_per_month) : '—' },
                      { label: 'Replies / mo', value: override.published_replies_per_month === -1 ? 'Unlimited' : override.published_replies_per_month != null ? String(override.published_replies_per_month) : '—' },
                      { label: 'Campaign Emails / mo', value: override.campaign_emails_per_month === -1 ? 'Unlimited' : override.campaign_emails_per_month != null ? String(override.campaign_emails_per_month) : '—' },
                      { label: 'Max Locations', value: override.max_locations != null ? String(override.max_locations) : '—' },
                      { label: 'Max Members', value: override.max_team_members != null ? String(override.max_team_members) : '—' },
                      { label: 'Custom Price', value: override.custom_price_cents != null ? `$${(override.custom_price_cents / 100).toFixed(2).replace(/\.00$/, '')}/${override.billing_interval === 'annual' ? 'yr' : 'mo'}` : '—' },
                      { label: 'Contract Start', value: override.contract_start ?? '—' },
                      { label: 'Contract End', value: override.contract_end ?? '—' },
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
                {overrideMsg && <p className={`mt-3 text-xs ${overrideMsg.startsWith('Error') ? 'text-red-600' : 'text-[#6C55E8]'}`}>{overrideMsg}</p>}
              </div>
            )}
            {overrideEditing && (
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {/* AI Drafts */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#374151]">AI Drafts / month</label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={overrideForm.ai_drafts_unlimited} onChange={e => setOverrideForm(f => ({ ...f, ai_drafts_unlimited: e.target.checked }))} className="w-3.5 h-3.5 accent-[#6C55E8]" />
                        <span className="text-xs text-[#6B7280]">Unlimited</span>
                      </label>
                    </div>
                    <input type="number" min="0" disabled={overrideForm.ai_drafts_unlimited} value={overrideForm.ai_drafts} onChange={e => setOverrideForm(f => ({ ...f, ai_drafts: e.target.value }))} placeholder="blank = use plan" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                  </div>
                  {/* Replies */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#374151]">Published Replies / month</label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={overrideForm.replies_unlimited} onChange={e => setOverrideForm(f => ({ ...f, replies_unlimited: e.target.checked }))} className="w-3.5 h-3.5 accent-[#6C55E8]" />
                        <span className="text-xs text-[#6B7280]">Unlimited</span>
                      </label>
                    </div>
                    <input type="number" min="0" disabled={overrideForm.replies_unlimited} value={overrideForm.replies} onChange={e => setOverrideForm(f => ({ ...f, replies: e.target.value }))} placeholder="blank = use plan" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                  </div>
                  {/* Locations */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">Max Locations</label>
                    <input type="number" min="1" value={overrideForm.locations} onChange={e => setOverrideForm(f => ({ ...f, locations: e.target.value }))} placeholder="blank = use plan" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8]" />
                  </div>
                  {/* Team members */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">Max Team Members</label>
                    <input type="number" min="1" value={overrideForm.team_members} onChange={e => setOverrideForm(f => ({ ...f, team_members: e.target.value }))} placeholder="blank = use plan" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8]" />
                  </div>
                  {/* Campaign emails */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#374151]">Campaign Emails / month</label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={overrideForm.campaign_emails_unlimited} onChange={e => setOverrideForm(f => ({ ...f, campaign_emails_unlimited: e.target.checked }))} className="w-3.5 h-3.5 accent-[#6C55E8]" />
                        <span className="text-xs text-[#6B7280]">Unlimited</span>
                      </label>
                    </div>
                    <input type="number" min="0" disabled={overrideForm.campaign_emails_unlimited} value={overrideForm.campaign_emails} onChange={e => setOverrideForm(f => ({ ...f, campaign_emails: e.target.value }))} placeholder="blank = use plan" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                  </div>
                  {/* Custom price */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">Custom Price (USD)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">$</span>
                        <input type="number" min="0" step="0.01" value={overrideForm.custom_price} onChange={e => setOverrideForm(f => ({ ...f, custom_price: e.target.value }))} placeholder="e.g. 299" className="w-full pl-6 pr-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8]" />
                      </div>
                      <Dropdown value={overrideForm.billing_interval} onChange={v => setOverrideForm(f => ({ ...f, billing_interval: v }))}
                        options={[{ value: 'monthly', label: '/ month' }, { value: 'annual', label: '/ year' }]} />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">Informational only — billing handled via Stripe or invoice.</p>
                  </div>
                  {/* Contract dates */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">Contract Start</label>
                    <input type="date" value={overrideForm.contract_start} onChange={e => setOverrideForm(f => ({ ...f, contract_start: e.target.value }))} className="w-full text-xs shadow-sm rounded-xl px-3 py-2 text-[#374151] border border-[#E5E7EB] focus:outline-none focus:border-[#6C55E8]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">Contract End</label>
                    <input type="date" value={overrideForm.contract_end} onChange={e => setOverrideForm(f => ({ ...f, contract_end: e.target.value }))} className="w-full text-xs shadow-sm rounded-xl px-3 py-2 text-[#374151] border border-[#E5E7EB] focus:outline-none focus:border-[#6C55E8]" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-[#374151] mb-1">Internal Notes</label>
                  <textarea rows={3} value={overrideForm.notes} onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Negotiated by sales, includes onboarding support" className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8] resize-none" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {override && <button onClick={handleClearOverride} disabled={clearingOverride} className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">{clearingOverride ? 'Clearing…' : 'Clear Override'}</button>}
                    {overrideMsg && <p className={`text-xs ${overrideMsg.startsWith('Error') ? 'text-red-600' : 'text-[#6C55E8]'}`}>{overrideMsg}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setOverrideEditing(false); setOverrideMsg(null); }} className="px-3 py-2 text-xs font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
                    <button onClick={handleSaveOverride} disabled={savingOverride} className="px-4 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50">{savingOverride ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Members Tab ── */}
      {activeTab === 'members' && (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]"><h2 className="text-sm font-semibold text-[#111827]">Team Members</h2></div>
          {impersonateErr && <div className="mx-6 mt-3 px-3 py-2 bg-[#FEF2F2] text-red-700 text-xs rounded-lg">{impersonateErr}</div>}
          {members.length === 0 ? <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No members found.</p> : (
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
                {members.map(m => (
                  <tr key={m.user_id} className="hover:bg-[#FAFAF7]">
                    <td className="px-5 py-3.5 font-medium text-[#111827]">{m.display_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-[#374151] text-xs">{m.email ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${m.role === 'owner' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F3F4F6] text-[#374151]'}`}>{m.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{formatDate(m.created_at)}</td>
                    {canImpersonate() && (
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => handleImpersonate(m.user_id)} disabled={impersonating === m.user_id}
                          title={`Impersonate ${m.display_name ?? m.email ?? 'user'} in the portal`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#FAFAF7] hover:border-[#6C55E8] hover:text-[#6C55E8] transition-colors disabled:opacity-50">
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
      )}

      {/* ── Google Tab ── */}
      {activeTab === 'google' && (
        <div className="space-y-4">
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Google Accounts', value: connections.length },
              { label: 'Total Locations', value: googleLocations.length },
              { label: 'Enabled Locations', value: googleLocations.filter(l => l.is_selected).length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white shadow-sm rounded-xl px-5 py-4">
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-bold text-[#6C55E8]">{value}</p>
              </div>
            ))}
          </div>

          {connections.length === 0 ? (
            <div className="bg-white shadow-sm rounded-xl px-6 py-8 text-sm text-[#9CA3AF] text-center">No Google accounts connected.</div>
          ) : (
            <div className="space-y-4">
              {connections.map(g => {
                const locs = googleLocations.filter(l => l.connection_id === g.id);
                const enabledCount = locs.filter(l => l.is_selected).length;
                const stateColor = g.state === 'CONNECTED' ? 'bg-[#ECFDF5] text-[#065F46]' : g.state === 'DISCONNECTED' ? 'bg-[#F3F4F6] text-[#374151]' : 'bg-[#FEF2F2] text-[#991B1B]';
                return (
                  <div key={g.id} className="bg-white shadow-sm rounded-xl overflow-hidden">
                    {/* Connection header */}
                    <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">{g.google_email ?? '—'}</p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">Connected {formatDate(g.connected_at)}</p>
                      </div>
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${stateColor}`}>{g.state}</span>
                      <span className="text-xs text-[#6B7280] font-medium">{locs.length} location{locs.length !== 1 ? 's' : ''} · {enabledCount} enabled</span>
                    </div>

                    {/* Locations list */}
                    {locs.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-[#9CA3AF]">No locations fetched for this account.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#F3F4F6]">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Location</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Address</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {locs.map(loc => (
                            <tr key={loc.id} className="hover:bg-[#FAFAF7]">
                              <td className="px-5 py-3.5 text-[#374151] font-medium">{loc.display_name ?? '—'}</td>
                              <td className="px-5 py-3.5 text-[#6B7280] text-xs">{loc.address ?? '—'}</td>
                              <td className="px-5 py-3.5">
                                {loc.is_selected
                                  ? <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-[#ECFDF5] text-[#065F46]">Enabled</span>
                                  : <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-[#F3F4F6] text-[#6B7280]">Disabled</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── AI Activity Tab ── */}
      {activeTab === 'ai-activity' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'AI Drafts (this month)', value: usage?.aiDrafts ?? 0, color: 'text-[#6C55E8]' },
              { label: 'Replies (this month)', value: usage?.published ?? 0, color: 'text-[#059669]' },
              { label: 'Events (12 months)', value: rawUsageEvents.length, color: 'text-[#374151]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white shadow-sm rounded-xl px-5 py-4">
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]"><h2 className="text-sm font-semibold text-[#111827]">Monthly Breakdown (12 months)</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#F3F4F6]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Month</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">AI Drafts</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Published Replies</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {(() => {
                    const now = new Date();
                    const rows = Array.from({ length: 12 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      const events = rawUsageEvents.filter(e => e.created_at.startsWith(key));
                      const drafts = events.filter(e => e.event_type === 'ai_draft').length;
                      const replies = events.filter(e => e.event_type === 'published_reply').length;
                      return { label: d.toLocaleString('en', { month: 'long', year: 'numeric' }), drafts, replies, total: drafts + replies };
                    }).reverse();
                    return rows.map(r => (
                      <tr key={r.label} className="hover:bg-[#FAFAF7]">
                        <td className="px-5 py-3 text-sm text-[#374151]">{r.label}</td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-[#6C55E8]">{r.drafts.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-[#059669]">{r.replies.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-[#111827]">{r.total.toLocaleString()}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Refunds Tab ── */}
      {activeTab === 'refunds' && (
        <div className="space-y-4">
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-[#111827]">Refund Requests</h2>
              <Dropdown value={refundStatusFilter} onChange={setRefundStatusFilter}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'REQUESTED', label: 'Requested' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'PROCESSING', label: 'Processing' },
                  { value: 'REFUNDED', label: 'Refunded' },
                  { value: 'FAILED', label: 'Failed' },
                ]}
                clearable
              />
            </div>
            {refundMsg && <div className="mx-6 mt-3 px-3 py-2 bg-[#FEF2F2] text-red-700 text-xs rounded-lg">{refundMsg}</div>}
            {refundsLoading ? (
              <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">Loading…</p>
            ) : refunds.filter(r => refundStatusFilter === 'all' || r.status === refundStatusFilter).length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No refund requests.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {refunds.filter(r => refundStatusFilter === 'all' || r.status === refundStatusFilter).map(r => (
                  <div key={r.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${REFUND_STATUS_COLOR[r.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{r.status}</span>
                          {r.amount_cents && <span className="text-sm font-semibold text-[#111827]">${(r.amount_cents / 100).toFixed(2)}</span>}
                          <span className="text-xs text-[#9CA3AF]">{formatDate(r.created_at)}</span>
                        </div>
                        <p className="text-sm text-[#374151] mb-1">{r.reason}</p>
                        {r.admin_note && <p className="text-xs text-[#6B7280] italic">Admin: {r.admin_note}</p>}
                      </div>
                      {['REQUESTED', 'UNDER_REVIEW'].includes(r.status) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.status === 'REQUESTED' && (
                            <button onClick={() => handleUpdateRefundStatus(r.id, 'UNDER_REVIEW')} disabled={updatingRefund === r.id}
                              className="px-2.5 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:bg-[#FAFAF7] transition-colors disabled:opacity-50">Review</button>
                          )}
                          <button onClick={() => handleUpdateRefundStatus(r.id, 'APPROVED')} disabled={updatingRefund === r.id}
                            className="px-2.5 py-1.5 text-xs font-medium text-[#065F46] bg-[#ECFDF5] hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">Approve</button>
                          <button onClick={() => handleUpdateRefundStatus(r.id, 'REJECTED')} disabled={updatingRefund === r.id}
                            className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-[#FEF2F2] hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">Reject</button>
                        </div>
                      )}
                      {r.status === 'APPROVED' && (
                        <button onClick={() => handleUpdateRefundStatus(r.id, 'PROCESSING')} disabled={updatingRefund === r.id}
                          className="px-2.5 py-1.5 text-xs font-medium text-[#7C3AED] bg-[#F3E8FF] hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">Process</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === 'activity' && (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Audit Activity</h2>
            <button onClick={loadAudit} className="px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">Refresh</button>
          </div>
          {auditLoading ? <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">Loading…</p> : auditEvents.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No audit events.</p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {auditEvents.map(ev => (
                <div key={ev.id} className="px-6 py-3.5 flex items-start gap-3 hover:bg-[#FAFAF7]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#111111] flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#374151] capitalize">{ev.action.replace(/_/g, ' ')}</p>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">{JSON.stringify(ev.metadata).slice(0, 120)}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{formatDate(ev.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IP Activity Tab ── */}
      {activeTab === 'ip-activity' && (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">IP Activity</h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Last 500 page views across all org members (90-day retention)</p>
            </div>
            <button onClick={() => { setPageViews([]); loadPageViews(); }} className="px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors">Refresh</button>
          </div>
          {pageViewsLoading ? (
            <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">Loading…</p>
          ) : pageViews.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No page views recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280] uppercase tracking-wide text-[10px]">IP</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280] uppercase tracking-wide text-[10px]">Path</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280] uppercase tracking-wide text-[10px]">User Agent</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280] uppercase tracking-wide text-[10px]">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {pageViews.map(pv => (
                    <tr key={pv.id} className="hover:bg-[#FAFAF7]">
                      <td className="px-4 py-2.5 font-mono text-[#374151]">{pv.ip}</td>
                      <td className="px-4 py-2.5 text-[#374151] max-w-[260px] truncate">{pv.path}</td>
                      <td className="px-4 py-2.5 text-[#9CA3AF] max-w-[220px] truncate">{pv.user_agent ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[#9CA3AF] whitespace-nowrap">{formatDate(pv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Support Tab ── */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          {/* New note form */}
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]"><h2 className="text-sm font-semibold text-[#111827]">Add Internal Note</h2></div>
            <div className="px-6 py-5">
              <textarea rows={4} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a support note, observation, or escalation detail…"
                className="w-full px-3 py-2.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#6C55E8] resize-none" />
              {noteMsg && <p className="mt-2 text-xs text-red-600">{noteMsg}</p>}
              <div className="mt-3 flex justify-end">
                <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#0a3d30] rounded-lg transition-colors disabled:opacity-50">
                  {savingNote ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>
          {/* Notes list */}
          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]"><h2 className="text-sm font-semibold text-[#111827]">Notes History</h2></div>
            {supportLoading ? <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">Loading…</p> : supportNotes.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#9CA3AF] text-center">No notes yet.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {supportNotes.map(note => (
                  <div key={note.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-[#374151]">Support note</span>
                      <span className="text-[10px] text-[#9CA3AF]">{formatDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">{note.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Suspend Confirmation Modal ── */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSuspendModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#111827] mb-1">Suspend {org.name}?</h2>
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
                onClick={() => setShowSuspendModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuspend}
                disabled={!suspendReason || toggling}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {toggling ? 'Suspending…' : 'Suspend Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

