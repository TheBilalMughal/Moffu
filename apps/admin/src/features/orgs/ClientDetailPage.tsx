import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface OrgDetail {
  id: string;
  ref_id: string;
  name: string;
  created_at: string;
  status: string | null;
}

interface SubDetail {
  plan: string;
  planName: string;
  status: string;
}

interface UsageDetail {
  aiDrafts: number;
  published: number;
  limit: number;
}

interface MemberRow {
  user_id: string;
  role: string;
  display_name: string | null;
  created_at: string;
}

interface GoogleConn {
  id: string;
  google_email: string | null;
  state: string;
  connected_at: string;
}

const PLAN_LIMIT: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 500,
  enterprise: 2000,
};

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [usage, setUsage] = useState<UsageDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [connections, setConnections] = useState<GoogleConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    if (!id) { setNotFound(true); setLoading(false); return; }

    // 1. Get org
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id, ref_id, name, created_at, status')
      .eq('ref_id', id)
      .maybeSingle();

    if (!orgRow) { setNotFound(true); setLoading(false); return; }
    setOrg(orgRow as OrgDetail);

    // 2. Get members of this org
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

    // 3. Fetch everything in parallel
    const [plansRes, subsRes, profilesRes, usageAiRes, usagePubRes, connRes] = await Promise.all([
      supabase.from('plans').select('id, slug, name'),
      ownerUserId
        ? supabase.from('subscriptions').select('user_id, plan_id, status').eq('user_id', ownerUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('profiles').select('id, display_name').in('id', memberUserIds),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true }).in('user_id', memberUserIds).eq('event_type', 'ai_draft').gte('created_at', monthStart),
      supabase.from('usage_events').select('user_id', { count: 'exact', head: true }).in('user_id', memberUserIds).eq('event_type', 'published_reply').gte('created_at', monthStart),
      supabase.from('google_connections').select('id, google_email, state, connected_at').in('user_id', memberUserIds),
    ]);

    // plan_id → { slug, name }
    type PlanRow = { id: string; slug: string; name: string };
    const planById = new Map<string, PlanRow>(
      (plansRes.data ?? []).map((p: PlanRow) => [p.id, p]),
    );

    // Subscription
    const subData = subsRes.data as { user_id: string; plan_id: string; status: string } | null;
    const planSlug = subData ? (planById.get(subData.plan_id)?.slug ?? 'free') : 'free';
    const planName = subData ? (planById.get(subData.plan_id)?.name ?? 'Free') : 'Free';
    setSub({ plan: planSlug, planName, status: subData?.status ?? 'active' });

    // Usage
    setUsage({
      aiDrafts: usageAiRes.count ?? 0,
      published: usagePubRes.count ?? 0,
      limit: PLAN_LIMIT[planSlug] ?? 200,
    });

    // Google connections
    type ConnRow = { id: string; google_email: string | null; state: string; connected_at: string };
    setConnections((connRes.data ?? []) as ConnRow[]);

    // Members enriched with profile names
    type ProfileRow = { id: string; display_name: string | null };
    const profileById = new Map<string, ProfileRow>(
      (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p]),
    );

    type OrgMemberRow = { user_id: string; role: string; created_at: string };
    const enrichedMembers: MemberRow[] = (orgMemberRows as OrgMemberRow[]).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: profileById.get(m.user_id)?.display_name ?? null,
      created_at: m.created_at,
    }));
    setMembers(enrichedMembers);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="h-4 bg-[#E5EAE8] rounded animate-pulse w-48 mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-[#E5EAE8] rounded-xl animate-pulse" />
          ))}
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
  const usagePct = usage ? Math.round((usage.aiDrafts / usage.limit) * 100) : 0;

  return (
    <div className="px-8 py-8">
      {/* Back */}
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
          <p className="text-sm text-[#9CA3AF] font-mono">{org.ref_id}</p>
        </div>
        {sub?.plan && (
          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded ${PLAN_COLOR[sub.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
            {sub.planName}
          </span>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
                  className={`h-1.5 rounded-full ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-[#0D4C3C]'}`}
                  style={{ width: `${Math.min(usagePct, 100)}%` }}
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
              <dd className="font-mono text-xs text-[#374151]">{org.ref_id}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Name</dt>
              <dd className="text-sm text-[#111827]">{org.name}</dd>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Created</dt>
              <dd className="text-sm text-[#374151]">{new Date(org.created_at).toLocaleDateString()}</dd>
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

        {/* Subscription */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Subscription</h2>
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <div className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Plan</dt>
              <dd>
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
              <dt className="w-28 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Draft limit</dt>
              <dd className="text-sm text-[#374151]">{usage?.limit ?? '—'} / month</dd>
            </div>
          </dl>
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
                    <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{new Date(g.connected_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Members Table */}
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
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {members.map((m) => (
                <tr key={m.user_id} className="hover:bg-[#F8FAF9]">
                  <td className="px-5 py-3.5 font-medium text-[#111827]">{m.display_name ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-[#F3F4F6] text-[#374151] capitalize">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#9CA3AF] text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
