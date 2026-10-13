import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';

// ── Types ────────────────────────────────────────────────────────────────────

const CUSTOMER_ROLES = ['owner', 'admin', 'manager', 'viewer'] as const;
type CustomerRole = typeof CUSTOMER_ROLES[number];

interface Permission {
  key: string;
  label: string;
  description: string;
  category: string;
}

interface RolePermissionSet {
  [role: string]: Set<string>;
}

interface UserOverride {
  id: string;
  user_id: string;
  org_id: string;
  permission_key: string;
  effect: 'allow' | 'deny';
  user_email: string | undefined;
  org_name: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManage(platformRole: string | null) {
  return platformRole === 'super_admin' || platformRole === 'admin';
}

function groupByCategory(permissions: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const p of permissions) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return map;
}

function deriveCategory(key: string): string {
  return key.split('.')[0] ?? 'other';
}

function humanize(key: string): string {
  return key.split('.').slice(1).join(' ').replace(/_/g, ' ') || key;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'matrix' | 'registry' | 'overrides' | 'lookup';

// ── Permission Matrix ─────────────────────────────────────────────────────────

function PermissionMatrix({
  permissions,
  rolePerms,
  canEdit,
  onToggle,
  saving,
}: {
  permissions: Permission[];
  rolePerms: RolePermissionSet;
  canEdit: boolean;
  onToggle: (role: CustomerRole, key: string, current: boolean) => void;
  saving: string | null;
}) {
  const [bulkRole, setBulkRole] = useState<CustomerRole | ''>('');
  const [bulkCategory, setBulkCategory] = useState('');

  const categories = groupByCategory(permissions);

  function handleBulkToggle(grant: boolean) {
    if (!bulkRole) return;
    const permsToToggle = bulkCategory
      ? (categories.get(bulkCategory) ?? [])
      : permissions;
    for (const p of permsToToggle) {
      const current = rolePerms[bulkRole]?.has(p.key) ?? false;
      if (grant !== current) onToggle(bulkRole as CustomerRole, p.key, current);
    }
  }

  return (
    <div>
      {/* Bulk actions */}
      {canEdit && (
        <div className="mb-5 flex items-center gap-3 p-4 bg-[#F8FAF9] border border-[#E5EAE8]">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Bulk:</span>
          <select
            value={bulkRole}
            onChange={(e) => setBulkRole(e.target.value as CustomerRole | '')}
            className="px-2.5 py-1.5 text-xs border border-[#E5EAE8] bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]"
          >
            <option value="">Select role…</option>
            {CUSTOMER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-[#E5EAE8] bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]"
          >
            <option value="">All categories</option>
            {[...categories.keys()].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => handleBulkToggle(true)}
            disabled={!bulkRole}
            className="px-3 py-1.5 text-xs font-semibold bg-[#0D4C3C] text-white hover:bg-[#083F32] disabled:opacity-40 transition-colors"
          >
            Grant all
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            disabled={!bulkRole}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E5EAE8] text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors"
          >
            Revoke all
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E5EAE8] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-64">Permission</th>
              {CUSTOMER_ROLES.map((r) => (
                <th key={r} className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-24">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...categories.entries()].map(([cat, perms]) => (
              <>
                <tr key={`cat-${cat}`} className="bg-[#F8FAF9] border-y border-[#E5EAE8]">
                  <td colSpan={CUSTOMER_ROLES.length + 1} className="px-5 py-2">
                    <span className="text-xs font-bold text-[#0D4C3C] uppercase tracking-widest">{cat}</span>
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.key} className="border-b border-[#F3F4F6] hover:bg-[#F8FAF9] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[#111827]">{p.label || humanize(p.key)}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono">{p.key}</p>
                    </td>
                    {CUSTOMER_ROLES.map((role) => {
                      const granted = rolePerms[role]?.has(p.key) ?? false;
                      const isSaving = saving === `${role}:${p.key}`;
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          {canEdit ? (
                            <button
                              onClick={() => onToggle(role, p.key, granted)}
                              disabled={isSaving}
                              title={granted ? `Revoke ${p.key} from ${role}` : `Grant ${p.key} to ${role}`}
                              className={`w-5 h-5 border-2 transition-colors mx-auto flex items-center justify-center disabled:opacity-50 ${
                                granted
                                  ? 'bg-[#0D4C3C] border-[#0D4C3C]'
                                  : 'bg-white border-[#D1D5DB] hover:border-[#0D4C3C]'
                              }`}
                            >
                              {isSaving ? (
                                <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin block" />
                              ) : granted ? (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : null}
                            </button>
                          ) : (
                            <span className={`inline-block w-5 h-5 border-2 mx-auto flex items-center justify-center ${granted ? 'bg-[#0D4C3C] border-[#0D4C3C]' : 'bg-white border-[#D1D5DB]'}`}>
                              {granted && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Permission Registry ───────────────────────────────────────────────────────

function PermissionRegistry({
  permissions,
  canEdit,
  onAdded,
}: {
  permissions: Permission[];
  canEdit: boolean;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const categories = groupByCategory(permissions);

  async function handleAdd() {
    setErr(null);
    const key = newKey.trim().toLowerCase();
    if (!key || !key.includes('.')) { setErr('Key must be in format category.action'); return; }
    if (permissions.some((p) => p.key === key)) { setErr('This permission key already exists.'); return; }
    setSaving(true);
    const { error } = await supabase.from('customer_permissions').insert({ key, description: newDesc.trim() || null });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setNewKey(''); setNewDesc(''); setAdding(false);
    onAdded();
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-5">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-3 py-1.5 hover:bg-[#E6F2EE] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New permission key
            </button>
          ) : (
            <div className="bg-[#F8FAF9] border border-[#E5EAE8] p-4 flex flex-col gap-3 max-w-lg">
              <div>
                <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">Key (e.g. reviews.export)</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="category.action"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What this permission allows"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                />
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-sm font-semibold bg-[#0D4C3C] text-white hover:bg-[#083F32] disabled:opacity-50 transition-colors">
                  {saving ? 'Adding…' : 'Add'}
                </button>
                <button onClick={() => { setAdding(false); setErr(null); }} className="px-3 py-1.5 text-sm text-[#374151] border border-[#E5EAE8] hover:bg-[#F3F4F6] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {[...categories.entries()].map(([cat, perms]) => (
          <div key={cat}>
            <h3 className="text-xs font-bold text-[#0D4C3C] uppercase tracking-widest mb-2">{cat}</h3>
            <div className="bg-white border border-[#E5EAE8]">
              {perms.map((p, idx) => (
                <div key={p.key} className={`flex items-start justify-between px-5 py-3.5 ${idx > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                  <div>
                    <p className="text-sm font-mono font-medium text-[#111827]">{p.key}</p>
                    {p.description && <p className="text-xs text-[#9CA3AF] mt-0.5">{p.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User Overrides ────────────────────────────────────────────────────────────

function UserOverridesTab({
  overrides,
  permissions,
  canEdit,
  onRefresh,
}: {
  overrides: UserOverride[];
  permissions: Permission[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formOrgId, setFormOrgId] = useState('');
  const [formPerm, setFormPerm] = useState('');
  const [formEffect, setFormEffect] = useState<'allow' | 'deny'>('allow');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function handleAdd() {
    setErr(null);
    if (!formUserId.trim() || !formOrgId.trim() || !formPerm) { setErr('All fields are required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('user_permission_overrides').insert({
      user_id: formUserId.trim(),
      org_id: formOrgId.trim(),
      permission_key: formPerm,
      permission_effect: formEffect,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setAdding(false); setFormUserId(''); setFormOrgId(''); setFormPerm(''); setFormEffect('allow');
    onRefresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('user_permission_overrides').delete().eq('id', id);
    if (!error) onRefresh();
  }

  const filtered = overrides.filter(
    (o) => search.trim() === '' ||
      o.user_id.includes(search) ||
      (o.user_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      o.permission_key.includes(search)
  );

  return (
    <div>
      {canEdit && (
        <div className="mb-5">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-3 py-1.5 hover:bg-[#E6F2EE] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add override
            </button>
          ) : (
            <div className="bg-[#F8FAF9] border border-[#E5EAE8] p-4 max-w-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">User ID</label>
                  <input type="text" value={formUserId} onChange={(e) => setFormUserId(e.target.value)} placeholder="uuid" className="w-full px-3 py-2 text-xs border border-[#E5EAE8] font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">Org ID</label>
                  <input type="text" value={formOrgId} onChange={(e) => setFormOrgId(e.target.value)} placeholder="uuid" className="w-full px-3 py-2 text-xs border border-[#E5EAE8] font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">Permission</label>
                  <select value={formPerm} onChange={(e) => setFormPerm(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E5EAE8] bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]">
                    <option value="">Select…</option>
                    {permissions.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide block mb-1">Effect</label>
                  <select value={formEffect} onChange={(e) => setFormEffect(e.target.value as 'allow' | 'deny')} className="w-full px-3 py-2 text-sm border border-[#E5EAE8] bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]">
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </div>
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">DENY overrides always win, even if the base role grants the permission.</p>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-sm font-semibold bg-[#0D4C3C] text-white hover:bg-[#083F32] disabled:opacity-50 transition-colors">{saving ? 'Saving…' : 'Save override'}</button>
                <button onClick={() => { setAdding(false); setErr(null); }} className="px-3 py-1.5 text-sm text-[#374151] border border-[#E5EAE8] hover:bg-[#F3F4F6] transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative max-w-xs mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="search" placeholder="Filter by user or permission…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5EAE8] bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]" />
      </div>

      <div className="bg-white border border-[#E5EAE8]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">User</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Org</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Permission</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Effect</th>
              {canEdit && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No user overrides configured.</td></tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} className="hover:bg-[#F8FAF9]">
                  <td className="px-5 py-3 font-mono text-xs text-[#374151]">{o.user_email ?? o.user_id.slice(0, 8) + '…'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[#374151]">{o.org_name ?? o.org_id.slice(0, 8) + '…'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[#374151]">{o.permission_key}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold ${o.effect === 'deny' ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#ECFDF5] text-[#065F46]'}`}>
                      {o.effect.toUpperCase()}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDelete(o.id)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reverse Lookup (Who can X?) ───────────────────────────────────────────────

function ReverseLookupTab({
  permissions,
  rolePerms,
}: {
  permissions: Permission[];
  rolePerms: RolePermissionSet;
}) {
  const [selected, setSelected] = useState('');

  const rolesWithPerm = selected
    ? CUSTOMER_ROLES.filter((r) => rolePerms[r]?.has(selected))
    : [];

  const rolesWithout = selected
    ? CUSTOMER_ROLES.filter((r) => !rolePerms[r]?.has(selected))
    : [];

  return (
    <div>
      <p className="text-sm text-[#6B7280] mb-4">Select a permission to see which customer roles can perform it.</p>
      <div className="max-w-sm mb-6">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#E5EAE8] bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]"
        >
          <option value="">Select a permission…</option>
          {permissions.map((p) => (
            <option key={p.key} value={p.key}>{p.key}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-bold text-[#0D4C3C] uppercase tracking-widest mb-3">Has access ({rolesWithPerm.length})</h3>
            <div className="space-y-2">
              {rolesWithPerm.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">No roles have this permission.</p>
              ) : (
                rolesWithPerm.map((r) => (
                  <div key={r} className="flex items-center gap-2 px-4 py-2.5 bg-[#ECFDF5] border border-[#A7F3D0]">
                    <svg className="w-3.5 h-3.5 text-[#065F46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-semibold text-[#065F46]">{r}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#991B1B] uppercase tracking-widest mb-3">No access ({rolesWithout.length})</h3>
            <div className="space-y-2">
              {rolesWithout.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">All roles have this permission.</p>
              ) : (
                rolesWithout.map((r) => (
                  <div key={r} className="flex items-center gap-2 px-4 py-2.5 bg-[#FEF2F2] border border-[#FECACA]">
                    <svg className="w-3.5 h-3.5 text-[#991B1B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm font-semibold text-[#991B1B]">{r}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

export function RolesPage() {
  const { platformRole } = useAdminAuthStore();
  const [tab, setTab] = useState<Tab>('matrix');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermissionSet>({});
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const edit = canManage(platformRole);

  async function loadAll() {
    const [permsRes, rolePermsRes, overridesRes] = await Promise.all([
      supabase.from('customer_permissions').select('key, description').order('key'),
      supabase.from('role_permissions').select('role, permission_key'),
      supabase.from('user_permission_overrides').select('id, user_id, org_id, permission_key, permission_effect'),
    ]);

    const perms: Permission[] = (permsRes.data ?? []).map((p: { key: string; description: string }) => ({
      key: p.key,
      label: humanize(p.key),
      description: p.description ?? '',
      category: deriveCategory(p.key),
    }));
    setPermissions(perms);

    const rp: RolePermissionSet = {};
    for (const r of CUSTOMER_ROLES) rp[r] = new Set();
    for (const row of (rolePermsRes.data ?? [])) {
      rp[row.role as CustomerRole]?.add(row.permission_key);
    }
    setRolePerms(rp);

    // Enrich overrides with user emails + org names
    const rawOverrides: UserOverride[] = (overridesRes.data ?? []).map((o: {
      id: string;
      user_id: string;
      org_id: string;
      permission_key: string;
      permission_effect: string;
    }) => ({
      id: o.id,
      user_id: o.user_id,
      org_id: o.org_id,
      permission_key: o.permission_key,
      effect: o.permission_effect as 'allow' | 'deny',
      user_email: undefined,
      org_name: undefined,
    }));

    if (rawOverrides.length > 0) {
      const userIds = [...new Set(rawOverrides.map((o) => o.user_id))];
      const orgIds = [...new Set(rawOverrides.map((o) => o.org_id))];

      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from('profiles').select('id, email').in('id', userIds),
        supabase.from('organizations').select('id, name').in('id', orgIds),
      ]);

      const emailById = new Map((profilesRes.data ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));
      const nameById = new Map((orgsRes.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));

      setOverrides(rawOverrides.map((o) => ({
        ...o,
        user_email: emailById.get(o.user_id),
        org_name: nameById.get(o.org_id),
      })));
    } else {
      setOverrides([]);
    }

    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleToggle(role: CustomerRole, key: string, current: boolean) {
    const saveId = `${role}:${key}`;
    setSavingKey(saveId);

    if (current) {
      await supabase.from('role_permissions').delete()
        .eq('role', role)
        .eq('permission_key', key);
    } else {
      await supabase.from('role_permissions').insert({ role, permission_key: key });
    }

    // Optimistic update
    setRolePerms((prev) => {
      const next = { ...prev };
      next[role] = new Set(prev[role]);
      if (current) next[role].delete(key);
      else next[role].add(key);
      return next;
    });

    setSavingKey(null);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'matrix', label: 'Permission Matrix' },
    { id: 'registry', label: 'Permission Registry' },
    { id: 'overrides', label: 'User Overrides' },
    { id: 'lookup', label: 'Who can…?' },
  ];

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">Roles & Permissions</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage customer-facing role permissions and per-user overrides.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#E5EAE8] mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-[#0D4C3C] text-[#0D4C3C]'
                : 'border-transparent text-[#6B7280] hover:text-[#374151]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#9CA3AF]">Loading…</div>
      ) : (
        <>
          {tab === 'matrix' && (
            <PermissionMatrix
              permissions={permissions}
              rolePerms={rolePerms}
              canEdit={edit}
              onToggle={handleToggle}
              saving={savingKey}
            />
          )}
          {tab === 'registry' && (
            <PermissionRegistry
              permissions={permissions}
              canEdit={edit}
              onAdded={loadAll}
            />
          )}
          {tab === 'overrides' && (
            <UserOverridesTab
              overrides={overrides}
              permissions={permissions}
              canEdit={edit}
              onRefresh={loadAll}
            />
          )}
          {tab === 'lookup' && (
            <ReverseLookupTab
              permissions={permissions}
              rolePerms={rolePerms}
            />
          )}
        </>
      )}
    </div>
  );
}
