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

async function callAdminFn(fnName: string, body: Record<string, string>, accessToken: string, anonKey: string, supabaseUrl: string) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { platformRole, user: currentUser } = useAdminAuthStore();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Info card
  const [infoEditing, setInfoEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<PlatformRole>('viewer');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Password card
  const [pwEditing, setPwEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Activate/deactivate
  const [toggling, setToggling] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (!id) { setNotFound(true); setLoading(false); return; }

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
      displayName: profile.display_name ?? '\u2014',
      email: authRow?.email ?? '\u2014',
      phone: profile.phone ?? null,
      role: pm.role as PlatformRole,
      isActive: pm.is_active,
      createdAt: pm.created_at,
      lastSignInAt: authRow?.last_sign_in_at ?? null,
    };

    setMember(detail);
    setEditName(detail.displayName);
    setEditEmail(detail.email);
    setEditPhone(detail.phone ?? '');
    setEditRole(detail.role);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function openInfoEdit() {
    if (!member) return;
    setEditName(member.displayName);
    setEditEmail(member.email);
    setEditPhone(member.phone ?? '');
    setEditRole(member.role);
    setInfoMsg(null);
    setInfoEditing(true);
  }

  function cancelInfoEdit() { setInfoEditing(false); setInfoMsg(null); }

  async function handleSaveInfo() {
    if (!member) return;
    setInfoSaving(true);
    setInfoMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    // Update profile (name + phone)
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: editName.trim(), phone: editPhone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', member.userId);

    // Update role
    const { error: roleErr } = await supabase
      .from('platform_members')
      .update({ role: editRole })
      .eq('id', member.memberId);

    // Update email if changed
    let emailErr: string | null = null;
    if (editEmail.trim() && editEmail.trim() !== member.email) {
      const result = await callAdminFn('admin-update-email', { user_id: member.userId, email: editEmail.trim() }, token, anon, url);
      if (!result.success) emailErr = result.error ?? 'Failed to update email.';
    }

    setInfoSaving(false);

    if (profileErr || roleErr || emailErr) {
      setInfoMsg(`Error: ${profileErr?.message ?? roleErr?.message ?? emailErr}`);
      return;
    }

    setInfoMsg('Saved.');
    setInfoEditing(false);
    load();
  }

  function openPwEdit() {
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
    setPwMsg(null);
    setPwEditing(true);
  }

  function cancelPwEdit() { setPwEditing(false); setPwMsg(null); }

  async function handleSetPassword() {
    if (!member) return;
    if (!newPassword.trim() || newPassword.length < 8) {
      setPwMsg('Error: Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('Error: Passwords do not match.');
      return;
    }

    setPwSaving(true);
    setPwMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const result = await callAdminFn(
        'admin-set-password',
        { user_id: member.userId, password: newPassword },
        session?.access_token ?? '',
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        import.meta.env.VITE_SUPABASE_URL as string,
      );

      if (!result.success) {
        setPwMsg(`Error: ${result.error ?? 'Failed to set password.'}`);
        return;
      }

      setPwMsg('Password updated.');
      setPwEditing(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg(`Error: ${err instanceof Error ? err.message : 'Network error.'}`);
    } finally {
      setPwSaving(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  }

  async function handleDelete() {
    if (!member) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ member_ids: [member.memberId] }),
      });
      const result = await res.json();
      if (!result.success) {
        setDeleteMsg(result.error ?? 'Failed to delete member.');
        setDeleting(false);
        return;
      }
      window.location.replace('/users');
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : 'Network error.');
      setDeleting(false);
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-6 animate-pulse space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 bg-[#E5E7EB] rounded w-full" />
              ))}
            </div>
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

  const manage = canManage(platformRole);

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
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <h1 className="text-2xl font-bold text-[#111827]">{member.displayName}</h1>
          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${member.isActive ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
            {member.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-[#9CA3AF] font-mono mb-4">{formatId(member.refId)}</p>

        {/* Actions */}
        {manage && member.role !== 'owner' && member.userId !== currentUser?.id && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                member.isActive ? 'bg-[#FEF2F2] text-red-700 hover:bg-red-100' : 'bg-[#ECFDF5] text-[#065F46] hover:bg-green-100'
              }`}
            >
              {toggling ? '\u2026' : member.isActive ? 'Deactivate' : 'Reactivate'}
            </button>

            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FEF2F2] text-red-700 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#374151]">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting\u2026' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteMsg(null); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {deleteMsg && (
              <span className="text-xs text-red-600">{deleteMsg}</span>
            )}
          </div>
        )}
        {member.role === 'owner' && (
          <span className="px-3 py-1.5 text-xs font-semibold text-[#9CA3AF] bg-[#F3F4F6] rounded-lg">Protected</span>
        )}
      </div>

      {/* Two cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Card 1 — Member info */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Member info</h2>
            {manage && !infoEditing && (
              <button onClick={openInfoEdit} className="text-xs font-medium text-[#6C55E8] hover:underline">
                Edit
              </button>
            )}
          </div>
          <div className="p-5 space-y-4">

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Full name</label>
              {infoEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#6C55E8]"
                />
              ) : (
                <p className="text-sm text-[#111827]">{member.displayName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Email</label>
              {infoEditing ? (
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#6C55E8]"
                />
              ) : (
                <p className="text-sm text-[#111827]">{member.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                Phone <span className="font-normal text-[#9CA3AF]">(optional)</span>
              </label>
              {infoEditing ? (
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8]"
                />
              ) : (
                <p className="text-sm text-[#111827]">{member.phone ?? '\u2014'}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Role</label>
              {infoEditing && member.role !== 'owner' && member.userId !== currentUser?.id ? (
                <Dropdown
                  fullWidth
                  value={editRole}
                  onChange={(v) => setEditRole(v as PlatformRole)}
                  options={(() => {
                    const myIdx = ROLES.indexOf(platformRole as PlatformRole);
                    return ROLES.filter((_r, i) => i > myIdx).map((r) => ({ value: r, label: ROLE_LABEL[r] }));
                  })()}
                />
              ) : (
                <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${ROLE_COLOR[member.role]}`}>
                  {ROLE_LABEL[member.role]}
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="pt-2 border-t border-[#F3F4F6] grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-[#6B7280] mb-0.5">Last login</p>
                <p className="text-xs text-[#374151]">{formatDate(member.lastSignInAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6B7280] mb-0.5">Added</p>
                <p className="text-xs text-[#374151]">{formatDate(member.createdAt)}</p>
              </div>
            </div>

            {infoMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${infoMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#ECFDF5] border border-[#A7D7C5] text-[#065F46]'}`}>
                {infoMsg}
              </p>
            )}

            {infoEditing && (
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={cancelInfoEdit}
                  className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInfo}
                  disabled={infoSaving || !editName.trim() || !editEmail.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#6C55E8] rounded-lg disabled:opacity-50 transition-colors"
                >
                  {infoSaving ? 'Saving\u2026' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 2 — Set password */}
        {manage && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Set password</h2>
              {!pwEditing && (
                <button onClick={openPwEdit} className="text-xs font-medium text-[#6C55E8] hover:underline">
                  Edit
                </button>
              )}
            </div>
            <div className="p-5">
              {!pwEditing ? (
                <p className="text-sm text-[#9CA3AF]">Click Edit to set a new password for {member.displayName}.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[#6B7280]">
                    Set a new password for <span className="font-medium text-[#111827]">{member.displayName}</span>. Share it with them directly.
                  </p>

                  {/* New password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#6B7280]">New password</label>
                      <button
                        type="button"
                        onClick={() => {
                          const pw = generatePassword();
                          setNewPassword(pw);
                          setConfirmPassword(pw);
                          setShowNew(true);
                          setPwMsg(null);
                        }}
                        className="text-xs font-medium text-[#6C55E8] hover:underline"
                      >
                        Auto-generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPwMsg(null); }}
                        placeholder="Min. 8 characters"
                        className="w-full px-3 py-2 pr-16 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6C55E8] font-mono"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {newPassword && (
                          <button type="button" onClick={() => copyToClipboard(newPassword)} className="text-xs font-medium text-[#6C55E8] hover:underline">
                            {passwordCopied ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                        <button type="button" onClick={() => setShowNew((v) => !v)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors" aria-label={showNew ? 'Hide' : 'Show'}>
                          {showNew ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPwMsg(null); }}
                        placeholder="Repeat password"
                        className={`w-full px-3 py-2 pr-10 text-sm border rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none font-mono ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-300 focus:border-red-400'
                            : 'border-[#E5E7EB] focus:border-[#6C55E8]'
                        }`}
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors" aria-label={showConfirm ? 'Hide' : 'Show'}>
                        {showConfirm ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                    )}
                  </div>

                  {pwMsg && (
                    <p className={`text-sm px-3 py-2 rounded-lg ${pwMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#ECFDF5] border border-[#A7D7C5] text-[#065F46]'}`}>
                      {pwMsg}
                    </p>
                  )}

                  <div className="flex items-center gap-2 justify-end pt-1">
                    <button
                      onClick={cancelPwEdit}
                      className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSetPassword}
                      disabled={pwSaving || !newPassword.trim() || !confirmPassword.trim()}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#6C55E8] rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {pwSaving ? 'Setting\u2026' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}