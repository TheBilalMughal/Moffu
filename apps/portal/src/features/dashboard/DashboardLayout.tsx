import { useState, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '@/features/auth/auth.service';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';
import { FeatureAccessContext } from '@/components/FeatureGate';
import { LocationSelectionModal } from '@/features/billing/LocationSelectionModal';

function StarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  );
}

function InsightsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function GoogleProfileIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function CampaignIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function MarketingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

const navItems: { to: string; label: string; icon: React.ReactNode; featureKey: string | null }[] = [
  { to: '/dashboard',      label: 'Overview',       icon: <ChartBarIcon />,       featureKey: null },
  { to: '/google-profile', label: 'Google Profile', icon: <GoogleProfileIcon />,  featureKey: 'feature_google_profile' },
  { to: '/reviews',        label: 'Reviews',        icon: <StarIcon />,           featureKey: null },
  { to: '/insights',       label: 'Insights',       icon: <InsightsIcon />,       featureKey: 'feature_insights' },
  { to: '/brand-brain', label: 'Brand Brain', icon: <SlidersIcon />,    featureKey: 'feature_brand_brain' },
  { to: '/marketing',   label: 'Marketing',   icon: <MarketingIcon />,  featureKey: null },
  { to: '/campaigns',   label: 'Campaigns',   icon: <CampaignIcon />,   featureKey: null },
  { to: '/feedback',    label: 'Feedback',    icon: <FeedbackIcon />,   featureKey: null },
  { to: '/team',        label: 'Team',        icon: <TeamIcon />,       featureKey: 'feature_team' },
  { to: '/billing',     label: 'Billing',     icon: <BillingIcon />,    featureKey: null },
];

const navSettings = [
  { to: '/settings', label: 'Settings', icon: <CogIcon /> },
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
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/60 transition-colors group"
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
  const location = useLocation();

  // Clear search when navigating to a different page
  useEffect(() => {
    setQuery('');
    setResults([]);
    setFocused(false);
  }, [location.pathname]);

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
        focused ? 'bg-white/70 backdrop-blur-sm border border-white/60 w-56' : 'bg-transparent w-40 hover:bg-white/50'
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
          autoComplete="off"
          spellCheck={false}
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

interface BroadcastNotif {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const BROADCAST_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  info:    { bg: 'bg-[#EFF6FF]', color: 'text-[#1D4ED8]' },
  success: { bg: 'bg-[#F0FDF4]', color: 'text-[#15803D]' },
  warning: { bg: 'bg-[#FFFBEB]', color: 'text-[#B45309]' },
  error:   { bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
};

function timeAgoPortal(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotificationsBell() {
  const [open,     setOpen]     = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastNotif[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  async function load() {
    const [notifRes, pendingRes] = await Promise.all([
      supabase.from('user_notifications')
        .select('id, title, body, type, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'NEEDS_REPLY'),
    ]);
    setBroadcasts((notifRes.data ?? []) as BroadcastNotif[]);
    setPendingCount(pendingRes.count ?? 0);
  }

  useEffect(() => { load(); }, []);

  // Realtime: new broadcast notifications
  useEffect(() => {
    const channel = supabase
      .channel('portal_user_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_notifications' },
        (payload) => { setBroadcasts(prev => [payload.new as BroadcastNotif, ...prev].slice(0, 30)); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function markAllRead() {
    const unreadIds = broadcasts.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) return;
    await supabase.from('user_notifications').update({ is_read: true }).in('id', unreadIds);
    setBroadcasts(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    setBroadcasts(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  const unreadBroadcasts = broadcasts.filter(n => !n.is_read).length;
  const totalUnread = unreadBroadcasts + (pendingCount > 0 ? 1 : 0);

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
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5EAE8] rounded-xl shadow-lg z-50 flex flex-col" style={{ maxHeight: '420px' }}>
          <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            {unreadBroadcasts > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#0D4C3C] hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto divide-y divide-[#F9FAFB]">
            {/* Pending reviews row */}
            {pendingCount > 0 && (
              <button
                onClick={() => { navigate('/reviews'); setOpen(false); }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#FFFBEB] transition-colors text-left bg-[#FFFBEB]"
              >
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-[#111827]">{pendingCount} review{pendingCount !== 1 ? 's' : ''} awaiting reply</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">Go to Reviews</p>
                </div>
              </button>
            )}

            {/* Broadcast notifications */}
            {broadcasts.length === 0 && pendingCount === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#9CA3AF]">All caught up!</div>
            ) : broadcasts.length === 0 ? null : broadcasts.map(n => {
              const style = BROADCAST_TYPE_STYLE[n.type] ?? BROADCAST_TYPE_STYLE['info']!;
              return (
                <button
                  key={n.id}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAF9] transition-colors text-left ${!n.is_read ? 'bg-[#FAFFFE]' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
                    <svg className={`w-3.5 h-3.5 ${style.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-[#111827] truncate">{n.title}</p>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#0D4C3C] flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 mt-0.5 whitespace-nowrap">{timeAgoPortal(n.created_at)}</span>
                </button>
              );
            })}
          </div>
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
        <div className="absolute top-full mt-1.5 left-0 z-[200] bg-white border border-[#E5EAE8] rounded-xl shadow-lg py-1.5 min-w-[200px]">
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
        className="flex items-center gap-2 bg-transparent hover:opacity-90 transition-opacity"
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

function UpgradeWidget() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/billing')}
      className="w-full mx-0 mb-2 p-3 rounded-xl text-left cursor-pointer group transition-all duration-200
        bg-gradient-to-br from-[#0D4C3C]/[0.08] to-[#0D4C3C]/[0.04]
        border border-[#0D4C3C]/[0.12]
        hover:from-[#0D4C3C]/[0.13] hover:to-[#0D4C3C]/[0.07] hover:border-[#0D4C3C]/20"
      type="button"
    >
      <p className="text-[11px] font-semibold text-[#0D4C3C] mb-0.5">Free Plan</p>
      <p className="text-[10px] text-[#6B7280] leading-snug mb-2">Unlock more reviews, AI replies &amp; team features</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#0D4C3C]">Upgrade now</span>
        <svg className="w-3 h-3 text-[#0D4C3C] transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </button>
  );
}

export function DashboardLayout() {
  const { setLocations } = useLocationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const [featureLoading, setFeatureLoading] = useState(true);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [adminDowngradePlan, setAdminDowngradePlan] = useState<{ name: string; locationLimit: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    supabase.from('google_locations').select('id, display_name').eq('is_selected', true).then(({ data }) => {
      setLocations(data ?? []);
    });
  }, [setLocations]);

  useEffect(() => {
    async function loadFeatureAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sub } = await supabase
        .from('subscriptions').select('plan_id')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle();
      if (!sub) {
        setIsFreePlan(true);
        setFeatureLoading(false);
        return;
      }
      const { data: planRow } = await supabase
        .from('plans')
        .select('name')
        .eq('id', sub.plan_id)
        .maybeSingle();
      setIsFreePlan(planRow?.name?.toLowerCase().includes('free') ?? false);
      const { data: ents } = await supabase
        .from('plan_entitlements').select('key, bool_value, value_type, limit_value')
        .eq('plan_id', sub.plan_id);
      const map: Record<string, boolean> = {};
      for (const e of ents ?? []) {
        if (e.key === 'feature_google_profile') {
          map['feature_google_profile'] = e.bool_value !== false;
        } else if (e.key === 'feature_insights') {
          map['feature_insights'] = e.bool_value !== false;
        } else if (e.key === 'brand_brain_steps') {
          // locked when all steps are disabled (mask === 0); UNLIMITED = all accessible
          map['feature_brand_brain'] = e.value_type === 'UNLIMITED' || ((e.limit_value ?? 63) & 63) > 0;
        } else if (e.key === 'team_members') {
          // team management locked when limit <= 1 (owner only)
          map['feature_team'] = e.value_type === 'UNLIMITED' || (e.limit_value ?? 2) > 1;
        }
      }
      setFeatureAccess(map);
      setFeatureLoading(false);
    }
    loadFeatureAccess();
  }, []);

  // Realtime: detect admin-triggered plan downgrades and enforce location limits
  useEffect(() => {
    let userId: string | null = null;
    let prevPlanId: string | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;

      const channel = supabase
        .channel('subscription-plan-change')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
          async (payload) => {
            const newPlanId = (payload.new as { plan_id: string }).plan_id;
            if (!prevPlanId || newPlanId === prevPlanId) { prevPlanId = newPlanId; return; }
            prevPlanId = newPlanId;

            // Fetch new plan details to compare sort_order
            const { data: plans } = await supabase
              .from('plans')
              .select('id, name, sort_order, plan_entitlements(key, value_type, limit_value)')
              .in('id', [newPlanId]);

            const newPlan = plans?.[0];
            if (!newPlan) return;

            // Get current plan sort order from the old row
            const oldPlanId = (payload.old as { plan_id?: string }).plan_id;
            if (!oldPlanId) return;
            const { data: oldPlans } = await supabase
              .from('plans').select('sort_order').eq('id', oldPlanId).maybeSingle();
            const oldSortOrder = oldPlans?.sort_order ?? 999;

            if (newPlan.sort_order >= oldSortOrder) return; // upgrade or same, no action needed

            const locEntitlement = (newPlan.plan_entitlements as Array<{ key: string; value_type: string; limit_value: number | null }>)
              ?.find(e => e.key === 'locations');
            const newLimit = locEntitlement?.value_type === 'UNLIMITED' ? Infinity : (locEntitlement?.limit_value ?? 1);

            const { data: activeLocs } = await supabase
              .from('google_locations').select('id').eq('is_selected', true);
            const activeCount = activeLocs?.length ?? 0;

            if (activeCount > newLimit) {
              setAdminDowngradePlan({ name: newPlan.name, locationLimit: newLimit === Infinity ? activeCount : newLimit });
            }
          }
        )
        .subscribe();

      // Store current plan_id so we can detect changes
      supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
        .then(({ data }) => { prevPlanId = data?.plan_id ?? null; });

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  function isLocked(featureKey: string | null): boolean {
    if (!featureKey) return false;
    if (!(featureKey in featureAccess)) return false; // no entitlement set → accessible
    return featureAccess[featureKey] === false;
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/50 flex items-center justify-between">
        <img src="/images/logo.png" alt="Moffu" className="h-7 w-auto" />
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col overflow-y-auto gap-0.5" aria-label="Main navigation">
        {navItems.map(({ to, label, icon, featureKey }) => {
          const locked = isLocked(featureKey);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  locked
                    ? 'text-[#C4CAC8] hover:bg-[#F3F4F6] hover:text-[#9CA3AF]'
                    : isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                }`
              }
            >
              {icon}
              <span className="flex-1">{label}</span>
              {locked && (
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              )}
            </NavLink>
          );
        })}

        {/* Settings — pinned to bottom */}
        <div className="mt-auto pt-2">
          {isFreePlan && <UpgradeWidget />}
          {navSettings.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0D4C3C] text-white'
                    : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );

  return (
    <FeatureAccessContext.Provider value={{ access: featureAccess, loading: featureLoading }}>
    {adminDowngradePlan && (
      <LocationSelectionModal
        newPlanName={adminDowngradePlan.name}
        locationLimit={adminDowngradePlan.locationLimit}
        onConfirm={async () => { setAdminDowngradePlan(null); }}
        onCancel={() => setAdminDowngradePlan(null)}
      />
    )}
    <div className="flex h-screen bg-[#F0F5F3] overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, fixed column on desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-white/95 backdrop-blur-xl border-r border-white/60 shadow-[1px_0_12px_rgba(0,0,0,0.06)]
        transform transition-transform duration-200 ease-out
        md:relative md:w-56 md:flex-shrink-0 md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Topbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-8 py-3 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            {/* Mobile logo */}
            <img src="/images/logo.png" alt="Moffu" className="h-6 w-auto md:hidden flex-shrink-0" />
            <div className="hidden md:flex items-center gap-2.5">
              <TopbarLocationPicker />
              <QuickStatsPill />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1.5">
              <div className="w-px h-5 bg-[#E5EAE8]/80 mx-0.5 flex-shrink-0"/>
              <GlobalSearch />
              <div className="w-px h-5 bg-[#E5EAE8]/80 mx-0.5 flex-shrink-0"/>
            </div>
            <NotificationsBell />
            <TopbarProfile />
          </div>
        </div>

        {/* Mobile location picker row */}
        <div className="md:hidden px-4 pb-2 flex items-center gap-2">
          <TopbarLocationPicker />
          <QuickStatsPill />
        </div>

        {/* Scrollable page area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
    </FeatureAccessContext.Provider>
  );
}
