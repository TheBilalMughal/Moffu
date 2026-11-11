import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface InstagramPost {
  id: string;
  title: string | null;
  handle: string;
  post_url: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const BUCKET = 'org-logos';

function InstagramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const EMPTY: Omit<InstagramPost, 'id' | 'created_at'> = {
  title: '',
  handle: '',
  post_url: '',
  thumbnail_url: null,
  is_active: true,
  sort_order: 0,
};

export function InstagramPostsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<InstagramPost | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('instagram_posts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setPosts((data ?? []) as InstagramPost[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: posts.length });
    setPanelOpen(true);
  }

  function openEdit(p: InstagramPost) {
    setEditing(p);
    setForm({
      title: p.title ?? '',
      handle: p.handle,
      post_url: p.post_url,
      thumbnail_url: p.thumbnail_url,
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
  }

  async function uploadThumb(file: File) {
    setUploadingThumb(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `instagram/thumb-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setForm(f => ({ ...f, thumbnail_url: urlData.publicUrl }));
    } catch {
      alert('Upload failed');
    } finally {
      setUploadingThumb(false);
    }
  }

  async function save() {
    if (!form.handle.trim() || !form.post_url.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title?.trim() || null,
      handle: form.handle.trim(),
      post_url: form.post_url.trim(),
      thumbnail_url: form.thumbnail_url || null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order),
    };
    if (editing) {
      await supabase.from('instagram_posts').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('instagram_posts').insert(payload);
    }
    setSaving(false);
    closePanel();
    load();
  }

  async function toggleActive(p: InstagramPost) {
    await supabase.from('instagram_posts').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  }

  async function deletePost(id: string) {
    setDeleting(id);
    await supabase.from('instagram_posts').delete().eq('id', id);
    setDeleting(null);
    load();
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#111827]">Social Posts</h1>
          </div>
          <p className="text-sm text-[#6B7280]">
            Manage videos and posts shown on the marketing website. Supports YouTube and Instagram links.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-[#6C55E8] hover:bg-[#5A42D1] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Post
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-[#9CA3AF]">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-16 text-center">
          <svg className="w-8 h-8 text-[#D1D5DB] mx-auto" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <p className="mt-3 text-sm font-medium text-[#6B7280]">No posts yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Add a YouTube or Instagram link to show on the website.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => (
            <div key={p.id} className={`bg-white border rounded-xl overflow-hidden transition-opacity ${p.is_active ? 'border-[#E5E7EB]' : 'border-[#E5E7EB] opacity-50'}`}>
              {/* Thumbnail */}
              <div className="aspect-[9/16] bg-[#F3F4F6] relative overflow-hidden">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title ?? p.handle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F3F4F6]">
                    <svg className="w-8 h-8 text-[#D1D5DB]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
                {/* Badge */}
                <div className="absolute top-2 left-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                    {p.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <p className="text-xs font-semibold text-[#6C55E8]">@{p.handle.replace(/^@/, '')}</p>
                {p.title && <p className="text-sm font-medium text-[#111827] mt-0.5 truncate">{p.title}</p>}
                <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#9CA3AF] hover:text-[#6C55E8] truncate block mt-1">
                  {p.post_url}
                </a>
                <div className="flex items-center gap-2 mt-4">
                  <button onClick={() => openEdit(p)} className="flex-1 text-xs font-semibold text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded-lg py-1.5 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => toggleActive(p)} className="flex-1 text-xs font-semibold text-[#6B7280] hover:text-[#111827] border border-[#E5E7EB] rounded-lg py-1.5 transition-colors">
                    {p.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this post?')) deletePost(p.id); }}
                    disabled={deleting === p.id}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-100 rounded-lg py-1.5 px-3 transition-colors"
                  >
                    {deleting === p.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={closePanel} />
          <div className="relative ml-auto w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
              <h2 className="text-base font-bold text-[#111827]">{editing ? 'Edit Post' : 'Add Post'}</h2>
              <button onClick={closePanel} className="text-[#9CA3AF] hover:text-[#111827]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 px-6 py-6 space-y-5">
              {/* Thumbnail */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">Thumbnail</label>
                <div
                  className="aspect-[9/16] max-h-64 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#6C55E8] transition-colors overflow-hidden relative"
                  onClick={() => thumbInputRef.current?.click()}
                >
                  {form.thumbnail_url ? (
                    <img src={form.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-[#D1D5DB] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-[#9CA3AF]">{uploadingThumb ? 'Uploading...' : 'Click to upload thumbnail'}</p>
                    </>
                  )}
                </div>
                <input ref={thumbInputRef} type="file" accept="image/*,video/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadThumb(e.target.files[0]); }} />
                {form.thumbnail_url && (
                  <button onClick={() => setForm(f => ({ ...f, thumbnail_url: null }))} className="text-xs text-red-500 mt-1">Remove</button>
                )}
              </div>

              {/* Handle */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Channel / Handle <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. moffu.pro"
                  value={form.handle}
                  onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8]"
                />
              </div>

              {/* Post URL */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Video / Post URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or instagram.com/reel/..."
                  value={form.post_url}
                  onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8]"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Caption / Title <span className="text-[#9CA3AF] font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Short caption for the post"
                  value={form.title ?? ''}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8]"
                />
              </div>

              {/* Sort order */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Sort Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/30 focus:border-[#6C55E8]"
                />
              </div>

              {/* Active */}
              <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Show on website</p>
                  <p className="text-xs text-[#9CA3AF]">Toggle visibility on the marketing site</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-[#E5E7EB] flex gap-3">
              <button onClick={closePanel} className="flex-1 border border-[#E5E7EB] text-sm font-semibold text-[#374151] rounded-lg py-2.5 hover:bg-[#F9FAFB] transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.handle.trim() || !form.post_url.trim()}
                className="flex-1 bg-[#6C55E8] hover:bg-[#5A42D1] disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
