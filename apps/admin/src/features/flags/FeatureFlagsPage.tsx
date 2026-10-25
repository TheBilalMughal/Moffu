import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { formatDate } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled_globally: boolean;
  rollout_pct: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface OrgOverride {
  id: string;
  org_id: string;
  flag_id: string;
  enabled: boolean;
  set_at: string;
}

interface OrgRow { id: string; name: string; ref_id: string }

function canManage(role: string | null) {
  return ['super_admin', 'admin'].includes(role ?? '');
}

// ── Rollout slider ─────────────────────────────────────────────────────────────

function RolloutSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={0} max={100} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-[#0D4C3C] h-1.5 disabled:opacity-50" />
      <span className="text-xs font-semibold text-[#374151] w-8 text-right tabular-nums">{value}%</span>
    </div>
  );
}

// ── Create flag modal ──────────────────────────────────────────────────────────

function CreateFlagModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [tags,        setTags]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');

  async function save() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!slug) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('feature_flags').insert({
      name: slug,
      description: description.trim() || null,
      enabled_globally: false,
      rollout_pct: 0,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111827]">New Feature Flag</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Flag Name <span className="text-[#9CA3AF]">(slug)</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. new_feature_xyz"
              className="w-full px-3 py-2 text-sm font-mono border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30 text-[#111827]" />
            {name && <p className="text-[10px] text-[#9CA3AF] mt-1">Slug: {name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this flag control?"
              className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30 text-[#111827]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Tags <span className="text-[#9CA3AF]">(comma separated)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="ui, beta, ai"
              className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30 text-[#111827]" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-[#0D4C3C] rounded-lg hover:bg-[#0a3d30] transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Org override row ───────────────────────────────────────────────────────────

function OrgOverrideRow({ override, orgs, onRemove, canEdit }: {
  override: OrgOverride; orgs: OrgRow[]; onRemove: (id: string) => void; canEdit: boolean;
}) {
  const org = orgs.find(o => o.id === override.org_id);
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm">
      <div className="w-6 h-6 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {(org?.name ?? '?')[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#111827] truncate">{org?.name ?? override.org_id.slice(0, 8)}</p>
        <p className="text-[10px] text-[#9CA3AF]">Set {formatDate(override.set_at)}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${override.enabled ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
        {override.enabled ? 'Enabled' : 'Disabled'}
      </span>
      {canEdit && (
        <button onClick={() => onRemove(override.id)}
          className="text-[#9CA3AF] hover:text-red-500 transition-colors ml-1" title="Remove override">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      )}
    </div>
  );
}

// ── Flag row ───────────────────────────────────────────────────────────────────

function FlagRow({ flag, orgs, overrides, canEdit, onUpdate, onDelete }: {
  flag: FeatureFlag;
  orgs: OrgRow[];
  overrides: OrgOverride[];
  canEdit: boolean;
  onUpdate: (id: string, patch: Partial<FeatureFlag>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [addingOrg,   setAddingOrg]   = useState(false);
  const [newOrgId,    setNewOrgId]    = useState('');
  const [newEnabled,  setNewEnabled]  = useState(true);
  const [localPct,    setLocalPct]    = useState(flag.rollout_pct);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const flagOverrides = overrides.filter(o => o.flag_id === flag.id);

  function handleToggle() { onUpdate(flag.id, { enabled_globally: !flag.enabled_globally }); }

  function handlePctChange(v: number) {
    setLocalPct(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(flag.id, { rollout_pct: v }), 600);
  }

  async function addOrgOverride() {
    if (!newOrgId.trim()) return;
    await supabase.from('org_feature_flags').upsert({ org_id: newOrgId.trim(), flag_id: flag.id, enabled: newEnabled });
    setAddingOrg(false); setNewOrgId('');
  }

  async function removeOrgOverride(overrideId: string) {
    await supabase.from('org_feature_flags').delete().eq('id', overrideId);
    onUpdate(flag.id, {}); // trigger reload
  }

  return (
    <>
      <tr className={`hover:bg-[#FAFFFE] transition-colors ${expanded ? 'bg-[#FAFFFE]' : ''}`}>
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setExpanded(e => !e)}
              className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <div>
              <p className="text-sm font-mono font-medium text-[#111827]">{flag.name}</p>
              {flag.description && <p className="text-xs text-[#6B7280] mt-0.5">{flag.description}</p>}
            </div>
          </div>
        </td>
        <td className="px-5 py-4">
          <div className="flex flex-wrap gap-1">
            {flag.tags.map(t => (
              <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#374151]">{t}</span>
            ))}
          </div>
        </td>
        <td className="px-5 py-4">
          <button onClick={() => canEdit && handleToggle()}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none ${flag.enabled_globally ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'} ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-60'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${flag.enabled_globally ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </td>
        <td className="px-5 py-4 w-48">
          <RolloutSlider value={localPct} onChange={handlePctChange} disabled={!canEdit || !flag.enabled_globally} />
        </td>
        <td className="px-5 py-4">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${flagOverrides.length > 0 ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
            {flagOverrides.length}
          </span>
        </td>
        <td className="px-5 py-4 text-xs text-[#6B7280]">{formatDate(flag.updated_at)}</td>
        <td className="px-5 py-4">
          {canEdit && (
            <button onClick={() => { if (window.confirm(`Delete flag "${flag.name}"?`)) onDelete(flag.id); }}
              className="text-[#9CA3AF] hover:text-red-500 transition-colors" title="Delete flag">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="bg-[#F8FAF9] px-5 py-4 border-b border-[#E5EAE8]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Org Overrides</p>
              {canEdit && (
                <button onClick={() => setAddingOrg(a => !a)}
                  className="text-xs font-medium text-[#0D4C3C] hover:underline flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                  Add Override
                </button>
              )}
            </div>

            {addingOrg && (
              <div className="flex items-center gap-2 mb-3 bg-white rounded-lg px-4 py-3 shadow-sm">
                <input value={newOrgId} onChange={e => setNewOrgId(e.target.value)} placeholder="Org UUID"
                  className="flex-1 text-xs font-mono border border-[#E5EAE8] rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30" />
                <button
                  onClick={() => setNewEnabled(e => !e)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${newEnabled ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${newEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-[#374151] w-14">{newEnabled ? 'Enable' : 'Disable'}</span>
                <button onClick={addOrgOverride}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#0D4C3C] rounded-lg hover:bg-[#0a3d30] transition-colors">
                  Save
                </button>
                <button onClick={() => { setAddingOrg(false); setNewOrgId(''); }}
                  className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            {flagOverrides.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">No org overrides — global setting applies to all.</p>
            ) : (
              <div className="space-y-2">
                {flagOverrides.map(o => (
                  <OrgOverrideRow key={o.id} override={o} orgs={orgs} onRemove={removeOrgOverride} canEdit={canEdit} />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function FeatureFlagsPage() {
  const { platformRole } = useAdminAuthStore();
  const [flags,     setFlags]     = useState<FeatureFlag[]>([]);
  const [overrides, setOverrides] = useState<OrgOverride[]>([]);
  const [orgs,      setOrgs]      = useState<OrgRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const [flagsRes, overridesRes, orgsRes] = await Promise.all([
      supabase.from('feature_flags').select('*').order('name'),
      supabase.from('org_feature_flags').select('*'),
      supabase.from('organizations').select('id, name, ref_id').order('name'),
    ]);
    setFlags((flagsRes.data ?? []) as FeatureFlag[]);
    setOverrides((overridesRes.data ?? []) as OrgOverride[]);
    setOrgs((orgsRes.data ?? []) as OrgRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateFlag(id: string, patch: Partial<FeatureFlag>) {
    if (Object.keys(patch).length > 0) {
      await supabase.from('feature_flags').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    }
    load();
  }

  async function deleteFlag(id: string) {
    await supabase.from('feature_flags').delete().eq('id', id);
    setFlags(f => f.filter(x => x.id !== id));
  }

  // All unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    flags.forEach(f => f.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [flags]);

  const filtered = useMemo(() => {
    return flags.filter(f => {
      if (search && !f.name.includes(search.toLowerCase()) && !(f.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
      if (tagFilter !== 'all' && !f.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [flags, search, tagFilter]);

  const enabledCount = flags.filter(f => f.enabled_globally).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showCreate && <CreateFlagModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Feature Flags</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{flags.length} flags · {enabledCount} globally enabled</p>
          </div>
          {canManage(platformRole) && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D4C3C] rounded-lg hover:bg-[#0a3d30] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Flag
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm rounded-xl flex-1 max-w-xs">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flags…"
              className="flex-1 text-sm text-[#111827] placeholder-[#9CA3AF] bg-transparent focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTagFilter('all')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tagFilter === 'all' ? 'bg-[#0D4C3C] text-white' : 'bg-white shadow-sm text-[#374151] hover:bg-[#F3F4F6]'}`}>
              All
            </button>
            {allTags.map(t => (
              <button key={t} onClick={() => setTagFilter(t === tagFilter ? 'all' : t)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tagFilter === t ? 'bg-[#0D4C3C] text-white' : 'bg-white shadow-sm text-[#374151] hover:bg-[#F3F4F6]'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                {['Flag', 'Tags', 'Global', 'Rollout %', 'Org Overrides', 'Updated', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No feature flags found.</td></tr>
              ) : filtered.map(flag => (
                <FlagRow key={flag.id} flag={flag} orgs={orgs} overrides={overrides}
                  canEdit={canManage(platformRole)} onUpdate={updateFlag} onDelete={deleteFlag} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
