import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { adminAuthService } from '@/features/auth/auth.service';
import { Dropdown } from '@/components/Dropdown';

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

interface MemberDetail {
  memberId: string;
  userId: string;
  displayId: number;
  displayName: string;
  email: string;
  phone: string | null;
  status: string;
  role: PlatformRole;
  isActive: boolean;
  createdAt: string;
}

function canManage(platformRole: string | null) {
  return platformRole === 'super_admin' || platformRole === 'admin';
}

export function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Activate/deactivate
  const [toggling, setToggling] = useState(false);

  async function load() {
    setLoading(true);
    const displayId = Number(id);
    if (isNaN(displayId)) { setNotFound(true); setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_id, display_name, email, phone, status')
      .eq('display_id', displayId)
      .maybeSingle();

    if (!profile) { setNotFound(true); setLoading(false); return; }

    const { data: pm } = await supabase
      .from('platform_members')
      .select('id, role, is_active, created_at')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!pm) { setNotFound(true); setLoading(false); return; }

    const detail: MemberDetail = {
      memberId: pm.id,
      userId: profile.id,
      displayId: profile.display_id,
      displayName: profile.display_name ?? '—',
      email: profile.email ?? '—',
      phone: profile.phone ?? null,
      status: profile.status ?? 'pending_verification',
      role: pm.role as PlatformRole,
      isActive: pm.is_active,
      createdAt: pm.created_at,
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

  async function handleResetPassword() {
    if (!member) return;
    setResetting(true);
    setResetMsg(null);
    const { error } = await adminAuthService.forgotPassword(member.email);
    setResetting(false);
    setResetMsg(error ? `Error: ${error.message}` : `Reset link sent to ${member.email}.`);
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
      <div className="px-8 py-8">
        <div className="h-4 bg-[#E5EAE8] rounded animate-pulse w-48 mb-8" />
        <div className="bg-white border border-[#E5EAE8] rounded-xl p-6 animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#E5EAE8] rounded w-64" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="px-8 py-8">
        <Link to="/team" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to team
        </Link>
        <p className="text-sm text-[#9CA3AF]">Member not found.</p>
      </div>
    );
  }

  if (!member) return null;

  const statusLabel = member.status === 'active' ? 'Active' : member.status === 'suspended' ? 'Suspended' : 'Pending';
  const statusColor = member.status === 'active' ? 'bg-[#ECFDF5] text-[#065F46]' : member.status === 'suspended' ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#FFF7ED] text-[#9A3412]';

  return (
    <div className="px-8 py-8 max-w-2xl">
      {/* Back */}
      <Link to="/team" className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] mb-6 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Platform Team
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#111827]">{member.displayName}</h1>
            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusColor}`}>{statusLabel}</span>
          </div>
          <p className="text-sm text-[#9CA3AF] font-mono">#{member.displayId}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage(platformRole) && (
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-50 ${
                member.isActive
                  ? 'bg-[#FEF2F2] text-red-700 hover:bg-red-100'
                  : 'bg-[#ECFDF5] text-[#065F46] hover:bg-green-100'
              }`}
            >
              {toggling ? '…' : member.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
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
            <dt className="w-32 text-xs font-semibold text-[#6B7280] uppercase tracking-wide flex-shrink-0">Added</dt>
            <dd className="text-sm text-[#111827]">{new Date(member.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Edit form */}
      {canManage(platformRole) && (
        <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
            <h2 className="text-sm font-semibold text-[#111827]">Edit member</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Full name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] focus:outline-none focus:border-[#0D4C3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Platform role</label>
              <Dropdown
                fullWidth
                value={editRole}
                onChange={(v) => setEditRole(v as PlatformRole)}
                options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            </div>

            {saveMsg && (
              <p className={`text-sm px-3 py-2 ${saveMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#E6F2EE] border border-[#A7D7C5] text-[#0D4C3C]'}`}>
                {saveMsg}
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password */}
      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9]">
          <h2 className="text-sm font-semibold text-[#111827]">Password reset</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-[#6B7280] mb-4">
            Send a password reset link to <span className="font-medium text-[#111827]">{member.email}</span>.
            The link expires in 24 hours.
          </p>
          {resetMsg && (
            <p className={`text-sm px-3 py-2 mb-4 ${resetMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[#E6F2EE] border border-[#A7D7C5] text-[#0D4C3C]'}`}>
              {resetMsg}
            </p>
          )}
          <button
            onClick={handleResetPassword}
            disabled={resetting}
            className="px-4 py-2 text-sm font-semibold text-[#0D4C3C] border border-[#0D4C3C] hover:bg-[#E6F2EE] disabled:opacity-50 transition-colors"
          >
            {resetting ? 'Sending…' : 'Send reset link'}
          </button>
        </div>
      </div>
    </div>
  );
}
