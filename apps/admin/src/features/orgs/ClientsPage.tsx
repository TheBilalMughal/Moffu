import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { Dropdown } from '@/components/Dropdown';
import { formatDate, formatId, refToSlug } from '@/lib/format';

interface Client {
  id: string;
  ref_id: string | null;
  name: string;
  logo_url: string | null;
  created_at: string;
  plan: string | null;
  plan_limit: number;
  plan_limit_unlimited: boolean;
  status: string | null;
  owner_email: string | null;
  member_count: number;
  usage: number;
}

const PLAN_COLOR: Record<string, string> = {
  free:       'bg-[#F3F4F6] text-[#374151]',
  starter:    'bg-[#EFF6FF] text-[#1D4ED8]',
  growth:     'bg-[#F0FDF4] text-[#15803D]',
  scale:      'bg-[#FFF7ED] text-[#C2410C]',
  pro:        'bg-[#F0FDF4] text-[#15803D]',
  enterprise: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_LIMIT: Record<string, number> = {
  free: 50, starter: 200, growth: 500, scale: 2000, pro: 500, enterprise: 2000,
};

function OrgAvatar({ name, logoUrl, size = 32 }: { name: string; logoUrl: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover flex-shrink-0 border border-[#E5E7EB]"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      className="rounded-lg bg-[#111827] text-white font-black flex items-center justify-center flex-shrink-0"
    >
      {initials}
    </div>
  );
}

// ── Slide-over panel ──────────────────────────────────────────────────────────

interface PanelProps {
  client: Client;
  initialEdit?: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<Client>) => void;
  onDeleted: (id: string) => void;
}

function ClientPanel({ client, initialEdit = false, onClose, onSaved, onDeleted }: PanelProps) {
  const [editing, setEditing] = useState(initialEdit);
  const [name, setName] = useState(client.name);
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${client.id}.${ext}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
      setLogoUrl(data.publicUrl + '?t=' + Date.now());
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('organizations').update({ name: name.trim(), logo_url: logoUrl }).eq('id', client.id);
    onSaved({ name: name.trim(), logo_url: logoUrl });
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from('organizations').delete().eq('id', client.id);
    onDeleted(client.id);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <OrgAvatar name={client.name} logoUrl={logoUrl} size={36} />
            <div>
              <p className="font-black text-[#111827] text-sm leading-tight">{client.name}</p>
              <p className="text-xs text-[#9CA3AF]">{formatId(client.ref_id)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#9CA3AF] hover:text-[#111827] rounded-lg hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Logo upload (edit mode only) */}
          {editing && (
            <div>
              <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Logo</p>
              <div className="flex items-center gap-4">
                <OrgAvatar name={name} logoUrl={logoUrl} size={56} />
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-xs font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : 'Upload logo'}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={() => setLogoUrl(null)}
                      className="ml-2 text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG, WebP or SVG · max 2 MB</p>
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">Organisation name</p>
            {editing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              <p className="text-sm font-medium text-[#111827]">{client.name}</p>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Plan', <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[client.plan ?? 'free']}`}>{client.plan ?? 'free'}</span>],
              ['Status', <span className={`text-xs font-semibold ${client.status === 'suspended' ? 'text-red-500' : 'text-green-600'}`}>{client.status ?? 'active'}</span>],
              ['Owner email', <span className="text-xs text-[#374151]">{client.owner_email ?? '—'}</span>],
              ['Members', <span className="text-xs text-[#374151]">{client.member_count}</span>],
              ['Usage', <span className="text-xs text-[#374151]">{client.usage} / {client.plan_limit_unlimited ? '∞' : client.plan_limit}</span>],
              ['Joined', <span className="text-xs text-[#374151]">{formatDate(client.created_at)}</span>],
            ].map(([label, val]) => (
              <div key={String(label)}>
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-1">{label as string}</p>
                {val as React.ReactNode}
              </div>
            ))}
          </div>

          {/* Full detail link */}
          {client.ref_id && (
            <Link
              to={`/clients/${refToSlug(client.ref_id)}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#111827] hover:underline"
              onClick={onClose}
            >
              Open full detail page
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {/* Delete zone */}
          <div className="border-t border-[#E5E7EB] pt-6">
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Danger zone</p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Delete organisation
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm font-black text-red-700 mb-1">Are you sure?</p>
                <p className="text-xs text-red-600 mb-4">This action cannot be undone. All data for this organisation will be permanently deleted.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs font-black text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs font-semibold text-[#374151] bg-white border border-[#E5E7EB] px-4 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (edit mode) */}
        {editing && (
          <div className="border-t border-[#E5E7EB] px-6 py-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 text-sm font-black text-white bg-[#111827] hover:bg-[#1f2937] px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => { setEditing(false); setName(client.name); setLogoUrl(client.logo_url); }}
              className="text-sm font-semibold text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-4 py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [panel, setPanel] = useState<{ client: Client; editMode: boolean } | null>(null);

  async function load() {
    setLoading(true);

    const { data: orgRows, error: orgErr } = await supabase
      .from('organizations')
      .select('id, ref_id, name, logo_url, created_at, status')
      .order('created_at', { ascending: false });

    if (orgErr || !orgRows || orgRows.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const orgIds = orgRows.map((o: { id: string }) => o.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: memberRows } = await supabase
      .from('org_members')
      .select('org_id, user_id, role')
      .in('org_id', orgIds);

    const memberCountByOrg = new Map<string, number>();
    const userToOrg = new Map<string, string>();
    const ownerUserIdByOrg = new Map<string, string>();

    (memberRows ?? []).forEach((m: { org_id: string; user_id: string; role: string }) => {
      memberCountByOrg.set(m.org_id, (memberCountByOrg.get(m.org_id) ?? 0) + 1);
      if (!userToOrg.has(m.user_id)) userToOrg.set(m.user_id, m.org_id);
      if (m.role === 'owner') ownerUserIdByOrg.set(m.org_id, m.user_id);
    });

    const ownerIds = [...new Set(ownerUserIdByOrg.values())];
    const allMemberIds = [...userToOrg.keys()];

    const [plansRes, subsRes, emailRes, usageRes, overridesRes] = await Promise.all([
      supabase.from('plans').select('id, slug'),
      ownerIds.length > 0
        ? supabase.from('subscriptions').select('user_id, plan_id, status').in('user_id', ownerIds)
        : Promise.resolve({ data: [] }),
      ownerIds.length > 0
        ? supabase.rpc('get_users_email', { user_ids: ownerIds })
        : Promise.resolve({ data: [] }),
      allMemberIds.length > 0
        ? supabase.from('usage_events').select('user_id').in('user_id', allMemberIds).eq('event_type', 'ai_draft').gte('created_at', monthStart)
        : Promise.resolve({ data: [] }),
      supabase.from('org_plan_overrides').select('org_id, ai_drafts_per_month').in('org_id', orgIds),
    ]);

    const planSlugById = new Map<string, string>(
      (plansRes.data ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]),
    );
    const overrideByOrg = new Map<string, { ai_drafts_per_month: number | null }>(
      (overridesRes.data ?? []).map((o: { org_id: string; ai_drafts_per_month: number | null }) => [o.org_id, o]),
    );
    const subByOwner = new Map<string, { plan: string; status: string }>();
    (subsRes.data ?? []).forEach((s: { user_id: string; plan_id: string; status: string }) => {
      subByOwner.set(s.user_id, { plan: planSlugById.get(s.plan_id) ?? 'free', status: s.status });
    });
    const emailByUser = new Map<string, string>(
      (emailRes.data ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]),
    );
    const usageByOrg = new Map<string, number>();
    (usageRes.data ?? []).forEach((r: { user_id: string }) => {
      const orgId = userToOrg.get(r.user_id);
      if (orgId) usageByOrg.set(orgId, (usageByOrg.get(orgId) ?? 0) + 1);
    });

    const enriched: Client[] = orgRows.map((o: { id: string; ref_id: string | null; name: string; logo_url: string | null; created_at: string; status: string | null }) => {
      const ownerUserId = ownerUserIdByOrg.get(o.id);
      const sub = ownerUserId ? subByOwner.get(ownerUserId) : null;
      const plan = sub?.plan ?? 'free';
      const ov = overrideByOrg.get(o.id);
      let planLimit = PLAN_LIMIT[plan] ?? 50;
      let planLimitUnlimited = false;
      if (ov?.ai_drafts_per_month === -1) { planLimitUnlimited = true; }
      else if (ov?.ai_drafts_per_month != null) { planLimit = ov.ai_drafts_per_month; }
      return {
        id: o.id,
        ref_id: o.ref_id ?? null,
        name: o.name,
        logo_url: o.logo_url ?? null,
        created_at: o.created_at,
        plan,
        plan_limit: planLimit,
        plan_limit_unlimited: planLimitUnlimited,
        status: o.status ?? null,
        owner_email: ownerUserId ? (emailByUser.get(ownerUserId) ?? null) : null,
        member_count: memberCountByOrg.get(o.id) ?? 0,
        usage: usageByOrg.get(o.id) ?? 0,
      };
    });

    setClients(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handlePanelSaved(id: string, updated: Partial<Client>) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    setPanel(prev => prev ? { ...prev, client: { ...prev.client, ...updated } } : null);
  }

  function handlePanelDeleted(id: string) {
    setClients(prev => prev.filter(c => c.id !== id));
    setPanel(null);
  }

  const filtered = clients.filter((c) => {
    const matchSearch =
      search.trim() === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.owner_email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || c.plan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#111827]">Clients</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{clients.length} clients on the platform.</p>
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search clients or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm shadow-sm rounded-xl bg-white text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827]"
          />
        </div>
        <Dropdown
          clearable
          placeholder="All plans"
          value={planFilter === 'all' ? '' : planFilter}
          onChange={(v) => setPlanFilter(v === '' ? 'all' : v)}
          options={[
            { value: 'free',    label: 'Free'    },
            { value: 'starter', label: 'Starter' },
            { value: 'growth',  label: 'Growth'  },
            { value: 'scale',   label: 'Scale'   },
          ]}
        />
      </div>

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 px-8 py-4">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAF9] border-b border-[#E5EAE8] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">ID</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Plan</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Members</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Created</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Usage</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-1.5">
                          <div className="h-3.5 bg-[#E5EAE8] rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                      {search || planFilter !== 'all' ? 'No clients match your filters.' : 'No clients yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8FAF9] transition-colors">
                      <td className="px-5 py-2.5">
                        <span className="font-mono text-xs text-[#6B7280]">{formatId(c.ref_id)}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <OrgAvatar name={c.name} logoUrl={c.logo_url} size={28} />
                          <span className="font-medium text-[#111827]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-[#374151] text-xs">{c.owner_email ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${PLAN_COLOR[c.plan ?? 'free'] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                          {c.plan ?? 'free'}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-[#374151]">{c.member_count}</td>
                      <td className="px-5 py-2.5 text-[#9CA3AF] text-xs">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-[#374151]">{c.usage}</span>
                          <span className="text-xs text-[#9CA3AF]">/ {c.plan_limit_unlimited ? '∞' : c.plan_limit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setPanel({ client: c, editMode: false })}
                            className="text-xs font-medium text-[#111827] hover:underline"
                          >
                            View
                          </button>
                          <span className="text-[#E5EAE8]">|</span>
                          <button
                            onClick={() => setPanel({ client: c, editMode: true })}
                            className="text-xs font-medium text-[#111827] hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-[#E5EAE8]">|</span>
                          <button
                            onClick={() => setPanel({ client: c, editMode: false })}
                            className="text-xs font-medium text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over */}
      {panel && (
        <ClientPanel
          client={panel.client}
          initialEdit={panel.editMode}
          onClose={() => setPanel(null)}
          onSaved={(updated) => handlePanelSaved(panel.client.id, updated)}
          onDeleted={handlePanelDeleted}
        />
      )}
    </div>
  );
}
