import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useLocationStore } from '@/features/location/location.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackRow {
  id: string;
  request_id: string;
  org_id: string;
  location_id: string | null;
  sentiment: 'happy' | 'unhappy';
  rating_choice: number | null;
  feedback_text: string | null;
  resolved: boolean;
  resolved_at: string | null;
  responded_at: string;
  // joined from feedback_requests
  customer_name: string | null;
  customer_email: string | null;
  channel: string;
  location_name: string | null;
}

type SentimentFilter = 'all' | 'unhappy' | 'happy';
type ResolvedFilter  = 'all' | 'open' | 'resolved';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white/70 backdrop-blur-md shadow-sm px-5 py-5 ${accent ? 'border-[#0D4C3C]/20' : 'border-[#E5EAE8]'}`}>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-[#0D4C3C]/5 via-transparent to-transparent pointer-events-none" />}
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 relative">{label}</p>
      <p className="text-2xl font-bold text-[#111827] relative">{value}</p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5 relative">{sub}</p>}
    </div>
  );
}

// ─── FeedbackInboxPage ────────────────────────────────────────────────────────

export function FeedbackInboxPage() {
  const user        = useAuthStore(s => s.user);
  const orgId       = useOrgStore(s => s.orgId);
  const selectedLocId = useLocationStore(s => s.selectedId);

  const [rows, setRows]           = useState<FeedbackRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sentiment, setSentiment] = useState<SentimentFilter>('all');
  const [resolved, setResolved]   = useState<ResolvedFilter>('open');
  const [resolving, setResolving] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    supabase
      .from('feedback_responses')
      .select(`
        id, request_id, org_id, location_id,
        sentiment, rating_choice, feedback_text,
        resolved, resolved_at, responded_at,
        feedback_requests (
          customer_name, customer_email, channel,
          google_locations ( display_name )
        )
      `)
      .eq('org_id', orgId)
      .order('responded_at', { ascending: false })
      .then(({ data }) => {
        const mapped: FeedbackRow[] = (data ?? []).map((r: Record<string, unknown>) => {
          const req = r.feedback_requests as Record<string, unknown> | null;
          const loc = req?.google_locations as Record<string, unknown> | null;
          return {
            id:            r.id as string,
            request_id:    r.request_id as string,
            org_id:        r.org_id as string,
            location_id:   r.location_id as string | null,
            sentiment:     r.sentiment as 'happy' | 'unhappy',
            rating_choice: r.rating_choice as number | null,
            feedback_text: r.feedback_text as string | null,
            resolved:      r.resolved as boolean,
            resolved_at:   r.resolved_at as string | null,
            responded_at:  r.responded_at as string,
            customer_name:  req?.customer_name as string | null ?? null,
            customer_email: req?.customer_email as string | null ?? null,
            channel:        req?.channel as string ?? 'manual',
            location_name:  loc?.display_name as string | null ?? null,
          };
        });
        setRows(mapped);
        setLoading(false);
      });
  }, [orgId]);

  // ── Mark resolved ─────────────────────────────────────────────────────────
  async function markResolved(id: string) {
    setResolving(id);
    await supabase
      .from('feedback_responses')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, resolved: true, resolved_at: new Date().toISOString() } : r));
    setResolving(null);
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    if (selectedLocId && r.location_id !== selectedLocId) return false;
    if (sentiment !== 'all' && r.sentiment !== sentiment) return false;
    if (resolved === 'open' && r.resolved) return false;
    if (resolved === 'resolved' && !r.resolved) return false;
    return true;
  });

  // ── Stats (location-aware) ────────────────────────────────────────────────
  const locRows   = selectedLocId ? rows.filter(r => r.location_id === selectedLocId) : rows;
  const total     = locRows.length;
  const unhappy   = locRows.filter(r => r.sentiment === 'unhappy').length;
  const open      = locRows.filter(r => r.sentiment === 'unhappy' && !r.resolved).length;
  const happyPct  = total > 0 ? Math.round(((total - unhappy) / total) * 100) : null;

  return (
    <div className="relative min-h-full px-6 py-6">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#0D4C3C]/6 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-[#0D4C3C]/4 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Feedback Inbox</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Private customer feedback — not visible on Google</p>
        </div>
        <Link
          to="/feedback/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0D4C3C] text-white text-sm font-semibold rounded-xl hover:bg-[#083F32] transition-colors shadow-md shadow-[#0D4C3C]/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          New request
        </Link>
      </div>

      {/* Stats */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total responses" value={total} accent />
        <StatCard label="Happy"   value={happyPct != null ? `${happyPct}%` : '—'} sub={`${total - unhappy} responses`} />
        <StatCard label="Unhappy" value={unhappy} sub="private feedback" />
        <StatCard label="Open issues" value={open} sub={open > 0 ? 'Need follow-up' : 'All resolved'} accent={open > 0} />
      </div>

      {/* Filters */}
      <div className="relative flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'unhappy', 'happy'] as SentimentFilter[]).map(v => (
          <button key={v} onClick={() => setSentiment(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
              sentiment === v
                ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-semibold'
                : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C] hover:text-[#0D4C3C]'
            }`}>
            {v === 'all' ? 'All' : v === 'unhappy' ? 'Unhappy' : 'Happy'}
          </button>
        ))}
        <div className="w-px h-4 bg-[#E5EAE8] mx-1" />
        {(['open', 'resolved', 'all'] as ResolvedFilter[]).map(v => (
          <button key={v} onClick={() => setResolved(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
              resolved === v
                ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-semibold'
                : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C] hover:text-[#0D4C3C]'
            }`}>
            {v === 'open' ? 'Open' : v === 'resolved' ? 'Resolved' : 'All status'}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#9CA3AF]">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E5EAE8] bg-white/70 backdrop-blur-md shadow-sm">
        {loading ? (
          <div className="divide-y divide-[#F3F4F6]">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-[#F3F4F6] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-[#F3F4F6] rounded animate-pulse" />
                  <div className="h-3 w-56 bg-[#F3F4F6] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#374151] mb-1">No feedback here</p>
            <p className="text-xs text-[#9CA3AF]">
              {rows.length === 0 ? 'Send your first feedback request to start collecting responses.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-[#F8FAF9]/80">
              <div />
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Customer</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide w-24 text-center">Sentiment</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide w-20 text-center">Status</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide w-24 text-right">Date</p>
            </div>
            {filtered.map(r => (
              <div key={r.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-start gap-4 px-5 py-4 hover:bg-[#F8FAF9]/60 transition-colors">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${
                  r.sentiment === 'happy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {(r.customer_name ?? '?')[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Customer + feedback */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#111827]">
                      {r.customer_name ?? 'Anonymous'}
                    </span>
                    {r.customer_email && (
                      <span className="text-xs text-[#9CA3AF]">{r.customer_email}</span>
                    )}
                    {r.location_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded-lg">{r.location_name}</span>
                    )}
                  </div>
                  {r.feedback_text && (
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed line-clamp-2">{r.feedback_text}</p>
                  )}
                  {!r.feedback_text && r.sentiment === 'happy' && (
                    <p className="text-xs text-emerald-600 mt-1">Left a positive response → redirected to Google</p>
                  )}
                </div>

                {/* Sentiment badge */}
                <div className="w-24 text-center">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${
                    r.sentiment === 'happy'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${r.sentiment === 'happy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {r.sentiment === 'happy' ? 'Happy' : 'Unhappy'}
                  </span>
                </div>

                {/* Status / action */}
                <div className="w-20 text-center">
                  {r.sentiment === 'unhappy' ? (
                    r.resolved ? (
                      <span className="text-[11px] font-medium text-[#9CA3AF]">Resolved</span>
                    ) : (
                      <button
                        onClick={() => markResolved(r.id)}
                        disabled={resolving === r.id}
                        className="text-[11px] font-semibold text-[#0D4C3C] hover:underline disabled:opacity-50"
                      >
                        {resolving === r.id ? 'Saving…' : 'Resolve'}
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="w-24 text-right">
                  <p className="text-[11px] text-[#9CA3AF]">{timeAgo(r.responded_at)}</p>
                  <p className="text-[10px] text-[#D1D5DB]">{fmtDate(r.responded_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
