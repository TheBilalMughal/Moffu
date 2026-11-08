import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { googleService } from '@/features/google/google.service';
import { useLocationStore } from '@/features/location/location.store';
import { Toast } from '@/components/Toast';
import { DateRangePicker } from '@/components/DateRangePicker';

// ── Types ────────────────────────────────────────────────────────────────────

type DbStatus = 'NEW' | 'DRAFTING' | 'DRAFT_READY' | 'AWAITING_APPROVAL' | 'NEEDS_ATTENTION' | 'PUBLISHING' | 'PUBLISHED' | 'PUBLISH_FAILED';
type UiStatus = 'pending' | 'draft_ready' | 'replied';
type SortKey = 'newest' | 'oldest' | 'unanswered' | 'highest' | 'lowest';
interface AutoSchedule { type: 'always' | 'scheduled'; from: string; to: string; }

interface DraftHistoryItem { draft: string; created_at: string; }
interface FilterPreset { id: string; name: string; filters: SavedFilters; }
interface SavedFilters {
  search: string; statusFilter: 'all' | UiStatus;
  ratingFilter: number; locationFilter: string;
  dateFrom: string; dateTo: string; sortBy: SortKey;
  withBody?: boolean;
}
interface Review {
  id: string; reviewer_name: string; rating: number;
  published_at: string | null; body: string | null; status: DbStatus;
  reply_draft: string | null; reply_text: string | null;
  location_id: string | null; notes: string | null;
  draft_history: DraftHistoryItem[];
  reply_published_at: string | null;
}
interface Location { id: string; display_name: string | null; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function toUiStatus(s: DbStatus): UiStatus {
  if (s === 'PUBLISHED') return 'replied';
  if (['DRAFTING','DRAFT_READY','AWAITING_APPROVAL','NEEDS_ATTENTION','PUBLISHING','PUBLISH_FAILED'].includes(s)) return 'draft_ready';
  return 'pending';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${day}-${mon}-${d.getFullYear()}`;
}

function fmtAge(iso: string | null, uiStatus: UiStatus) {
  if (!iso || uiStatus === 'replied') return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const urgency = days >= 3 ? 'text-red-500' : days >= 1 ? 'text-amber-500' : 'text-[#9CA3AF]';
  return { label: days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago`, urgency };
}

function getSentiment(rating: number) {
  if (rating >= 4) return { label: 'Positive', cls: 'text-emerald-600' };
  if (rating === 3) return { label: 'Neutral',  cls: 'text-[#9CA3AF]' };
  return { label: 'Negative', cls: 'text-red-500' };
}

function exportCSV(reviews: Review[], locations: Location[]) {
  const headers = ['Date','Reviewer','Rating','Location','Review','Status','Draft','Published Reply','Reply Date'];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = reviews.map(r => [
    fmtDate(r.published_at), r.reviewer_name ?? '', String(r.rating),
    locations.find(l => l.id === r.location_id)?.display_name ?? '',
    r.body ?? '', toUiStatus(r.status), r.reply_draft ?? '',
    r.reply_text ?? '', fmtDate(r.reply_published_at),
  ].map(esc).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: `reviews-${new Date().toISOString().split('T')[0]}.csv` }).click();
  URL.revokeObjectURL(url);
}

function isScheduleActive(schedule: AutoSchedule): boolean {
  if (schedule.type === 'always') return true;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [fH, fM] = schedule.from.split(':').map(Number);
  const [tH, tM] = schedule.to.split(':').map(Number);
  const from = (fH ?? 0) * 60 + (fM ?? 0);
  const to = (tH ?? 0) * 60 + (tM ?? 0);
  if (from <= to) return current >= from && current <= to;
  return current >= from || current <= to;
}

function loadPresets(): FilterPreset[] {
  try { return JSON.parse(localStorage.getItem('moffu_review_presets') || '[]'); } catch { return []; }
}
function savePresets(p: FilterPreset[]) {
  try { localStorage.setItem('moffu_review_presets', JSON.stringify(p)); } catch {}
}

const PAGE_SIZE = 20;
const STATUS_CFG: Record<UiStatus, { dot: string; label: string }> = {
  pending:    { dot: 'bg-amber-400', label: 'Pending'     },
  draft_ready:{ dot: 'bg-blue-400',  label: 'Draft Ready' },
  replied:    { dot: 'bg-[#111827]', label: 'Replied'    },
};


// ── FilterDropdown ────────────────────────────────────────────────────────────

function FilterDropdown({ label, icon, options, value, onChange }: {
  label: string; icon: React.ReactNode;
  options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== '' && value !== '0';
  const selectedLabel = options.find(o => o.value === value)?.label ?? label;

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${active ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8] font-medium' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] hover:text-[#6C55E8]'}`}>
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-xs">{active ? selectedLabel : label}</span>
        {active
          ? <span onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }} className="ml-0.5 hover:text-red-500 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
            </span>
          : <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        }
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1.5 min-w-[160px]">
          {options.map(opt => {
            const sel = opt.value === value;
            return (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${sel ? 'text-[#6C55E8] font-medium bg-[#F3F4F6]' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}>
                <span>{opt.label}</span>
                {sel && <svg className="w-3.5 h-3.5 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Star Distribution Dropdown ────────────────────────────────────────────────

function StarDistributionDropdown({ reviews }: { reviews: Review[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const counts = [5,4,3,2,1].map(star => ({ star, count: reviews.filter(r => r.rating === star).length }));
  const maxCount = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${open ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] hover:text-[#6C55E8]'}`}>
        <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
        <span className="text-xs">Distribution</span>
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-3 min-w-[192px]">
          {counts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <span className="text-xs text-[#6B7280] w-3 text-right">{star}</span>
              <svg className="w-3 h-3 text-amber-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <div className="flex-1 bg-[#F3F4F6] rounded-full h-1.5">
                <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }}/>
              </div>
              <span className="text-xs text-[#9CA3AF] w-5 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <svg key={n} className={`w-3 h-3 ${n <= rating ? 'text-amber-400' : 'text-[#E5E7EB]'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

// ── Reviews Line Chart ────────────────────────────────────────────────────────

type ChartPeriod = 'today' | 'week' | 'month' | 'custom';

const PERIOD_LABELS: Record<Exclude<ChartPeriod,'custom'>, string> = {
  today: 'Today', week: 'This Week', month: 'This Month',
};

interface ChartPoint {
  label: string; iso: string; count: number;
  totalRating: number; ratedCount: number;
  positive: number; neutral: number; negative: number;
}

function makeChartPoint(label: string, iso: string, matched: Review[]): ChartPoint {
  return {
    label, iso, count: matched.length,
    totalRating: matched.reduce((s, r) => s + r.rating, 0),
    ratedCount: matched.filter(r => r.rating > 0).length,
    positive: matched.filter(r => r.rating >= 4).length,
    neutral: matched.filter(r => r.rating === 3).length,
    negative: matched.filter(r => r.rating <= 2).length,
  };
}

function buildChartDataExtended(reviews: Review[], period: ChartPeriod, previousPeriod = false): ChartPoint[] {
  const now = new Date();
  const pts: ChartPoint[] = [];

  if (period === 'today') {
    const offset = previousPeriod ? 1 : 0;
    const target = new Date(now); target.setDate(now.getDate() - offset);
    const isoDate = target.toISOString().split('T')[0] ?? '';
    for (let h = 0; h < 24; h += 3) {
      const label = previousPeriod ? '' : (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
      const matched = reviews.filter(r => {
        if (!r.published_at) return false;
        const d = new Date(r.published_at);
        return d.toISOString().startsWith(isoDate) && d.getHours() >= h && d.getHours() < h + 3;
      });
      pts.push(makeChartPoint(label, `${isoDate}T${String(h).padStart(2,'0')}`, matched));
    }
  } else if (period === 'week') {
    const offset = previousPeriod ? 7 : 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i - offset);
      const iso = d.toISOString().split('T')[0] ?? '';
      const label = previousPeriod ? '' : (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] ?? '');
      pts.push(makeChartPoint(label, iso, reviews.filter(r => r.published_at?.startsWith(iso))));
    }
  } else if (period === 'month') {
    const offset = previousPeriod ? 30 : 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i - offset);
      const iso = d.toISOString().split('T')[0] ?? '';
      const label = previousPeriod ? '' : (i % 5 === 0 ? `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}` : '');
      pts.push(makeChartPoint(label, iso, reviews.filter(r => r.published_at?.startsWith(iso))));
    }
  }
  return pts;
}

function buildChartDataCustom(reviews: Review[], from: string, to: string): ChartPoint[] {
  if (!from || !to) return [];
  const fromD = new Date(from + 'T00:00:00');
  const toD = new Date(to + 'T00:00:00');
  const daysDiff = Math.max(1, Math.floor((toD.getTime() - fromD.getTime()) / 86400000) + 1);
  const pts: ChartPoint[] = [];
  if (daysDiff <= 90) {
    const step = Math.ceil(daysDiff / 8);
    for (let i = 0; i < daysDiff; i++) {
      const d = new Date(fromD); d.setDate(fromD.getDate() + i);
      const iso = d.toISOString().split('T')[0] ?? '';
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const label = (i === 0 || i === daysDiff - 1 || i % step === 0)
        ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
      pts.push(makeChartPoint(label, iso, reviews.filter(r => r.published_at?.startsWith(iso))));
    }
  } else {
    let cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
    const endM = new Date(toD.getFullYear(), toD.getMonth(), 1);
    while (cur <= endM) {
      const y = cur.getFullYear(); const m = cur.getMonth();
      const isoPrefix = `${y}-${String(m + 1).padStart(2,'0')}`;
      const label = (['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m] ?? '');
      pts.push(makeChartPoint(label, isoPrefix, reviews.filter(r => r.published_at?.startsWith(isoPrefix))));
      cur = new Date(y, m + 1, 1);
    }
  }
  return pts;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!; const curr = pts[i]!;
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function ReviewsLineChart({ reviews, totalReviews, avgRatingStr, replyRate: replyRateProp, avgResponseTime: avgResponseTimeProp, within24h, within48h, showLines = true }: {
  reviews: Review[];
  totalReviews: number;
  avgRatingStr: string;
  replyRate: string;
  avgResponseTime: string;
  within24h: string;
  within48h: string;
  showLines?: boolean;
}) {
  const [period, setPeriod] = useState<ChartPeriod>('week');
  const [chartFrom, setChartFrom] = useState('');
  const [chartTo, setChartTo] = useState('');
  const [hovered, setHovered] = useState<number | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showSentiment, setShowSentiment] = useState(false);

  const data = useMemo(() => {
    if (period === 'custom') return buildChartDataCustom(reviews, chartFrom, chartTo);
    return buildChartDataExtended(reviews, period, false);
  }, [reviews, period, chartFrom, chartTo]);

  const prevData = useMemo(() => {
    if (!showComparison || period === 'custom') return [];
    return buildChartDataExtended(reviews, period, true);
  }, [reviews, period, showComparison]);

  const totalInPeriod = data.reduce((s, p) => s + p.count, 0);
  const prevTotalInPeriod = prevData.reduce((s, p) => s + p.count, 0);
  const delta = totalInPeriod - prevTotalInPeriod;

  const maxVal = Math.max(...data.map(p => p.count), 1);
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxVal * i) / yTickCount));

  const W = 1000; const H = 130;
  const PAD = { top: 10, right: showRating && !showSentiment ? 36 : 6, bottom: 28, left: 6 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function toXY(i: number, val: number, maxV: number) {
    return {
      x: PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
      y: PAD.top + innerH - (val / maxV) * innerH,
    };
  }

  const pts = data.map((d, i) => toXY(i, d.count, maxVal));
  const line = smoothPath(pts);
  const area = pts.length > 1
    ? `${line} L ${pts[pts.length - 1]!.x} ${PAD.top + innerH} L ${pts[0]!.x} ${PAD.top + innerH} Z`
    : '';

  const ratingPts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: d.ratedCount > 0
      ? PAD.top + innerH - ((d.totalRating / d.ratedCount - 1) / 4) * innerH
      : PAD.top + innerH,
  }));
  const ratingLine = smoothPath(ratingPts);

  const prevPts = prevData.map((d, i) => ({
    x: PAD.left + (i / Math.max(prevData.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (d.count / maxVal) * innerH,
  }));
  const prevLine = prevPts.length > 1 ? smoothPath(prevPts) : '';

  const maxSentVal = Math.max(...data.map(p => Math.max(p.positive, p.neutral, p.negative)), 1);
  const posLine = smoothPath(data.map((d, i) => toXY(i, d.positive, maxSentVal)));
  const neuLine = smoothPath(data.map((d, i) => toXY(i, d.neutral, maxSentVal)));
  const negLine = smoothPath(data.map((d, i) => toXY(i, d.negative, maxSentVal)));

  const labelIndices = useMemo(() => {
    if (data.length <= 12) return data.map((_, i) => i);
    const step = Math.ceil(data.length / 10);
    return data.reduce<number[]>((acc, d, i) => { if (d.label || i % step === 0) acc.push(i); return acc; }, []);
  }, [data]);

  return (
    <div>
      {showLines && <div>
      {/* Top row: summary+legend left, controls right */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-[#111827]">{totalInPeriod}</span>
            {showComparison && prevData.length > 0 && (
              <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-[#9CA3AF]'}`}>
                ({delta > 0 ? '+' : ''}{delta})
              </span>
            )}
            <span className="text-sm text-[#9CA3AF]">
            reviews · {period === 'custom' ? (chartFrom && chartTo ? `${fmtDate(chartFrom)} – ${fmtDate(chartTo)}` : 'custom range') : PERIOD_LABELS[period].toLowerCase()}
          </span>
          </div>
          {/* Legend */}
          {(showRating || showSentiment || showComparison) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {!showSentiment && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-[#111827]"/>
                  <span className="text-xs text-[#6B7280]">Reviews</span>
                </div>
              )}
              {showRating && !showSentiment && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-amber-400"/>
                  <span className="text-xs text-[#6B7280]">Avg Rating</span>
                </div>
              )}
              {showSentiment && (
                <>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-emerald-500"/><span className="text-xs text-[#6B7280]">Positive</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-[#9CA3AF]"/><span className="text-xs text-[#6B7280]">Neutral</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-red-500"/><span className="text-xs text-[#6B7280]">Negative</span></div>
                </>
              )}
              {showComparison && (
                <div className="flex items-center gap-1.5">
                  <svg width="16" height="6" viewBox="0 0 16 6"><line x1="0" y1="3" x2="16" y2="3" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 2"/></svg>
                  <span className="text-xs text-[#6B7280]">Prev period</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
          <button onClick={() => setShowRating(s => !s)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${showRating ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'text-[#6B7280] bg-[#F3F4F6]'}`}>
            Avg Rating
          </button>
          <button onClick={() => setShowComparison(s => !s)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${showComparison ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-[#6B7280] bg-[#F3F4F6]'}`}>
            vs Previous
          </button>
          <button onClick={() => setShowSentiment(s => !s)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${showSentiment ? 'bg-[#EDE9FE] text-[#6C55E8] border border-[#6C55E8]/20' : 'text-[#6B7280] bg-[#F3F4F6]'}`}>
            Sentiment
          </button>
          <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 gap-0.5">
            {(Object.keys(PERIOD_LABELS) as Exclude<ChartPeriod,'custom'>[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${period === p ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
            <DateRangePicker
              from={chartFrom}
              to={chartTo}
              onChange={(f, t) => { setChartFrom(f); setChartTo(t); if (f && t) setPeriod('custom'); }}
              pill
              alignRight
              active={period === 'custom'}
            />
          </div>
        </div>
      </div>

      {/* SVG chart — full width */}
      <div className="relative w-full" onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C55E8" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#6C55E8" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {yTicks.map(v => {
            const y = PAD.top + innerH - (v / maxVal) * innerH;
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#F3F4F6" strokeWidth={1}/>
                <text x={PAD.left + 4} y={y - 3} fontSize={9} fill="#D1D5DB">{v}</text>
              </g>
            );
          })}

          {showRating && !showSentiment && [1,2,3,4,5].map(v => {
            const y = PAD.top + innerH - ((v - 1) / 4) * innerH;
            return <text key={v} x={W - PAD.right + 6} y={y + 4} textAnchor="start" fontSize={10} fill="#F59E0B">{v}</text>;
          })}

          {hovered !== null && pts[hovered] && (
            <line x1={pts[hovered]!.x} y1={PAD.top} x2={pts[hovered]!.x} y2={PAD.top + innerH}
              stroke="#6C55E8" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4}/>
          )}

          {showComparison && prevLine && (
            <path d={prevLine} fill="none" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 3" strokeLinejoin="round" strokeLinecap="round"/>
          )}

          {!showSentiment && area && <path d={area} fill="url(#chartGrad)"/>}
          {!showSentiment && <path d={line} fill="none" stroke="#6C55E8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>}
          {showRating && !showSentiment && <path d={ratingLine} fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>}

          {showSentiment && (
            <>
              <path d={posLine} fill="none" stroke="#10B981" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
              <path d={neuLine} fill="none" stroke="#9CA3AF" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
              <path d={negLine} fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
            </>
          )}

          {labelIndices.map(i => {
            const d = data[i]; const p = pts[i];
            if (!d?.label || !p) return null;
            return <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize={10} fill="#9CA3AF">{d.label}</text>;
          })}

          {pts.map((p, i) => (
            <g key={i} onMouseEnter={() => setHovered(i)} style={{ cursor: 'default' }}>
              <rect x={p.x - (innerW / data.length / 2)} y={PAD.top} width={innerW / data.length} height={innerH} fill="transparent"/>
              {!showSentiment && (hovered === i || data[i]!.count > 0) && (
                <circle cx={p.x} cy={p.y} r={hovered === i ? 4.5 : 3} fill="#6C55E8" stroke="white" strokeWidth={1.5}/>
              )}
            </g>
          ))}
        </svg>

        {hovered !== null && data[hovered] && pts[hovered] && (data[hovered]!.count > 0 || showSentiment) && (() => {
          const d = data[hovered]!; const p = pts[hovered]!;
          const pct = (p.x / W) * 100;
          const alignRight = pct > 75;
          const avgRtg = d.ratedCount > 0 ? (d.totalRating / d.ratedCount).toFixed(1) : null;
          return (
            <div className="absolute top-2 pointer-events-none z-10 bg-[#111827] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
              style={{ left: alignRight ? 'auto' : `calc(${pct}% + 8px)`, right: alignRight ? `calc(${100 - pct}% + 8px)` : 'auto' }}>
              <p className="font-semibold">{d.count} review{d.count !== 1 ? 's' : ''}</p>
              {avgRtg && showRating && <p className="text-amber-400 mt-0.5">Avg {avgRtg}</p>}
              {showSentiment && <p className="text-white/60 mt-0.5">{d.positive}+ {d.neutral}~ {d.negative}-</p>}
              <p className="text-white/60 mt-0.5">{d.label || d.iso}</p>
            </div>
          );
        })()}
        </div>
      </div>}

      {/* Stat cards — shown together with chart */}
      {showLines && (
        <div className="flex items-stretch bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl overflow-x-auto mt-4">
          <div className="flex-1 min-w-[100px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Total Reviews</p>
            <p className="text-sm font-bold text-[#111827] mt-0.5">{totalReviews}</p>
          </div>
          <div className="w-px bg-[#E5E7EB] flex-shrink-0 self-stretch"/>
          <div className="flex-1 min-w-[100px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Avg Rating</p>
            <p className="text-sm font-bold text-amber-500 mt-0.5">{avgRatingStr}</p>
          </div>
          <div className="w-px bg-[#E5E7EB] flex-shrink-0 self-stretch"/>
          <div className="flex-1 min-w-[100px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Reply Rate</p>
            <p className="text-sm font-bold text-[#6C55E8] mt-0.5">{replyRateProp}</p>
          </div>
          <div className="w-px bg-[#E5E7EB] flex-shrink-0 self-stretch"/>
          <div className="flex-1 min-w-[110px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Avg Response Time</p>
            <p className="text-sm font-bold text-[#111827] mt-0.5">{avgResponseTimeProp}</p>
          </div>
          <div className="w-px bg-[#E5E7EB] flex-shrink-0 self-stretch"/>
          <div className="flex-1 min-w-[100px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Replied ≤24h</p>
            <p className={`text-sm font-bold mt-0.5 ${within24h === '—' ? 'text-[#9CA3AF]' : 'text-emerald-600'}`}>{within24h}</p>
          </div>
          <div className="w-px bg-[#E5E7EB] flex-shrink-0 self-stretch"/>
          <div className="flex-1 min-w-[100px] px-3 py-2">
            <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">Replied ≤48h</p>
            <p className={`text-sm font-bold mt-0.5 ${within48h === '—' ? 'text-[#9CA3AF]' : 'text-blue-600'}`}>{within48h}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shortcuts Modal ───────────────────────────────────────────────────────────

// ── Shortcuts Modal ───────────────────────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'J / ↓', desc: 'Next review' },
    { key: 'K / ↑', desc: 'Previous review' },
    { key: 'Enter', desc: 'Expand / collapse row' },
    { key: 'G', desc: 'Generate AI draft' },
    { key: 'A', desc: 'Open Approve & Publish modal' },
    { key: 'X', desc: 'Select / deselect row' },
    { key: '?', desc: 'Toggle this help' },
    { key: 'Esc', desc: 'Close modal / clear focus' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">{s.desc}</span>
              <kbd className="text-xs font-mono bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">{s.key}</kbd>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF]">Shortcuts work when no input is focused.</p>
        </div>
      </div>
    </div>
  );
}

// ── Publish Modal ─────────────────────────────────────────────────────────────

function PublishModal({ review, locationName, onClose, onPublish, initialText }: {
  review: Review; locationName: string;
  onClose: () => void;
  onPublish: (id: string, draft: string) => Promise<{ error?: string }>;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText ?? review.reply_draft ?? '');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setPublishing(true); setError('');
    const r = await onPublish(review.id, text);
    if (r.error) { setError(r.error); setPublishing(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#111827]">Review Reply</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-4 bg-[#FAFAFA] border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#EDE9FE] text-[#6C55E8] flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {(review.reviewer_name ?? '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-[#111827]">{review.reviewer_name ?? 'Anonymous'}</p>
              <div className="flex items-center gap-2">
                <Stars rating={review.rating}/>
                <span className="text-xs text-[#9CA3AF]">{fmtDate(review.published_at)}</span>
                {locationName && <span className="text-xs text-[#9CA3AF]">· {locationName}</span>}
              </div>
            </div>
          </div>
          {review.body && <p className="text-sm text-[#374151] leading-relaxed">{review.body}</p>}
        </div>
        <div className="px-6 py-4">
          <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mb-2">Your Reply</label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
            className="w-full text-sm text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#6C55E8] resize-none"
            placeholder="Write your reply…"/>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm text-[#6B7280] font-medium px-4 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
          <button onClick={handle} disabled={publishing || !text.trim()}
            className="bg-[#111827] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
            {publishing ? 'Publishing…' : 'Approve & Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────

function BulkActionBar({ count, generating, publishing, publishableCount, onGenerate, onPublish, onClear, onMarkAttention, onExportSelected }: {
  count: number; generating: boolean; publishing: boolean; publishableCount: number;
  onGenerate: () => void; onPublish: () => void; onClear: () => void;
  onMarkAttention: () => void; onExportSelected: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111827] text-white rounded-xl px-5 py-3 shadow-xl">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="w-px h-4 bg-white/20"/>
      <button onClick={onGenerate} disabled={generating || publishing}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#6C55E8] bg-white hover:bg-[#F3F4F6] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        <svg className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
        </svg>
        {generating ? 'Generating…' : `Generate Drafts (${count})`}
      </button>
      {publishableCount > 0 && (
        <button onClick={onPublish} disabled={publishing || generating}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#111827] hover:bg-[#083F32] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
          <svg className={`w-3.5 h-3.5 ${publishing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          {publishing ? 'Publishing…' : `Publish Drafts (${publishableCount})`}
        </button>
      )}
      <button onClick={onMarkAttention} disabled={generating || publishing}
        className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5a2 2 0 012-2h14l-3 5 3 5H5v8"/>
        </svg>
        Mark Attention
      </button>
      <button onClick={onExportSelected}
        className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Export Selected
      </button>
      <button onClick={onClear} className="text-sm text-white/60 hover:text-white transition-colors">Clear</button>
    </div>
  );
}

// ── Review Row ────────────────────────────────────────────────────────────────

function PageSizeDropdown({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#374151] border border-[#D1D5DB] hover:border-[#9CA3AF] rounded-lg px-2.5 py-1 transition-colors">
        <span>{value} / page</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[110px]">
          {[25,50,75,100].map(n => (
            <button key={n} onClick={() => { onChange(n); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${value===n ? 'text-[#6C55E8] font-semibold bg-[#F3F4F6]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>
              {n} rows
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ review, locationName, expanded, selected, focused, onToggle, onSelect,
  onGenerateDraft, onPublish, onDiscard, onFlag }: {
  review: Review; locationName: string; expanded: boolean;
  selected: boolean; focused: boolean;
  onToggle: () => void; onSelect: (e: React.MouseEvent) => void;
  onGenerateDraft: (id: string) => void;
  onPublish: (id: string, draft: string) => Promise<{ error?: string }>;
  onDiscard: (id: string) => Promise<void>;
  onFlag: (id: string) => void;
}) {
  const uiStatus = toUiStatus(review.status);
  const s = STATUS_CFG[uiStatus];
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialText, setModalInitialText] = useState<string | undefined>(undefined);
  const [historyTab, setHistoryTab] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const isDrafting = review.status === 'DRAFTING';
  const isPublishing = review.status === 'PUBLISHING';
  const initials = (review.reviewer_name ?? '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  const age = fmtAge(review.published_at, uiStatus);
  const sentiment = getSentiment(review.rating);

  // Response time for replied reviews
  const responseTimeDays = uiStatus === 'replied' && review.reply_published_at && review.published_at
    ? Math.floor((new Date(review.reply_published_at).getTime() - new Date(review.published_at).getTime()) / 86400000)
    : null;

  const statusDot = review.status === 'NEEDS_ATTENTION' ? 'bg-amber-400' : s.dot;
  const statusLabel = isPublishing ? 'Publishing…' : isDrafting ? 'Generating…' : review.status === 'NEEDS_ATTENTION' ? 'Needs Attention' : s.label;

  return (
    <>
      {modalOpen && (
        <PublishModal
          review={review}
          locationName={locationName}
          onClose={() => { setModalOpen(false); setModalInitialText(undefined); }}
          onPublish={onPublish}
          {...(modalInitialText !== undefined ? { initialText: modalInitialText } : {})}
        />
      )}

      <tr onClick={onToggle}
        className={`group cursor-pointer border-b border-[#F3F4F6] last:border-0 transition-colors ${focused ? 'ring-1 ring-inset ring-[#6C55E8]/30' : ''} ${expanded ? 'bg-[#F3F4F6]' : selected ? 'bg-[#EDE9FE] hover:bg-[#DCF0E8]' : uiStatus === 'replied' ? 'bg-green-50 hover:bg-green-100' : uiStatus === 'draft_ready' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-[#F9FAFB]'}`}>

        {/* Checkbox — hidden for PUBLISHED reviews */}
        <td className="pl-4 pr-2 py-3 w-10" onClick={e => { e.stopPropagation(); if (uiStatus !== 'replied') onSelect(e); }}>
          {uiStatus !== 'replied' ? (
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-[#111827] border-[#6C55E8]' : 'border-[#D1D5DB] group-hover:border-[#9CA3AF]'}`}>
              {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
            </div>
          ) : (
            <div className="w-4 h-4"/>
          )}
        </td>

        {/* Date */}
        <td className="px-3 py-3 w-28 text-xs text-[#6B7280] whitespace-nowrap">{fmtDate(review.published_at)}</td>

        {/* Reviewer */}
        <td className="px-3 py-3 w-44">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] text-[#6C55E8] flex items-center justify-center text-xs font-bold flex-shrink-0">{initials}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#111827] truncate leading-tight">{review.reviewer_name ?? 'Anonymous'}</p>
              <Stars rating={review.rating}/>
            </div>
          </div>
        </td>

        {/* Location */}
        <td className="px-3 py-3 w-32">
          <span className="text-xs text-[#6B7280] truncate block max-w-[120px]">{locationName || <span className="text-[#D1D5DB]">—</span>}</span>
        </td>

        {/* Review + sentiment */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-[#374151] truncate max-w-sm">{review.body || <span className="italic text-[#C4C9D4]">No written review</span>}</p>
            <span className={`text-[10px] font-medium ${sentiment.cls}`}>{sentiment.label}</span>
          </div>
        </td>

        {/* Status badge + age + response time */}
        <td className="px-3 py-3 w-32">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-lg text-xs font-medium ${
              uiStatus === 'replied'    ? 'bg-emerald-50 text-emerald-700' :
              uiStatus === 'draft_ready'? 'bg-blue-50 text-blue-700' :
                                          'bg-amber-50 text-amber-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`}/>
              {statusLabel}
            </span>
            {age && <span className={`text-[10px] font-medium ${age.urgency}`}>{age.label}</span>}
            {responseTimeDays !== null && (
              <span className={`text-[10px] ${responseTimeDays <= 1 ? 'text-emerald-600' : 'text-[#9CA3AF]'}`}>
                {responseTimeDays === 0 ? 'Same day' : `${responseTimeDays}d response`}
              </span>
            )}
          </div>
        </td>

        {/* Inline action + flag */}
        <td className="px-3 py-3 w-44 pr-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {uiStatus === 'pending' && (
              <button onClick={() => onGenerateDraft(review.id)} disabled={isDrafting}
                className="flex items-center gap-1.5 text-xs font-medium text-[#6C55E8] hover:text-[#083F32] border border-[#6C55E8]/30 hover:border-[#6C55E8] bg-white hover:bg-[#F3F4F6] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                <svg className={`w-3.5 h-3.5 ${isDrafting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                </svg>
                {isDrafting ? 'Generating…' : 'Generate Draft'}
              </button>
            )}
            {uiStatus === 'draft_ready' && (
              <button onClick={() => { setModalInitialText(undefined); setModalOpen(true); }} disabled={isPublishing}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#111827] hover:bg-[#083F32] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                Approve & Publish
              </button>
            )}
            {uiStatus === 'replied' && <span className="text-xs text-[#9CA3AF]">Published</span>}
            {/* Flag button */}
            <button
              onClick={() => onFlag(review.id)}
              title={review.status === 'NEEDS_ATTENTION' ? 'Remove flag' : 'Flag for attention'}
              className={`flex-shrink-0 transition-colors ${review.status === 'NEEDS_ATTENTION' ? 'text-amber-500' : 'text-[#9CA3AF] hover:text-amber-500'}`}>
              <svg className="w-4 h-4" fill={review.status === 'NEEDS_ATTENTION' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5a2 2 0 012-2h14l-3 5 3 5H5v8"/>
              </svg>
            </button>
          </div>
        </td>

        {/* Chevron */}
        <td className="pl-2 pr-6 py-1.5 w-6">
          <svg className={`w-4 h-4 text-[#C4C9D4] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </td>
      </tr>

      {/* Expanded */}
      {expanded && (
        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <td colSpan={8} className="pl-4 pr-4 py-4">
            <div className="space-y-4">
              {/* Full review */}
              {review.body && (
                <div>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">Full Review</p>
                  <p className="text-sm text-[#374151] leading-relaxed">{review.body}</p>
                </div>
              )}

              {/* Draft area */}
              {uiStatus === 'draft_ready' && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => setHistoryTab(false)}
                      className={`text-xs font-semibold pb-0.5 border-b-2 transition-colors ${!historyTab ? 'border-[#6C55E8] text-[#6C55E8]' : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280]'}`}>
                      Draft
                    </button>
                    {review.draft_history.length > 0 && (
                      <button onClick={() => setHistoryTab(true)}
                        className={`text-xs font-semibold pb-0.5 border-b-2 transition-colors ${historyTab ? 'border-[#6C55E8] text-[#6C55E8]' : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280]'}`}>
                        History ({review.draft_history.length})
                      </button>
                    )}
                  </div>

                  {!historyTab ? (
                    <>
                      <p className="text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 leading-relaxed mb-2">{review.reply_draft}</p>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); setModalInitialText(undefined); setModalOpen(true); }}
                          className="text-xs font-semibold text-white bg-[#111827] hover:bg-[#083F32] px-3 py-1.5 rounded-lg transition-colors">
                          Approve & Publish
                        </button>
                        <button onClick={e => { e.stopPropagation(); onGenerateDraft(review.id); }}
                          className="text-xs text-[#6B7280] hover:text-[#6C55E8] font-medium px-3 py-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors">
                          Regenerate
                        </button>
                        <button onClick={async e => { e.stopPropagation(); await onDiscard(review.id); }}
                          className="text-xs text-[#6B7280] hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto">
                          Discard
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {[...review.draft_history].reverse().map((h, i) => (
                        <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                          <p className="text-[10px] text-[#9CA3AF] mb-1">{fmtDate(h.created_at)}</p>
                          <p className="text-sm text-[#374151] leading-relaxed">{h.draft}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {uiStatus === 'replied' && (review.reply_text || review.reply_draft) && (
                <div>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">Published Reply</p>
                  <p className="text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 leading-relaxed">{review.reply_text ?? review.reply_draft}</p>
                </div>
              )}

              {/* Pending section with AI + manual option */}
              {uiStatus === 'pending' && (
                <div className="flex flex-col gap-2">
                  <button onClick={e => { e.stopPropagation(); onGenerateDraft(review.id); }} disabled={isDrafting}
                    className="flex items-center gap-2 text-sm font-medium text-[#6C55E8] hover:text-[#083F32] transition-colors disabled:opacity-50 self-start">
                    <svg className={`w-4 h-4 ${isDrafting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                    </svg>
                    {isDrafting ? 'Generating…' : 'Generate AI Draft'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setShowManual(m => !m); }}
                    className="text-xs text-[#6B7280] hover:text-[#6C55E8] self-start transition-colors">
                    Write manually
                  </button>
                  {showManual && (
                    <div onClick={e => e.stopPropagation()}>
                      <textarea value={manualText} onChange={e => setManualText(e.target.value)} rows={4}
                        placeholder="Write your reply…"
                        className="w-full text-sm text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#6C55E8] resize-none transition-colors"/>
                      <button onClick={async () => { await onPublish(review.id, manualText); }} disabled={!manualText.trim()}
                        className="mt-2 text-xs font-semibold text-white bg-[#111827] hover:bg-[#083F32] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        Publish
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── AutoScheduleModal ─────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: AutoSchedule = { type: 'always', from: '09:00', to: '18:00' };

function AutoScheduleModal({ mode, onConfirm, onCancel }: {
  mode: 'draft' | 'publish';
  onConfirm: (schedule: AutoSchedule) => void;
  onCancel: () => void;
}) {
  const [schedType, setSchedType] = useState<'always' | 'scheduled'>('always');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('18:00');

  const title = mode === 'draft' ? 'Enable Auto Draft' : 'Enable Auto Publish';
  const desc = mode === 'draft'
    ? 'After each sync, AI will automatically generate reply drafts for all new reviews.'
    : 'After each sync, all Draft Ready reviews with a saved draft will be published directly to Google.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-semibold text-[#111827] mb-1">{title}</h2>
        <p className="text-sm text-[#6B7280] mb-4">{desc}</p>

        {mode === 'publish' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800 font-medium">
              Replies will be sent to Google without manual review. Use with caution.
            </p>
          </div>
        )}

        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-3">When should this run?</p>
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="sched" value="always" checked={schedType === 'always'} onChange={() => setSchedType('always')} className="accent-[#6C55E8]"/>
            <span className="text-sm font-medium text-[#374151]">Always active</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="sched" value="scheduled" checked={schedType === 'scheduled'} onChange={() => setSchedType('scheduled')} className="accent-[#6C55E8] mt-0.5"/>
            <div className="flex-1">
              <span className="text-sm font-medium text-[#374151]">Custom schedule</span>
              {schedType === 'scheduled' && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="time" value={from} onChange={e => setFrom(e.target.value)}
                    className="text-sm border border-[#D1D5DB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6C55E8]"/>
                  <span className="text-sm text-[#6B7280]">to</span>
                  <input type="time" value={to} onChange={e => setTo(e.target.value)}
                    className="text-sm border border-[#D1D5DB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6C55E8]"/>
                </div>
              )}
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors rounded-lg hover:bg-[#F3F4F6]">
            Cancel
          </button>
          <button onClick={() => onConfirm({ type: schedType, from, to })}
            className="px-4 py-2 text-sm font-semibold bg-[#111827] text-white rounded-lg hover:bg-[#083F32] transition-colors">
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ConfirmOffModal ───────────────────────────────────────────────────────────

function ConfirmOffModal({ mode, onConfirm, onCancel }: {
  mode: 'sync' | 'draft' | 'publish';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg = {
    sync:    { title: 'Disable Auto Sync',    desc: 'Reviews will no longer sync automatically. You can still sync manually.' },
    draft:   { title: 'Disable Auto Draft',   desc: 'AI will no longer generate reply drafts automatically after each sync.' },
    publish: { title: 'Disable Auto Publish', desc: 'Draft Ready replies will no longer be published to Google automatically.' },
  }[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-[#111827] mb-1">{cfg.title}</h2>
        <p className="text-sm text-[#6B7280] mb-6">{cfg.desc}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors rounded-lg hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Disable</button>
        </div>
      </div>
    </div>
  );
}

// ── AutoSyncModal ─────────────────────────────────────────────────────────────

function AutoSyncModal({ onConfirm, onCancel }: {
  onConfirm: (interval: import('@/features/google/google.service').AutoSyncInterval) => void;
  onCancel: () => void;
}) {
  const [interval, setInterval] = useState<import('@/features/google/google.service').AutoSyncInterval>('4h');
  const opts: { value: import('@/features/google/google.service').AutoSyncInterval; label: string }[] = [
    { value: '1h', label: '1 hour' }, { value: '4h', label: '4 hours' },
    { value: '12h', label: '12 hours' }, { value: '24h', label: '24 hours' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-[#111827] mb-1">Enable Auto Sync</h2>
        <p className="text-sm text-[#6B7280] mb-5">Automatically fetch new reviews from Google on a schedule.</p>
        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-3">Sync every</p>
        <div className="flex gap-2 flex-wrap mb-6">
          {opts.map(o => (
            <button key={o.value} onClick={() => setInterval(o.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${interval === o.value ? 'bg-[#111827] text-white border-[#6C55E8]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] hover:text-[#6C55E8]'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors rounded-lg hover:bg-[#F3F4F6]">Cancel</button>
          <button onClick={() => onConfirm(interval)} className="px-4 py-2 text-sm font-semibold bg-[#111827] text-white rounded-lg hover:bg-[#083F32] transition-colors">Enable</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const { selectedId: globalLocationId, setLocationRatings } = useLocationStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connId, setConnId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false);
  const [autoDraftSchedule, setAutoDraftSchedule] = useState<AutoSchedule>(DEFAULT_SCHEDULE);
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [autoPublishSchedule, setAutoPublishSchedule] = useState<AutoSchedule>(DEFAULT_SCHEDULE);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState<import('@/features/google/google.service').AutoSyncInterval>('4h');
  const [autoModal, setAutoModal] = useState<'sync' | 'draft' | 'publish' | null>(null);
  const [confirmOffModal, setConfirmOffModal] = useState<'sync' | 'draft' | 'publish' | null>(null);
  const [autoRunning, setAutoRunning] = useState<'draft' | 'publish' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UiStatus>('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [flagFilter, setFlagFilter] = useState(false);
  const [withBodyFilter, setWithBodyFilter] = useState(false);

  // Presets
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  // UI state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showChart, setShowChart] = useState(true);

  async function loadReviews() {
    const { data } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, published_at, body, status, reply_draft, reply_text, location_id, notes, draft_history, reply_published_at')
      .order('published_at', { ascending: false });
    if (data) setReviews(data as Review[]);
    setLoading(false);
  }

  async function loadLocations() {
    const { data } = await supabase.from('google_locations').select('id, display_name').eq('is_selected', true);
    if (data) setLocations(data as Location[]);
  }

  useEffect(() => {
    (async () => {
      // Use googleService.getConnection() — has explicit user_id filter, avoids maybeSingle() failure on duplicate rows
      const { data: conn } = await googleService.getConnection();
      const isConn = conn?.state === 'CONNECTED';
      setIsConnected(isConn);
      if (conn?.id) setConnId(conn.id);
      if (conn?.connected_at) setConnectedAt(conn.connected_at);
      if (conn?.auto_sync_enabled) setAutoSyncEnabled(true);
      if (conn?.auto_sync_interval) setAutoSyncInterval(conn.auto_sync_interval as import('@/features/google/google.service').AutoSyncInterval);
      if (conn?.auto_draft_enabled) setAutoDraftEnabled(true);
      if (conn?.auto_draft_schedule) setAutoDraftSchedule(conn.auto_draft_schedule as AutoSchedule);
      if (conn?.auto_publish_enabled) setAutoPublishEnabled(true);
      if (conn?.auto_publish_schedule) setAutoPublishSchedule(conn.auto_publish_schedule as AutoSchedule);

      if (isConn && conn) {
        // First-time connect: sync all reviews, then auto-draft + publish ALL (force, ignore settings/date filter)
        if (!conn.last_synced_at) {
          setSyncing(true);
          try { await googleService.syncReviews(); } catch {}
          setSyncing(false);
          await loadReviews();
          await runAutoOperations({ forceAll: true });
          return;
        }

        // Subsequent page loads: auto-sync if interval elapsed
        if (conn.auto_sync_enabled) {
          const intervalHours: Record<string, number> = { '1h': 1, '4h': 4, '12h': 12, '24h': 24 };
          const hours = intervalHours[conn.auto_sync_interval ?? '4h'] ?? 4;
          const elapsed = (Date.now() - new Date(conn.last_synced_at).getTime()) / 3600000;
          if (elapsed >= hours) {
            setSyncing(true);
            try { await googleService.syncReviews(); } catch {}
            setSyncing(false);
            await loadReviews();
          }
        }
      }
    })();
    loadReviews(); loadLocations();
  }, []);

  // Keyboard shortcuts
  const filteredRef = useRef<Review[]>([]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') { setShowShortcuts(s => !s); return; }
      if (e.key === 'Escape') { setFocusedIdx(-1); setShowShortcuts(false); return; }
      const list = filteredRef.current;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, list.length - 1)); return; }
      if (e.key === 'k' || e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)); return; }
      if (focusedIdx < 0 || focusedIdx >= list.length) return;
      const r = list[focusedIdx];
      if (!r) return;
      if (e.key === 'Enter') { setExpandedId(id => id === r.id ? null : r.id); return; }
      if (e.key === 'x' || e.key === 'X') {
        setSelectedIds(prev => { const s = new Set(prev); s.has(r.id) ? s.delete(r.id) : s.add(r.id); return s; }); return;
      }
      if (e.key === 'g' || e.key === 'G') { if (toUiStatus(r.status) === 'pending') handleGenerateDraft(r.id); return; }
      if (e.key === 'a' || e.key === 'A') { if (toUiStatus(r.status) === 'draft_ready') setExpandedId(r.id); return; }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusedIdx]);

  // Avg rating per location — push to store so the topbar LocationPicker can show ratings
  useEffect(() => {
    const map: Record<string, number> = {};
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const r of reviews) {
      if (r.location_id && r.rating > 0) {
        if (!totals[r.location_id]) totals[r.location_id] = { sum: 0, count: 0 };
        totals[r.location_id]!.sum += r.rating;
        totals[r.location_id]!.count += 1;
      }
    }
    for (const [id, { sum, count }] of Object.entries(totals)) {
      map[id] = sum / count;
    }
    setLocationRatings(map);
  }, [reviews, setLocationRatings]);

  // Reviews scoped to is_selected locations + active global location filter — used for stats, chart, tab counts
  const activeReviews = useMemo(() => {
    const selectedIds = new Set(locations.map(l => l.id));
    return reviews.filter(r => {
      if (r.location_id && !selectedIds.has(r.location_id)) return false;
      if (globalLocationId && r.location_id !== globalLocationId) return false;
      return true;
    });
  }, [reviews, locations, globalLocationId]);

  // Filtering + sorting
  const filtered = useMemo(() => {
    const selectedLocationIds = new Set(locations.map(l => l.id));
    let list = reviews.filter(r => {
      if (r.location_id && !selectedLocationIds.has(r.location_id)) return false;
      if (statusFilter !== 'all' && toUiStatus(r.status) !== statusFilter) return false;
      if (ratingFilter > 0 && r.rating !== ratingFilter) return false;
      if (globalLocationId && r.location_id !== globalLocationId) return false;
      if (locationFilter && r.location_id !== locationFilter) return false;
      if (search) { const q = search.toLowerCase(); if (!r.reviewer_name?.toLowerCase().includes(q) && !r.body?.toLowerCase().includes(q)) return false; }
      if (dateFrom && r.published_at && r.published_at < dateFrom) return false;
      if (dateTo && r.published_at && r.published_at > dateTo + 'T23:59:59') return false;
      if (flagFilter && r.status !== 'NEEDS_ATTENTION') return false;
      if (withBodyFilter && !r.body?.trim()) return false;
      return true;
    });
    if (sortBy === 'oldest')     list = [...list].sort((a,b) => (a.published_at ?? '') < (b.published_at ?? '') ? -1 : 1);
    if (sortBy === 'highest')    list = [...list].sort((a,b) => b.rating - a.rating);
    if (sortBy === 'lowest')     list = [...list].sort((a,b) => a.rating - b.rating);
    if (sortBy === 'unanswered') list = [...list].sort((a,b) => {
      const aU = toUiStatus(a.status) !== 'replied' ? 0 : 1;
      const bU = toUiStatus(b.status) !== 'replied' ? 0 : 1;
      if (aU !== bU) return aU - bU;
      return (a.published_at ?? '') < (b.published_at ?? '') ? -1 : 1;
    });
    return list;
  }, [reviews, locations, statusFilter, ratingFilter, globalLocationId, locationFilter, search, dateFrom, dateTo, sortBy, flagFilter, withBodyFilter]);

  useEffect(() => { filteredRef.current = filtered; }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page-1)*pageSize, page*pageSize);

  const counts = {
    all: activeReviews.length,
    pending:    activeReviews.filter(r => toUiStatus(r.status) === 'pending').length,
    draft_ready:activeReviews.filter(r => toUiStatus(r.status) === 'draft_ready').length,
    replied:    activeReviews.filter(r => toUiStatus(r.status) === 'replied').length,
  };
  const avgRating = activeReviews.length ? (activeReviews.reduce((s,r) => s + r.rating, 0) / activeReviews.length).toFixed(1) : '—';
  const hasFilters = !!(search || statusFilter !== 'all' || ratingFilter > 0 || locationFilter || dateFrom || dateTo || flagFilter || withBodyFilter);

  // Stats bar computations
  const repliedCount = activeReviews.filter(r => r.status === 'PUBLISHED').length;
  const replyRate = activeReviews.length > 0 ? `${(repliedCount / activeReviews.length * 100).toFixed(0)}%` : '—';
  const repliedWithTimes = activeReviews.filter(r => r.status === 'PUBLISHED' && r.reply_published_at && r.published_at);
  const avgHours = repliedWithTimes.length > 0
    ? repliedWithTimes.reduce((s, r) => s + (new Date(r.reply_published_at!).getTime() - new Date(r.published_at!).getTime()), 0) / repliedWithTimes.length / 3600000
    : null;
  const avgResponseTime = avgHours !== null
    ? avgHours < 24 ? `${avgHours.toFixed(1)}h` : `${(avgHours / 24).toFixed(1)} days`
    : '—';
  const within24h = repliedWithTimes.length > 0
    ? `${((repliedWithTimes.filter(r => (new Date(r.reply_published_at!).getTime() - new Date(r.published_at!).getTime()) <= 86400000).length / repliedWithTimes.length) * 100).toFixed(0)}%`
    : '—';
  const within48h = repliedWithTimes.length > 0
    ? `${((repliedWithTimes.filter(r => (new Date(r.reply_published_at!).getTime() - new Date(r.published_at!).getTime()) <= 172800000).length / repliedWithTimes.length) * 100).toFixed(0)}%`
    : '—';

  function locationName(id: string | null) { return id ? (locations.find(l => l.id === id)?.display_name ?? '') : ''; }
  function clearAll() { setSearch(''); setStatusFilter('all'); setRatingFilter(0); setLocationFilter(''); setDateFrom(''); setDateTo(''); setSortBy('newest'); setFlagFilter(false); setWithBodyFilter(false); setPage(1); }

  async function handleSync() {
    setSyncing(true);
    try {
      const { synced, error } = await googleService.syncReviews();
      if (error) { setToast({ message: error, type: 'error' }); return; }
      setToast({ message: `Synced ${synced ?? 0} review${synced !== 1 ? 's' : ''}.`, type: 'success' });
      await loadReviews();
      await runAutoOperations();
    } finally {
      setSyncing(false);
      setAutoRunning(null);
    }
  }

  async function runAutoOperations({ forceAll = false } = {}) {
    const { data: { user } } = await supabase.auth.getUser();

    async function notifyLimitHit(title: string, body: string) {
      if (!user) return;
      await supabase.from('user_notifications').insert({
        user_id: user.id,
        title,
        body,
        type: 'usage_limit',
        is_read: false,
      });
    }

    // Auto Draft: on first sync (forceAll) draft ALL NEW reviews; otherwise respect settings + date filter
    if (forceAll || (autoDraftEnabled && isScheduleActive(autoDraftSchedule))) {
      let draftQuery = supabase.from('reviews').select('id, status').eq('status', 'NEW');
      if (!forceAll && connectedAt) draftQuery = draftQuery.gte('published_at', connectedAt);
      const { data: newReviews } = await draftQuery;
      const toGenerate = newReviews ?? [];
      if (toGenerate.length > 0) {
        setAutoRunning('draft');
        let draftedCount = 0;
        let draftLimitHit = false;
        for (const r of toGenerate) {
          const res = await googleService.generateDraft(r.id);
          if (res.error) {
            if (res.error.toLowerCase().includes('limit')) { draftLimitHit = true; break; }
          } else {
            draftedCount++;
          }
        }
        await loadReviews();
        if (draftedCount > 0) setToast({ message: `Auto-drafted ${draftedCount} review${draftedCount !== 1 ? 's' : ''}.`, type: 'success' });
        if (draftLimitHit) {
          await notifyLimitHit(
            'AI Draft Limit Reached',
            `${draftedCount} review${draftedCount !== 1 ? 's' : ''} drafted. Package limit reached — upgrade your plan to draft more reviews automatically.`,
          );
        }
        setAutoRunning(null);
      }
    }

    // Auto Publish: on first sync (forceAll) publish ALL DRAFT_READY reviews; otherwise respect settings
    if (forceAll || (autoPublishEnabled && isScheduleActive(autoPublishSchedule))) {
      const { data: readyReviews } = await supabase
        .from('reviews').select('id, status, reply_draft').eq('status', 'DRAFT_READY');
      const toPublish = (readyReviews ?? []).filter((r: { reply_draft: string | null }) => r.reply_draft);
      if (toPublish.length > 0) {
        setAutoRunning('publish');
        let publishedCount = 0;
        let publishLimitHit = false;
        for (const r of toPublish) {
          const res = await googleService.publishReply(r.id, r.reply_draft as string);
          if (res.error) {
            if (res.error.toLowerCase().includes('limit')) { publishLimitHit = true; break; }
          } else {
            publishedCount++;
          }
        }
        await loadReviews();
        if (publishedCount > 0) setToast({ message: `Auto-published ${publishedCount} repl${publishedCount !== 1 ? 'ies' : 'y'} to Google.`, type: 'success' });
        if (publishLimitHit) {
          await notifyLimitHit(
            'Reply Limit Reached',
            `${publishedCount} repl${publishedCount !== 1 ? 'ies' : 'y'} published. Package limit reached — upgrade your plan to publish more replies automatically.`,
          );
        }
        setAutoRunning(null);
      }
    }
  }

  async function handleAutoModalConfirm(schedule: AutoSchedule) {
    const mode = autoModal!;
    setAutoModal(null);
    if (mode === 'draft') {
      setAutoDraftEnabled(true);
      setAutoDraftSchedule(schedule);
      if (connId) await googleService.updateAutoDraftPublish(connId, { auto_draft_enabled: true, auto_draft_schedule: schedule });
    } else {
      setAutoPublishEnabled(true);
      setAutoPublishSchedule(schedule);
      if (connId) await googleService.updateAutoDraftPublish(connId, { auto_publish_enabled: true, auto_publish_schedule: schedule });
    }
  }

  async function handleAutoToggleOff(mode: 'draft' | 'publish') {
    if (mode === 'draft') {
      setAutoDraftEnabled(false);
      if (connId) await googleService.updateAutoDraftPublish(connId, { auto_draft_enabled: false });
    } else {
      setAutoPublishEnabled(false);
      if (connId) await googleService.updateAutoDraftPublish(connId, { auto_publish_enabled: false });
    }
  }

  async function handleAutoSyncModalConfirm(interval: import('@/features/google/google.service').AutoSyncInterval) {
    setAutoModal(null);
    setAutoSyncEnabled(true);
    setAutoSyncInterval(interval);
    if (connId) await googleService.updateAutoSync(connId, true, interval);
  }

  async function handleAutoSyncToggleOff() {
    setAutoSyncEnabled(false);
    if (connId) await googleService.updateAutoSync(connId, false, autoSyncInterval);
  }

  async function handleGenerateDraft(id: string) {
    const review = reviews.find(r => r.id === id);
    if (review?.reply_draft) {
      const newHistory = [...(review.draft_history ?? []), { draft: review.reply_draft, created_at: new Date().toISOString() }];
      await supabase.from('reviews').update({ draft_history: newHistory }).eq('id', id);
    }
    setReviews(p => p.map(r => r.id === id ? { ...r, status: 'DRAFTING' as const } : r));
    const { error } = await googleService.generateDraft(id);
    if (error) { setReviews(p => p.map(r => r.id === id ? { ...r, status: 'NEW' as const } : r)); setToast({ message: error, type: 'error' }); }
    else { await loadReviews(); }
  }

  async function handlePublish(id: string, draft: string): Promise<{ error?: string }> {
    const r = await googleService.publishReply(id, draft);
    if (!r.error) { await loadReviews(); setToast({ message: 'Reply published to Google.', type: 'success' }); }
    return r;
  }

  async function handleDiscard(id: string) {
    await supabase.from('reviews').update({ status: 'NEW', reply_draft: null }).eq('id', id);
    await loadReviews(); setExpandedId(null);
  }

async function handleFlag(id: string) {
    const review = reviews.find(r => r.id === id);
    if (!review) return;
    const newStatus: DbStatus = review.status === 'NEEDS_ATTENTION' ? 'NEW' : 'NEEDS_ATTENTION';
    setReviews(p => p.map(r => r.id === id ? { ...r, status: newStatus } : r));
    await supabase.from('reviews').update({ status: newStatus }).eq('id', id);
  }

  async function handleBulkGenerate() {
    setBulkGenerating(true);
    const ids = [...selectedIds];
    for (const id of ids) { await handleGenerateDraft(id); }
    setSelectedIds(new Set()); setBulkGenerating(false);
    setToast({ message: `Generated drafts for ${ids.length} review${ids.length !== 1 ? 's' : ''}.`, type: 'success' });
  }

  async function handleBulkPublish() {
    setBulkPublishing(true);
    const draftReady = reviews.filter(r => selectedIds.has(r.id) && r.status === 'DRAFT_READY' && r.reply_draft);
    let published = 0;
    for (const r of draftReady) {
      const result = await googleService.publishReply(r.id, r.reply_draft!);
      if (!result.error) published++;
    }
    await loadReviews();
    setSelectedIds(new Set());
    setBulkPublishing(false);
    setToast({ message: `Published ${published} repl${published !== 1 ? 'ies' : 'y'} to Google.`, type: 'success' });
  }

  async function handleBulkMarkAttention() {
    const count = selectedIds.size;
    await supabase.from('reviews').update({ status: 'NEEDS_ATTENTION' }).in('id', [...selectedIds]);
    setSelectedIds(new Set());
    await loadReviews();
    setToast({ message: `Marked ${count} review${count !== 1 ? 's' : ''} as Needs Attention.`, type: 'success' });
  }

  function handleExportSelected() {
    const selectedReviews = reviews.filter(r => selectedIds.has(r.id));
    exportCSV(selectedReviews, locations);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function toggleSelectAll() {
    const pageIds = paginated.filter(r => r.status !== 'PUBLISHED').map(r => r.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (allSelected) pageIds.forEach(id => s.delete(id)); else pageIds.forEach(id => s.add(id));
      return s;
    });
  }

  function savePreset() {
    if (!presetName.trim()) return;
    const p: FilterPreset = {
      id: Date.now().toString(), name: presetName.trim(),
      filters: { search, statusFilter, ratingFilter, locationFilter, dateFrom, dateTo, sortBy, withBody: withBodyFilter },
    };
    const updated = [...presets, p];
    setPresets(updated); savePresets(updated);
    setPresetName(''); setShowPresetInput(false);
  }

  function applyPreset(p: FilterPreset) {
    const f = p.filters;
    setSearch(f.search); setStatusFilter(f.statusFilter); setRatingFilter(f.ratingFilter);
    setLocationFilter(f.locationFilter); setDateFrom(f.dateFrom); setDateTo(f.dateTo); setSortBy(f.sortBy);
    setWithBodyFilter(f.withBody ?? false);
    setPage(1);
  }

  function deletePreset(id: string) {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated); savePresets(updated);
  }

  const selectablePage = paginated.filter(r => r.status !== 'PUBLISHED');
  const allPageSelected = selectablePage.length > 0 && selectablePage.every(r => selectedIds.has(r.id));
  const publishableCount = [...selectedIds].filter(id => {
    const r = reviews.find(rev => rev.id === id);
    return r && r.status === 'DRAFT_READY' && r.reply_draft;
  }).length;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#111827]/5 blur-3xl" aria-hidden="true"/>
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/4 blur-3xl" aria-hidden="true"/>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)}/>}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)}/>}
      {autoModal === 'sync' && (
        <AutoSyncModal onConfirm={handleAutoSyncModalConfirm} onCancel={() => setAutoModal(null)}/>
      )}
      {(autoModal === 'draft' || autoModal === 'publish') && (
        <AutoScheduleModal
          mode={autoModal}
          onConfirm={handleAutoModalConfirm}
          onCancel={() => setAutoModal(null)}
        />
      )}
      {confirmOffModal && (
        <ConfirmOffModal
          mode={confirmOffModal}
          onConfirm={() => {
            const m = confirmOffModal;
            setConfirmOffModal(null);
            if (m === 'sync') handleAutoSyncToggleOff();
            else handleAutoToggleOff(m);
          }}
          onCancel={() => setConfirmOffModal(null)}
        />
      )}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          generating={bulkGenerating}
          publishing={bulkPublishing}
          publishableCount={publishableCount}
          onGenerate={handleBulkGenerate}
          onPublish={handleBulkPublish}
          onClear={() => setSelectedIds(new Set())}
          onMarkAttention={handleBulkMarkAttention}
          onExportSelected={handleExportSelected}
        />
      )}

      {/* Header */}
      <div className="relative z-10 px-4 md:px-10 py-4 flex items-center justify-between gap-4 flex-shrink-0 backdrop-blur-sm border-b border-white/60">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Reviews</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setShowChart(s => !s)} title={showChart ? 'Hide chart' : 'Show chart'}
            className={`p-2 rounded-lg transition-colors ${showChart ? 'text-[#6C55E8] bg-[#EDE9FE]' : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6]'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
            </svg>
          </button>
          <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts"
            className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
          <button onClick={() => exportCSV(filtered, locations)} title="Export filtered reviews as CSV"
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#111827] border border-[#D1D5DB] hover:border-[#374151] px-3 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
          </button>

          {/* Auto Sync toggle */}
          <button
            onClick={() => autoSyncEnabled ? setConfirmOffModal('sync') : setAutoModal('sync')}
            disabled={!isConnected}
            title={!isConnected ? 'Connect Google Business Profile first' : autoSyncEnabled ? `Auto Sync ON every ${autoSyncInterval} — click to disable` : 'Enable Auto Sync'}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${autoSyncEnabled ? 'bg-[#EDE9FE] text-[#6C55E8] border-[#6C55E8]/40 hover:bg-[#DCF0E8]' : 'text-[#6B7280] border-[#D1D5DB] hover:text-[#111827] hover:border-[#374151]'}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${autoSyncEnabled ? 'bg-[#111827]' : 'bg-[#D1D5DB]'}`}/>
            {autoSyncEnabled ? `Auto Sync · ${autoSyncInterval}` : 'Auto Sync'}
          </button>

          {/* Auto Draft toggle */}
          <button
            onClick={() => autoDraftEnabled ? setConfirmOffModal('draft') : setAutoModal('draft')}
            disabled={!isConnected}
            title={!isConnected ? 'Connect Google Business Profile first' : autoDraftEnabled ? `Auto Draft ON${autoDraftSchedule.type === 'scheduled' ? ` (${autoDraftSchedule.from}–${autoDraftSchedule.to})` : ''} — click to disable` : 'Enable Auto Draft'}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${autoDraftEnabled ? 'bg-[#EDE9FE] text-[#6C55E8] border-[#6C55E8]/40 hover:bg-[#DCF0E8]' : 'text-[#6B7280] border-[#D1D5DB] hover:text-[#111827] hover:border-[#374151]'}`}>
            {autoRunning === 'draft'
              ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              : <span className={`w-2 h-2 rounded-full flex-shrink-0 ${autoDraftEnabled ? 'bg-[#111827]' : 'bg-[#D1D5DB]'}`}/>}
            Auto Draft
          </button>

          {/* Auto Publish toggle */}
          <button
            onClick={() => autoPublishEnabled ? setConfirmOffModal('publish') : setAutoModal('publish')}
            disabled={!isConnected}
            title={!isConnected ? 'Connect Google Business Profile first' : autoPublishEnabled ? `Auto Publish ON${autoPublishSchedule.type === 'scheduled' ? ` (${autoPublishSchedule.from}–${autoPublishSchedule.to})` : ''} — click to disable` : 'Enable Auto Publish'}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${autoPublishEnabled ? 'bg-[#EDE9FE] text-[#6C55E8] border-[#6C55E8]/40 hover:bg-[#DCF0E8]' : 'text-[#6B7280] border-[#D1D5DB] hover:text-[#111827] hover:border-[#374151]'}`}>
            {autoRunning === 'publish'
              ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              : <span className={`w-2 h-2 rounded-full flex-shrink-0 ${autoPublishEnabled ? 'bg-[#111827]' : 'bg-[#D1D5DB]'}`}/>}
            Auto Publish
          </button>

          <button onClick={handleSync} disabled={syncing || !isConnected}
            title={!isConnected ? 'Connect Google Business Profile first' : 'Sync latest reviews'}
            className="flex items-center gap-2 bg-[#111827] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-[#083F32] disabled:cursor-not-allowed">
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {syncing ? 'Syncing…' : 'Sync Reviews'}
          </button>
        </div>
      </div>

      {/* Chart — full width, only rendered when visible */}
      {showChart && (
        <div className="px-4 md:px-10 pt-4 pb-5 flex-shrink-0">
          <div className="relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 px-6 py-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/3 via-transparent to-transparent pointer-events-none rounded-2xl"/>
            <div className="relative">
              <ReviewsLineChart
                reviews={activeReviews}
                totalReviews={activeReviews.length}
                avgRatingStr={activeReviews.length ? `${(activeReviews.reduce((s,r) => s + r.rating, 0) / activeReviews.length).toFixed(1)} ★` : '—'}
                replyRate={replyRate}
                avgResponseTime={avgResponseTime}
                within24h={within24h}
                within48h={within48h}
                showLines={showChart}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter bar + Table — unified card, same horizontal margin */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 px-3 md:px-6 pt-4 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-[#E5E7EB] shadow-sm">

        {/* Filter bar — top of card; no overflow-hidden here so dropdowns escape */}
        <div className="relative z-20 flex-shrink-0 bg-white border-b border-[#E5E7EB] px-3 md:px-4 py-2.5 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Status tabs */}
            {(['all','pending','draft_ready','replied'] as const).map(key => {
              const labels = { all: 'All', pending: 'Pending', draft_ready: 'Draft Ready', replied: 'Replied' };
              const active = statusFilter === key;
              return (
                <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#111827] text-white'
                      : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]'
                  }`}>
                  {labels[key]}
                  <span className={`text-xs font-medium ${active ? 'text-white/70' : 'text-[#9CA3AF]'}`}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}

            {/* Divider */}
            <div className="w-px h-5 bg-[#E5E7EB] mx-0.5 flex-shrink-0"/>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input type="text" placeholder="Search…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 pr-3 py-1.5 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#6C55E8] w-44 transition-colors"/>
            </div>

            <FilterDropdown label="Rating" value={String(ratingFilter)}
              onChange={v => { setRatingFilter(Number(v)); setPage(1); }}
              icon={<svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
              options={[{value:'0',label:'All ratings'},{value:'5',label:'5 stars'},{value:'4',label:'4 stars'},{value:'3',label:'3 stars'},{value:'2',label:'2 stars'},{value:'1',label:'1 star'}]}
            />

            <DateRangePicker from={dateFrom} to={dateTo} onChange={(f,t) => { setDateFrom(f); setDateTo(t); setPage(1); }}/>

            <FilterDropdown label="Sort" value={sortBy}
              onChange={v => { setSortBy(v as SortKey); setPage(1); }}
              icon={<svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>}
              options={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'},{value:'unanswered',label:'Unanswered first'},{value:'highest',label:'Highest rated'},{value:'lowest',label:'Lowest rated'}]}
            />

            <button
              onClick={() => { setFlagFilter(f => !f); setPage(1); }}
              title="Flagged only"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${flagFilter ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-[#D1D5DB] text-[#6B7280] hover:border-amber-300 hover:text-amber-500'}`}>
              <svg className="w-3.5 h-3.5" fill={flagFilter ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5a2 2 0 012-2h14l-3 5 3 5H5v8"/>
              </svg>
              Flagged
            </button>

            <button
              onClick={() => { setWithBodyFilter(f => !f); setPage(1); }}
              title="Has written text only"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${withBodyFilter ? 'bg-[#EDE9FE] border-[#6C55E8] text-[#6C55E8]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] hover:text-[#6C55E8]'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              Has Review
            </button>

            {reviews.length > 0 && (
              <>
                <div className="w-px h-5 bg-[#E5E7EB] mx-0.5 flex-shrink-0"/>
                <StarDistributionDropdown reviews={reviews}/>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {hasFilters && <span className="text-xs text-[#9CA3AF]">{filtered.length} result{filtered.length!==1?'s':''}</span>}
              {hasFilters && <button onClick={clearAll} className="text-xs text-[#9CA3AF] hover:text-red-500 font-medium transition-colors">Clear all</button>}
              {hasFilters && !showPresetInput && (
                <button onClick={() => setShowPresetInput(true)} className="text-xs text-[#6C55E8] font-medium hover:underline transition-colors">Save preset</button>
              )}
              {showPresetInput && (
                <div className="flex items-center gap-1.5">
                  <input autoFocus type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowPresetInput(false); }}
                    placeholder="Preset name…"
                    className="text-xs border border-[#D1D5DB] rounded-lg px-2 py-1 focus:outline-none focus:border-[#6C55E8] w-32"/>
                  <button onClick={savePreset} className="text-xs text-white bg-[#111827] px-2 py-1 rounded-lg hover:bg-[#083F32]">Save</button>
                  <button onClick={() => setShowPresetInput(false)} className="text-xs text-[#9CA3AF] hover:text-red-500">×</button>
                </div>
              )}
            </div>
          </div>

          {presets.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-xs text-[#9CA3AF]">Presets:</span>
              {presets.map(p => (
                <div key={p.id} className="flex items-center gap-0.5 bg-[#F3F4F6] rounded-lg px-2 py-0.5">
                  <button onClick={() => applyPreset(p)} className="text-xs text-[#374151] hover:text-[#6C55E8] font-medium">{p.name}</button>
                  <button onClick={() => deletePreset(p.id)} className="text-[#9CA3AF] hover:text-red-500 ml-1 text-xs leading-none">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table content — overflow-hidden only here so corners clip correctly */}
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5].map(n => <div key={n} className="h-12 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50 animate-pulse"/>)}</div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-10 h-10 text-[#D1D5DB] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p className="text-sm font-medium text-[#374151] mb-1">
              {reviews.length === 0 ? (isConnected ? 'No reviews yet — click Sync Reviews' : 'Connect Google Business Profile from Settings') : 'No reviews match your filters'}
            </p>
            {hasFilters && <button onClick={clearAll} className="text-xs text-[#6C55E8] underline mt-1">Clear filters</button>}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Table header — never scrolls */}
            <div className="flex-shrink-0 border-b border-[#E5E7EB] bg-[#F9FAFB] overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr>
                    <th className="pl-4 pr-2 py-3 w-10">
                      <div onClick={toggleSelectAll}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${allPageSelected ? 'bg-[#111827] border-[#6C55E8]' : 'border-[#D1D5DB] hover:border-[#6C55E8]'}`}>
                        {allPageSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-28">Date</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-44">Reviewer</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-32">Location</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Review</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-32">Status</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-44 pr-4">Action</th>
                    <th className="w-6"/>
                  </tr>
                </thead>
              </table>
            </div>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <colgroup>
                  <col className="w-10"/>
                  <col className="w-28"/>
                  <col className="w-44"/>
                  <col className="w-32"/>
                  <col/>
                  <col className="w-32"/>
                  <col className="w-44"/>
                  <col className="w-6"/>
                </colgroup>
                <tbody>
                  {paginated.map((review, idx) => (
                    <ReviewRow
                      key={`${review.id}-${review.status}-${review.reply_draft??''}`}
                      review={review}
                      locationName={locationName(review.location_id)}
                      expanded={expandedId === review.id}
                      selected={selectedIds.has(review.id)}
                      focused={focusedIdx === idx + (page-1)*pageSize}
                      onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
                      onSelect={e => { e.stopPropagation(); toggleSelect(review.id); }}
                      onGenerateDraft={handleGenerateDraft}
                      onPublish={handlePublish}
                      onDiscard={handleDiscard}
                      onFlag={handleFlag}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>

          {/* Pagination — inside card */}
          <div className="px-4 md:px-6 py-2.5 border-t border-[#E5E7EB]/60 flex items-center justify-between flex-shrink-0 bg-white rounded-b-2xl">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#9CA3AF]">
                {filtered.length === 0
                  ? 'No results'
                  : `${(page-1)*pageSize+1}–${Math.min(page*pageSize,filtered.length)} of ${filtered.length} reviews`}
              </p>
              <PageSizeDropdown value={pageSize} onChange={n => { setPageSize(n); setPage(1); }}/>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page===1}
                className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
              </button>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="p-1.5 rounded-md text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              {Array.from({length:totalPages},(_,i)=>i+1).filter(n=>n===1||n===totalPages||Math.abs(n-page)<=1).reduce<(number|'...')[]>((acc,n,i,arr)=>{
                if(i>0&&n-(arr[i-1] as number)>1) acc.push('...');
                acc.push(n); return acc;
              },[]).map((n,i)=>
                n==='...'
                  ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-[#9CA3AF]">…</span>
                  : <button key={n} onClick={()=>setPage(n as number)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page===n?'bg-[#111827] text-white':'text-[#6B7280] hover:bg-[#F3F4F6]'}`}>{n}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="p-1.5 rounded-md text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page===totalPages}
                className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

        </div>{/* closes card */}
      </div>{/* closes padded area */}
      </div>{/* end filter bar + table flex col */}
    </div>
  );
}
