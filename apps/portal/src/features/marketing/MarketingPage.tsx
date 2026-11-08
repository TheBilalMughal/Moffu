import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketingService, MarketingPost, PLATFORM_LABELS, POST_TYPES, STATUS_LABELS } from './marketingService';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    instagram: 'bg-[#FDF2F8] text-[#9D174D]',
    facebook:  'bg-[#EFF6FF] text-[#1D4ED8]',
    linkedin:  'bg-[#F0F9FF] text-[#0369A1]',
    all:       'bg-[#F3F4F6] text-[#374151]',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${colors[platform] ?? colors['all']}`}>
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-[#F3F4F6] text-[#374151]' };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${s.color}`}>{s.label}</span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-[#111827]">{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border transition-colors ${value ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8] font-medium' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#6C55E8] bg-white'}`}
      >
        {selected?.label ?? placeholder}
        {value
          ? <span onClick={e => { e.stopPropagation(); onChange(''); }} className="hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>
          : <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        }
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1.5 min-w-[160px]">
          <button onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${!value ? 'text-[#6C55E8] font-medium bg-[#F3F4F6]' : 'text-[#6B7280] hover:bg-[#F8F9FA]'}`}>
            {placeholder}
          </button>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${value === o.value ? 'text-[#6C55E8] font-medium bg-[#F3F4F6]' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}>
              <span>{o.label}</span>
              {value === o.value && <svg className="w-3.5 h-3.5 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketingPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, byPlatform: {} as Record<string, number> });

  const [platformFilter, setPlatformFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const [postsRes, statsRes] = await Promise.all([
      marketingService.loadPosts({ platform: platformFilter, post_type: typeFilter, status: statusFilter }),
      marketingService.getPostStats(),
    ]);
    setPosts(postsRes.data);
    setStats(statsRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, [platformFilter, typeFilter, statusFilter]);

  async function handleDelete(id: string) {
    setDeleting(id);
    await marketingService.deletePost(id);
    setDeleting(null);
    load();
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Marketing</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">AI-generated social media posts for your business.</p>
        </div>
        <button
          onClick={() => navigate('/marketing/new')}
          className="flex items-center gap-2 bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Create Post
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-8 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Posts" value={stats.total} />
        <StatCard label="This Month" value={stats.thisMonth} />
        <StatCard label="Instagram" value={stats.byPlatform['instagram'] ?? 0} />
        <StatCard label="Facebook" value={stats.byPlatform['facebook'] ?? 0} />
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-3 flex-wrap">
        <FilterSelect
          value={platformFilter}
          onChange={setPlatformFilter}
          placeholder="All platforms"
          options={[
            { value: 'instagram', label: 'Instagram' },
            { value: 'facebook',  label: 'Facebook' },
            { value: 'linkedin',  label: 'LinkedIn' },
          ]}
        />
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All types"
          options={POST_TYPES.map(t => ({ value: t.value, label: t.label }))}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All statuses"
          options={Object.entries(STATUS_LABELS).map(([v, s]) => ({ value: v, label: s.label }))}
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-8 pb-6">
        <div className="h-full flex flex-col bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Caption Preview</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Platform</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Type</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Created</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-3.5 bg-[#E5E7EB] rounded animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : posts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <svg className="w-12 h-12 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-[#374151]">No posts yet</p>
                          <p className="text-xs text-[#9CA3AF] mt-1">Create your first AI-generated social media post.</p>
                        </div>
                        <button
                          onClick={() => navigate('/marketing/new')}
                          className="bg-[#111827] hover:bg-[#6C55E8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          Create Post
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  posts.map(p => (
                    <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-sm text-[#374151] truncate">{p.caption ?? p.user_context ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3">
                        <PlatformBadge platform={p.platform} />
                      </td>
                      <td className="px-5 py-3 text-xs text-[#6B7280]">
                        {POST_TYPES.find(t => t.value === p.post_type)?.label ?? p.post_type}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-[#9CA3AF]">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deleting === p.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
