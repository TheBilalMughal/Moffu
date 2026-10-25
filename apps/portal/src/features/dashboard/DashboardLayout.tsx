import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '@/features/auth/auth.service';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';

function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  );
}

function InsightsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

const navItems = [
  { to: '/dashboard',  label: 'Overview',   icon: <ChartBarIcon /> },
  { to: '/reviews',    label: 'Reviews',    icon: <StarIcon /> },
  { to: '/insights',   label: 'Insights',   icon: <InsightsIcon /> },
  { to: '/brand-brain',label: 'Brand Brain',icon: <SlidersIcon /> },
  { to: '/team',       label: 'Team',       icon: <TeamIcon /> },
  { to: '/billing',    label: 'Billing',    icon: <BillingIcon /> },
  { to: '/settings',   label: 'Settings',   icon: <CogIcon /> },
];

function SidebarProfile() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const email = user?.email ?? '';
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[#F3F8F6] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111827] leading-tight truncate">
            {displayName || email}
          </p>
          {displayName && (
            <p className="text-xs text-[#9CA3AF] leading-tight truncate">{email}</p>
          )}
        </div>
        <svg className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-52 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-50">
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#374151] hover:bg-[#F8FAF9] transition-colors"
          >
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </NavLink>
        </div>
      )}
    </div>
  );
}

// ── Global Search ─────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  reviewer_name: string | null;
  rating: number;
  body: string | null;
  published_at: string | null;
  location_name: string | null;
}

function GlobalSearch() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const open = focused && (query.trim().length > 0 || loading);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
      if (e.key === 'Escape') { inputRef.current?.blur(); setFocused(false); setQuery(''); setResults([]); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, body, published_at, google_locations(display_name)')
      .or(`reviewer_name.ilike.%${q}%,body.ilike.%${q}%`)
      .order('published_at', { ascending: false })
      .limit(8);
    setResults((data ?? []).map((r: any) => ({
      id: r.id,
      reviewer_name: r.reviewer_name,
      rating: r.rating,
      body: r.body,
      published_at: r.published_at,
      location_name: r.google_locations?.display_name ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, search]);

  function snippet(text: string, q: string) {
    if (!q.trim()) return text.slice(0, 80);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text.slice(0, 80) + (text.length > 80 ? '…' : '');
    const start = Math.max(0, idx - 20);
    return (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 40) + (idx + q.length + 40 < text.length ? '…' : '');
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-0 transition-all duration-200 ${
        focused ? 'bg-[#F3F4F6] w-56' : 'bg-transparent w-40 hover:bg-[#F3F4F6]'
      }`}>
        {loading
          ? <svg className="w-3.5 h-3.5 text-[#9CA3AF] animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          : <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={focused ? 'Search reviews, reviewers…' : 'Search anything'}
          className="flex-1 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none bg-transparent min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="text-[#9CA3AF] hover:text-[#374151] transition-colors flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-[200]"
          style={{ animation: 'slideDown 0.15s ease' }}
        >
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {results.length > 0 ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-[#F9FAFB]">
              {results.map(r => (
                <button
                  key={r.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { navigate('/reviews'); setFocused(false); setQuery(''); setResults([]); }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAF9] transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {r.reviewer_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[#111827] truncate">{r.reviewer_name ?? 'Anonymous'}</span>
                      <span className="text-[10px] text-amber-500 flex-shrink-0">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    {r.body && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{snippet(r.body, query)}</p>}
                    {r.location_name && <p className="text-[10px] text-[#9CA3AF] mt-0.5">{r.location_name}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="px-4 py-6 text-center text-xs text-[#9CA3AF]">No results for "{query}"</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Notifications Bell ────────────────────────────────────────────────────────

interface Notif {
  id: string;
  type: 'pending' | 'new';
  text: string;
  sub: string;
  time: string;
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    async function load() {
      const [pending, recent] = await Promise.all([
        supabase.from('reviews').select('id, reviewer_name, published_at', { count: 'exact' })
          .eq('status', 'NEEDS_REPLY').order('published_at', { ascending: false }).limit(5),
        supabase.from('reviews').select('id, reviewer_name, rating, published_at')
          .gte('published_at', new Date(Date.now() - 86400000).toISOString())
          .order('published_at', { ascending: false }).limit(3),
      ]);
      const list: Notif[] = [];
      if ((pending.count ?? 0) > 0) {
        list.push({
          id: 'pending-summary',
          type: 'pending',
          text: `${pending.count} review${pending.count !== 1 ? 's' : ''} awaiting reply`,
          sub: 'Requires your attention',
          time: 'Now',
        });
      }
      (recent.data ?? []).forEach((r: any) => {
        list.push({
          id: r.id,
          type: 'new',
          text: r.reviewer_name ?? 'Anonymous',
          sub: `New ${r.rating}★ review`,
          time: new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
      });
      setNotifs(list);
    }
    load();
  }, []);

  const unread = notifs.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        title="Notifications"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            {unread > 0 && <span className="text-xs text-[#9CA3AF]">{unread} new</span>}
          </div>
          {notifs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#9CA3AF]">All caught up!</div>
          ) : (
            <div className="divide-y divide-[#F9FAFB] max-h-72 overflow-y-auto">
              {notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => { navigate('/reviews'); setOpen(false); }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAF9] transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === 'pending' ? 'bg-amber-100' : 'bg-[#E6F2EE]'}`}>
                    {n.type === 'pending'
                      ? <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      : <svg className="w-3.5 h-3.5 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827] truncate">{n.text}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{n.sub}</p>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 mt-1">{n.time}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quick Stats Pill ──────────────────────────────────────────────────────────

function QuickStatsPill() {
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .gte('published_at', today.toISOString())
      .then(({ count }) => setTodayCount(count ?? 0));
  }, []);

  if (todayCount === null || todayCount === 0) return null;

  return (
    <span className="flex items-center gap-1 text-xs font-medium text-[#0D4C3C] bg-[#E6F2EE] px-2.5 py-1 rounded-lg">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
      </svg>
      +{todayCount} today
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TopbarLocationPicker() {
  const { locations, selectedId, setSelectedId, locationRatings } = useLocationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  if (locations.length < 2) return null;

  const current = selectedId ? locations.find(l => l.id === selectedId) : null;
  const isActive = !!selectedId;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
          isActive
            ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C] font-medium'
            : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#0D4C3C] hover:text-[#0D4C3C]'
        }`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span className="text-xs">{current?.display_name ?? 'All Locations'}</span>
        {isActive
          ? <span onClick={e => { e.stopPropagation(); setSelectedId(null); setOpen(false); }} className="ml-0.5 hover:text-red-500 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
            </span>
          : <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        }
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E5EAE8] rounded-xl shadow-lg py-1.5 min-w-[200px]">
          <button
            onClick={() => { setSelectedId(null); setOpen(false); }}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${!selectedId ? 'text-[#0D4C3C] font-medium bg-[#F0F7F5]' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}
          >
            <span>All Locations</span>
            {!selectedId && <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
          </button>
          {locations.map(l => {
            const avg = locationRatings[l.id];
            const sel = selectedId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => { setSelectedId(l.id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${sel ? 'text-[#0D4C3C] font-medium bg-[#F0F7F5]' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}
              >
                <span>{l.display_name ?? l.id}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {avg != null && (
                    <span className={`flex items-center gap-0.5 text-xs ${sel ? 'text-amber-500' : 'text-[#9CA3AF]'}`}>
                      <svg className="w-3 h-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                      {avg.toFixed(1)}
                    </span>
                  )}
                  {sel && <svg className="w-3.5 h-3.5 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopbarProfile() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const email = user?.email ?? '';
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    await authService.logout();
    window.location.replace('/auth/login');
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        title={displayName || email}
      >
        <div className="w-8 h-8 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        {displayName && (
          <span className="text-sm font-medium text-[#374151] hidden sm:block">{displayName}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-50">
          {/* Profile card */}
          <div className="px-4 py-4 bg-[#F8FAF9] border-b border-[#E5EAE8] flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827] truncate">{displayName || email}</p>
              {displayName && <p className="text-xs text-[#6B7280] truncate mt-0.5">{email}</p>}
              {memberSince && <p className="text-[10px] text-[#9CA3AF] mt-1">Member since {memberSince}</p>}
            </div>
          </div>
          {/* Actions */}
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#374151] hover:bg-[#F8FAF9] transition-colors"
          >
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Settings
          </NavLink>
          <div className="border-t border-[#F3F4F6]"/>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardLayout() {
  const { setLocations } = useLocationStore();

  useEffect(() => {
    supabase.from('google_locations').select('id, display_name').eq('is_selected', true).then(({ data }) => {
      setLocations(data ?? []);
    });
  }, [setLocations]);

  return (
    <div className="flex h-screen bg-[#F8FAF9] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-[#E5EAE8] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#E5EAE8]">
          <img src="/images/logo.png" alt="Moffu" className="h-7 w-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0D4C3C] text-white'
                    : 'text-[#5A7169] hover:bg-[#F3F8F6] hover:text-[#0D4C3C]'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Topbar — transparent, no border */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 gap-4">
          <div className="flex items-center gap-2.5">
            <TopbarLocationPicker />
            <QuickStatsPill />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-px h-5 bg-[#E5EAE8] mx-0.5 flex-shrink-0"/>
            <GlobalSearch />
            <div className="w-px h-5 bg-[#E5EAE8] mx-0.5 flex-shrink-0"/>
            <NotificationsBell />
            <TopbarProfile />
          </div>
        </div>

        {/* Scrollable page area */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-[#F8FAF9]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
