import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';

// ── Role config ───────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'owner',   label: 'Owner',   desc: 'Full access, billing included' },
  { key: 'admin',   label: 'Admin',   desc: 'All except billing management' },
  { key: 'manager', label: 'Manager', desc: 'Reviews, reports, team view' },
  { key: 'viewer',  label: 'Viewer',  desc: 'Read-only access' },
] as const;

type CustomerRole = typeof ROLES[number]['key'];

// ── Permission modules (CRUD per feature) ─────────────────────────────────────
// null = action does not exist for this module (show dash)

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

function isGranted(rolePerms: Set<string>, keys: readonly string[] | null): boolean | null {
  if (!keys) return null;
  return keys.every((k) => rolePerms.has(k));
}

// ── Checkbox cell ─────────────────────────────────────────────────────────────

function CrudCell({
  granted,
  saving,
  canEdit,
  onToggle,
}: {
  granted: boolean | null;
  saving: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  if (granted === null) {
    return <td className="px-4 py-2 text-center"><span className="text-[#D1D5DB] text-xs">—</span></td>;
  }

  return (
    <td className="px-4 py-2 text-center">
      {canEdit ? (
        <button
          onClick={onToggle}
          disabled={saving}
          className={`w-[18px] h-[18px] border-2 flex items-center justify-center mx-auto transition-colors disabled:opacity-50 ${
            granted ? 'bg-[#0D4C3C] border-[#0D4C3C]' : 'bg-white border-[#D1D5DB] hover:border-[#0D4C3C]'
          }`}
        >
          {saving ? (
            <span className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin block" />
          ) : granted ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>
      ) : (
        <span className={`inline-flex w-[18px] h-[18px] border-2 items-center justify-center mx-auto ${granted ? 'bg-[#0D4C3C] border-[#0D4C3C]' : 'bg-white border-[#D1D5DB]'}`}>
          {granted && (
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

export function RolesPage() {
  const { platformRole } = useAdminAuthStore();
  const [selectedRole, setSelectedRole] = useState<CustomerRole>('owner');
  const [rolePerms, setRolePerms] = useState<Record<CustomerRole, Set<string>>>({
    owner: new Set(), admin: new Set(), manager: new Set(), viewer: new Set(),
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const canEdit = canManage(platformRole);

  async function loadAll() {
    const { data } = await supabase
      .from('role_permissions')
      .select('role, permission');

    const rp: Record<CustomerRole, Set<string>> = {
      owner: new Set(), admin: new Set(), manager: new Set(), viewer: new Set(),
    };

    for (const row of (data ?? [])) {
      const r = row.role as CustomerRole;
      if (rp[r]) rp[r].add(row.permission as string);
    }

    setRolePerms(rp);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleToggle(role: CustomerRole, action: CrudAction, keys: readonly string[]) {
    const saveId = `${role}:${action}`;
    setSavingKey(saveId);

    const currentPerms = rolePerms[role];
    const allGranted = keys.every((k) => currentPerms.has(k));

    if (allGranted) {
      // Revoke all keys
      for (const key of keys) {
        await supabase.from('role_permissions').delete()
          .eq('role', role).eq('permission', key);
      }
    } else {
      // Grant missing keys
      const missing = keys.filter((k) => !currentPerms.has(k));
      for (const key of missing) {
        await supabase.from('role_permissions').upsert({ role, permission: key }, { onConflict: 'role,permission' });
      }
    }

    setRolePerms((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      if (allGranted) keys.forEach((k) => next[role].delete(k));
      else keys.forEach((k) => next[role].add(k));
      return next;
    });

    setSavingKey(null);
  }

  const currentPerms = rolePerms[selectedRole];
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
              onClick={() => setSelectedRole(r.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selectedRole === r.key
                  ? 'bg-[#E6F2EE] text-[#0D4C3C]'
                  : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
              }`}
            >
              <p className={`text-sm font-semibold ${selectedRole === r.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{r.label}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-tight">{r.desc}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Right: Permission matrix */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#111827]">{selectedRoleConfig.label} Permissions</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{selectedRoleConfig.desc}</p>
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
                {MODULES.map((mod) => {
                  const actions: CrudAction[] = ['view', 'add', 'edit', 'delete'];
                  return (
                    <tr key={mod.label} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="px-5 py-2 font-medium text-[#111827]">{mod.label}</td>
                      {actions.map((action) => {
                        const keys = mod.crud[action] as readonly string[] | null;
                        const granted = isGranted(currentPerms, keys);
                        const saveId = `${selectedRole}:${action}:${mod.label}`;
                        const isSaving = savingKey === `${selectedRole}:${action}`;
                        return (
                          <CrudCell
                            key={action}
                            granted={granted}
                            saving={isSaving && keys != null}
                            canEdit={canEdit}
                            onToggle={() => keys && handleToggle(selectedRole, action, keys)}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
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
