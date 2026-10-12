import { useEffect, useState, useRef } from 'react';
import { useOrgStore } from '@/features/onboarding/org.store';
import { useAuthStore } from '@/features/auth/auth.store';
import { teamService, TeamMember, TeamInvitation, MemberRole } from './team.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner:   'Owner',
  admin:   'Admin',
  manager: 'Manager',
  viewer:  'Viewer',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner:   'bg-[#E6F2EE] text-[#0D4C3C]',
  admin:   'bg-[#EEF2FF] text-[#4338CA]',
  manager: 'bg-[#FEF3C7] text-[#92400E]',
  viewer:  'bg-[#F3F4F6] text-[#374151]',
};

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

interface InviteModalProps {
  orgId: string;
  seatsLeft: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

function InviteModal({ orgId, seatsLeft, onClose, onSuccess }: InviteModalProps) {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState<MemberRole>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
      <div
        className="bg-white border border-[#E5EAE8] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5EAE8]">
          <h2 className="text-sm font-semibold text-[#111827]">Invite team member</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {atLimit && (
            <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              Your plan has no remaining seats. Upgrade to invite more members.
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
              className="w-full border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                disabled={atLimit}
                className="w-full appearance-none border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:border-[#0D4C3C] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] pr-8"
              >
                <option value="viewer">Viewer — read-only access</option>
                <option value="manager">Manager — can reply to reviews</option>
                <option value="admin">Admin — full access except billing</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || atLimit}
              className="px-5 py-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role Change Dropdown ──────────────────────────────────────────────────────

interface RoleMenuProps {
  orgId:    string;
  memberId: string;
  current:  MemberRole;
  onDone:   () => void;
}

function RoleMenu({ orgId, memberId, current, onDone }: RoleMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const options: MemberRole[] = ['admin', 'manager', 'viewer'];

  async function change(newRole: MemberRole) {
    if (newRole === current) { setOpen(false); return; }
    setBusy(true);
    await teamService.updateRole(orgId, memberId, newRole);
    setBusy(false);
    setOpen(false);
    onDone();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827] transition-colors disabled:opacity-50"
      >
        <RoleBadge role={current} />
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5EAE8] shadow-sm z-20 min-w-[110px]">
          {options.map((r) => (
            <button
              key={r}
              onClick={() => change(r)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F9FAFB] ${r === current ? 'text-[#0D4C3C] font-medium' : 'text-[#374151]'}`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TeamPage ──────────────────────────────────────────────────────────────────

export function TeamPage() {
  const orgId   = useOrgStore((s) => s.orgId);
  const user    = useAuthStore((s) => s.user);

  const [members,     setMembers]     = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [seatUsed,    setSeatUsed]    = useState(0);
  const [seatLimit,   setSeatLimit]   = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [actionErr,   setActionErr]   = useState('');

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  async function load() {
    if (!orgId) return;
    setLoading(true);
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

  useEffect(() => { load(); }, [orgId]);

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

  const seatsLeft = seatLimit !== null ? seatLimit - seatUsed : null;

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[1.5rem] font-bold text-[#111827]">Team</h1>
          {seatLimit !== null && (
            <p className="text-sm text-[#6B7280] mt-0.5">
              {seatUsed} of {seatLimit} seat{seatLimit !== 1 ? 's' : ''} used
            </p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite member
          </button>
        )}
      </div>

      {/* Seat bar */}
      {seatLimit !== null && (
        <div className="mb-6">
          <div className="h-1.5 bg-[#E5EAE8] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0D4C3C] rounded-full transition-all"
              style={{ width: `${Math.min((seatUsed / seatLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {actionErr && (
        <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
          {actionErr}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-12">
          <div className="w-5 h-5 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6B7280]">Loading team…</span>
        </div>
      ) : (
        <>
          {/* Members list */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Members ({members.length})
            </h2>
            <div className="bg-white border border-[#E5EAE8] divide-y divide-[#F3F4F6]">
              {members.map((m) => {
                const isMe     = m.user_id === user?.id;
                const isOwner  = m.role === 'owner';
                const canEdit  = canManage && !isMe && !isOwner;

                return (
                  <div key={m.member_id} className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-sm bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(m.display_name, m.email)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">
                        {m.display_name ?? m.email}
                        {isMe && <span className="ml-1.5 text-xs text-[#9CA3AF] font-normal">(you)</span>}
                      </p>
                      <p className="text-xs text-[#6B7280] truncate">{m.email}</p>
                    </div>

                    {/* Role */}
                    <div className="flex-shrink-0">
                      {canEdit ? (
                        <RoleMenu
                          orgId={orgId!}
                          memberId={m.member_id}
                          current={m.role}
                          onDone={load}
                        />
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </div>

                    {/* Remove */}
                    {canEdit && (
                      <button
                        onClick={() => handleRemove(m.member_id)}
                        className="flex-shrink-0 text-[#9CA3AF] hover:text-red-500 transition-colors p-1"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                Pending invitations ({invitations.length})
              </h2>
              <div className="bg-white border border-[#E5EAE8] divide-y divide-[#F3F4F6]">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-sm bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {inv.email.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#111827] truncate">{inv.email}</p>
                      <p className="text-xs text-[#9CA3AF]">Invited {timeAgo(inv.invited_at)}</p>
                    </div>

                    {/* Role */}
                    <div className="flex-shrink-0">
                      <RoleBadge role={inv.role} />
                    </div>

                    {/* Revoke */}
                    {canManage && (
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        className="flex-shrink-0 text-xs text-[#9CA3AF] hover:text-red-500 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
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
    </div>
  );
}
