import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { brandBrainService, KeywordContext } from '@/features/brand-brain/brandBrain.service';
import { useLocationStore } from '@/features/location/location.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type Review = { id: string; body: string; rating: number; published_at: string; location_id: string | null };
type DateRange = '7d' | '30d' | '90d' | 'all';
type Tab = 'keywords' | 'trends' | 'rating' | 'agent';

// ── NLP helpers ───────────────────────────────────────────────────────────────

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

// ── Date utilities ────────────────────────────────────────────────────────────

function cutoffDate(range: DateRange): Date | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
  return d;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// ── Glass Card ────────────────────────────────────────────────────────────────

function GlassCard({ children, className = '', tint = 'default' }: {
  children: React.ReactNode;
  className?: string;
  tint?: 'default' | 'green' | 'red' | 'amber';
}) {
  const tintCls = {
    default: 'from-[#6C55E8]/3',
    green:   'from-emerald-500/4',
    red:     'from-red-500/4',
    amber:   'from-amber-500/4',
  }[tint];
  return (
    <div className={`relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tintCls} via-transparent to-transparent pointer-events-none rounded-2xl`}/>
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'default', icon }: {
  label: string; value: string | number; sub?: string;
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue';
  icon: React.ReactNode;
}) {
  const valueCls = {
    default: 'text-[#111827]',
    green:   'text-emerald-600',
    red:     'text-red-500',
    amber:   'text-amber-500',
    blue:    'text-blue-600',
  }[color];
  return (
    <GlassCard className="flex-1 min-w-[120px] px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-2xl font-bold leading-none ${valueCls}`}>{value}</p>
          {sub && <p className="text-[10px] text-[#9CA3AF] mt-1">{sub}</p>}
        </div>
        <div className="text-[#9CA3AF] flex-shrink-0 mt-0.5">{icon}</div>
      </div>
    </GlassCard>
  );
}

// ── Word Cloud ────────────────────────────────────────────────────────────────

function WordCloud({ positive, negative }: { positive: [string, number][]; negative: [string, number][] }) {
  const allWords = useMemo(() => {
    const posSet = new Set(positive.map(([w]) => w));
    const merged: { word: string; count: number; sentiment: 'pos' | 'neg' | 'both' }[] = [];
    for (const [w, c] of positive) {
      const negEntry = negative.find(([nw]) => nw === w);
      merged.push({ word: w, count: c + (negEntry?.[1] ?? 0), sentiment: negEntry ? 'both' : 'pos' });
    }
    for (const [w, c] of negative) {
      if (!posSet.has(w)) merged.push({ word: w, count: c, sentiment: 'neg' });
    }
    return merged.sort((a, b) => b.count - a.count).slice(0, 40);
  }, [positive, negative]);

  if (allWords.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-[#9CA3AF]">
        Not enough review text to build word cloud.
      </div>
    );
  }

  const max = allWords[0]?.count ?? 1;

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center py-4 px-4 min-h-[140px]">
      {allWords.map(({ word, count, sentiment }) => {
        const ratio = count / max;
        const size = ratio > 0.7 ? 'text-xl font-bold' : ratio > 0.45 ? 'text-base font-semibold' : ratio > 0.25 ? 'text-sm font-medium' : 'text-xs';
        const cls = sentiment === 'pos'
          ? 'text-emerald-700 bg-emerald-50/70 border-emerald-200/60'
          : sentiment === 'neg'
          ? 'text-red-600 bg-red-50/70 border-red-200/60'
          : 'text-[#6C55E8] bg-[#EDE9FE]/70 border-[#6C55E8]/20';
        return (
          <span key={word}
            className={`px-2.5 py-1 rounded-xl border backdrop-blur-sm transition-all cursor-default select-none ${size} ${cls}`}
            title={`${count} mention${count !== 1 ? 's' : ''}`}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ── Rating Donut ──────────────────────────────────────────────────────────────

function RatingDonut({ reviews }: { reviews: Review[] }) {
  const counts = useMemo(() => [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  })), [reviews]);

  const total = reviews.length;
  if (total === 0) return (
    <div className="flex items-center justify-center h-48 text-xs text-[#9CA3AF]">No reviews to display.</div>
  );

  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1);
  const COLORS = ['#10B981', '#34D399', '#FBBF24', '#FB923C', '#F87171'];
  const R = 60, CX = 80, CY = 80, SW = 18;
  const circum = 2 * Math.PI * R;

  let offset = 0;
  const arcs = counts.map(({ star, count }, i) => {
    const pct = count / total;
    const dash = pct * circum;
    const arc = { star, count, pct, dash, offset, color: COLORS[5 - star] ?? '#9CA3AF' };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={SW}/>
          {arcs.map(arc => arc.count > 0 && (
            <circle key={arc.star} cx={CX} cy={CY} r={R} fill="none"
              stroke={arc.color} strokeWidth={SW}
              strokeDasharray={`${arc.dash} ${circum - arc.dash}`}
              strokeDashoffset={circum - arc.offset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#111827]">{avgRating}</span>
          <span className="text-[10px] text-[#9CA3AF]">avg rating</span>
        </div>
      </div>

      <div className="flex-1 min-w-[160px] space-y-2">
        {counts.map(({ star, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const color = COLORS[5 - star] ?? '#9CA3AF';
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] w-4 text-right flex-shrink-0">{star}★</span>
              <div className="flex-1 bg-[#F3F4F6]/80 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
              </div>
              <span className="text-xs text-[#9CA3AF] w-8 text-right flex-shrink-0">{pct}%</span>
              <span className="text-xs text-[#374151] font-medium w-6 text-right flex-shrink-0">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day of Week Heatmap ───────────────────────────────────────────────────────

function DayHeatmap({ reviews }: { reviews: Review[] }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const data = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    const ratings = Array(7).fill(0) as number[];
    for (const r of reviews) {
      if (!r.published_at) continue;
      const day = new Date(r.published_at).getDay();
      const idx = day === 0 ? 6 : day - 1;
      counts[idx]!++;
      ratings[idx]! += r.rating;
    }
    return DAYS.map((d, i) => ({
      day: d,
      count: counts[i] ?? 0,
      avg: counts[i]! > 0 ? ratings[i]! / counts[i]! : 0,
    }));
  }, [reviews]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map(({ day, count, avg }) => {
        const intensity = count / maxCount;
        const bg = intensity > 0.7 ? 'bg-[#111827]' : intensity > 0.4 ? 'bg-[#111827]/60' : intensity > 0.1 ? 'bg-[#111827]/25' : 'bg-[#F3F4F6]/80';
        const textCls = intensity > 0.7 ? 'text-white' : 'text-[#374151]';
        return (
          <div key={day} className="flex items-center gap-3">
            <span className="text-xs text-[#9CA3AF] w-8 flex-shrink-0">{day}</span>
            <div className={`flex-1 h-8 rounded-xl flex items-center px-3 transition-all ${bg}`}>
              <span className={`text-xs font-medium ${textCls}`}>{count > 0 ? `${count} review${count !== 1 ? 's' : ''}` : ''}</span>
              {avg > 0 && <span className={`ml-auto text-[10px] ${textCls} opacity-80`}>{avg.toFixed(1)}★</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly Cohort Chart ──────────────────────────────────────────────────────

function MonthlyCohort({ reviews }: { reviews: Review[] }) {
  const months = useMemo(() => {
    const map = new Map<string, { count: number; ratingSum: number }>();
    for (const r of reviews) {
      if (!r.published_at) continue;
      const k = monthKey(r.published_at);
      const cur = map.get(k) ?? { count: 0, ratingSum: 0 };
      cur.count++;
      cur.ratingSum += r.rating;
      map.set(k, cur);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([k, v]) => ({
        key: k,
        label: new Date(k + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
        count: v.count,
        avg: v.count > 0 ? v.ratingSum / v.count : 0,
      }));
  }, [reviews]);

  if (months.length < 2) return (
    <div className="flex items-center justify-center h-32 text-xs text-[#9CA3AF]">
      Need at least 2 months of data for cohort view.
    </div>
  );

  const maxCount = Math.max(...months.map(m => m.count), 1);
  const W = 800, H = 140, PL = 8, PR = 8, PT = 8, PB = 28;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const step = innerW / (months.length - 1);

  const pts = months.map((m, i) => ({
    x: PL + i * step,
    y: PT + innerH - (m.count / maxCount) * innerH,
    m,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1]!.x} ${PT + innerH} L ${pts[0]!.x} ${PT + innerH} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }} aria-hidden="true">
        <defs>
          <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C55E8" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#6C55E8" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#monthGrad)"/>
        <path d={linePath} fill="none" stroke="#6C55E8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#6C55E8" stroke="white" strokeWidth={1.5}/>
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9CA3AF">{p.m.label}</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-1 mt-2 flex-wrap">
        {months.map(m => (
          <div key={m.key} className="flex-1 min-w-[60px] text-center">
            <p className="text-[10px] font-bold text-[#111827]">{m.count}</p>
            <p className="text-[9px] text-amber-500">{m.avg > 0 ? `${m.avg.toFixed(1)}★` : '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sentiment Momentum ────────────────────────────────────────────────────────

function SentimentMomentum({ reviews }: { reviews: Review[] }) {
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
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-16);
  }, [reviews]);

  if (weeks.length < 2) return (
    <div className="flex items-center justify-center h-32 text-xs text-[#9CA3AF]">
      Need at least 2 weeks of data.
    </div>
  );

  const W = 800, H = 120, PL = 8, PR = 8, PT = 8, PB = 24;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const step = innerW / (weeks.length - 1);

  const pcts = weeks.map(([, v]) => {
    const total = v.pos + v.neg + v.neu;
    return total > 0 ? (v.pos / total) * 100 : 0;
  });

  const pts = pcts.map((p, i) => ({
    x: PL + i * step,
    y: PT + innerH - (p / 100) * innerH,
    pct: p,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1]!.x} ${PT + innerH} L ${pts[0]!.x} ${PT + innerH} Z`;
  const avgPct = pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0;
  const avgY = PT + innerH - (avgPct / 100) * innerH;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div>
          <p className="text-2xl font-bold text-[#111827]">{Math.round(avgPct)}%</p>
          <p className="text-xs text-[#9CA3AF]">avg positive sentiment</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
            <span className="w-3 h-1.5 rounded-full bg-[#111827] inline-block"/>Positive %
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
            <svg width="16" height="6" viewBox="0 0 16 6"><line x1="0" y1="3" x2="16" y2="3" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 2"/></svg>
            Average
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }} aria-hidden="true">
        <defs>
          <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C55E8" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#6C55E8" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <line x1={PL} y1={avgY} x2={W - PR} y2={avgY} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.6}/>
        <path d={areaPath} fill="url(#sentGrad)"/>
        <path d={linePath} fill="none" stroke="#6C55E8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6C55E8" stroke="white" strokeWidth={1.5}/>
        ))}
        {weeks.map(([k], i) => {
          if (weeks.length > 8 && i % 2 !== 0) return null;
          const x = PL + i * step;
          const d = new Date(k);
          const label = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
          return <text key={k} x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#9CA3AF">{label}</text>;
        })}
      </svg>
    </div>
  );
}

// ── Weekly Table ──────────────────────────────────────────────────────────────

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
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[#E5E7EB]/60">
          <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Week of</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Total</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">4–5★</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">3★</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-red-400 uppercase tracking-wide">1–2★</th>
          <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Sentiment</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#F3F4F6]/60">
        {rows.map(([k, v]) => {
          const pct = v.total > 0 ? Math.round((v.pos / v.total) * 100) : 0;
          const d = new Date(k);
          const label = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
          return (
            <tr key={k} className="hover:bg-white/40 transition-colors">
              <td className="px-5 py-2.5 text-[#374151] font-medium">{label}</td>
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
  );
}

// ── Context editor modal ──────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 w-full max-w-md">
        <div className="px-6 py-5 border-b border-[#E5E7EB]/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#111827]">Add to Brand Brain</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Instruction for "<span className="font-semibold text-[#6C55E8]">{keyword}</span>"</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-[#374151] mb-2">Agent instruction</label>
          <textarea value={context} onChange={e => setContext(e.target.value)} rows={4}
            className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#6C55E8] transition-colors resize-none"/>
          <p className="text-[10px] text-[#9CA3AF] mt-1.5">Added to Brand Brain keyword-triggered context rules.</p>
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm font-medium text-[#6B7280] hover:text-[#374151] px-4 py-2 rounded-xl hover:bg-[#F3F4F6] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !context.trim()}
            className="flex items-center gap-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving && <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}
            {saving ? 'Saving…' : 'Add to Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review drawer ─────────────────────────────────────────────────────────────

function ReviewDrawer({ keyword, reviews, onClose }: { keyword: string; reviews: Review[]; onClose: () => void }) {
  const matched = reviewsMatchingKeyword(reviews, keyword);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose}/>
      <div className="relative bg-white/90 backdrop-blur-xl w-full max-w-md shadow-2xl flex flex-col border-l border-white/60 h-full">
        <div className="px-6 py-4 border-b border-[#E5E7EB]/60 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-[#111827]">Reviews mentioning "{keyword}"</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{matched.length} result{matched.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {matched.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] text-center py-8">No matching reviews.</p>
          ) : matched.map(r => {
            const stars = r.rating;
            const color = stars >= 4 ? 'text-emerald-600 bg-emerald-50' : stars <= 2 ? 'text-red-500 bg-red-50' : 'text-amber-600 bg-amber-50';
            const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const parts = r.body.split(new RegExp(`(${escapedKw})`, 'gi'));
            return (
              <div key={r.id} className="border border-[#E5E7EB]/60 rounded-2xl p-4 bg-white/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${color}`}>
                    {'★'.repeat(stars)}{'☆'.repeat(5 - stars)} {stars}★
                  </span>
                  {r.published_at && (
                    <span className="text-[10px] text-[#9CA3AF] ml-auto">{new Date(r.published_at).toLocaleDateString()}</span>
                  )}
                </div>
                <p className="text-xs text-[#374151] leading-relaxed">
                  {parts.map((part, i) =>
                    part.toLowerCase() === keyword.toLowerCase()
                      ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
                      : part
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Keyword row ───────────────────────────────────────────────────────────────

function KeywordRow({ word, count, max, color, addedToAgent, onAddToAgent, onDrillDown }: {
  word: string; count: number; max: number; color: string;
  addedToAgent: boolean;
  onAddToAgent: (word: string) => void;
  onDrillDown: (word: string) => void;
}) {
  const pct = Math.max(4, Math.round((count / max) * 100));
  return (
    <div className="flex items-center gap-3 group">
      <button onClick={() => onDrillDown(word)}
        className="text-xs font-medium text-[#374151] w-36 truncate flex-shrink-0 text-left hover:text-[#6C55E8] hover:underline transition-colors"
        title={`See reviews mentioning "${word}"`}>
        {word}
      </button>
      <div className="flex-1 bg-[#F3F4F6]/80 rounded-full h-1.5">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
      </div>
      <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
      {addedToAgent ? (
        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#6C55E8] bg-[#EDE9FE] px-2 py-0.5 rounded-lg">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
          Added
        </span>
      ) : (
        <button onClick={() => onAddToAgent(word)}
          className="flex-shrink-0 text-[10px] font-semibold text-[#6C55E8] border border-[#6C55E8] px-2.5 py-0.5 rounded-lg hover:bg-[#EDE9FE] transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 focus:opacity-100">
          + Add to Agent
        </button>
      )}
    </div>
  );
}

// ── Agent Keywords Tab ────────────────────────────────────────────────────────

function AgentKeywordsTab({ keywordContexts, onRemove, onUpdate }: {
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
      <GlassCard className="flex flex-col items-center justify-center py-24">
        <svg className="w-10 h-10 text-[#D1D5DB] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
        </svg>
        <p className="text-sm font-semibold text-[#374151]">No keywords added yet</p>
        <p className="text-xs text-[#9CA3AF] mt-1.5 text-center max-w-xs">Go to the Keywords tab and click "+ Add to Agent" next to any keyword.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60 flex items-center gap-2">
        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Keyword Rules in Brand Brain</p>
        <span className="ml-auto text-[10px] text-[#9CA3AF]">{keywordContexts.length} rule{keywordContexts.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-[#F3F4F6]/60">
        {keywordContexts.map(kc => (
          <div key={kc.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#6C55E8] mb-1">{kc.keyword}</p>
                {editingId === kc.id ? (
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3}
                    className="w-full text-xs text-[#374151] border border-[#D1D5DB] rounded-xl px-3 py-2 focus:outline-none focus:border-[#6C55E8] transition-colors resize-none"/>
                ) : (
                  <p className="text-xs text-[#6B7280] leading-relaxed">{kc.context}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                {editingId === kc.id ? (
                  <>
                    <button onClick={async () => { setSavingId(kc.id); await onUpdate(kc.id, editValue); setSavingId(null); setEditingId(null); }}
                      disabled={savingId === kc.id}
                      className="text-[10px] font-semibold text-white bg-[#111827] hover:bg-[#6C55E8] px-2.5 py-1 rounded-lg disabled:opacity-50 transition-colors">
                      {savingId === kc.id ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] font-medium text-[#6B7280] hover:text-[#374151] px-2 py-1 rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(kc.id); setEditValue(kc.context); }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#374151] transition-colors" title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={async () => { setRemovingId(kc.id); await onRemove(kc.id); setRemovingId(null); }}
                      disabled={removingId === kc.id}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 disabled:opacity-40 transition-colors" title="Remove">
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
    </GlassCard>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonPanel() {
  return (
    <GlassCard className="animate-pulse">
      <div className="h-12 bg-[#F3F4F6]/80 rounded-t-2xl"/>
      <div className="p-5 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 h-3 bg-[#F3F4F6]/80 rounded-full flex-shrink-0"/>
            <div className="flex-1 h-1.5 bg-[#F3F4F6]/80 rounded-full"/>
            <div className="w-4 h-3 bg-[#F3F4F6]/80 rounded-full flex-shrink-0"/>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Filter Dropdown ───────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
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
        className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] border border-[#D1D5DB] hover:border-[#374151] hover:text-[#111827] rounded-lg px-3 py-1.5 transition-colors">
        <span>{current?.label}</span>
        <svg className="w-3 h-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-[200] bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[130px]">
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${value === o.value ? 'text-[#6C55E8] font-semibold bg-[#F3F4F6]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function InsightsPage() {
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [keywordContexts, setKeywordContexts] = useState<KeywordContext[]>([]);
  const [loading, setLoading] = useState(true);

  const { selectedId: globalLocationId, locations: selectedLocations } = useLocationStore();
  const [tab, setTab] = useState<Tab>('keywords');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [starFilter, setStarFilter] = useState<string>('all');
  const [showBigrams, setShowBigrams] = useState(false);
  const [showWordCloud, setShowWordCloud] = useState(true);

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
  const neuCount = reviews.filter(r => r.rating === 3).length;
  const sentimentPct = totalReviews > 0 ? Math.round((posCount / totalReviews) * 100) : 0;
  const avgRating = totalReviews > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1) : '—';

  const reviewsThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return allReviews.filter(r => r.published_at && new Date(r.published_at) >= cutoff).length;
  }, [allReviews]);

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
    const { error } = await supabase.from('brand_brain').upsert({ user_id: user.id, keyword_contexts: updated }, { onConflict: 'user_id' });
    if (error) { showToast(error.message, 'error'); return; }
    setKeywordContexts(updated);
    setAddedKeywords(new Set(updated.map(k => k.keyword.toLowerCase())));
    showToast('Keyword rule removed.', 'success');
  }

  async function handleUpdateKeyword(id: string, context: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updated = keywordContexts.map(k => k.id === id ? { ...k, context } : k);
    const { error } = await supabase.from('brand_brain').upsert({ user_id: user.id, keyword_contexts: updated }, { onConflict: 'user_id' });
    if (error) { showToast(error.message, 'error'); return; }
    setKeywordContexts(updated);
    showToast('Keyword rule updated.', 'success');
  }

  const dateOptions: { value: DateRange; label: string }[] = [
    { value: '7d',  label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ];

  const starOptions = [
    { value: 'all', label: 'All ratings' },
    { value: '5',   label: '5★ only' },
    { value: '4',   label: '4★ only' },
    { value: '3',   label: '3★ only' },
    { value: '2',   label: '2★ only' },
    { value: '1',   label: '1★ only' },
  ];

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'keywords', label: 'Keywords', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg> },
    { id: 'trends',   label: 'Trends',   icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4"/></svg> },
    { id: 'rating',   label: 'Ratings',  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg> },
    { id: 'agent',    label: `Agent Rules${keywordContexts.length > 0 ? ` (${keywordContexts.length})` : ''}`, icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg> },
  ];

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#111827]/5 blur-3xl" aria-hidden="true"/>
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/4 blur-3xl" aria-hidden="true"/>

      {/* Header */}
      <div className="relative z-10 px-4 md:px-8 py-4 flex-shrink-0 border-b border-white/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Review Insights</h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Analyse patterns and train your AI Agent</p>
          </div>
          <a href="/brand-brain"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6C55E8] border border-[#6C55E8]/40 bg-white/60 backdrop-blur-sm px-3.5 py-2 rounded-xl hover:bg-[#EDE9FE] transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
            </svg>
            Brand Brain
          </a>
        </div>

        {/* Stat strip */}
        {!loading && totalReviews > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <StatCard label="Reviews" value={totalReviews} sub={`${reviewsThisWeek} this week`}
              color="default"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
            />
            <StatCard label="Avg Rating" value={`${avgRating}★`} sub={`${posCount} positive`}
              color="amber"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>}
            />
            <StatCard label="Sentiment" value={`${sentimentPct}%`} sub={`${negCount} negative`}
              color={sentimentPct >= 70 ? 'green' : sentimentPct >= 40 ? 'amber' : 'red'}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <StatCard label="Neutral" value={neuCount} sub="3★ reviews"
              color="default"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <StatCard label="Agent Rules" value={keywordContexts.length} sub="keyword triggers"
              color="blue"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5"/></svg>}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-4 -mb-4 border-b border-[#E5E7EB]/60">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id ? 'border-[#6C55E8] text-[#6C55E8]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      {tab !== 'agent' && (
        <div className="flex-shrink-0 border-b border-[#E5E7EB]/60 px-4 md:px-8 py-2.5 flex items-center gap-2.5 flex-wrap">
          <FilterDropdown value={dateRange} onChange={setDateRange} options={dateOptions}/>
          <FilterDropdown value={starFilter} onChange={setStarFilter} options={starOptions}/>
          {tab === 'keywords' && (
            <>
              <button onClick={() => setShowBigrams(b => !b)}
                className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                  showBigrams ? 'border-[#6C55E8] text-[#6C55E8] bg-[#EDE9FE]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#111827]'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                {showBigrams ? 'Phrases' : 'Single words'}
              </button>
              <button onClick={() => setShowWordCloud(s => !s)}
                className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                  showWordCloud ? 'border-[#6C55E8] text-[#6C55E8] bg-[#EDE9FE]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#374151] hover:text-[#111827]'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                Word Cloud
              </button>
            </>
          )}
          {(dateRange !== '30d' || starFilter !== 'all') && (
            <button onClick={() => { setDateRange('30d'); setStarFilter('all'); }}
              className="text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors underline">
              Reset
            </button>
          )}
          <span className="ml-auto text-xs text-[#9CA3AF]">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-5">

        {/* ── Keywords tab ── */}
        {tab === 'keywords' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><SkeletonPanel/><SkeletonPanel/></div>
          ) : totalReviews === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-24">
              <svg className="w-12 h-12 text-[#D1D5DB] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <p className="text-sm font-semibold text-[#374151]">No reviews in this range</p>
              <p className="text-xs text-[#9CA3AF] mt-1.5">Try a wider date range or reset filters.</p>
            </GlassCard>
          ) : (
            <>
              {/* Word cloud */}
              {showWordCloud && (
                <GlassCard>
                  <div className="px-5 py-3 border-b border-[#E5E7EB]/60 flex items-center gap-2">
                    <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Word Cloud</p>
                    <div className="flex items-center gap-3 ml-auto text-[10px] text-[#6B7280]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Positive</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Negative</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#111827] inline-block"/>Both</span>
                    </div>
                  </div>
                  <WordCloud positive={positiveKw} negative={negativeKw}/>
                </GlassCard>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Positive keywords */}
                <GlassCard tint="green">
                  <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"/>
                    <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">What customers love</p>
                    <span className="ml-auto text-[10px] text-[#9CA3AF]">{posCount} reviews</span>
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
                    <div className="px-5 py-3 border-t border-[#E5E7EB]/60">
                      <p className="text-[10px] text-[#9CA3AF]">Click to drill down · Hover to add to Agent</p>
                    </div>
                  )}
                </GlassCard>

                {/* Negative keywords */}
                <GlassCard tint="red">
                  <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                    <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Common complaints</p>
                    <span className="ml-auto text-[10px] text-[#9CA3AF]">{negCount} reviews</span>
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
                    <div className="px-5 py-3 border-t border-[#E5E7EB]/60">
                      <p className="text-[10px] text-[#9CA3AF]">Add complaint keywords so the Agent addresses them proactively.</p>
                    </div>
                  )}
                </GlassCard>
              </div>
            </>
          )
        )}

        {/* ── Trends tab ── */}
        {tab === 'trends' && (
          loading ? <SkeletonPanel/> : (
            <>
              {/* Sentiment momentum */}
              <GlassCard>
                <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Sentiment Momentum</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">Weekly positive % over time</p>
                </div>
                <div className="px-5 py-4">
                  <SentimentMomentum reviews={reviews}/>
                </div>
              </GlassCard>

              {/* Day of week */}
              <GlassCard>
                <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Review Volume by Day</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">Which days receive the most reviews</p>
                </div>
                <div className="px-5 py-4">
                  <DayHeatmap reviews={reviews}/>
                </div>
              </GlassCard>

              {/* Weekly breakdown table */}
              <GlassCard>
                <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Weekly Breakdown</p>
                </div>
                <WeeklyTable reviews={reviews}/>
              </GlassCard>
            </>
          )
        )}

        {/* ── Rating Analysis tab ── */}
        {tab === 'rating' && (
          loading ? <SkeletonPanel/> : (
            <>
              {/* Rating distribution */}
              <GlassCard tint="amber">
                <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60">
                  <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Rating Distribution</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">Breakdown by star rating</p>
                </div>
                <div className="px-5 py-5">
                  <RatingDonut reviews={reviews}/>
                </div>
              </GlassCard>

              {/* Monthly cohort */}
              <GlassCard>
                <div className="px-5 py-3.5 border-b border-[#E5E7EB]/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Monthly Volume</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">Reviews per month + avg rating</p>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <MonthlyCohort reviews={allReviews}/>
                </div>
              </GlassCard>

              {/* Quick stats grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Positive Rate',
                    value: totalReviews > 0 ? `${Math.round((posCount / totalReviews) * 100)}%` : '—',
                    sub: '4–5★ reviews',
                    color: 'text-emerald-600',
                    bg: 'from-emerald-500/4',
                  },
                  {
                    label: 'Critical Rate',
                    value: totalReviews > 0 ? `${Math.round((negCount / totalReviews) * 100)}%` : '—',
                    sub: '1–2★ reviews',
                    color: 'text-red-500',
                    bg: 'from-red-500/4',
                  },
                  {
                    label: 'Neutral Rate',
                    value: totalReviews > 0 ? `${Math.round((neuCount / totalReviews) * 100)}%` : '—',
                    sub: '3★ reviews',
                    color: 'text-amber-500',
                    bg: 'from-amber-500/4',
                  },
                ].map(s => (
                  <div key={s.label} className={`relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 px-5 py-5`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} via-transparent to-transparent pointer-events-none rounded-2xl`}/>
                    <div className="relative">
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1">{s.label}</p>
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-[#9CA3AF] mt-1">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {/* ── Agent Rules tab ── */}
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
        <ContextModal keyword={contextModalWord} onConfirm={handleConfirmAddToAgent} onClose={() => setContextModalWord(null)}/>
      )}

      {/* Review drill-down drawer */}
      {drawerWord && (
        <ReviewDrawer keyword={drawerWord} reviews={reviews} onClose={() => setDrawerWord(null)}/>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-[100] flex items-start gap-3 bg-white/90 backdrop-blur-md shadow-lg rounded-2xl px-4 py-3 max-w-sm border border-white/60">
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
