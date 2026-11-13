import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';
import { googleService } from './google.service';
import type { GoogleConnection, GoogleLocation, Competitor } from './google.service';

const RADII = [5, 10, 20] as const;
type Radius = typeof RADII[number];

function CompetitorStars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-[10px] text-[#D1D5DB]">No rating</span>;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <svg key={i} className={`w-2.5 h-2.5 ${i <= Math.floor(rating) ? 'text-amber-400' : 'text-[#E5E7EB]'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ))}
      </div>
      <span className="text-[11px] font-semibold text-[#374151]">{rating.toFixed(1)}</span>
    </div>
  );
}

interface ReviewStats { total: number; withReply: number; latestAt: string | null; }

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#111827] mb-1">Google not connected</p>
      <p className="text-xs text-[#9CA3AF] max-w-xs">Connect your Google Business Profile in Settings to view status.</p>
    </div>
  );
}

export function GoogleProfilePage() {
  const { selectedId: globalLocationId } = useLocationStore();
  const [conn,         setConn]         = useState<GoogleConnection | null>(null);
  const [loc,          setLoc]          = useState<GoogleLocation | null>(null);
  const [stats,        setStats]        = useState<ReviewStats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [tick,         setTick]         = useState(0);
  const [radius,       setRadius]       = useState<Radius>(5);
  const [competitors,  setCompetitors]  = useState<Competitor[] | null>(null);
  const [compLoading,  setCompLoading]  = useState(false);
  const [compError,    setCompError]    = useState<'NO_COORDINATES' | 'NO_MAPS_KEY' | 'OTHER' | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const [connResult, locResult] = await Promise.all([
          googleService.getConnection(),
          googleService.getLocations(),
        ]);
        if (!alive) return;
        if (connResult.error) throw new Error(connResult.error);
        setConn(connResult.data ?? null);
        const locs = locResult.data ?? [];
        const active = globalLocationId
          ? (locs.find(l => l.id === globalLocationId) ?? locs.find(l => l.is_selected) ?? null)
          : (locs.find(l => l.is_selected) ?? null);
        setLoc(active);
        const q = supabase
          .from('reviews')
          .select('id, reply_text, published_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('published_at', { ascending: false });
        if (active) q.eq('location_id', active.id);
        const { data: reviews, count } = await q;
        if (!alive) return;
        const withReply = (reviews ?? []).filter(
          (r: { reply_text?: string | null }) => r.reply_text && r.reply_text.trim()
        ).length;
        setStats({ total: count ?? 0, withReply, latestAt: (reviews ?? [])[0]?.published_at ?? null });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [globalLocationId]);

  useEffect(() => {
    let alive = true;
    async function loadCompetitors() {
      setCompLoading(true); setCompError(null); setCompetitors(null);
      const { competitors: data, error } = await googleService.getCompetitors(globalLocationId ?? null, radius);
      if (!alive) return;
      if (error) {
        if (error === 'NO_COORDINATES') setCompError('NO_COORDINATES');
        else if (error === 'NO_MAPS_KEY') setCompError('NO_MAPS_KEY');
        else setCompError('OTHER');
      } else {
        setCompetitors(data ?? []);
      }
      setCompLoading(false);
    }
    loadCompetitors();
    return () => { alive = false; };
  }, [globalLocationId, radius]);

  if (loading) return (
    <div className="px-6 py-6 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-[#F9FAFB] rounded-xl animate-pulse" />
      ))}
    </div>
  );

  if (!conn) return <NotConnectedState />;

  void tick;

  const healthy     = conn.state === 'CONNECTED';
  const replyRate   = stats && stats.total > 0 ? Math.round((stats.withReply / stats.total) * 100) : 0;
  const freshnessHrs = stats?.latestAt ? (Date.now() - new Date(stats.latestAt).getTime()) / 3_600_000 : null;

  const profileFields: { label: string; value: string | null; icon: React.ReactNode }[] = [
    {
      label: 'Business Name',
      value: loc?.display_name ?? null,
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    },
    {
      label: 'Address',
      value: loc?.address ?? null,
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    },
    {
      label: 'Business Type',
      value: loc?.description ?? null,
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
    },
    {
      label: 'Connected Email',
      value: conn.google_email ?? null,
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
    },
  ];

  const filledCount = profileFields.filter(f => f.value).length;
  const scorePercent = Math.round((filledCount / profileFields.length) * 100);

  const healthChecks: { label: string; value: string; note: string; ok: boolean }[] = [
    {
      label: 'Google Account',
      ok: healthy,
      value: healthy ? 'Connected' : conn.state.replace(/_/g, ' '),
      note: conn.google_email ?? 'No email on record',
    },
    {
      label: 'Response Rate',
      ok: replyRate >= 60,
      value: stats ? `${stats.withReply} / ${stats.total}` : '—',
      note: `${replyRate}% of reviews replied`,
    },
    {
      label: 'Review Freshness',
      ok: freshnessHrs != null && freshnessHrs < 48,
      value: stats?.latestAt ? timeAgo(stats.latestAt) : 'No reviews',
      note: stats?.latestAt ? fmtDateTime(stats.latestAt) : '',
    },
    {
      label: 'Auto Sync',
      ok: conn.auto_sync_enabled,
      value: conn.auto_sync_enabled ? `Every ${conn.auto_sync_interval}` : 'Off',
      note: conn.auto_sync_enabled ? 'Syncing automatically' : 'Enable in Settings',
    },
  ];

  return (
    <div className="w-full px-6 py-6 space-y-6">

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {/* ── Profile identity row ── */}
      <div className="flex items-center gap-4">
        {/* Google G */}
        <div className="w-14 h-14 rounded-2xl border border-[#E5E7EB] bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg viewBox="0 0 48 48" className="w-8 h-8">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h1 className="text-lg font-bold text-[#111827] truncate">
              {loc?.display_name ?? 'Google Business Profile'}
            </h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 ${
              healthy ? 'text-emerald-600' : 'text-red-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthy ? 'bg-emerald-500' : 'bg-red-500'}`}/>
              {healthy ? 'Healthy' : 'Issue'}
            </span>
          </div>
          {loc?.description
            ? <p className="text-sm text-[#9CA3AF] truncate">{loc.description}</p>
            : loc?.address
              ? <p className="text-sm text-[#9CA3AF] truncate">{loc.address}</p>
              : null
          }
        </div>
      </div>

      {/* ── 3-col connection strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E5E7EB] rounded-2xl overflow-hidden border border-[#E5E7EB]">
        {[
          {
            label: 'Connection',
            primary: conn.state === 'CONNECTED' ? 'Connected' : conn.state.replace(/_/g, ' '),
            sub: conn.google_email ?? '—',
            dot: healthy ? 'bg-emerald-500' : 'bg-red-500',
          },
          {
            label: 'Last Sync',
            primary: conn.last_synced_at ? fmtDateTime(conn.last_synced_at) : 'Never',
            sub: conn.last_synced_at ? timeAgo(conn.last_synced_at) : '',
            dot: null,
          },
          {
            label: 'Connected Since',
            primary: conn.connected_at ? fmtDateTime(conn.connected_at) : 'Unknown',
            sub: conn.connected_at ? timeAgo(conn.connected_at) : '',
            dot: null,
          },
        ].map(item => (
          <div key={item.label} className="bg-white px-5 py-4">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">{item.label}</p>
            <div className="flex items-center gap-1.5">
              {item.dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`}/>}
              <p className="text-sm font-semibold text-[#111827] leading-snug">{item.primary}</p>
            </div>
            {item.sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{item.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Main two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: profile info ── */}
        <div className="lg:col-span-2 space-y-4">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Profile Information</p>

          <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#F3F4F6] bg-white">
            {profileFields.map(f => (
              <div key={f.label} className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-[#C4C9D4] flex-shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#9CA3AF] mb-0.5">{f.label}</p>
                  {f.value
                    ? <p className="text-sm font-medium text-[#111827] leading-snug">{f.value}</p>
                    : <p className="text-sm text-[#D1D5DB]">Not synced</p>
                  }
                </div>
                {f.value
                  ? <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  : <span className="w-4 h-px bg-[#E5E7EB] flex-shrink-0 block"/>
                }
              </div>
            ))}
          </div>

          {/* Profile score */}
          <div className="border border-[#E5E7EB] rounded-2xl bg-white px-4 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-[#374151]">Profile Score</p>
              <span className={`text-xs font-bold ${scorePercent === 100 ? 'text-emerald-600' : scorePercent >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {filledCount} / {profileFields.length} fields
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${scorePercent === 100 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-2">
              {scorePercent === 100 ? 'All scored fields present.' : 'Some fields not yet synced from Google.'}
            </p>
          </div>
        </div>

        {/* ── Right: health + responses ── */}
        <div className="lg:col-span-3 space-y-4">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Profile Health Breakdown</p>

          <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#F3F4F6] bg-white">
            {healthChecks.map(c => (
              <div key={c.label} className="flex items-center gap-4 px-4 py-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  c.ok ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  {c.ok
                    ? <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    : <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">{c.label}</p>
                  {c.note && <p className="text-xs text-[#9CA3AF] truncate">{c.note}</p>}
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${c.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.value}
                </span>
              </div>
            ))}
          </div>

          {/* Review responses */}
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest pt-1">Review Responses</p>
          <div className="border border-[#E5E7EB] rounded-2xl bg-white overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-[#F3F4F6]">
              {[
                { n: stats?.total ?? 0,       label: 'Total Reviews',  sub: 'all time' },
                { n: stats?.withReply ?? 0,    label: 'Replied',        sub: 'with response' },
                { n: `${replyRate}%`,          label: 'Response Rate',  sub: 'coverage' },
              ].map(item => (
                <div key={item.label} className="px-5 py-4 text-center">
                  <p className="text-2xl font-bold text-[#111827]">{item.n}</p>
                  <p className="text-[11px] font-medium text-[#374151] mt-0.5">{item.label}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{item.sub}</p>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <div className="w-full h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${replyRate >= 80 ? 'bg-emerald-500' : replyRate >= 40 ? 'bg-amber-400' : 'bg-[#6C55E8]'}`}
                  style={{ width: `${stats && stats.total > 0 ? replyRate : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Competitors section ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Competitors Nearby</p>
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl">
            {RADII.map(r => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  radius === r ? 'bg-white text-[#111827] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>

        {/* Loading skeleton */}
        {compLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-[#F9FAFB] rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* No coordinates */}
        {!compLoading && compError === 'NO_COORDINATES' && (
          <div className="border border-[#E5E7EB] rounded-2xl bg-white px-5 py-6 text-center">
            <p className="text-sm font-medium text-[#374151] mb-1">Coordinates not synced yet</p>
            <p className="text-xs text-[#9CA3AF]">Run a sync in Settings to enable competitor analysis.</p>
          </div>
        )}

        {/* No API key */}
        {!compLoading && compError === 'NO_MAPS_KEY' && (
          <div className="border border-amber-200 rounded-2xl bg-amber-50 px-5 py-6 text-center">
            <p className="text-sm font-medium text-amber-700 mb-1">Google Maps API key not configured</p>
            <p className="text-xs text-amber-600">Ask your admin to add <span className="font-mono bg-amber-100 px-1 rounded">google_maps_api_key</span> in Admin Settings.</p>
          </div>
        )}

        {/* Competitor cards */}
        {!compLoading && !compError && competitors && (
          competitors.length === 0
            ? (
              <div className="border border-[#E5E7EB] rounded-2xl bg-white px-5 py-8 text-center">
                <p className="text-sm text-[#9CA3AF]">No competitors found within {radius}km.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {competitors.map(c => (
                  <div
                    key={c.place_id}
                    className={`relative rounded-2xl border p-4 flex flex-col gap-2 ${
                      c.is_you
                        ? 'border-[#6C55E8] bg-[#F5F3FF]'
                        : 'border-[#E5E7EB] bg-white'
                    }`}
                  >
                    {/* Position + You badge */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        c.position === 1 ? 'bg-amber-50 text-amber-600' :
                        c.position === 2 ? 'bg-[#F3F4F6] text-[#374151]' :
                        c.position === 3 ? 'bg-orange-50 text-orange-500' :
                        c.is_you         ? 'bg-[#EDE9FE] text-[#6C55E8]' :
                                           'bg-[#F9FAFB] text-[#9CA3AF]'
                      }`}>
                        {c.position}
                      </span>
                      {c.is_you && (
                        <span className="text-[10px] font-semibold text-[#6C55E8] bg-[#EDE9FE] px-1.5 py-0.5 rounded-md">You</span>
                      )}
                      {!c.is_you && (
                        <span className="text-[10px] text-[#9CA3AF]">{c.distance_km}km</span>
                      )}
                    </div>

                    {/* Name */}
                    <p className={`text-xs font-semibold leading-snug line-clamp-2 ${c.is_you ? 'text-[#4C1D95]' : 'text-[#111827]'}`}>
                      {c.name}
                    </p>

                    {/* Rating */}
                    <CompetitorStars rating={c.rating} />

                    {/* Review count */}
                    <p className="text-[10px] text-[#9CA3AF]">
                      {c.review_count > 0 ? `${c.review_count.toLocaleString()} reviews` : 'No reviews'}
                    </p>
                  </div>
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}
