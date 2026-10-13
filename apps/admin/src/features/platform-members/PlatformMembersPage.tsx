import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';

const ROLES = ['super_admin', 'admin', 'finance', 'support', 'operations', 'viewer'] as const;
type PlatformRole = typeof ROLES[number];

const ROLE_LABEL: Record<PlatformRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  support: 'Support',
  operations: 'Operations',
  viewer: 'Viewer',
};

const ROLE_COLOR: Record<PlatformRole, string> = {
  super_admin: 'bg-[#FEF3C7] text-[#92400E]',
  admin: 'bg-[#EDE9FE] text-[#5B21B6]',
  finance: 'bg-[#ECFDF5] text-[#065F46]',
  support: 'bg-[#EFF6FF] text-[#1E40AF]',
  operations: 'bg-[#FFF7ED] text-[#9A3412]',
  viewer: 'bg-[#F3F4F6] text-[#374151]',
};

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: PlatformRole;
  is_active: boolean;
  created_at: string;
}

type ModalMode = 'add' | 'edit' | null;

interface MemberModal {
  mode: ModalMode;
  member: Member | null;
}

function canManage(platformRole: string | null) {
  return platformRole === 'super_admin' || platformRole === 'admin';
}

export function PlatformMembersPage() {
  const { platformRole } = useAdminAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<MemberModal>({ mode: null, member: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<PlatformRole>('viewer');

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('platform_members')
      .select('id, user_id, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    // Get emails from profiles
    const userIds = data.map((m: { user_id: string }) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emailById = new Map((profiles ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));

    setMembers(data.map((m: { id: string; user_id: string; role: PlatformRole; is_active: boolean; created_at: string }) => ({
      ...m,
      email: emailById.get(m.user_id) ?? m.user_id,
    })));
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  function openAdd() {
    setFormEmail('');
    setFormRole('viewer');
    setError(null);
    setModal({ mode: 'add', member: null });
  }

  function openEdit(m: Member) {
    setFormRole(m.role);
    setError(null);
    setModal({ mode: 'edit', member: m });
  }

  function closeModal() {
    setModal({ mode: null, member: null });
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

    if (modal.mode === 'add') {
      // Look up user by email via profiles
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileErr || !profile) {
        setError('No user account found with that email address.');
        setSaving(false);
        return;
      }

      const { error: insertErr } = await supabase.from('platform_members').insert({
        user_id: profile.id,
        role: formRole,
        is_active: true,
      });

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }
    } else if (modal.mode === 'edit' && modal.member) {
      const { error: updateErr } = await supabase
        .from('platform_members')
        .update({ role: formRole })
        .eq('id', modal.member.id);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();
    loadMembers();
  }

  async function handleToggleActive(m: Member) {
    if (!canManage(platformRole)) return;
    const { error: err } = await supabase
      .from('platform_members')
      .update({ is_active: !m.is_active })
      .eq('id', m.id);

    if (!err) loadMembers();
  }

  const filtered = members.filter(
    (m) => search.trim() === '' || m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Platform Team</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{members.length} team members with platform access.</p>
        </div>
        {canManage(platformRole) && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add member
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5EAE8]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Member</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Added</th>
              {canManage(platformRole) && (
                <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-28" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                  {search ? 'No members match your search.' : 'No team members yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#111827]">{m.email}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">{m.user_id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLOR[m.role] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold ${m.is_active ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]'}`}>
                      {m.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#9CA3AF]">{new Date(m.created_at).toLocaleDateString()}</td>
                  {canManage(platformRole) && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs font-medium text-[#0D4C3C] hover:underline"
                        >
                          Edit role
                        </button>
                        <span className="text-[#E5EAE8]">|</span>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`text-xs font-medium hover:underline ${m.is_active ? 'text-red-600' : 'text-[#0D4C3C]'}`}
                        >
                          {m.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#111827] mb-5">
              {modal.mode === 'add' ? 'Add platform member' : 'Edit member role'}
            </h2>

            {modal.mode === 'add' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Email address</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                />
                <p className="text-xs text-[#9CA3AF] mt-1">User must already have an account on the platform.</p>
              </div>
            )}

            {modal.mode === 'edit' && modal.member && (
              <div className="mb-4 p-3 bg-[#F8FAF9] border border-[#E5EAE8] text-sm text-[#374151]">
                {modal.member.email}
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Platform role</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as PlatformRole)}
                className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] bg-white focus:outline-none focus:border-[#0D4C3C]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (modal.mode === 'add' && !formEmail.trim())}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add member' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
