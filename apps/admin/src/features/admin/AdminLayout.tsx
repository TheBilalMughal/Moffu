import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { adminAuthService } from '@/features/auth/auth.service';
import { supabase } from '@/lib/supabase';

const NAV_DASHBOARD = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
];

const NAV_CLIENTS = [
  {
    to: '/clients',
    label: 'Clients',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/billing',
    label: 'Subscriptions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const NAV_FINANCE = [
  {
    to: '/payments',
    label: 'Payments',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

const NAV_ADMINISTRATION = [
  {
    to: '/users',
    label: 'Users',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    to: '/roles',
    label: 'Roles & Permissions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    to: '/audit',
    label: 'Audit Logs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

const NAV_SETTINGS = [
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  support: 'Support',
  operations: 'Operations',
  viewer: 'Viewer',
};

// ── Admin Search ──────────────────────────────────────────────────────────────

interface AdminSearchResult {
  id: string;
  kind: 'org' | 'member';
  title: string;
  sub: string;
}

function AdminSearch() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const open = focused && (query.trim().length > 0 || loading);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); setFocused(true); }
      if (e.key === 'Escape') { inputRef.current?.blur(); setFocused(false); setQuery(''); setResults([]); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const [orgs, members] = await Promise.all([
      supabase.from('organizations').select('id, name').ilike('name', `%${q}%`).limit(5),
      supabase.from('profiles').select('id, display_name, email').or(`display_name.ilike.%${q}%,email.ilike.%${q}%`).limit(4),
    ]);
    const list: AdminSearchResult[] = [
      ...(orgs.data ?? []).map((o: any) => ({ id: o.id, kind: 'org' as const, title: o.name, sub: 'Client' })),
      ...(members.data ?? []).map((m: any) => ({ id: m.id, kind: 'member' as const, title: m.display_name ?? m.email, sub: m.email })),
    ];
    setResults(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-0 transition-all duration-200 ${
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
          placeholder={focused ? 'Search orgs, members…' : 'Search anything'}
          className="flex-1 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none bg-transparent min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="text-[#9CA3AF] hover:text-[#374151] transition-colors flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-[200]"
          style={{ animation: 'slideDown 0.15s ease' }}>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-[#F9FAFB]">
              {results.map(r => (
                <button key={r.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    navigate(r.kind === 'org' ? '/clients' : '/users');
                    setFocused(false); setQuery(''); setResults([]);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAF9] transition-colors text-left">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${r.kind === 'org' ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'bg-[#EDE9FE] text-[#5B21B6]'}`}>
                    {r.title[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827] truncate">{r.title}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{r.sub}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${r.kind === 'org' ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'bg-[#EDE9FE] text-[#5B21B6]'}`}>
                    {r.kind === 'org' ? 'Org' : 'Member'}
                  </span>
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

// ── Admin Notifications Bell ──────────────────────────────────────────────────

interface AdminNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const NOTIF_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  new_client:               { bg: 'bg-[#E6F2EE]', text: 'text-[#0D4C3C]', icon: '🏢' },
  subscription_changed:     { bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', icon: '↑' },
  subscription_cancelled:   { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', icon: '✕' },
  google_connected:         { bg: 'bg-[#F0FDF4]', text: 'text-[#15803D]', icon: 'G' },
  google_disconnected:      { bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]', icon: 'G' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notifRoute(type: string) {
  if (type === 'new_client') return '/clients';
  if (type.startsWith('subscription')) return '/billing';
  if (type.startsWith('google')) return '/clients';
  return '/';
}

function AdminNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Initial load
  useEffect(() => {
    supabase
      .from('admin_notifications')
      .select('id, type, title, body, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setNotifs(data as AdminNotif[]); });
  }, []);

  // Realtime: new notifications appear instantly
  useEffect(() => {
    const channel = supabase
      .channel('admin_notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setNotifs(prev => [payload.new as AdminNotif, ...prev].slice(0, 30));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        title="Notifications">
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5EAE8] rounded-xl shadow-lg z-50 flex flex-col" style={{ maxHeight: '420px' }}>
          <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#0D4C3C] hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#9CA3AF]">All caught up!</div>
          ) : (
            <div className="divide-y divide-[#F9FAFB] overflow-y-auto">
              {notifs.map(n => {
                const style = NOTIF_STYLE[n.type] ?? { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', icon: '•' };
                return (
                  <button key={n.id}
                    onClick={() => { markRead(n.id); navigate(notifRoute(n.type)); setOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAF9] transition-colors text-left ${!n.is_read ? 'bg-[#FAFFFE]' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${style.bg} ${style.text}`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-[#111827] truncate">{n.title}</p>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#0D4C3C] flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin Profile ─────────────────────────────────────────────────────────────

function AdminProfile() {
  const { user, platformRole } = useAdminAuthStore();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? '';
  const email = user?.email ?? '';
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;
  const roleLabel = ROLE_LABEL[platformRole ?? ''] ?? platformRole ?? '';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await adminAuthService.logout();
    navigate('/auth/login', { replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        title={displayName || email}>
        <div className="w-8 h-8 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        {displayName && (
          <span className="text-sm font-medium text-[#374151] hidden sm:block">{displayName}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E5EAE8] rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-4 bg-[#F8FAF9] border-b border-[#E5EAE8] flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827] truncate">{displayName || email}</p>
              {displayName && <p className="text-xs text-[#6B7280] truncate mt-0.5">{email}</p>}
              {roleLabel && (
                <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E6F2EE] text-[#0D4C3C]">{roleLabel}</span>
              )}
              {memberSince && <p className="text-[10px] text-[#9CA3AF] mt-1">Member since {memberSince}</p>}
            </div>
          </div>
          <div className="border-t border-[#F3F4F6]"/>
          <button onClick={handleSignOut} disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  return (
    <div className="flex h-screen bg-[#F8FAF9] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-[#E5EAE8] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[#E5EAE8] flex flex-col gap-0.5">
          <img src="/images/logo.png" alt="Moffu" className="h-7 w-auto self-start" />
          <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col overflow-y-auto gap-4">
          {/* Dashboard */}
          <div className="space-y-0.5">
            {NAV_DASHBOARD.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Clients & Subscriptions */}
          <div className="space-y-0.5">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Clients</p>
            {NAV_CLIENTS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Finance */}
          <div className="space-y-0.5">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Finance</p>
            {NAV_FINANCE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Administration */}
          <div className="space-y-0.5">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Administration</p>
            {NAV_ADMINISTRATION.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Settings — pinned to bottom */}
          <div className="mt-auto pt-4 border-t border-[#E5EAE8] space-y-0.5">
            {NAV_SETTINGS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0D4C3C] text-white'
                      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Topbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 gap-4">
          <div />
          <div className="flex items-center gap-1.5">
            <div className="w-px h-5 bg-[#E5EAE8] mx-0.5 flex-shrink-0"/>
            <AdminSearch />
            <div className="w-px h-5 bg-[#E5EAE8] mx-0.5 flex-shrink-0"/>
            <AdminNotificationsBell />
            <AdminProfile />
          </div>
        </div>

        {/* Page area — each page manages its own scroll */}
        <div className="flex-1 overflow-hidden min-h-0 bg-[#F8FAF9]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
