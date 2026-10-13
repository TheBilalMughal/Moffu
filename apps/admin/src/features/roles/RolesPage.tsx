import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';

// ── Role config ───────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'owner',      label: 'Owner',      desc: 'Full access, billing included' },
  { key: 'super_admin',label: 'Super Admin', desc: 'All permissions, no billing delete' },
  { key: 'admin',      label: 'Admin',      desc: 'All except billing management' },
  { key: 'manager',    label: 'Manager',    desc: 'Reviews, reports, team view' },
  { key: 'operations', label: 'Ops',        desc: 'Review ops, locations, reports' },
  { key: 'live',       label: 'Live',       desc: 'Live response, limited access' },
  { key: 'finance',    label: 'Finance',    desc: 'Billing and reports only' },
  { key: 'accounts',   label: 'Accounts',   desc: 'Billing view and reports view' },
] as const;

type RoleKey = typeof ROLES[number]['key'];

// ── Permission modules (CRUD per feature) ─────────────────────────────────────
// null = action does not exist for this module

const MODULES = [
  {
    label: 'Reviews',
    crud: {
      view:   ['reviews.view'],
      add:    ['reviews.generate'],
      edit:   ['reviews.edit', 'reviews.approve', 'reviews.publish'],
      delete: ['reviews.reject'],
    },
  },
  {
    label: 'Brand Brain',
    crud: {
      view:   ['brand_brain.view'],
      add:    null,
      edit:   ['brand_brain.edit'],
      delete: null,
    },
  },
  {
    label: 'Reports',
    crud: {
      view:   ['reports.view'],
      add:    null,
      edit:   null,
      delete: ['reports.export'],
    },
  },
  {
    label: 'Google',
    crud: {
      view:   null,
      add:    ['google.connect'],
      edit:   null,
      delete: ['google.disconnect'],
    },
  },
  {
    label: 'Locations',
    crud: {
      view:   ['locations.view'],
      add:    null,
      edit:   ['locations.manage'],
      delete: null,
    },
  },
  {
    label: 'Team',
    crud: {
      view:   ['team.view'],
      add:    ['team.invite'],
      edit:   ['team.manage'],
      delete: null,
    },
  },
  {
    label: 'Billing',
    crud: {
      view:   ['billing.view'],
      add:    null,
      edit:   ['billing.manage'],
      delete: null,
    },
  },
  {
    label: 'Settings',
    crud: {
      view:   ['settings.view'],
      add:    null,
      edit:   ['settings.manage'],
      delete: null,
    },
  },
  {
    label: 'Notifications',
    crud: {
      view:   null,
      add:    null,
      edit:   ['notifications.manage'],
      delete: null,
    },
  },
  {
    label: 'Support',
    crud: {
      view:   null,
      add:    ['support.create'],
      edit:   null,
      delete: null,
    },
  },
] as const;

type CrudAction = 'view' | 'add' | 'edit' | 'delete';

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManage(platformRole: string | null) {
  return platformRole === 'super_admin' || platformRole === 'admin';
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function cellGranted(perms: Set<string>, keys: readonly string[] | null): boolean | null {
  if (!keys) return null;
  return keys.every((k) => perms.has(k));
}

// ── Checkbox cell ─────────────────────────────────────────────────────────────

function CrudCell({
  localGranted,
  savedGranted,
  saving,
  canEdit,
  onToggle,
}: {
  localGranted: boolean | null;
  savedGranted: boolean | null;
  saving: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  if (localGranted === null) {
    return (
      <td className="px-4 py-2 text-center">
        <span className="text-[#D1D5DB] text-xs">—</span>
      </td>
    );
  }

  const isPending = localGranted !== savedGranted;

  const boxClass = localGranted
    ? isPending
      ? 'bg-amber-500 border-amber-500'
      : 'bg-[#0D4C3C] border-[#0D4C3C]'
    : isPending
    ? 'bg-white border-amber-400 ring-1 ring-amber-300'
    : 'bg-white border-[#D1D5DB] hover:border-[#0D4C3C]';

  return (
    <td className="px-4 py-2 text-center">
      {canEdit ? (
        <button
          onClick={onToggle}
          disabled={saving}
          className={`w-[18px] h-[18px] border-2 flex items-center justify-center mx-auto transition-colors disabled:opacity-50 ${boxClass}`}
        >
          {saving ? (
            <span className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin block" />
          ) : localGranted ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>
      ) : (
        <span className={`inline-flex w-[18px] h-[18px] border-2 items-center justify-center mx-auto ${localGranted ? 'bg-[#0D4C3C] border-[#0D4C3C]' : 'bg-white border-[#D1D5DB]'}`}>
          {localGranted && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      )}
    </td>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

const EMPTY_PERMS: Record<string, Set<string>> = Object.fromEntries(
  ROLES.map((r) => [r.key, new Set<string>()])
);

export function RolesPage() {
  const { platformRole } = useAdminAuthStore();
  const [selectedRole, setSelectedRole] = useState<RoleKey>('owner');
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>(EMPTY_PERMS);
  // localPerms = user's pending edits for selected role (not yet saved)
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = canManage(platformRole);
  const savedPerms = rolePerms[selectedRole] ?? new Set<string>();
  const isDirty = !setsEqual(localPerms, savedPerms);
  const pendingCount = [
    ...[...localPerms].filter((k) => !savedPerms.has(k)),
    ...[...savedPerms].filter((k) => !localPerms.has(k)),
  ].length;

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from('role_permissions')
      .select('role, permission');

    const rp: Record<string, Set<string>> = Object.fromEntries(
      ROLES.map((r) => [r.key, new Set<string>()])
    );
    for (const row of (data ?? [])) {
      if (rp[row.role]) rp[row.role].add(row.permission as string);
    }

    setRolePerms(rp);
    setLocalPerms(new Set(rp[selectedRole] ?? []));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function handleSelectRole(role: RoleKey) {
    // Switching role discards unsaved changes (same as page refresh)
    setSelectedRole(role);
    setLocalPerms(new Set(rolePerms[role] ?? []));
  }

  function handleToggle(keys: readonly string[]) {
    const allGranted = keys.every((k) => localPerms.has(k));
    setLocalPerms((prev) => {
      const next = new Set(prev);
      if (allGranted) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);

    const toAdd = [...localPerms].filter((k) => !savedPerms.has(k));
    const toRemove = [...savedPerms].filter((k) => !localPerms.has(k));

    if (toAdd.length) {
      await supabase.from('role_permissions').upsert(
        toAdd.map((k) => ({ role: selectedRole, permission: k })),
        { onConflict: 'role,permission' }
      );
    }
    for (const key of toRemove) {
      await supabase.from('role_permissions').delete()
        .eq('role', selectedRole).eq('permission', key);
    }

    setRolePerms((prev) => ({ ...prev, [selectedRole]: new Set(localPerms) }));
    setSaving(false);
  }

  function handleDiscard() {
    setLocalPerms(new Set(savedPerms));
  }

  const selectedRoleConfig = ROLES.find((r) => r.key === selectedRole)!;

  return (
    <div className="flex h-full">
      {/* Left: Roles sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-[#E5EAE8] bg-white px-3 py-6">
        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 mb-3">Roles</p>
        <div className="space-y-0.5">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => handleSelectRole(r.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selectedRole === r.key
                  ? 'bg-[#E6F2EE] text-[#0D4C3C]'
                  : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
              }`}
            >
              <p className={`text-sm font-semibold ${selectedRole === r.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
                {r.label}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-tight">{r.desc}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Right: Permission matrix */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Header row */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">{selectedRoleConfig.label} Permissions</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{selectedRoleConfig.desc}</p>
          </div>

          {canEdit && isDirty && (
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                {pendingCount} unsaved {pendingCount === 1 ? 'change' : 'changes'}
              </span>
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#0a3d30] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5 border-b border-[#F3F4F6]">
                <div className="h-3 bg-[#E5EAE8] rounded w-24" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="w-[18px] h-[18px] bg-[#E5EAE8] rounded mx-auto" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5EAE8] bg-[#F8FAF9]">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Permission</th>
                  {(['view', 'add', 'edit', 'delete'] as CrudAction[]).map((action) => (
                    <th key={action} className="px-4 py-2.5 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-20">
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {MODULES.map((mod) => (
                  <tr key={mod.label} className="hover:bg-[#F8FAF9] transition-colors">
                    <td className="px-5 py-2 font-medium text-[#111827]">{mod.label}</td>
                    {(['view', 'add', 'edit', 'delete'] as CrudAction[]).map((action) => {
                      const keys = mod.crud[action] as readonly string[] | null;
                      return (
                        <CrudCell
                          key={action}
                          localGranted={cellGranted(localPerms, keys)}
                          savedGranted={cellGranted(savedPerms, keys)}
                          saving={saving && keys != null}
                          canEdit={canEdit}
                          onToggle={() => keys && handleToggle(keys)}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!canEdit && (
          <p className="mt-4 text-xs text-[#9CA3AF]">You need super_admin or admin role to edit permissions.</p>
        )}
      </main>
    </div>
  );
}
