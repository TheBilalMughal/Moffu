import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

interface PlanPrice {
  id: string;
  billing_interval: 'monthly' | 'annual';
  amount_cents: number;
  currency: string;
}

interface PlanEntitlement {
  key: string;
  value_type: 'INTEGER' | 'UNLIMITED' | 'BOOLEAN' | 'ENUM';
  limit_value: number | null;
  bool_value: boolean | null;
  enum_value: string | null;
  usage_reset: string | null;
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
  contact_sales: boolean;
  sort_order: number;
  created_at: string;
  prices: PlanPrice[];
  entitlements: Record<string, PlanEntitlement>;
}

interface LimitsForm {
  locations: string;
  replies_unlimited: boolean;
  replies_limit: string;
  replies_reset: 'monthly' | 'weekly';
  ai_drafts_unlimited: boolean;
  ai_drafts_limit: string;
  ai_drafts_reset: 'monthly' | 'weekly';
  team_members: string;
  brand_brain_unlimited: boolean;
  brand_brain_limit: string;
  support_tier: string;
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  features: string[];
  badge_text: string;
  is_featured: boolean;
  is_active: boolean;
  contact_sales: boolean;
  sort_order: number;
  monthly_price: string;
  annual_discount: string;
  currency: string;
  limits: LimitsForm;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100);
}

const DEFAULT_LIMITS: LimitsForm = {
  locations: '1',
  replies_unlimited: false,
  replies_limit: '50',
  replies_reset: 'monthly',
  ai_drafts_unlimited: false,
  ai_drafts_limit: '50',
  ai_drafts_reset: 'monthly',
  team_members: '1',
  brand_brain_unlimited: false,
  brand_brain_limit: '1',
  support_tier: 'help_guides',
};

const EMPTY_FORM: PlanForm = {
  name: '',
  slug: '',
  description: '',
  features: [],
  badge_text: '',
  is_featured: false,
  is_active: true,
  contact_sales: false,
  sort_order: 0,
  monthly_price: '0',
  annual_discount: '20',
  currency: 'USD',
  limits: { ...DEFAULT_LIMITS },
};

function entsToLimits(ents: Record<string, PlanEntitlement>): LimitsForm {
  const loc = ents['locations'];
  const rep = ents['published_replies'];
  const ai  = ents['ai_drafts'];
  const team = ents['team_members'];
  const bb  = ents['brand_brain_profiles'];
  const sup = ents['support_tier'];
  return {
    locations:           String(loc?.limit_value ?? 1),
    replies_unlimited:   rep?.value_type === 'UNLIMITED',
    replies_limit:       String(rep?.limit_value ?? 50),
    replies_reset:       (rep?.usage_reset ?? 'monthly') as 'monthly' | 'weekly',
    ai_drafts_unlimited: ai?.value_type === 'UNLIMITED',
    ai_drafts_limit:     String(ai?.limit_value ?? 50),
    ai_drafts_reset:     (ai?.usage_reset ?? 'monthly') as 'monthly' | 'weekly',
    team_members:        String(team?.limit_value ?? 1),
    brand_brain_unlimited: bb?.value_type === 'UNLIMITED',
    brand_brain_limit:   String(bb?.limit_value ?? 1),
    support_tier:        sup?.enum_value ?? 'help_guides',
  };
}

export function PackagesSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'limits'>('details');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [featureInput, setFeatureInput] = useState('');
  const featureRef = useRef<HTMLInputElement>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchPlans() {
    setLoading(true);
    const [{ data: plansData }, { data: pricesData }, { data: entsData }] = await Promise.all([
      supabase.from('plans').select('id, slug, name, description, features, badge_text, is_featured, is_active, contact_sales, sort_order, created_at').order('sort_order'),
      supabase.from('plan_prices').select('id, plan_id, billing_interval, amount_cents, currency'),
      supabase.from('plan_entitlements').select('plan_id, key, value_type, limit_value, bool_value, enum_value, usage_reset'),
    ]);

    const priceMap: Record<string, PlanPrice[]> = {};
    (pricesData ?? []).forEach((p: any) => {
      if (!priceMap[p.plan_id]) priceMap[p.plan_id] = [];
      (priceMap[p.plan_id] as PlanPrice[]).push(p);
    });

    const entMap: Record<string, Record<string, PlanEntitlement>> = {};
    (entsData ?? []).forEach((e: any) => {
      if (!entMap[e.plan_id]) entMap[e.plan_id] = {} as Record<string, PlanEntitlement>;
      (entMap[e.plan_id] as Record<string, PlanEntitlement>)[e.key] = e as PlanEntitlement;
    });

    setPlans((plansData ?? []).map((p: any) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features : [],
      prices: priceMap[p.id] ?? [],
      entitlements: entMap[p.id] ?? {},
    })));
    setLoading(false);
  }

  useEffect(() => { fetchPlans(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: plans.length });
    setFeatureInput('');
    setActiveTab('details');
    setModalOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    const monthly = plan.prices.find(p => p.billing_interval === 'monthly');
    const annual = plan.prices.find(p => p.billing_interval === 'annual');
    const monthlyAmt = monthly ? monthly.amount_cents / 100 : 0;
    const annualPerMo = annual && annual.amount_cents > 0 ? annual.amount_cents / 100 : 0;
    const discount = monthlyAmt > 0 && annualPerMo > 0
      ? Math.round((1 - annualPerMo / monthlyAmt) * 100)
      : 20;
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      features: [...plan.features],
      badge_text: plan.badge_text ?? '',
      is_featured: plan.is_featured,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
      monthly_price: String(monthlyAmt),
      annual_discount: String(discount),
      currency: monthly?.currency ?? 'USD',
      contact_sales: plan.contact_sales ?? false,
      limits: entsToLimits(plan.entitlements),
    });
    setFeatureInput('');
    setActiveTab('details');
    setModalOpen(true);
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

  function reorderFeatures(from: number, to: number) {
    if (from === to) return;
    setForm(f => {
      const arr = [...f.features];
      const [item] = arr.splice(from, 1) as [string];
      arr.splice(to, 0, item);
      return { ...f, features: arr };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Plan name is required.'); return; }
    const slug = form.slug || slugify(form.name);
    if (!slug) { toast.error('Slug is required.'); return; }

    setSaving(true);

    const planPayload = {
      slug,
      name: form.name.trim(),
      description: form.description.trim() || null,
      features: form.features,
      badge_text: form.badge_text.trim() || null,
      is_featured: form.is_featured,
      is_active: form.is_active,
      contact_sales: form.contact_sales,
      sort_order: form.sort_order,
    };

    let planId: string;

    if (editingId) {
      const { error: e } = await supabase.from('plans').update(planPayload).eq('id', editingId);
      if (e) { toast.error(e.message); setSaving(false); return; }
      planId = editingId;
    } else {
      const { data: newPlan, error: e } = await supabase.from('plans').insert(planPayload).select('id').single();
      if (e || !newPlan) { toast.error(e?.message ?? 'Failed to create plan'); setSaving(false); return; }
      planId = newPlan.id;
    }

    // annual stores per-month equivalent, not total/yr: $19/mo at 20% off → 1520 cents/mo
    const monthly_cents = Math.round(parseFloat(form.monthly_price || '0') * 100);
    const discount = Math.min(100, Math.max(0, parseFloat(form.annual_discount || '0')));
    const annual_cents = Math.round(monthly_cents * (1 - discount / 100));

    const priceUpserts = [
      { plan_id: planId, currency: form.currency, billing_interval: 'monthly', amount_cents: monthly_cents, is_active: true },
      { plan_id: planId, currency: form.currency, billing_interval: 'annual', amount_cents: annual_cents, is_active: true },
    ];

    const { error: pe } = await supabase
      .from('plan_prices')
      .upsert(priceUpserts as any, { onConflict: 'plan_id,currency,billing_interval' });

    if (pe) { toast.error(pe.message); setSaving(false); return; }

    // Upsert entitlements
    const L = form.limits;
    const entUpserts = [
      { plan_id: planId, key: 'locations',           value_type: 'INTEGER',   limit_value: parseInt(L.locations) || 1,           bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'published_replies',   value_type: L.replies_unlimited   ? 'UNLIMITED' : 'INTEGER', limit_value: L.replies_unlimited   ? null : parseInt(L.replies_limit) || 50,   bool_value: null, enum_value: null, usage_reset: L.replies_reset },
      { plan_id: planId, key: 'ai_drafts',           value_type: L.ai_drafts_unlimited ? 'UNLIMITED' : 'INTEGER', limit_value: L.ai_drafts_unlimited ? null : parseInt(L.ai_drafts_limit) || 50, bool_value: null, enum_value: null, usage_reset: L.ai_drafts_reset },
      { plan_id: planId, key: 'team_members',        value_type: 'INTEGER',   limit_value: parseInt(L.team_members) || 1,         bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'brand_brain_profiles',value_type: L.brand_brain_unlimited ? 'UNLIMITED' : 'INTEGER', limit_value: L.brand_brain_unlimited ? null : parseInt(L.brand_brain_limit) || 1, bool_value: null, enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'support_tier',        value_type: 'ENUM',      limit_value: null,                                  bool_value: null, enum_value: L.support_tier,  usage_reset: null },
    ];
    const { error: ee } = await supabase.from('plan_entitlements').upsert(entUpserts as any, { onConflict: 'plan_id,key' });
    if (ee) { toast.error(ee.message); setSaving(false); return; }

    toast.success(editingId ? 'Package updated.' : 'Package created.');
    setModalOpen(false);
    await fetchPlans();
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const { error: e } = await supabase.from('plans').delete().eq('id', deleteId);
    if (e) { toast.error(e.message); }
    else { toast.success('Package deleted.'); await fetchPlans(); }
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

        {/* Plans list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#9CA3AF]">Loading packages…</div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[#9CA3AF]">No packages yet. Create your first package.</p>
          </div>
        ) : (
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_80px_auto] items-center px-5 py-2.5 bg-[#F8FAF9] border-b border-[#E5EAE8]">
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Plan</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Pricing</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Status</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Actions</span>
            </div>

            {plans.map((plan, idx) => {
              const monthly = plan.prices.find(p => p.billing_interval === 'monthly');
              const annual  = plan.prices.find(p => p.billing_interval === 'annual');
              const annualPerMo = annual && annual.amount_cents > 0 ? annual.amount_cents / 12 : 0;
              const disc = monthly && monthly.amount_cents > 0 && annualPerMo > 0
                ? Math.round((1 - annualPerMo / monthly.amount_cents) * 100)
                : 0;
              return (
                <div key={plan.id} className={`grid grid-cols-[1fr_160px_80px_auto] items-center px-5 py-3.5 bg-white hover:bg-[#FAFBFB] transition-colors ${idx < plans.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
                  {/* Plan info */}
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#111827]">{plan.name}</span>
                      <span className="text-[10px] text-[#C4CAC8] font-mono">{plan.slug}</span>
                      {plan.is_featured && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E]">
                          {plan.badge_text || 'Featured'}
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{plan.description}</p>
                    )}
                    {plan.features.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {plan.features.map((f, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div>
                    {plan.contact_sales ? (
                      <span className="text-xs font-medium text-[#1D4ED8]">Contact Sales</span>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[#111827]">
                          {monthly ? formatPrice(monthly.amount_cents, monthly.currency) : '—'}
                          <span className="text-xs font-normal text-[#9CA3AF]">/mo</span>
                        </p>
                        {disc > 0 && (
                          <p className="text-[11px] text-[#9CA3AF]">
                            {formatPrice(Math.round(annualPerMo), annual!.currency)}/mo annual
                            <span className="ml-1 text-[#0D4C3C] font-medium">· -{disc}%</span>
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status badge */}
                  <div>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md ${plan.is_active ? 'bg-[#E6F2EE] text-[#0D4C3C]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleActive(plan)}
                      title={plan.is_active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={plan.is_active
                          ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                          : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                        } />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEdit(plan)}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteId(plan.id)}
                      className="p-1.5 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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
            <div className="px-6 pt-4 border-b border-[#E5EAE8] flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[#111827]">
                  {editingId ? 'Edit Package' : 'New Package'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-1">
                {(['details', 'limits'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
                      activeTab === tab
                        ? 'border-[#0D4C3C] text-[#0D4C3C]'
                        : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {tab === 'details' ? 'Details' : 'Limits & Features'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {activeTab === 'limits' ? (
              <div className="space-y-5">
                {/* Locations */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Locations included</label>
                  <input type="number" min="1" value={form.limits.locations}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, locations: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                </div>

                {/* Replies */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#374151]">Published Replies</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.limits.replies_unlimited}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_unlimited: e.target.checked } }))}
                        className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                      <span className="text-xs text-[#6B7280]">Unlimited</span>
                    </label>
                  </div>
                  {!form.limits.replies_unlimited && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" value={form.limits.replies_limit}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_limit: e.target.value } }))}
                        placeholder="e.g. 100"
                        className="px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                      <select value={form.limits.replies_reset}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_reset: e.target.value as 'monthly' | 'weekly' } }))}
                        className="px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] bg-white">
                        <option value="monthly">per month</option>
                        <option value="weekly">per week</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* AI Drafts */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#374151]">AI Drafts</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.limits.ai_drafts_unlimited}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, ai_drafts_unlimited: e.target.checked } }))}
                        className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                      <span className="text-xs text-[#6B7280]">Unlimited</span>
                    </label>
                  </div>
                  {!form.limits.ai_drafts_unlimited && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" value={form.limits.ai_drafts_limit}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, ai_drafts_limit: e.target.value } }))}
                        placeholder="e.g. 50"
                        className="px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                      <select value={form.limits.ai_drafts_reset}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, ai_drafts_reset: e.target.value as 'monthly' | 'weekly' } }))}
                        className="px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] bg-white">
                        <option value="monthly">per month</option>
                        <option value="weekly">per week</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Team members */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Team Members</label>
                  <input type="number" min="1" value={form.limits.team_members}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, team_members: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                </div>

                {/* Brand Brain profiles */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#374151]">Brand Brain Profiles</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.limits.brand_brain_unlimited}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, brand_brain_unlimited: e.target.checked } }))}
                        className="w-3.5 h-3.5 accent-[#0D4C3C]" />
                      <span className="text-xs text-[#6B7280]">Unlimited</span>
                    </label>
                  </div>
                  {!form.limits.brand_brain_unlimited && (
                    <input type="number" min="0" value={form.limits.brand_brain_limit}
                      onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, brand_brain_limit: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]" />
                  )}
                </div>

                {/* Support tier */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Support Tier</label>
                  <select value={form.limits.support_tier}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, support_tier: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] bg-white">
                    <option value="help_guides">Help center guides</option>
                    <option value="standard_email">Standard email</option>
                    <option value="priority_email">Priority email</option>
                  </select>
                </div>
              </div>
            ) : (<>
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
                  <label className="block text-xs font-medium text-[#374151] mb-1">Annual Discount %</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.annual_discount}
                      onChange={e => setForm(f => ({ ...f, annual_discount: e.target.value }))}
                      className="w-full px-3 py-2 pr-7 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">%</span>
                  </div>
                </div>
              </div>
              {/* Annual price preview */}
              {(() => {
                const mo = parseFloat(form.monthly_price || '0');
                const disc = Math.min(100, Math.max(0, parseFloat(form.annual_discount || '0')));
                if (mo <= 0 || disc <= 0) return null;
                const perMo = +(mo * (1 - disc / 100)).toFixed(2);
                const total = +(perMo * 12).toFixed(2);
                return (
                  <p className="text-[11px] text-[#6B7280] -mt-2">
                    Annual: <span className="font-medium text-[#374151]">${perMo}/mo</span> · billed ${total}/yr · saves {disc}%
                  </p>
                );
              })()}

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
                      <div
                        key={i}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                        onDrop={() => { reorderFeatures(dragIdx!, i); setDragIdx(null); setDragOverIdx(null); }}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors cursor-default ${
                          dragOverIdx === i && dragIdx !== i
                            ? 'bg-[#E6F2EE] border-[#0D4C3C]'
                            : dragIdx === i
                            ? 'bg-[#F3F4F6] border-[#D1D5DB] opacity-50'
                            : 'bg-[#F8FAF9] border-[#E5EAE8]'
                        }`}
                      >
                        {/* Grip handle */}
                        <span className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#C4CAC8] hover:text-[#9CA3AF] transition-colors">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                            <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                          </svg>
                        </span>
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
              <div className="flex flex-col gap-3">
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.contact_sales}
                    onChange={e => setForm(f => ({ ...f, contact_sales: e.target.checked }))}
                    className="w-4 h-4 accent-[#0D4C3C] rounded"
                  />
                  <div>
                    <span className="text-sm text-[#374151]">Contact Sales</span>
                    <span className="text-xs text-[#9CA3AF] ml-2">— hides price, shows "Contact Sales Team" button → sales@moffu.com</span>
                  </div>
                </label>
              </div>
            </>)}
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
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
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
