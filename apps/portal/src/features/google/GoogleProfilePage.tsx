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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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

function connectionLabel(state: string): { label: string; dot: string; badge: string } {
  switch (state) {
    case 'CONNECTED':          return { label: 'Connected',         dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'ATTENTION_REQUIRED': return { label: 'Attention Required', dot: 'bg-amber-500',   badge: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'REFRESH_FAILED':     return { label: 'Refresh Failed',    dot: 'bg-red-500',     badge: 'text-red-700 bg-red-50 border-red-200' };
    case 'REVOKED':            return { label: 'Revoked',           dot: 'bg-red-500',     badge: 'text-red-700 bg-red-50 border-red-200' };
    case 'DISCONNECTED':       return { label: 'Disconnected',      dot: 'bg-[#9CA3AF]',   badge: 'text-[#6B7280] bg-[#F9FAFB] border-[#D1D5DB]' };
    default:                   return { label: state,               dot: 'bg-[#9CA3AF]',   badge: 'text-[#6B7280] bg-[#F9FAFB] border-[#D1D5DB]' };
  }
}

function isHealthy(conn: GoogleConnection | null): boolean {
  return conn?.state === 'CONNECTED';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ healthy }: { healthy: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg border ${
      healthy
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : 'text-red-700 bg-red-50 border-red-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthy ? 'bg-emerald-500' : 'bg-red-500'}`}/>
      {healthy ? 'Healthy' : 'Issue'}
    </span>
  );
}

function InfoRow({
  label,
  value,
  present,
  icon,
}: {
  label: string;
  value: string | null;
  present: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-0.5">{label}</p>
        {present && value ? (
          <p className="text-sm text-[#111827] leading-snug">{value}</p>
        ) : (
          <p className="text-sm text-[#D1D5DB] italic">Not synced</p>
        )}
      </div>
      <div className="flex-shrink-0 mt-1">
        {present ? (
          <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
            <svg className="w-3 h-3 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCheckRow({
  label,
  value,
  status,
  note,
}: {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'error';
  note?: string;
}) {
  const colors = {
    ok:    { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', value: 'text-emerald-700' },
    warn:  { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   value: 'text-amber-700' },
    error: { bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-600',     value: 'text-red-700' },
  }[status];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className={`w-7 h-7 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
        {status === 'ok' ? (
          <svg className={`w-3.5 h-3.5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        ) : (
          <svg className={`w-3.5 h-3.5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#374151] font-medium">{label}</p>
        {note && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{note}</p>}
      </div>
      <span className={`text-xs font-semibold ${colors.value}`}>{value}</span>
    </div>
  );
}

// ─── Not Connected ─────────────────────────────────────────────────────────────

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-[#111827] mb-1">Google not connected</h3>
      <p className="text-xs text-[#6B7280] max-w-xs">
        Connect your Google Business Profile in Settings to view profile health and status.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function GoogleProfilePage() {
  const { selectedId: globalLocationId } = useLocationStore();

  const [conn, setConn]   = useState<GoogleConnection | null>(null);
  const [loc, setLoc]     = useState<GoogleLocation | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick]   = useState(0);

  // Refresh relative timestamps every minute
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

        const connection = connResult.data ?? null;
        setConn(connection);

        // Active / selected location
        const locations = locResult.data ?? [];
        const activeLoc = globalLocationId
          ? locations.find(l => l.id === globalLocationId) ?? locations.find(l => l.is_selected) ?? null
          : locations.find(l => l.is_selected) ?? null;
        setLoc(activeLoc);

        // Review stats for selected location (or all)
        const reviewQuery = supabase
          .from('reviews')
          .select('id, reply_text, published_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('published_at', { ascending: false });

        if (activeLoc) reviewQuery.eq('location_id', activeLoc.id);

        const { data: reviews, count } = await reviewQuery;
        if (!alive) return;

        const withReply = (reviews ?? []).filter((r: { reply_text?: string | null }) => r.reply_text && r.reply_text.trim()).length;
        const latestAt  = (reviews ?? [])[0]?.published_at ?? null;

        setStats({ total: count ?? 0, withReply, latestAt });
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
      <div className="w-full px-6 py-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-[#E5E7EB] animate-pulse"/>
        ))}
      </div>
    );
  }

  if (!conn) return <NotConnectedState />;

  const healthy     = isHealthy(conn);
  const connInfo    = connectionLabel(conn.state);
  const replyRate   = stats && stats.total > 0 ? Math.round((stats.withReply / stats.total) * 100) : 0;
  const replyStatus = replyRate >= 80 ? 'ok' : replyRate >= 40 ? 'warn' : 'error';
  const freshness   = stats?.latestAt ?? null;
  const freshnessHrs = freshness ? (Date.now() - new Date(freshness).getTime()) / 3_600_000 : null;
  const freshnessStatus: 'ok' | 'warn' | 'error' = freshnessHrs == null ? 'warn' : freshnessHrs < 48 ? 'ok' : freshnessHrs < 168 ? 'warn' : 'error';

  void tick; // force re-render for relative times

  return (
    <div className="w-full px-6 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Google Profile</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {loc?.display_name ?? 'Business profile health and status'}
          </p>
        </div>
        <StatusBadge healthy={healthy} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {/* ── 3 stat tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Connection Status */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Connection Status</p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connInfo.dot}`}/>
            <span className="text-sm font-bold text-[#111827]">{connInfo.label}</span>
          </div>
          {conn.google_email && (
            <p className="text-xs text-[#6B7280] truncate">{conn.google_email}</p>
          )}
          <span className={`inline-flex items-center mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${connInfo.badge}`}>
            {conn.state}
          </span>
        </div>

        {/* Last Successful Sync */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Last Successful Sync</p>
          <p className="text-sm font-bold text-[#111827] leading-snug mb-1">
            {conn.last_synced_at ? fmtDateTime(conn.last_synced_at) : 'Never synced'}
          </p>
          {conn.last_synced_at && (
            <p className="text-xs text-[#9CA3AF]">{timeAgo(conn.last_synced_at)}</p>
          )}
        </div>

        {/* Review Responses */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Review Responses</p>
          {stats ? (
            <>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-2xl font-bold text-[#111827]">{stats.withReply}</span>
                <span className="text-sm text-[#9CA3AF] mb-0.5">/ {stats.total}</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden mb-1">
                <div
                  className={`h-1.5 rounded-full ${replyRate >= 80 ? 'bg-emerald-500' : replyRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${stats.total > 0 ? replyRate : 0}%` }}
                />
              </div>
              <p className="text-xs text-[#9CA3AF]">{replyRate}% response rate</p>
            </>
          ) : (
            <p className="text-sm text-[#9CA3AF]">No data</p>
          )}
        </div>

      </div>

      {/* ── Bottom two cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Profile Health Breakdown */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[#111827]">Profile Health Breakdown</p>
            <StatusBadge healthy={healthy} />
          </div>

          <HealthCheckRow
            label="Google Account"
            value={conn.state === 'CONNECTED' ? 'Connected' : conn.state}
            status={conn.state === 'CONNECTED' ? 'ok' : 'error'}
            {...(conn.google_email ? { note: conn.google_email } : {})}
          />

  <HealthCheckRow
            label="Review Responses"
            value={stats ? `${stats.withReply} of ${stats.total}` : '—'}
            status={replyStatus}
            {...(stats ? { note: `${replyRate}% response rate` } : {})}
          />

          <HealthCheckRow
            label="Review Freshness"
            value={freshness ? timeAgo(freshness) : 'No reviews'}
            status={freshnessStatus}
            {...(freshness ? { note: `Most recent: ${fmtDateTime(freshness)}` } : { note: 'No reviews in this period' })}
          />

          <HealthCheckRow
            label="Auto Sync"
            value={conn.auto_sync_enabled ? `Every ${conn.auto_sync_interval}` : 'Disabled'}
            status={conn.auto_sync_enabled ? 'ok' : 'warn'}
            note={conn.auto_sync_enabled ? 'Automatic data sync is active' : 'Enable in Settings for automatic updates'}
          />
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#111827] mb-4">Profile Information</p>

          <InfoRow
            label="Business Name"
            value={loc?.display_name ?? null}
            present={!!(loc?.display_name)}
            icon={
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            }
          />

          <InfoRow
            label="Address"
            value={loc?.address ?? null}
            present={!!(loc?.address)}
            icon={
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            }
          />

          <InfoRow
            label="Website"
            value={null}
            present={false}
            icon={
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
              </svg>
            }
          />

          <InfoRow
            label="Contact Number"
            value={null}
            present={false}
            icon={
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
            }
          />

          <InfoRow
            label="Business Type"
            value={loc?.description ?? null}
            present={!!(loc?.description)}
            icon={
              <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
              </svg>
            }
          />

          {/* Connected date */}
          <div className="pt-3 mt-1 border-t border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Connected</span>
            </div>
            <p className="text-sm font-medium text-[#374151] mt-1 ml-5">
              {conn.connected_at ? fmtDateTime(conn.connected_at) : 'Unknown'}
            </p>
            {conn.connected_at && (
              <p className="text-xs text-[#9CA3AF] mt-0.5 ml-5">{timeAgo(conn.connected_at)}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
