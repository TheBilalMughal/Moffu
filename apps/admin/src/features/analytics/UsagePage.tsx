import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, refToSlug } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrgRow   { id: string; name: string; ref_id: string; status: string | null }
interface OrgMemberRow { org_id: string; user_id: string; role: string }
interface SubRow   { user_id: string; plan_id: string; plan_slug: string; plan_name: string; status: string; current_period_start: string; current_period_end: string }
interface UsageRow { user_id: string; event_type: string }

interface OrgUsage {
  orgId: string;
  orgName: string;
  orgRef: string;
  orgStatus: string | null;
  planName: string;
  planSlug: string;
  subStatus: string;
  memberCount: number;
  aiDrafts: number;
  published: number;
  total: number;
  periodStart: string;
  periodEnd: string;
}

const PLAN_COLOR: Record<string, string> = {
  free:    'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth:  'bg-[#F0FDF4] text-[#15803D]',
  scale:   'bg-[#FFF7ED] text-[#C2410C]',
};

type SortKey = 'orgName' | 'planName' | 'memberCount' | 'aiDrafts' | 'published' | 'total';
type SortDir = 'asc' | 'desc';

function today() { return new Date().toISOString().split('T')[0] ?? ''; }
function monthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0] ?? '';
}

function exportCSV(rows: OrgUsage[], from: string, to: string) {
  const header = 'Org,Plan,Members,AI Drafts,Published Replies,Total Events,Period Start,Period End';
  const lines = rows.map(r =>
    [r.orgName, r.planName, r.memberCount, r.aiDrafts, r.published, r.total, r.periodStart, r.periodEnd]
      .map(v => `"${v}"`).join(',')
  );
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `usage_${from}_${to}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Mini bar ───────────────────────────────────────────────────────────────────

function UsageBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-[#374151] w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function UsagePage() {
  const [orgs, setOrgs]               = useState<OrgRow[]>([]);
  const [members, setMembers]         = useState<OrgMemberRow[]>([]);
  const [internalIds, setInternalIds] = useState<Set<string>>(new Set());
  const [subs, setSubs]               = useState<SubRow[]>([]);
  const [events, setEvents]           = useState<UsageRow[]>([]);
  const [loading, setLoading]         = useState(true);

  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo,   setDateTo]   = useState(today);
  const [planFilter, setPlanFilter] = useState('all');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('total');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const from = dateFrom || '2000-01-01';
    const to   = dateTo   || today();

    const [orgsRes, membersRes, internalRes, subsRes, eventsRes] = await Promise.all([
      supabase.from('organizations').select('id, name, ref_id, status').order('name'),
      supabase.from('org_members').select('org_id, user_id, role'),
      supabase.from('platform_members').select('user_id').eq('is_active', true),
      supabase.from('subscriptions')
        .select('user_id, plan_id, status, current_period_start, current_period_end, plans(slug, name)')
        .eq('status', 'active'),
      supabase.from('usage_events')
        .select('user_id, event_type')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to   + 'T23:59:59'),
    ]);

    setOrgs((orgsRes.data ?? []) as OrgRow[]);
    setMembers((membersRes.data ?? []) as OrgMemberRow[]);
    setInternalIds(new Set(((internalRes.data ?? []) as { user_id: string }[]).map(m => m.user_id)));

    const rawSubs = (subsRes.data ?? []) as any[];
    setSubs(rawSubs.map(s => ({
      user_id: s.user_id,
      plan_id: s.plan_id,
      plan_slug: s.plans?.slug ?? 'free',
      plan_name: s.plans?.name ?? 'Free',
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
    })));

    setEvents((eventsRes.data ?? []) as UsageRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  // Build per-org usage
  const orgUsage = useMemo<OrgUsage[]>(() => {
    const subByUser = new Map<string, SubRow>(subs.map(s => [s.user_id, s]));
    const externalMembers = members.filter(m => !internalIds.has(m.user_id));

    // Map user_id → org_id (primary: owner first, then any member)
    const userOrg = new Map<string, string>();
    for (const m of externalMembers) userOrg.set(m.user_id, m.org_id);

    // Count events per user
    const aiByUser    = new Map<string, number>();
    const pubByUser   = new Map<string, number>();
    for (const e of events) {
      if (e.event_type === 'ai_draft')        aiByUser.set(e.user_id, (aiByUser.get(e.user_id) ?? 0) + 1);
      if (e.event_type === 'published_reply') pubByUser.set(e.user_id, (pubByUser.get(e.user_id) ?? 0) + 1);
    }

    // Find owner per org (for plan lookup) — use all members (including internal) for ownership resolution only
    const ownerByOrg = new Map<string, string>();
    for (const m of members) {
      if (m.role === 'owner') ownerByOrg.set(m.org_id, m.user_id);
    }

    // Count members per org — exclude internal platform members
    const memberCountByOrg = new Map<string, number>();
    for (const m of externalMembers) memberCountByOrg.set(m.org_id, (memberCountByOrg.get(m.org_id) ?? 0) + 1);

    // Aggregate per org
    const orgMap = new Map<string, { ai: number; pub: number }>();
    for (const [userId, orgId] of userOrg) {
      const ai  = aiByUser.get(userId)  ?? 0;
      const pub = pubByUser.get(userId) ?? 0;
      if (ai + pub === 0) continue;
      const cur = orgMap.get(orgId) ?? { ai: 0, pub: 0 };
      orgMap.set(orgId, { ai: cur.ai + ai, pub: cur.pub + pub });
    }

    return orgs.map(org => {
      const ownerId  = ownerByOrg.get(org.id);
      const sub      = ownerId ? subByUser.get(ownerId) : undefined;
      const counts   = orgMap.get(org.id) ?? { ai: 0, pub: 0 };
      return {
        orgId:       org.id,
        orgName:     org.name,
        orgRef:      org.ref_id,
        orgStatus:   org.status,
        planName:    sub?.plan_name ?? 'Free',
        planSlug:    sub?.plan_slug ?? 'free',
        subStatus:   sub?.status    ?? 'active',
        memberCount: memberCountByOrg.get(org.id) ?? 0,
        aiDrafts:    counts.ai,
        published:   counts.pub,
        total:       counts.ai + counts.pub,
        periodStart: sub?.current_period_start ?? dateFrom,
        periodEnd:   sub?.current_period_end   ?? dateTo,
      };
    });
  }, [orgs, members, internalIds, subs, events, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let rows = orgUsage;
    if (search) rows = rows.filter(r => r.orgName.toLowerCase().includes(search.toLowerCase()));
    if (planFilter !== 'all') rows = rows.filter(r => r.planSlug === planFilter);
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orgUsage, search, planFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? null : (
    <svg className="w-3 h-3 inline ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  );

  // KPIs
  const totalAI  = filtered.reduce((s, r) => s + r.aiDrafts, 0);
  const totalPub = filtered.reduce((s, r) => s + r.published, 0);
  const activeOrgs = filtered.filter(r => r.total > 0).length;
  const maxTotal = Math.max(...filtered.map(r => r.total), 1);
  const maxAI    = Math.max(...filtered.map(r => r.aiDrafts), 1);
  const maxPub   = Math.max(...filtered.map(r => r.published), 1);

  // Per-member breakdown for expanded row
  const expandedMembers = useMemo(() => {
    if (!expanded) return [];
    const orgMembers = members.filter(m => m.org_id === expanded);
    const subByUser = new Map<string, SubRow>(subs.map(s => [s.user_id, s]));
    const aiByUser    = new Map<string, number>();
    const pubByUser   = new Map<string, number>();
    for (const e of events) {
      if (e.event_type === 'ai_draft')        aiByUser.set(e.user_id, (aiByUser.get(e.user_id) ?? 0) + 1);
      if (e.event_type === 'published_reply') pubByUser.set(e.user_id, (pubByUser.get(e.user_id) ?? 0) + 1);
    }
    return orgMembers.map(m => ({
      userId:    m.user_id,
      role:      m.role,
      aiDrafts:  aiByUser.get(m.user_id)  ?? 0,
      published: pubByUser.get(m.user_id) ?? 0,
      sub:       subByUser.get(m.user_id),
    }));
  }, [expanded, members, subs, events]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Usage per Customer</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{filtered.length} orgs · {activeOrgs} active in period</p>
          </div>
          <button onClick={() => exportCSV(filtered, dateFrom, dateTo)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#6C55E8] rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'AI Drafts',        value: totalAI,    color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF]' },
            { label: 'Published Replies', value: totalPub,   color: 'text-[#6C55E8]', bg: 'bg-[#D8CCFF]' },
            { label: 'Total Events',     value: totalAI + totalPub, color: 'text-[#111827]', bg: 'bg-[#F3F4F6]' },
            { label: 'Active Orgs',      value: activeOrgs, color: 'text-[#C2410C]',  bg: 'bg-[#FFF7ED]' },
          ].map(c => (
            <div key={c.label} className="bg-white shadow-sm rounded-xl px-4 py-3">
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm rounded-xl flex-1">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search org…"
              className="flex-1 text-sm text-[#111827] placeholder-[#9CA3AF] bg-transparent focus:outline-none" />
          </div>
          <div className="w-40">
            <Dropdown value={planFilter} onChange={setPlanFilter} options={[
              { value: 'all',     label: 'All Plans' },
              { value: 'free',    label: 'Free' },
              { value: 'starter', label: 'Starter' },
              { value: 'growth',  label: 'Growth' },
              { value: 'scale',   label: 'Scale' },
            ]} />
          </div>
          <button onClick={load}
            className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#6C55E8] hover:border-[#6C55E8] transition-colors" title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                {([
                  ['orgName',    'Organization'],
                  ['planName',   'Plan'],
                  ['memberCount','Members'],
                  ['aiDrafts',   'AI Drafts'],
                  ['published',  'Published'],
                  ['total',      'Total'],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} onClick={() => toggleSort(k)}
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] cursor-pointer hover:text-[#374151] select-none">
                    {label}<SortIcon k={k} />
                  </th>
                ))}
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Distribution</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No usage data for this period.</td></tr>
              ) : filtered.map(row => (
                <>
                  <tr key={row.orgId}
                    className={`hover:bg-[#F9FAFB] transition-colors cursor-pointer ${expanded === row.orgId ? 'bg-[#F9FAFB]' : ''}`}
                    onClick={() => setExpanded(e => e === row.orgId ? null : row.orgId)}>
                    <td className="px-5 py-3.5">
                      <Link to={`/clients/${refToSlug(row.orgRef)}`} onClick={e => e.stopPropagation()}
                        className="font-medium text-[#111827] hover:text-[#6C55E8] hover:underline">
                        {row.orgName}
                      </Link>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">{row.orgRef}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[row.planSlug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                        {row.planName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#374151]">{row.memberCount}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${row.aiDrafts > 0 ? 'text-[#1D4ED8]' : 'text-[#D1D5DB]'}`}>{row.aiDrafts}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${row.published > 0 ? 'text-[#6C55E8]' : 'text-[#D1D5DB]'}`}>{row.published}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${row.total > 0 ? 'text-[#111827]' : 'text-[#D1D5DB]'}`}>{row.total}</span>
                    </td>
                    <td className="px-5 py-3.5 w-40">
                      <div className="space-y-1">
                        <UsageBar value={row.aiDrafts} max={maxAI}  color="#3B82F6" />
                        <UsageBar value={row.published} max={maxPub} color="#6C55E8" />
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expanded === row.orgId ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </td>
                  </tr>
                  {expanded === row.orgId && (
                    <tr key={`${row.orgId}-expanded`}>
                      <td colSpan={8} className="bg-[#FAFAF7] px-5 py-4 border-b border-[#E5E7EB]">
                        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-3">Per-Member Breakdown</p>
                        {expandedMembers.length === 0 ? (
                          <p className="text-xs text-[#9CA3AF]">No members found.</p>
                        ) : (
                          <div className="space-y-2">
                            {expandedMembers.map(m => (
                              <div key={m.userId} className="flex items-center gap-4 bg-white rounded-lg px-4 py-2.5 shadow-sm">
                                <div className="w-6 h-6 rounded-full bg-[#D8CCFF] text-[#6C55E8] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                  {m.role === 'owner' ? 'O' : 'M'}
                                </div>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${m.role === 'owner' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F3F4F6] text-[#374151]'}`}>
                                  {m.role}
                                </span>
                                <span className="text-xs text-[#9CA3AF] font-mono">{m.userId.slice(0, 8)}…</span>
                                <div className="flex items-center gap-4 ml-auto">
                                  <span className="text-xs"><span className="text-[#1D4ED8] font-semibold">{m.aiDrafts}</span> <span className="text-[#9CA3AF]">AI</span></span>
                                  <span className="text-xs"><span className="text-[#6C55E8] font-semibold">{m.published}</span> <span className="text-[#9CA3AF]">replies</span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-[#9CA3AF] mt-3">Period: {formatDate(row.periodStart)} — {formatDate(row.periodEnd)}</p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

