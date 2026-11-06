import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  owner: 'bg-[#E6F2EE] text-[#0D4C3C]',
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
  ref_id: string | null;
  display_name: string;
  email: string;
  phone: string | null;
  role: PlatformRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

function canManage(platformRole: string | null) {
  return platformRole === 'owner' || platformRole === 'super_admin' || platformRole === 'admin';
}

function isSuperAdmin(platformRole: string | null) {
  return platformRole === 'owner' || platformRole === 'super_admin';
}

export function PlatformMembersPage() {
  const { platformRole } = useAdminAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Bulk action state
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<PlatformRole>('viewer');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  async function loadMembers() {
    setLoading(true);
    const { data: rows } = await supabase
      .from('platform_members')
      .select('id, user_id, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (!rows) { setLoading(false); return; }

    const userIds = rows.map((m: { user_id: string }) => m.user_id);

    const [profilesRes, authRes] = await Promise.all([
      supabase.from('profiles').select('id, ref_id, display_name, phone').in('id', userIds),
      supabase.rpc('get_platform_members_auth'),
    ]);

    type ProfileRow = { id: string; ref_id: string | null; display_name: string; phone: string | null };
    const profileById = new Map<string, ProfileRow>(
      (profilesRes.data ?? []).map((p: ProfileRow) => [p.id, p]),
    );

    type AuthRow = { user_id: string; email: string; last_sign_in_at: string | null };
    const authById = new Map<string, AuthRow>(
      (authRes.data ?? []).map((a: AuthRow) => [a.user_id, a]),
    );

    type RawRow = { id: string; user_id: string; role: PlatformRole; is_active: boolean; created_at: string };
    const enriched: Member[] = (rows as RawRow[]).map((m) => {
      const p = profileById.get(m.user_id);
      const a = authById.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        ref_id: p?.ref_id ?? null,
        display_name: p?.display_name ?? '—',
        email: a?.email ?? '—',
        phone: p?.phone ?? null,
        role: m.role,
        is_active: m.is_active,
        created_at: m.created_at,
        last_sign_in_at: a?.last_sign_in_at ?? null,
      };
    });

    setMembers(enriched);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  // Keep indeterminate state in sync
  useEffect(() => {
    if (!selectAllRef.current) return;
    const total = filtered.length;
    const sel = filtered.filter((m) => selected.has(m.id)).length;
    selectAllRef.current.indeterminate = sel > 0 && sel < total;
  });

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

  function openAdd() {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('viewer');
    setFormPassword('');
    setShowPassword(false);
    setCreatedPassword(null);
    setCopiedPassword(false);
    setError(null);
    setShowAddModal(true);
  }

  function closeAdd() {
    setShowAddModal(false);
    setCreatedPassword(null);
    setCopiedPassword(false);
    setError(null);
  }

  async function copyPassword(pw: string) {
    await navigator.clipboard.writeText(pw);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }

  async function handleAdd() {
    setError(null);
    if (!formPassword.trim() || formPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          password: formPassword,
        }),
      },
    );

    const result = await res.json();
    setSaving(false);

    if (!res.ok || !result.success) {
      setError(result.error ?? 'Failed to create user.');
      return;
    }

    setCreatedPassword(formPassword);
    loadMembers();
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  const filtered = members.filter(
    (m) =>
      search.trim() === '' ||
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visibleIds = filtered.map((m) => m.id);
    const allSelected = visibleIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  const selectedCount = filtered.filter((m) => selected.has(m.id)).length;
  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function handleBulkDeactivate() {
    setBulkWorking(true);
    setBulkError(null);
    const ids = [...selected];
    const { error } = await supabase
      .from('platform_members')
      .update({ is_active: false })
      .in('id', ids);
    setBulkWorking(false);
    if (error) { setBulkError(error.message); return; }
    setSelected(new Set());
    loadMembers();
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedCount} member${selectedCount > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkWorking(true);
    setBulkError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-member`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ member_ids: [...selected] }),
      },
    );

    const result = await res.json();
    setBulkWorking(false);

    if (!res.ok || !result.success) {
      setBulkError(result.error ?? 'Delete failed.');
      return;
    }

    setSelected(new Set());
    loadMembers();
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Users</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{members.length} users with platform access.</p>
        </div>
        {canManage(platformRole) && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add member
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
            className="w-full pl-9 pr-3 py-2 text-sm shadow-sm rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
          />
        </div>

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-[#6B7280] font-medium">{selectedCount} selected</span>
            {canManage(platformRole) && (
              <button
                onClick={handleBulkDeactivate}
                disabled={bulkWorking}
                className="px-3 py-1.5 text-xs font-semibold text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
              >
                Deactivate
              </button>
            )}
            {isSuperAdmin(platformRole) && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkWorking}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {bulkError && (
        <div className="flex-shrink-0 mx-8 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {bulkError}
        </div>
      )}

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 px-8 py-4">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-[#0D4C3C] cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Name</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Last Login</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-1.5">
                          <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {search ? 'No users match your search.' : 'No users yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr
                      key={m.id}
                      className={`hover:bg-[#F8FAF9] transition-colors ${selected.has(m.id) ? 'bg-[#F0F9F5]' : ''}`}
                    >
                      <td className="px-4 py-1.5">
                        {m.role !== 'owner' ? (
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggleRow(m.id)}
                            className="w-4 h-4 accent-[#0D4C3C] cursor-pointer"
                          />
                        ) : (
                          <span title="Owner accounts cannot be selected" className="inline-block w-4 h-4 text-[#D1D5DB] text-center leading-4 cursor-not-allowed">—</span>
                        )}
                      </td>
                      <td className="px-5 py-1.5">
                        <span className="font-mono text-xs text-[#6B7280]">{formatId(m.ref_id)}</span>
                      </td>
                      <td className="px-5 py-1.5">
                        <p className="font-medium text-[#111827]">{m.display_name}</p>
                        {m.phone && <p className="text-xs text-[#9CA3AF] mt-0.5">{m.phone}</p>}
                      </td>
                      <td className="px-5 py-1.5 text-[#374151]">{m.email}</td>
                      <td className="px-5 py-1.5">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${ROLE_COLOR[m.role] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="px-5 py-1.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${m.is_active ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-1.5 text-[#9CA3AF] text-xs">{formatDate(m.last_sign_in_at)}</td>
                      <td className="px-5 py-1.5 text-right">
                        {m.ref_id != null ? (
                          <Link
                            to={`/users/${m.ref_id.split('-')[1]}`}
                            className="text-xs font-medium text-[#0D4C3C] hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">View</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md p-6 shadow-xl rounded-xl">

            {createdPassword ? (
              /* Success state — show credentials */
              <>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-[#111827]">Member added</h2>
                </div>

                <p className="text-sm text-[#6B7280] mb-4">
                  Share these credentials with <span className="font-medium text-[#111827]">{formName.trim()}</span>. They can reset their password from the login page.
                </p>

                <div className="bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg p-4 space-y-2.5 mb-5">
                  <div>
                    <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-0.5">Email</p>
                    <p className="text-sm font-mono text-[#111827]">{formEmail.trim().toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-0.5">Password</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-[#111827] flex-1 break-all">{createdPassword}</p>
                      <button
                        onClick={() => copyPassword(createdPassword)}
                        className="flex-shrink-0 text-xs font-medium text-[#0D4C3C] hover:underline"
                      >
                        {copiedPassword ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={closeAdd}
                  className="w-full py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-lg transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              /* Create form */
              <>
                <h2 className="text-base font-bold text-[#111827] mb-5">Add platform member</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Full name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Email address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                      Phone <span className="normal-case font-normal text-[#9CA3AF]">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Platform role</label>
                    <Dropdown
                      fullWidth
                      value={formRole}
                      onChange={(v) => setFormRole(v as PlatformRole)}
                      options={ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Password</label>
                      <button
                        type="button"
                        onClick={() => { const pw = generatePassword(); setFormPassword(pw); setShowPassword(true); }}
                        className="text-xs font-medium text-[#0D4C3C] hover:underline"
                      >
                        Auto-generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full px-3 py-2 pr-9 text-sm border border-[#E5EAE8] rounded-lg text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
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
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
                )}

                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    onClick={closeAdd}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving || !formName.trim() || !formEmail.trim() || !formPassword.trim()}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Creating…' : 'Create member'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
