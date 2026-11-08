import { useEffect, useRef, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToDate(s: string): Date | null { return s ? new Date(s + 'T00:00:00') : null; }
function dateToIso(d: Date): string { return d.toISOString().split('T')[0] ?? ''; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── CalMonth ──────────────────────────────────────────────────────────────────

function CalMonth({ year, month, from, to, hovered, onDay, onHover, hideTitle }: {
  year: number; month: number; from: Date | null; to: Date | null; hovered: Date | null;
  onDay: (d: Date) => void; onHover: (d: Date | null) => void; hideTitle?: boolean;
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

  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-[216px]">
      {!hideTitle && (
        <p className="text-xs font-semibold text-[#111827] text-center mb-3">
          {MONTHS_LONG[month]} {year}
        </p>
      )}
      <div className="grid grid-cols-7">
        {DAYS_SHORT.map(d => (
          <div key={d} className="h-7 flex items-center justify-center text-[10px] font-medium text-[#9CA3AF]">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="h-7"/>;
          const isStart = !!from && sameDay(d, from);
          const isEnd   = !!rangeEnd && sameDay(d, rangeEnd);
          const range   = inRange(d);
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.getTime()}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onDay(d)}
              className={[
                'h-7 flex items-center justify-center text-xs cursor-pointer select-none transition-colors',
                isStart || isEnd ? 'bg-[#111111] text-white font-semibold rounded-md' : '',
                range ? 'bg-[#D8CCFF] text-[#6C55E8]' : '',
                !isStart && !isEnd && !range ? 'text-[#374151] hover:bg-[#F3F4F6] rounded-md' : '',
                isToday && !isStart && !isEnd ? 'font-bold underline decoration-dotted' : '',
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

// ── DateRangePicker ────────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Align the popover to the right edge of the trigger */
  alignRight?: boolean;
}

export function DateRangePicker({ from, to, onChange, alignRight = false }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [hovered, setHovered] = useState<Date | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fromDate = isoToDate(from);
  const toDate   = isoToDate(to);
  const hasValue = !!(from || to);
  const label = from && to
    ? `${fmtLabel(from)} – ${fmtLabel(to)}`
    : from ? `From ${fmtLabel(from)}` : 'Date range';

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
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

  function preset(f: Date, t: Date) {
    onChange(dateToIso(f), dateToIso(t));
    setSelecting('from');
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('', '');
    setSelecting('from');
  }

  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const POPUP_WIDTH = 500;
      const fitsRight = rect.left + POPUP_WIDTH <= window.innerWidth - 16;
      setPopupStyle(fitsRight
        ? { position: 'fixed', top: rect.bottom + 8, left: rect.left, zIndex: 9999 }
        : { position: 'fixed', top: rect.bottom + 8, right: window.innerWidth - rect.right, zIndex: 9999 }
      );
    }
    setOpen(o => !o);
  }

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${hasValue ? 'border-[#6C55E8] bg-[#D8CCFF] text-[#6C55E8]' : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#6C55E8] hover:text-[#6C55E8]'}`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span>{label}</span>
        {hasValue && (
          <span onClick={clear} className="ml-0.5 hover:text-red-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div style={popupStyle} className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-4 min-w-max">
          {/* Two-month grid with inline navigation */}
          <div className="flex gap-6">
            {/* Left month */}
            <div className="w-[216px]">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
                  className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <p className="text-xs font-semibold text-[#111827]">{MONTHS_LONG[viewMonth]} {viewYear}</p>
                <div className="w-6"/>
              </div>
              <CalMonth year={viewYear} month={viewMonth} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered} hideTitle/>
            </div>
            <div className="w-px bg-[#F3F4F6]"/>
            {/* Right month */}
            <div className="w-[216px]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-6"/>
                <p className="text-xs font-semibold text-[#111827]">{MONTHS_LONG[nextM]} {nextY}</p>
                <button
                  onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
                  className="p-1 rounded hover:bg-[#F3F4F6] text-[#6B7280]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
              <CalMonth year={nextY} month={nextM} from={fromDate} to={toDate} hovered={hovered} onDay={handleDay} onHover={setHovered} hideTitle/>
            </div>
          </div>

          {/* Presets */}
          <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">{selecting === 'from' ? 'Select start date' : 'Select end date'}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => { const t = new Date(); preset(t, t); }} className="text-xs text-[#6C55E8] font-medium hover:underline">Today</button>
              <button onClick={() => { const t = new Date(); preset(new Date(t.getFullYear(), t.getMonth(), 1), t); }} className="text-xs text-[#6C55E8] font-medium hover:underline">This month</button>
              <button onClick={() => { const t = new Date(); const a = new Date(t); a.setDate(t.getDate() - 29); preset(a, t); }} className="text-xs text-[#6C55E8] font-medium hover:underline">Last 30 days</button>
              {hasValue && (
                <button onClick={() => { onChange('', ''); setSelecting('from'); }} className="text-xs text-[#9CA3AF] hover:text-red-500">Clear</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

