import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type RangePreset = '7d' | '30d' | '90d' | 'custom';

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
  captured_at?: string;
}

interface InsightsData {
  metrics: DailyMetric[];
  totals: Totals;
  queries: { query: string; count: number }[];
  locations: { id: string; display_name: string | null; total_views: number }[];
  date_range: { start: string; end: string };
  baseline: Totals | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function weekKey(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().slice(0, 10);
}

function computeTrend(metrics: DailyMetric[], key: keyof Omit<DailyMetric, 'date'>): number | null {
  if (metrics.length < 14) return null;
  const half = Math.floor(metrics.length / 2);
  const prev = metrics.slice(0, half).reduce((s, m) => s + m[key], 0);
  const curr = metrics.slice(half).reduce((s, m) => s + m[key], 0);
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function buildPath(pts: { x: number; y: number }[]): string {
  return pts.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function downloadCSV(metrics: DailyMetric[], rangeLabel: string) {
  if (!metrics.length) return;
  const rows = [
    'Date,Search Views,Maps Views,Total Views,Calls,Website Clicks,Directions',
    ...metrics.map(m =>
      `${m.date},${m.views_search},${m.views_maps},${m.views_search + m.views_maps},${m.calls},${m.website_clicks},${m.direction_requests}`
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `google-profile-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart constants ───────────────────────────────────────────────────────────

const W = 560, H = 180;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

// ─── ViewsChart ────────────────────────────────────────────────────────────────

function ViewsChart({
  metrics,
  reviewCounts,
}: {
  metrics: DailyMetric[];
  reviewCounts?: { date: string; count: number }[] | null;
}) {
  const useWeeks = metrics.length > 45;

  const data = useMemo((): { date: string; search: number; maps: number }[] => {
    if (!metrics.length) return [];
    if (useWeeks) {
      const wk = new Map<string, { search: number; maps: number }>();
      for (const m of metrics) {
        const k = weekKey(m.date);
        const cur = wk.get(k) ?? { search: 0, maps: 0 };
        cur.search += m.views_search;
        cur.maps += m.views_maps;
        wk.set(k, cur);
      }
      return [...wk.entries()]
        .sort((ea, eb) => ea[0]!.localeCompare(eb[0]!))
        .map(([date, v]) => ({ date, search: v.search, maps: v.maps }));
    }
    return metrics.map(m => ({ date: m.date, search: m.views_search, maps: m.views_maps }));
  }, [metrics, useWeeks]);

  const reviewData = useMemo((): number[] | null => {
    if (!reviewCounts?.length || !data.length) return null;
    if (useWeeks) {
      const wk = new Map<string, number>();
      for (const r of reviewCounts) {
        const k = weekKey(r.date);
        wk.set(k, (wk.get(k) ?? 0) + r.count);
      }
      return data.map(d => wk.get(d.date) ?? 0);
    }
    const lk = new Map(reviewCounts.map(r => [r.date, r.count]));
    return data.map(d => lk.get(d.date) ?? 0);
  }, [reviewCounts, data, useWeeks]);

  if (!data.length) {
    return <div className="flex items-center justify-center h-[180px] text-xs text-[#9CA3AF]">No data</div>;
  }

  const maxVal = Math.max(...data.map(d => d.search + d.maps), 1);
  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * (W - PAD.left - PAD.right);
  const yS = (v: number) => PAD.top + (1 - v / maxVal) * (H - PAD.top - PAD.bottom);

  const searchPts = data.map((d, i) => ({ x: xS(i), y: yS(d.search) }));
  const totalPts  = data.map((d, i) => ({ x: xS(i), y: yS(d.search + d.maps) }));

  const areaTotal  = `${buildPath(totalPts)} L${xS(data.length - 1)},${H - PAD.bottom} L${xS(0)},${H - PAD.bottom} Z`;
  const areaSearch = `${buildPath(searchPts)} L${xS(data.length - 1)},${H - PAD.bottom} L${xS(0)},${H - PAD.bottom} Z`;

  const maxReviews = reviewData ? Math.max(...reviewData, 1) : 1;
  const yR = (v: number) => PAD.top + (1 - v / maxReviews) * (H - PAD.top - PAD.bottom);
  const reviewPts = reviewData ? reviewData.map((v, i) => ({ x: xS(i), y: yR(v) })) : null;

  const yLabels = [0, 0.5, 1].map(f => ({ val: Math.round(maxVal * f), y: yS(maxVal * f) }));
  const xLabels = data.length > 1
    ? [0, Math.floor(data.length / 2), data.length - 1].map(i => ({ label: fmtDate(data[i]!.date), x: xS(i) }))
    : [{ label: fmtDate(data[0]!.date), x: xS(0) }];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="vcg-total" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D4C3C" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#0D4C3C" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="vcg-search" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4FA882" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#4FA882" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {yLabels.map(({ val, y }) => (
        <g key={val}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F3F4F6" strokeWidth={1}/>
          <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#9CA3AF">{fmt(val)}</text>
        </g>
      ))}
      <path d={areaTotal} fill="url(#vcg-total)"/>
      <path d={areaSearch} fill="url(#vcg-search)"/>
      <path d={buildPath(totalPts)} fill="none" stroke="#0D4C3C" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <path d={buildPath(searchPts)} fill="none" stroke="#4FA882" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2"/>
      {reviewPts && (
        <>
          <path d={buildPath(reviewPts)} fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="3 3"/>
          <text x={W - PAD.right + 3} y={PAD.top + 4} fontSize={8} fill="#F59E0B">{fmt(maxReviews)}</text>
          <text x={W - PAD.right + 3} y={H - PAD.bottom} fontSize={8} fill="#F59E0B">0</text>
        </>
      )}
      {xLabels.map(({ label, x }) => (
        <text key={label} x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#9CA3AF">{label}</text>
      ))}
    </svg>
  );
}

// ─── ActionsChart ─────────────────────────────────────────────────────────────

function ActionsChart({ metrics }: { metrics: DailyMetric[] }) {
  const useWeeks = metrics.length > 45;

  const data = useMemo((): { date: string; calls: number; website: number; directions: number }[] => {
    if (!metrics.length) return [];
    if (useWeeks) {
      const wk = new Map<string, { calls: number; website: number; directions: number }>();
      for (const m of metrics) {
        const k = weekKey(m.date);
        const cur = wk.get(k) ?? { calls: 0, website: 0, directions: 0 };
        cur.calls      += m.calls;
        cur.website    += m.website_clicks;
        cur.directions += m.direction_requests;
        wk.set(k, cur);
      }
      return [...wk.entries()]
        .sort((ea, eb) => ea[0]!.localeCompare(eb[0]!))
        .map(([date, v]) => ({ date, calls: v.calls, website: v.website, directions: v.directions }));
    }
    return metrics.map(m => ({
      date: m.date,
      calls: m.calls,
      website: m.website_clicks,
      directions: m.direction_requests,
    }));
  }, [metrics, useWeeks]);

  if (!data.length) {
    return <div className="flex items-center justify-center h-[160px] text-xs text-[#9CA3AF]">No data</div>;
  }

  const AH = 160;
  const maxVal = Math.max(...data.map(d => Math.max(d.calls, d.website, d.directions)), 1);
  const xS = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * (W - PAD.left - PAD.right);
  const yS = (v: number) => PAD.top + (1 - v / maxVal) * (AH - PAD.top - PAD.bottom);

  const series = [
    { key: 'calls'      as const, color: '#0D4C3C', label: 'Calls' },
    { key: 'website'    as const, color: '#4FA882', label: 'Website' },
    { key: 'directions' as const, color: '#94C4B0', label: 'Directions' },
  ];

  const xLabels = data.length > 1
    ? [0, Math.floor(data.length / 2), data.length - 1].map(i => ({ label: fmtDate(data[i]!.date), x: xS(i) }))
    : [{ label: fmtDate(data[0]!.date), x: xS(0) }];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${AH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map(f => {
          const y = yS(maxVal * f);
          return (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F3F4F6" strokeWidth={1}/>
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#9CA3AF">{fmt(Math.round(maxVal * f))}</text>
            </g>
          );
        })}
        {series.map(s => {
          const pts = data.map((d, i) => ({ x: xS(i), y: yS(d[s.key]) }));
          return (
            <path key={s.key} d={buildPath(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
          );
        })}
        {xLabels.map(({ label, x }) => (
          <text key={label} x={x} y={AH - 4} textAnchor="middle" fontSize={9} fill="#9CA3AF">{label}</text>
        ))}
      </svg>
      <div className="flex gap-4 mt-2">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }}/>
            <span className="text-[11px] text-[#6B7280]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ViewsSplitRing ────────────────────────────────────────────────────────────

function ViewsSplitRing({ search, maps }: { search: number; maps: number }) {
  const total = search + maps;
  if (!total) {
    return <div className="flex items-center justify-center h-full text-xs text-[#9CA3AF]">No data</div>;
  }
  const searchPct = Math.round((search / total) * 100);
  const mapsPct = 100 - searchPct;
  const r = 52, cx = 64, cy = 64;
  const circumf = 2 * Math.PI * r;
  const gapFrac = 2 / 360;
  const sFrac = (searchPct / 100) * (1 - 2 * gapFrac);
  const mFrac = (mapsPct / 100) * (1 - 2 * gapFrac);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 128 128" className="w-32 h-32">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={14}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0D4C3C" strokeWidth={14}
          strokeDasharray={`${sFrac * circumf} ${circumf}`}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4FA882" strokeWidth={14}
          strokeDasharray={`${mFrac * circumf} ${circumf}`}
          strokeDashoffset={`${-(sFrac + gapFrac) * circumf}`}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"/>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="700" fill="#111827">{fmt(total)}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#9CA3AF">total views</text>
      </svg>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0D4C3C]"/>
          <span className="text-xs text-[#374151]">Search <span className="font-semibold">{searchPct}%</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#4FA882]"/>
          <span className="text-xs text-[#374151]">Maps <span className="font-semibold">{mapsPct}%</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── DayOfWeekHeatmap ─────────────────────────────────────────────────────────

function DayOfWeekHeatmap({ metrics }: { metrics: DailyMetric[] }) {
  if (!metrics.length) return null;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  type DowCell = { views: number; calls: number; website: number; directions: number; count: number };
  const dow: DowCell[] = Array.from({ length: 7 }, () => ({ views: 0, calls: 0, website: 0, directions: 0, count: 0 }));

  for (const m of metrics) {
    const d = new Date(m.date + 'T00:00:00').getDay();
    const i = d === 0 ? 6 : d - 1;
    const cell = dow[i];
    if (!cell) continue;
    cell.views      += m.views_search + m.views_maps;
    cell.calls      += m.calls;
    cell.website    += m.website_clicks;
    cell.directions += m.direction_requests;
    cell.count      += 1;
  }

  const rows: { label: string; key: keyof Omit<DowCell, 'count'>; color: string }[] = [
    { label: 'Views',      key: 'views',      color: '#0D4C3C' },
    { label: 'Calls',      key: 'calls',      color: '#4FA882' },
    { label: 'Website',    key: 'website',    color: '#059669' },
    { label: 'Directions', key: 'directions', color: '#94C4B0' },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        <div className="grid grid-cols-8 gap-1.5 mb-2">
          <div/>
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-[#9CA3AF]">{d}</div>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map(row => {
            const vals = dow.map(d => d.count > 0 ? d[row.key] / d.count : 0);
            const maxV = Math.max(...vals, 1);
            return (
              <div key={row.label} className="grid grid-cols-8 gap-1.5 items-center">
                <div className="text-[11px] text-[#6B7280] font-medium">{row.label}</div>
                {vals.map((avg, i) => {
                  const intensity = avg / maxV;
                  const alpha = Math.round(intensity * 210 + 20).toString(16).padStart(2, '0');
                  return (
                    <div
                      key={i}
                      title={`${DAYS[i] ?? ''}: ~${Math.round(avg)}/day`}
                      className="h-9 rounded-lg flex items-center justify-center text-[10px] font-semibold cursor-default select-none transition-colors"
                      style={{
                        backgroundColor: `${row.color}${alpha}`,
                        color: intensity > 0.55 ? 'white' : '#374151',
                      }}
                    >
                      {Math.round(avg) > 0 ? fmt(Math.round(avg)) : '–'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#9CA3AF] mt-2">Average per day of week over selected period</p>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  rawValue,
  sub,
  color,
  trend,
  baselineValue,
}: {
  label: string;
  rawValue: number;
  sub?: string;
  color: string;
  trend?: number | null;
  baselineValue?: number | null;
}) {
  const baseChange =
    baselineValue != null && baselineValue > 0
      ? Math.round(((rawValue - baselineValue) / baselineValue) * 100)
      : null;

  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] px-5 py-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-[#6B7280]">{label}</p>
        {trend != null && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
            trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{fmt(rawValue)}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
      {baselineValue != null && baseChange != null && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
            baseChange >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
          }`}>
            {baseChange >= 0 ? '↑' : '↓'} {Math.abs(baseChange)}%
          </span>
          <span className="text-[10px] text-[#9CA3AF]">since joined</span>
        </div>
      )}
    </div>
  );
}

// ─── NotConnected ─────────────────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-[#F0F7F4] flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-[#0D4C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-[#111827] mb-1">Google not connected</h3>
      <p className="text-xs text-[#6B7280] max-w-xs">
        Connect your Google Business Profile in Settings to see performance insights.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GoogleProfilePage() {
  const { selectedId: globalLocationId } = useLocationStore();

  const [range, setRange] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showReviewOverlay, setShowReviewOverlay] = useState(false);
  const [reviewCounts, setReviewCounts] = useState<{ date: string; count: number }[] | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [showBaselineCompare, setShowBaselineCompare] = useState(false);
  const [baseline, setBaseline] = useState<Totals | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

  // Close custom picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Check Google connection
  useEffect(() => {
    supabase.from('google_connections').select('state').maybeSingle().then(({ data: conn }) => {
      setIsConnected(conn?.state === 'CONNECTED');
    });
  }, []);

  // Fetch insights
  const fetchData = useCallback(async () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const body: Record<string, unknown> = {};
      if (range === 'custom' && customFrom && customTo) {
        body.start_date = customFrom;
        body.end_date   = customTo;
      } else {
        body.range_days = RANGE_DAYS[range] ?? 30;
      }
      if (globalLocationId) body.location_id = globalLocationId;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fetch-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load insights');
      setData(json as InsightsData);
      if (json.baseline) setBaseline(json.baseline as Totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, range, customFrom, customTo, globalLocationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch review counts for overlay
  useEffect(() => {
    if (!showReviewOverlay || !data?.date_range) {
      if (!showReviewOverlay) setReviewCounts(null);
      return;
    }
    setReviewLoading(true);
    supabase
      .from('reviews')
      .select('published_at')
      .gte('published_at', data.date_range.start)
      .lte('published_at', data.date_range.end + 'T23:59:59')
      .then(({ data: reviews }) => {
        const counts = new Map<string, number>();
        for (const r of (reviews ?? []) as { published_at?: string }[]) {
          const d = r.published_at?.slice(0, 10);
          if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        setReviewCounts(
          [...counts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }))
        );
        setReviewLoading(false);
      });
  }, [showReviewOverlay, data?.date_range]);

  const handleCustomApply = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setRange('custom');
      setShowCustom(false);
    }
  };

  const customLabel = customFrom && customTo
    ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}`
    : 'Custom';
  const rangeLabel = range === 'custom' ? customLabel : range;

  if (!isConnected && !loading) return <NotConnectedState />;

  const totals = data?.totals;
  const metrics = data?.metrics ?? [];
  const hasTrend = metrics.length >= 14;
  const needsWeeks = metrics.length > 45;

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Google Profile</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Business performance insights</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compare-to-signup toggle */}
          {baseline && (
            <button
              onClick={() => setShowBaselineCompare(o => !o)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showBaselineCompare
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#374151]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              Compare to signup
            </button>
          )}

          {/* CSV export */}
          <button
            onClick={() => downloadCSV(metrics, rangeLabel)}
            disabled={!metrics.length}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#374151] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>

          {/* Range presets */}
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setRange(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                range === p
                  ? 'bg-[#0D4C3C] text-white border-[#0D4C3C]'
                  : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#374151]'
              }`}>
              {p}
            </button>
          ))}

          {/* Custom date picker */}
          <div ref={customRef} className="relative">
            <button
              onClick={() => setShowCustom(o => !o)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                range === 'custom'
                  ? 'bg-[#0D4C3C] text-white border-[#0D4C3C]'
                  : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#374151]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {range === 'custom' ? customLabel : 'Custom'}
            </button>
            {showCustom && (
              <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl border border-[#E5EAE8] shadow-lg z-30 p-4 w-64">
                <p className="text-xs font-semibold text-[#374151] mb-3">Custom date range</p>
                <div className="space-y-2.5 mb-3">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1">From</label>
                    <input type="date" value={customFrom} max={customTo || today}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="w-full text-xs border border-[#D1D5DB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D4C3C]"/>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1">To</label>
                    <input type="date" value={customTo} min={customFrom} max={today}
                      onChange={e => setCustomTo(e.target.value)}
                      className="w-full text-xs border border-[#D1D5DB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D4C3C]"/>
                  </div>
                </div>
                <button
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className="w-full text-xs font-semibold py-2 rounded-lg bg-[#0D4C3C] text-white hover:bg-[#0a3d31] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Refresh */}
          <button onClick={fetchData} disabled={loading}
            className="p-1.5 rounded-lg border border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#374151] transition-colors disabled:opacity-40">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5EAE8] px-5 py-4 animate-pulse">
              <div className="h-3 bg-[#F3F4F6] rounded w-2/3 mb-3"/>
              <div className="h-7 bg-[#F3F4F6] rounded w-1/2"/>
            </div>
          ))}
        </div>
      )}

      {!loading && totals && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total Views"     rawValue={totals.total_views}        sub="Search + Maps"  color="text-[#0D4C3C]"
              trend={hasTrend ? computeTrend(metrics, 'views_search') : null}
              baselineValue={showBaselineCompare ? (baseline?.total_views ?? null) : null}/>
            <StatCard label="Search Views"    rawValue={totals.views_search}                            color="text-[#4FA882]"
              trend={hasTrend ? computeTrend(metrics, 'views_search') : null}
              baselineValue={showBaselineCompare ? (baseline?.views_search ?? null) : null}/>
            <StatCard label="Maps Views"      rawValue={totals.views_maps}                             color="text-[#059669]"
              trend={hasTrend ? computeTrend(metrics, 'views_maps') : null}
              baselineValue={showBaselineCompare ? (baseline?.views_maps ?? null) : null}/>
            <StatCard label="Calls"           rawValue={totals.calls}                                   color="text-[#374151]"
              trend={hasTrend ? computeTrend(metrics, 'calls') : null}
              baselineValue={showBaselineCompare ? (baseline?.calls ?? null) : null}/>
            <StatCard label="Website Clicks"  rawValue={totals.website_clicks} sub={`+${totals.direction_requests} directions`} color="text-[#374151]"
              trend={hasTrend ? computeTrend(metrics, 'website_clicks') : null}
              baselineValue={showBaselineCompare ? (baseline?.website_clicks ?? null) : null}/>
          </div>

          {/* Baseline info banner */}
          {showBaselineCompare && baseline?.captured_at && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-blue-700">
                Comparing against baseline captured on{' '}
                <span className="font-semibold">{fmtDate(baseline.captured_at)}</span>
                {' '}— your first Google sync after connecting.
              </p>
            </div>
          )}

          {/* ── Views chart + donut ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5EAE8] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Views over time</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{needsWeeks ? 'Grouped by week' : 'Daily'}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-[#0D4C3C]"/>
                    <span className="text-[11px] text-[#6B7280]">Total</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-[#4FA882]"/>
                    <span className="text-[11px] text-[#6B7280]">Search</span>
                  </div>
                  <button
                    onClick={() => setShowReviewOverlay(o => !o)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                      showReviewOverlay
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'border-[#D1D5DB] text-[#9CA3AF] hover:text-[#6B7280]'
                    }`}
                  >
                    {reviewLoading ? '…' : showReviewOverlay ? '● Reviews' : 'Reviews'}
                  </button>
                </div>
              </div>
              <ViewsChart metrics={metrics} reviewCounts={showReviewOverlay ? reviewCounts : null} />
            </div>
            <div className="bg-white rounded-xl border border-[#E5EAE8] p-5 flex flex-col items-center justify-center">
              <p className="text-sm font-semibold text-[#111827] mb-4 self-start">Views split</p>
              <ViewsSplitRing search={totals.views_search} maps={totals.views_maps} />
            </div>
          </div>

          {/* ── Actions chart ── */}
          <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
            <p className="text-sm font-semibold text-[#111827] mb-1">Customer actions</p>
            <p className="text-xs text-[#9CA3AF] mb-4">{needsWeeks ? 'Grouped by week' : 'Daily'}</p>
            <ActionsChart metrics={metrics} />
          </div>

          {/* ── Day-of-week heatmap ── */}
          <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
            <p className="text-sm font-semibold text-[#111827] mb-1">Day-of-week patterns</p>
            <p className="text-xs text-[#9CA3AF] mb-4">Which days drive the most activity</p>
            <DayOfWeekHeatmap metrics={metrics} />
          </div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Search queries */}
            {data.queries.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
                <p className="text-sm font-semibold text-[#111827] mb-4">Top search queries</p>
                <div className="space-y-2">
                  {data.queries.slice(0, 10).map((q, i) => {
                    const maxQ = data.queries[0]?.count ?? 1;
                    const pct = Math.round((q.count / maxQ) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] text-[#9CA3AF] w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-[#374151] truncate">{q.query}</span>
                            <span className="text-[11px] text-[#9CA3AF] ml-2 flex-shrink-0">{fmt(q.count)}</span>
                          </div>
                          <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-1 bg-[#0D4C3C] rounded-full" style={{ width: `${pct}%` }}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions breakdown */}
            <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
              <p className="text-sm font-semibold text-[#111827] mb-4">Actions breakdown</p>
              {(() => {
                const actionTotal = totals.calls + totals.website_clicks + totals.direction_requests;
                const items = [
                  { label: 'Phone calls',        value: totals.calls,              color: '#0D4C3C' },
                  { label: 'Website visits',     value: totals.website_clicks,     color: '#4FA882' },
                  { label: 'Direction requests', value: totals.direction_requests, color: '#94C4B0' },
                ];
                return (
                  <div className="space-y-3">
                    {items.map(item => {
                      const pct = actionTotal > 0 ? Math.round((item.value / actionTotal) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}/>
                              <span className="text-xs text-[#374151]">{item.label}</span>
                            </div>
                            <span className="text-xs font-semibold text-[#111827]">
                              {fmt(item.value)} <span className="font-normal text-[#9CA3AF]">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: item.color }}/>
                          </div>
                        </div>
                      );
                    })}
                    {actionTotal === 0 && (
                      <p className="text-xs text-[#9CA3AF] text-center py-4">No action data for this period</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Location breakdown */}
          {data.locations.length > 1 && (
            <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
              <p className="text-sm font-semibold text-[#111827] mb-4">By location</p>
              <div className="space-y-2">
                {[...data.locations].sort((a, b) => b.total_views - a.total_views).map(loc => {
                  const maxV = data.locations.reduce((m, l) => Math.max(m, l.total_views), 1);
                  const pct = Math.round((loc.total_views / maxV) * 100);
                  return (
                    <div key={loc.id} className="flex items-center gap-3">
                      <span className="text-xs text-[#374151] flex-1 truncate">{loc.display_name ?? 'Location'}</span>
                      <div className="w-32 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-1.5 bg-[#0D4C3C] rounded-full" style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-xs font-medium text-[#374151] w-12 text-right flex-shrink-0">{fmt(loc.total_views)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !error && !totals && isConnected && (
        <div className="text-center py-16 text-sm text-[#9CA3AF]">
          No data for this period. Google Performance data may have a 2-day delay.
        </div>
      )}
    </div>
  );
}

