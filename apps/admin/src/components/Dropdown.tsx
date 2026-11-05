import { useEffect, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Show X to clear selection — use for filter chips */
  clearable?: boolean;
  icon?: React.ReactNode;
  /** Extra class on the trigger button */
  className?: string;
  /** Full-width trigger + popover (for form fields inside modals/panels) */
  fullWidth?: boolean;
  /** Show search input inside popover — auto-enabled when options.length >= 5 */
  searchable?: boolean;
}

export function Dropdown({
  options, value, onChange,
  placeholder = 'Select…',
  clearable = false,
  icon,
  className = '',
  fullWidth = false,
  searchable,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const isSearchable = searchable ?? options.length >= 5;
  const visibleOptions = isSearchable && searchQ
    ? options.filter(o => o.label.toLowerCase().includes(searchQ.toLowerCase()))
    : options;
  const isActive = value !== '' && value !== 'all';

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearchQ(''); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (open && isSearchable) setTimeout(() => searchRef.current?.focus(), 50);
    if (!open) setSearchQ('');
  }, [open, isSearchable]);

  const triggerBase = `flex items-center gap-1.5 text-sm border transition-colors ${fullWidth ? 'w-full justify-between px-3 py-2' : 'px-3 py-1.5'}`;
  const triggerColor = isActive && !fullWidth
    ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-medium rounded-lg'
    : 'border-[#E5EAE8] text-[#374151] hover:border-[#0D4C3C] hover:text-[#0D4C3C] rounded-lg bg-white';

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${triggerBase} ${triggerColor} ${className}`}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className={`truncate ${fullWidth ? 'flex-1 text-left text-[#111827]' : 'text-xs'}`}>
          {selected?.label ?? placeholder}
        </span>
        {clearable && isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="ml-0.5 text-[#9CA3AF] hover:text-red-500 transition-colors flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        ) : (
          <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className={`absolute top-full mt-1.5 z-50 bg-white shadow-sm rounded-xl shadow-lg ${fullWidth ? 'left-0 right-0' : 'left-0 min-w-[160px]'}`}>
          {isSearchable && (
            <div className="p-2 border-b border-[#F3F4F6]">
              <input
                ref={searchRef}
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search…"
                className="w-full px-2.5 py-1.5 text-xs border border-[#E5EAE8] rounded-lg focus:outline-none focus:border-[#0D4C3C] text-[#374151]"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <div className="py-1.5 max-h-56 overflow-y-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-3.5 py-2 text-xs text-[#9CA3AF]">No results</p>
            ) : visibleOptions.map((opt) => {
              const sel = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearchQ(''); }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${
                    sel ? 'text-[#0D4C3C] font-medium bg-[#F0F7F5]' : 'text-[#374151] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sel && (
                    <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
