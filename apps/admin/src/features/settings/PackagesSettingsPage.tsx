import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface PlanPrice {
  id: string;
  interval: 'monthly' | 'annual';
  amount_cents: number;
  currency: string;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  badge_text: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  prices: PlanPrice[];
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  features: string[];
  badge_text: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  monthly_price: string;
  annual_price: string;
  currency: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100);
}

const EMPTY_FORM: PlanForm = {
  name: '',
  slug: '',
  description: '',
  features: [],
  badge_text: '',
  is_featured: false,
  is_active: true,
  sort_order: 0,
  monthly_price: '0',
  annual_price: '0',
  currency: 'USD',
};

export function PackagesSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [featureInput, setFeatureInput] = useState('');
  const featureRef = useRef<HTMLInputElement>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchPlans() {
    setLoading(true);
    const { data: plansData } = await supabase
      .from('plans')
      .select('id, slug, name, description, features, badge_text, is_featured, is_active, sort_order, created_at')
      .order('sort_order');
    const { data: pricesData } = await supabase
      .from('plan_prices')
      .select('id, plan_id, interval, amount_cents, currency');

    const priceMap: Record<string, PlanPrice[]> = {};
    (pricesData ?? []).forEach((p: any) => {
      if (!priceMap[p.plan_id]) priceMap[p.plan_id] = [];
      priceMap[p.plan_id].push(p);
    });

    setPlans((plansData ?? []).map((p: any) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features : [],
      prices: priceMap[p.id] ?? [],
    })));
    setLoading(false);
  }

  useEffect(() => { fetchPlans(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: plans.length });
    setFeatureInput('');
    setModalOpen(true);
    setError('');
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    const monthly = plan.prices.find(p => p.interval === 'monthly');
    const annual = plan.prices.find(p => p.interval === 'annual');
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      features: [...plan.features],
      badge_text: plan.badge_text ?? '',
      is_featured: plan.is_featured,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
      monthly_price: monthly ? String(monthly.amount_cents / 100) : '0',
      annual_price: annual ? String(annual.amount_cents / 100) : '0',
      currency: monthly?.currency ?? 'USD',
    });
    setFeatureInput('');
    setModalOpen(true);
    setError('');
  }

  function addFeature() {
    const val = featureInput.trim();
    if (!val) return;
    setForm(f => ({ ...f, features: [...f.features, val] }));
    setFeatureInput('');
    featureRef.current?.focus();
  }

  function removeFeature(i: number) {
    setForm(f => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Plan name is required.'); return; }
    const slug = form.slug || slugify(form.name);
    if (!slug) { setError('Slug is required.'); return; }

    setSaving(true);
    setError('');

    const planPayload = {
      slug,
      name: form.name.trim(),
      description: form.description.trim() || null,
      features: form.features,
      badge_text: form.badge_text.trim() || null,
      is_featured: form.is_featured,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    let planId = editingId;

    if (editingId) {
      const { error: e } = await supabase.from('plans').update(planPayload).eq('id', editingId);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data: newPlan, error: e } = await supabase.from('plans').insert(planPayload).select('id').single();
      if (e || !newPlan) { setError(e?.message ?? 'Failed to create plan'); setSaving(false); return; }
      planId = newPlan.id;
    }

    // Upsert prices
    const monthly_cents = Math.round(parseFloat(form.monthly_price || '0') * 100);
    const annual_cents = Math.round(parseFloat(form.annual_price || '0') * 100);

    const priceUpserts = [
      { plan_id: planId, currency: form.currency, interval: 'monthly', amount_cents: monthly_cents, is_active: true },
      { plan_id: planId, currency: form.currency, interval: 'annual', amount_cents: annual_cents, is_active: true },
    ];

    const { error: pe } = await supabase
      .from('plan_prices')
      .upsert(priceUpserts as any, { onConflict: 'plan_id,currency,interval' });

    if (pe) { setError(pe.message); setSaving(false); return; }

    setSuccess(editingId ? 'Package updated.' : 'Package created.');
    setModalOpen(false);
    await fetchPlans();
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const { error: e } = await supabase.from('plans').delete().eq('id', deleteId);
    if (e) { setError(e.message); }
    else { setSuccess('Package deleted.'); await fetchPlans(); setTimeout(() => setSuccess(''), 3000); }
    setDeleteId(null);
    setDeleting(false);
  }

  async function toggleActive(plan: Plan) {
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    await fetchPlans();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Packages</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Manage subscription plans shown on the website</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D4C3C] text-white text-sm font-medium rounded-lg hover:bg-[#0a3d30] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Package
          </button>
        </div>

        {success && (
          <div className="mb-4 px-4 py-3 bg-[#E6F2EE] border border-[#B2D8CC] rounded-lg text-sm text-[#0D4C3C]">
            {success}
          </div>
        )}

        {/* Plans list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#9CA3AF]">Loading packages…</div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[#9CA3AF]">No packages yet. Create your first package.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const monthly = plan.prices.find(p => p.interval === 'monthly');
              const annual = plan.prices.find(p => p.interval === 'annual');
              return (
                <div key={plan.id} className="bg-white border border-[#E5EAE8] rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {plan.is_featured && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] flex-shrink-0">
                          {plan.badge_text || 'Featured'}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[#111827]">{plan.name}</h3>
                          <span className="text-[10px] text-[#9CA3AF] font-mono">{plan.slug}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${plan.is_active ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {plan.description && (
                          <p className="text-xs text-[#6B7280] mt-0.5 truncate">{plan.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#111827]">
                          {monthly ? formatPrice(monthly.amount_cents, monthly.currency) : '—'}<span className="text-xs font-normal text-[#9CA3AF]">/mo</span>
                        </p>
                        {annual && annual.amount_cents > 0 && (
                          <p className="text-[11px] text-[#6B7280]">
                            {formatPrice(annual.amount_cents, annual.currency)}/mo annual
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleActive(plan)}
                        title={plan.is_active ? 'Deactivate' : 'Activate'}
                        className="p-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={plan.is_active
                            ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                            : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                          } />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEdit(plan)}
                        className="p-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteId(plan.id)}
                        className="p-2 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {plan.features.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {plan.features.map((f, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 bg-[#F8FAF9] border border-[#E5EAE8] rounded text-[#374151]">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E5EAE8] flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-semibold text-[#111827]">
                {editingId ? 'Edit Package' : 'New Package'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              {/* Name + Slug */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Plan Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                    placeholder="e.g. Growth"
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="auto from name"
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short tagline shown under plan name"
                  className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] bg-white"
                  >
                    <option value="USD">USD</option>
                    <option value="PKR">PKR</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Monthly Price</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.monthly_price}
                    onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Annual Price/mo</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.annual_price}
                    onChange={e => setForm(f => ({ ...f, annual_price: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Features</label>
                <div className="flex gap-2">
                  <input
                    ref={featureRef}
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                    placeholder="Type a feature and press Enter"
                    className="flex-1 px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                  <button
                    onClick={addFeature}
                    type="button"
                    className="px-3 py-2 bg-[#F3F4F6] text-[#374151] rounded-lg hover:bg-[#E5EAE8] transition-colors text-sm"
                  >
                    Add
                  </button>
                </div>
                {form.features.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {form.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg">
                        <svg className="w-3 h-3 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="flex-1 text-xs text-[#374151]">{f}</span>
                        <button onClick={() => removeFeature(i)} className="text-[#9CA3AF] hover:text-red-500 transition-colors flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Badge + Featured */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Badge Text</label>
                  <input
                    value={form.badge_text}
                    onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))}
                    placeholder="e.g. Most Popular"
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                    className="w-4 h-4 accent-[#0D4C3C] rounded"
                  />
                  <span className="text-sm text-[#374151]">Featured (highlight on pricing page)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 accent-[#0D4C3C] rounded"
                  />
                  <span className="text-sm text-[#374151]">Active (visible on website)</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5EAE8] flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-[#0D4C3C] text-white rounded-lg hover:bg-[#0a3d30] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-[#111827] mb-2">Delete Package?</h2>
            <p className="text-sm text-[#6B7280] mb-6">
              This will permanently delete the package and all its prices. Active subscribers will not be affected but the plan will no longer be selectable.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteId(null); setError(''); }} className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
