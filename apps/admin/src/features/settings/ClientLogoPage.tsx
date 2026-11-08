import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface MarketingClient {
  id: string;
  name: string;
  client_type: string | null;
  logo_url: string | null;
  sort_order: number;
  created_at: string;
}

function ClientAvatar({ name, logoUrl, size = 32 }: { name: string; logoUrl: string | null; size?: number }) {
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
      className="rounded-lg bg-[#111827] text-white font-black flex items-center justify-center flex-shrink-0 select-none"
    >
      {initials}
    </div>
  );
}

// ── Add / Edit slide-over ─────────────────────────────────────────────────

interface PanelProps {
  client: MarketingClient | null; // null = add mode
  onClose: () => void;
  onSaved: (client: MarketingClient) => void;
  onDeleted?: (id: string) => void;
}

function ClientPanel({ client, onClose, onSaved, onDeleted }: PanelProps) {
  const isAdd = client === null;
  const [editing, setEditing] = useState(isAdd);
  const [name, setName] = useState(client?.name ?? '');
  const [clientType, setClientType] = useState(client?.client_type ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(client?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { success: toastSuccess, error: toastError } = useToastStore();

  async function handleLogoUpload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `marketing/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (error) {
      toastError('Upload failed: ' + error.message);
    } else {
      const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
      setLogoUrl(data.publicUrl + '?t=' + Date.now());
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (isAdd) {
      const { data, error } = await supabase
        .from('marketing_clients')
        .insert({ name: name.trim(), client_type: clientType.trim() || null, logo_url: logoUrl })
        .select()
        .single();
      if (error) { toastError('Save failed: ' + error.message); }
      else { toastSuccess('Client added'); onSaved(data as MarketingClient); }
    } else {
      const { data, error } = await supabase
        .from('marketing_clients')
        .update({ name: name.trim(), client_type: clientType.trim() || null, logo_url: logoUrl })
        .eq('id', client!.id)
        .select()
        .single();
      if (error) { toastError('Save failed: ' + error.message); }
      else { toastSuccess('Client updated'); onSaved(data as MarketingClient); setEditing(false); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('marketing_clients').delete().eq('id', client!.id);
    if (error) { toastError('Delete failed: ' + error.message); }
    else { toastSuccess('Client removed'); onDeleted?.(client!.id); }
    setDeleting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            {!isAdd && <ClientAvatar name={client!.name} logoUrl={logoUrl} size={32} />}
            <p className="font-black text-[#111827] text-sm">
              {isAdd ? 'Add client logo' : editing ? 'Edit client' : client!.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isAdd && !editing && (
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

          {/* Logo */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Logo</p>
            <div className="flex items-center gap-4">
              <ClientAvatar name={name || 'AB'} logoUrl={logoUrl} size={56} />
              {editing ? (
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
                    <button onClick={() => setLogoUrl(null)} className="ml-2 text-xs text-red-500 hover:underline">Remove</button>
                  )}
                  <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG, WebP or SVG · max 2 MB</p>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">{logoUrl ? 'Logo uploaded' : 'No logo — showing initials'}</p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">Business name</p>
            {editing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Brewed Awakening"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              <p className="text-sm font-medium text-[#111827]">{client!.name}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">Business type</p>
            {editing ? (
              <input
                value={clientType}
                onChange={e => setClientType(e.target.value)}
                placeholder="e.g. Coffee Co."
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              <p className="text-sm text-[#374151]">{client!.client_type ?? '—'}</p>
            )}
          </div>

          {/* Delete zone (edit mode, existing clients only) */}
          {!isAdd && editing && (
            <div className="border-t border-[#E5E7EB] pt-6">
              <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Danger zone</p>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Remove client
                </button>
              ) : (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm font-black text-red-700 mb-1">Remove from homepage?</p>
                  <p className="text-xs text-red-600 mb-4">This client will no longer appear in the &quot;who&apos;s already on it&quot; section.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} disabled={deleting} className="text-xs font-black text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                      {deleting ? 'Removing…' : 'Yes, remove'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs font-semibold text-[#374151] bg-white border border-[#E5E7EB] px-4 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div className="border-t border-[#E5E7EB] px-6 py-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 text-sm font-black text-white bg-[#111111] hover:bg-[#6C55E8] px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isAdd ? 'Add client' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                if (isAdd) { onClose(); }
                else { setEditing(false); setName(client!.name); setClientType(client!.client_type ?? ''); setLogoUrl(client!.logo_url ?? null); }
              }}
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

// ── Main page ─────────────────────────────────────────────────────────────

const SPEED_PRESETS = [
  { label: 'Slow',      seconds: 20 },
  { label: 'Normal',    seconds: 12 },
  { label: 'Fast',      seconds: 8  },
  { label: 'Very Fast', seconds: 5  },
];

export function ClientLogoPage() {
  const [clients, setClients] = useState<MarketingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<{ client: MarketingClient | null } | null>(null);
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(8);
  const [savingSpeed, setSavingSpeed] = useState(false);
  const { success: toastSuccess, error: toastError } = useToastStore();

  async function load() {
    setLoading(true);
    const [clientsRes, speedRes] = await Promise.all([
      supabase
        .from('marketing_clients')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'marquee_speed_seconds')
        .single(),
    ]);
    setClients((clientsRes.data ?? []) as MarketingClient[]);
    if (speedRes.data?.value) setMarqueeSpeed(Number(speedRes.data.value));
    setLoading(false);
  }

  async function handleSpeedSave(seconds: number) {
    setSavingSpeed(true);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'marquee_speed_seconds', value: String(seconds) }, { onConflict: 'key' });
    if (error) { toastError('Failed to save speed: ' + error.message); }
    else { setMarqueeSpeed(seconds); toastSuccess('Marquee speed updated'); }
    setSavingSpeed(false);
  }

  useEffect(() => { load(); }, []);

  function handleSaved(saved: MarketingClient) {
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    if (panel?.client === null) setPanel(null); // close after add
    else setPanel({ client: saved }); // stay open in view mode after edit
  }

  function handleDeleted(id: string) {
    setClients(prev => prev.filter(c => c.id !== id));
    setPanel(null);
  }

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Client Logos</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Businesses shown in the &quot;who&apos;s already on it&quot; section of the homepage.
          </p>
        </div>
        <button
          onClick={() => setPanel({ client: null })}
          className="flex items-center gap-2 text-sm font-black text-white bg-[#111111] hover:bg-[#6C55E8] px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add client logo
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAF7] border-b border-[#E5E7EB]">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Logo</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-3.5 bg-[#E5E7EB] rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <p className="text-sm text-[#9CA3AF] mb-3">No clients added yet.</p>
                  <button
                    onClick={() => setPanel({ client: null })}
                    className="text-sm font-semibold text-[#6C55E8] hover:underline"
                  >
                    Add your first client →
                  </button>
                </td>
              </tr>
            ) : (
              clients.map(c => (
                <tr key={c.id} className="hover:bg-[#FAFAF7] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <ClientAvatar name={c.name} logoUrl={c.logo_url} size={28} />
                      <span className="font-medium text-[#111827]">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#6B7280] text-xs">{c.client_type ?? '—'}</td>
                  <td className="px-5 py-3">
                    {c.logo_url ? (
                      <span className="text-xs font-medium text-[#0369A1] bg-[#E0F2FE] px-2 py-0.5 rounded">Uploaded</span>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">Initials only</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setPanel({ client: c })}
                        className="text-xs font-medium text-[#111827] hover:underline"
                      >
                        View
                      </button>
                      <span className="text-[#E5E7EB]">|</span>
                      <button
                        onClick={() => setPanel({ client: c })}
                        className="text-xs font-medium text-[#111827] hover:underline"
                      >
                        Edit
                      </button>
                      <span className="text-[#E5E7EB]">|</span>
                      <button
                        onClick={() => { setPanel({ client: c }); }}
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

      {clients.length > 0 && (
        <p className="text-xs text-[#9CA3AF] mt-4">
          {clients.length} client{clients.length !== 1 ? 's' : ''} · shown in marquee order on homepage
        </p>
      )}

      {/* Marquee Speed */}
      <div className="mt-10 bg-white rounded-xl border border-[#E5E7EB] px-6 py-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#111827]">Marquee speed</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">Controls how fast logos scroll on the homepage.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {SPEED_PRESETS.map(({ label, seconds }) => {
            const active = marqueeSpeed === seconds;
            return (
              <button
                key={seconds}
                onClick={() => handleSpeedSave(seconds)}
                disabled={savingSpeed}
                className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-[#111111] text-white'
                    : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-3">
          Current: {marqueeSpeed}s per loop
        </p>
      </div>

      {/* Panel */}
      {panel !== null && (
        <ClientPanel
          client={panel.client}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

