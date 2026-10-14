import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_LIMIT: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 500,
  enterprise: 2000,
};

const ROLE_COLOR: Record<string, string> = {
  owner:   'bg-[#FEF3C7] text-[#92400E]',
  admin:   'bg-[#EDE9FE] text-[#5B21B6]',
  manager: 'bg-[#EFF6FF] text-[#1E40AF]',
  member:  'bg-[#F3F4F6] text-[#374151]',
};

interface OrgMember {
  user_id: string;
  display_id: number | null;
  display_name: string;
  email: string;
  role: string;
}

interface GoogleConn {
  id: string;
  status: string;
  created_at: string;
  location_count: number;
}

interface ClientDetail {
  id: string;
  displayId: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  plan: string | null;
  subStatus: string | null;
  subCreatedAt: string | null;
  memberCount: number;
  ownerEmail: string | null;
  ownerName: string | null;
  timezone: string | null;
  aiDrafts: number;
  publishedReplies: number;
  totalReviews: number;
  members: OrgMember[];
  googleConns: GoogleConn[];
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-3.5 flex items-center gap-4">
      <dt className="w-36 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">{label}</dt>
      <dd className="text-sm text-[#111827]">{children}</dd>
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function load() {
    setLoading(true);
    const displayId = Number(id);
    if (isNaN(displayId)) { setNotFound(true); setLoading(false); return; }

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('id, display_id, name, slug, status, created_at, timezone')
      .eq('display_id', displayId)
      .maybeSingle();

    if (!orgRow) { setNotFound(true); setLoading(false); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [subsRes, membersRes, reviewsRes, googleRes] = await Promise.all([
      supabase.from('subscriptions').select('plan, status, created_at').eq('org_id', orgRow.id).maybeSingle(),
      supabase.from('org_members').select('user_id, role').eq('org_id', orgRow.id),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('org_id', orgRow.id),
      supabase.from('google_connections').select('id, status, created_at').eq('org_id', orgRow.id),
    ]);

    const memberUserIds = (membersRes.data ?? []).map((m: { user_id: string }) => m.user_id);

    // profiles + usage in parallel
    const [profilesRes, usageRes, locationsRes] = await Promise.all([
      memberUserIds.length > 0
        ? supabase.from('profiles').select('id, display_id, display_name, email').in('id', memberUserIds)
        : Promise.resolve({ data: [] }),
      memberUserIds.length > 0
        ? supabase.from('usage_events').select('user_id, event_type').in('user_id', memberUserIds).gte('created_at', monthStart)
        : Promise.resolve({ data: [] }),
      googleRes.data && googleRes.data.length > 0
        ? supabase.from('google_locations').select('connection_id').in('connection_id', googleRes.data.map((g: { id: string }) => g.id))
        : Promise.resolve({ data: [] }),
    ]);

    type ProfileRow = { id: string; display_id: number | null; display_name: string; email: string | null };
    const profileById = new Map<string, ProfileRow>(
      (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p]),
    );

    // usage counts
    let aiDrafts = 0;
    let publishedReplies = 0;
    (usageRes.data ?? []).forEach((u: { user_id: string; event_type: string }) => {
      if (u.event_type === 'ai_draft') aiDrafts++;
      else if (u.event_type === 'published_reply') publishedReplies++;
    });

    // members list with profile info
    const members: OrgMember[] = (membersRes.data ?? []).map((m: { user_id: string; role: string }) => {
      const p = profileById.get(m.user_id);
      return {
        user_id: m.user_id,
        display_id: p?.display_id ?? null,
        display_name: p?.display_name ?? '—',
        email: p?.email ?? '—',
        role: m.role,
      };
    });

    // google connections with location counts
    const locCountByConn = new Map<string, number>();
    (locationsRes.data ?? []).forEach((l: { connection_id: string }) => {
      locCountByConn.set(l.connection_id, (locCountByConn.get(l.connection_id) ?? 0) + 1);
    });
    const googleConns: GoogleConn[] = (googleRes.data ?? []).map((g: { id: string; status: string; created_at: string }) => ({
      id: g.id,
      status: g.status,
      created_at: g.created_at,
      location_count: locCountByConn.get(g.id) ?? 0,
    }));

    const ownerRow = (membersRes.data ?? []).find((m: { role: string }) => m.role === 'owner');
    const ownerProfile = ownerRow ? profileById.get(ownerRow.user_id) : null;

    setClient({
      id: orgRow.id,
      displayId: orgRow.display_id,
      name: orgRow.name,
      slug: orgRow.slug,
      status: orgRow.status ?? 'active',
      createdAt: orgRow.created_at,
      plan: subsRes.data?.plan ?? null,
      subStatus: subsRes.data?.status ?? null,
      subCreatedAt: subsRes.data?.created_at ?? null,
      memberCount: (membersRes.data ?? []).length,
      ownerEmail: ownerProfile?.email ?? null,
      ownerName: ownerProfile?.display_name ?? null,
      timezone: orgRow.timezone ?? null,
      aiDrafts,
      publishedReplies,
      totalReviews: reviewsRes.count ?? 0,
      members,
      googleConns,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleToggleStatus() {
    if (!client) return;
    setToggling(true);
    const newStatus = client.status === 'active' ? 'suspended' : 'active';
    await supabase.from('organizations').update({ status: newStatus }).eq('id', client.id);
    setToggling(false);
    setClient((prev) => prev ? { ...prev, status: newStatus } : prev);
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="h-4 bg-[#E5EAE8] rounded animate-pulse w-40 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E5EAE8] rounded-xl p-6 animate-pulse space-y-3">
              {Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-4 bg-[#E5EAE8] rounded w-56" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !client) {
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

  const isSuspended = client.status === 'suspended';
  const statusColor = isSuspended
    ? 'bg-[#FEF2F2] text-[#991B1B]'
    : client.status === 'active'
    ? 'bg-[#ECFDF5] text-[#065F46]'
    : 'bg-[#FFF7ED] text-[#9A3412]';
  const planLimit = client.plan ? (PLAN_LIMIT[client.plan] ?? 200) : 200;
  const usagePct = Math.min(100, Math.round((client.aiDrafts / planLimit) * 100));

  const connStatusColor: Record<string, string> = {
    CONNECTED: 'bg-[#ECFDF5] text-[#065F46]',
    PENDING: 'bg-[#FFF7ED] text-[#9A3412]',
    REFRESH_FAILED: 'bg-[#FEF2F2] text-[#991B1B]',
    DISCONNECTED: 'bg-[#F3F4F6] text-[#374151]',
    REVOKED: 'bg-[#FEF2F2] text-[#991B1B]',
    ERROR: 'bg-[#FEF2F2] text-[#991B1B]',
  };

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
            <h1 className="text-2xl font-bold text-[#111827]">{client.name}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold capitalize rounded ${statusColor}`}>{client.status}</span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">#{client.displayId} · {client.slug}</p>
        </div>
        <button
          onClick={handleToggleStatus}
          disabled={toggling}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
            isSuspended
              ? 'bg-[#0D4C3C] hover:bg-[#083F32] text-white'
              : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {toggling ? '…' : isSuspended ? 'Reactivate client' : 'Deactivate client'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Stat: AI Drafts */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">AI Drafts this month</p>
          <p className="text-3xl font-bold text-[#111827] mb-2">{client.aiDrafts}<span className="text-base font-normal text-[#9CA3AF]"> / {planLimit}</span></p>
          <div className="w-full bg-[#E5EAE8] rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-400' : 'bg-[#0D4C3C]'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {/* Stat: Published Replies */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Replies published</p>
          <p className="text-3xl font-bold text-[#111827]">{client.publishedReplies}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">this month</p>
        </div>

        {/* Stat: Total Reviews */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Total reviews</p>
          <p className="text-3xl font-bold text-[#111827]">{client.totalReviews}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">synced from Google</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Organisation details */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Organisation</h2>
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <DetailRow label="Owner">
              {client.ownerEmail
                ? <span>{client.ownerName && <span className="font-medium">{client.ownerName} — </span>}{client.ownerEmail}</span>
                : '—'}
            </DetailRow>
            <DetailRow label="Timezone">{client.timezone ?? '—'}</DetailRow>
            <DetailRow label="Members">{client.memberCount}</DetailRow>
            <DetailRow label="Created">{new Date(client.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</DetailRow>
          </dl>
        </div>

        {/* Subscription details */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Subscription</h2>
          </div>
          <dl className="divide-y divide-[#F3F4F6]">
            <DetailRow label="Plan">
              {client.plan
                ? <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold capitalize rounded ${PLAN_COLOR[client.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{client.plan}</span>
                : <span className="text-[#9CA3AF]">—</span>}
            </DetailRow>
            <DetailRow label="Status">
              {client.subStatus
                ? <span className={`inline-block px-2 py-0.5 text-xs font-semibold capitalize rounded ${client.subStatus === 'active' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]'}`}>{client.subStatus}</span>
                : <span className="text-[#9CA3AF]">—</span>}
            </DetailRow>
            <DetailRow label="Since">
              {client.subCreatedAt ? new Date(client.subCreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
            </DetailRow>
            <DetailRow label="AI draft limit">{planLimit} / month</DetailRow>
          </dl>
        </div>
      </div>

      {/* Google Connections */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Google Connections</h2>
        </div>
        {client.googleConns.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#9CA3AF]">No Google Business connections.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Locations</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Connected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {client.googleConns.map((g) => (
                <tr key={g.id}>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${connStatusColor[g.status] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#374151]">{g.location_count}</td>
                  <td className="px-5 py-3 text-[#9CA3AF]">
                    {new Date(g.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Members */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Members <span className="ml-1.5 text-[#9CA3AF] font-normal">({client.memberCount})</span></h2>
        </div>
        {client.members.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#9CA3AF]">No members found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {client.members.map((m) => (
                <tr key={m.user_id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {m.display_name !== '—' ? m.display_name[0].toUpperCase() : '?'}
                      </div>
                      <span className="font-medium text-[#111827]">{m.display_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#374151]">{m.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold capitalize rounded ${ROLE_COLOR[m.role] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
