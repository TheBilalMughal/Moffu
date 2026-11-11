import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface TeamMember {
  id: string;
  name: string;
  designation: string;
  image_url: string | null;
  linkedin_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

function MemberAvatar({ name, imageUrl, size = 32 }: { name: string; imageUrl: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-xl object-cover flex-shrink-0 border border-[#E5E7EB]"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      className="rounded-xl bg-[#6C55E8] text-white font-black flex items-center justify-center flex-shrink-0 select-none"
    >
      {initials}
    </div>
  );
}

// ── Add / Edit slide-over ──────────────────────────────────────────────────

interface PanelProps {
  member: TeamMember | null;
  onClose: () => void;
  onSaved: (member: TeamMember) => void;
  onDeleted?: (id: string) => void;
}

function MemberPanel({ member, onClose, onSaved, onDeleted }: PanelProps) {
  const isAdd = member === null;
  const [editing, setEditing] = useState(isAdd);
  const [name, setName] = useState(member?.name ?? '');
  const [designation, setDesignation] = useState(member?.designation ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(member?.linkedin_url ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(member?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { success: toastSuccess, error: toastError } = useToastStore();

  async function handleImageUpload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `team/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (error) {
      toastError('Upload failed: ' + error.message);
    } else {
      const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
      setImageUrl(data.publicUrl + '?t=' + Date.now());
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!name.trim() || !designation.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      designation: designation.trim(),
      linkedin_url: linkedinUrl.trim() || null,
      image_url: imageUrl,
    };
    if (isAdd) {
      const { data, error } = await supabase
        .from('team_members')
        .insert(payload)
        .select()
        .single();
      if (error) { toastError('Save failed: ' + error.message); }
      else { toastSuccess('Team member added'); onSaved(data as TeamMember); }
    } else {
      const { data, error } = await supabase
        .from('team_members')
        .update(payload)
        .eq('id', member!.id)
        .select()
        .single();
      if (error) { toastError('Save failed: ' + error.message); }
      else { toastSuccess('Team member updated'); onSaved(data as TeamMember); setEditing(false); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('team_members').delete().eq('id', member!.id);
    if (error) { toastError('Delete failed: ' + error.message); }
    else { toastSuccess('Team member removed'); onDeleted?.(member!.id); }
    setDeleting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            {!isAdd && <MemberAvatar name={member!.name} imageUrl={imageUrl} size={32} />}
            <p className="font-black text-[#111827] text-sm">
              {isAdd ? 'Add team member' : editing ? 'Edit member' : member!.name}
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

          {/* Photo */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Photo</p>
            <div className="flex items-center gap-4">
              <MemberAvatar name={name || 'AB'} imageUrl={imageUrl} size={56} />
              {editing ? (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-xs font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : 'Upload photo'}
                  </button>
                  {imageUrl && (
                    <button onClick={() => setImageUrl(null)} className="ml-2 text-xs text-red-500 hover:underline">Remove</button>
                  )}
                  <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG or WebP · max 2 MB</p>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">{imageUrl ? 'Photo uploaded' : 'No photo — showing initials'}</p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">Full name</p>
            {editing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ahmed Khan"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              <p className="text-sm font-medium text-[#111827]">{member!.name}</p>
            )}
          </div>

          {/* Designation */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">Designation</p>
            {editing ? (
              <input
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="e.g. Co-Founder & CEO"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              <p className="text-sm text-[#374151]">{member!.designation}</p>
            )}
          </div>

          {/* LinkedIn */}
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-2">LinkedIn URL</p>
            {editing ? (
              <input
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#111827] transition-colors"
              />
            ) : (
              member!.linkedin_url ? (
                <a href={member!.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6C55E8] hover:underline break-all">
                  {member!.linkedin_url}
                </a>
              ) : (
                <p className="text-sm text-[#9CA3AF]">Not set</p>
              )
            )}
          </div>

          {/* Delete zone */}
          {!isAdd && editing && (
            <div className="border-t border-[#E5E7EB] pt-6">
              <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Danger zone</p>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Remove member
                </button>
              ) : (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm font-black text-red-700 mb-1">Remove from team page?</p>
                  <p className="text-xs text-red-600 mb-4">This person will no longer appear on the public team page.</p>
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
              disabled={saving || !name.trim() || !designation.trim()}
              className="flex-1 text-sm font-black text-white bg-[#111111] hover:bg-[#6C55E8] px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isAdd ? 'Add member' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                if (isAdd) { onClose(); }
                else {
                  setEditing(false);
                  setName(member!.name);
                  setDesignation(member!.designation);
                  setLinkedinUrl(member!.linkedin_url ?? '');
                  setImageUrl(member!.image_url ?? null);
                }
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

// ── Main page ──────────────────────────────────────────────────────────────

export function WebsiteTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<{ member: TeamMember | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { success: toastSuccess, error: toastError } = useToastStore();

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setMembers((data ?? []) as TeamMember[]);
    setLoading(false);
  }

  async function handleDirectDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('team_members').delete().eq('id', deleteTarget.id);
    if (error) { toastError('Delete failed: ' + error.message); }
    else { toastSuccess('Member removed'); setMembers(prev => prev.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null); }
    setDeleting(false);
  }

  async function toggleActive(member: TeamMember) {
    const { error } = await supabase
      .from('team_members')
      .update({ is_active: !member.is_active })
      .eq('id', member.id);
    if (error) { toastError('Update failed: ' + error.message); }
    else {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m));
      toastSuccess(member.is_active ? 'Member hidden' : 'Member shown');
    }
  }

  useEffect(() => { load(); }, []);

  function handleSaved(saved: TeamMember) {
    setMembers(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    if (panel?.member === null) setPanel(null);
    else setPanel({ member: saved });
  }

  function handleDeleted(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id));
    setPanel(null);
  }

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Team Members</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">
            People shown on the public team page at moffu.pro/team.
          </p>
        </div>
        <button
          onClick={() => setPanel({ member: null })}
          className="flex items-center gap-2 text-sm font-black text-white bg-[#111111] hover:bg-[#6C55E8] px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add member
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAF7] border-b border-[#E5E7EB]">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Member</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Designation</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">LinkedIn</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-3.5 bg-[#E5E7EB] rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <p className="text-sm text-[#9CA3AF] mb-3">No team members added yet.</p>
                  <button
                    onClick={() => setPanel({ member: null })}
                    className="text-sm font-semibold text-[#6C55E8] hover:underline"
                  >
                    Add your first member →
                  </button>
                </td>
              </tr>
            ) : (
              members.map(m => (
                <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar name={m.name} imageUrl={m.image_url} size={28} />
                      <span className="font-medium text-[#111827]">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#6B7280] text-xs">{m.designation}</td>
                  <td className="px-5 py-3">
                    {m.linkedin_url ? (
                      <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6C55E8] hover:underline truncate max-w-[140px] block">
                        linkedin.com/in/…
                      </a>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">Not set</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(m)}
                      className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                        m.is_active
                          ? 'text-[#0369A1] bg-[#E0F2FE] hover:bg-[#BAE6FD]'
                          : 'text-[#9CA3AF] bg-[#F3F4F6] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {m.is_active ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setPanel({ member: m })}
                        className="text-xs font-medium text-[#111827] hover:underline"
                      >
                        Edit
                      </button>
                      <span className="text-[#E5E7EB]">|</span>
                      <button
                        onClick={() => setDeleteTarget(m)}
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

      {members.length > 0 && (
        <p className="text-xs text-[#9CA3AF] mt-4">
          {members.filter(m => m.is_active).length} of {members.length} member{members.length !== 1 ? 's' : ''} visible on team page
        </p>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black text-[#111827]">Remove member?</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    <span className="font-medium text-[#111827]">{deleteTarget.name}</span> will be permanently deleted.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDirectDelete}
                  disabled={deleting}
                  className="flex-1 text-sm font-black text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 text-sm font-semibold text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-4 py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Panel */}
      {panel !== null && (
        <MemberPanel
          member={panel.member}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
