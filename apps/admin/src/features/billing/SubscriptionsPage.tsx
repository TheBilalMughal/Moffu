import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  isAtRisk: boolean;
  usageCount: number;
  usageLimit: number;
  usagePct: number;
  isOverage: boolean;
  daysUntilRenewal: number | null;
}

interface TimelineEvent {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SavedFilter {
  name: string;
  plan: string;
  status: string;
  interval: string;
  search: string;
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

const PLAN_LIMIT: Record<string, number> = {
  free: 50, starter: 200, growth: 600, scale: 2000, pro: 500, enterprise: 2000,
};

const PAGE_SIZE = 25;
const LS_SAVED = 'admin_sub_saved_filters';

function fmt(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function loadSaved(): SavedFilter[] {
  try { return JSON.parse(localStorage.getItem(LS_SAVED) ?? '[]'); } catch { return []; }
}

function exportCSV(rows: SubRow[]) {
  const headers = ['ID', 'Client', 'Email', 'Plan', 'Status', 'Interval', 'Amount (USD)', 'Period End', 'At Risk', 'Overage', 'Usage %', 'Created'];
  const data = rows.map((r) => [
    formatId(r.orgRefId), r.orgName ?? '', r.ownerEmail ?? '',
    r.planName, r.status, r.interval ?? '—',
    (r.amountCents / 100).toFixed(2),
    r.periodEnd && new Date(r.periodEnd).getFullYear() > 2100 ? '—' : r.periodEnd,
    r.isAtRisk ? 'Yes' : 'No',
    r.isOverage ? 'Yes' : 'No',
    `${r.usagePct}%`,
    r.createdAt,
  ]);
  const csv = [headers, ...data]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Per-Plan Chart ─────────────────────────────────────────────────────────────

function PlanBreakdownChart({ rows }: { rows: SubRow[] }) {
  const plans = ['free', 'starter', 'growth', 'scale'];
  const data = plans.map((slug) => {
    const planRows = rows.filter((r) => r.planSlug === slug);
    const mrr = planRows.filter((r) => r.status === 'active').reduce((s, r) =>
      s + r.amountCents, 0);
    return { slug, count: planRows.length, mrr };
  });
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const PLAN_NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', scale: 'Scale' };

  return (
    <div className="grid grid-cols-4 gap-3">
      {data.map((d) => (
        <div key={d.slug} className="bg-white border border-[#E5EAE8] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[d.slug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{PLAN_NAMES[d.slug]}</span>
            <span className="text-lg font-bold text-[#111827]">{d.count}</span>
          </div>
          <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 mb-2">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: PLAN_BAR[d.slug] ?? '#9CA3AF' }} />
          </div>
          <p className="text-xs text-[#9CA3AF]">MRR: <span className="font-medium text-[#374151]">{fmt(d.mrr)}</span></p>
        </div>
      ))}
    </div>
  );
}

// ── Timeline Modal ─────────────────────────────────────────────────────────────

function TimelineModal({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('audit_events')
        .select('id, action, metadata, created_at')
        .eq('org_id', orgId)
        .eq('resource_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(30);
      setEvents((data ?? []) as TimelineEvent[]);
      setLoading(false);
    }
    load();
  }, [orgId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E5EAE8] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#111827]">Subscription Timeline</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{orgName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-8 text-center text-xs text-[#9CA3AF]">Loading…</div>
          ) : events.length === 0 ? (
            <div className="px-6 py-8 text-center text-xs text-[#9CA3AF]">No subscription events logged yet.</div>
          ) : (
            <div className="divide-y divide-[#F9FAFB]">
              {events.map((e) => {
                const meta = e.metadata ?? {};
                const label = String(meta.action_label ?? e.action).replace(/_/g, ' ');
                const from = meta.from_plan as string | undefined;
                const to = meta.to_plan as string | undefined;
                return (
                  <div key={e.id} className="px-6 py-3.5 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#0D4C3C] flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#374151] capitalize font-medium">{label}</p>
                      {from && to && (
                        <p className="text-xs text-[#9CA3AF] mt-0.5">
                          <span className="font-semibold text-[#374151]">{from}</span> → <span className="font-semibold text-[#374151]">{to}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-[#9CA3AF] flex-shrink-0">{formatDate(e.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Saved Filters Popover ──────────────────────────────────────────────────────

function SavedFiltersPopover({
  current, onLoad, onClose,
}: { current: { plan: string; status: string; interval: string; search: string }; onLoad: (f: SavedFilter) => void; onClose: () => void }) {
  const [saved, setSaved] = useState<SavedFilter[]>(loadSaved());
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  function saveNow() {
    if (!name.trim()) return;
    const next: SavedFilter[] = [...saved, { name: name.trim(), ...current }];
    localStorage.setItem(LS_SAVED, JSON.stringify(next));
    setSaved(next);
    setName('');
  }

  function remove(i: number) {
    const next = saved.filter((_, idx) => idx !== i);
    localStorage.setItem(LS_SAVED, JSON.stringify(next));
    setSaved(next);
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5EAE8] rounded-xl shadow-lg z-30 overflow-hidden">
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
                <button onClick={() => { onLoad(s); onClose(); }} className="flex-1 text-xs text-left font-medium text-[#374151] hover:text-[#0D4C3C] transition-colors truncate">{s.name}</button>
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

// ── Plan Override Modal ────────────────────────────────────────────────────────

interface PlanOverrideModalProps {
  sub: SubRow;
  plans: { id: string; slug: string; name: string }[];
  priceMap: Map<string, number>;
  onClose: () => void;
  onSuccess: () => void;
}

function PlanOverrideModal({ sub, plans, priceMap, onClose, onSuccess }: PlanOverrideModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(sub.planId);
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'annual'>(
    (sub.interval as 'monthly' | 'annual') ?? 'monthly',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidPlans = plans.filter((p) => p.slug !== 'free');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const currentPrice = sub.amountCents;
  const newPrice = priceMap.get(`${selectedPlanId}:${selectedInterval}`) ?? priceMap.get(`${selectedPlanId}:monthly`) ?? 0;

  const noChange = selectedPlanId === sub.planId && selectedInterval === (sub.interval ?? 'monthly');

  async function apply() {
    if (noChange) return;
    setSaving(true); setError(null);
    const { error: err } = await supabase
      .from('subscriptions')
      .update({ plan_id: selectedPlanId, billing_interval: selectedInterval })
      .eq('id', sub.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from('audit_events').insert({
      action: 'subscription_plan_override',
      resource_type: 'subscription',
      resource_id: sub.id,
      org_id: sub.orgId,
      metadata: {
        action_label: 'Plan Override',
        from_plan: sub.planName,
        to_plan: selectedPlan?.name ?? selectedPlanId,
        from_interval: sub.interval,
        to_interval: selectedInterval,
      },
    });
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#111827]">Override Plan</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{sub.orgName ?? sub.ownerEmail ?? sub.id}</p>
          </div>
          <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Current */}
        <div className="bg-[#F8FAF9] rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-[#9CA3AF] mb-1">Current</p>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[sub.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{sub.planName}</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-[#111827]">{fmt(currentPrice)}<span className="text-xs text-[#9CA3AF] font-normal">/mo</span></span>
              {sub.interval === 'annual' && <p className="text-[10px] text-[#9CA3AF]">billed annually</p>}
            </div>
          </div>
        </div>

        {/* New Plan */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-[#374151] mb-1.5">New Plan</label>
          <div className="grid grid-cols-2 gap-2">
            {paidPlans.map((p) => (
              <button key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors text-left ${
                  selectedPlanId === p.id
                    ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]'
                    : 'border-[#E5EAE8] hover:border-[#0D4C3C] text-[#374151]'
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Interval */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-[#374151] mb-1.5">Billing Interval</label>
          <div className="grid grid-cols-2 gap-2">
            {(['monthly', 'annual'] as const).map((iv) => {
              const price = priceMap.get(`${selectedPlanId}:${iv}`);
              return (
                <button key={iv}
                  onClick={() => setSelectedInterval(iv)}
                  disabled={price === undefined}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors capitalize disabled:opacity-30 ${
                    selectedInterval === iv
                      ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]'
                      : 'border-[#E5EAE8] hover:border-[#0D4C3C] text-[#374151]'
                  }`}>
                  {iv}
                  {price !== undefined && (
                    <span className="block text-[10px] font-normal opacity-70">{fmt(price)}/mo</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {!noChange && newPrice > 0 && (
          <div className="bg-[#E6F2EE] rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-[#0D4C3C] font-medium">
              {selectedPlan?.name} · {selectedInterval} → {fmt(newPrice)}/mo
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors">
            Cancel
          </button>
          <button onClick={apply} disabled={noChange || saving}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-40 rounded-lg transition-colors">
            {saving ? 'Applying…' : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function SubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'plan' | 'status' | 'period_end' | 'amount'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPlanId, setBulkPlanId] = useState('');
  const [bulkChanging, setBulkChanging] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  // Plan override modal
  const [overrideTarget, setOverrideTarget] = useState<SubRow | null>(null);

  // Timeline modal
  const [timelineOrg, setTimelineOrg] = useState<{ id: string; name: string } | null>(null);

  // Saved filters
  const [showSaved, setShowSaved] = useState(false);

  // Section collapse
  const [showOverage, setShowOverage] = useState(true);
  const [showRenewal, setShowRenewal] = useState(true);
  const [showChart, setShowChart] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [subsRes, plansRes, pricesRes, orgMembersOwnerRes] = await Promise.all([
      supabase.from('subscriptions').select('id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('currency', 'USD'),
      supabase.from('org_members').select('user_id, org_id, role').eq('role', 'owner'),
    ]);

    type SubRaw = { id: string; user_id: string; plan_id: string; status: string; billing_interval: string | null; current_period_start: string; current_period_end: string; cancel_at_period_end: boolean; stripe_subscription_id: string | null; stripe_customer_id: string | null; created_at: string };
    type PlanRaw = { id: string; slug: string; name: string };
    type PriceRaw = { plan_id: string; billing_interval: string; amount_cents: number };
    type OrgMemberRaw = { user_id: string; org_id: string; role: string };

    const subs = (subsRes.data ?? []) as SubRaw[];
    const allPlans = (plansRes.data ?? []) as PlanRaw[];
    setPlans(allPlans);
    const planById = new Map<string, PlanRaw>(allPlans.map((p) => [p.id, p]));
    const priceMap = new Map<string, number>();
    (pricesRes.data ?? []).forEach((p: PriceRaw) => priceMap.set(`${p.plan_id}:${p.billing_interval}`, p.amount_cents));
    setPriceMap(priceMap);
    const orgByOwner = new Map<string, string>((orgMembersOwnerRes.data ?? []).map((m: OrgMemberRaw) => [m.user_id, m.org_id]));

    const ownerUserIds = subs.map((s) => s.user_id);
    const orgIds = [...new Set([...orgByOwner.values()])];

    const [orgsRes, emailsRes, allMembersRes] = await Promise.all([
      orgIds.length > 0 ? supabase.from('organizations').select('id, ref_id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
      ownerUserIds.length > 0 ? supabase.rpc('get_users_email', { user_ids: ownerUserIds }) : Promise.resolve({ data: [] }),
      orgIds.length > 0 ? supabase.from('org_members').select('user_id, org_id').in('org_id', orgIds) : Promise.resolve({ data: [] }),
    ]);

    type OrgRaw = { id: string; ref_id: string | null; name: string };
    const orgById = new Map<string, OrgRaw>((orgsRes.data ?? []).map((o: OrgRaw) => [o.id, o]));
    const emailById = new Map<string, string>((emailsRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));

    type MemberRow = { user_id: string; org_id: string };
    const allMembers = (allMembersRes.data ?? []) as MemberRow[];
    const orgByMember = new Map<string, string>(allMembers.map((m) => [m.user_id, m.org_id]));
    const membersByOrg = new Map<string, string[]>();
    allMembers.forEach((m) => {
      const arr = membersByOrg.get(m.org_id) ?? [];
      arr.push(m.user_id);
      membersByOrg.set(m.org_id, arr);
    });

    const allMemberIds = allMembers.map((m) => m.user_id);
    const usageByUser = new Map<string, number>();

    if (allMemberIds.length > 0) {
      const { data: usageData } = await supabase
        .from('usage_events')
        .select('user_id')
        .in('user_id', allMemberIds)
        .eq('event_type', 'ai_draft')
        .gte('created_at', monthStart);
      (usageData ?? []).forEach((r: { user_id: string }) => {
        usageByUser.set(r.user_id, (usageByUser.get(r.user_id) ?? 0) + 1);
      });
    }

    const usageByOrg = new Map<string, number>();
    usageByUser.forEach((count, userId) => {
      const orgId = orgByMember.get(userId);
      if (orgId) usageByOrg.set(orgId, (usageByOrg.get(orgId) ?? 0) + count);
    });

    const enriched: SubRow[] = subs.map((s) => {
      const plan = planById.get(s.plan_id);
      const interval = s.billing_interval ?? 'monthly';
      const amountCents = priceMap.get(`${s.plan_id}:${interval}`) ?? priceMap.get(`${s.plan_id}:monthly`) ?? 0;
      const orgId = orgByOwner.get(s.user_id) ?? null;
      const org = orgId ? orgById.get(orgId) : null;
      const planSlug = plan?.slug ?? 'free';
      const usageLimit = PLAN_LIMIT[planSlug] ?? 50;
      const usageCount = orgId ? (usageByOrg.get(orgId) ?? 0) : 0;
      const usagePct = Math.min(Math.round((usageCount / usageLimit) * 100), 100);
      const isAtRisk = s.status === 'past_due' || s.cancel_at_period_end;
      const periodEndDate = new Date(s.current_period_end);
      const daysUntilRenewal = periodEndDate.getFullYear() < 2100
        ? Math.ceil((periodEndDate.getTime() - now.getTime()) / 86400000)
        : null;
      return {
        id: s.id, userId: s.user_id, planId: s.plan_id,
        planSlug, planName: plan?.name ?? 'Free', amountCents,
        status: s.status, interval: s.billing_interval,
        periodStart: s.current_period_start, periodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        stripeSubId: s.stripe_subscription_id, stripeCustomerId: s.stripe_customer_id,
        createdAt: s.created_at,
        orgId, orgRefId: org?.ref_id ?? null, orgName: org?.name ?? null,
        ownerEmail: emailById.get(s.user_id) ?? null,
        isAtRisk, usageCount, usageLimit, usagePct,
        isOverage: usagePct >= 90,
        daysUntilRenewal,
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.planSlug !== 'free' && r.status === 'active');
    const mrr = paid.reduce((s, r) => s + r.amountCents, 0);
    return { total: rows.length, paid: paid.length, free: rows.filter((r) => r.planSlug === 'free').length, mrr, arr: mrr * 12 };
  }, [rows]);

  const overageRows = useMemo(() => rows.filter((r) => r.isOverage), [rows]);
  const renewalRows = useMemo(() => rows.filter((r) => r.daysUntilRenewal !== null && r.daysUntilRenewal >= 0 && r.daysUntilRenewal <= 30 && r.planSlug !== 'free').sort((a, b) => (a.daysUntilRenewal ?? 0) - (b.daysUntilRenewal ?? 0)), [rows]);

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allOnPage) setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => n.delete(r.id)); return n; });
    else setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => n.add(r.id)); return n; });
  }

  async function applyBulkPlan() {
    if (!bulkPlanId || selected.size === 0) return;
    setBulkChanging(true); setBulkMsg(null);
    const ids = [...selected];
    const subIds = rows.filter((r) => ids.includes(r.id)).map((r) => r.id);
    const { error } = await supabase.from('subscriptions').update({ plan_id: bulkPlanId }).in('id', subIds);
    setBulkChanging(false);
    setBulkMsg(error ? `Error: ${error.message}` : `Updated ${subIds.length} subscription(s).`);
    if (!error) { setSelected(new Set()); load(); }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg className={`w-3 h-3 ml-1 flex-shrink-0 ${sortBy === col ? 'opacity-100' : 'opacity-25'}`} viewBox="0 0 12 12" fill="currentColor">
      {sortDir === 'asc' && sortBy === col ? <path d="M6 2l4 5H2z"/> : <path d="M6 10L2 5h8z"/>}
    </svg>
  );

  const hasActiveFilters = search || planFilter || statusFilter || intervalFilter;

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Subscriptions</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{rows.length} total subscriptions.</p>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button onClick={() => setShowSaved((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
              Saved Filters
            </button>
            {showSaved && (
              <SavedFiltersPopover
                current={{ plan: planFilter, status: statusFilter, interval: intervalFilter, search }}
                onLoad={(f) => { setPlanFilter(f.plan); setStatusFilter(f.status); setIntervalFilter(f.interval); setSearch(f.search); setPage(1); }}
                onClose={() => setShowSaved(false)}
              />
            )}
          </div>
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, sub: 'all subscriptions' },
          { label: 'Paid', value: stats.paid, sub: 'active paid plans' },
          { label: 'Free', value: stats.free, sub: 'on free plan' },
          { label: 'MRR', value: fmt(stats.mrr), sub: `${fmt(stats.arr)} ARR` },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
            <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-[#111827] mt-1">{s.value}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Overage Alerts */}
      {!loading && overageRows.length > 0 && (
        <div className="bg-white border border-[#FDE68A] rounded-xl mb-4 overflow-hidden">
          <button onClick={() => setShowOverage((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-[#FEF3C7] hover:bg-[#FDE68A]/40 transition-colors">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#92400E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <span className="text-sm font-semibold text-[#92400E]">Overage Alerts — {overageRows.length} client{overageRows.length !== 1 ? 's' : ''} at 90%+ usage</span>
            </div>
            <svg className={`w-4 h-4 text-[#92400E] transition-transform ${showOverage ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showOverage && (
            <div className="divide-y divide-[#FEF3C7]">
              {overageRows.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    {r.orgRefId ? (
                      <Link to={`/clients/${r.orgRefId}`} className="text-sm font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline">{r.orgName}</Link>
                    ) : (
                      <span className="text-sm font-medium text-[#111827]">{r.orgName ?? '—'}</span>
                    )}
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{r.ownerEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <div className="flex justify-between text-[10px] text-[#9CA3AF] mb-1">
                        <span>{r.usageCount}</span><span>{r.usageLimit}</span>
                      </div>
                      <div className="w-full bg-[#E5EAE8] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${r.usagePct}%` }}/>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-red-600">{r.usagePct}%</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[r.planSlug] ?? ''}`}>{r.planName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Renewal Calendar */}
      {!loading && renewalRows.length > 0 && (
        <div className="bg-white border border-[#E5EAE8] rounded-xl mb-4 overflow-hidden">
          <button onClick={() => setShowRenewal((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-[#F8FAF9] hover:bg-[#F3F4F6] transition-colors">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span className="text-sm font-semibold text-[#111827]">Renewal Calendar — {renewalRows.length} renewal{renewalRows.length !== 1 ? 's' : ''} in next 30 days</span>
            </div>
            <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${showRenewal ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showRenewal && (
            <div className="divide-y divide-[#F3F4F6]">
              {renewalRows.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${(r.daysUntilRenewal ?? 99) <= 7 ? 'bg-red-50 text-red-600' : 'bg-[#E6F2EE] text-[#0D4C3C]'}`}>
                    <span className="text-[10px] font-semibold leading-none">{r.daysUntilRenewal}d</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {r.orgRefId ? (
                      <Link to={`/clients/${r.orgRefId}`} className="text-sm font-medium text-[#111827] hover:underline">{r.orgName}</Link>
                    ) : (
                      <span className="text-sm font-medium text-[#111827]">{r.orgName ?? '—'}</span>
                    )}
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{r.ownerEmail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-[#111827]">{fmt(r.amountCents)}</p>
                    <p className="text-xs text-[#9CA3AF]">{formatDate(r.periodEnd)}</p>
                  </div>
                  {r.cancelAtPeriodEnd && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">Canceling</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-plan Chart */}
      {!loading && (
        <div className="mb-5">
          <button onClick={() => setShowChart((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2 hover:text-[#374151] transition-colors">
            Plan Breakdown
            <svg className={`w-3 h-3 transition-transform ${showChart ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showChart && <PlanBreakdownChart rows={rows}/>}
        </div>
      )}

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
        {hasActiveFilters && (
          <button onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setIntervalFilter(''); setPage(1); }}
            className="text-xs text-[#6B7280] hover:text-[#111827] flex items-center gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-[#E6F2EE] border border-[#A7D7C5] rounded-xl">
          <span className="text-xs font-semibold text-[#0D4C3C]">{selected.size} selected</span>
          <div className="flex-1"/>
          <Dropdown placeholder="Change plan…" value={bulkPlanId} onChange={setBulkPlanId}
            options={plans.map((p) => ({ value: p.id, label: p.name }))}/>
          <button onClick={() => setShowBulkModal(true)} disabled={!bulkPlanId}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-40 rounded-lg transition-colors">
            Apply to {selected.size}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-[#374151] hover:text-red-600 transition-colors">Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" checked={allOnPage} onChange={toggleAll}
                  className="rounded border-[#D1D5DB] text-[#0D4C3C] focus:ring-[#0D4C3C]"/>
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client</th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => toggleSort('plan')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Plan <SortIcon col="plan"/></button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => toggleSort('status')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Status <SortIcon col="status"/></button>
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Interval</th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => toggleSort('amount')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Amount <SortIcon col="amount"/></button>
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Usage</th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => toggleSort('period_end')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#374151]">Renews <SortIcon col="period_end"/></button>
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 10 }).map((_, j) => (<td key={j} className="px-4 py-1.5"><div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-16"/></td>))}</tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={10} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                {hasActiveFilters ? 'No subscriptions match your filters.' : 'No subscriptions yet.'}
              </td></tr>
            ) : (
              pageRows.map((s) => (
                <tr key={s.id} className={`hover:bg-[#F8FAF9] transition-colors ${selected.has(s.id) ? 'bg-[#F0F9F6]' : ''}`}>
                  <td className="px-4 py-1.5">
                    <input type="checkbox" checked={selected.has(s.id)}
                      onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                      className="rounded border-[#D1D5DB] text-[#0D4C3C] focus:ring-[#0D4C3C]"/>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="font-mono text-xs text-[#9CA3AF]">{formatId(s.orgRefId)}</span>
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        {s.orgRefId ? (
                          <Link to={`/clients/${s.orgRefId}`} className="font-medium text-[#111827] hover:text-[#0D4C3C] hover:underline text-sm">{s.orgName ?? '—'}</Link>
                        ) : (
                          <span className="font-medium text-[#111827] text-sm">{s.orgName ?? <span className="text-[#9CA3AF]">No org</span>}</span>
                        )}
                        {s.ownerEmail && <p className="text-xs text-[#9CA3AF] mt-0.5 truncate max-w-[160px]">{s.ownerEmail}</p>}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {s.isAtRisk && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">At Risk</span>}
                          {s.cancelAtPeriodEnd && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Canceling</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[s.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{s.planName}</span>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${STATUS_COLOR[s.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{s.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-1.5 text-xs text-[#374151] capitalize">{s.interval ?? '—'}</td>
                  <td className="px-4 py-1.5">
                    <span className="text-sm font-medium text-[#111827]">{fmt(s.amountCents)}</span>
                    {s.interval === 'annual' && s.amountCents > 0 && (
                      <p className="text-[10px] text-[#9CA3AF]">{fmt(Math.round(s.amountCents / 12))}/mo</p>
                    )}
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 bg-[#E5EAE8] rounded-full h-1">
                        <div className={`h-1 rounded-full ${s.usagePct >= 90 ? 'bg-red-500' : s.usagePct >= 70 ? 'bg-amber-500' : 'bg-[#0D4C3C]'}`} style={{ width: `${s.usagePct}%` }}/>
                      </div>
                      <span className="text-[10px] text-[#9CA3AF]">{s.usagePct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-1.5 text-xs text-[#9CA3AF]">
                    {s.daysUntilRenewal !== null
                      ? <span className={s.daysUntilRenewal <= 7 ? 'font-semibold text-red-600' : ''}>{s.daysUntilRenewal}d</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {s.orgRefId && <Link to={`/clients/${s.orgRefId}`} className="text-xs font-medium text-[#0D4C3C] hover:underline">View</Link>}
                      <button onClick={() => setOverrideTarget(s)}
                        className="text-xs font-medium text-[#374151] hover:text-[#0D4C3C] transition-colors">Override</button>
                      {s.orgId && (
                        <button onClick={() => setTimelineOrg({ id: s.orgId!, name: s.orgName ?? '—' })}
                          className="text-xs font-medium text-[#6B7280] hover:text-[#374151] transition-colors">Timeline</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#F8FAF9] flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
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
          </div>
        )}

        {!loading && totalPages <= 1 && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F3F4F6] bg-[#F8FAF9]">
            <p className="text-xs text-[#9CA3AF]">Showing {filtered.length} of {rows.length}</p>
          </div>
        )}
      </div>

      {/* Plan override modal */}
      {overrideTarget && (
        <PlanOverrideModal
          sub={overrideTarget}
          plans={plans}
          priceMap={priceMap}
          onClose={() => setOverrideTarget(null)}
          onSuccess={() => { setOverrideTarget(null); load(); }}
        />
      )}

      {/* Bulk confirm modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl p-6">
            <h2 className="text-sm font-bold text-[#111827] mb-2">Confirm Bulk Plan Change</h2>
            <p className="text-sm text-[#6B7280] mb-5">Change <span className="font-semibold text-[#111827]">{selected.size}</span> subscription{selected.size !== 1 ? 's' : ''} to <span className="font-semibold text-[#111827]">{plans.find((p) => p.id === bulkPlanId)?.name}</span>?</p>
            {bulkMsg && <p className={`text-xs mb-4 ${bulkMsg.startsWith('Error') ? 'text-red-600' : 'text-[#0D4C3C]'}`}>{bulkMsg}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowBulkModal(false); setBulkMsg(null); }}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded hover:bg-[#F3F4F6] transition-colors">Cancel</button>
              <button onClick={applyBulkPlan} disabled={bulkChanging}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 rounded transition-colors">
                {bulkChanging ? 'Applying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline modal */}
      {timelineOrg && <TimelineModal orgId={timelineOrg.id} orgName={timelineOrg.name} onClose={() => setTimelineOrg(null)}/>}
    </div>
  );
}
