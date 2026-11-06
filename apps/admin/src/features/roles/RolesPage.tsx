import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { Dropdown } from '@/components/Dropdown';

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

// ── Permission modules ────────────────────────────────────────────────────────

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
  {
    label: 'Privacy',
    crud: {
      view:   null,
      add:    ['privacy.request'],
      edit:   null,
      delete: null,
    },
  },
] as const;

type CrudAction = 'view' | 'add' | 'edit' | 'delete';
type ModuleType = typeof MODULES[number];

// ── Audit entry type ──────────────────────────────────────────────────────────

interface AuditEntry {
  id: number;
  role: string;
  permission: string;
  action: 'grant' | 'revoke';
  changed_by: string | null;
  changed_at: string;
}

interface OverrideRow {
  id: string;
  org_id: string;
  user_id: string;
  permission: string;
  effect: 'allow' | 'deny';
  scope_location_id: string | null;
  created_at: string;
  org_name: string | null;
  user_name: string | null;
  user_email: string | null;
}

interface PermKey {
  key: string;
  description: string;
  created_at: string;
}

type NavView = 'role' | 'overrides' | 'audit' | 'keys';

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManage(r: string | null) {
  return r === 'super_admin' || r === 'admin';
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

function moduleAllKeys(mod: ModuleType): string[] {
  return (
    [...(mod.crud.view ?? []), ...(mod.crud.add ?? []), ...(mod.crud.edit ?? []), ...(mod.crud.delete ?? [])]
  );
}

function permLabel(key: string) {
  const map: Record<string, string> = {
    'reviews.view': 'View reviews', 'reviews.generate': 'Generate drafts',
    'reviews.edit': 'Edit drafts', 'reviews.approve': 'Approve drafts',
    'reviews.publish': 'Publish replies', 'reviews.reject': 'Reject drafts',
    'brand_brain.view': 'View Brand Brain', 'brand_brain.edit': 'Edit Brand Brain',
    'reports.view': 'View reports', 'reports.export': 'Export reports',
    'google.connect': 'Connect Google', 'google.disconnect': 'Disconnect Google',
    'locations.view': 'View locations', 'locations.manage': 'Manage locations',
    'team.view': 'View team', 'team.invite': 'Invite members', 'team.manage': 'Manage team',
    'billing.view': 'View billing', 'billing.manage': 'Manage billing',
    'settings.view': 'View settings', 'settings.manage': 'Manage settings',
    'notifications.manage': 'Manage notifications', 'support.create': 'Create support tickets',
    'privacy.request': 'Privacy requests',
  };
  return map[key] ?? key;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── CrudCell ──────────────────────────────────────────────────────────────────

function CrudCell({
  localGranted, savedGranted, saving, canEdit, onToggle,
}: {
  localGranted: boolean | null;
  savedGranted: boolean | null;
  saving: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  if (localGranted === null) {
    return <td className="px-4 py-1.5 text-center"><span className="text-[#D1D5DB] text-xs">—</span></td>;
  }

  const isPending = localGranted !== savedGranted;
  const boxClass = localGranted
    ? isPending
      ? 'bg-amber-500 border-amber-500'
      : 'bg-[#0D4C3C] border-[#0D4C3C]'
    : isPending
    ? 'bg-white border-amber-400 ring-1 ring-amber-300'
    : canEdit
    ? 'bg-white border-[#D1D5DB] hover:border-[#0D4C3C]'
    : 'bg-white border-[#D1D5DB]';

  return (
    <td className="px-4 py-1.5 text-center">
      {canEdit ? (
        <button
          onClick={onToggle}
          disabled={saving}
          className={`w-[18px] h-[18px] border-2 flex items-center justify-center mx-auto transition-colors disabled:opacity-50 ${boxClass}`}
        >
          {localGranted ? (
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

// ── SavePreviewModal ──────────────────────────────────────────────────────────

function SavePreviewModal({
  role,
  toAdd,
  toRemove,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  role: string;
  toAdd: string[];
  toRemove: string[];
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const roleLabel = ROLES.find((r) => r.key === role)?.label ?? role;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-[#E5EAE8]">
          <h2 className="text-base font-bold text-[#111827]">Review changes — {roleLabel}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">These will be applied immediately and logged.</p>
        </div>
        <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-1.5">
          {toAdd.map((k) => (
            <div key={k} className="flex items-center gap-2.5 text-sm">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">+</span>
              <span className="text-[#111827]">{permLabel(k)}</span>
              <span className="text-[10px] text-[#9CA3AF] ml-auto font-mono">{k}</span>
            </div>
          ))}
          {toRemove.map((k) => (
            <div key={k} className="flex items-center gap-2.5 text-sm">
              <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">−</span>
              <span className="text-[#111827]">{permLabel(k)}</span>
              <span className="text-[10px] text-[#9CA3AF] ml-auto font-mono">{k}</span>
            </div>
          ))}
        </div>
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
        <div className="px-6 py-4 border-t border-[#E5EAE8] flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="px-4 py-1.5 text-sm text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-[#0D4C3C] hover:bg-[#0a3d30] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />}
            {saving ? 'Saving…' : `Apply ${toAdd.length + toRemove.length} change${toAdd.length + toRemove.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RoleDiffModal ─────────────────────────────────────────────────────────────

function RoleDiffModal({
  baseRole,
  compareRole,
  onChangeCompare,
  rolePerms,
  onClose,
}: {
  baseRole: RoleKey;
  compareRole: RoleKey;
  onChangeCompare: (r: RoleKey) => void;
  rolePerms: Record<string, Set<string>>;
  onClose: () => void;
}) {
  const baseLabel = ROLES.find((r) => r.key === baseRole)?.label ?? baseRole;
  const cmpLabel  = ROLES.find((r) => r.key === compareRole)?.label ?? compareRole;
  const base = rolePerms[baseRole] ?? new Set<string>();
  const cmp  = rolePerms[compareRole] ?? new Set<string>();

  const actions: CrudAction[] = ['view', 'add', 'edit', 'delete'];

  const hasDiff = MODULES.some((mod) =>
    actions.some((a) => {
      const keys = mod.crud[a] as readonly string[] | null;
      if (!keys) return false;
      return keys.every((k) => base.has(k)) !== keys.every((k) => cmp.has(k));
    })
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="px-6 py-4 border-b border-[#E5EAE8] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Role Comparison</h2>
            {!hasDiff && <p className="text-xs text-emerald-600 mt-0.5">No differences between these roles.</p>}
            {hasDiff && <p className="text-xs text-amber-600 mt-0.5">Highlighted rows differ between roles.</p>}
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Compare role picker */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-3 text-sm">
          <span className="font-semibold text-[#0D4C3C] w-28">{baseLabel}</span>
          <span className="text-[#9CA3AF]">vs</span>
          <Dropdown
            value={compareRole}
            onChange={(v) => onChangeCompare(v as RoleKey)}
            options={ROLES.filter((r) => r.key !== baseRole).map((r) => ({ value: r.key, label: r.label }))}
          />
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-140px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#F8FAF9] border-b border-[#E5EAE8]">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Module</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-16">View</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-16">Add</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-16">Edit</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-16">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {MODULES.map((mod) => {
                const rowDiff = actions.some((a) => {
                  const keys = mod.crud[a] as readonly string[] | null;
                  if (!keys) return false;
                  return keys.every((k) => base.has(k)) !== keys.every((k) => cmp.has(k));
                });

                return (
                  <tr key={mod.label} className={rowDiff ? 'bg-amber-50' : ''}>
                    <td className="px-5 py-1.5 font-medium text-[#111827]">{mod.label}</td>
                    {actions.map((a) => {
                      const keys = mod.crud[a] as readonly string[] | null;
                      if (!keys) return <td key={a} className="px-3 py-1.5 text-center"><span className="text-[#D1D5DB] text-xs">—</span></td>;

                      const bGrant = keys.every((k) => base.has(k));
                      const cGrant = keys.every((k) => cmp.has(k));
                      const diff   = bGrant !== cGrant;

                      return (
                        <td key={a} className="px-3 py-1.5">
                          <div className={`flex items-center justify-center gap-1 ${diff ? 'font-semibold' : ''}`}>
                            <span className={`text-xs ${bGrant ? 'text-emerald-600' : 'text-[#D1D5DB]'}`} title={baseLabel}>
                              {bGrant ? '✓' : '✗'}
                            </span>
                            <span className="text-[10px] text-[#D1D5DB]">/</span>
                            <span className={`text-xs ${cGrant ? 'text-emerald-600' : diff ? 'text-red-400' : 'text-[#D1D5DB]'}`} title={cmpLabel}>
                              {cGrant ? '✓' : '✗'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-5 py-2 text-[10px] text-[#9CA3AF] border-t border-[#F3F4F6]">
            Left value = {baseLabel} &nbsp;·&nbsp; Right value = {cmpLabel} &nbsp;·&nbsp; Amber rows have differences
          </p>
        </div>
      </div>
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

const INIT_PERMS: Record<string, Set<string>> = Object.fromEntries(
  ROLES.map((r) => [r.key, new Set<string>()])
);

export function RolesPage() {
  const { user, platformRole } = useAdminAuthStore();

  // Core state
  const [selectedRole, setSelectedRole] = useState<RoleKey>('owner');
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>(INIT_PERMS);
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading]  = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // Tab
  const [tab, setTab] = useState<'permissions' | 'audit'>('permissions');

  // Search filter
  const [search, setSearch] = useState('');

  // Diff modal
  const [showDiff, setShowDiff]       = useState(false);
  const [diffRole, setDiffRole]       = useState<RoleKey>('admin');

  // Save preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Audit log (per-role, used when navView === 'role' and tab === 'audit')
  const [auditLog, setAuditLog]       = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Nav view — controls which page the right panel shows
  const [navView, setNavView] = useState<NavView>('role');

  // User Overrides page
  const [overrideRows, setOverrideRows]       = useState<OverrideRow[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesError, setOverridesError]   = useState<string | null>(null);
  const [overridesSearch, setOverridesSearch] = useState('');
  const [revokingId, setRevokingId]           = useState<string | null>(null);

  // Global Audit Log page
  const [globalAudit, setGlobalAudit]               = useState<AuditEntry[]>([]);
  const [globalAuditLoading, setGlobalAuditLoading] = useState(false);
  const [globalAuditError, setGlobalAuditError]     = useState<string | null>(null);
  const [globalAuditRole, setGlobalAuditRole]       = useState('all');

  // Permission Keys page
  const [permKeys, setPermKeys]           = useState<PermKey[]>([]);
  const [permKeysLoading, setPermKeysLoading] = useState(false);
  const [permKeysSearch, setPermKeysSearch] = useState('');

  // Override counts per permission key
  const [overrideCounts, setOverrideCounts] = useState<Map<string, number>>(new Map());

  const canEdit = canManage(platformRole);
  const savedPerms = rolePerms[selectedRole] ?? new Set<string>();
  const isDirty    = !setsEqual(localPerms, savedPerms);
  const toAdd      = useMemo(() => [...localPerms].filter((k) => !savedPerms.has(k)), [localPerms, savedPerms]);
  const toRemove   = useMemo(() => [...savedPerms].filter((k) => !localPerms.has(k)), [localPerms, savedPerms]);
  const pendingCount = toAdd.length + toRemove.length;

  // Filter modules by search
  const filteredModules = useMemo(() =>
    MODULES.filter((m) =>
      search.trim() === '' || m.label.toLowerCase().includes(search.toLowerCase())
    ),
    [search]
  );

  // ── Load permissions ────────────────────────────────────────────────────────

  async function loadAll() {
    setLoading(true);
    setLoadError(null);

    const [permsRes, overridesRes] = await Promise.all([
      supabase.from('role_permissions').select('role, permission'),
      supabase.from('user_permission_overrides').select('permission'),
    ]);

    if (permsRes.error) {
      setLoadError(permsRes.error.message);
      setLoading(false);
      return;
    }

    const rp: Record<string, Set<string>> = Object.fromEntries(
      ROLES.map((r) => [r.key, new Set<string>()])
    );
    for (const row of (permsRes.data ?? [])) {
      const s = rp[row.role];
      if (s) s.add(row.permission as string);
    }

    const oc = new Map<string, number>();
    for (const row of (overridesRes.data ?? [])) {
      oc.set(row.permission as string, (oc.get(row.permission as string) ?? 0) + 1);
    }

    setRolePerms(rp);
    setLocalPerms(new Set(rp[selectedRole] ?? []));
    setOverrideCounts(oc);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // ── Load audit log ──────────────────────────────────────────────────────────

  async function loadAudit(role: string) {
    setAuditLoading(true);
    setAuditError(null);
    const { data, error } = await supabase
      .from('role_permission_audit')
      .select('id, role, permission, action, changed_by, changed_at')
      .eq('role', role)
      .order('changed_at', { ascending: false })
      .limit(100);

    if (error) setAuditError(error.message);
    setAuditLog((data ?? []) as AuditEntry[]);
    setAuditLoading(false);
  }

  useEffect(() => {
    if (tab === 'audit') loadAudit(selectedRole);
  }, [tab, selectedRole]);

  // ── Role selection ──────────────────────────────────────────────────────────

  function handleSelectRole(role: RoleKey) {
    setSelectedRole(role);
    setLocalPerms(new Set(rolePerms[role] ?? []));
    setSearch('');
    if (tab === 'audit') loadAudit(role);
  }

  // ── Toggle permission ───────────────────────────────────────────────────────

  function handleToggle(keys: readonly string[]) {
    const allGranted = keys.every((k) => localPerms.has(k));
    setLocalPerms((prev) => {
      const next = new Set(prev);
      if (allGranted) keys.forEach((k) => next.delete(k));
      else            keys.forEach((k) => next.add(k));
      return next;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function executeSave() {
    setSaving(true);
    setSaveError(null);

    if (toAdd.length) {
      const { error } = await supabase.from('role_permissions').upsert(
        toAdd.map((k) => ({ role: selectedRole, permission: k })),
        { onConflict: 'role,permission' }
      );
      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
    }

    for (const key of toRemove) {
      const { error } = await supabase.from('role_permissions').delete()
        .eq('role', selectedRole).eq('permission', key);
      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
    }

    // Audit log — fire and forget; don't block save on failure
    const auditRows = [
      ...toAdd.map((k) => ({ role: selectedRole, permission: k, action: 'grant', changed_by: user?.id ?? null })),
      ...toRemove.map((k) => ({ role: selectedRole, permission: k, action: 'revoke', changed_by: user?.id ?? null })),
    ];
    if (auditRows.length) {
      supabase.from('role_permission_audit').insert(auditRows).then(() => {
        if (tab === 'audit') loadAudit(selectedRole);
      });
    }

    setRolePerms((prev) => ({ ...prev, [selectedRole]: new Set(localPerms) }));
    setShowPreview(false);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  }

  function handleDiscard() {
    setLocalPerms(new Set(savedPerms));
  }

  // ── Load User Overrides ─────────────────────────────────────────────────────

  async function loadOverrides() {
    setOverridesLoading(true);
    setOverridesError(null);
    const { data, error } = await supabase
      .from('user_permission_overrides')
      .select('id, org_id, user_id, permission, effect, scope_location_id, created_at, organizations:org_id(name), profiles:user_id(display_name, email)')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) { setOverridesError(error.message); setOverridesLoading(false); return; }

    setOverrideRows((data ?? []).map((r: any) => ({
      id: r.id,
      org_id: r.org_id,
      user_id: r.user_id,
      permission: r.permission,
      effect: r.effect,
      scope_location_id: r.scope_location_id,
      created_at: r.created_at,
      org_name: r.organizations?.name ?? null,
      user_name: r.profiles?.display_name ?? null,
      user_email: r.profiles?.email ?? null,
    })));
    setOverridesLoading(false);
  }

  async function handleRevokeOverride(id: string) {
    setRevokingId(id);
    const { error } = await supabase.from('user_permission_overrides').delete().eq('id', id);
    if (!error) setOverrideRows((prev) => prev.filter((r) => r.id !== id));
    setRevokingId(null);
  }

  // ── Load Global Audit ───────────────────────────────────────────────────────

  async function loadGlobalAudit() {
    setGlobalAuditLoading(true);
    setGlobalAuditError(null);
    let q = supabase
      .from('role_permission_audit')
      .select('id, role, permission, action, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .limit(300);
    if (globalAuditRole !== 'all') q = q.eq('role', globalAuditRole);
    const { data, error } = await q;
    if (error) setGlobalAuditError(error.message);
    setGlobalAudit((data ?? []) as AuditEntry[]);
    setGlobalAuditLoading(false);
  }

  // ── Load Permission Keys ────────────────────────────────────────────────────

  async function loadPermKeys() {
    setPermKeysLoading(true);
    const { data } = await supabase
      .from('customer_permissions')
      .select('key, description, created_at')
      .order('key');
    setPermKeys((data ?? []) as PermKey[]);
    setPermKeysLoading(false);
  }

  useEffect(() => {
    if (navView === 'overrides') loadOverrides();
    if (navView === 'audit')    loadGlobalAudit();
    if (navView === 'keys')     loadPermKeys();
  }, [navView]);

  useEffect(() => {
    if (navView === 'audit') loadGlobalAudit();
  }, [globalAuditRole]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getModuleOverrideCount(mod: ModuleType) {
    return moduleAllKeys(mod).reduce((sum, k) => sum + (overrideCounts.get(k) ?? 0), 0);
  }

  const selectedRoleConfig = ROLES.find((r) => r.key === selectedRole)!;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-full">
        {/* Left: Roles sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-[#E5EAE8] px-3 py-6 flex flex-col overflow-y-auto">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 mb-3">Roles</p>
          <div className="space-y-0.5">
            {ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => { setNavView('role'); handleSelectRole(r.key); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  navView === 'role' && selectedRole === r.key
                    ? 'bg-[#E6F2EE] text-[#0D4C3C]'
                    : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
                }`}
              >
                <p className={`text-sm font-semibold ${navView === 'role' && selectedRole === r.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
                  {r.label}
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-tight">{r.desc}</p>
              </button>
            ))}
          </div>

          {/* Additional pages */}
          <div className="mt-5 pt-4 border-t border-[#E5EAE8] space-y-0.5">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 mb-2">More</p>

            <button
              onClick={() => setNavView('overrides')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                navView === 'overrides' ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'text-[#374151] hover:bg-[#F3F4F6]'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold">User Overrides</span>
            </button>

            <button
              onClick={() => setNavView('audit')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                navView === 'audit' ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'text-[#374151] hover:bg-[#F3F4F6]'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="text-sm font-semibold">Audit Log</span>
            </button>

            <button
              onClick={() => setNavView('keys')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                navView === 'keys' ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'text-[#374151] hover:bg-[#F3F4F6]'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="text-sm font-semibold">Permission Keys</span>
            </button>
          </div>
        </aside>

        {/* Right content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── Role permissions view ── */}
          {navView === 'role' && (<>
          {/* Header */}
          <div className="px-8 pt-6 pb-4 flex items-start justify-between gap-4 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-[#111827]">{selectedRoleConfig.label} Permissions</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">{selectedRoleConfig.desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <button
                onClick={() => { setDiffRole(selectedRole === 'owner' ? 'admin' : 'owner'); setShowDiff(true); }}
                className="px-3 py-1.5 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Compare roles
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-8 pt-0 flex-shrink-0">
            <div className="flex gap-0">
              {(['permissions', 'audit'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                    tab === t
                      ? 'border-[#0D4C3C] text-[#0D4C3C]'
                      : 'border-transparent text-[#6B7280] hover:text-[#374151]'
                  }`}
                >
                  {t === 'audit' ? 'Audit Log' : 'Permissions'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-5">

            {/* ── Permissions tab ── */}
            {tab === 'permissions' && (
              <>
                {/* Load error */}
                {loadError && (
                  <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1">Failed to load permissions: {loadError}</span>
                    <button onClick={loadAll} className="font-semibold hover:underline flex-shrink-0">Retry</button>
                  </div>
                )}

                {/* Save error */}
                {saveError && (
                  <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1">Save failed: {saveError}</span>
                    <button onClick={() => setSaveError(null)} className="font-semibold hover:underline flex-shrink-0">Dismiss</button>
                  </div>
                )}

                {/* Success banner */}
                {savedMsg && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Permissions saved successfully.
                  </div>
                )}

                {/* Search + unsaved bar */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-xs">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Filter modules…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#E5EAE8] shadow-sm rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                    />
                  </div>

                  {canEdit && isDirty && (
                    <div className="flex items-center gap-2 ml-auto">
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
                        onClick={() => { setSaveError(null); setShowPreview(true); }}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D4C3C] hover:bg-[#0a3d30] transition-colors disabled:opacity-50"
                      >
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                {/* Permission table */}
                {loading ? (
                  <div className="bg-white shadow-sm rounded-xl overflow-hidden animate-pulse">
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
                  <div className="bg-white shadow-sm rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
                        <tr>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Module</th>
                          {(['view', 'add', 'edit', 'delete'] as CrudAction[]).map((a) => (
                            <th key={a} className="px-4 py-2.5 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-20">
                              {a.charAt(0).toUpperCase() + a.slice(1)}
                            </th>
                          ))}
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-24">Overrides</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {filteredModules.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#9CA3AF]">
                              No modules match "{search}".
                            </td>
                          </tr>
                        ) : (
                          filteredModules.map((mod) => {
                            const overrideCount = getModuleOverrideCount(mod);
                            return (
                              <tr key={mod.label} className="hover:bg-[#F8FAF9] transition-colors">
                                <td className="px-5 py-1.5 font-medium text-[#111827]">{mod.label}</td>
                                {(['view', 'add', 'edit', 'delete'] as CrudAction[]).map((a) => {
                                  const keys = mod.crud[a] as readonly string[] | null;
                                  return (
                                    <CrudCell
                                      key={a}
                                      localGranted={cellGranted(localPerms, keys)}
                                      savedGranted={cellGranted(savedPerms, keys)}
                                      saving={saving && keys != null}
                                      canEdit={canEdit}
                                      onToggle={() => keys && handleToggle(keys)}
                                    />
                                  );
                                })}
                                <td className="px-4 py-1.5 text-center">
                                  {overrideCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[#D1D5DB] text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!canEdit && (
                  <p className="mt-4 text-xs text-[#9CA3AF]">You need super_admin or admin role to edit permissions.</p>
                )}
              </>
            )}

            {/* ── Audit log tab ── */}
            {tab === 'audit' && (
              <div className="bg-white shadow-sm rounded-xl overflow-hidden">
                {auditError && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1">Failed to load audit log: {auditError}</span>
                    <button onClick={() => loadAudit(selectedRole)} className="font-semibold hover:underline flex-shrink-0">Retry</button>
                  </div>
                )}
                {auditLoading ? (
                  <div className="animate-pulse divide-y divide-[#F3F4F6]">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-12 h-3 bg-[#E5EAE8] rounded" />
                        <div className="flex-1 h-3 bg-[#E5EAE8] rounded" />
                        <div className="w-20 h-3 bg-[#E5EAE8] rounded" />
                      </div>
                    ))}
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                    No changes recorded yet for {selectedRoleConfig.label}.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Action</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Permission</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Changed by</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {auditLog.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F8FAF9] transition-colors">
                          <td className="px-5 py-1.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                              entry.action === 'grant'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                              {entry.action === 'grant' ? '+' : '−'} {entry.action}
                            </span>
                          </td>
                          <td className="px-5 py-1.5">
                            <p className="text-[#111827]">{permLabel(entry.permission)}</p>
                            <p className="text-[10px] text-[#9CA3AF] font-mono">{entry.permission}</p>
                          </td>
                          <td className="px-5 py-1.5 text-[#6B7280] text-xs font-mono">
                            {entry.changed_by ? entry.changed_by.slice(0, 8) + '…' : 'system'}
                          </td>
                          <td className="px-5 py-1.5 text-[#9CA3AF] text-xs">
                            {timeAgo(entry.changed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          </>)}

          {/* ── User Overrides view ── */}
          {navView === 'overrides' && (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">User Overrides</h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">Per-user permission grants and denials that override role defaults.</p>
                </div>
                <div className="relative max-w-xs w-full">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Filter by permission or user…"
                    value={overridesSearch}
                    onChange={(e) => setOverridesSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#E5EAE8] rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                  />
                </div>
              </div>

              {overridesError && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <span className="flex-1">Failed to load overrides: {overridesError}</span>
                  <button onClick={loadOverrides} className="font-semibold hover:underline">Retry</button>
                </div>
              )}

              {overridesLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-[#E5EAE8] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F3F4F6] bg-[#F8FAF9]">
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">User</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Permission</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Effect</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Org</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Scope</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Created</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {overrideRows
                        .filter((r) => {
                          const q = overridesSearch.toLowerCase();
                          return !q || r.permission.includes(q) || (r.user_email ?? '').toLowerCase().includes(q) || (r.user_name ?? '').toLowerCase().includes(q);
                        })
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-[#F8FAF9] transition-colors">
                            <td className="px-5 py-3">
                              <p className="text-sm font-medium text-[#111827]">{r.user_name ?? '—'}</p>
                              <p className="text-xs text-[#9CA3AF]">{r.user_email ?? r.user_id.slice(0, 8) + '…'}</p>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-[#374151]">{r.permission}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${r.effect === 'allow' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {r.effect}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-[#6B7280]">{r.org_name ?? '—'}</td>
                            <td className="px-5 py-3 text-xs text-[#9CA3AF]">{r.scope_location_id ? 'Location' : 'Global'}</td>
                            <td className="px-5 py-3 text-xs text-[#9CA3AF]">{timeAgo(r.created_at)}</td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => handleRevokeOverride(r.id)}
                                disabled={revokingId === r.id}
                                className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40"
                              >
                                {revokingId === r.id ? 'Revoking…' : 'Revoke'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      {overrideRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No user overrides found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Global Audit Log view ── */}
          {navView === 'audit' && (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Audit Log</h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">All permission grant and revoke actions across all roles.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[#6B7280]">Filter by role:</label>
                  <select
                    value={globalAuditRole}
                    onChange={(e) => setGlobalAuditRole(e.target.value)}
                    className="text-sm border border-[#E5EAE8] rounded-xl px-3 py-1.5 bg-white text-[#111827] focus:outline-none focus:border-[#0D4C3C]"
                  >
                    <option value="all">All roles</option>
                    {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {globalAuditError && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <span className="flex-1">Failed to load audit log: {globalAuditError}</span>
                  <button onClick={loadGlobalAudit} className="font-semibold hover:underline">Retry</button>
                </div>
              )}

              {globalAuditLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 bg-[#E5EAE8] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F3F4F6] bg-[#F8FAF9]">
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Role</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Permission</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Action</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Changed by</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {globalAudit.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F8FAF9] transition-colors">
                          <td className="px-5 py-3 text-xs font-semibold text-[#374151] capitalize">{entry.role}</td>
                          <td className="px-5 py-3 font-mono text-xs text-[#374151]">{entry.permission}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${entry.action === 'grant' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-[#9CA3AF] font-mono">
                            {entry.changed_by ? entry.changed_by.slice(0, 8) + '…' : 'system'}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#9CA3AF]">{timeAgo(entry.changed_at)}</td>
                        </tr>
                      ))}
                      {globalAudit.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No audit entries found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Permission Keys view ── */}
          {navView === 'keys' && (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Permission Keys</h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">All registered permission keys from the customer permissions registry.</p>
                </div>
                <div className="relative max-w-xs w-full">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Filter keys…"
                    value={permKeysSearch}
                    onChange={(e) => setPermKeysSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#E5EAE8] rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#0D4C3C]"
                  />
                </div>
              </div>

              {permKeysLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 bg-[#E5EAE8] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#E5EAE8] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F3F4F6] bg-[#F8FAF9]">
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Key</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Description</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {permKeys
                        .filter((k) => !permKeysSearch || k.key.includes(permKeysSearch.toLowerCase()) || (k.description ?? '').toLowerCase().includes(permKeysSearch.toLowerCase()))
                        .map((k) => (
                          <tr key={k.key} className="hover:bg-[#F8FAF9] transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-[#111827] font-semibold">{k.key}</td>
                            <td className="px-5 py-3 text-sm text-[#6B7280]">{k.description || <span className="text-[#9CA3AF] italic">No description</span>}</td>
                            <td className="px-5 py-3 text-xs text-[#9CA3AF]">{timeAgo(k.created_at)}</td>
                          </tr>
                        ))}
                      {permKeys.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No permission keys registered.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showPreview && (
        <SavePreviewModal
          role={selectedRole}
          toAdd={toAdd}
          toRemove={toRemove}
          saving={saving}
          error={saveError}
          onConfirm={executeSave}
          onCancel={() => { setShowPreview(false); setSaveError(null); }}
        />
      )}

      {showDiff && (
        <RoleDiffModal
          baseRole={selectedRole}
          compareRole={diffRole}
          onChangeCompare={setDiffRole}
          rolePerms={rolePerms}
          onClose={() => setShowDiff(false)}
        />
      )}
    </>
  );
}
