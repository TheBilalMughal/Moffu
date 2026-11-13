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
  feature_brand_brain: boolean;
  feature_google_profile: boolean;
  feature_insights: boolean;
  feature_campaigns: boolean;
  feature_marketing: boolean;
  feature_feedback: boolean;
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
  feature_brand_brain: true,
  feature_google_profile: true,
  feature_insights: true,
  feature_campaigns: false,
  feature_marketing: false,
  feature_feedback: false,
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
    feature_brand_brain: ents['feature_brand_brain']?.bool_value === true,
    feature_google_profile: ents['feature_google_profile']?.bool_value !== false,
    feature_insights:    ents['feature_insights']?.bool_value !== false,
    feature_campaigns:   ents['feature_campaigns']?.bool_value === true,
    feature_marketing:   ents['feature_marketing']?.bool_value === true,
    feature_feedback:    ents['feature_feedback']?.bool_value === true,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [featureInput, setFeatureInput] = useState('');
  const featureRef = useRef<HTMLInputElement>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
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

    // annual stores per-month equivalent, not total/yr
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

    const L = form.limits;
    const entUpserts = [
      { plan_id: planId, key: 'locations',           value_type: 'LIMIT',     limit_value: parseInt(L.locations) || 1,           bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'published_replies',   value_type: L.replies_unlimited   ? 'UNLIMITED' : 'LIMIT', limit_value: L.replies_unlimited   ? null : parseInt(L.replies_limit) || 50,   bool_value: null, enum_value: null, usage_reset: L.replies_reset },
      { plan_id: planId, key: 'ai_drafts',           value_type: L.ai_drafts_unlimited ? 'UNLIMITED' : 'LIMIT', limit_value: L.ai_drafts_unlimited ? null : parseInt(L.ai_drafts_limit) || 50, bool_value: null, enum_value: null, usage_reset: L.ai_drafts_reset },
      { plan_id: planId, key: 'team_members',        value_type: 'LIMIT',     limit_value: parseInt(L.team_members) || 1,         bool_value: null, enum_value: null,            usage_reset: null },
      { plan_id: planId, key: 'brand_brain_steps',   value_type: 'LIMIT', limit_value: (parseInt(L.brand_brain_steps) || 0) & 63, bool_value: null, enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'support_tier',        value_type: 'ENUM',      limit_value: null,                                  bool_value: null, enum_value: L.support_tier,  usage_reset: null },
      { plan_id: planId, key: 'feature_brand_brain',    value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_brand_brain,    enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_google_profile', value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_google_profile, enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_insights',    value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_insights,    enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_campaigns',   value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_campaigns,   enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_marketing',   value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_marketing,   enum_value: null, usage_reset: null },
      { plan_id: planId, key: 'feature_feedback',    value_type: 'BOOLEAN', limit_value: null, bool_value: L.feature_feedback,    enum_value: null, usage_reset: null },
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
    setDeleteName('');
    setDeleteConfirmInput('');
    setDeleting(false);
  }

  async function toggleActive(plan: Plan) {
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    await fetchPlans();
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F9FAFB]">
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-[#111827]">Packages</h1>
            <p className="text-sm text-[#6B7280] mt-1">Manage subscription plans and feature entitlements</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#6C55E8] text-white text-sm font-semibold rounded-xl hover:bg-[#5A42D1] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Package
          </button>
        </div>

        {/* Summary row */}
        {!loading && plans.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Plans', value: String(plans.length) },
              { label: 'Active', value: String(plans.filter(p => p.is_active).length) },
              { label: 'Featured', value: plans.find(p => p.is_featured)?.name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
                <p className="text-xl font-semibold text-[#111827] mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plans */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#9CA3AF]">Loading packages…</div>
        ) : plans.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#374151]">No packages yet</p>
              <p className="text-xs text-[#9CA3AF] mt-1">Create your first subscription plan to get started</p>
            </div>
            <button onClick={openCreate} className="text-sm font-semibold text-[#6C55E8] hover:text-[#5A42D1] transition-colors">
              Create a package
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const monthly = plan.prices.find(p => p.billing_interval === 'monthly');
              const annual  = plan.prices.find(p => p.billing_interval === 'annual');
              const annualPerMo = annual && annual.amount_cents > 0 ? annual.amount_cents : 0;
              const disc = monthly && monthly.amount_cents > 0 && annualPerMo > 0
                ? Math.round((1 - annualPerMo / monthly.amount_cents) * 100) : 0;
              return (
                <div key={plan.id} className="bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5 hover:shadow-sm transition-shadow group">
                  <div className="flex items-start gap-4">
                    {/* Accent bar */}
                    <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${plan.is_active ? 'bg-[#6C55E8]' : 'bg-[#E5E7EB]'}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#111827]">{plan.name}</span>
                        <span className="text-[10px] font-mono text-[#C4CAC8]">/{plan.slug}</span>
                        {plan.is_featured && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FEF9C3] text-[#854D0E]">
                            {plan.badge_text || 'Most Popular'}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${plan.is_active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                          {plan.is_active ? 'Active' : 'Draft'}
                        </span>
                        {plan.contact_sales && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8]">Custom</span>
                        )}
                      </div>
                      {plan.description && <p className="text-xs text-[#6B7280] mt-0.5">{plan.description}</p>}
                      {plan.features.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {plan.features.slice(0, 4).map((f, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded-md">{f}</span>
                          ))}
                          {plan.features.length > 4 && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#9CA3AF] rounded-md">+{plan.features.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="flex-shrink-0 text-right min-w-[150px]">
                      {plan.contact_sales ? (
                        <span className="text-sm font-semibold text-[#1D4ED8]">Custom Pricing</span>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-2xl font-bold text-[#111827]">
                              {monthly ? formatPrice(monthly.amount_cents, monthly.currency) : '$0'}
                            </span>
                            <span className="text-xs text-[#9CA3AF]">/mo</span>
                          </div>
                          {disc > 0 && (
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                              {formatPrice(Math.round(annualPerMo), annual!.currency)}/mo annual
                              <span className="ml-1 text-[#6C55E8] font-semibold">-{disc}%</span>
                            </p>
                          )}
                          {plan.discount_type && plan.discount_value && plan.discount_value > 0 && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                              {plan.discount_type === 'percent' ? `-${plan.discount_value}%` : `-$${plan.discount_value}`} promo
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleActive(plan)} title={plan.is_active ? 'Deactivate' : 'Activate'}
                        className="p-2 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={plan.is_active
                            ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                            : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                        </svg>
                      </button>
                      <button onClick={() => openEdit(plan)}
                        className="p-2 text-[#9CA3AF] hover:text-[#6C55E8] hover:bg-[#F5F3FF] rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => { setDeleteId(plan.id); setDeleteName(plan.name); setDeleteConfirmInput(''); }}
                        className="p-2 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[980px] flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="px-7 py-5 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">{editingId ? 'Edit Package' : 'New Package'}</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Configure plan details and feature entitlements</p>
              </div>
              <button onClick={() => setModalOpen(false)}
                className="p-1.5 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Two-column body */}
            <div className="flex-1 overflow-hidden flex min-h-0">

              {/* ── Left: Plan Details ── */}
              <div className="w-[420px] flex-shrink-0 overflow-y-auto border-r border-[#F3F4F6]">
                <div className="px-7 py-6 space-y-6">

                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Plan Details</p>

                  {/* Name + Slug */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">Plan Name <span className="text-red-400">*</span></label>
                      <input value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                        placeholder="e.g. Growth"
                        className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">Slug</label>
                      <input value={form.slug}
                        onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                        placeholder="auto"
                        className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] font-mono bg-white" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">Description</label>
                    <input value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Short tagline shown under plan name"
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                  </div>

                  {/* Pricing */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Pricing</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Currency</label>
                        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
                          <option value="USD">USD</option>
                          <option value="PKR">PKR</option>
                          <option value="GBP">GBP</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Monthly</label>
                        <input type="number" min="0" step="1" value={form.monthly_price}
                          onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Annual Disc.</label>
                        <div className="relative">
                          <input type="number" min="0" max="100" step="1" value={form.annual_discount}
                            onChange={e => setForm(f => ({ ...f, annual_discount: e.target.value }))}
                            className="w-full px-3 py-2 pr-7 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">%</span>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const mo = parseFloat(form.monthly_price || '0');
                      const d = Math.min(100, Math.max(0, parseFloat(form.annual_discount || '0')));
                      if (mo <= 0 || d <= 0) return null;
                      const perMo = +(mo * (1 - d / 100)).toFixed(2);
                      return (
                        <p className="text-[11px] text-[#6B7280] mt-2 bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2 rounded-lg">
                          Annual billing: <span className="font-semibold text-[#374151]">${perMo}/mo</span> · billed ${+(perMo * 12).toFixed(2)}/yr · saves {d}%
                        </p>
                      );
                    })()}
                  </div>

                  {/* Promo Discount */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Promo Discount <span className="normal-case font-normal">(optional)</span></p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Type</label>
                        <select value={form.discount_type}
                          onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'fixed' | 'percent' | '' }))}
                          className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
                          <option value="">None</option>
                          <option value="percent">Percentage (%)</option>
                          <option value="fixed">Fixed ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">
                          {form.discount_type === 'percent' ? '% off' : form.discount_type === 'fixed' ? 'Amount off' : 'Value'}
                        </label>
                        <div className="relative">
                          <input type="number" min="0"
                            step={form.discount_type === 'percent' ? '1' : '0.01'}
                            max={form.discount_type === 'percent' ? '100' : undefined}
                            value={form.discount_value}
                            onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                            disabled={!form.discount_type}
                            placeholder={form.discount_type === 'percent' ? '20' : form.discount_type === 'fixed' ? '5' : '—'}
                            className="w-full px-3 py-2 pr-7 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] bg-white" />
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
                      const dc = form.discount_type === 'percent'
                        ? Math.max(0, Math.round(mo * 100 * (1 - dv / 100)))
                        : Math.max(0, Math.round(mo * 100) - Math.round(dv * 100));
                      return (
                        <p className="text-[11px] text-[#6B7280] mt-2 bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2 rounded-lg">
                          Shown as: <span className="line-through text-[#9CA3AF]">${mo.toFixed(2)}</span>
                          <span className="ml-1.5 font-semibold text-[#111827]">${(dc / 100).toFixed(2)}/mo</span>
                          <span className="ml-1.5 text-emerald-600 font-medium">
                            {form.discount_type === 'percent' ? `-${dv}%` : `-$${dv.toFixed(2)}`}
                          </span>
                        </p>
                      );
                    })()}
                  </div>

                  {/* Feature Bullets */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Feature Bullets</p>
                    <div className="flex gap-2">
                      <input ref={featureRef} value={featureInput}
                        onChange={e => setFeatureInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                        placeholder="Type a bullet and press Enter"
                        className="flex-1 px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                      <button onClick={addFeature} type="button"
                        className="px-3 py-2 bg-[#F3F4F6] text-[#374151] rounded-xl hover:bg-[#E5E7EB] transition-colors text-sm font-medium">
                        Add
                      </button>
                    </div>
                    {form.features.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {form.features.map((f, i) => (
                          <div key={i} draggable
                            onDragStart={() => setDragIdx(i)}
                            onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                            onDrop={() => { reorderFeatures(dragIdx!, i); setDragIdx(null); setDragOverIdx(null); }}
                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                            className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl transition-colors cursor-default ${
                              dragOverIdx === i && dragIdx !== i ? 'bg-[#D8CCFF] border-[#6C55E8]'
                              : dragIdx === i ? 'bg-[#F3F4F6] border-[#D1D5DB] opacity-50'
                              : 'bg-[#FAFAFA] border-[#E5E7EB]'
                            }`}>
                            <span className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#C4CAC8] hover:text-[#9CA3AF]">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                                <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
                                <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                              </svg>
                            </span>
                            <svg className="w-3 h-3 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="flex-1 text-xs text-[#374151]">{f}</span>
                            <button onClick={() => removeFeature(i)} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Badge + Sort */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">Badge Text</label>
                      <input value={form.badge_text}
                        onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))}
                        placeholder="e.g. Most Popular"
                        className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1.5">Sort Order</label>
                      <input type="number" min="0" value={form.sort_order}
                        onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                    </div>
                  </div>

                  {/* Plan Settings (toggle switches) */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Plan Settings</p>
                    <div className="space-y-3">
                      {([
                        { key: 'is_featured', label: 'Featured plan', desc: 'Highlighted on the pricing page' },
                        { key: 'is_active',   label: 'Active',        desc: 'Visible and selectable on the website' },
                        { key: 'contact_sales', label: 'Contact Sales', desc: 'Hides price, shows Contact Sales button' },
                      ] as { key: 'is_featured' | 'is_active' | 'contact_sales'; label: string; desc: string }[]).map(({ key, label, desc }) => (
                        <div key={key} className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-[#374151]">{label}</p>
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{desc}</p>
                          </div>
                          <button type="button" role="switch" aria-checked={form[key]}
                            onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5 ${form[key] ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}>
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${form[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right: Limits & Features ── */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-7 py-6 space-y-6">

                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Limits & Features</p>

                  {/* Feature Access */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Feature Access</p>
                    <div className="space-y-2">
                      {([
                        { key: 'feature_brand_brain',    label: 'Brand Brain',         desc: 'AI tone, language, per-star rules, guardrails' },
                        { key: 'feature_google_profile', label: 'Google Profile',       desc: 'Profile views, search queries, calls' },
                        { key: 'feature_insights',       label: 'Insights & Analytics', desc: 'Charts, rating trends, reply-rate metrics' },
                        { key: 'feature_campaigns',      label: 'Campaigns',            desc: 'Email, SMS and WhatsApp campaign sending' },
                        { key: 'feature_marketing',      label: 'Marketing',            desc: 'Post creation and scheduling' },
                        { key: 'feature_feedback',       label: 'Feedback',             desc: 'Customer feedback requests and surveys' },
                      ] as { key: keyof LimitsForm; label: string; desc: string }[]).map(({ key, label, desc }) => {
                        const checked = form.limits[key] as boolean;
                        return (
                          <div key={key} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${checked ? 'border-[#D8CCFF] bg-[#FDFCFF]' : 'border-[#E5E7EB] bg-[#FAFAFA]'}`}>
                            <div>
                              <p className="text-xs font-medium text-[#374151]">{label}</p>
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{desc}</p>
                            </div>
                            <button type="button" role="switch" aria-checked={checked}
                              onClick={() => setForm(f => ({ ...f, limits: { ...f.limits, [key]: !checked } }))}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}>
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Core Limits */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Core Limits</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Locations</label>
                        <input type="number" min="1" value={form.limits.locations}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, locations: e.target.value } }))}
                          className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-1.5">Team Members</label>
                        <input type="number" min="0" value={form.limits.team_members}
                          onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, team_members: e.target.value } }))}
                          className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-2">Team: 0 = locked, 1 = owner only, 2+ = can invite members.</p>
                  </div>

                  {/* Usage Limits */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Usage Limits</p>
                    <div className="space-y-2">
                      {([
                        { label: 'Published Replies', unlimitedKey: 'replies_unlimited' as const, limitKey: 'replies_limit' as const, resetKey: 'replies_reset' as const },
                        { label: 'AI Drafts',         unlimitedKey: 'ai_drafts_unlimited' as const, limitKey: 'ai_drafts_limit' as const, resetKey: 'ai_drafts_reset' as const },
                      ]).map(({ label, unlimitedKey, limitKey, resetKey }) => {
                        const isUnlimited = form.limits[unlimitedKey];
                        return (
                          <div key={label} className="border border-[#E5E7EB] rounded-xl px-4 py-3 bg-white">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-xs font-medium text-[#374151]">{label}</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-[11px] text-[#6B7280]">Unlimited</span>
                                <button type="button" role="switch" aria-checked={isUnlimited}
                                  onClick={() => setForm(f => ({ ...f, limits: { ...f.limits, [unlimitedKey]: !isUnlimited } }))}
                                  className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isUnlimited ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}>
                                  <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${isUnlimited ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                              </label>
                            </div>
                            {!isUnlimited ? (
                              <div className="flex items-center gap-2">
                                <input type="number" min="0" value={form.limits[limitKey]}
                                  onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [limitKey]: e.target.value } }))}
                                  placeholder="e.g. 100"
                                  className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white" />
                                <select value={form.limits[resetKey]}
                                  onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [resetKey]: e.target.value as 'monthly' | 'weekly' } }))}
                                  className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] bg-white">
                                  <option value="monthly">per month</option>
                                  <option value="weekly">per week</option>
                                </select>
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#6C55E8] font-semibold">Unlimited</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Campaign Limits */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Campaign Limits <span className="font-normal text-[#9CA3AF]">(per month)</span></p>
                    <div className="space-y-2">
                      {([
                        { label: 'Email',    unlimitedKey: 'campaign_emails_unlimited',   limitKey: 'campaign_emails_limit',    active: true  },
                        { label: 'SMS',      unlimitedKey: 'campaign_sms_unlimited',      limitKey: 'campaign_sms_limit',       active: false },
                        { label: 'WhatsApp', unlimitedKey: 'campaign_whatsapp_unlimited', limitKey: 'campaign_whatsapp_limit',  active: false },
                      ] as { label: string; unlimitedKey: keyof LimitsForm; limitKey: keyof LimitsForm; active: boolean }[]).map(ch => {
                        const isUnlimited = form.limits[ch.unlimitedKey] as boolean;
                        return (
                          <div key={ch.label} className={`border border-[#E5E7EB] rounded-xl px-4 py-3 bg-white ${!ch.active ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[#374151]">{ch.label}</span>
                                {!ch.active && <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded-md">Coming soon</span>}
                              </div>
                              <label className="flex items-center gap-2">
                                <span className="text-[11px] text-[#6B7280]">Unlimited</span>
                                <button type="button" disabled={!ch.active} role="switch" aria-checked={isUnlimited}
                                  onClick={() => ch.active && setForm(f => ({ ...f, limits: { ...f.limits, [ch.unlimitedKey]: !isUnlimited } }))}
                                  className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isUnlimited ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}>
                                  <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${isUnlimited ? 'translate-x-3' : 'translate-x-0'}`} />
                                </button>
                              </label>
                            </div>
                            {!isUnlimited ? (
                              <div className="flex items-center gap-2">
                                <input type="number" min="0" disabled={!ch.active}
                                  value={form.limits[ch.limitKey] as string}
                                  onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [ch.limitKey]: e.target.value } }))}
                                  placeholder="0 = no access"
                                  className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C55E8]/20 focus:border-[#6C55E8] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] bg-white" />
                                <span className="text-xs text-[#9CA3AF]">/mo</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#6C55E8] font-semibold">Unlimited per month</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1.5">SMS &amp; WhatsApp are saved but inactive until channels are enabled.</p>
                  </div>

                  {/* Marketing & Feedback Limits */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Marketing &amp; Feedback Limits</p>
                    <div className="space-y-2">
                      {([
                        { label: 'Marketing Posts',    unlimitedKey: 'marketing_posts_unlimited' as const,    limitKey: 'marketing_posts_limit' as const,    unit: 'posts/mo' },
                        { label: 'Feedback Requests',  unlimitedKey: 'feedback_requests_unlimited' as const,  limitKey: 'feedback_requests_limit' as const,  unit: 'req/mo' },
                      ]).map(({ label, unlimitedKey, limitKey, unit }) => {
                        const isUnlimited = form.limits[unlimitedKey];
                        return (
                          <div key={label} className="border border-[#E5E7EB] rounded-xl px-4 py-3 bg-white opacity-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[#374151]">{label}</span>
                                <span className="text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded-md">Coming soon</span>
                              </div>
                              <label className="flex items-center gap-2">
                                <span className="text-[11px] text-[#6B7280]">Unlimited</span>
                                <div className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent ${isUnlimited ? 'bg-[#6C55E8]' : 'bg-[#D1D5DB]'}`}>
                                  <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${isUnlimited ? 'translate-x-3' : 'translate-x-0'}`} />
                                </div>
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" min="0" disabled
                                value={form.limits[limitKey]}
                                onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, [limitKey]: e.target.value } }))}
                                placeholder="0 = no access"
                                className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] bg-white" />
                              <span className="text-xs text-[#9CA3AF]">{unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brand Brain Steps */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-1">Brand Brain Steps Unlocked</p>
                    <p className="text-[11px] text-[#9CA3AF] mb-3">Preview is always shown. Unchecked steps show a lock icon.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Identity','Voice','Format','Rules','Guardrails','Locations'] as string[]).map((lbl, idx) => {
                        const bit = idx + 1;
                        const mask = parseInt(form.limits.brand_brain_steps) || 0;
                        const checked = !!(mask & (1 << (bit - 1)));
                        return (
                          <label key={bit} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-colors ${checked ? 'border-[#D8CCFF] bg-[#FDFCFF]' : 'border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const newMask = checked ? mask & ~(1 << (bit - 1)) : mask | (1 << (bit - 1));
                                setForm(f => ({ ...f, limits: { ...f.limits, brand_brain_steps: String(newMask) } }));
                              }}
                              className="w-3.5 h-3.5 accent-[#6C55E8] cursor-pointer" />
                            <span className={`text-xs font-medium ${checked ? 'text-[#6C55E8]' : 'text-[#6B7280]'}`}>{lbl}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Support Tier */}
                  <div>
                    <p className="text-xs font-semibold text-[#374151] mb-3">Support Tier</p>
                    <div className="space-y-2">
                      {([
                        { value: 'help_guides',     label: 'Help center guides',  desc: 'Self-service documentation only' },
                        { value: 'standard_email',  label: 'Standard email',      desc: 'Email support with standard SLA' },
                        { value: 'priority_email',  label: 'Priority email',      desc: 'Faster response times and dedicated support' },
                      ]).map(({ value, label, desc }) => (
                        <label key={value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${form.limits.support_tier === value ? 'border-[#6C55E8] bg-[#FDFCFF]' : 'border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.limits.support_tier === value ? 'border-[#6C55E8]' : 'border-[#D1D5DB]'}`}>
                            {form.limits.support_tier === value && <div className="w-1.5 h-1.5 rounded-full bg-[#6C55E8]" />}
                          </div>
                          <input type="radio" value={value} checked={form.limits.support_tier === value}
                            onChange={e => setForm(f => ({ ...f, limits: { ...f.limits, support_tier: e.target.value } }))}
                            className="sr-only" />
                          <div>
                            <p className="text-xs font-medium text-[#374151]">{label}</p>
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-7 py-4 border-t border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-[#9CA3AF]">
                {editingId ? 'Changes apply immediately.' : 'New plan will be in Draft until activated.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-[#6C55E8] text-white rounded-xl hover:bg-[#5A42D1] disabled:opacity-50 transition-colors shadow-sm">
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[#111827] mb-1.5">Delete Package?</h2>
            <p className="text-sm text-[#6B7280] mb-5">
              This will permanently delete the package and all its prices. Active subscribers will not be affected but the plan will no longer be selectable.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Type <span className="font-mono font-bold text-[#111827]">{deleteName}</span> to confirm
              </label>
              <input
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deleteConfirmInput === deleteName) handleDelete(); }}
                placeholder={deleteName}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteId(null); setDeleteName(''); setDeleteConfirmInput(''); }}
                className="px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting || deleteConfirmInput !== deleteName}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {deleting ? 'Deleting…' : 'Delete Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
