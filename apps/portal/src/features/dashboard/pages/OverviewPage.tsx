import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupStatus {
  googleConnected: boolean;
  locationSelected: boolean;
  brandBrainDone: boolean;
  firstReplyDone: boolean;
  loading: boolean;
}

// ── Setup Guide ───────────────────────────────────────────────────────────────

const DISMISS_KEY = 'moffu_setup_dismissed';

const STEPS = [
  {
    key: 'googleConnected',
    label: 'Connect Google Business Profile',
    description: 'Link your account to start syncing reviews.',
    href: '/settings',
    linkLabel: 'Go to Settings',
  },
  {
    key: 'locationSelected',
    label: 'Select a location to manage',
    description: "Choose which location's reviews to track.",
    href: '/settings',
    linkLabel: 'Go to Settings',
  },
  {
    key: 'brandBrainDone',
    label: 'Set up your Brand Brain',
    description: 'Train Moffu on your tone, language and reply rules.',
    href: '/brand-brain',
    linkLabel: 'Set up Brand Brain',
  },
  {
    key: 'firstReplyDone',
    label: 'Reply to your first review',
    description: 'Generate an AI draft and publish your first response.',
    href: '/reviews',
    linkLabel: 'Go to Reviews',
  },
] as const;

type StepKey = typeof STEPS[number]['key'];

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SetupGuide({ status }: { status: SetupStatus }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const completed = STEPS.filter((s) => status[s.key as StepKey]).length;
  const allDone = completed === STEPS.length;

  if (dismissed || allDone) return null;

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5EAE8]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#111827]">Get started</span>
          <span className="text-xs text-[#6B7280]">{completed} of {STEPS.length} complete</span>
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-[#E5EAE8] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0D4C3C] rounded-full transition-all duration-500"
              style={{ width: `${(completed / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[#9CA3AF] hover:text-[#374151] transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#F3F4F6]">
        {STEPS.map((step, idx) => {
          const done = status[step.key as StepKey];
          const isNext = !done && STEPS.slice(0, idx).every((s) => status[s.key as StepKey]);
          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 px-5 py-3.5 ${done ? 'opacity-60' : ''}`}
            >
              {/* Step number / check */}
              <div className={`w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-[#0D4C3C]' : isNext ? 'bg-[#0D4C3C]' : 'bg-[#E5EAE8]'
              }`}>
                {done ? (
                  <CheckIcon />
                ) : (
                  <span className={`text-xs font-semibold ${isNext ? 'text-white' : 'text-[#9CA3AF]'}`}>
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'}`}>
                  {step.label}
                </p>
                {!done && (
                  <p className="text-xs text-[#6B7280] mt-0.5">{step.description}</p>
                )}
              </div>

              {/* Action */}
              {!done && (
                <Link
                  to={step.href}
                  className={`text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    isNext
                      ? 'text-[#0D4C3C] hover:text-[#0a3d30]'
                      : 'text-[#9CA3AF] hover:text-[#6B7280]'
                  }`}
                >
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-sm border border-[#E5EAE8] px-6 py-5">
      <p className="text-sm text-[#6B7280] font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

interface ReviewStats {
  total: number;
  avgRating: number | null;
  pending: number;
  replied: number;
}

// ── OverviewPage ──────────────────────────────────────────────────────────────

export function OverviewPage() {
  const user = useAuthStore((s) => s.user);

  const [setup, setSetup] = useState<SetupStatus>({
    googleConnected: false,
    locationSelected: false,
    brandBrainDone: false,
    firstReplyDone: false,
    loading: true,
  });

  const [stats, setStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    if (!user) return;

    async function checkSetup() {
      const [connRes, locRes, brainRes, replyRes, statsRes] = await Promise.all([
        supabase.from('google_connections').select('id').eq('user_id', user!.id).eq('status', 'CONNECTED').limit(1),
        supabase.from('google_locations').select('id').eq('user_id', user!.id).eq('is_selected', true).limit(1),
        supabase.from('brand_brain').select('id').eq('user_id', user!.id).limit(1),
        supabase.from('reviews').select('id').eq('user_id', user!.id).eq('status', 'PUBLISHED').limit(1),
        supabase.from('reviews').select('id, rating, status').eq('user_id', user!.id),
      ]);

      const googleConnected = (connRes.data?.length ?? 0) > 0;

      setSetup({
        googleConnected,
        locationSelected: (locRes.data?.length   ?? 0) > 0,
        brandBrainDone:   (brainRes.data?.length ?? 0) > 0,
        firstReplyDone:   (replyRes.data?.length ?? 0) > 0,
        loading: false,
      });

      if (googleConnected && statsRes.data && statsRes.data.length > 0) {
        const rows = statsRes.data;
        const total = rows.length;
        const ratings = rows.map(r => r.rating).filter((r): r is number => r != null);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        const pending = rows.filter(r => r.status === 'PENDING').length;
        const replied = rows.filter(r => r.status === 'PUBLISHED').length;
        setStats({ total, avgRating, pending, replied });
      }
    }

    checkSetup();
  }, [user]);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Overview</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Your review performance at a glance.</p>
      </div>

      {/* Setup guide — hidden once all steps done or dismissed */}
      {!setup.loading && <SetupGuide status={setup} />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats ? (
          <>
            <StatCard label="Total Reviews" value={stats.total} />
            <StatCard label="Avg. Rating"   value={stats.avgRating != null ? `${stats.avgRating.toFixed(1)} ★` : '—'} />
            <StatCard label="Pending Reply" value={stats.pending} {...(stats.pending > 0 ? { sub: 'Awaiting response' } : {})} />
            <StatCard label="Replied"       value={stats.replied} />
          </>
        ) : (
          <>
            <StatCard label="Total Reviews"  value="—" sub="Connect Google to see data" />
            <StatCard label="Avg. Rating"    value="—" sub="Connect Google to see data" />
            <StatCard label="Pending Reply"  value="—" sub="Connect Google to see data" />
            <StatCard label="Replied"        value="—" sub="Connect Google to see data" />
          </>
        )}
      </div>

      {/* Empty / connected state */}
      {!stats ? (
        <div className="bg-white rounded-sm border border-[#E5EAE8] px-8 py-12 text-center">
          <div className="w-12 h-12 rounded-sm bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#111827] mb-1">No reviews yet</h2>
          <p className="text-sm text-[#6B7280] max-w-xs mx-auto mb-5">
            Connect your Google Business Profile to start seeing and responding to reviews.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors"
          >
            Connect Google
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-sm border border-[#E5EAE8] px-6 py-5">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Reviews needing reply</p>
            {stats.pending === 0 ? (
              <p className="text-sm text-[#9CA3AF]">All caught up — no pending replies.</p>
            ) : (
              <Link to="/reviews" className="inline-flex items-center gap-2 text-sm font-medium text-[#0D4C3C] hover:underline">
                View {stats.pending} pending review{stats.pending !== 1 ? 's' : ''} →
              </Link>
            )}
          </div>
          <div className="bg-white rounded-sm border border-[#E5EAE8] px-6 py-5">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/reviews" className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors">View reviews</Link>
              <Link to="/insights" className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors">View insights</Link>
              <Link to="/brand-brain" className="text-xs font-medium text-[#0D4C3C] border border-[#D1D5DB] rounded-lg px-3 py-1.5 hover:bg-[#F3F8F6] transition-colors">Brand Brain</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
