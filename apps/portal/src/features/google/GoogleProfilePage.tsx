import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';
import { googleService } from './google.service';
import type { GoogleConnection, GoogleLocation } from './google.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewStats {
  total: number;
  withReply: number;
  latestAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function connStateStyle(state: string): { dot: string; text: string; pill: string } {
  switch (state) {
    case 'CONNECTED':          return { dot: 'bg-emerald-500', text: 'text-emerald-600', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'ATTENTION_REQUIRED': return { dot: 'bg-amber-500',   text: 'text-amber-600',   pill: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'REFRESH_FAILED':     return { dot: 'bg-red-500',     text: 'text-red-600',     pill: 'bg-red-50 text-red-700 border-red-200' };
    case 'REVOKED':            return { dot: 'bg-red-500',     text: 'text-red-600',     pill: 'bg-red-50 text-red-700 border-red-200' };
    default:                   return { dot: 'bg-[#9CA3AF]',   text: 'text-[#6B7280]',   pill: 'bg-[#F9FAFB] text-[#6B7280] border-[#D1D5DB]' };
  }
}

// ─── Not Connected ─────────────────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[#111827] mb-1.5">Google not connected</h3>
      <p className="text-sm text-[#6B7280] max-w-sm">
        Connect your Google Business Profile in Settings to view profile health and status.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function GoogleProfilePage() {
  const { selectedId: globalLocationId } = useLocationStore();

  const [conn,    setConn]    = useState<GoogleConnection | null>(null);
  const [loc,     setLoc]     = useState<GoogleLocation | null>(null);
  const [stats,   setStats]   = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError('');
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

        const locations = locResult.data ?? [];
        const activeLoc = globalLocationId
          ? (locations.find(l => l.id === globalLocationId) ?? locations.find(l => l.is_selected) ?? null)
          : (locations.find(l => l.is_selected) ?? null);
        setLoc(activeLoc);

        const q = supabase
          .from('reviews')
          .select('id, reply_text, published_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('published_at', { ascending: false });
        if (activeLoc) q.eq('location_id', activeLoc.id);

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

  if (loading) {
    return (
      <div className="w-full">
        {/* header skeleton */}
        <div className="h-44 bg-[#111827] animate-pulse" />
        <div className="px-6 py-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-[#F3F4F6] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!conn) return <NotConnectedState />;

  void tick;

  const style        = connStateStyle(conn.state);
  const healthy      = conn.state === 'CONNECTED';
  const replyRate    = stats && stats.total > 0 ? Math.round((stats.withReply / stats.total) * 100) : 0;
  const freshnessHrs = stats?.latestAt ? (Date.now() - new Date(stats.latestAt).getTime()) / 3_600_000 : null;

  // ── derived health checks ──
  const checks: { label: string; ok: boolean; value: string; note: string }[] = [
    {
      label: 'Google Account',
      ok: healthy,
      value: healthy ? 'Connected' : conn.state.replace(/_/g, ' '),
      note: conn.google_email ?? 'No email on record',
    },
    {
      label: 'Response Rate',
      ok: replyRate >= 60,
      value: stats ? `${stats.withReply} / ${stats.total} replied` : 'No reviews',
      note: `${replyRate}% of reviews have a reply`,
    },
    {
      label: 'Review Freshness',
      ok: freshnessHrs != null && freshnessHrs < 48,
      value: stats?.latestAt ? timeAgo(stats.latestAt) : 'No reviews yet',
      note: stats?.latestAt ? `Most recent: ${fmtDateTime(stats.latestAt)}` : '',
    },
    {
      label: 'Auto Sync',
      ok: conn.auto_sync_enabled,
      value: conn.auto_sync_enabled ? `Every ${conn.auto_sync_interval}` : 'Disabled',
      note: conn.auto_sync_enabled
        ? 'Profile syncs automatically'
        : 'Enable auto sync in Settings',
    },
  ];

  const profileFields: { label: string; value: string | null; icon: React.ReactNode }[] = [
    {
      label: 'Address',
      value: loc?.address ?? null,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
    },
    {
      label: 'Website',
      value: null,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
        </svg>
      ),
    },
    {
      label: 'Phone',
      value: null,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
      ),
    },
    {
      label: 'Business Type',
      value: loc?.description ?? null,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full pb-8">

      {/* ── Profile Header ── */}
      <div className="relative bg-[#0f1117] overflow-hidden">
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* purple glow top-right */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-[#6C55E8] opacity-10 blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-8 pb-7">
          {/* Top row: avatar + name + health badge */}
          <div className="flex items-start gap-4">
            {/* Google G avatar */}
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg viewBox="0 0 48 48" className="w-9 h-9">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white truncate">
                  {loc?.display_name ?? 'Google Business Profile'}
                </h1>
                {/* health badge */}
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                  healthy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-red-400'}`}/>
                  {healthy ? 'Healthy' : 'Issue Detected'}
                </span>
              </div>
              {loc?.address && (
                <p className="text-sm text-white/50 truncate">{loc.address}</p>
              )}
            </div>
          </div>

          {/* ── Stat strip ── */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 border border-white/10 rounded-xl overflow-hidden">
            {/* Connection */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-1">Status</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}/>
                <span className="text-sm font-semibold text-white">
                  {conn.state === 'CONNECTED' ? 'Connected' : conn.state.replace(/_/g, ' ')}
                </span>
              </div>
              {conn.google_email && (
                <p className="text-[11px] text-white/35 truncate mt-0.5">{conn.google_email}</p>
              )}
            </div>

            {/* Last sync */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-1">Last Sync</p>
              <p className="text-sm font-semibold text-white leading-tight">
                {conn.last_synced_at ? fmtDateTime(conn.last_synced_at) : 'Never'}
              </p>
              {conn.last_synced_at && (
                <p className="text-[11px] text-white/35 mt-0.5">{timeAgo(conn.last_synced_at)}</p>
              )}
            </div>

            {/* Connected since */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-1">Connected</p>
              <p className="text-sm font-semibold text-white leading-tight">
                {conn.connected_at ? fmtDateTime(conn.connected_at) : 'Unknown'}
              </p>
              {conn.connected_at && (
                <p className="text-[11px] text-white/35 mt-0.5">{timeAgo(conn.connected_at)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 pt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left col: profile details ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile info block */}
          <div>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Profile Details</p>
            <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#F3F4F6]">
              {profileFields.map(f => (
                <div key={f.label} className="flex items-start gap-3 px-4 py-3.5 bg-white">
                  <span className="text-[#9CA3AF] mt-0.5 flex-shrink-0">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#9CA3AF] mb-0.5">{f.label}</p>
                    {f.value ? (
                      <p className="text-sm font-medium text-[#111827] leading-snug">{f.value}</p>
                    ) : (
                      <p className="text-sm text-[#D1D5DB] italic">Not synced</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 mt-1">
                    {f.value ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <span className="w-4 h-4 flex items-center justify-center">
                        <span className="w-3 h-px bg-[#D1D5DB] block"/>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All fields scored */}
          <div className="border border-[#E5E7EB] rounded-2xl bg-white px-4 py-4">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Profile Score</p>
            {(() => {
              const total  = profileFields.length;
              const filled = profileFields.filter(f => f.value).length;
              const pct    = Math.round((filled / total) * 100);
              return (
                <>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold text-[#111827]">{pct}%</span>
                    <span className="text-xs text-[#9CA3AF] mb-1">{filled} of {total} fields synced</span>
                  </div>
                  <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-2">
                    {pct === 100 ? 'All scored fields present.' : 'Some fields not synced from Google yet.'}
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Right col: health checks + review stats ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Profile Health Breakdown */}
          <div>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Profile Health Breakdown</p>
            <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#F3F4F6]">
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-4 px-4 py-4 bg-white">
                  {/* status dot */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    c.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {c.ok ? (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    )}
                  </div>

                  {/* label + note */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{c.label}</p>
                    {c.note && <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{c.note}</p>}
                  </div>

                  {/* value */}
                  <span className={`text-xs font-semibold flex-shrink-0 ${c.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Review Response Stats */}
          <div>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">Review Responses</p>
            <div className="border border-[#E5E7EB] rounded-2xl bg-white overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-[#F3F4F6] px-0">
                {[
                  { label: 'Total Reviews', value: stats?.total ?? 0, sub: 'all time' },
                  { label: 'Replied',       value: stats?.withReply ?? 0, sub: 'with response' },
                  { label: 'Response Rate', value: `${replyRate}%`, sub: 'coverage' },
                ].map(item => (
                  <div key={item.label} className="px-5 py-4 text-center">
                    <p className="text-2xl font-bold text-[#111827]">{item.value}</p>
                    <p className="text-[11px] font-medium text-[#374151] mt-0.5">{item.label}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{item.sub}</p>
                  </div>
                ))}
              </div>
              {/* progress bar */}
              <div className="px-5 pb-4">
                <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      replyRate >= 80 ? 'bg-emerald-500' : replyRate >= 40 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${stats && stats.total > 0 ? replyRate : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
