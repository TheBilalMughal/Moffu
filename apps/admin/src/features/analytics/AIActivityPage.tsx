import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawEvent {
  id: string;
  user_id: string;
  event_type: 'ai_draft' | 'published_reply';
  created_at: string;
}

interface OrgMember { user_id: string; org_id: string }
interface OrgRow    { id: string; name: string; ref_id: string }
interface Profile   { id: string; display_name: string | null; email: string | null }

interface EnrichedEvent extends RawEvent {
  orgName: string;
  orgRef:  string;
  orgId:   string;
  userName: string;
}

interface DayStat {
  date: string; // YYYY-MM-DD
  drafts: number;
  replies: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function dayKey(iso: string) { return iso.slice(0, 10); }

function last30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

// ── Mini SVG Chart ─────────────────────────────────────────────────────────────

function TrendChart({ days }: { days: DayStat[] }) {
  if (days.length === 0) return <div className="h-32 flex items-center justify-center text-xs text-[#9CA3AF]">No data</div>;

  const W = 600; const H = 120;
  const PAD = { top: 16, right: 8, bottom: 24, left: 8 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...days.map(d => d.drafts + d.replies), 1);

  const pts = (vals: number[]) =>
    vals.map((v, i) => ({
      x: PAD.left + (days.length === 1 ? iW / 2 : (i / (days.length - 1)) * iW),
      y: PAD.top + iH - (v / maxVal) * iH,
    }));

  const draftPts  = pts(days.map(d => d.drafts));
  const replyPts  = pts(days.map(d => d.replies));

  function linePath(p: { x: number; y: number }[]) {
    return p.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  }
  function areaPath(p: { x: number; y: number }[]) {
    const lp = linePath(p);
    const bot = PAD.top + iH;
    return `${lp} L ${p[p.length - 1]!.x.toFixed(1)},${bot.toFixed(1)} L ${p[0]!.x.toFixed(1)},${bot.toFixed(1)} Z`;
  }

  const draftLine  = linePath(draftPts);
  const draftArea  = areaPath(draftPts);
  const replyLine  = linePath(replyPts);
  const replyArea  = areaPath(replyPts);

  // X-axis labels: show ~6 evenly spaced
  const labelIdxs: number[] = [];
  if (days.length <= 7) {
    days.forEach((_, i) => labelIdxs.push(i));
  } else {
    for (let step = 0; step <= 5; step++) labelIdxs.push(Math.round((step / 5) * (days.length - 1)));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ag_draft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6C55E8" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#6C55E8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ag_reply" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(v => (
        <line key={v} x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + iH - v * iH} y2={PAD.top + iH - v * iH}
          stroke="#F3F4F6" strokeWidth={1} />
      ))}
      {/* Reply area + line */}
      <path d={replyArea} fill="url(#ag_reply)" />
      <path d={replyLine} fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Draft area + line */}
      <path d={draftArea} fill="url(#ag_draft)" />
      <path d={draftLine} fill="none" stroke="#6C55E8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots on draft line */}
      {draftPts.filter((_, i) => days.length <= 20 || labelIdxs.includes(i)).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6C55E8" stroke="white" strokeWidth={1.5} />
      ))}
      {/* X labels */}
      {labelIdxs.map(i => (
        <text key={i}
          x={(PAD.left + (days.length === 1 ? iW / 2 : (i / (days.length - 1)) * iW)).toFixed(1)}
          y={H - 4} textAnchor="middle" fontSize={9} fill="#9CA3AF">
          {new Date(days[i]!.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type EventFilter = 'all' | 'ai_draft' | 'published_reply';

export function AIActivityPage() {
  const [events,  setEvents]  = useState<RawEvent[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [orgs,    setOrgs]    = useState<OrgRow[]>([]);
  const [profiles,setProfiles]= useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string } | null>(null);

  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  async function load() {
    setLoading(true);

    const [eventsRes, settingsRes] = await Promise.all([
      supabase
        .from('usage_events')
        .select('id, user_id, event_type, created_at')
        .gte('created_at', last30Days())
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('ai_settings').select('provider, model, is_active').eq('is_active', true).maybeSingle(),
    ]);

    const rawEvents = (eventsRes.data ?? []) as RawEvent[];
    setEvents(rawEvents);

    // Enrich: resolve org and user
    const userIds = [...new Set(rawEvents.map(e => e.user_id))];
    if (userIds.length > 0) {
      const [membersRes, profilesRes] = await Promise.all([
        supabase.from('org_external_members').select('user_id, org_id').in('user_id', userIds),
        supabase.from('profiles').select('id, display_name, email').in('id', userIds),
      ]);
      const memberRows = (membersRes.data ?? []) as OrgMember[];
      setMembers(memberRows);
      setProfiles((profilesRes.data ?? []) as Profile[]);

      const orgIds = [...new Set(memberRows.map(m => m.org_id))];
      if (orgIds.length > 0) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, ref_id')
          .in('id', orgIds);
        setOrgs((orgData ?? []) as OrgRow[]);
      }
    }

    // AI config
    const aiRow = settingsRes.data as { provider: string; model: string } | null;
    if (aiRow) setAiConfig({ provider: aiRow.provider, model: aiRow.model });

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Build enriched events
  const enriched = useMemo<EnrichedEvent[]>(() => {
    const userOrg = new Map<string, string>();
    for (const m of members) userOrg.set(m.user_id, m.org_id);
    const orgById = new Map(orgs.map(o => [o.id, o]));
    const profById = new Map(profiles.map(p => [p.id, p]));

    return events.map(e => {
      const orgId = userOrg.get(e.user_id) ?? '';
      const org   = orgById.get(orgId);
      const prof  = profById.get(e.user_id);
      return {
        ...e,
        orgId,
        orgName:  org?.name     ?? 'Unknown',
        orgRef:   org?.ref_id   ?? '',
        userName: prof?.display_name ?? prof?.email ?? e.user_id.slice(0, 8) + '...',
      };
    });
  }, [events, members, orgs, profiles]);

  // KPI counts
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart  = new Date(now.getTime() - 7 * 86400000).toISOString();

  const kpis = useMemo(() => {
    const drafts30  = enriched.filter(e => e.event_type === 'ai_draft').length;
    const replies30 = enriched.filter(e => e.event_type === 'published_reply').length;
    const drafts7   = enriched.filter(e => e.event_type === 'ai_draft' && e.created_at >= weekStart).length;
    const draftsToday = enriched.filter(e => e.event_type === 'ai_draft' && e.created_at >= todayStart).length;
    const orgSet   = new Set(enriched.filter(e => e.event_type === 'ai_draft').map(e => e.orgId));
    return { drafts30, replies30, drafts7, draftsToday, activeOrgs: orgSet.size };
  }, [enriched, todayStart, weekStart]);

  // 30-day trend
  const trendDays = useMemo<DayStat[]>(() => {
    const map = new Map<string, DayStat>();
    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { date: k, drafts: 0, replies: 0 });
    }
    for (const e of enriched) {
      const k = dayKey(e.created_at);
      const row = map.get(k);
      if (!row) continue;
      if (e.event_type === 'ai_draft')        row.drafts++;
      else if (e.event_type === 'published_reply') row.replies++;
    }
    return [...map.values()];
  }, [enriched]);

  // Filtered event list
  const filtered = useMemo(() => {
    let rows = enriched;
    if (eventFilter !== 'all') rows = rows.filter(e => e.event_type === eventFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(e => e.orgName.toLowerCase().includes(q) || e.userName.toLowerCase().includes(q));
    }
    return rows;
  }, [enriched, eventFilter, search]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">AI Activity</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Last 30 days</p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Config badge */}
            {aiConfig && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#EDE9FE] rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C55E8] animate-pulse" />
                <span className="text-xs font-semibold text-[#6C55E8]">{aiConfig.provider}</span>
                <span className="text-xs text-[#9CA3AF]">{aiConfig.model}</span>
              </div>
            )}
            <button onClick={load}
              className="p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#6C55E8] hover:border-[#6C55E8] transition-colors"
              title="Refresh">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'AI Drafts Today',    value: kpis.draftsToday, color: 'text-[#6C55E8]', bg: 'bg-[#EDE9FE]' },
            { label: 'AI Drafts (7 days)', value: kpis.drafts7,     color: 'text-[#5B21B6]', bg: 'bg-[#D8CCFF]' },
            { label: 'AI Drafts (30 days)',value: kpis.drafts30,    color: 'text-[#111827]', bg: 'bg-[#F3F4F6]' },
            { label: 'Published Replies',  value: kpis.replies30,   color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF]' },
            { label: 'Active Orgs',        value: kpis.activeOrgs,  color: 'text-[#C2410C]', bg: 'bg-[#FFF7ED]' },
          ].map(c => (
            <div key={c.label} className="bg-white shadow-sm rounded-xl px-4 py-3">
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Chart + Legend */}
        <div className="bg-white rounded-xl shadow-sm px-6 pt-4 pb-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#111827]">Daily Activity Trend</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span className="w-3 h-0.5 bg-[#6C55E8] inline-block rounded" /> AI Drafts
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span className="w-3 h-0.5 bg-[#3B82F6] inline-block rounded" /> Published Replies
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse bg-[#F9FAFB] rounded-lg" />
          ) : (
            <TrendChart days={trendDays} />
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm rounded-xl flex-1">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search org or user..."
              className="flex-1 text-sm text-[#111827] placeholder-[#9CA3AF] bg-transparent focus:outline-none" />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-[#E5E7EB] bg-white shadow-sm">
            {(['all', 'ai_draft', 'published_reply'] as EventFilter[]).map(f => (
              <button key={f} onClick={() => { setEventFilter(f); setPage(0); }}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  eventFilter === f
                    ? 'bg-[#6C55E8] text-white'
                    : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                }`}>
                {f === 'all' ? 'All' : f === 'ai_draft' ? 'AI Draft' : 'Published'}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{filtered.length} events</span>
        </div>

        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Time</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Organization</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">User</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No events found.</td></tr>
              ) : pageRows.map(e => (
                <tr key={e.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-5 py-3 text-xs text-[#6B7280] whitespace-nowrap tabular-nums">
                    {fmtDate(e.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    {e.orgId ? (
                      <Link to={`/clients`}
                        className="text-sm font-medium text-[#111827] hover:text-[#6C55E8] hover:underline">
                        {e.orgName}
                      </Link>
                    ) : (
                      <span className="text-sm text-[#9CA3AF]">Unknown</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#6B7280] font-mono">{e.userName}</td>
                  <td className="px-5 py-3">
                    {e.event_type === 'ai_draft' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EDE9FE] text-[#6C55E8]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Published
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#F3F4F6]">
              <span className="text-xs text-[#9CA3AF]">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-2 py-1 text-xs rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-default transition-colors">
                  Prev
                </button>
                <span className="px-2 text-xs text-[#6B7280]">{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-2 py-1 text-xs rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-default transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
