import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId } from '@/lib/format';

const ROLES = ['owner', 'super_admin', 'admin', 'finance', 'support', 'operations', 'viewer'] as const;
type PlatformRole = typeof ROLES[number];

const ROLE_LABEL: Record<PlatformRole, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  support: 'Support',
  operations: 'Operations',
  viewer: 'Viewer',
};

const ROLE_COLOR: Record<PlatformRole, string> = {
  owner: 'bg-[#D8CCFF] text-[#6C55E8]',
  super_admin: 'bg-[#FEF3C7] text-[#92400E]',
  admin: 'bg-[#EDE9FE] text-[#5B21B6]',
  finance: 'bg-[#ECFDF5] text-[#065F46]',
  support: 'bg-[#EFF6FF] text-[#1E40AF]',
  operations: 'bg-[#FFF7ED] text-[#9A3412]',
  viewer: 'bg-[#F3F4F6] text-[#374151]',
};

interface MemberDetail {
  memberId: string;
  userId: string;
  refId: string;
  displayName: string;
  email: string;
  phone: string | null;
  role: PlatformRole;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

function canManage(platformRole: string | null) {
  return platformRole === 'owner' || platformRole === 'super_admin' || platformRole === 'admin';
}

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!%&*';
  const all = upper + lower + digits + special;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [rand(upper), rand(lower), rand(digits), rand(special)];
  for (let i = 0; i < 8; i++) chars.push(rand(all));
  return chars.sort(() => Math.random() - 0.5).join('');
}

export function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { platformRole } = useAdminAuthStore();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<PlatformRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Activate/deactivate
  const [toggling, setToggling] = useState(false);

  async function load() {
    setLoading(true);
    if (!id) { setNotFound(true); setLoading(false); return; }

    // id param is the numeric part only (e.g. "00010"); reconstruct full ref_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, ref_id, display_name, phone')
      .eq('ref_id', `USR-${id}`)
      .maybeSingle();

    if (!profile) { setNotFound(true); setLoading(false); return; }

    const { data: pm } = await supabase
      .from('platform_members')
      .select('id, role, is_active, created_at')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!pm) { setNotFound(true); setLoading(false); return; }

    const { data: authRows } = await supabase.rpc('get_platform_members_auth');
    type AuthRow = { user_id: string; email: string; last_sign_in_at: string | null };
    const authRow = (authRows as AuthRow[] ?? []).find((a) => a.user_id === profile.id);

    const detail: MemberDetail = {
      memberId: pm.id,
      userId: profile.id,
      refId: profile.ref_id ?? '',
      displayName: profile.display_name ?? '—',
      email: authRow?.email ?? '—',
      phone: profile.phone ?? null,
      role: pm.role as PlatformRole,
      isActive: pm.is_active,
      createdAt: pm.created_at,
      lastSignInAt: authRow?.last_sign_in_at ?? null,
    };

    setMember(detail);
    setEditName(detail.displayName);
    setEditPhone(detail.phone ?? '');
    setEditRole(detail.role);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    if (!member) return;
    setSaving(true);
    setSaveMsg(null);

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: editName.trim(), phone: editPhone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', member.userId);

    const { error: roleErr } = await supabase
      .from('platform_members')
      .update({ role: editRole })
      .eq('id', member.memberId);

    setSaving(false);

    if (profileErr || roleErr) {
      setSaveMsg(`Error: ${profileErr?.message ?? roleErr?.message}`);
      return;
    }

    setSaveMsg('Saved successfully.');
    load();
  }

  async function handleSetPassword() {
    if (!member) return;
    if (!newPassword.trim() || newPassword.length < 8) {
      setResetMsg('Error: Password must be at least 8 characters.');
      return;
    }

    setResetting(true);
    setResetMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ user_id: member.userId, password: newPassword }),
        },
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        setResetMsg(`Error: ${result.error ?? 'Failed to set password.'}`);
        return;
      }

      setResetMsg('Password updated successfully.');
      setNewPassword('');
      setShowNewPassword(false);
    } catch (err) {
      setResetMsg(`Error: ${err instanceof Error ? err.message : 'Network error.'}`);
    } finally {
      setResetting(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  }

  async function handleToggleActive() {
    if (!member) return;
    setToggling(true);
    await supabase
      .from('platform_members')
      .update({ is_active: !member.isActive })
      .eq('id', member.memberId);
    setToggling(false);
    load();
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto px-8 py-8">
        <div className="h-4 bg-[#E5E7EB] rounded animate-pulse w-48 mb-8" />
        <div className="bg-white shadow-sm rounded-xl p-6 animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#E5E7EB] rounded w-64" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="h-full overflow-y-auto px-8 py-8">
        <Link to="/users" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Users
        </Link>
        <p className="text-sm text-[#9CA3AF]">Member not found.</p>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      {/* Back */}
      <Link to="/users" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Users
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-[#111827]">{member.displayName}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${member.isActive ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
              {member.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">{formatId(member.refId)}</p>
        </div>
        {canManage(platformRole) && member.role !== 'owner' && (
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
              member.isActive
                ? 'bg-[#FEF2F2] text-red-700 hover:bg-red-100'
                : 'bg-[#ECFDF5] text-[#065F46] hover:bg-green-100'
            }`}
          >
            {toggling ? '…' : member.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
        {member.role === 'owner' && (
          <span className="px-3 py-1.5 text-xs font-semibold text-[#9CA3AF] bg-[#F3F4F6] rounded-lg" title="Owner accounts are protected">
            Protected
          </span>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]">
          <h2 className="text-sm font-semibold text-[#111827]">Member details</h2>
        </div>
        <dl className="divide-y divide-[#F3F4F6]">
          <div className="px-6 py-3.5 flex items-center gap-4">
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Email</dt>
            <dd className="text-sm text-[#111827]">{member.email}</dd>
          </div>
          <div className="px-6 py-3.5 flex items-center gap-4">
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Role</dt>
            <dd>
              <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${ROLE_COLOR[member.role]}`}>
                {ROLE_LABEL[member.role]}
              </span>
            </dd>
          </div>
          <div className="px-6 py-3.5 flex items-center gap-4">
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Phone</dt>
            <dd className="text-sm text-[#111827]">{member.phone ?? '—'}</dd>
          </div>
          <div className="px-6 py-3.5 flex items-center gap-4">
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Last login</dt>
            <dd className="text-sm text-[#111827]">{formatDate(member.lastSignInAt)}</dd>
          </div>
          <div className="px-6 py-3.5 flex items-center gap-4">
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Added</dt>
            <dd className="text-sm text-[#111827]">{formatDate(member.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Edit form */}
      {canManage(platformRole) && (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]">
            <h2 className="text-sm font-semibold text-[#111827]">Edit member</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Full name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#6C55E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Platform role</label>
              {member.role === 'owner' ? (
                <div className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] text-[#9CA3AF] select-none">
                  Owner — cannot be changed
                </div>
              ) : (
                <Dropdown
                  fullWidth
                  value={editRole}
                  onChange={(v) => setEditRole(v as PlatformRole)}
                  options={ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                />
              )}
            </div>

            {saveMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${saveMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#D8CCFF] border border-[#A7D7C5] text-[#6C55E8]'}`}>
                {saveMsg}
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#6C55E8] rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password */}
      {canManage(platformRole) && (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF7]">
            <h2 className="text-sm font-semibold text-[#111827]">Set password</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-[#6B7280] mb-4">
              Set a new password for <span className="font-medium text-[#111827]">{member.displayName}</span>. Share it with them directly — they can change it after signing in.
            </p>

            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">New password</label>
              <button
                type="button"
                onClick={() => {
                  const pw = generatePassword();
                  setNewPassword(pw);
                  setShowNewPassword(true);
                  setResetMsg(null);
                }}
                className="text-xs font-medium text-[#6C55E8] hover:underline"
              >
                Auto-generate
              </button>
            </div>

            <div className="relative mb-4">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setResetMsg(null); }}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2 pr-16 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8] font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newPassword)}
                    className="text-xs font-medium text-[#6C55E8] hover:underline"
                  >
                    {passwordCopied ? 'Copied!' : 'Copy'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="text-[#9CA3AF] hover:text-[#374151] transition-colors"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {resetMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg mb-4 ${resetMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#D8CCFF] border border-[#A7D7C5] text-[#6C55E8]'}`}>
                {resetMsg}
              </p>
            )}

            <button
              onClick={handleSetPassword}
              disabled={resetting || !newPassword.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#6C55E8] rounded-lg disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Setting…' : 'Set password'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

