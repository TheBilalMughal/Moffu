import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetupStatus {
  googleConnected: boolean;
  locationSelected: boolean;
  brandBrainDone: boolean;
  firstReplyDone: boolean;
  loading: boolean;
}

interface ReviewRow {
  id: string;
  rating: number | null;
  status: string;
  published_at: string | null;
  body: string | null;
  reviewer_name: string | null;
}

interface DashboardData {
  total: number;
  avgRating: number | null;
  pending: number;
  replied: number;
  replyRate: number;
  ratingBreakdown: number[];   // index 0 = 1★ … index 4 = 5★
  trend: { date: string; count: number }[];
  recent: ReviewRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greet(name: string | undefined) {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${prefix}${name ? `, ${name.split(' ')[0]}` : ''}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stars(n: number | null) {
  if (n == null) return '—';
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
}

// ─── Setup Guide ──────────────────────────────────────────────────────────────

const DISMISS_KEY = 'moffu_setup_dismissed_v2';

const STEPS = [
  {
    key: 'googleConnected' as const,
    label: 'Connect Google Business Profile',
    description: 'Link your account to start syncing reviews.',
    href: '/settings',
    linkLabel: 'Go to Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
    ),
  },
  {
    key: 'locationSelected' as const,
    label: 'Select a location to manage',
    description: "Choose which location's reviews to track.",
    href: '/settings',
    linkLabel: 'Go to Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
      </svg>
    ),
  },
  {
    key: 'brandBrainDone' as const,
    label: 'Set up your Brand Brain',
    description: 'Train Moffu on your tone, language and reply rules.',
    href: '/brand-brain',
    linkLabel: 'Set up Brand Brain',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
      </svg>
    ),
  },
  {
    key: 'firstReplyDone' as const,
    label: 'Reply to your first review',
    description: 'Generate an AI draft and publish your first response.',
    href: '/reviews',
    linkLabel: 'Go to Reviews',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
      </svg>
    ),
  },
];

function SetupGuide({ status }: { status: SetupStatus }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const completed = STEPS.filter(s => status[s.key]).length;
  const allDone = completed === STEPS.length;

  if (dismissed || allDone) return null;

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#0D4C3C]/15 bg-white/70 backdrop-blur-md shadow-lg shadow-[#0D4C3C]/5 mb-6">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/4 via-transparent to-transparent pointer-events-none" />

      <div className="relative px-5 py-4 border-b border-[#E5EAE8]/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#111827]">Get started</span>
          <span className="text-xs text-[#6B7280]">{completed} of {STEPS.length} complete</span>
          <div className="w-28 h-1.5 bg-[#E5EAE8] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0D4C3C] to-[#1a6b55] rounded-full transition-all duration-700"
              style={{ width: `${(completed / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        <button onClick={handleDismiss} className="text-[#9CA3AF] hover:text-[#374151] transition-colors p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E5EAE8]/60">
        {STEPS.map((step, idx) => {
          const done = status[step.key];
          const isNext = !done && STEPS.slice(0, idx).every(s => status[s.key]);
          return (
            <div key={step.key} className={`px-5 py-4 ${done ? 'opacity-50' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${
                done ? 'bg-[#0D4C3C]' : isNext ? 'bg-[#0D4C3C]/10 text-[#0D4C3C]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
              }`}>
                {done ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={done ? 'text-white' : isNext ? 'text-[#0D4C3C]' : 'text-[#9CA3AF]'}>
                    {step.icon}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold mb-0.5 ${done ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'}`}>
                {step.label}
              </p>
              {!done && <p className="text-[11px] text-[#9CA3AF] mb-2 leading-relaxed">{step.description}</p>}
              {!done && (
                <Link to={step.href} className={`text-[11px] font-semibold ${isNext ? 'text-[#0D4C3C]' : 'text-[#9CA3AF]'} hover:underline`}>
                  {step.linkLabel} →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({
  label, value, sub, trend, icon, accent = false, urgent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label: string };
  icon: React.ReactNode;
  accent?: boolean;
  urgent?: boolean;
}) {
  return (
    <GlassCard>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/8 via-transparent to-[#0D4C3C]/3 pointer-events-none" />}
      {urgent && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent pointer-events-none" />}
      <div className="relative px-5 py-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            accent ? 'bg-[#0D4C3C]/10 text-[#0D4C3C]' : urgent ? 'bg-amber-100 text-amber-600' : 'bg-[#F3F4F6] text-[#6B7280]'
          }`}>
            {icon}
          </div>
          {trend && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
              trend.value >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
            }`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-[#111827] leading-none mb-1">{value}</p>
        {sub && <p className="text-[11px] text-[#9CA3AF]">{sub}</p>}
      </div>
    </GlassCard>
  );
}

// ─── Rating Distribution Chart ────────────────────────────────────────────────

function RatingChart({ breakdown }: { breakdown: number[] }) {
  const max = Math.max(...breakdown, 1);
  const COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
  return (
    <div className="space-y-2.5">
      {[4, 3, 2, 1, 0].map(i => {
        const pct = Math.round((breakdown[i]! / max) * 100);
        const star = i + 1;
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-[#6B7280] w-5 text-right flex-shrink-0">{star}★</span>
            <div className="flex-1 h-5 bg-[#F3F4F6] rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: COLORS[i] }}
              />
            </div>
            <span className="text-[11px] font-semibold text-[#374151] w-5 flex-shrink-0">{breakdown[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trend Bar Chart ──────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: { date: string; count: number }[] }) {
  const last14 = trend.slice(-14);
  const max = Math.max(...last14.map(d => d.count), 1);
  const hasData = last14.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-20 flex items-center justify-center">
        <p className="text-xs text-[#9CA3AF]">No reviews in the last 14 days</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1 h-16">
        {last14.map(day => {
          const pct = Math.round((day.count / max) * 100);
          return (
            <div key={day.date} className="flex-1 flex flex-col justify-end h-full" title={`${day.date}: ${day.count}`}>
              <div
                className="w-full bg-gradient-to-t from-[#0D4C3C] to-[#1a6b55] rounded-t-md transition-all"
                style={{ height: day.count > 0 ? `${Math.max(pct, 8)}%` : '2px', opacity: day.count > 0 ? 1 : 0.2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {last14.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % 3 === 0 && (
              <span className="text-[9px] text-[#D1D5DB]">
                {new Date(day.date + 'T12:00:00').getDate()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Reviews ───────────────────────────────────────────────────────────

function RatingStars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-[#9CA3AF] text-xs">—</span>;
  return (
    <span className="text-xs font-medium text-amber-500">
      {'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}
    </span>
  );
}

function RecentReviews({ reviews }: { reviews: ReviewRow[] }) {
  if (!reviews.length) return (
    <div className="flex items-center justify-center h-20">
      <p className="text-xs text-[#9CA3AF]">No reviews yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {reviews.map(r => (
        <div key={r.id} className="flex items-start gap-3 p-3 bg-[#F8FAF9]/60 rounded-xl">
          <div className="w-8 h-8 rounded-xl bg-[#0D4C3C]/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-[#0D4C3C]">
            {(r.reviewer_name ?? '?')[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[#111827] truncate">{r.reviewer_name ?? 'Anonymous'}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <RatingStars n={r.rating} />
                <span className="text-[10px] text-[#9CA3AF]">{fmtDate(r.published_at)}</span>
              </div>
            </div>
            {r.body && (
              <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed">{r.body}</p>
            )}
            <span className={`inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
              r.status === 'PUBLISHED'
                ? 'bg-emerald-50 text-emerald-600'
                : r.status === 'PENDING'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-[#F3F4F6] text-[#9CA3AF]'
            }`}>
              {r.status === 'PUBLISHED' ? 'Replied' : r.status === 'PENDING' ? 'Awaiting reply' : r.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty (not connected) state ──────────────────────────────────────────────

function EmptyState() {
  return (
    <GlassCard className="py-14 text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-[#0D4C3C]/10 text-[#0D4C3C] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#111827] mb-1">No reviews yet</h2>
        <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-5">
          Connect your Google Business Profile to start seeing and responding to reviews.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Connect Google
        </Link>
      </div>
    </GlassCard>
  );
}

// ─── OverviewPage ──────────────────────────────────────────────────────────────

export function OverviewPage() {
  const user = useAuthStore(s => s.user);

  const [setup, setSetup] = useState<SetupStatus>({
    googleConnected: false,
    locationSelected: false,
    brandBrainDone: false,
    firstReplyDone: false,
    loading: true,
  });
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const [connRes, locRes, brainRes, replyRes, reviewsRes] = await Promise.all([
        supabase.from('google_connections').select('id').eq('user_id', user!.id).eq('state', 'CONNECTED').limit(1),
        supabase.from('google_locations').select('id').eq('user_id', user!.id).eq('is_selected', true).limit(1),
        supabase.from('brand_brain').select('id').eq('user_id', user!.id).limit(1),
        supabase.from('reviews').select('id').eq('user_id', user!.id).eq('status', 'PUBLISHED').limit(1),
        supabase.from('reviews')
          .select('id, rating, status, published_at, body, reviewer_name')
          .eq('user_id', user!.id)
          .order('published_at', { ascending: false }),
      ]);

      const googleConnected = (connRes.data?.length ?? 0) > 0;

      setSetup({
        googleConnected,
        locationSelected: (locRes.data?.length   ?? 0) > 0,
        brandBrainDone:   (brainRes.data?.length ?? 0) > 0,
        firstReplyDone:   (replyRes.data?.length ?? 0) > 0,
        loading: false,
      });

      const rows = (reviewsRes.data ?? []) as ReviewRow[];
      if (rows.length > 0) {
        const total   = rows.length;
        const ratings = rows.map(r => r.rating).filter((r): r is number => r != null);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        const pending   = rows.filter(r => r.status === 'PENDING').length;
        const replied   = rows.filter(r => r.status === 'PUBLISHED').length;
        const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

        const breakdown = [0, 0, 0, 0, 0];
        for (const r of rows) {
          if (r.rating != null && r.rating >= 1 && r.rating <= 5) {
            breakdown[r.rating - 1]!++;
          }
        }

        // last 14 days
        const now = new Date();
        const trend: { date: string; count: number }[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const iso = d.toISOString().slice(0, 10);
          trend.push({ date: iso, count: 0 });
        }
        for (const r of rows) {
          const d = r.published_at?.slice(0, 10);
          if (!d) continue;
          const slot = trend.find(t => t.date === d);
          if (slot) slot.count++;
        }

        setDash({ total, avgRating, pending, replied, replyRate, ratingBreakdown: breakdown, trend, recent: rows.slice(0, 5) });
      }
      setLoadingDash(false);
    }

    load();
  }, [user]);

  const displayName = user?.user_metadata?.full_name ?? user?.email;

  return (
    <div className="relative min-h-full px-6 py-6">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#0D4C3C]/6 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-56 h-56 rounded-full bg-[#0D4C3C]/4 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">{greet(displayName)}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {dash && dash.pending > 0 && (
            <Link
              to="/reviews"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0D4C3C] to-[#1a6b55] rounded-xl shadow-md shadow-[#0D4C3C]/20 hover:shadow-lg transition-shadow"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
              </svg>
              {dash.pending} pending {dash.pending === 1 ? 'reply' : 'replies'}
            </Link>
          )}
        </div>
      </div>

      {/* Setup guide */}
      {!setup.loading && <SetupGuide status={setup} />}

      {/* Stat cards */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loadingDash ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/50 animate-pulse" />
          ))
        ) : dash ? (
          <>
            <StatCard
              label="Total Reviews"
              value={dash.total}
              sub={`${dash.total} synced`}
              accent
              icon={<svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>}
            />
            <StatCard
              label="Avg. Rating"
              value={dash.avgRating != null ? dash.avgRating.toFixed(1) : '—'}
              sub={dash.avgRating != null ? stars(dash.avgRating) : 'No ratings yet'}
              icon={<svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>}
            />
            <StatCard
              label="Reply Rate"
              value={`${dash.replyRate}%`}
              sub={`${dash.replied} of ${dash.total} replied`}
              accent={dash.replyRate >= 80}
              icon={<svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>}
            />
            <StatCard
              label="Pending Reply"
              value={dash.pending}
              sub={dash.pending > 0 ? 'Need attention' : 'All caught up!'}
              urgent={dash.pending > 0}
              icon={<svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
          </>
        ) : (
          <>
            {[
              { label: 'Total Reviews', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg> },
              { label: 'Avg. Rating', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg> },
              { label: 'Reply Rate', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg> },
              { label: 'Pending Reply', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            ].map(({ label, icon }) => (
              <StatCard key={label} label={label} value="—" sub="Connect Google to see data" icon={icon} />
            ))}
          </>
        )}
      </div>

      {/* Charts + recent */}
      {!loadingDash && !dash ? (
        <EmptyState />
      ) : !loadingDash && dash ? (
        <div className="relative grid grid-cols-3 gap-4 mb-4">
          {/* Rating distribution */}
          <GlassCard className="p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/3 via-transparent to-transparent pointer-events-none rounded-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Rating Breakdown</p>
              <RatingChart breakdown={dash.ratingBreakdown} />
            </div>
          </GlassCard>

          {/* Trend chart */}
          <GlassCard className="p-5">
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Reviews · Last 14 Days</p>
                <span className="text-xs font-bold text-[#111827]">{dash.trend.reduce((s, d) => s + d.count, 0)} total</span>
              </div>
              <TrendChart trend={dash.trend} />
            </div>
          </GlassCard>

          {/* Quick actions */}
          <GlassCard className="p-5">
            <div className="relative">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Quick Actions</p>
              <div className="space-y-2">
                {[
                  { to: '/reviews', label: 'View Reviews', icon: '★', desc: `${dash.pending > 0 ? `${dash.pending} pending` : 'All replied'}` },
                  { to: '/google-profile', label: 'Google Profile', icon: '↗', desc: 'Performance insights' },
                  { to: '/brand-brain', label: 'Brand Brain', icon: '✦', desc: setup.brandBrainDone ? 'Configured' : 'Not set up yet' },
                  { to: '/settings', label: 'Settings', icon: '⚙', desc: 'Manage integrations' },
                ].map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#0D4C3C]/5 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F3F4F6] group-hover:bg-[#0D4C3C]/10 flex items-center justify-center text-xs text-[#6B7280] group-hover:text-[#0D4C3C] transition-colors flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#374151] group-hover:text-[#0D4C3C] transition-colors">{item.label}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{item.desc}</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#0D4C3C] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {/* Recent reviews */}
      {!loadingDash && dash && (
        <div className="relative grid grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Recent Reviews</p>
                <Link to="/reviews" className="text-[11px] font-semibold text-[#0D4C3C] hover:underline">View all →</Link>
              </div>
              <RecentReviews reviews={dash.recent} />
            </div>
          </GlassCard>

          {/* Reply rate ring + summary */}
          <GlassCard className="p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/5 via-transparent to-transparent pointer-events-none rounded-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Reply Performance</p>
              <div className="flex items-center gap-6">
                {/* SVG ring */}
                <div className="flex-shrink-0">
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#E5EAE8" strokeWidth="8"/>
                    <circle
                      cx="40" cy="40" r="32" fill="none"
                      stroke="url(#ringGrad)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - dash.replyRate / 100)}`}
                      transform="rotate(-90 40 40)"
                    />
                    <defs>
                      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0D4C3C"/>
                        <stop offset="100%" stopColor="#1a6b55"/>
                      </linearGradient>
                    </defs>
                    <text x="40" y="44" textAnchor="middle" className="text-[13px] font-bold fill-[#111827]" fontSize="13" fontWeight="700" fill="#111827">
                      {dash.replyRate}%
                    </text>
                  </svg>
                </div>
                <div className="flex-1 space-y-3">
                  {[
                    { label: 'Total reviews', value: dash.total, color: 'bg-[#0D4C3C]' },
                    { label: 'Replied', value: dash.replied, color: 'bg-emerald-500' },
                    { label: 'Pending', value: dash.pending, color: dash.pending > 0 ? 'bg-amber-400' : 'bg-[#E5EAE8]' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${row.color}`} />
                        <span className="text-xs text-[#6B7280]">{row.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#111827]">{row.value}</span>
                    </div>
                  ))}
                  {dash.avgRating != null && (
                    <div className="pt-2 border-t border-[#F3F4F6]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280]">Avg. rating</span>
                        <span className="text-xs font-bold text-amber-500">{dash.avgRating.toFixed(1)} ★</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
