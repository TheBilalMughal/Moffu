import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
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

interface Member {
  id: string;
  user_id: string;
  display_id: number | null;
  display_name: string;
  email: string;
  phone: string | null;
  role: PlatformRole;
  is_active: boolean;
  created_at: string;
}

function canManage(platformRole: string | null) {
  return platformRole === 'super_admin' || platformRole === 'admin';
}

export function PlatformMembersPage() {
  const { platformRole } = useAdminAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<PlatformRole>('viewer');

  async function loadMembers() {
    setLoading(true);
    const { data: rows } = await supabase
      .from('platform_members')
      .select('id, user_id, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (!rows) { setLoading(false); return; }

    const userIds = rows.map((m: { user_id: string }) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_id, display_name, email, phone')
      .in('id', userIds);

    type ProfileRow = { id: string; display_id: number | null; display_name: string; email: string | null; phone: string | null };
    const profileById = new Map<string, ProfileRow>(
      (profiles ?? []).map((p: ProfileRow) => [p.id, p]),
    );

    type RawRow = { id: string; user_id: string; role: PlatformRole; is_active: boolean; created_at: string };
    const enriched: Member[] = (rows as RawRow[]).map((m) => {
      const p = profileById.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        display_id: p?.display_id ?? null,
        display_name: p?.display_name ?? '—',
        email: p?.email ?? m.user_id,
        phone: p?.phone ?? null,
        role: m.role,
        is_active: m.is_active,
        created_at: m.created_at,
      };
    });

    setMembers(enriched);
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  function openAdd() {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('viewer');
    setError(null);
    setShowAddModal(true);
  }

  function closeAdd() {
    setShowAddModal(false);
    setError(null);
  }

  async function handleAdd() {
    setError(null);
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
        }),
      },
    );

    const result = await res.json();
    setSaving(false);

    if (!res.ok || !result.success) {
      setError(result.error ?? 'Failed to create user.');
      return;
    }

    closeAdd();
    loadMembers();
  }

  const filtered = members.filter(
    (m) =>
      search.trim() === '' ||
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Users</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{members.length} users with platform access.</p>
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

      <div className="relative max-w-xs mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] rounded-lg bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
        />
      </div>

      <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                  {search ? 'No users match your search.' : 'No users yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-[#6B7280]">
                      {m.display_id != null ? `#${m.display_id}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#111827]">{m.display_name}</p>
                    {m.phone && <p className="text-xs text-[#9CA3AF] mt-0.5">{m.phone}</p>}
                  </td>
                  <td className="px-5 py-4 text-[#374151]">{m.email}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${ROLE_COLOR[m.role] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {m.display_id != null ? (
                      <Link
                        to={`/users/${m.display_id}`}
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

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md p-6 shadow-xl rounded-xl">
            <h2 className="text-base font-bold text-[#111827] mb-5">Add platform member</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Full name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Email address</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
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
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Platform role</label>
                <Dropdown
                  fullWidth
                  value={formRole}
                  onChange={(v) => setFormRole(v as PlatformRole)}
                  options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                />
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF] mt-3">
              New users receive an email to set their password. Existing accounts are added directly.
            </p>

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                onClick={closeAdd}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !formName.trim() || !formEmail.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
