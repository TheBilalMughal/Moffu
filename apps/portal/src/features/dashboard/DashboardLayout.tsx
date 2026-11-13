import { useState, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '@/features/auth/auth.service';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/features/location/location.store';
import { FeatureAccessContext } from '@/components/FeatureGate';
import { LocationSelectionModal } from '@/features/billing/LocationSelectionModal';
import { billingService } from '@/features/billing/billing.service';
import type { Plan, Subscription } from '@/features/billing/billing.service';
import { usePageTracking } from '@/hooks/usePageTracking';

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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
  { to: '/insights/trends', label: 'Insights', icon: <InsightsIcon />, featureKey: 'feature_insights' },
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
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
        )}
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
        <div className="absolute left-0 bottom-full mb-2 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50">
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
          className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-[200]"
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
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAF7] transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-[#D8CCFF] text-[#111111] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
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
    try {
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
    } catch { /* network unavailable */ }
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-50 flex flex-col" style={{ maxHeight: '420px' }}>
          <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            {unreadBroadcasts > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#6C55E8] hover:underline font-medium">
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
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAF7] transition-colors text-left ${!n.is_read ? 'bg-[#FDFCFF]' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
                    <svg className={`w-3.5 h-3.5 ${style.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-[#111827] truncate">{n.title}</p>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#6C55E8] flex-shrink-0" />}
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
    <span className="flex items-center gap-1 text-xs font-medium text-[#6C55E8] bg-[#EDE9FE] px-2.5 py-1 rounded-lg">
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

  if (locations.length === 0) return null;

  const current = selectedId ? locations.find(l => l.id === selectedId) : null;
  const currentRating = selectedId ? locationRatings[selectedId] : undefined;

  // Single location: show as non-interactive chip (no dropdown, no "All Locations")
  if (locations.length === 1) {
    const loc = locations[0]!;
    const avg = locationRatings[loc.id];
    return (
      <div className="inline-flex h-9 max-w-[calc(100vw-2rem)] items-center gap-2 whitespace-nowrap rounded-lg border border-[#6C55E8] bg-[#EDE9FE] px-3 text-xs font-medium text-[#6C55E8] md:max-w-[340px]">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span className="min-w-0 truncate">{loc.display_name ?? loc.id}</span>
        {avg != null && (
          <span className="inline-flex flex-shrink-0 items-center gap-1 tabular-nums text-amber-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            {avg.toFixed(1)}
          </span>
        )}
      </div>
    );
  }

  const isActive = !!selectedId;

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="topbar-location-options"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex h-9 max-w-[calc(100vw-2rem)] items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors md:max-w-[340px] ${
          isActive
            ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8] font-medium'
            : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] hover:text-[#6C55E8]'
        }`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span className="min-w-0 truncate text-xs">{current?.display_name ?? 'All Locations'}</span>
        {currentRating != null && <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-amber-600" aria-label={`Rating ${currentRating.toFixed(1)} out of 5`}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          {currentRating.toFixed(1)}
        </span>}
        <svg className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {isActive && <button
        type="button"
        aria-label="Show all locations"
        title="Show all locations"
        onClick={() => { setSelectedId(null); setOpen(false); }}
        className="ml-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-red-500"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>}

      {open && (
        <div id="topbar-location-options" role="listbox" aria-label="Choose a location" className="absolute left-0 top-full z-[200] mt-1.5 max-h-80 min-w-[240px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-lg">
          <button role="option" aria-selected={!selectedId}
            onClick={() => { setSelectedId(null); setOpen(false); }}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${!selectedId ? 'text-[#6C55E8] font-medium bg-[#EDE9FE]/40' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
          >
            <span>All Locations</span>
            {!selectedId && <svg className="w-3.5 h-3.5 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
          </button>
          {locations.map(l => {
            const avg = locationRatings[l.id];
            const sel = selectedId === l.id;
            return (
              <button
                key={l.id}
                role="option"
                aria-selected={sel}
                onClick={() => { setSelectedId(l.id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${sel ? 'text-[#6C55E8] font-medium bg-[#EDE9FE]/40' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
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
                  {sel && <svg className="w-3.5 h-3.5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
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
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
        )}
        {displayName && (
          <span className="text-sm font-medium text-[#374151] hidden sm:block">{displayName}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50">
          {/* Profile card */}
          <div className="px-4 py-4 bg-[#FAFAF7] border-b border-[#E5E7EB] flex items-center gap-3">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#111827] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials}
              </div>
            )}
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
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
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

const SIDEBAR_PLAN_ORDER = ['free', 'starter', 'growth', 'scale'] as const;

function applySidebarDiscount(cents: number, type: 'fixed' | 'percent' | null, value: number | null): number {
  if (!type || !value || value <= 0) return cents;
  if (type === 'percent') return Math.max(0, Math.round(cents * (1 - value / 100)));
  if (type === 'fixed') return Math.max(0, cents - Math.round(value * 100));
  return cents;
}

function getSidebarHighlights(plan: Plan): string[] {
  const locs    = plan.entitlements['locations']?.limit_value;
  const drafts  = plan.entitlements['ai_drafts']?.limit_value;
  const repEnt  = plan.entitlements['published_replies'];
  const members = plan.entitlements['team_members']?.limit_value;
  const h: string[] = [];
  if (locs    != null) h.push(`${locs} location${locs > 1 ? 's' : ''}`);
  if (drafts  != null) h.push(`${drafts.toLocaleString()} AI drafts/mo`);
  if (repEnt?.value_type === 'UNLIMITED') h.push('Unlimited replies');
  else if (repEnt?.limit_value != null) h.push(`${repEnt.limit_value.toLocaleString()} replies/mo`);
  if (members != null && members > 1) h.push(`${members} team members`);
  return h.slice(0, 3);
}

function SidebarUpgradeCard({ sub, plans }: { sub: Subscription | null; plans: Plan[] }) {
  const currentSlug = sub?.plan_slug ?? 'free';
  const idx         = SIDEBAR_PLAN_ORDER.indexOf(currentSlug as typeof SIDEBAR_PLAN_ORDER[number]);
  const nextSlug    = SIDEBAR_PLAN_ORDER[idx + 1];
  const nextPlan    = nextSlug ? plans.find(p => p.slug === nextSlug) ?? null : null;
  const currentPlan = plans.find(p => p.slug === currentSlug) ?? null;

  if (!nextPlan) return null;

  const rawMonthly  = nextPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0;
  const discMonthly = applySidebarDiscount(rawMonthly, nextPlan.discount_type, nextPlan.discount_value);
  const hasDiscount = rawMonthly > 0 && discMonthly < rawMonthly;
  const highlights  = getSidebarHighlights(nextPlan);

  return (
    <Link to="/plan" className="block relative overflow-hidden rounded-xl bg-[#111827] hover:bg-[#1a2235] transition-colors group">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/25 via-transparent to-[#6C55E8]/5 pointer-events-none" />
      <div className="relative p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] font-semibold bg-white/10 text-white/50 px-1.5 py-0.5 rounded-lg">
            {currentPlan?.name ?? 'Free'}
          </span>
          <svg className="w-3 h-3 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-[9px] font-semibold bg-[#6C55E8]/30 text-[#A89CFF] px-1.5 py-0.5 rounded-lg">
            {nextPlan.name}
          </span>
        </div>

        <p className="text-[11px] font-bold text-white mb-0.5">Ready for more?</p>
        <p className="text-[10px] text-white/40 mb-2 leading-relaxed">
          Unlock more with {nextPlan.name}.
        </p>

        {highlights.length > 0 && (
          <div className="space-y-1 mb-2.5">
            {highlights.map(f => (
              <div key={f} className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#6C55E8]/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2 h-2 text-[#A89CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[10px] text-white/60">{f}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {nextPlan.contact_sales ? (
              <p className="text-[10px] text-white/40">Custom pricing</p>
            ) : rawMonthly > 0 ? (
              <div>
                <div className="flex items-baseline gap-1">
                  {hasDiscount && (
                    <span className="text-[10px] text-white/30 line-through">
                      ${(rawMonthly / 100).toFixed(rawMonthly % 100 === 0 ? 0 : 2)}
                    </span>
                  )}
                  <p className="text-base font-black text-white leading-none">
                    ${(discMonthly / 100).toFixed(discMonthly % 100 === 0 ? 0 : 2)}
                    <span className="text-[10px] font-normal text-white/35">/mo</span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <span className="flex-shrink-0 inline-flex items-center bg-[#6C55E8] group-hover:bg-[#5A42D1] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Upgrade →
          </span>
        </div>
      </div>
    </Link>
  );
}

// -- Rail Groups ---------------------------------------------------------------

function AccountIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

interface RailGroupItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  featureKey: string | null;
  end?: boolean;
}

interface RailGroup {
  id: string;
  icon: React.ReactNode;
  label: string;
  items: RailGroupItem[];
}

const RAIL_GROUPS: RailGroup[] = [
  {
    id: 'overview',
    icon: <ChartBarIcon />,
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Overview', icon: <ChartBarIcon />, featureKey: null, end: true },
      { to: '/google-profile', label: 'Google Profile', icon: <GoogleProfileIcon />, featureKey: 'feature_google_profile' },
    ],
  },
  {
    id: 'reviews',
    icon: <StarIcon />,
    label: 'Reviews',
    items: [
      { to: '/reviews',             label: 'Reviews',        icon: <StarIcon />,          featureKey: null, end: true },
      { to: '/reviews/complaints',  label: 'Complaints',     icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>), featureKey: null },
    ],
  },
  {
    id: 'insights',
    icon: <InsightsIcon />,
    label: 'Insights',
    items: [
      { to: '/insights/trends',      label: 'Trends',      icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>), featureKey: 'feature_insights' },
      { to: '/insights/ratings',     label: 'Ratings',     icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>), featureKey: 'feature_insights' },
      { to: '/insights/agent-rules', label: 'Agent Rules', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>), featureKey: 'feature_insights' },
    ],
  },
  {
    id: 'ai',
    icon: <SlidersIcon />,
    label: 'Brand Brain',
    items: [
      { to: '/brand-brain', label: 'Brand Brain', icon: <SlidersIcon />, featureKey: 'feature_brand_brain' },
    ],
  },
  {
    id: 'engage',
    icon: <CampaignIcon />,
    label: 'Engage',
    items: [
      { to: '/campaigns', label: 'Campaigns', icon: <CampaignIcon />,  featureKey: null },
      { to: '/marketing', label: 'Marketing', icon: <MarketingIcon />, featureKey: null },
      { to: '/feedback',  label: 'Feedback',  icon: <FeedbackIcon />,  featureKey: null },
    ],
  },
  {
    id: 'team',
    icon: <TeamIcon />,
    label: 'Team',
    items: [
      { to: '/team', label: 'Team', icon: <TeamIcon />, featureKey: 'feature_team' },
    ],
  },
  {
    id: 'plan',
    icon: <PlanIcon />,
    label: 'Plan & Billing',
    items: [
      { to: '/plan',     label: 'Plan',    icon: <PlanIcon />,    featureKey: null },
      { to: '/billing',  label: 'Billing', icon: <BillingIcon />, featureKey: null },
    ],
  },  {
    id: 'account',
    icon: <AccountIcon />,
    label: 'Account',
    items: [
      { to: '/settings/account', label: 'Account', icon: <AccountIcon />, featureKey: null },
    ],
  },

  {
    id: 'settings',
    icon: <CogIcon />,
    label: 'Settings',
    items: [

      { to: '/settings/preferences', label: 'Preferences', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>), featureKey: null },
      { to: '/settings/integrations', label: 'Integrations', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>), featureKey: null },
    ],
  },
];

// -- NavItem -------------------------------------------------------------------

function NavItem({
  to,
  label,
  icon,
  end,
  isLocked,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  isLocked: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        'relative flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ' + (
          isLocked
            ? 'text-[#9CA3AF] hover:bg-[#F3F4F6]'
            : isActive
              ? 'bg-[#D8CCFF]/70 text-[#111111]'
              : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={isLocked ? 'text-[#D1D5DB]' : isActive ? 'text-[#6C55E8]' : 'text-[#9CA3AF]'}>
            {icon}
          </span>
          <span className="flex-1">{label}</span>
          {isLocked && (
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          )}
        </>
      )}
    </NavLink>
  );
}

// -- Rail Group Button ---------------------------------------------------------

function RailGroupButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group [&>svg]:w-5 [&>svg]:h-5 ' + (
        isActive ? 'bg-[#6C55E8] text-white' : 'text-white/40 hover:text-white hover:bg-white/10'
      )}
    >
      {icon}
      <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-[#111111] border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}

// -----------------------------------------------------------------------------

export function DashboardLayout() {
  usePageTracking();
  const { setLocations, setSelectedId, setLocationRatings } = useLocationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const [featureLoading, setFeatureLoading] = useState(true);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [upgradeSub, setUpgradeSub] = useState<Subscription | null>(null);
  const [upgradePlans, setUpgradePlans] = useState<Plan[]>([]);
  const [adminDowngradePlan, setAdminDowngradePlan] = useState<{ name: string; locationLimit: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthUserId(user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setAuthUserId(uid);
      if (!uid) { setLocations([]); setSelectedId(null); }
    });
    return () => subscription.unsubscribe();
  }, [setLocations, setSelectedId]);

  useEffect(() => {
    if (!authUserId) { setLocations([]); setLocationRatings({}); return; }
    let active = true;
    supabase
      .from('google_locations')
      .select('id, display_name')
      .eq('user_id', authUserId)
      .eq('is_selected', true)
      .then(({ data }) => {
        if (!active) return;
        const locs = data ?? [];
        setLocations(locs);
        if (locs.length === 1) setSelectedId(locs[0]!.id);
      });

    (async () => {
      const totals: Record<string, { sum: number; count: number }> = {};
      for (let from = 0; active; from += 500) {
        const { data, error } = await supabase
          .from('reviews')
          .select('location_id, rating')
          .eq('user_id', authUserId)
          .not('location_id', 'is', null)
          .range(from, from + 499);
        if (!active) return;
        if (error) { setLocationRatings({}); return; }
        for (const review of data ?? []) {
          if (!review.location_id || review.rating <= 0) continue;
          const total = totals[review.location_id] ??= { sum: 0, count: 0 };
          total.sum += review.rating;
          total.count += 1;
        }
        if ((data?.length ?? 0) < 500) break;
      }
      if (!active) return;
      setLocationRatings(Object.fromEntries(
        Object.entries(totals).map(([id, total]) => [id, total.sum / total.count]),
      ));
    })();

    return () => { active = false; };
  }, [authUserId, setLocations, setSelectedId, setLocationRatings]);

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
          map['feature_brand_brain'] = e.value_type === 'UNLIMITED' || ((e.limit_value ?? 63) & 63) > 0;
        } else if (e.key === 'team_members') {
          map['feature_team'] = e.value_type === 'UNLIMITED' || (e.limit_value ?? 2) > 1;
        }
      }
      setFeatureAccess(map);
      setFeatureLoading(false);
    }
    loadFeatureAccess();
  }, []);

  useEffect(() => {
    Promise.all([billingService.getSubscription(), billingService.getPlans()])
      .then(([sub, plans]) => { setUpgradeSub(sub); setUpgradePlans(plans); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let prevPlanId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel('subscription-plan-change')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
          async (payload) => {
            const newPlanId = (payload.new as { plan_id: string }).plan_id;
            if (!prevPlanId || newPlanId === prevPlanId) { prevPlanId = newPlanId; return; }
            prevPlanId = newPlanId;
            const { data: plans } = await supabase
              .from('plans')
              .select('id, name, sort_order, plan_entitlements(key, value_type, limit_value)')
              .in('id', [newPlanId]);
            const newPlan = plans?.[0];
            if (!newPlan) return;
            const oldPlanId = (payload.old as { plan_id?: string }).plan_id;
            if (!oldPlanId) return;
            const { data: oldPlans } = await supabase
              .from('plans').select('sort_order').eq('id', oldPlanId).maybeSingle();
            const oldSortOrder = oldPlans?.sort_order ?? 999;
            if (newPlan.sort_order >= oldSortOrder) return;
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
      supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
        .then(({ data }) => { prevPlanId = data?.plan_id ?? null; });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  function isLocked(featureKey: string | null): boolean {
    if (!featureKey) return false;
    if (!(featureKey in featureAccess)) return false;
    return featureAccess[featureKey] === false;
  }

  const activeGroupId = (() => {
    for (const group of RAIL_GROUPS) {
      for (const item of group.items) {
        const matches = item.end
          ? location.pathname === item.to
          : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
        if (matches) return group.id;
      }
    }
    return RAIL_GROUPS[0]!.id;
  })();
  const activeGroup = RAIL_GROUPS.find(g => g.id === activeGroupId) ?? RAIL_GROUPS[0]!;

  // Derive current page label for breadcrumb
  const currentPage = RAIL_GROUPS.flatMap(g => g.items).find(item => {
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  })?.label ?? null;

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
      <div className="flex h-screen bg-[#F3F4F6] overflow-hidden">

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Icon Rail � desktop only */}
        <aside className="hidden md:flex w-14 flex-shrink-0 bg-[#111111] flex-col items-center py-4 gap-1 z-20">
          <a href="/dashboard" className="w-10 h-10 flex items-center justify-center mb-2" aria-label="Moffu home">
            <img src="/images/fevicon.png" alt="" className="w-8 h-8 rounded-lg object-contain" aria-hidden="true" />
          </a>
          {RAIL_GROUPS.map(group => (
            <RailGroupButton
              key={group.id}
              icon={group.icon}
              label={group.label}
              isActive={group.id === activeGroupId}
              onClick={() => navigate(group.items[0]!.to)}
            />
          ))}
          <div className="mt-auto pt-2">
            <button
              onClick={() => { authService.logout().then(() => { window.location.replace('/auth/login'); }); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-white/10 hover:text-white transition-colors"
              title="Log out"
              aria-label="Log out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </aside>

        {/* Text Sidebar */}
        <aside className={'fixed inset-y-0 left-0 z-10 w-56 flex flex-col bg-white border-r border-[#E5E7EB] transform transition-transform duration-200 ease-out md:relative md:w-52 md:flex-shrink-0 md:translate-x-0 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="relative px-4 py-5 flex items-center justify-center flex-shrink-0">
            <img src="/images/logo.png" alt="Moffu" className="h-8 w-auto" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5" aria-label="Main navigation">
            {/* Desktop: show active group items */}
            <div className="hidden md:flex md:flex-col gap-0.5">
              <p className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">{activeGroup.label}</p>
              {activeGroup.items.map(item => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  end={item.end ?? false}
                  isLocked={isLocked(item.featureKey)}
                />
              ))}
            </div>
            {/* Mobile: show all items */}
            <div className="md:hidden flex flex-col gap-0.5">
              {RAIL_GROUPS.flatMap(group => group.items).map(item => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  end={item.end ?? false}
                  isLocked={isLocked(item.featureKey)}
                />
              ))}
            </div>
          </nav>

          {upgradePlans.length > 0 && (
            <div className="flex-shrink-0 px-3 pb-3">
              <SidebarUpgradeCard sub={upgradeSub} plans={upgradePlans} />
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0 z-30">
          {/* Topbar */}
          <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 gap-4 bg-[#F3F4F6]">
            {/* Left: hamburger (mobile) + breadcrumb (desktop) */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors flex-shrink-0"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
              <img src="/images/logo.png" alt="Moffu" className="h-6 w-auto md:hidden flex-shrink-0" />
              <div className="hidden md:flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-[#111111]">{activeGroup.label}</span>
                {currentPage && currentPage !== activeGroup.label && (
                  <>
                    <svg className="w-3 h-3 text-[#D1D5DB] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                    </svg>
                    <span className="text-sm text-[#6B7280] truncate">{currentPage}</span>
                  </>
                )}
              </div>
            </div>
            {/* Right: location + stats + search + bell + profile */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="hidden md:flex items-center gap-1.5 mr-1">
                <TopbarLocationPicker />
                <QuickStatsPill />
                <GlobalSearch />
              </div>
              <NotificationsBell />
              <TopbarProfile />
            </div>
          </div>

          {/* Mobile location picker row */}
          <div className="md:hidden px-4 py-2 flex items-center gap-2">
            <TopbarLocationPicker />
            <QuickStatsPill />
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <Outlet />
          </div>
        </main>
      </div>
    </FeatureAccessContext.Provider>
  );
}
