import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useLocationStore } from '@/features/location/location.store';
import { billingService } from '@/features/billing/billing.service';
import type { Plan, Subscription } from '@/features/billing/billing.service';

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
  location_id: string | null;
}

interface DashboardData {
  total: number;
  avgRating: number | null;
  pending: number;
  replied: number;
  replyRate: number;
  ratingBreakdown: number[];
  trend: { date: string; count: number }[];
  recent: ReviewRow[];
  trendTotal: number | null;
  trendAvgRating: number | null;
  trendReplyRate: number | null;
  oldestPendingDays: number | null;
  pendingRows: ReviewRow[];
  thisWeekCount: number;
  lastWeekCount: number;
  thisWeekReplied: number;
  thisWeekTotal: number;
  activityItems: ReviewRow[];
}

interface CampaignStats {
  total: number;
  sent: number;
  totalSent: number;
  totalOpened: number;
}

interface InsightsSummary {
  impressions: number;
  direction_requests: number;
  call_clicks: number;
  website_clicks: number;
  trend: { date: string; impressions: number }[];
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

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function stars(n: number | null) {
  if (n == null) return '—';
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function computeSentiment(breakdown: number[]) {
  const pos   = (breakdown[3] ?? 0) + (breakdown[4] ?? 0);
  const neu   = breakdown[2] ?? 0;
  const neg   = (breakdown[0] ?? 0) + (breakdown[1] ?? 0);
  const total = pos + neu + neg;
  return {
    positive: pos, neutral: neu, negative: neg, total,
    positivePct: total > 0 ? Math.round((pos / total) * 100) : 0,
    neutralPct:  total > 0 ? Math.round((neu / total) * 100) : 0,
    negativePct: total > 0 ? Math.round((neg / total) * 100) : 0,
  };
}

function getNextPlanHighlights(plan: Plan): string[] {
  const locs    = plan.entitlements['locations']?.limit_value;
  const drafts  = plan.entitlements['ai_drafts']?.limit_value;
  const repEnt  = plan.entitlements['published_replies'];
  const members = plan.entitlements['team_members']?.limit_value;
  const h: string[] = [];
  if (locs    != null) h.push(`${locs} location${locs > 1 ? 's' : ''}`);
  if (drafts  != null) h.push(`${drafts.toLocaleString()} AI drafts / month`);
  if (repEnt?.value_type === 'UNLIMITED') h.push('Unlimited published replies');
  else if (repEnt?.limit_value != null) h.push(`${repEnt.limit_value.toLocaleString()} replies / month`);
  if (members != null && members > 1) h.push(`${members} team members`);
  return h.slice(0, 3);
}

function computeDash(rows: ReviewRow[]): DashboardData | null {
  if (rows.length === 0) return null;

  const total     = rows.length;
  const ratings   = rows.map(r => r.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const pending   = rows.filter(r => r.status === 'PENDING').length;
  const replied   = rows.filter(r => r.status === 'PUBLISHED').length;
  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

  const breakdown = [0, 0, 0, 0, 0];
  for (const r of rows) {
    if (r.rating != null && r.rating >= 1 && r.rating <= 5) breakdown[r.rating - 1]!++;
  }

  const now = new Date();
  const trend: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    trend.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const r of rows) {
    const d = r.published_at?.slice(0, 10);
    if (!d) continue;
    const slot = trend.find(t => t.date === d);
    if (slot) slot.count++;
  }

  const now30 = Date.now();
  const ms30  = 30 * 86400000;
  const rowsLast30 = rows.filter(r => r.published_at && now30 - new Date(r.published_at).getTime() <= ms30);
  const rowsPrev30 = rows.filter(r => {
    if (!r.published_at) return false;
    const age = now30 - new Date(r.published_at).getTime();
    return age > ms30 && age <= ms30 * 2;
  });

  const last30Ratings  = rowsLast30.map(r => r.rating).filter((r): r is number => r != null);
  const prev30Ratings  = rowsPrev30.map(r => r.rating).filter((r): r is number => r != null);
  const last30Avg      = last30Ratings.length > 0 ? last30Ratings.reduce((a, b) => a + b, 0) / last30Ratings.length : null;
  const prev30Avg      = prev30Ratings.length > 0 ? prev30Ratings.reduce((a, b) => a + b, 0) / prev30Ratings.length : null;
  const last30Replied  = rowsLast30.filter(r => r.status === 'PUBLISHED').length;
  const prev30Replied  = rowsPrev30.filter(r => r.status === 'PUBLISHED').length;
  const last30Rate     = rowsLast30.length > 0 ? Math.round((last30Replied / rowsLast30.length) * 100) : 0;
  const prev30Rate     = rowsPrev30.length > 0 ? Math.round((prev30Replied / rowsPrev30.length) * 100) : 0;

  const trendTotal     = pctChange(rowsLast30.length, rowsPrev30.length);
  const trendAvgRating = last30Avg != null && prev30Avg != null
    ? pctChange(Math.round(last30Avg * 10), Math.round(prev30Avg * 10)) : null;
  const trendReplyRate = pctChange(last30Rate, prev30Rate);

  const pendingRows       = rows.filter(r => r.status === 'PENDING');
  const oldestPending     = pendingRows[pendingRows.length - 1];
  const oldestPendingDays = oldestPending?.published_at ? daysSince(oldestPending.published_at) : null;

  const todayDate      = new Date();
  const dayOfWeek      = todayDate.getDay();
  const startOfWeek    = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);

  const thisWeekRows  = rows.filter(r => r.published_at && new Date(r.published_at) >= startOfWeek);
  const lastWeekRows  = rows.filter(r => {
    if (!r.published_at) return false;
    const d = new Date(r.published_at);
    return d >= startOfLastWeek && d < startOfWeek;
  });

  const twoWeeksAgo   = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  return {
    total, avgRating, pending, replied, replyRate,
    ratingBreakdown: breakdown, trend,
    recent: rows.slice(0, 5),
    trendTotal, trendAvgRating, trendReplyRate,
    oldestPendingDays, pendingRows: pendingRows.slice(0, 3),
    thisWeekCount:   thisWeekRows.length,
    lastWeekCount:   lastWeekRows.length,
    thisWeekTotal:   thisWeekRows.length,
    thisWeekReplied: thisWeekRows.filter(r => r.status === 'PUBLISHED').length,
    activityItems:   rows.filter(r => r.published_at && new Date(r.published_at) >= twoWeeksAgo).slice(0, 8),
  };
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
    <div className="relative overflow-hidden rounded-2xl border border-[#6C55E8]/15 bg-white/70 backdrop-blur-md shadow-lg shadow-[#6C55E8]/5 mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/4 via-transparent to-transparent pointer-events-none" />
      <div className="relative px-5 py-4 border-b border-[#E5E7EB]/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#111827]">Get started</span>
          <span className="text-xs text-[#6B7280]">{completed} of {STEPS.length} complete</span>
          <div className="w-28 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6C55E8] to-[#1a6b55] rounded-full transition-all duration-700"
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
      <div className="relative grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E5E7EB]/60">
        {STEPS.map((step, idx) => {
          const done = status[step.key];
          const isNext = !done && STEPS.slice(0, idx).every(s => status[s.key]);
          return (
            <div key={step.key} className={`px-5 py-4 ${done ? 'opacity-50' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${
                done ? 'bg-[#111827]' : isNext ? 'bg-[#111827]/10 text-[#6C55E8]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
              }`}>
                {done ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={done ? 'text-white' : isNext ? 'text-[#6C55E8]' : 'text-[#9CA3AF]'}>
                    {step.icon}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold mb-0.5 ${done ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'}`}>
                {step.label}
              </p>
              {!done && <p className="text-[11px] text-[#9CA3AF] mb-2 leading-relaxed">{step.description}</p>}
              {!done && (
                <Link to={step.href} className={`text-[11px] font-semibold ${isNext ? 'text-[#6C55E8]' : 'text-[#9CA3AF]'} hover:underline`}>
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

// ─── Weekly Highlight Banner ──────────────────────────────────────────────────

function WeeklyHighlight({ dash }: { dash: DashboardData }) {
  const oldestPendingUrgent = dash.oldestPendingDays != null && dash.oldestPendingDays >= 3;
  const perfectWeek = dash.thisWeekTotal > 0 && dash.thisWeekReplied === dash.thisWeekTotal;
  const weekGrowth = dash.thisWeekCount > 0 && dash.lastWeekCount > 0 && dash.thisWeekCount > dash.lastWeekCount;

  if (!oldestPendingUrgent && !perfectWeek && !weekGrowth) return null;

  type Variant = { dot: string; label: string; msg: string; sub: string; cta?: React.ReactNode };
  let v: Variant;

  if (oldestPendingUrgent) {
    v = {
      dot: 'bg-amber-400',
      label: 'Action needed',
      msg: `${dash.pending} review${dash.pending !== 1 ? 's' : ''} waiting for a reply`,
      sub: `Oldest is ${dash.oldestPendingDays} days old`,
      cta: <Link to="/reviews" className="text-[11px] font-semibold text-[#6C55E8] hover:underline whitespace-nowrap">Reply now →</Link>,
    };
  } else if (perfectWeek) {
    v = {
      dot: 'bg-emerald-400',
      label: 'This week',
      msg: `All ${dash.thisWeekTotal} review${dash.thisWeekTotal !== 1 ? 's' : ''} replied`,
      sub: 'Perfect reply rate — keep it going',
    };
  } else {
    const diff = dash.thisWeekCount - dash.lastWeekCount;
    v = {
      dot: 'bg-[#111827]',
      label: 'This week',
      msg: `${dash.thisWeekCount} reviews — ${diff} more than last week`,
      sub: 'Visibility is improving',
    };
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] mb-5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.dot}`} />
      <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide flex-shrink-0">{v.label}</span>
      <span className="w-px h-3 bg-[#E5E7EB] flex-shrink-0" />
      <span className="text-xs font-semibold text-[#111827]">{v.msg}</span>
      <span className="text-[11px] text-[#9CA3AF] hidden sm:inline">{v.sub}</span>
      {v.cta && <span className="ml-auto">{v.cta}</span>}
    </div>
  );
}

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trend, icon, accent = false, urgent = false,
}: {
  label: string; value: string | number; sub?: string;
  trend?: { value: number; label: string } | null;
  icon: React.ReactNode; accent?: boolean; urgent?: boolean;
}) {
  return (
    <GlassCard>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/8 via-transparent to-[#6C55E8]/3 pointer-events-none" />}
      {urgent && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent pointer-events-none" />}
      <div className="relative px-5 py-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            accent ? 'bg-[#111827]/10 text-[#6C55E8]' : urgent ? 'bg-amber-100 text-amber-600' : 'bg-[#F3F4F6] text-[#6B7280]'
          }`}>{icon}</div>
          {trend != null && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
              trend.value > 0 ? 'bg-emerald-50 text-emerald-600' : trend.value < 0 ? 'bg-red-50 text-red-500' : 'bg-[#F3F4F6] text-[#9CA3AF]'
            }`}>
              {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '—'} {trend.value !== 0 ? `${Math.abs(trend.value)}%` : 'same'}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-[#111827] leading-none mb-1">{value}</p>
        {sub && <p className="text-[11px] text-[#9CA3AF]">{sub}</p>}
        {trend != null && <p className="text-[10px] text-[#D1D5DB] mt-0.5">{trend.label}</p>}
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
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-[#6B7280] w-5 text-right flex-shrink-0">{i + 1}★</span>
            <div className="flex-1 h-5 bg-[#F3F4F6] rounded-lg overflow-hidden">
              <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: COLORS[i] }} />
            </div>
            <span className="text-[11px] font-semibold text-[#374151] w-5 flex-shrink-0">{breakdown[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sentiment Card ───────────────────────────────────────────────────────────

function SentimentCard({ breakdown }: { breakdown: number[] }) {
  const s = computeSentiment(breakdown);

  const items = [
    {
      label: 'Positive',
      count: s.positive,
      pct: s.positivePct,
      color: '#22C55E',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      barBg: 'bg-emerald-400',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 10h.01M15 10h.01M8.5 14.5s1 2 3.5 2 3.5-2 3.5-2" />
        </svg>
      ),
    },
    {
      label: 'Neutral',
      count: s.neutral,
      pct: s.neutralPct,
      color: '#EAB308',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      barBg: 'bg-amber-400',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 10h.01M15 10h.01M8.5 15h7" />
        </svg>
      ),
    },
    {
      label: 'Negative',
      count: s.negative,
      pct: s.negativePct,
      color: '#EF4444',
      bg: 'bg-red-50',
      text: 'text-red-500',
      barBg: 'bg-red-400',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 10h.01M15 10h.01M8.5 16.5s1-2 3.5-2 3.5 2 3.5 2" />
        </svg>
      ),
    },
  ];

  return (
    <GlassCard className="p-5">
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Review Sentiment</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {items.map(item => (
          <div key={item.label} className="text-center">
            <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.text} flex items-center justify-center mx-auto mb-2`}>
              {item.icon}
            </div>
            <p className="text-lg font-bold text-[#111827] leading-none">{s.total > 0 ? `${item.pct}%` : '—'}</p>
            <p className="text-[10px] font-semibold text-[#374151] mt-0.5">{item.label}</p>
            <p className="text-[10px] text-[#9CA3AF]">{item.count} reviews</p>
          </div>
        ))}
      </div>

      {s.total > 0 ? (
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
          {items.map(item => item.pct > 0 && (
            <div key={item.label} className={`${item.barBg} transition-all`} style={{ width: `${item.pct}%` }} />
          ))}
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-[#F3F4F6]" />
      )}
    </GlassCard>
  );
}

// ─── Upgrade Card ─────────────────────────────────────────────────────────────

const PLAN_ORDER = ['free', 'starter', 'growth', 'scale'] as const;

function UpgradeCard({ sub, plans }: { sub: Subscription | null; plans: Plan[] }) {
  const currentSlug = sub?.plan_slug ?? 'free';
  const idx         = PLAN_ORDER.indexOf(currentSlug as typeof PLAN_ORDER[number]);
  const nextSlug    = PLAN_ORDER[idx + 1];
  const nextPlan    = nextSlug ? plans.find(p => p.slug === nextSlug) ?? null : null;
  const currentPlan = plans.find(p => p.slug === currentSlug) ?? null;

  if (!nextPlan) return null;

  const monthlyPrice = nextPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0;
  const highlights   = getNextPlanHighlights(nextPlan);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#111827]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/25 via-transparent to-[#6C55E8]/5 pointer-events-none" />
      <div className="relative p-5">

        {/* Plan trail */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold bg-white/10 text-white/50 px-2 py-0.5 rounded-lg">
            {currentPlan?.name ?? 'Free'}
          </span>
          <svg className="w-3.5 h-3.5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-[10px] font-semibold bg-[#6C55E8]/30 text-[#A89CFF] px-2 py-0.5 rounded-lg">
            {nextPlan.name}
          </span>
        </div>

        <p className="text-sm font-bold text-white mb-0.5">Ready for more?</p>
        <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
          Unlock more capacity and features with {nextPlan.name}.
        </p>

        {highlights.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {highlights.map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#6C55E8]/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-[#A89CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[11px] text-white/60">{f}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between">
          <div>
            {monthlyPrice > 0 ? (
              <>
                <p className="text-[10px] text-white/35">Starting at</p>
                <p className="text-xl font-black text-white leading-none">
                  ${(monthlyPrice / 100).toFixed(0)}
                  <span className="text-xs font-normal text-white/35">/mo</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-white/35">Contact us for pricing</p>
            )}
          </div>
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 bg-[#6C55E8] hover:bg-[#5A42D1] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            Upgrade →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Trend Bar Chart ──────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: { date: string; count: number }[] }) {
  const last14 = trend.slice(-14);
  const max = Math.max(...last14.map(d => d.count), 1);
  const hasData = last14.some(d => d.count > 0);

  if (!hasData) return (
    <div className="h-20 flex items-center justify-center">
      <p className="text-xs text-[#9CA3AF]">No reviews in the last 14 days</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-end gap-1 h-16">
        {last14.map(day => {
          const pct = Math.round((day.count / max) * 100);
          return (
            <div key={day.date} className="flex-1 flex flex-col justify-end h-full" title={`${day.date}: ${day.count}`}>
              <div
                className="w-full bg-[#6C55E8] rounded-t-md transition-all"
                style={{ height: day.count > 0 ? `${Math.max(pct, 8)}%` : '2px', opacity: day.count > 0 ? 1 : 0.2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {last14.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % 3 === 0 && <span className="text-[9px] text-[#D1D5DB]">{new Date(day.date + 'T12:00:00').getDate()}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Response Time Card ───────────────────────────────────────────────────────

function ResponseTimeCard({ dash }: { dash: DashboardData }) {
  const urgencyLevel =
    dash.oldestPendingDays == null ? 'none'
    : dash.oldestPendingDays >= 7 ? 'high'
    : dash.oldestPendingDays >= 3 ? 'medium'
    : 'low';

  const urgencyColor = {
    none:   'bg-emerald-50 text-emerald-600 border-emerald-200/40',
    low:    'bg-emerald-50 text-emerald-600 border-emerald-200/40',
    medium: 'bg-amber-50 text-amber-600 border-amber-200/40',
    high:   'bg-red-50 text-red-500 border-red-200/40',
  }[urgencyLevel];

  const urgencyLabel = { none: 'All caught up', low: 'Within target', medium: 'Needs attention', high: 'Overdue' }[urgencyLevel];
  const oldest3 = dash.pendingRows.slice(0, 3);

  return (
    <div className="relative">
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Response Urgency</p>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold mb-4 ${urgencyColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          urgencyLevel === 'none' || urgencyLevel === 'low' ? 'bg-emerald-500' :
          urgencyLevel === 'medium' ? 'bg-amber-500' : 'bg-red-500'
        }`} />
        {urgencyLabel}
      </div>
      {dash.pending === 0 ? (
        <p className="text-xs text-[#9CA3AF]">No pending reviews — great work!</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-[#111827]">{dash.pending}</span>
            <span className="text-xs text-[#9CA3AF]">pending</span>
          </div>
          {dash.oldestPendingDays != null && (
            <p className="text-[11px] text-[#9CA3AF] mb-4">Oldest: {dash.oldestPendingDays} day{dash.oldestPendingDays !== 1 ? 's' : ''} ago</p>
          )}
          {oldest3.length > 0 && (
            <div className="space-y-2">
              {oldest3.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-2 bg-[#F9FAFB]/60 rounded-xl">
                  <div className="w-6 h-6 rounded-lg bg-[#111827]/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#6C55E8]">
                    {(r.reviewer_name ?? '?')[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[#374151] truncate">{r.reviewer_name ?? 'Anonymous'}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{r.rating != null ? `${r.rating}★` : '—'} · {daysSince(r.published_at)}d waiting</p>
                  </div>
                  <Link to="/reviews" className="text-[10px] font-semibold text-[#6C55E8] hover:underline flex-shrink-0">Reply →</Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ items }: { items: ReviewRow[] }) {
  if (!items.length) return (
    <div className="flex items-center justify-center h-20">
      <p className="text-xs text-[#9CA3AF]">No activity in the last 14 days</p>
    </div>
  );

  return (
    <div className="space-y-2.5">
      {items.map(r => (
        <div key={r.id} className="flex items-start gap-2.5">
          <div className="flex flex-col items-center flex-shrink-0 mt-1">
            <div className={`w-2 h-2 rounded-full ${
              r.status === 'PUBLISHED' ? 'bg-emerald-500' : r.status === 'PENDING' ? 'bg-amber-400' : 'bg-[#D1D5DB]'
            }`} />
            <div className="w-px flex-1 bg-[#F3F4F6] mt-1" style={{ minHeight: 12 }} />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-[11px] text-[#374151] leading-snug">
              <span className="font-semibold">{r.reviewer_name ?? 'Anonymous'}</span>
              {' '}left a {r.rating != null ? `${r.rating}★` : ''} review
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium ${
                r.status === 'PUBLISHED' ? 'text-emerald-600' : r.status === 'PENDING' ? 'text-amber-600' : 'text-[#9CA3AF]'
              }`}>
                {r.status === 'PUBLISHED' ? 'Replied' : r.status === 'PENDING' ? 'Pending' : r.status}
              </span>
              <span className="text-[10px] text-[#D1D5DB]">·</span>
              <span className="text-[10px] text-[#9CA3AF]">{timeAgo(r.published_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Campaign Summary Card ────────────────────────────────────────────────────

function CampaignSummaryCard({ stats, loading }: { stats: CampaignStats | null; loading: boolean }) {
  const openRate = stats && stats.totalSent > 0 ? Math.round((stats.totalOpened / stats.totalSent) * 100) : null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Campaign Performance</p>
        <Link to="/campaigns" className="text-[11px] font-semibold text-[#6C55E8] hover:underline">View all →</Link>
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-8 rounded-xl bg-[#F3F4F6] animate-pulse" />)}</div>
      ) : !stats || stats.total === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-[#9CA3AF] mb-3">No campaigns yet</p>
          <Link to="/campaigns" className="text-[11px] font-semibold text-[#6C55E8] hover:underline">Create your first campaign →</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Campaigns', value: stats.total },
              { label: 'Sent', value: stats.totalSent },
              { label: 'Open Rate', value: openRate != null ? `${openRate}%` : '—' },
            ].map(item => (
              <div key={item.label} className="text-center px-2 py-2.5 bg-[#F9FAFB]/60 rounded-xl">
                <p className="text-base font-bold text-[#111827]">{item.value}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {stats.sent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#9CA3AF]">Sent campaigns</p>
                <p className="text-[10px] font-semibold text-[#374151]">{stats.sent} of {stats.total}</p>
              </div>
              <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#6C55E8] to-[#1a6b55] rounded-full"
                  style={{ width: `${Math.round((stats.sent / stats.total) * 100)}%` }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Recent Reviews ───────────────────────────────────────────────────────────

function RatingStars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-[#9CA3AF] text-xs">—</span>;
  return <span className="text-xs font-medium text-amber-500">{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>;
}

function RecentReviews({ reviews }: { reviews: ReviewRow[] }) {
  if (!reviews.length) return (
    <div className="flex items-center justify-center h-20">
      <p className="text-xs text-[#9CA3AF]">No reviews yet</p>
    </div>
  );

  return (
    <div>
      {reviews.map((r, idx) => (
        <div key={r.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-[#F9FAFB]/60 transition-colors ${idx !== reviews.length - 1 ? 'border-b border-[#E5E7EB]/50' : ''}`}>
          <div className="w-7 h-7 rounded-lg bg-[#111827]/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#6C55E8] mt-0.5">
            {(r.reviewer_name ?? '?')[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[#111827] truncate">{r.reviewer_name ?? 'Anonymous'}</span>
              <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                r.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700'
                : r.status === 'PENDING' ? 'bg-amber-50 text-amber-700'
                : 'bg-blue-50 text-blue-700'
              }`}>
                {r.status === 'PUBLISHED' ? 'Replied' : r.status === 'PENDING' ? 'Pending' : 'Draft ready'}
              </span>
            </div>
            <RatingStars n={r.rating} />
            {r.body && <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{r.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Insights Chart ───────────────────────────────────────────────────────────

function InsightsChart({ trend }: { trend: { date: string; impressions: number }[] }) {
  const max = Math.max(...trend.map(d => d.impressions), 1);
  const hasData = trend.some(d => d.impressions > 0);

  if (!hasData) return (
    <div className="h-20 flex items-center justify-center">
      <p className="text-xs text-[#9CA3AF]">No impression data for this period</p>
    </div>
  );

  const show = trend.slice(-30);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {show.map(day => {
          const pct = Math.round((day.impressions / max) * 100);
          return (
            <div key={day.date} className="flex-1 flex flex-col justify-end h-full" title={`${day.date}: ${day.impressions}`}>
              <div
                className="w-full bg-gradient-to-t from-[#6C55E8] to-[#1a6b55] rounded-t-sm transition-all"
                style={{ height: day.impressions > 0 ? `${Math.max(pct, 6)}%` : '2px', opacity: day.impressions > 0 ? 1 : 0.15 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 mt-1.5">
        {show.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % 7 === 0 && <span className="text-[9px] text-[#D1D5DB]">{new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insights Section ─────────────────────────────────────────────────────────

function InsightsSection({ insights, loading }: { insights: InsightsSummary | null; loading: boolean }) {
  const CARDS = insights ? [
    {
      label: 'Profile Views',
      value: insights.impressions.toLocaleString(),
      sub: 'Maps + Search (30 days)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
    },
    {
      label: 'Directions',
      value: insights.direction_requests.toLocaleString(),
      sub: 'Direction requests (30 days)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
        </svg>
      ),
    },
    {
      label: 'Call Clicks',
      value: insights.call_clicks.toLocaleString(),
      sub: 'Phone taps (30 days)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/>
        </svg>
      ),
    },
    {
      label: 'Website Clicks',
      value: insights.website_clicks.toLocaleString(),
      sub: 'Website taps (30 days)',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>
        </svg>
      ),
    },
  ] : [];

  return (
    <div className="relative mt-5">
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm font-semibold text-[#111827]">Google Profile Performance</p>
        <span className="text-[10px] text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-lg">Last 30 days</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-white/50 animate-pulse" />)}
        </div>
      ) : !insights ? (
        <GlassCard className="py-10 text-center">
          <div className="relative">
            <p className="text-sm font-medium text-[#374151] mb-1">No profile performance data</p>
            <p className="text-xs text-[#9CA3AF]">Data appears once your Google Business Profile has activity.</p>
          </div>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {CARDS.map(card => (
              <GlassCard key={card.label}>
                <div className="px-5 py-5">
                  <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center mb-3">
                    {card.icon}
                  </div>
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-[#111827] leading-none mb-1">{card.value}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{card.sub}</p>
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Profile Views · Daily</p>
              <span className="text-xs font-bold text-[#111827]">{insights.impressions.toLocaleString()} total</span>
            </div>
            <InsightsChart trend={insights.trend} />
          </GlassCard>
        </>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <GlassCard className="py-14 text-center">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-[#111827]/10 text-[#6C55E8] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#111827] mb-1">No reviews yet</h2>
        <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-5">
          Connect your Google Business Profile to start seeing and responding to reviews.
        </p>
        <Link to="/settings" className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Connect Google
        </Link>
      </div>
    </GlassCard>
  );
}

// ─── OverviewPage ──────────────────────────────────────────────────────────────

export function OverviewPage() {
  const user       = useAuthStore(s => s.user);
  const orgId      = useOrgStore(s => s.orgId);
  const selectedLocId = useLocationStore(s => s.selectedId);

  const [setup, setSetup] = useState<SetupStatus>({
    googleConnected: false, locationSelected: false,
    brandBrainDone: false, firstReplyDone: false, loading: true,
  });
  const [allRows, setAllRows]         = useState<ReviewRow[]>([]);
  const [dash, setDash]               = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [campaignStats, setCampaignStats]       = useState<CampaignStats | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [insights, setInsights]                 = useState<InsightsSummary | null>(null);
  const [loadingInsights, setLoadingInsights]   = useState(false);
  const [sub, setSub]                           = useState<Subscription | null>(null);
  const [billingPlans, setBillingPlans]         = useState<Plan[]>([]);

  // ── Load setup + reviews + locations ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const [connRes, locRes, brainRes, replyRes, reviewsRes] = await Promise.all([
          supabase.from('google_connections').select('id').eq('user_id', user!.id).eq('state', 'CONNECTED').limit(1),
          supabase.from('google_locations').select('id').eq('user_id', user!.id).eq('is_selected', true).limit(1),
          supabase.from('brand_brain').select('id').eq('user_id', user!.id).limit(1),
          supabase.from('reviews').select('id').eq('user_id', user!.id).eq('status', 'PUBLISHED').limit(1),
          supabase.from('reviews')
            .select('id, rating, status, published_at, body, reviewer_name, location_id')
            .eq('user_id', user!.id)
            .order('published_at', { ascending: false }),
        ]);

        setSetup({
          googleConnected:  (connRes.data?.length ?? 0) > 0,
          locationSelected: (locRes.data?.length  ?? 0) > 0,
          brandBrainDone:   (brainRes.data?.length ?? 0) > 0,
          firstReplyDone:   (replyRes.data?.length ?? 0) > 0,
          loading: false,
        });

        const rows = (reviewsRes.data ?? []) as ReviewRow[];
        setAllRows(rows);
        setDash(computeDash(rows));
      } catch {
        setSetup(s => ({ ...s, loading: false }));
      } finally {
        setLoadingDash(false);
      }
    }

    load();
  }, [user]);

  // ── Re-compute when global location selection changes ─────────────────────
  useEffect(() => {
    if (loadingDash) return;
    const filtered = selectedLocId
      ? allRows.filter(r => r.location_id === selectedLocId)
      : allRows;
    setDash(computeDash(filtered));
  }, [selectedLocId, allRows, loadingDash]);

  // ── Google Profile Insights ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !setup.googleConnected || setup.loading) return;
    setLoadingInsights(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoadingInsights(false); return; }
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fetch-insights`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(selectedLocId ? { location_id: selectedLocId } : {}),
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setInsights(data.summary as InsightsSummary);
        }
      } catch { /* non-fatal */ }
      setLoadingInsights(false);
    });
  }, [user, setup.googleConnected, setup.loading, selectedLocId]);

  // ── Billing (subscription + plans for upgrade card) ───────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([billingService.getSubscription(), billingService.getPlans()]).then(([s, ps]) => {
      setSub(s);
      setBillingPlans(ps);
    }).catch(() => { /* non-fatal */ });
  }, [user]);

  // ── Campaign stats ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    setLoadingCampaigns(true);
    supabase
      .from('campaigns')
      .select('id,status,sent_count,opened_count,total_contacts')
      .eq('org_id', orgId)
      .then(({ data }) => {
        if (!data) { setLoadingCampaigns(false); return; }
        const total       = data.length;
        const sent        = data.filter(c => c.status === 'sent').length;
        const totalSent   = data.reduce((s, c) => s + (c.sent_count ?? 0), 0);
        const totalOpened = data.reduce((s, c) => s + (c.opened_count ?? 0), 0);
        setCampaignStats({ total, sent, totalSent, totalOpened });
        setLoadingCampaigns(false);
      });
  }, [orgId]);

  const displayName = user?.user_metadata?.full_name ?? user?.email;

  return (
    <div className="relative min-h-full px-4 md:px-6 py-5 md:py-6 bg-[#F3F4F6]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/6 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-56 h-56 rounded-full bg-[#111827]/4 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">{greet(displayName)}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dash && dash.pending > 0 && (
              <Link
                to="/reviews"
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#111827] hover:bg-[#6C55E8] rounded-lg transition-colors"
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
      </div>

      {/* Weekly highlight */}
      {!loadingDash && dash && <WeeklyHighlight dash={dash} />}

      {/* Setup guide */}
      {!setup.loading && <SetupGuide status={setup} />}

      {/* Stat cards */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loadingDash ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/50 animate-pulse" />)
        ) : dash ? (
          <>
            <StatCard label="Total Reviews" value={dash.total} sub={`${dash.total} synced`}
              trend={dash.trendTotal != null ? { value: dash.trendTotal, label: 'vs prev 30 days' } : null}
              accent
              icon={<svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>}
            />
            <StatCard label="Avg. Rating" value={dash.avgRating != null ? dash.avgRating.toFixed(1) : '—'}
              sub={dash.avgRating != null ? stars(dash.avgRating) : 'No ratings yet'}
              trend={dash.trendAvgRating != null ? { value: dash.trendAvgRating, label: 'vs prev 30 days' } : null}
              icon={<svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>}
            />
            <StatCard label="Reply Rate" value={`${dash.replyRate}%`} sub={`${dash.replied} of ${dash.total} replied`}
              trend={dash.trendReplyRate != null ? { value: dash.trendReplyRate, label: 'vs prev 30 days' } : null}
              accent={dash.replyRate >= 80}
              icon={<svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>}
            />
            <StatCard label="Pending Reply" value={dash.pending}
              sub={dash.pending > 0 ? 'Need attention' : 'All caught up!'}
              urgent={dash.pending > 0}
              icon={<svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
          </>
        ) : (
          [
            { label: 'Total Reviews', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg> },
            { label: 'Avg. Rating', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg> },
            { label: 'Reply Rate', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg> },
            { label: 'Pending Reply', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          ].map(({ label, icon }) => (
            <StatCard key={label} label={label} value="—" sub="Connect Google to see data" icon={icon} />
          ))
        )}
      </div>

      {/* Charts + data rows */}
      {!loadingDash && !dash ? (
        <EmptyState />
      ) : !loadingDash && dash ? (
        <>
          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left — Recent Reviews */}
            <GlassCard className="overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#E5E7EB]/50">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Recent Reviews</p>
                <Link to="/reviews" className="text-[11px] font-semibold text-[#6C55E8] hover:underline">View all →</Link>
              </div>
              <RecentReviews reviews={dash.recent} />
            </GlassCard>

            {/* Middle — Trend + Sentiment + Rating stacked */}
            <div className="flex flex-col gap-4">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Reviews · Last 14 Days</p>
                  <span className="text-xs font-bold text-[#111827]">{dash.trend.reduce((s, d) => s + d.count, 0)} total</span>
                </div>
                <TrendChart trend={dash.trend} />
              </GlassCard>

              <SentimentCard breakdown={dash.ratingBreakdown} />

              <GlassCard className="p-5">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Rating Breakdown</p>
                <RatingChart breakdown={dash.ratingBreakdown} />
              </GlassCard>
            </div>

            {/* Right — Activity Feed + Upgrade Card */}
            <div className="flex flex-col gap-4">
              <GlassCard className="p-5">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Recent Activity</p>
                <ActivityFeed items={dash.activityItems} />
              </GlassCard>
              <UpgradeCard sub={sub} plans={billingPlans} />
            </div>
          </div>

          {/* Google Profile Performance */}
          {setup.googleConnected && (
            <InsightsSection insights={insights} loading={loadingInsights} />
          )}
        </>
      ) : null}
    </div>
  );
}
