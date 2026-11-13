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
  value_type: 'LIMIT' | 'UNLIMITED' | 'BOOLEAN' | 'ENUM';
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
  discount_type: 'fixed' | 'percent' | null;
  discount_value: number | null;
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
  brand_brain_steps: string; // bitmask 0–63: bit0=step1 … bit5=step6
  support_tier: string;
  feature_google_profile: boolean;
  feature_insights: boolean;
  campaign_emails_unlimited: boolean;
  campaign_emails_limit: string;
  campaign_sms_unlimited: boolean;
  campaign_sms_limit: string;
  campaign_whatsapp_unlimited: boolean;
  campaign_whatsapp_limit: string;
  marketing_posts_unlimited: boolean;
  marketing_posts_limit: string;
  feedback_requests_unlimited: boolean;
  feedback_requests_limit: string;
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
  discount_type: 'fixed' | 'percent' | '';
  discount_value: string;
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
  brand_brain_steps: '63',
  support_tier: 'help_guides',
  feature_google_profile: true,
  feature_insights: true,
  campaign_emails_unlimited: false,
  campaign_emails_limit: '500',
  campaign_sms_unlimited: false,
  campaign_sms_limit: '0',
  campaign_whatsapp_unlimited: false,
  campaign_whatsapp_limit: '0',
  marketing_posts_unlimited: false,
  marketing_posts_limit: '0',
  feedback_requests_unlimited: false,
  feedback_requests_limit: '0',
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
  discount_type: '',
  discount_value: '',
  limits: { ...DEFAULT_LIMITS },
};

function entsToLimits(ents: Record<string, PlanEntitlement>): LimitsForm {
  const loc = ents['locations'];
  const rep = ents['published_replies'];
  const ai  = ents['ai_drafts'];
  const team = ents['team_members'];
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
    brand_brain_steps:   String(ents['brand_brain_steps']?.limit_value ?? 63),
    support_tier:        sup?.enum_value ?? 'help_guides',
    feature_google_profile: ents['feature_google_profile']?.bool_value !== false,
    feature_insights:    ents['feature_insights']?.bool_value !== false,
    campaign_emails_unlimited: ents['campaign_emails']?.value_type === 'UNLIMITED',
    campaign_emails_limit:     String(ents['campaign_emails']?.limit_value ?? 500),
    campaign_sms_unlimited:    ents['campaign_sms']?.value_type === 'UNLIMITED',
    campaign_sms_limit:        String(ents['campaign_sms']?.limit_value ?? 0),
    campaign_whatsapp_unlimited: ents['campaign_whatsapp']?.value_type === 'UNLIMITED',
    campaign_whatsapp_limit:     String(ents['campaign_whatsapp']?.limit_value ?? 0),
    marketing_posts_unlimited:   ents['marketing_posts']?.value_type === 'UNLIMITED',
    marketing_posts_limit:       String(ents['marketing_posts']?.limit_value ?? 0),
    feedback_requests_unlimited: ents['feedback_requests']?.value_type === 'UNLIMITED',
    feedback_requests_limit:     String(ents['feedback_requests']?.limit_value ?? 0),
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
      supabase.from('plans').select('id, slug, name, description, features, badge_text, is_featured, is_active, contact_sales, sort_order, created_at, discount_type, discount_value').order('sort_order'),
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
      discount_type: (p.discount_type as 'fixed' | 'percent' | null) ?? null,
      discount_value: p.discount_value ?? null,
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
      discount_type: plan.discount_type ?? '',
      discount_value: plan.discount_value != null ? String(plan.discount_value) : '',
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

    const discountVal = parseFloat(form.discount_value || '0');
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
      discount_type: form.discount_type || null,
      discount_value: form.discount_type && discountVal > 0 ? discountVal : null,
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
      { plan_id: planId, key: 'locations',           value_type: 'LIMIT',     limit_value: parseInt(L.locations) || 1,           bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'published_replies',   value_type: L.replies_unlimited   ? 'UNLIMITED' : 'LIMIT', limit_value: L.replies_unlimited   ? null : parseInt(L.replies_limit) || 50,   bool_value: null, enum_value: null, usage_reset: L.replies_reset },
      { plan_id: planId, key: 'ai_drafts',           value_type: L.ai_drafts_unlimited ? 'UNLIMITED' : 'LIMIT', limit_value: L.ai_drafts_unlimited ? null : parseInt(L.ai_drafts_limit) || 50, bool_value: null, enum_value: null, usage_reset: L.ai_drafts_reset },
      { plan_id: planId, key: 'team_members',        value_type: 'LIMIT',     limit_value: parseInt(L.team_members) || 1,         bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'brand_brain_steps',   value_type: 'LIMIT', limit_value: (parseInt(L.brand_brain_steps) || 0) & 63, bool_value: null, enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'support_tier',        value_type: 'ENUM',      limit_value: null,                                  bool_value: null, enum_value: L.support_tier,  usage_reset: null },
      { plan_id: planId, key: 'feature_google_profile', value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_google_profile, enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_insights',    value_type: 'BOOLEAN',   limit_value: null, bool_value: L.feature_insights,    enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'campaign_emails',    value_type: L.campaign_emails_unlimited    ? 'UNLIMITED' : 'LIMIT', limit_value: L.campaign_emails_unlimited    ? null : parseInt(L.campaign_emails_limit) || 0,    bool_value: null, enum_value: null, usage_reset: 'monthly' },
      { plan_id: planId, key: 'campaign_sms',       value_type: L.campaign_sms_unlimited       ? 'UNLIMITED' : 'LIMIT', limit_value: L.campaign_sms_unlimited       ? null : parseInt(L.campaign_sms_limit) || 0,       bool_value: null, enum_value: null, usage_reset: 'monthly' },
      { plan_id: planId, key: 'campaign_whatsapp',  value_type: L.campaign_whatsapp_unlimited  ? 'UNLIMITED' : 'LIMIT', limit_value: L.campaign_whatsapp_unlimited  ? null : parseInt(L.campaign_whatsapp_limit) || 0,  bool_value: null, enum_value: null, usage_reset: 'monthly' },
      { plan_id: planId, key: 'marketing_posts',    value_type: L.marketing_posts_unlimited    ? 'UNLIMITED' : 'LIMIT', limit_value: L.marketing_posts_unlimited    ? null : parseInt(L.marketing_posts_limit) || 0,    bool_value: null, enum_value: null, usage_reset: 'monthly' },
      { plan_id: planId, key: 'feedback_requests',  value_type: L.feedback_requests_unlimited  ? 'UNLIMITED' : 'LIMIT', limit_value: L.feedback_requests_unlimited  ? null : parseInt(L.feedback_requests_limit) || 0,  bool_value: null, enum_value: null, usage_reset: 'monthly' },
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
            className="flex items-center gap-2 px-4 py-2 bg-[#6C55E8] text-white text-sm font-medium rounded-lg hover:bg-[#5A42D1] transition-colors"
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
          <div className="shadow-sm rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_80px_auto] items-center px-5 py-2.5 bg-[#FAFAF7] border-b border-[#E5E7EB]">
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Plan</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Pricing</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Status</span>
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Actions</span>
            </div>

            {plans.map((plan, idx) => {
              const monthly = plan.prices.find(p => p.billing_interval === 'monthly');
              const annual  = plan.prices.find(p => p.billing_interval === 'annual');
              const annualPerMo = annual && annual.amount_cents > 0 ? annual.amount_cents : 0;
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
                          {plan.discount_type && plan.discount_value && plan.discount_value > 0 && (
                            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {plan.discount_type === 'percent' ? `-${plan.discount_value}%` : `-$${plan.discount_value}`}
                            </span>
                          )}
                        </p>
                        {disc > 0 && (
                          <p className="text-[11px] text-[#9CA3AF]">
                            {formatPrice(Math.round(annualPerMo), annual!.currency)}/mo annual
                            <span className="ml-1 text-[#6C55E8] font-medium">· -{disc}%</span>
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status badge */}
                  <div>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md ${plan.is_active ? 'bg-[#D8CCFF] text-[#6C55E8]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-4 border-b border-[#E5E7EB] flex-shrink-0">
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
                        ? 'border-[#6C55E8] text-[#6C55E8]'
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

                {/* Feature Access */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">Feature Access</p>
                  <div className="border border-[#E5E7EB] rounded-lg divide-y divide-[#F3F4F6]">
                    <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-[#FAFAF7] transition-colors">
                      <input
                        type="checkbox"
                        checked={form.limits.feature_google_profile}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, feature_google_profile: e.target.checked } }))}
                        className="w-4 h-4 accent-[#6C55E8] rounded flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#111827]">Google Profile</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">Profile views, search queries, calls, direction requests</p>
                      </div>
                      <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${form.limits.feature_google_profile ? 'bg-[#D8CCFF] text-[#6C55E8]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                        {form.limits.feature_google_profile ? 'On' : 'Off'}
                      </span>
                    </label>
                    <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-[#FAFAF7] transition-colors">
                      <input
                        type="checkbox"
                        checked={form.limits.feature_insights}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, feature_insights: e.target.checked } }))}
                        className="w-4 h-4 accent-[#6C55E8] rounded flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#111827]">Insights & Analytics</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">Charts, rating trends, reply-rate metrics</p>
                      </div>
                      <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${form.limits.feature_insights ? 'bg-[#D8CCFF] text-[#6C55E8]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                        {form.limits.feature_insights ? 'On' : 'Off'}
                      </span>
                    </label>
                    <div className="px-3.5 py-3 flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <p className="text-[11px] text-[#9CA3AF]"><span className="font-medium text-[#6B7280]">Brand Brain</span> &amp; <span className="font-medium text-[#6B7280]">Team</span> access is controlled by their limits below — set to <span className="font-medium">0</span> to lock, <span className="font-medium">1+</span> to allow.</p>
                    </div>
                  </div>
                </div>

                {/* Campaign Limits */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">Campaign Limits <span className="font-normal text-[#9CA3AF]">(per month)</span></p>
                  <div className="space-y-3">
                    {([
                      { label: 'Email',     unlimitedKey: 'campaign_emails_unlimited',   limitKey: 'campaign_emails_limit',    active: true  },
                      { label: 'SMS',       unlimitedKey: 'campaign_sms_unlimited',      limitKey: 'campaign_sms_limit',       active: false },
                      { label: 'WhatsApp',  unlimitedKey: 'campaign_whatsapp_unlimited', limitKey: 'campaign_whatsapp_limit',  active: false },
                    ] as { label: string; unlimitedKey: keyof LimitsForm; limitKey: keyof LimitsForm; active: boolean }[]).map(ch => {
                      const isUnlimited = form.limits[ch.unlimitedKey] as boolean;
                      return (
                        <div key={ch.label} className={`border border-[#E5E7EB] rounded-lg px-3.5 py-3 ${!ch.active ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#374151]">{ch.label}</span>
                              {!ch.active && <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded">Coming soon</span>}
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" disabled={!ch.active}
                                checked={isUnlimited}
                                onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [ch.unlimitedKey]: e.target.checked } }))}
                                className="w-3.5 h-3.5 accent-[#6C55E8]" />
                              <span className="text-xs text-[#6B7280]">Unlimited</span>
                            </label>
                          </div>
                          {!isUnlimited && (
                            <div className="flex items-center gap-2">
                              <input type="number" min="0" disabled={!ch.active}
                                value={form.limits[ch.limitKey] as string}
                                onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [ch.limitKey]: e.target.value } }))}
                                placeholder="0 = no access"
                                className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                              <span className="text-xs text-[#9CA3AF]">{ch.label === 'Email' ? 'emails' : 'messages'}/mo</span>
                            </div>
                          )}
                          {isUnlimited && <p className="text-[11px] text-[#6C55E8] font-medium">Unlimited {ch.label === 'Email' ? 'emails' : 'messages'} per month</p>}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-1.5">Set to <span className="font-medium">0</span> to block campaigns on this plan. SMS &amp; WhatsApp limits are saved but inactive until channels are enabled.</p>
                </div>

                {/* Marketing Limits */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">Marketing Limits <span className="font-normal text-[#9CA3AF]">(per month)</span></p>
                  <div className="border border-[#E5E7EB] rounded-lg px-3.5 py-3 opacity-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#374151]">Marketing Posts</span>
                        <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded">Coming soon</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" disabled
                          checked={form.limits.marketing_posts_unlimited}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, marketing_posts_unlimited: e.target.checked } }))}
                          className="w-3.5 h-3.5 accent-[#6C55E8]" />
                        <span className="text-xs text-[#6B7280]">Unlimited</span>
                      </label>
                    </div>
                    {!form.limits.marketing_posts_unlimited && (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" disabled
                          value={form.limits.marketing_posts_limit}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, marketing_posts_limit: e.target.value } }))}
                          placeholder="0 = no access"
                          className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                        <span className="text-xs text-[#9CA3AF]">posts/mo</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-1.5">Marketing Posts limits are saved but inactive until the Marketing module is enabled.</p>
                </div>

                {/* Feedback Limits */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">Feedback Limits <span className="font-normal text-[#9CA3AF]">(per month)</span></p>
                  <div className="border border-[#E5E7EB] rounded-lg px-3.5 py-3 opacity-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#374151]">Feedback Requests</span>
                        <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded">Coming soon</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" disabled
                          checked={form.limits.feedback_requests_unlimited}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, feedback_requests_unlimited: e.target.checked } }))}
                          className="w-3.5 h-3.5 accent-[#6C55E8]" />
                        <span className="text-xs text-[#6B7280]">Unlimited</span>
                      </label>
                    </div>
                    {!form.limits.feedback_requests_unlimited && (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" disabled
                          value={form.limits.feedback_requests_limit}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, feedback_requests_limit: e.target.value } }))}
                          placeholder="0 = no access"
                          className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" />
                        <span className="text-xs text-[#9CA3AF]">requests/mo</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-1.5">Feedback Request limits are saved but inactive until the Feedback module is enabled.</p>
                </div>

                {/* Locations */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Locations included</label>
                  <input type="number" min="1" value={form.limits.locations}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, locations: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]" />
                </div>

                {/* Replies */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#374151]">Published Replies</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.limits.replies_unlimited}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_unlimited: e.target.checked } }))}
                        className="w-3.5 h-3.5 accent-[#6C55E8]" />
                      <span className="text-xs text-[#6B7280]">Unlimited</span>
                    </label>
                  </div>
                  {!form.limits.replies_unlimited && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" value={form.limits.replies_limit}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_limit: e.target.value } }))}
                        placeholder="e.g. 100"
                        className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]" />
                      <select value={form.limits.replies_reset}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, replies_reset: e.target.value as 'monthly' | 'weekly' } }))}
                        className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
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
                        className="w-3.5 h-3.5 accent-[#6C55E8]" />
                      <span className="text-xs text-[#6B7280]">Unlimited</span>
                    </label>
                  </div>
                  {!form.limits.ai_drafts_unlimited && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" value={form.limits.ai_drafts_limit}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, ai_drafts_limit: e.target.value } }))}
                        placeholder="e.g. 50"
                        className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]" />
                      <select value={form.limits.ai_drafts_reset}
                        onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, ai_drafts_reset: e.target.value as 'monthly' | 'weekly' } }))}
                        className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
                        <option value="monthly">per month</option>
                        <option value="weekly">per week</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Team members */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Team Members</label>
                  <input type="number" min="0" value={form.limits.team_members}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, team_members: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]" />
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Set to <span className="font-medium">0</span> to lock Team page. <span className="font-medium">1</span> = owner only (no invites). <span className="font-medium">2+</span> = can invite members.</p>
                </div>

                {/* Brand Brain steps */}
                <div>
                  {/* Steps unlocked — multi-select checkboxes */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-[#374151] mb-2">Steps Unlocked <span className="text-[#9CA3AF] font-normal">(Preview is always shown)</span></label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([['Identity',1],['Voice',2],['Format',3],['Rules',4],['Guardrails',5],['Locations',6]] as [string,number][]).map(([lbl, bit]) => {
                        const mask = parseInt(form.limits.brand_brain_steps) || 0;
                        const checked = !!(mask & (1 << (bit - 1)));
                        return (
                          <label key={bit} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] cursor-pointer hover:bg-[#FAFAF7] transition-colors select-none">
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const newMask = checked ? mask & ~(1 << (bit - 1)) : mask | (1 << (bit - 1));
                                setForm(f => ({ ...f, limits: { ...f.limits, brand_brain_steps: String(newMask) } }));
                              }}
                              className="w-3.5 h-3.5 accent-[#6C55E8] cursor-pointer" />
                            <span className="text-xs text-[#374151]">{lbl}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1.5">Unchecked steps show a lock icon and redirect to Billing.</p>
                  </div>
                </div>

                {/* Support tier */}
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Support Tier</label>
                  <select value={form.limits.support_tier}
                    onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, support_tier: e.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
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
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="auto from name"
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] font-mono"
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
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
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
                      className="w-full px-3 py-2 pr-7 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
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

              {/* Promotional Discount */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Promotional Discount <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#9CA3AF] mb-1">Type</label>
                    <select
                      value={form.discount_type}
                      onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'fixed' | 'percent' | '' }))}
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white"
                    >
                      <option value="">No discount</option>
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9CA3AF] mb-1">
                      {form.discount_type === 'percent' ? 'Percentage off' : form.discount_type === 'fixed' ? 'Amount off (USD)' : 'Value'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step={form.discount_type === 'percent' ? '1' : '0.01'}
                        max={form.discount_type === 'percent' ? '100' : undefined}
                        value={form.discount_value}
                        onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                        disabled={!form.discount_type}
                        placeholder={form.discount_type === 'percent' ? 'e.g. 20' : form.discount_type === 'fixed' ? 'e.g. 5' : '—'}
                        className="w-full px-3 py-2 pr-7 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
                      />
                      {form.discount_type && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">
                          {form.discount_type === 'percent' ? '%' : '$'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {form.discount_type && form.discount_value && parseFloat(form.discount_value) > 0 && (() => {
                  const mo = parseFloat(form.monthly_price || '0');
                  const dv = parseFloat(form.discount_value);
                  if (mo <= 0) return null;
                  const discountedCents = form.discount_type === 'percent'
                    ? Math.max(0, Math.round(mo * 100 * (1 - dv / 100)))
                    : Math.max(0, Math.round(mo * 100) - Math.round(dv * 100));
                  return (
                    <p className="text-[11px] text-[#6B7280] mt-1.5">
                      Shown as: <span className="line-through text-[#9CA3AF]">${mo.toFixed(2)}/mo</span>
                      <span className="ml-1.5 font-semibold text-[#111827]">${(discountedCents / 100).toFixed(2)}/mo</span>
                      <span className="ml-1.5 text-emerald-600 font-medium">
                        {form.discount_type === 'percent' ? `-${dv}%` : `-$${dv.toFixed(2)}`}
                      </span>
                    </p>
                  );
                })()}
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
                    className="flex-1 px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
                  />
                  <button
                    onClick={addFeature}
                    type="button"
                    className="px-3 py-2 bg-[#F3F4F6] text-[#374151] rounded-lg hover:bg-[#E5E7EB] transition-colors text-sm"
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
                            ? 'bg-[#D8CCFF] border-[#6C55E8]'
                            : dragIdx === i
                            ? 'bg-[#F3F4F6] border-[#D1D5DB] opacity-50'
                            : 'bg-[#FAFAF7] border-[#E5E7EB]'
                        }`}
                      >
                        {/* Grip handle */}
                        <span className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#C4CAC8] hover:text-[#9CA3AF] transition-colors">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                            <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                          </svg>
                        </span>
                        <svg className="w-3 h-3 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8]"
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
                      className="w-4 h-4 accent-[#6C55E8] rounded"
                    />
                    <span className="text-sm text-[#374151]">Featured (highlight on pricing page)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-[#6C55E8] rounded"
                    />
                    <span className="text-sm text-[#374151]">Active (visible on website)</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.contact_sales}
                    onChange={e => setForm(f => ({ ...f, contact_sales: e.target.checked }))}
                    className="w-4 h-4 accent-[#6C55E8] rounded"
                  />
                  <div>
                    <span className="text-sm text-[#374151]">Contact Sales</span>
                    <span className="text-xs text-[#9CA3AF] ml-2">— hides price, shows "Contact Sales Team" button → sales@moffu.com</span>
                  </div>
                </label>
              </div>
            </>)}
            </div>

            <div className="px-6 py-4 border-t border-[#E5E7EB] flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-[#6C55E8] text-white rounded-lg hover:bg-[#5A42D1] disabled:opacity-50 transition-colors"
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

