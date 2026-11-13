import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

interface ComplaintReview {
  id: string;
  reviewer_name: string;
  rating: number;
  published_at: string;
  body: string | null;
  complaint_summary: string | null;
  status: string;
  reply_text: string | null;
  location_id: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-3 h-3 ${s <= rating ? 'text-[#F59E0B]' : 'text-[#E5E7EB]'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  );
}

type FilterStatus = 'all' | 'unanswered' | 'answered';
type FilterRating = 'all' | '1' | '2' | '3';

export function ComplaintsPage() {
  const { selectedId: globalLocationId } = useLocationStore();
  const [complaints, setComplaints]       = useState<ComplaintReview[]>([]);
  const [loading, setLoading]             = useState(true);
  const [analyzing, setAnalyzing]         = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ analyzed: number; complaints: number } | null>(null);
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>('all');
  const [filterRating, setFilterRating]   = useState<FilterRating>('all');
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reviews')
        .select('id, reviewer_name, rating, published_at, body, complaint_summary, status, reply_text, location_id')
        .eq('is_complaint', true)
        .order('published_at', { ascending: false })
        .limit(200);

      if (globalLocationId) {
        query = query.eq('location_id', globalLocationId);
      }

      const { data } = await query;
      setComplaints(data ?? []);

      // Load location names
      const { data: locs } = await supabase
        .from('google_locations')
        .select('id, display_name')
        .eq('is_selected', true);
      if (locs) {
        const map: Record<string, string> = {};
        for (const l of locs) map[l.id] = l.display_name;
        setLocationNames(map);
      }
    } finally {
      setLoading(false);
    }
  }, [globalLocationId]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-complaints`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await res.json();
      setAnalyzeResult(result);
      await fetchComplaints();
    } catch (e) {
      console.error('Analyze error:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply filters
  const filtered = complaints.filter((c) => {
    const isReplied = c.status === 'PUBLISHED' || !!c.reply_text;
    if (filterStatus === 'answered'   && !isReplied) return false;
    if (filterStatus === 'unanswered' && isReplied)  return false;
    if (filterRating !== 'all' && String(c.rating) !== filterRating) return false;
    return true;
  });

  // Stats
  const total      = complaints.length;
  const unanswered = complaints.filter(c => c.status !== 'PUBLISHED' && !c.reply_text).length;
  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of complaints) {
    if (c.rating >= 1 && c.rating <= 3) byRating[c.rating] = (byRating[c.rating] ?? 0) + 1;
  }

  const statCards = [
    {
      label: 'Total Complaints',
      value: total,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      ),
      color: 'text-[#EF4444]',
      bg: 'bg-[#FEF2F2]',
    },
    {
      label: 'Unanswered',
      value: unanswered,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
        </svg>
      ),
      color: 'text-[#F59E0B]',
      bg: 'bg-[#FFFBEB]',
    },
    {
      label: '1-Star Complaints',
      value: byRating[1] ?? 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
        </svg>
      ),
      color: 'text-[#EF4444]',
      bg: 'bg-[#FEF2F2]',
    },
    {
      label: '2-3 Star Complaints',
      value: (byRating[2] ?? 0) + (byRating[3] ?? 0),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
        </svg>
      ),
      color: 'text-[#F59E0B]',
      bg: 'bg-[#FFFBEB]',
    },
  ];

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827] leading-tight">Complaints</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">AI-flagged reviews with genuine complaints from low-rated feedback</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-2 bg-[#6C55E8] hover:bg-[#5A42D1] disabled:opacity-60 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {analyzing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Run AI Analysis
            </>
          )}
        </button>
      </div>

      {/* Analyze result banner */}
      {analyzeResult && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#EDE9FE] border border-[#C4B5FD] flex items-center gap-3">
          <svg className="w-5 h-5 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-[13px] text-[#4C1D95] font-medium">
            Analyzed {analyzeResult.analyzed} reviews — found {analyzeResult.complaints} new complaint{analyzeResult.complaints !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <GlassCard key={card.label} className="p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0 ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-[#111827] leading-none">{card.value}</p>
              <p className="text-[11px] text-[#6B7280] mt-1 leading-tight">{card.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mr-1">Filter:</span>

        {/* Status filter */}
        <div className="flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-0.5">
          {(['all', 'unanswered', 'answered'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-white text-[#111827] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Rating filter */}
        <div className="flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-0.5">
          {(['all', '1', '2', '3'] as FilterRating[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRating(r)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filterRating === r
                  ? 'bg-white text-[#111827] shadow-sm'
                  : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              {r === 'all' ? 'All Stars' : `${r} Star`}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#9CA3AF]">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-6 h-6 animate-spin text-[#6C55E8]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-[#374151] mb-1">
            {complaints.length === 0 ? 'No complaints found' : 'No matching complaints'}
          </p>
          <p className="text-[13px] text-[#9CA3AF] max-w-xs">
            {complaints.length === 0
              ? 'Run AI Analysis to scan your 1-3 star reviews for complaints.'
              : 'Try adjusting the filters.'}
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((complaint) => {
            const isReplied = complaint.status === 'PUBLISHED' || !!complaint.reply_text;
            const expanded  = expandedId === complaint.id;

            return (
              <GlassCard
                key={complaint.id}
                className={`overflow-hidden transition-all ${expanded ? 'ring-1 ring-[#6C55E8]/30' : ''}`}
              >
                {/* Card header row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : complaint.id)}
                  className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-[#FAFAFA] transition-colors"
                >
                  {/* Rating badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[15px] ${
                    complaint.rating === 1 ? 'bg-[#FEE2E2] text-[#DC2626]' :
                    complaint.rating === 2 ? 'bg-[#FEF3C7] text-[#D97706]' :
                                             'bg-[#FEF9C3] text-[#CA8A04]'
                  }`}>
                    {complaint.rating}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[13px] font-semibold text-[#111827]">{complaint.reviewer_name || 'Anonymous'}</span>
                      <StarRow rating={complaint.rating} />
                      <span className="text-[11px] text-[#9CA3AF]">{timeAgo(complaint.published_at)}</span>
                      {locationNames[complaint.location_id] && (
                        <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-lg">
                          {locationNames[complaint.location_id]}
                        </span>
                      )}
                    </div>

                    {/* AI summary */}
                    {complaint.complaint_summary && (
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-[#6C55E8] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        <p className="text-[12px] text-[#6C55E8] font-medium leading-snug">{complaint.complaint_summary}</p>
                      </div>
                    )}

                    {/* Review snippet */}
                    {complaint.body && (
                      <p className={`text-[12px] text-[#6B7280] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                        {complaint.body}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                      isReplied
                        ? 'bg-[#D1FAE5] text-[#065F46]'
                        : 'bg-[#FEF3C7] text-[#92400E]'
                    }`}>
                      {isReplied ? 'Replied' : 'Pending'}
                    </span>
                    <svg
                      className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded reply section */}
                {expanded && (
                  <div className="px-5 pb-5 border-t border-[#F3F4F6]">
                    {complaint.reply_text && (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Your Reply</p>
                        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3.5">
                          <p className="text-[12px] text-[#374151] leading-relaxed">{complaint.reply_text}</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[11px] text-[#9CA3AF]">
                        {new Date(complaint.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <a
                        href="/reviews"
                        className="text-[12px] font-semibold text-[#6C55E8] hover:underline"
                      >
                        View in Reviews
                      </a>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
