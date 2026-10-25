import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { Dropdown } from '@/components/Dropdown';
import { formatDate } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed_cents';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDiscount(c: Coupon) {
  if (c.discount_type === 'percent') return `${c.discount_value}% off`;
  return `$${(c.discount_value / 100).toFixed(2)} off`;
}

function couponStatus(c: Coupon): 'active' | 'inactive' | 'expired' | 'maxed' {
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.max_uses !== null && c.uses_count >= c.max_uses) return 'maxed';
  if (!c.is_active) return 'inactive';
  return 'active';
}

const STATUS_STYLE = {
  active:   'bg-[#ECFDF5] text-[#065F46]',
  inactive: 'bg-[#F3F4F6] text-[#374151]',
  expired:  'bg-[#FEF2F2] text-[#991B1B]',
  maxed:    'bg-[#FFF7ED] text-[#9A3412]',
};
const STATUS_LABEL = {
  active: 'Active', inactive: 'Inactive', expired: 'Expired', maxed: 'Maxed Out',
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function canManage(role: string | null) {
  return role === 'super_admin' || role === 'admin' || role === 'finance';
}

// ── Create Modal ───────────────────────────────────────────────────────────────

interface CreateModalProps { onClose: () => void; onCreated: () => void }

function CreateCouponModal({ onClose, onCreated }: CreateModalProps) {
  const { user } = useAdminAuthStore();
  const [code, setCode] = useState(generateCode());
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed_cents'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    const code_ = code.trim().toUpperCase();
    if (!code_) { setError('Code is required'); return; }
    const val = parseInt(discountValue, 10);
    if (!discountValue || isNaN(val) || val <= 0) { setError('Discount value must be a positive number'); return; }
    if (discountType === 'percent' && val > 100) { setError('Percent discount cannot exceed 100'); return; }

    setSaving(true);
    const { error: err } = await supabase.from('coupons').insert({
      code: code_,
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: discountType === 'fixed_cents' ? Math.round(val * 100) : val,
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
      expires_at: expiresAt || null,
      is_active: true,
      created_by: user?.id,
    });
    setSaving(false);

    if (err) { setError(err.message); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#111827]">Create Coupon</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Coupon Code</label>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-[#E5EAE8] rounded-lg text-sm font-mono uppercase text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30"
                placeholder="e.g. SUMMER25" />
              <button onClick={() => setCode(generateCode())}
                className="px-3 py-2 text-xs border border-[#E5EAE8] rounded-lg text-[#6B7280] hover:bg-[#F8FAF9] transition-colors whitespace-nowrap">
                Generate
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Description <span className="text-[#9CA3AF]">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5EAE8] rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30"
              placeholder="e.g. Summer launch promo" />
          </div>

          {/* Discount Type + Value */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Discount</label>
            <div className="flex gap-2">
              <div className="w-40 flex-shrink-0">
                <Dropdown
                  value={discountType}
                  onChange={v => setDiscountType(v as 'percent' | 'fixed_cents')}
                  options={[
                    { value: 'percent',     label: 'Percentage (%)' },
                    { value: 'fixed_cents', label: 'Fixed Amount ($)' },
                  ]}
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm pointer-events-none">
                  {discountType === 'percent' ? '%' : '$'}
                </span>
                <input type="number" min="1" max={discountType === 'percent' ? '100' : undefined}
                  value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-[#E5EAE8] rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30"
                  placeholder={discountType === 'percent' ? '20' : '10.00'} />
              </div>
            </div>
            {discountValue && !isNaN(parseFloat(discountValue)) && (
              <p className="mt-1.5 text-xs text-[#0D4C3C]">
                Preview: {discountType === 'percent'
                  ? `${discountValue}% off`
                  : `$${parseFloat(discountValue).toFixed(2)} off`}
              </p>
            )}
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Max Uses <span className="text-[#9CA3AF]">(leave blank for unlimited)</span></label>
            <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5EAE8] rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30"
              placeholder="100" />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Expires At <span className="text-[#9CA3AF]">(optional)</span></label>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5EAE8] rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/30" />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-[#FEF2F2] px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#E5EAE8] rounded-lg text-[#374151] hover:bg-[#F8FAF9] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-[#0D4C3C] text-white rounded-lg hover:bg-[#0a3d30] transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({ code, onConfirm, onClose }: { code: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[#111827] mb-2">Delete Coupon</h2>
        <p className="text-sm text-[#6B7280] mb-5">
          Delete coupon <span className="font-mono font-semibold text-[#111827]">{code}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#E5EAE8] rounded-lg text-[#374151] hover:bg-[#F8FAF9]">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function CouponsPage() {
  const { platformRole } = useAdminAuthStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(c: Coupon) {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
  }

  async function handleDelete(c: Coupon) {
    await supabase.from('coupons').delete().eq('id', c.id);
    setCoupons(prev => prev.filter(x => x.id !== c.id));
    setDeleteTarget(null);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const filtered = coupons.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.code.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
    const status = couponStatus(c);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const manage = canManage(platformRole);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Coupons</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''} total</p>
          </div>
          {manage && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#0D4C3C] text-white rounded-lg hover:bg-[#0a3d30] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Create Coupon
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white shadow-sm rounded-xl border-0 flex-1 max-w-xs">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search code or description…"
              className="flex-1 text-sm text-[#111827] placeholder-[#9CA3AF] bg-transparent focus:outline-none" />
          </div>
          <div className="w-44">
            <Dropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all',      label: 'All Statuses' },
                { value: 'active',   label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'expired',  label: 'Expired' },
                { value: 'maxed',    label: 'Maxed Out' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Code</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Description</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Discount</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Uses</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Expires</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Created</th>
                {manage && <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F9FAFB]">
              {loading ? (
                <tr><td colSpan={manage ? 8 : 7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={manage ? 8 : 7} className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
                  {search || statusFilter !== 'all' ? 'No coupons match your filters.' : 'No coupons yet. Create your first one.'}
                </td></tr>
              ) : filtered.map(c => {
                const status = couponStatus(c);
                return (
                  <tr key={c.id} className="hover:bg-[#FAFFFE] transition-colors">
                    {/* Code */}
                    <td className="px-5 py-3.5">
                      <button onClick={() => copyCode(c.code)}
                        className="flex items-center gap-1.5 group" title="Click to copy">
                        <span className="font-mono font-semibold text-[#111827] text-sm tracking-wide">{c.code}</span>
                        <span className={`transition-colors ${copied === c.code ? 'text-[#0D4C3C]' : 'text-[#D1D5DB] group-hover:text-[#9CA3AF]'}`}>
                          {copied === c.code
                            ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          }
                        </span>
                      </button>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-[#6B7280] max-w-[180px] truncate block">
                        {c.description ?? <span className="text-[#D1D5DB] italic">—</span>}
                      </span>
                    </td>

                    {/* Discount */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-[#111827]">{fmtDiscount(c)}</span>
                    </td>

                    {/* Uses */}
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-[#374151]">
                        {c.uses_count}
                        <span className="text-[#9CA3AF]"> / {c.max_uses ?? '∞'}</span>
                      </span>
                    </td>

                    {/* Expires */}
                    <td className="px-5 py-3.5">
                      <span className={`text-sm ${c.expires_at && new Date(c.expires_at) < new Date() ? 'text-red-500' : 'text-[#374151]'}`}>
                        {c.expires_at ? formatDate(c.expires_at) : <span className="text-[#9CA3AF]">Never</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-5 py-3.5 text-sm text-[#9CA3AF] whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>

                    {/* Actions */}
                    {manage && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle active */}
                          {status !== 'expired' && status !== 'maxed' && (
                            <button onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}
                              className={`p-1.5 rounded-lg transition-colors ${c.is_active
                                ? 'text-[#0D4C3C] hover:bg-[#E6F2EE]'
                                : 'text-[#9CA3AF] hover:bg-[#F3F4F6]'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {c.is_active
                                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                }
                              </svg>
                            </button>
                          )}
                          {/* Delete */}
                          <button onClick={() => setDeleteTarget(c)} title="Delete coupon"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateCouponModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          code={deleteTarget.code}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
