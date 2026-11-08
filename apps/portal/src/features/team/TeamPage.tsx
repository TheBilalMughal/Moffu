import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { teamService, TeamMember, TeamInvitation, MemberRole } from './team.service';

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', viewer: 'Viewer',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner:   'bg-[#EDE9FE] text-[#6C55E8]',
  admin:   'bg-[#EEF2FF] text-[#4338CA]',
  manager: 'bg-[#FEF3C7] text-[#92400E]',
  viewer:  'bg-[#F3F4F6] text-[#374151]',
};

const ALL_ROLES: MemberRole[] = ['owner', 'admin', 'manager', 'viewer'];

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// â"€â"€ Invite Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface InviteModalProps {
  orgId: string;
  seatsLeft: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INVITE_ROLES: { value: MemberRole; label: string; desc: string }[] = [
  { value: 'viewer',  label: 'Viewer',  desc: 'Read-only access' },
  { value: 'manager', label: 'Manager', desc: 'Can reply to reviews' },
  { value: 'admin',   label: 'Admin',   desc: 'Full access except billing' },
];

function InviteModal({ orgId, seatsLeft, onClose, onSuccess }: InviteModalProps) {
  const [email,      setEmail]      = useState('');
  const [role,       setRole]       = useState<MemberRole>('viewer');
  const [roleOpen,   setRoleOpen]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  const roleRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const atLimit = seatsLeft !== null && seatsLeft <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || atLimit) return;
    setError('');
    setLoading(true);
    const { error: err } = await teamService.inviteMember(orgId, email.trim(), role);
    setLoading(false);
    if (err) { setError(err); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">Invite team member</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {atLimit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-center justify-between gap-4">
              <span>Your plan has no remaining seats.</span>
              <Link to="/billing" onClick={onClose} className="font-semibold underline whitespace-nowrap">
                Upgrade plan
              </Link>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Email address</label>
            <input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              disabled={atLimit}
              className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Role</label>
            <div className="relative" ref={roleRef}>
              <button
                type="button"
                disabled={atLimit}
                onClick={() => setRoleOpen(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-colors ${atLimit ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#D1D5DB] cursor-not-allowed' : 'bg-white text-[#111827] border-[#D1D5DB] hover:border-[#6C55E8]'}`}
              >
                <span>{INVITE_ROLES.find(r => r.value === role)?.label ?? 'Viewer'}</span>
                <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {roleOpen && !atLimit && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 overflow-hidden">
                  {INVITE_ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => { setRole(r.value); setRoleOpen(false); }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${r.value === role ? 'bg-[#F3F4F6] text-[#6C55E8] font-medium' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}
                    >
                      <span>{r.label}</span>
                      <span className="text-xs text-[#9CA3AF]">{r.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || atLimit}
              className="px-5 py-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â"€â"€ Role Change Dropdown â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function RoleMenu({ orgId, memberId, current, onDone }: {
  orgId: string; memberId: string; current: MemberRole; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  async function change(newRole: MemberRole) {
    if (newRole === current) { setOpen(false); return; }
    setBusy(true);
    await teamService.updateRole(orgId, memberId, newRole);
    setBusy(false);
    setOpen(false);
    onDone();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex items-center gap-1 disabled:opacity-50"
      >
        <RoleBadge role={current} />
        <svg className="w-3 h-3 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-sm z-20 min-w-[110px] overflow-hidden">
          {(['admin', 'manager', 'viewer'] as MemberRole[]).map((r) => (
            <button
              key={r}
              onClick={() => change(r)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F9FAFB] ${r === current ? 'text-[#6C55E8] font-semibold' : 'text-[#374151]'}`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// â"€â"€ TeamPage â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export function TeamPage() {
  const orgId = useOrgStore((s) => s.orgId);
  const user  = useAuthStore((s) => s.user);

  const [members,     setMembers]     = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [seatUsed,    setSeatUsed]    = useState(0);
  const [seatLimit,   setSeatLimit]   = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [actionErr,   setActionErr]   = useState('');
  const [myRole,      setMyRole]      = useState<MemberRole | null>(null);

  // ── Filters ──
  const [search,          setSearch]          = useState('');
  const [roleFilter,      setRoleFilter]      = useState<MemberRole | 'all'>('all');
  const [tab,             setTab]             = useState<'members' | 'invitations'>('members');
  const [roleFilterOpen,  setRoleFilterOpen]  = useState(false);
  const roleFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (roleFilterRef.current && !roleFilterRef.current.contains(e.target as Node)) setRoleFilterOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const canManage = myRole === 'owner' || myRole === 'admin';

  async function load() {
    if (!orgId || !user) return;
    setLoading(true);

    // Fetch own role independently â€" canManage must not wait for full members list
    const { data: ownRow } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    setMyRole((ownRow?.role as MemberRole) ?? null);

    const [membRes, invRes, seatRes] = await Promise.all([
      teamService.getMembers(orgId),
      teamService.getPendingInvitations(orgId),
      teamService.getSeatUsage(orgId),
    ]);
    setMembers(membRes.data);
    setInvitations(invRes.data);
    setSeatUsed(seatRes.used);
    setSeatLimit(seatRes.limit);
    setLoading(false);
  }

  useEffect(() => { load(); }, [orgId, user]);

  async function handleRemove(memberId: string) {
    if (!orgId) return;
    setActionErr('');
    const { error } = await teamService.removeMember(orgId, memberId);
    if (error) { setActionErr(error); return; }
    load();
  }

  async function handleRevoke(invId: string) {
    setActionErr('');
    const { error } = await teamService.revokeInvitation(invId);
    if (error) { setActionErr(error); return; }
    load();
  }

  // â"€â"€ Filtered data â"€â"€
  const filteredMembers = members.filter((m) => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      (m.display_name?.toLowerCase().includes(term) ?? false) ||
      m.email.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredInvitations = invitations.filter((inv) => {
    const term = search.toLowerCase();
    const matchesSearch = !term || inv.email.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'all' || inv.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const seatsLeft = seatLimit !== null ? seatLimit - seatUsed : null;

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#111827]/5 blur-3xl" aria-hidden="true"/>
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/4 blur-3xl" aria-hidden="true"/>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[1.5rem] font-bold text-[#111827]">Team</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Manage members and pending invitations.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite member
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total members',      value: members.length },
          { label: 'Pending invitations', value: invitations.length },
          { label: seatLimit !== null ? `Seats (${seatUsed} / ${seatLimit})` : 'Active members',
            value: seatLimit !== null
              ? `${seatsLeft! > 0 ? seatsLeft : 0} left`
              : seatUsed },
        ].map(({ label, value }) => (
          <div key={label} className="relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg shadow-black/5 px-5 py-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C55E8]/3 via-transparent to-transparent pointer-events-none rounded-2xl" />
            <p className="text-xs text-[#6B7280] font-medium">{label}</p>
            <p className="mt-1 text-xl font-bold text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      {/* Seat usage bar */}
      {seatLimit !== null && (
        <div className="mb-5">
          <div className="h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${seatUsed >= seatLimit ? 'bg-amber-400' : 'bg-[#111827]'}`}
              style={{ width: `${Math.min((seatUsed / seatLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {actionErr && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">{actionErr}</div>
      )}

      {!orgId ? (
        <div className="py-12 text-sm text-[#9CA3AF]">Setting up your organisationâ€¦</div>
      ) : loading ? (
        <div className="flex items-center gap-3 py-12">
          <div className="w-5 h-5 border-2 border-[#6C55E8] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6B7280]">Loading teamâ€¦</span>
        </div>
      ) : (
        <>
          {/* Tabs + Search + Filter */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            {/* Tabs */}
            <div className="flex border-b border-[#E5E7EB]">
              {(['members', 'invitations'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t
                      ? 'border-[#6C55E8] text-[#6C55E8]'
                      : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {t === 'members' ? `Members (${members.length})` : `Pending (${invitations.length})`}
                </button>
              ))}
            </div>

            {/* Search + role filter */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name or emailâ€¦"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-[#D1D5DB] rounded-xl focus:outline-none focus:border-[#6C55E8] w-52 placeholder-[#9CA3AF]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Role filter */}
              <div className="relative" ref={roleFilterRef}>
                <button
                  type="button"
                  onClick={() => setRoleFilterOpen(o => !o)}
                  className={`flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm border rounded-xl transition-colors ${roleFilter !== 'all' ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8] font-medium' : 'border-[#D1D5DB] text-[#374151] hover:border-[#6C55E8] bg-white'}`}
                >
                  <span>{roleFilter === 'all' ? 'All roles' : ROLE_LABELS[roleFilter]}</span>
                  <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {roleFilterOpen && (
                  <div className="absolute top-full right-0 mt-1.5 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[130px]">
                    {(['all' as const, ...ALL_ROLES]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setRoleFilter(r); setRoleFilterOpen(false); }}
                        className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${r === roleFilter ? 'bg-[#F3F4F6] text-[#6C55E8] font-medium' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}
                      >
                        {r === 'all' ? 'All roles' : ROLE_LABELS[r as MemberRole]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* â"€â"€ Members tab â"€â"€ */}
          {tab === 'members' && (
            <div className="bg-white border border-[#E5E7EB]">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Member</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Email</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Role</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Joined</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Actions</span>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">
                  {search || roleFilter !== 'all' ? 'No members match your filters.' : 'No members yet.'}
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {filteredMembers.map((m) => {
                    const isMe    = m.user_id === user?.id;
                    const isOwner = m.role === 'owner';
                    const canEdit = canManage && !isMe && !isOwner;

                    return (
                      <div key={m.member_id} className="grid grid-cols-[2fr_2fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-[#FAFAFA]">
                        {/* Name + avatar */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#6C55E8] flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {initials(m.display_name, m.email)}
                          </div>
                          <span className="text-sm font-medium text-[#111827] truncate">
                            {m.display_name ?? m.email.split('@')[0]}
                            {isMe && <span className="ml-1 text-xs text-[#9CA3AF] font-normal">(you)</span>}
                          </span>
                        </div>

                        {/* Email */}
                        <span className="text-sm text-[#6B7280] truncate">{m.email}</span>

                        {/* Role */}
                        <div>
                          {canEdit ? (
                            <RoleMenu orgId={orgId!} memberId={m.member_id} current={m.role} onDone={load} />
                          ) : (
                            <RoleBadge role={m.role} />
                          )}
                        </div>

                        {/* Joined */}
                        <span className="text-xs text-[#9CA3AF]">
                          {m.joined_at ? timeAgo(m.joined_at) : 'â€"'}
                        </span>

                        {/* Actions */}
                        <div className="flex justify-end">
                          {canEdit && (
                            <button
                              onClick={() => handleRemove(m.member_id)}
                              className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1"
                              title="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* â"€â"€ Invitations tab â"€â"€ */}
          {tab === 'invitations' && (
            <div className="bg-white border border-[#E5E7EB]">
              {/* Table header */}
              <div className="grid grid-cols-[3fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Email</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Role</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Sent</span>
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Actions</span>
              </div>

              {filteredInvitations.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">
                  {search || roleFilter !== 'all' ? 'No invitations match your filters.' : 'No pending invitations.'}
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {filteredInvitations.map((inv) => (
                    <div key={inv.id} className="grid grid-cols-[3fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-[#FAFAFA]">
                      {/* Email + avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {inv.email.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#111827] truncate">{inv.email}</span>
                      </div>

                      <RoleBadge role={inv.role} />

                      <span className="text-xs text-[#9CA3AF]">{timeAgo(inv.invited_at)}</span>

                      <div className="flex justify-end">
                        {canManage && (
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Invite modal */}
      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          seatsLeft={seatsLeft}
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); load(); }}
        />
      )}

      </div>{/* end scrollable */}
    </div>
  );
}

