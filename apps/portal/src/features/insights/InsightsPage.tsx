import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { brandBrainService, KeywordContext } from '@/features/brand-brain/brandBrain.service';

// ── Stop words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','was','are','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','not','no','i','we','you','they',
  'he','she','it','my','our','your','their','its','this','that','these','those',
  'so','if','as','all','very','just','more','also','about','up','out','get','got',
  'which','who','what','when','where','how','into','go','come','back','there','here',
  'them','than','then','now','only','some','can','us','me','him','her','really',
  'great','good','place','food','service','staff','time','back','visit','experience',
  'nice','love','like','make','know','well','even','much','many','every','never',
  'always','again','still','would','going','went','came','said','told','gave',
]);

function extractKeywords(texts: string[]): [string, number][] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)) {
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
}

// ── Keyword row ───────────────────────────────────────────────────────────────

function KeywordRow({
  word, count, max, color, addedToAgent, onAddToAgent,
}: {
  word: string; count: number; max: number; color: string;
  addedToAgent: boolean; onAddToAgent: (word: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const pct = Math.max(4, Math.round((count / max) * 100));

  async function handleAdd() {
    setSaving(true);
    await onAddToAgent(word);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs font-medium text-[#374151] w-32 truncate flex-shrink-0">{word}</span>
      <div className="flex-1 bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
      </div>
      <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
      {addedToAgent ? (
        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#0D4C3C] bg-[#E6F2EE] px-2 py-0.5 rounded-lg">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
          Added
        </span>
      ) : (
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex-shrink-0 text-[10px] font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-2.5 py-0.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-50 transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          {saving ? '…' : '+ Add to Agent'}
        </button>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonPanel() {
  return (
    <div className="border border-[#E5EAE8] rounded-xl overflow-hidden animate-pulse">
      <div className="h-12 bg-[#F3F4F6]"/>
      <div className="p-5 space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 h-3 bg-[#F3F4F6] rounded-full flex-shrink-0"/>
            <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full"/>
            <div className="w-4 h-3 bg-[#F3F4F6] rounded-full flex-shrink-0"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function InsightsPage() {
  const [reviews, setReviews] = useState<{ body: string; rating: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Promise.all([
      supabase.from('reviews').select('body, rating'),
      brandBrainService.load(),
    ]).then(([reviewsRes, brainRes]) => {
      setReviews((reviewsRes.data ?? []).filter(r => r.body));
      const existing: KeywordContext[] = brainRes.data?.keyword_contexts ?? [];
      setAddedKeywords(new Set(existing.map(k => k.keyword.toLowerCase())));
      setLoading(false);
    });
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  async function handleAddToAgent(word: string) {
    const context = `When the keyword "${word}" appears in a review, acknowledge it specifically in your reply.`;
    const { error } = await brandBrainService.addKeywordContext(word, context);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    setAddedKeywords(prev => new Set([...prev, word.toLowerCase()]));
    showToast(`"${word}" added to Brand Brain.`, 'success');
  }

  const positiveReviews = reviews.filter(r => r.rating >= 4);
  const negativeReviews = reviews.filter(r => r.rating <= 2);
  const positiveKw = extractKeywords(positiveReviews.map(r => r.body));
  const negativeKw = extractKeywords(negativeReviews.map(r => r.body));
  const maxPos = positiveKw[0]?.[1] ?? 1;
  const maxNeg = negativeKw[0]?.[1] ?? 1;
  const totalReviews = reviews.length;
  const posCount = positiveReviews.length;
  const negCount = negativeReviews.length;
  const sentimentPct = totalReviews > 0 ? Math.round((posCount / totalReviews) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-[#F8FAF9]">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Review Insights</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Top keywords from your reviews. Add them to Brand Brain to train your AI Agent's replies.</p>
          </div>
          <a
            href="/brand-brain"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-2 rounded-lg hover:bg-[#E6F2EE] transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
            </svg>
            Open Brand Brain
          </a>
        </div>

        {/* Summary strip */}
        {!loading && totalReviews > 0 && (
          <div className="mt-5 flex items-center gap-6 px-5 py-3.5 bg-white rounded-xl border border-[#E5EAE8]">
            <div className="text-center flex-shrink-0">
              <p className="text-xl font-bold text-[#111827]">{totalReviews}</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">Reviews</p>
            </div>
            <div className="w-px h-9 bg-[#E5EAE8] flex-shrink-0"/>
            <div className="text-center flex-shrink-0">
              <p className="text-xl font-bold text-emerald-600">{posCount}</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">Positive (4–5★)</p>
            </div>
            <div className="w-px h-9 bg-[#E5EAE8] flex-shrink-0"/>
            <div className="text-center flex-shrink-0">
              <p className="text-xl font-bold text-red-500">{negCount}</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">Negative (1–2★)</p>
            </div>
            <div className="w-px h-9 bg-[#E5EAE8] flex-shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1.5">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all flex-shrink-0"
                  style={{ width: `${sentimentPct}%`, maxWidth: '100%', minWidth: sentimentPct > 0 ? 6 : 0 }}
                />
                <div className="h-2 rounded-full bg-[#F3F4F6] flex-1"/>
              </div>
              <p className="text-[11px] text-[#6B7280]">{sentimentPct}% positive sentiment</p>
            </div>
            <div className="flex-shrink-0 text-center">
              <p className="text-xl font-bold text-[#0D4C3C]">{addedKeywords.size}</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">Added to Agent</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-5">
            <SkeletonPanel/>
            <SkeletonPanel/>
          </div>
        ) : totalReviews === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-[#E5EAE8] rounded-xl bg-white">
            <svg className="w-12 h-12 text-[#D1D5DB] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p className="text-sm font-semibold text-[#374151]">No reviews yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1.5 text-center max-w-xs">Sync your Google Business reviews first — keyword insights will appear here once reviews are loaded.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {/* Positive keywords */}
            <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5EAE8] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"/>
                <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">What customers love</p>
                <span className="ml-auto text-[10px] text-[#9CA3AF]">{posCount} positive reviews</span>
              </div>
              {positiveKw.length === 0 ? (
                <p className="px-5 py-10 text-xs text-[#9CA3AF] text-center">Not enough positive reviews yet.</p>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  {positiveKw.map(([word, count]) => (
                    <KeywordRow
                      key={word}
                      word={word}
                      count={count}
                      max={maxPos}
                      color="#10B981"
                      addedToAgent={addedKeywords.has(word.toLowerCase())}
                      onAddToAgent={handleAddToAgent}
                    />
                  ))}
                </div>
              )}
              {positiveKw.length > 0 && (
                <div className="px-5 py-3 border-t border-[#E5EAE8] bg-[#FAFAFA]">
                  <p className="text-[10px] text-[#9CA3AF]">Hover a keyword and click <span className="font-semibold text-[#0D4C3C]">+ Add to Agent</span> to train your AI to mention it in replies.</p>
                </div>
              )}
            </div>

            {/* Negative keywords */}
            <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5EAE8] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Common complaints</p>
                <span className="ml-auto text-[10px] text-[#9CA3AF]">{negCount} negative reviews</span>
              </div>
              {negativeKw.length === 0 ? (
                <p className="px-5 py-10 text-xs text-[#9CA3AF] text-center">No negative reviews found.</p>
              ) : (
                <div className="px-5 py-4 space-y-3">
                  {negativeKw.map(([word, count]) => (
                    <KeywordRow
                      key={word}
                      word={word}
                      count={count}
                      max={maxNeg}
                      color="#F87171"
                      addedToAgent={addedKeywords.has(word.toLowerCase())}
                      onAddToAgent={handleAddToAgent}
                    />
                  ))}
                </div>
              )}
              {negativeKw.length > 0 && (
                <div className="px-5 py-3 border-t border-[#E5EAE8] bg-[#FAFAFA]">
                  <p className="text-[10px] text-[#9CA3AF]">Add complaint keywords so the Agent acknowledges recurring issues empathetically in replies.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-start gap-3 bg-white shadow-lg rounded-xl px-4 py-3 max-w-sm border border-[#E5EAE8] transition-all duration-300`}>
          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${toast.type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`}>
            {toast.type === 'error'
              ? <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
              : <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            }
          </div>
          <p className="text-sm text-[#374151] leading-snug">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
