import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d';

interface DailyMetric {
  date: string;
  views_search: number;
  views_maps: number;
  calls: number;
  website_clicks: number;
  direction_requests: number;
}

interface Totals {
  views_search: number;
  views_maps: number;
  calls: number;
  website_clicks: number;
  direction_requests: number;
  total_views: number;
}

interface SearchQuery { query: string; count: number; }
interface LocationResult { id: string; display_name: string | null; total_views: number; }
interface InsightsData {
  metrics: DailyMetric[];
  totals: Totals;
  queries: SearchQuery[];
  locations: LocationResult[];
  date_range: { start: string; end: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const RANGE_DAYS: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function fetchInsights(rangeDays: number, locationId: string | null): Promise<InsightsData | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${BASE}/google-fetch-insights`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range_days: rangeDays, location_id: locationId }),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── ViewsChart (SVG line chart) ───────────────────────────────────────────────

function ViewsChart({ metrics, range }: { metrics: DailyMetric[]; range: DateRange }) {
  const W = 700, H = 180;
  const PAD = { top: 16, right: 16, bottom: 36, left: 44 };

  const data = useMemo(() => {
    if (metrics.length === 0) return [];
    // For 90d, group into weeks
    if (range === '90d') {
      const weeks = new Map<string, { search: number; maps: number }>();
      for (const m of metrics) {
        const d = new Date(m.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d); mon.setDate(diff);
        const k = mon.toISOString().slice(0, 10);
        const cur = weeks.get(k) ?? { search: 0, maps: 0 };
        cur.search += m.views_search; cur.maps += m.views_maps;
        weeks.set(k, cur);
      }
      return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
    }
    return metrics.map(m => ({ date: m.date, search: m.views_search, maps: m.views_maps }));
  }, [metrics, range]);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-[#9CA3AF]">
        Not enough data for this period
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.search + d.maps), 1);
  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (v: number) => PAD.top + (1 - v / maxVal) * (H - PAD.top - PAD.bottom);

  const searchPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.search)}`).join(' ');
  const mapsPath   = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.maps)}`).join(' ');

  // X labels — show ~6 evenly spaced
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  const labels = data.filter((_, i) => i % labelStep === 0 || i === data.length - 1);

  // Y grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(maxVal * t), y: yScale(maxVal * t) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Y grid */}
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F3F4F6" strokeWidth={1}/>
          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#9CA3AF">{fmt(t.v)}</text>
        </g>
      ))}
      {/* Search line */}
      <path d={searchPath} fill="none" stroke="#0D4C3C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      {/* Maps line */}
      <path d={mapsPath} fill="none" stroke="#4FA882" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2"/>
      {/* X labels */}
      {labels.map(d => {
        const i = data.indexOf(d);
        return <text key={d.date} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9CA3AF">{fmtDate(d.date)}</text>;
      })}
    </svg>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] px-5 py-4">
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── NotConnectedState ─────────────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="flex-1 flex items-center justify-center px-8 py-16">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#111827] mb-2">Connect Google Business Profile</h2>
        <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
          Connect your Google Business Profile in Settings to view performance data.
        </p>
        <a href="/settings" className="inline-block bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
          Go to Settings
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function GoogleProfilePage() {
  const { selectedId: globalLocationId } = useLocationStore();
  const [range, setRange] = useState<DateRange>('30d');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load connection state once
  useEffect(() => {
    (async () => {
      const { data: conn } = await supabase
        .from('google_connections').select('state').maybeSingle();
      setIsConnected(conn?.state === 'CONNECTED');
      if (conn?.state !== 'CONNECTED') setLoading(false);
    })();
  }, []);

  // Load insights whenever range / global location changes (and connected)
  useEffect(() => {
    if (isConnected === null || isConnected === false) return;
    setLoading(true); setError(null);
    fetchInsights(RANGE_DAYS[range], globalLocationId ?? null).then(d => {
      if (!d) setError('Could not load insights. Google Performance data may not be available for your locations yet.');
      else setData(d);
      setLoading(false);
    });
  }, [range, globalLocationId, isConnected]);

  if (isConnected === false) return <NotConnectedState />;

  const totals = data?.totals;
  const metrics = data?.metrics ?? [];
  const queries = data?.queries ?? [];

  const totalActions = (totals?.calls ?? 0) + (totals?.website_clicks ?? 0) + (totals?.direction_requests ?? 0);
  const actionPct = (n: number) => totalActions > 0 ? Math.round((n / totalActions) * 100) : 0;

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="px-10 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Google Profile</h1>
          {data?.date_range && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {fmtDate(data.date_range.start)} — {fmtDate(data.date_range.end)} · data delayed ~2 days
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Date range pills */}
          {(['7d','30d','90d'] as DateRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${range === r ? 'bg-[#0D4C3C] text-white border-[#0D4C3C]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#111827]'}`}>
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-10 pb-10">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="w-6 h-6 animate-spin text-[#0D4C3C]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : error ? (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 max-w-xl">
            <p className="text-sm font-medium text-amber-800 mb-1">Data unavailable</p>
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 mt-2">
              <StatCard label="Total Profile Views" value={fmt(totals?.total_views ?? 0)} sub="Search + Maps" color="text-[#111827]"/>
              <StatCard label="Search Views" value={fmt(totals?.views_search ?? 0)} color="text-[#0D4C3C]"/>
              <StatCard label="Maps Views" value={fmt(totals?.views_maps ?? 0)} color="text-[#4FA882]"/>
              <StatCard label="Calls" value={fmt(totals?.calls ?? 0)} color="text-[#111827]"/>
              <StatCard label="Website Clicks" value={fmt(totals?.website_clicks ?? 0)} color="text-[#111827]"/>
            </div>

            {/* Views chart */}
            <div className="bg-white rounded-xl border border-[#E5EAE8] p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[#111827]">Profile Views Over Time</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <span className="w-5 h-0.5 bg-[#0D4C3C] inline-block rounded"/>Search
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <span className="w-5 h-0.5 bg-[#4FA882] inline-block rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#4FA882 0 4px,transparent 4px 6px)' }}/>Maps
                  </span>
                </div>
              </div>
              <ViewsChart metrics={metrics} range={range}/>
            </div>

            {/* Bottom row: queries + actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Search Queries */}
              <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
                <p className="text-sm font-semibold text-[#111827] mb-4">Top Search Queries</p>
                {queries.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] py-4 text-center">No query data available yet</p>
                ) : (
                  <div className="space-y-2">
                    {queries.map((q, i) => {
                      const maxCount = queries[0]?.count ?? 1;
                      const pct = Math.round((q.count / maxCount) * 100);
                      return (
                        <div key={q.query} className="flex items-center gap-3">
                          <span className="text-xs text-[#9CA3AF] w-4 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm text-[#374151] truncate">{q.query}</span>
                              <span className="text-xs text-[#6B7280] ml-2 flex-shrink-0">{fmt(q.count)}</span>
                            </div>
                            <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                              <div className="h-full bg-[#0D4C3C] rounded-full transition-all" style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions breakdown */}
              <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
                <p className="text-sm font-semibold text-[#111827] mb-4">Customer Actions</p>
                <div className="space-y-4">
                  {[
                    { label: 'Calls', value: totals?.calls ?? 0, color: 'bg-[#0D4C3C]' },
                    { label: 'Website clicks', value: totals?.website_clicks ?? 0, color: 'bg-[#4FA882]' },
                    { label: 'Direction requests', value: totals?.direction_requests ?? 0, color: 'bg-[#94C4B0]' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-[#374151]">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#111827]">{fmt(item.value)}</span>
                          <span className="text-xs text-[#9CA3AF]">{actionPct(item.value)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${actionPct(item.value)}%` }}/>
                      </div>
                    </div>
                  ))}
                  {totalActions === 0 && (
                    <p className="text-sm text-[#9CA3AF] py-4 text-center">No action data available yet</p>
                  )}
                </div>

                {/* Direction requests as separate stat */}
                <div className="mt-5 pt-4 border-t border-[#F3F4F6]">
                  <p className="text-xs text-[#9CA3AF] mb-2">Direction Requests</p>
                  <p className="text-2xl font-bold text-[#111827]">{fmt(totals?.direction_requests ?? 0)}</p>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
