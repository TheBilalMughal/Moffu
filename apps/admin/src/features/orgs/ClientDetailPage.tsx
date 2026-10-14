import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
  drafts: number;
  published: number;
}

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

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [usage, setUsage] = useState<UsageDetail | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthBucket[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [connections, setConnections] = useState<GoogleConn[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Actions
  const [toggling, setToggling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planMsg, setPlanMsg] = useState<string | null>(null);

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
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const [plansRes, subsRes, profilesRes, emailsRes, usageAiRes, usagePubRes, usageHistRes, connRes] = await Promise.all([
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
      supabase.from('usage_events').select('event_type, created_at').in('user_id', memberUserIds).in('event_type', ['ai_draft', 'published_reply']).gte('created_at', sixMonthsAgo),
      supabase.from('google_connections').select('id, google_email, state, connected_at').in('user_id', memberUserIds),
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

    // Build 6-month buckets
    const buckets: MonthBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: monthLabel(d), drafts: 0, published: 0 });
    }
    type HistRow = { event_type: string; created_at: string };
    (usageHistRes.data ?? []).forEach((r: HistRow) => {
      const d = new Date(r.created_at);
      const label = monthLabel(d);
      const b = buckets.find((x) => x.label === label);
      if (!b) return;
      if (r.event_type === 'ai_draft') b.drafts++;
      else b.published++;
    });
    setMonthlyUsage(buckets);

    type ConnRow = { id: string; google_email: string | null; state: string; connected_at: string };
    setConnections((connRes.data ?? []) as ConnRow[]);

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

    setLoading(false);
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
  const maxBucket = Math.max(...monthlyUsage.map((b) => b.drafts + b.published), 1);

  return (
    <div className="px-8 py-8">
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
          <p className="text-sm text-[#9CA3AF] font-mono">{org.ref_id} · Since {formatDate(org.created_at)}</p>
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

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-[#E5EAE8] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">AI Drafts (this month)</p>
          <p className="text-3xl font-bold text-[#111827]">{usage?.aiDrafts ?? 0}</p>
          {usage && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1">
                <span>{usagePct}% of limit</span>
                <span>{usage.limit}</span>
              </div>
              <div className="w-full bg-[#E5EAE8] rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-[#0D4C3C]'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5EAE8] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Published Replies (this month)</p>
          <p className="text-3xl font-bold text-[#111827]">{usage?.published ?? 0}</p>
        </div>

        <div className="bg-white border border-[#E5EAE8] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Team Members</p>
          <p className="text-3xl font-bold text-[#111827]">{members.length}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">{connections.length} Google connection{connections.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Monthly Usage Chart */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#111827]">Usage Trend (6 months)</h2>
          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#0D4C3C] inline-block" />AI Drafts</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#A7D7C5] inline-block" />Published</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-32">
          {monthlyUsage.map((b) => {
            const totalH = Math.round(((b.drafts + b.published) / maxBucket) * 100);
            const draftH = totalH > 0 ? Math.round((b.drafts / (b.drafts + b.published)) * totalH) : 0;
            const pubH = totalH - draftH;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '96px' }}>
                  <div className="w-full flex flex-col gap-px">
                    <div className="w-full bg-[#0D4C3C] rounded-t-sm" style={{ height: `${draftH}%`, minHeight: b.drafts > 0 ? '2px' : '0' }} />
                    <div className="w-full bg-[#A7D7C5] rounded-b-sm" style={{ height: `${pubH}%`, minHeight: b.published > 0 ? '2px' : '0' }} />
                  </div>
                  {totalH === 0 && <div className="w-full bg-[#F3F4F6] rounded-sm h-1" />}
                </div>
                <span className="text-[10px] text-[#9CA3AF]">{b.label}</span>
                <span className="text-[10px] font-medium text-[#374151]">{b.drafts + b.published}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Org Info */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
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
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Subscription</h2>
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Plan</dt>
              <dd className="flex items-center gap-2 flex-1">
                {sub ? (
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                    {sub.planName}
                  </span>
                ) : <span className="text-[#9CA3AF]">—</span>}
              </dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Status</dt>
              <dd className="text-sm text-[#374151] capitalize">{sub?.status ?? '—'}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Renews</dt>
              <dd className="text-sm text-[#374151]">
                {sub?.period_end ? formatDate(sub.period_end) : '—'}
                {sub?.cancel_at_period_end && <span className="ml-2 text-xs text-red-600 font-medium">Cancels</span>}
              </dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Limit</dt>
              <dd className="text-sm text-[#374151]">{usage?.limit ?? '—'} drafts / month</dd>
            </div>
          </dl>
          {/* Plan Override */}
          {plans.length > 0 && sub && (
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
                  disabled={changingPlan || selectedPlanId === sub.plan_id}
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
        </div>
      </div>

      {/* Google Connections */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mb-4">
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
                const stateColor = g.state === 'active'
                  ? 'bg-[#ECFDF5] text-[#065F46]'
                  : g.state === 'disconnected'
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

      {/* Members */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Team Members</h2>
        </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
