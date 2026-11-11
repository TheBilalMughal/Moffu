import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

interface TeamMember {
  userId: string;
  role: string;
  email: string;
  name: string | null;
}

interface OrgDetail {
  id: string;
  displayId: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  plan: string | null;
  subStatus: string | null;
  memberCount: number;
  ownerEmail: string | null;
  ownerName: string | null;
  timezone: string | null;
  country: string | null;
  teamMembers: TeamMember[];
}

export function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const displayId = Number(id);
      if (isNaN(displayId)) { setNotFound(true); setLoading(false); return; }

      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, display_id, name, slug, status, created_at, timezone')
        .eq('display_id', displayId)
        .maybeSingle();

      if (!orgRow) { setNotFound(true); setLoading(false); return; }

      const [subsRes, membersRes] = await Promise.all([
        supabase.from('subscriptions').select('plan, status').eq('org_id', orgRow.id).maybeSingle(),
        supabase.from('org_external_members').select('user_id, role').eq('org_id', orgRow.id),
      ]);

      const allMembers = (membersRes.data ?? []) as { user_id: string; role: string }[];
      const memberUserIds = allMembers.map(m => m.user_id);

      type Profile = { id: string; email: string; display_name: string | null };
      const { data: profileRows } = memberUserIds.length > 0
        ? await supabase.from('profiles').select('id, email, display_name').in('id', memberUserIds)
        : { data: [] };

      const profileById = new Map<string, Profile>((profileRows ?? []).map((p: Profile) => [p.id, p]));
      const ownerRow = allMembers.find(m => m.role === 'owner');
      const ownerProfile = ownerRow ? profileById.get(ownerRow.user_id) : null;

      const teamMembers = allMembers.map(m => ({
        userId: m.user_id,
        role: m.role,
        email: profileById.get(m.user_id)?.email ?? '—',
        name: profileById.get(m.user_id)?.display_name ?? null,
      }));

      setOrg({
        id: orgRow.id,
        displayId: orgRow.display_id,
        name: orgRow.name,
        slug: orgRow.slug,
        status: orgRow.status,
        createdAt: orgRow.created_at,
        plan: subsRes.data?.plan ?? null,
        subStatus: subsRes.data?.status ?? null,
        memberCount: allMembers.length,
        ownerEmail: ownerProfile?.email ?? null,
        ownerName: ownerProfile?.display_name ?? null,
        timezone: orgRow.timezone ?? null,
        country: null,
        teamMembers,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <div className="h-4 bg-[#E5E7EB] rounded animate-pulse w-40 mb-8" />
        <div className="bg-white shadow-sm rounded-xl p-6 animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-[#E5E7EB] rounded w-56" />)}
        </div>
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="px-8 py-8">
        <Link to="/organizations" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to organizations
        </Link>
        <p className="text-sm text-[#9CA3AF]">Organization not found.</p>
      </div>
    );
  }

  const orgStatusColor = org.status === 'active' ? 'bg-[#ECFDF5] text-[#065F46]' : org.status === 'suspended' ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#FFF7ED] text-[#9A3412]';

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link to="/organizations" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Organizations
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#111827]">{org.name}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold capitalize rounded ${orgStatusColor}`}>{org.status}</span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">#{org.displayId}</p>
        </div>
      </div>

      {/* Org details */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]">
          <h2 className="text-sm font-semibold text-[#111827]">Organization details</h2>
        </div>
        <dl className="divide-y divide-[#F3F4F6]">
          {[
            { label: 'Slug', value: org.slug },
            {
              label: 'Plan',
              value: (
                org.plan
                  ? <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold capitalize rounded ${PLAN_COLOR[org.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{org.plan}</span>
                  : '—'
              ),
            },
            { label: 'Owner', value: org.ownerEmail ? `${org.ownerName ?? ''} (${org.ownerEmail})`.trim() : '—' },
            { label: 'Timezone', value: org.timezone ?? '—' },
            { label: 'Created', value: new Date(org.createdAt).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 py-3.5 flex items-center gap-4">
              <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">{label}</dt>
              <dd className="text-sm text-[#111827]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Team Members */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111827]">Team members</h2>
          <span className="text-xs text-[#9CA3AF]">{org.teamMembers.length} {org.teamMembers.length === 1 ? 'member' : 'members'}</span>
        </div>
        {org.teamMembers.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#9CA3AF]">No team members.</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {org.teamMembers.map(m => (
              <li key={m.userId} className="px-6 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6C55E8]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#6C55E8]">
                    {(m.name ?? m.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {m.name && <p className="text-sm font-medium text-[#111827] truncate">{m.name}</p>}
                  <p className="text-xs text-[#6B7280] truncate">{m.email}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${m.role === 'owner' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F3F4F6] text-[#374151]'}`}>
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

