import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { brandBrainService, KeywordContext } from '@/features/brand-brain/brandBrain.service';
import { useLocationStore } from '@/features/location/location.store';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Review = { id: string; body: string; rating: number; published_at: string; location_id: string | null };
type DateRange = '7d' | '30d' | '90d' | 'all';
type Tab = 'keywords' | 'trends' | 'agent';

// â”€â”€ NLP helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  'always','again','still','going','went','came','said','told','gave','over','after',
  'before','been','each','they','their','from','have','with','this','will','your',
  'that','were','what','when','been','have','more','also','such','than','then',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

function extractKeywords(texts: string[], limit = 20): [string, number][] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    for (const w of tokenize(text)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function extractBigrams(texts: string[], limit = 15): [string, number][] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
    }
  }
  return [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function reviewsMatchingKeyword(reviews: Review[], keyword: string): Review[] {
  const lower = keyword.toLowerCase();
  return reviews.filter(r => r.body?.toLowerCase().includes(lower));
}

// â”€â”€ Date utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function cutoffDate(range: DateRange): Date | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
  return d;
}

function formatWeek(date: Date) {
  return `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

// â”€â”€ Trend chart (SVG) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TrendChart({ reviews }: { reviews: Review[] }) {
  const W = 680, H = 180, PAD = { top: 16, right: 20, bottom: 32, left: 36 };

  const weeks = useMemo(() => {
    const map = new Map<string, { pos: number; neg: number; neu: number }>();
    for (const r of reviews) {
      if (!r.published_at) continue;
      const k = weekKey(r.published_at);
      const cur = map.get(k) ?? { pos: 0, neg: 0, neu: 0 };
      if (r.rating >= 4) cur.pos++;
      else if (r.rating <= 2) cur.neg++;
      else cur.neu++;
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  }, [reviews]);

  if (weeks.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 border border-[#E5EAE8] rounded-xl bg-[#FAFAFA]">
        <p className="text-xs text-[#9CA3AF]">Not enough data for trend chart – need at least 2 weeks of reviews.</p>
      </div>
    );
  }

  const maxVal = Math.max(...weeks.map(([, v]) => v.pos + v.neg + v.neu), 1);
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const stepX = cW / (weeks.length - 1);

  function pts(getValue: (v: { pos: number; neg: number; neu: number }) => number) {
    return weeks.map(([, v], i) => {
      const x = PAD.left + i * stepX;
      const y = PAD.top + cH - (getValue(v) / maxVal) * cH;
      return `${x},${y}`;
    }).join(' ');
  }

  function area(getValue: (v: { pos: number; neg: number; neu: number }) => number) {
    const firstX = PAD.left;
    const lastX = PAD.left + (weeks.length - 1) * stepX;
    const baseY = PAD.top + cH;
    return `M ${firstX},${baseY} L ${pts(getValue).split(' ').map((p, i) => i === 0 ? `${p}` : `L ${p}`).join(' ')} L ${lastX},${baseY} Z`;
  }

  const posPath = area(v => v.pos);
  const negPath = area(v => v.neg);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5EAE8] flex items-center gap-4">
        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Weekly Sentiment</p>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-[10px] text-[#6B7280]"><span className="w-3 h-2 rounded-xl bg-emerald-400/60 inline-block"/>Positive</span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#6B7280]"><span className="w-3 h-2 rounded-xl bg-red-300/60 inline-block"/>Negative</span>
        </div>
      </div>
      <div className="px-4 py-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = PAD.top + cH - (tick / maxVal) * cH;
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#F3F4F6" strokeWidth="1"/>
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{tick}</text>
              </g>
            );
          })}

          {/* Area fills */}
          <path d={posPath} fill="#10B981" fillOpacity="0.15"/>
          <path d={negPath} fill="#F87171" fillOpacity="0.2"/>

          {/* Lines */}
          <polyline points={pts(v => v.pos)} fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round"/>
          <polyline points={pts(v => v.neg)} fill="none" stroke="#F87171" strokeWidth="1.5" strokeLinejoin="round"/>

          {/* Dots */}
          {weeks.map(([, v], i) => {
            const x = PAD.left + i * stepX;
            const yPos = PAD.top + cH - (v.pos / maxVal) * cH;
            const yNeg = PAD.top + cH - (v.neg / maxVal) * cH;
            return (
              <g key={i}>
                <circle cx={x} cy={yPos} r="2.5" fill="#10B981"/>
                <circle cx={x} cy={yNeg} r="2.5" fill="#F87171"/>
              </g>
            );
          })}

          {/* X-axis labels */}
          {weeks.map(([k], i) => {
            if (weeks.length > 8 && i % 2 !== 0) return null;
            const x = PAD.left + i * stepX;
            return (
              <text key={k} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {formatWeek(new Date(k))}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// â”€â”€ Weekly table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WeeklyTable({ reviews }: { reviews: Review[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { pos: number; neg: number; neu: number; total: number }>();
    for (const r of reviews) {
      if (!r.published_at) continue;
      const k = weekKey(r.published_at);
      const cur = map.get(k) ?? { pos: 0, neg: 0, neu: 0, total: 0 };
      if (r.rating >= 4) cur.pos++;
      else if (r.rating <= 2) cur.neg++;
      else cur.neu++;
      cur.total++;
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8);
  }, [reviews]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mt-4">
      <div className="px-5 py-3 border-b border-[#E5EAE8]">
        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Weekly Breakdown</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA]">
            <th className="text-left px-5 py-2 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Week of</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Total</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">4–5★</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">3★</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-red-400 uppercase tracking-wide">1–2★</th>
            <th className="text-right px-5 py-2 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => {
            const pct = v.total > 0 ? Math.round((v.pos / v.total) * 100) : 0;
            return (
              <tr key={k} className="border-b border-[#F9FAFB] hover:bg-[#FAFAFA]">
                <td className="px-5 py-2.5 text-[#374151] font-medium">{formatWeek(new Date(k))}</td>
                <td className="px-4 py-2.5 text-right text-[#374151] font-semibold">{v.total}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{v.pos}</td>
                <td className="px-4 py-2.5 text-right text-[#9CA3AF]">{v.neu}</td>
                <td className="px-4 py-2.5 text-right text-red-400 font-medium">{v.neg}</td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`font-semibold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€ Context editor modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ContextModal({ keyword, onConfirm, onClose }: {
  keyword: string;
  onConfirm: (keyword: string, context: string) => Promise<void>;
  onClose: () => void;
}) {
  const [context, setContext] = useState(
    `When the keyword "${keyword}" appears in a review, acknowledge it specifically in your reply.`
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onConfirm(keyword, context);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5EAE8] w-full max-w-md mx-4">
        <div className="px-6 py-5 border-b border-[#E5EAE8]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#111827]">Add to Brand Brain</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Define what the Agent should do when it sees "<span className="font-semibold text-[#0D4C3C]">{keyword}</span>"</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-[#374151] mb-2">Agent instruction</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            rows={4}
            className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#0D4C3C] transition-colors resize-none placeholder:text-[#9CA3AF]"
          />
          <p className="text-[10px] text-[#9CA3AF] mt-1.5">This instruction is added to Brand Brain's keyword-triggered context rules.</p>
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm font-medium text-[#6B7280] hover:text-[#374151] px-4 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !context.trim()}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> : null}
            {saving ? 'Saving…' : 'Add to Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Review drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReviewDrawer({ keyword, reviews, onClose }: { keyword: string; reviews: Review[]; onClose: () => void }) {
  const matched = reviewsMatchingKeyword(reviews, keyword);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose}/>
      <div className="relative bg-white w-full max-w-md shadow-2xl flex flex-col border-l border-[#E5EAE8] h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5EAE8] flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-[#111827]">Reviews mentioning "{keyword}"</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{matched.length} result{matched.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Review list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {matched.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] text-center py-8">No matching reviews.</p>
          ) : matched.map(r => {
            const stars = r.rating;
            const color = stars >= 4 ? 'text-emerald-600 bg-emerald-50' : stars <= 2 ? 'text-red-500 bg-red-50' : 'text-amber-600 bg-amber-50';
            const highlighted = r.body.replace(
              new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
              '<mark class="bg-yellow-100 text-yellow-900 rounded-xl px-0.5">$1</mark>'
            );
            return (
              <div key={r.id} className="border border-[#E5EAE8] rounded-xl p-4 bg-[#FAFAFA]">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${color}`}>
                    {'★'.repeat(stars)}{'☆'.repeat(5 - stars)} {stars}★
                  </span>
                  {r.published_at && (
                    <span className="text-[10px] text-[#9CA3AF] ml-auto">{new Date(r.published_at).toLocaleDateString()}</span>
                  )}
                </div>
                <p className="text-xs text-[#374151] leading-relaxed" dangerouslySetInnerHTML={{ __html: highlighted }}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Keyword row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KeywordRow({
  word, count, max, color, addedToAgent, onAddToAgent, onDrillDown,
}: {
  word: string; count: number; max: number; color: string;
  addedToAgent: boolean;
  onAddToAgent: (word: string) => void;
  onDrillDown: (word: string) => void;
}) {
  const pct = Math.max(4, Math.round((count / max) * 100));

  return (
    <div className="flex items-center gap-3 group">
      <button
        onClick={() => onDrillDown(word)}
        className="text-xs font-medium text-[#374151] w-36 truncate flex-shrink-0 text-left hover:text-[#0D4C3C] hover:underline transition-colors"
        title={`See reviews mentioning "${word}"`}
      >
        {word}
      </button>
      <div className="flex-1 bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
      </div>
      <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
      {addedToAgent ? (
        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#0D4C3C] bg-[#E6F2EE] px-2 py-0.5 rounded-lg">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
          Added
        </span>
      ) : (
        <button
          onClick={() => onAddToAgent(word)}
          className="flex-shrink-0 text-[10px] font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-2.5 py-0.5 rounded-lg hover:bg-[#E6F2EE] transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          + Add to Agent
        </button>
      )}
    </div>
  );
}

// â”€â”€ Agent keywords tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AgentKeywordsTab({
  keywordContexts, onRemove, onUpdate,
}: {
  keywordContexts: KeywordContext[];
  onRemove: (id: string) => Promise<void>;
  onUpdate: (id: string, context: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (keywordContexts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 border border-[#E5EAE8] rounded-xl bg-white">
        <svg className="w-10 h-10 text-[#D1D5DB] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
        </svg>
        <p className="text-sm font-semibold text-[#374151]">No keywords added yet</p>
        <p className="text-xs text-[#9CA3AF] mt-1.5 text-center max-w-xs">Go to the Keywords tab and click "+ Add to Agent" next to any keyword.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5EAE8] flex items-center gap-2">
        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Keyword Rules in Brand Brain</p>
        <span className="ml-auto text-[10px] text-[#9CA3AF]">{keywordContexts.length} rule{keywordContexts.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-[#F3F4F6]">
        {keywordContexts.map(kc => (
          <div key={kc.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0D4C3C] mb-1">{kc.keyword}</p>
                {editingId === kc.id ? (
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={3}
                    className="w-full text-xs text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0D4C3C] transition-colors resize-none"
                  />
                ) : (
                  <p className="text-xs text-[#6B7280] leading-relaxed">{kc.context}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                {editingId === kc.id ? (
                  <>
                    <button
                      onClick={async () => {
                        setSavingId(kc.id);
                        await onUpdate(kc.id, editValue);
                        setSavingId(null);
                        setEditingId(null);
                      }}
                      disabled={savingId === kc.id}
                      className="text-[10px] font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] px-2.5 py-1 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {savingId === kc.id ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] font-medium text-[#6B7280] hover:text-[#374151] px-2 py-1 rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(kc.id); setEditValue(kc.context); }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#374151] transition-colors"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button
                      onClick={async () => { setRemovingId(kc.id); await onRemove(kc.id); setRemovingId(null); }}
                      disabled={removingId === kc.id}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 disabled:opacity-40 transition-colors"
                      title="Remove"
                    >
                      {removingId === kc.id
                        ? <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      }
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Filter dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FilterDropdown<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const current = options.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-[#374151] border border-[#D1D5DB] hover:border-[#9CA3AF] bg-white rounded-lg px-3 py-1.5 transition-colors">
        <span>{current?.label}</span>
        <svg className="w-3 h-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-30 bg-white border border-[#E5EAE8] rounded-xl shadow-lg py-1 min-w-[130px]">
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${value === o.value ? 'text-[#0D4C3C] font-semibold bg-[#F0F7F5]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function InsightsPage() {
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [keywordContexts, setKeywordContexts] = useState<KeywordContext[]>([]);
  const [loading, setLoading] = useState(true);

  const { selectedId: globalLocationId, locations: selectedLocations } = useLocationStore();
  const [tab, setTab] = useState<Tab>('keywords');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [starFilter, setStarFilter] = useState<string>('all');
  const [showBigrams, setShowBigrams] = useState(false);

  const [contextModalWord, setContextModalWord] = useState<string | null>(null);
  const [drawerWord, setDrawerWord] = useState<string | null>(null);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Promise.all([
      supabase.from('reviews').select('id, body, rating, published_at, location_id').order('published_at', { ascending: false }),
      brandBrainService.load(),
    ]).then(([revRes, brainRes]) => {
      setAllReviews((revRes.data ?? []).filter(r => r.body));
      const kcs: KeywordContext[] = brainRes.data?.keyword_contexts ?? [];
      setKeywordContexts(kcs);
      setAddedKeywords(new Set(kcs.map(k => k.keyword.toLowerCase())));
      setLoading(false);
    });
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  // â”€â”€ Filtered reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const reviews = useMemo(() => {
    const selectedIds = new Set(selectedLocations.map(l => l.id));
    let rs = allReviews.filter(r => !r.location_id || selectedIds.has(r.location_id));
    const cutoff = cutoffDate(dateRange);
    if (cutoff) rs = rs.filter(r => r.published_at && new Date(r.published_at) >= cutoff);
    if (globalLocationId) rs = rs.filter(r => r.location_id === globalLocationId);
    if (starFilter !== 'all') rs = rs.filter(r => String(r.rating) === starFilter);
    return rs;
  }, [allReviews, selectedLocations, dateRange, globalLocationId, starFilter]);

  const positiveReviews = useMemo(() => reviews.filter(r => r.rating >= 4), [reviews]);
  const negativeReviews = useMemo(() => reviews.filter(r => r.rating <= 2), [reviews]);

  const positiveKw = useMemo(() =>
    showBigrams ? extractBigrams(positiveReviews.map(r => r.body)) : extractKeywords(positiveReviews.map(r => r.body)),
    [positiveReviews, showBigrams]);
  const negativeKw = useMemo(() =>
    showBigrams ? extractBigrams(negativeReviews.map(r => r.body)) : extractKeywords(negativeReviews.map(r => r.body)),
    [negativeReviews, showBigrams]);

  const maxPos = positiveKw[0]?.[1] ?? 1;
  const maxNeg = negativeKw[0]?.[1] ?? 1;
  const totalReviews = reviews.length;
  const posCount = positiveReviews.length;
  const negCount = negativeReviews.length;
  const sentimentPct = totalReviews > 0 ? Math.round((posCount / totalReviews) * 100) : 0;

  // â”€â”€ Brand Brain actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleConfirmAddToAgent(keyword: string, context: string) {
    const { error } = await brandBrainService.addKeywordContext(keyword, context);
    if (error) { showToast(error.message, 'error'); return; }
    const { data } = await brandBrainService.load();
    const kcs = data?.keyword_contexts ?? [];
    setKeywordContexts(kcs);
    setAddedKeywords(new Set(kcs.map(k => k.keyword.toLowerCase())));
    setContextModalWord(null);
    showToast(`"${keyword}" added to Brand Brain.`, 'success');
  }

  async function handleRemoveKeyword(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updated = keywordContexts.filter(k => k.id !== id);
    const { error } = await supabase
      .from('brand_brain')
      .upsert({ user_id: user.id, keyword_contexts: updated }, { onConflict: 'user_id' });
    if (error) { showToast(error.message, 'error'); return; }
    setKeywordContexts(updated);
    setAddedKeywords(new Set(updated.map(k => k.keyword.toLowerCase())));
    showToast('Keyword rule removed.', 'success');
  }

  async function handleUpdateKeyword(id: string, context: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updated = keywordContexts.map(k => k.id === id ? { ...k, context } : k);
    const { error } = await supabase
      .from('brand_brain')
      .upsert({ user_id: user.id, keyword_contexts: updated }, { onConflict: 'user_id' });
    if (error) { showToast(error.message, 'error'); return; }
    setKeywordContexts(updated);
    showToast('Keyword rule updated.', 'success');
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const dateOptions: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ];

  const starOptions = [
    { value: 'all', label: 'All ratings' },
    { value: '5', label: '5★ only' },
    { value: '4', label: '4★ only' },
    { value: '3', label: '3★ only' },
    { value: '2', label: '2★ only' },
    { value: '1', label: '1★ only' },
  ];

  const TABS: { id: Tab; label: string }[] = [
    { id: 'keywords', label: 'Keywords' },
    { id: 'trends',   label: 'Trends' },
    { id: 'agent',    label: `Agent Keywords${keywordContexts.length > 0 ? ` (${keywordContexts.length})` : ''}` },
  ];

  return (
    <div className="h-full flex flex-col bg-[#F8FAF9]">
      {/* Header */}
      <div className="px-8 pt-7 pb-0 flex-shrink-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Review Insights</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Analyse patterns in your reviews and train your AI Agent.</p>
          </div>
          <a href="/brand-brain"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4C3C] border border-[#0D4C3C] px-3.5 py-2 rounded-lg hover:bg-[#E6F2EE] transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
            </svg>
            Open Brand Brain
          </a>
        </div>

        {/* Summary strip */}
        {!loading && totalReviews > 0 && (
          <div className="flex items-center gap-6 px-5 py-3.5 bg-white rounded-xl border border-[#E5EAE8] mb-5">
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
                <div className="h-2 rounded-full bg-emerald-500 flex-shrink-0 transition-all"
                  style={{ width: `${sentimentPct}%`, maxWidth: '100%', minWidth: sentimentPct > 0 ? 6 : 0 }}/>
                <div className="h-2 rounded-full bg-[#F3F4F6] flex-1"/>
              </div>
              <p className="text-[11px] text-[#6B7280]">{sentimentPct}% positive sentiment</p>
            </div>
            <div className="flex-shrink-0 text-center">
              <p className="text-xl font-bold text-[#0D4C3C]">{keywordContexts.length}</p>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mt-0.5">Agent Rules</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#0D4C3C] text-[#0D4C3C]'
                  : 'border-transparent text-[#6B7280] hover:text-[#374151]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar – sticky, outside scroll area */}
      {tab !== 'agent' && (
        <div className="px-8 py-3 flex-shrink-0 bg-[#F8FAF9] border-b border-[#E5EAE8] flex items-center gap-2.5 flex-wrap">
          <FilterDropdown value={dateRange} onChange={setDateRange} options={dateOptions}/>
          <FilterDropdown value={starFilter} onChange={setStarFilter} options={starOptions}/>
          {tab === 'keywords' && (
            <button
              onClick={() => setShowBigrams(b => !b)}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                showBigrams
                  ? 'border-[#0D4C3C] text-[#0D4C3C] bg-[#E6F2EE]'
                  : 'border-[#D1D5DB] text-[#374151] bg-white hover:border-[#9CA3AF]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
              {showBigrams ? 'Phrases (2-word)' : 'Single words'}
            </button>
          )}
          {(dateRange !== '30d' || starFilter !== 'all') && (
            <button onClick={() => { setDateRange('30d'); setStarFilter('all'); }}
              className="text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors underline">
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-5">

        {/* â”€â”€ Keywords tab â”€â”€ */}
        {tab === 'keywords' && (
          loading ? (
            <div className="grid grid-cols-2 gap-5">
              <SkeletonPanel/><SkeletonPanel/>
            </div>
          ) : totalReviews === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 border border-[#E5EAE8] rounded-xl bg-white">
              <svg className="w-12 h-12 text-[#D1D5DB] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <p className="text-sm font-semibold text-[#374151]">No reviews in this range</p>
              <p className="text-xs text-[#9CA3AF] mt-1.5">Try a wider date range or reset the filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {/* Positive */}
              <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E5EAE8] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"/>
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">What customers love</p>
                  <span className="ml-auto text-[10px] text-[#9CA3AF]">{posCount} positive reviews</span>
                </div>
                {positiveKw.length === 0 ? (
                  <p className="px-5 py-10 text-xs text-[#9CA3AF] text-center">Not enough positive reviews.</p>
                ) : (
                  <div className="px-5 py-4 space-y-3">
                    {positiveKw.map(([word, count]) => (
                      <KeywordRow key={word} word={word} count={count} max={maxPos} color="#10B981"
                        addedToAgent={addedKeywords.has(word.toLowerCase())}
                        onAddToAgent={w => setContextModalWord(w)}
                        onDrillDown={w => setDrawerWord(w)}
                      />
                    ))}
                  </div>
                )}
                {positiveKw.length > 0 && (
                  <div className="px-5 py-3 border-t border-[#E5EAE8] bg-[#FAFAFA]">
                    <p className="text-[10px] text-[#9CA3AF]">Click a word to see matching reviews. Hover to add to Agent.</p>
                  </div>
                )}
              </div>

              {/* Negative */}
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
                      <KeywordRow key={word} word={word} count={count} max={maxNeg} color="#F87171"
                        addedToAgent={addedKeywords.has(word.toLowerCase())}
                        onAddToAgent={w => setContextModalWord(w)}
                        onDrillDown={w => setDrawerWord(w)}
                      />
                    ))}
                  </div>
                )}
                {negativeKw.length > 0 && (
                  <div className="px-5 py-3 border-t border-[#E5EAE8] bg-[#FAFAFA]">
                    <p className="text-[10px] text-[#9CA3AF]">Add complaint keywords so the Agent addresses them proactively.</p>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* â”€â”€ Trends tab â”€â”€ */}
        {tab === 'trends' && (
          loading ? <SkeletonPanel/> : (
            <>
              <TrendChart reviews={reviews}/>
              <WeeklyTable reviews={reviews}/>
            </>
          )
        )}

        {/* â”€â”€ Agent keywords tab â”€â”€ */}
        {tab === 'agent' && (
          loading ? <SkeletonPanel/> : (
            <AgentKeywordsTab
              keywordContexts={keywordContexts}
              onRemove={handleRemoveKeyword}
              onUpdate={handleUpdateKeyword}
            />
          )
        )}
      </div>

      {/* Context editor modal */}
      {contextModalWord && (
        <ContextModal
          keyword={contextModalWord}
          onConfirm={handleConfirmAddToAgent}
          onClose={() => setContextModalWord(null)}
        />
      )}

      {/* Review drill-down drawer */}
      {drawerWord && (
        <ReviewDrawer
          keyword={drawerWord}
          reviews={reviews}
          onClose={() => setDrawerWord(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-start gap-3 bg-white shadow-lg rounded-xl px-4 py-3 max-w-sm border border-[#E5EAE8]">
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

