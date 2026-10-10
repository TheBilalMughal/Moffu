import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { googleService } from '@/features/google/google.service';

type DbStatus = 'NEW' | 'DRAFTING' | 'DRAFT_READY' | 'AWAITING_APPROVAL' | 'NEEDS_ATTENTION' | 'PUBLISHING' | 'PUBLISHED' | 'PUBLISH_FAILED';
type UiStatus = 'pending' | 'draft_ready' | 'replied';
type SortField = 'published_at' | 'rating';
type SortDir = 'asc' | 'desc';

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  published_at: string | null;
  body: string | null;
  status: DbStatus;
  reply_draft: string | null;
  reply_text: string | null;
}

function toUiStatus(s: DbStatus): UiStatus {
  if (s === 'PUBLISHED') return 'replied';
  if (s === 'DRAFTING' || s === 'DRAFT_READY' || s === 'AWAITING_APPROVAL' || s === 'NEEDS_ATTENTION' || s === 'PUBLISHING' || s === 'PUBLISH_FAILED') return 'draft_ready';
  return 'pending';
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <svg key={n} className={`${cls} ${n <= rating ? 'text-amber-400' : 'text-[#E5E7EB]'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

const STATUS_DOT: Record<UiStatus, { dot: string; label: string; badge: string }> = {
  pending:    { dot: 'bg-amber-400', label: 'Pending',     badge: 'text-amber-700 bg-amber-50 border-amber-200' },
  draft_ready:{ dot: 'bg-blue-400',  label: 'Draft Ready', badge: 'text-blue-700 bg-blue-50 border-blue-200' },
  replied:    { dot: 'bg-[#0D4C3C]', label: 'Replied',    badge: 'text-[#0D4C3C] bg-[#E6F2EE] border-[#C3DDD6]' },
};

const PAGE_SIZE = 20;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Date Range Picker ────────────────────────────────────────────────────────

function isoToDate(s: string) { return s ? new Date(s + 'T00:00:00') : null; }
function dateToIso(d: Date) { return d.toISOString().split('T')[0]; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarMonth({
  year, month, from, to, hovered,
  onDay, onHover,
}: {
  year: number; month: number;
  from: Date | null; to: Date | null; hovered: Date | null;
  onDay: (d: Date) => void;
  onHover: (d: Date | null) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const rangeEnd = to ?? hovered;

  function inRange(d: Date) {
    if (!from || !rangeEnd) return false;
    const [lo, hi] = from <= rangeEnd ? [from, rangeEnd] : [rangeEnd, from];
    return d > lo && d < hi;
  }

  function isStart(d: Date) { return !!from && sameDay(d, from); }
  function isEnd(d: Date) { return !!rangeEnd && sameDay(d, rangeEnd); }

  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-[224px]">
      <p className="text-xs font-semibold text-[#111827] text-center mb-3">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-[10px] font-medium text-[#9CA3AF]">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="h-7" />;
          const start = isStart(d);
          const end = isEnd(d);
          const range = inRange(d);
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.getTime()}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onDay(d)}
              className={[
                'h-7 flex items-center justify-center text-xs cursor-pointer select-none transition-colors',
                start || end ? 'bg-[#0D4C3C] text-white font-semibold rounded-md' : '',
                range ? 'bg-[#E6F2EE] text-[#0D4C3C]' : '',
                !start && !end && !range ? 'text-[#374151] hover:bg-[#F3F4F6] rounded-md' : '',
                isToday && !start && !end ? 'font-bold underline' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePicker({ from, to, onChange }: {
  from: string; to: string;
  onChange: (f: string, t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [hovered, setHovered] = useState<Date | null>(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const fromDate = isoToDate(from);
  const toDate = isoToDate(to);

  const label = from && to
    ? `${new Date(from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : from
    ? `From ${new Date(from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Date range';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleDay(d: Date) {
    if (selecting === 'from' || !fromDate) {
      onChange(dateToIso(d), '');
      setSelecting('to');
    } else {
      const [lo, hi] = d >= fromDate ? [fromDate, d] : [d, fromDate];
      onChange(dateToIso(lo), dateToIso(hi));
      setSelecting('from');
      setOpen(false);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('', '');
    setSelecting('from');
  }

  const hasValue = !!(from || to);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
          hasValue
            ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-medium'
            : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#0D4C3C] hover:text-[#0D4C3C]'
        }`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span>{label}</span>
        {hasValue && (
          <span onClick={clear} className="ml-1 hover:text-red-500 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-[#E5EAE8] rounded-xl shadow-lg p-4">
          {/* nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          {/* Two months side by side */}
          <div className="flex gap-6">
            <CalendarMonth year={viewYear} month={viewMonth} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered} />
            <div className="w-px bg-[#F3F4F6]" />
            <CalendarMonth year={nextY} month={nextM} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered} />
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">
              {selecting === 'from' ? 'Select start date' : 'Select end date'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const t = new Date(); onChange(dateToIso(new Date(t.getFullYear(), t.getMonth(), 1)), dateToIso(t)); setOpen(false); }}
                className="text-xs text-[#0D4C3C] font-medium hover:underline"
              >
                This month
              </button>
              <button
                onClick={() => { const t = new Date(); const ago = new Date(t); ago.setDate(t.getDate()-29); onChange(dateToIso(ago), dateToIso(t)); setOpen(false); }}
                className="text-xs text-[#0D4C3C] font-medium hover:underline"
              >
                Last 30 days
              </button>
              {hasValue && (
                <button onClick={() => { onChange('',''); setSelecting('from'); }} className="text-xs text-[#9CA3AF] hover:text-red-500">Clear</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Review Row ───────────────────────────────────────────────────────────────

function ReviewRow({
  review, expanded, onToggle, onGenerateDraft, onPublish, onDiscard,
}: {
  review: Review; expanded: boolean;
  onToggle: () => void;
  onGenerateDraft: (id: string) => void;
  onPublish: (id: string, draft: string) => Promise<{ error?: string }>;
  onDiscard: (id: string) => Promise<void>;
}) {
  const uiStatus = toUiStatus(review.status);
  const s = STATUS_DOT[uiStatus];
  const [draftText, setDraftText] = useState(review.reply_draft ?? '');
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [publishError, setPublishError] = useState('');

  useEffect(() => { setDraftText(review.reply_draft ?? ''); }, [review.reply_draft]);

  const dateStr = review.published_at
    ? new Date(review.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const initials = (review.reviewer_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isDrafting = review.status === 'DRAFTING';
  const isPublishing = review.status === 'PUBLISHING';

  async function handlePublish() {
    setPublishing(true); setPublishError('');
    const r = await onPublish(review.id, draftText);
    if (r?.error) setPublishError(r.error);
    setPublishing(false);
  }

  async function handleDiscard() {
    setDiscarding(true);
    await onDiscard(review.id);
    setDiscarding(false);
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className={`group cursor-pointer border-b border-[#F3F4F6] transition-colors ${expanded ? 'bg-[#F8FAF9]' : 'hover:bg-[#FAFAFA]'}`}
      >
        <td className="px-4 py-3 w-48">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <span className="text-sm font-medium text-[#111827] truncate">{review.reviewer_name ?? 'Anonymous'}</span>
          </div>
        </td>
        <td className="px-3 py-3 w-28"><Stars rating={review.rating} size="xs" /></td>
        <td className="px-3 py-3">
          <p className="text-sm text-[#6B7280] truncate max-w-sm">{review.body ?? <span className="italic">No text</span>}</p>
        </td>
        <td className="px-3 py-3 w-32 text-xs text-[#9CA3AF] whitespace-nowrap">{dateStr}</td>
        <td className="px-3 py-3 w-36">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${s.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {isPublishing ? 'Publishing…' : isDrafting ? 'Generating…' : s.label}
          </span>
        </td>
        <td className="px-3 py-3 w-8">
          <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[#F8FAF9] border-b border-[#E5EAE8]">
          <td colSpan={6} className="px-6 py-4">
            <div className="max-w-2xl">
              {review.body && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">Review</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stars rating={review.rating} />
                    <span className="text-xs text-[#9CA3AF]">{dateStr}</span>
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">{review.body}</p>
                </div>
              )}

              {uiStatus === 'pending' && (
                <button
                  onClick={e => { e.stopPropagation(); onGenerateDraft(review.id); }}
                  disabled={isDrafting}
                  className="flex items-center gap-2 text-sm font-medium text-[#0D4C3C] hover:text-[#083F32] transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${isDrafting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                  </svg>
                  {isDrafting ? 'Generating AI draft…' : 'Generate AI Draft'}
                </button>
              )}

              {uiStatus === 'draft_ready' && (
                <div onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">AI Draft</p>
                  <textarea
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    rows={3}
                    disabled={isPublishing || publishing}
                    className="w-full text-sm text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none disabled:opacity-60 mb-2.5"
                  />
                  {publishError && <p className="text-xs text-red-600 mb-2">{publishError}</p>}
                  <div className="flex items-center gap-2">
                    <button onClick={handlePublish} disabled={publishing || isPublishing || !draftText}
                      className="bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      {publishing || isPublishing ? 'Publishing…' : 'Approve & Publish'}
                    </button>
                    <button onClick={handleDiscard} disabled={discarding || publishing}
                      className="text-sm text-[#6B7280] hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                      {discarding ? '…' : 'Discard'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); onGenerateDraft(review.id); }} disabled={isDrafting}
                      className="text-sm text-[#6B7280] hover:text-[#0D4C3C] font-medium px-3 py-1.5 rounded-lg hover:bg-[#F0F7F5] transition-colors disabled:opacity-50 ml-auto">
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {uiStatus === 'replied' && (review.reply_text || review.reply_draft) && (
                <div>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">Your Reply</p>
                  <p className="text-sm text-[#374151] bg-white border border-[#E5EAE8] rounded-lg px-3 py-2.5 leading-relaxed">
                    {review.reply_text ?? review.reply_draft}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncError, setSyncError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UiStatus>('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('published_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadReviews() {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, published_at, body, status, reply_draft, reply_text')
      .order('published_at', { ascending: false });
    if (!error) setReviews((data as Review[]) ?? []);
    setLoading(false);
  }

  async function checkConnection() {
    const { data } = await supabase.from('google_connections').select('state').eq('state','CONNECTED').maybeSingle();
    setIsConnected(!!data);
  }

  useEffect(() => { loadReviews(); checkConnection(); }, []);

  async function handleSync() {
    setSyncing(true); setSyncMsg(''); setSyncError('');
    const { synced, error } = await googleService.syncReviews();
    if (error) setSyncError(error);
    else { setSyncMsg(`Synced ${synced} review${synced !== 1 ? 's' : ''}.`); await loadReviews(); }
    setSyncing(false);
  }

  async function handleGenerateDraft(id: string) {
    setReviews(p => p.map(r => r.id === id ? { ...r, status: 'DRAFTING' as const } : r));
    const { error } = await googleService.generateDraft(id);
    if (error) { setReviews(p => p.map(r => r.id === id ? { ...r, status: 'NEW' as const } : r)); setSyncError(error); }
    else await loadReviews();
  }

  async function handlePublish(id: string, draft: string): Promise<{ error?: string }> {
    const r = await googleService.publishReply(id, draft);
    if (!r.error) await loadReviews();
    return r;
  }

  async function handleDiscard(id: string) {
    await supabase.from('reviews').update({ status: 'NEW', reply_draft: null }).eq('id', id);
    await loadReviews();
    setExpandedId(null);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  }

  const filtered = reviews.filter(r => {
    if (statusFilter !== 'all' && toUiStatus(r.status) !== statusFilter) return false;
    if (ratingFilter > 0 && r.rating !== ratingFilter) return false;
    if (search) { const q = search.toLowerCase(); if (!r.reviewer_name?.toLowerCase().includes(q) && !r.body?.toLowerCase().includes(q)) return false; }
    if (dateFrom && r.published_at && r.published_at < dateFrom) return false;
    if (dateTo && r.published_at && r.published_at > dateTo + 'T23:59:59') return false;
    return true;
  }).sort((a, b) => {
    const av = sortField === 'rating' ? a.rating : (a.published_at ?? '');
    const bv = sortField === 'rating' ? b.rating : (b.published_at ?? '');
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all: reviews.length,
    pending: reviews.filter(r => toUiStatus(r.status) === 'pending').length,
    draft_ready: reviews.filter(r => toUiStatus(r.status) === 'draft_ready').length,
    replied: reviews.filter(r => toUiStatus(r.status) === 'replied').length,
  };

  const hasFilters = !!(search || statusFilter !== 'all' || ratingFilter > 0 || dateFrom || dateTo);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return (
      <svg className="w-3 h-3 text-[#D1D5DB] ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
      </svg>
    );
    return (
      <svg className="w-3 h-3 text-[#0D4C3C] ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}/>
      </svg>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[#E5EAE8] bg-white flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Reviews</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{reviews.length} total</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !isConnected}
          title={!isConnected ? 'Connect Google Business Profile first' : 'Sync latest reviews'}
          className="flex items-center gap-2 bg-[#0D4C3C] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-[#083F32] disabled:cursor-not-allowed"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {syncing ? 'Syncing…' : 'Sync Reviews'}
        </button>
      </div>

      {/* Alerts */}
      {(syncMsg || syncError) && (
        <div className="px-8 pt-3 flex-shrink-0">
          {syncMsg && (
            <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700 flex items-center justify-between">
              {syncMsg}
              <button onClick={() => setSyncMsg('')}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
          )}
          {syncError && (
            <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 flex items-center justify-between">
              {syncError}
              <button onClick={() => setSyncError('')}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="px-8 py-3 border-b border-[#E5EAE8] bg-white flex-shrink-0">
        <div className="flex items-center gap-1 mb-3">
          {(['all','pending','draft_ready','replied'] as const).map(key => {
            const labels = { all: 'All', pending: 'Pending', draft_ready: 'Draft Ready', replied: 'Replied' };
            return (
              <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === key ? 'bg-[#0D4C3C] text-white' : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'}`}>
                {labels[key]}
                <span className={`ml-1.5 text-xs ${statusFilter === key ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{counts[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input type="text" placeholder="Search reviewer or review…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0D4C3C] focus:border-[#0D4C3C] w-56"/>
          </div>

          {/* Rating */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 transition-colors ${ratingFilter > 0 ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#D1D5DB]'}`}>
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <select value={ratingFilter} onChange={e => { setRatingFilter(Number(e.target.value)); setPage(1); }}
              className={`text-xs bg-transparent focus:outline-none cursor-pointer ${ratingFilter > 0 ? 'text-[#0D4C3C] font-medium' : 'text-[#6B7280]'}`}>
              <option value={0}>All ratings</option>
              {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
            </select>
          </div>

          {/* Date range picker */}
          <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />

          {/* Clear */}
          {hasFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setRatingFilter(0); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors font-medium">
              Clear all
            </button>
          )}

          {hasFilters && (
            <span className="text-xs text-[#9CA3AF] ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="px-8 py-4 space-y-2">
            {[1,2,3,4,5].map(n => <div key={n} className="h-12 bg-[#F3F4F6] rounded-lg animate-pulse"/>)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <svg className="w-10 h-10 text-[#D1D5DB] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p className="text-sm font-medium text-[#374151] mb-1">
              {reviews.length === 0
                ? isConnected ? 'No reviews yet — click Sync Reviews' : 'Connect Google Business Profile from Settings'
                : 'No reviews match your filters'}
            </p>
            {hasFilters && <button onClick={() => { setSearch(''); setStatusFilter('all'); setRatingFilter(0); setDateFrom(''); setDateTo(''); }} className="text-xs text-[#0D4C3C] underline mt-1">Clear filters</button>}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#FAFAFA] border-b border-[#E5EAE8] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-48 pl-8">Reviewer</th>
                <th className="px-3 py-2.5 text-left w-28">
                  <button onClick={() => toggleSort('rating')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#0D4C3C]">
                    Rating <SortIcon field="rating"/>
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Review</th>
                <th className="px-3 py-2.5 text-left w-32">
                  <button onClick={() => toggleSort('published_at')} className="flex items-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[#0D4C3C]">
                    Date <SortIcon field="published_at"/>
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-36">Status</th>
                <th className="w-8 pr-8"/>
              </tr>
            </thead>
            <tbody className="bg-white">
              {paginated.map(review => (
                <ReviewRow
                  key={`${review.id}-${review.status}-${review.reply_draft ?? ''}`}
                  review={review}
                  expanded={expandedId === review.id}
                  onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
                  onGenerateDraft={handleGenerateDraft}
                  onPublish={handlePublish}
                  onDiscard={handleDiscard}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-8 py-3 border-t border-[#E5EAE8] bg-white flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-[#9CA3AF]">
            Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
              className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            {Array.from({length:totalPages},(_,i)=>i+1).filter(n=>n===1||n===totalPages||Math.abs(n-page)<=1).reduce<(number|'...')[]>((acc,n,i,arr)=>{
              if(i>0&&n-(arr[i-1] as number)>1)acc.push('...');
              acc.push(n); return acc;
            },[]).map((n,i)=>
              n==='...'?<span key={`e${i}`} className="px-1 text-xs text-[#9CA3AF]">…</span>:
              <button key={n} onClick={()=>setPage(n as number)}
                className={`w-7 h-7 rounded-md text-xs font-medium ${page===n?'bg-[#0D4C3C] text-white':'text-[#6B7280] hover:bg-[#F3F4F6]'}`}>{n}</button>
            )}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
