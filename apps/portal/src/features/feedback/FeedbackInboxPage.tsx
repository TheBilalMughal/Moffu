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
  location_id: string | null;
  sentiment: 'happy' | 'unhappy';
  feedback_text: string | null;
  resolved: boolean;
  resolved_at: string | null;
  responded_at: string;
  customer_name: string | null;
  customer_email: string | null;
  channel: string;
  location_name: string | null;
  sent_at: string | null;
  open_count: number;
  last_opened_at: string | null;
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

// ─── FeedbackInboxPage ────────────────────────────────────────────────────────

export function FeedbackInboxPage() {
  const user          = useAuthStore(s => s.user);
  const orgId         = useOrgStore(s => s.orgId);
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
        id, request_id, location_id,
        sentiment, feedback_text,
        resolved, resolved_at, responded_at,
        feedback_requests (
          customer_name, customer_email, channel,
          sent_at, open_count, last_opened_at,
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
            location_id:   r.location_id as string | null,
            sentiment:     r.sentiment as 'happy' | 'unhappy',
            feedback_text: r.feedback_text as string | null,
            resolved:      r.resolved as boolean,
            resolved_at:   r.resolved_at as string | null,
            responded_at:  r.responded_at as string,
            customer_name:  req?.customer_name as string | null ?? null,
            customer_email: req?.customer_email as string | null ?? null,
            channel:        req?.channel as string ?? 'manual',
            location_name:  loc?.display_name as string | null ?? null,
            sent_at:        req?.sent_at as string | null ?? null,
            open_count:     (req?.open_count as number) ?? 0,
            last_opened_at: req?.last_opened_at as string | null ?? null,
          };
        });
        setRows(mapped);
        setLoading(false);
      });
  }, [orgId]);

  // ── Resolve ───────────────────────────────────────────────────────────────
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

  const locRows  = selectedLocId ? rows.filter(r => r.location_id === selectedLocId) : rows;
  const total    = locRows.length;
  const unhappy  = locRows.filter(r => r.sentiment === 'unhappy').length;
  const open     = locRows.filter(r => r.sentiment === 'unhappy' && !r.resolved).length;
  const happyPct = total > 0 ? Math.round(((total - unhappy) / total) * 100) : null;

  return (
    <div className="relative min-h-full px-4 md:px-6 py-5 md:py-6">

      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/6 blur-3xl" />
        <div className="absolute top-1/2 right-0 w-56 h-56 rounded-full bg-[#111827]/4 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Feedback Inbox</h1>
          <p className="text-sm text-[#6B7280] mt-0.5 hidden sm:block">Private customer feedback — not visible on Google</p>
        </div>
        <Link
          to="/feedback/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          New request
        </Link>
      </div>

      {/* Stat cards */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total responses', value: loading ? '—' : total,                                accent: true  },
          { label: 'Happy',           value: loading ? '—' : happyPct != null ? `${happyPct}%` : '—', sub: loading ? '' : `${total - unhappy} of ${total}` },
          { label: 'Unhappy',         value: loading ? '—' : unhappy,                              sub: 'private feedback' },
          { label: 'Open issues',     value: loading ? '—' : open, sub: open > 0 ? 'Need follow-up' : 'All resolved', accent: open > 0 },
        ].map(card => (
          <div key={card.label} className={`relative overflow-hidden rounded-2xl border bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 px-5 py-5 ${card.accent ? 'border-[#6C55E8]/20' : 'border-white/60'}`}>
            {card.accent && <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/8 via-transparent to-[#6C55E8]/3 pointer-events-none" />}
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1 relative">{card.label}</p>
            <p className="text-2xl font-bold text-[#111827] relative">{card.value}</p>
            {card.sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5 relative">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="relative flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl overflow-hidden shadow-sm">
          {(['all', 'unhappy', 'happy'] as SentimentFilter[]).map((v, i) => (
            <button key={v} onClick={() => setSentiment(v)}
              className={`text-xs px-3.5 py-2 transition-colors ${i > 0 ? 'border-l border-white/60' : ''} ${
                sentiment === v
                  ? 'bg-[#111827]/10 text-[#6C55E8] font-semibold'
                  : 'text-[#6B7280] hover:bg-white/60 hover:text-[#374151]'
              }`}>
              {v === 'all' ? 'All' : v === 'unhappy' ? 'Unhappy' : 'Happy'}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl overflow-hidden shadow-sm">
          {(['open', 'resolved', 'all'] as ResolvedFilter[]).map((v, i) => (
            <button key={v} onClick={() => setResolved(v)}
              className={`text-xs px-3.5 py-2 transition-colors ${i > 0 ? 'border-l border-white/60' : ''} ${
                resolved === v
                  ? 'bg-[#111827]/10 text-[#6C55E8] font-semibold'
                  : 'text-[#6B7280] hover:bg-white/60 hover:text-[#374151]'
              }`}>
              {v === 'open' ? 'Open' : v === 'resolved' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-[#9CA3AF]">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-lg shadow-black/5 overflow-x-auto">
        <div className="min-w-[540px]">

        {loading ? (
          <div className="divide-y divide-white/60">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-white/60 rounded-lg animate-pulse" />
                  <div className="h-3 w-56 bg-white/60 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#374151] mb-1">No feedback here</p>
            <p className="text-xs text-[#9CA3AF] mb-4">
              {rows.length === 0 ? 'Send your first feedback request to collect responses.' : 'Try adjusting your filters.'}
            </p>
            {rows.length === 0 && (
              <Link to="/feedback/new"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6C55E8] hover:underline">
                Create first request →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/60">
            {/* Table header */}
            <div className="grid grid-cols-[2.5rem_1fr_7rem_6rem_6rem] items-center gap-4 px-5 py-3 bg-[#111827]/[0.04] border-b border-white/60">
              <div />
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Customer</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide text-center">Sentiment</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide text-center">Status</p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Date</p>
            </div>

            {filtered.map(r => (
              <div key={r.id}
                className="grid grid-cols-[2.5rem_1fr_7rem_6rem_6rem] items-start gap-4 px-5 py-4 hover:bg-white/40 transition-colors">

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${
                  r.sentiment === 'happy'
                    ? 'bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 text-emerald-600'
                    : 'bg-amber-50/80 backdrop-blur-sm border border-amber-100 text-amber-600'
                }`}>
                  {(r.customer_name ?? '?')[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Customer + feedback */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-[#111827]">
                      {r.customer_name ?? 'Anonymous'}
                    </span>
                    {r.customer_email && (
                      <span className="text-xs text-[#9CA3AF]">{r.customer_email}</span>
                    )}
                    {r.location_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/70 backdrop-blur-sm border border-white/60 text-[#6B7280] rounded-lg">
                        {r.location_name}
                      </span>
                    )}
                  </div>
                  {r.feedback_text ? (
                    <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2">{r.feedback_text}</p>
                  ) : r.sentiment === 'happy' ? (
                    <p className="text-xs text-emerald-600">Redirected to Google review page</p>
                  ) : null}
                  {/* Email tracking badge */}
                  {r.channel === 'email' && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {r.sent_at ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#6B7280] bg-white/70 backdrop-blur-sm border border-white/60 px-1.5 py-0.5 rounded-lg">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                          </svg>
                          Sent {timeAgo(r.sent_at)}
                        </span>
                      ) : null}
                      {r.open_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#6C55E8] bg-[#F3F4F6] border border-[#D1EAE4] px-1.5 py-0.5 rounded-lg">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                          Opened {r.open_count}×{r.last_opened_at ? ` · last ${timeAgo(r.last_opened_at)}` : ''}
                        </span>
                      ) : r.sent_at ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#9CA3AF] px-1.5 py-0.5">
                          Not opened yet
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Sentiment */}
                <div className="text-center pt-0.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                    r.sentiment === 'happy'
                      ? 'bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 text-emerald-600'
                      : 'bg-amber-50/80 backdrop-blur-sm border border-amber-100 text-amber-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.sentiment === 'happy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {r.sentiment === 'happy' ? 'Happy' : 'Unhappy'}
                  </span>
                </div>

                {/* Status / action */}
                <div className="text-center pt-1">
                  {r.sentiment === 'unhappy' ? (
                    r.resolved ? (
                      <span className="text-[11px] font-medium text-[#9CA3AF]">Resolved</span>
                    ) : (
                      <button
                        onClick={() => markResolved(r.id)}
                        disabled={resolving === r.id}
                        className="text-[11px] font-semibold text-[#6C55E8] hover:underline disabled:opacity-50 transition-opacity"
                      >
                        {resolving === r.id ? 'Saving…' : 'Resolve'}
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-[#D1D5DB]">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="text-right pt-0.5">
                  <p className="text-[11px] text-[#9CA3AF]">{timeAgo(r.responded_at)}</p>
                  <p className="text-[10px] text-[#D1D5DB] mt-0.5">{fmtDate(r.responded_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
