import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  pro: 'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

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

      const [subsRes, membersRes, countryRes] = await Promise.all([
        supabase.from('subscriptions').select('plan, status').eq('org_id', orgRow.id).maybeSingle(),
        supabase.from('org_members').select('user_id, role').eq('org_id', orgRow.id),
        Promise.resolve(null),
      ]);

      const ownerRow = (membersRes.data ?? []).find((m: { role: string }) => m.role === 'owner');
      let ownerEmail: string | null = null;
      let ownerName: string | null = null;

      if (ownerRow) {
        const { data: p } = await supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', ownerRow.user_id)
          .maybeSingle();
        ownerEmail = p?.email ?? null;
        ownerName = p?.display_name ?? null;
      }

      setOrg({
        id: orgRow.id,
        displayId: orgRow.display_id,
        name: orgRow.name,
        slug: orgRow.slug,
        status: orgRow.status,
        createdAt: orgRow.created_at,
        plan: subsRes.data?.plan ?? null,
        subStatus: subsRes.data?.status ?? null,
        memberCount: (membersRes.data ?? []).length,
        ownerEmail,
        ownerName,
        timezone: orgRow.timezone ?? null,
        country: null,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <div className="h-4 bg-[#E5EAE8] rounded animate-pulse w-40 mb-8" />
        <div className="bg-white border border-[#E5EAE8] rounded-xl p-6 animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-[#E5EAE8] rounded w-56" />)}
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
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold capitalize ${orgStatusColor}`}>{org.status}</span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">#{org.displayId}</p>
        </div>
      </div>

      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Organization details</h2>
        </div>
        <dl className="divide-y divide-[#F3F4F6]">
          {[
            { label: 'Slug', value: org.slug },
            {
              label: 'Plan',
              value: (
                org.plan
                  ? <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_COLOR[org.plan] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>{org.plan}</span>
                  : '—'
              ),
            },
            { label: 'Members', value: String(org.memberCount) },
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
    </div>
  );
}
