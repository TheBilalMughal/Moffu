import { supabase } from '@/lib/supabase';

export type PlanSlug = 'free' | 'starter' | 'growth' | 'scale';

export interface Plan {
  id: string;
  slug: PlanSlug;
  name: string;
  description: string | null;
  features: string[];
  badge_text: string | null;
  is_featured: boolean;
  contact_sales: boolean;
  sort_order: number;
  prices: { interval: 'monthly' | 'annual'; amount_cents: number; paddle_price_id: string | null }[];
  entitlements: Record<string, { value_type: string; limit_value: number | null; bool_value: boolean | null; enum_value: string | null; usage_reset: string | null }>;
  location_addon_cents: number | null;
  discount_type: 'fixed' | 'percent' | null;
  discount_value: number | null;
}

export interface AddonItem {
  id: string;
  addon_type: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Subscription {
  id: string;
  plan_id: string;
  plan_slug: PlanSlug;
  plan_name: string;
  status: string;
  billing_interval: 'monthly' | 'annual' | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  extra_locations: number;
  addon_items: AddonItem[];
  overage_protection: boolean;
}

export interface UsageSummary {
  ai_drafts_used: number;
  ai_drafts_limit: number | null;
  published_replies_used: number;
  published_replies_limit: number | null;
  reset_label: string;
  period_start: string;
  period_end: string;
}

export interface UsageDay {
  date: string; // YYYY-MM-DD
  ai_drafts: number;
  published_replies: number;
}

function periodWindow(sub: Subscription, resetCadence: 'weekly' | 'monthly'): { start: Date; end: Date } {
  if (resetCadence === 'weekly') {
    const anchor = new Date(sub.current_period_start);
    const now = new Date();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceAnchor = Math.floor((now.getTime() - anchor.getTime()) / msPerWeek);
    const start = new Date(anchor.getTime() + weeksSinceAnchor * msPerWeek);
    const end = new Date(start.getTime() + msPerWeek);
    return { start, end };
  }
  return {
    start: new Date(sub.current_period_start),
    end: new Date(sub.current_period_end),
  };
}

export const billingService = {
  async getPlans(): Promise<Plan[]> {
    const [plansRes, pricesRes, entRes, addonRes] = await Promise.all([
      supabase.from('plans').select('id, slug, name, description, features, badge_text, is_featured, contact_sales, sort_order, discount_type, discount_value').eq('is_active', true).order('sort_order'),
      supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents, paddle_price_id').eq('is_active', true),
      supabase.from('plan_entitlements').select('plan_id, key, value_type, limit_value, bool_value, enum_value, usage_reset'),
      supabase.from('plan_location_addons').select('plan_id, unit_price_cents'),
    ]);

    const plans = plansRes.data ?? [];
    const prices = pricesRes.data ?? [];
    const entitlements = entRes.data ?? [];
    const addons = addonRes.data ?? [];

    return plans.map(p => ({
      id: p.id,
      slug: p.slug as PlanSlug,
      name: p.name,
      description: p.description ?? null,
      features: Array.isArray(p.features) ? p.features : [],
      badge_text: p.badge_text ?? null,
      is_featured: p.is_featured ?? false,
      contact_sales: p.contact_sales ?? false,
      sort_order: p.sort_order,
      prices: prices.filter(pr => pr.plan_id === p.id).map(pr => ({ interval: pr.billing_interval as 'monthly' | 'annual', amount_cents: pr.amount_cents, paddle_price_id: pr.paddle_price_id ?? null })),
      entitlements: Object.fromEntries(
        entitlements.filter(e => e.plan_id === p.id).map(e => [e.key, { value_type: e.value_type, limit_value: e.limit_value, bool_value: e.bool_value, enum_value: e.enum_value, usage_reset: e.usage_reset }])
      ),
      location_addon_cents: addons.find(a => a.plan_id === p.id)?.unit_price_cents ?? null,
      discount_type: (p.discount_type as 'fixed' | 'percent' | null) ?? null,
      discount_value: p.discount_value ?? null,
    }));
  },

  async getSubscription(): Promise<Subscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, plans(slug, name), subscription_addons(id, addon_type, quantity, unit_price_cents)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!data) return null;

    const plan = (Array.isArray(data.plans) ? data.plans[0] : data.plans) as { slug: string; name: string } | null;
    const rawAddons = (data.subscription_addons as { id: string; addon_type: string; quantity: number; unit_price_cents: number }[] | null) ?? [];
    const extraLocations = rawAddons.filter(a => a.addon_type === 'extra_location').reduce((s, a) => s + a.quantity, 0);

    const result: Subscription = {
      id: data.id,
      plan_id: data.plan_id,
      plan_slug: (plan?.slug ?? 'free') as PlanSlug,
      plan_name: plan?.name ?? 'Free',
      status: data.status,
      billing_interval: data.billing_interval as 'monthly' | 'annual' | null,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      cancel_at_period_end: data.cancel_at_period_end,
      extra_locations: extraLocations,
      addon_items: rawAddons.map(a => ({ id: a.id, addon_type: a.addon_type, quantity: a.quantity, unit_price_cents: a.unit_price_cents })),
      overage_protection: true,
    };

    // Fetch overage_protection separately so a missing column (pre-migration) doesn't break the main query
    try {
      const { data: op } = await supabase
        .from('subscriptions')
        .select('overage_protection')
        .eq('id', result.id)
        .maybeSingle();
      if (op && typeof (op as { overage_protection?: boolean }).overage_protection === 'boolean') {
        result.overage_protection = (op as { overage_protection: boolean }).overage_protection;
      }
    } catch { /* column may not exist yet — default true stays */ }

    return result;
  },

  async updateOverageProtection(subId: string, enabled: boolean): Promise<void> {
    await supabase.from('subscriptions').update({ overage_protection: enabled }).eq('id', subId);
  },

  getOveragePricePerReplyCents(sub: Subscription, plans: Plan[]): number | null {
    const plan = plans.find(p => p.id === sub.plan_id);
    if (!plan) return null;
    const replyEnt = plan.entitlements['published_replies'];
    if (!replyEnt || replyEnt.value_type === 'UNLIMITED' || !replyEnt.limit_value) return null;
    const monthlyPrice = sub.billing_interval === 'annual'
      ? (plan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0) / 12
      : (plan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0);
    if (monthlyPrice === 0) return null;
    return Math.ceil(monthlyPrice / replyEnt.limit_value);
  },

  async getUsage(sub: Subscription, plans: Plan[]): Promise<UsageSummary> {
    const plan = plans.find(p => p.id === sub.plan_id);
    const draftEnt = plan?.entitlements['ai_drafts'];
    const replyEnt = plan?.entitlements['published_replies'];
    const resetCadence = (draftEnt?.usage_reset ?? 'monthly') as 'weekly' | 'monthly';
    const { start, end } = periodWindow(sub, resetCadence);

    const { data: events } = await supabase
      .from('usage_events')
      .select('event_type')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const evts = events ?? [];
    const draftsUsed = evts.filter(e => e.event_type === 'ai_draft').length;
    const repliesUsed = evts.filter(e => e.event_type === 'published_reply').length;

    return {
      ai_drafts_used: draftsUsed,
      ai_drafts_limit: draftEnt?.value_type === 'UNLIMITED' ? null : (draftEnt?.limit_value ?? null),
      published_replies_used: repliesUsed,
      published_replies_limit: replyEnt?.value_type === 'UNLIMITED' ? null : (replyEnt?.limit_value ?? null),
      reset_label: (() => {
        const msLeft = end.getTime() - Date.now();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) return 'Resets today';
        if (daysLeft === 1) return 'Resets tomorrow';
        return `${daysLeft} days remaining`;
      })(),
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    };
  },

  async getUsageHistory(): Promise<UsageDay[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const since = new Date();
    since.setDate(since.getDate() - 29);

    const { data } = await supabase
      .from('usage_events')
      .select('event_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at');

    const map = new Map<string, UsageDay>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, ai_drafts: 0, published_replies: 0 });
    }

    for (const e of data ?? []) {
      const key = (e.created_at as string).slice(0, 10);
      const day = map.get(key);
      if (day) {
        if (e.event_type === 'ai_draft') day.ai_drafts++;
        else if (e.event_type === 'published_reply') day.published_replies++;
      }
    }

    return Array.from(map.values());
  },

  async checkLimit(eventType: 'ai_draft' | 'published_reply'): Promise<{ allowed: boolean; used: number; limit: number | null }> {
    const [sub, plans] = await Promise.all([this.getSubscription(), this.getPlans()]);
    if (!sub) return { allowed: false, used: 0, limit: 0 };

    const plan = plans.find(p => p.id === sub.plan_id);
    const key = eventType === 'ai_draft' ? 'ai_drafts' : 'published_replies';
    const ent = plan?.entitlements[key];

    if (!ent || ent.value_type === 'UNLIMITED') return { allowed: true, used: 0, limit: null };

    const resetCadence = (ent.usage_reset ?? 'monthly') as 'weekly' | 'monthly';
    const { start, end } = periodWindow(sub, resetCadence);

    const { count } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', eventType)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const used = count ?? 0;
    const limit = ent.limit_value ?? 0;
    return { allowed: used < limit, used, limit };
  },

  async recordUsage(eventType: 'ai_draft' | 'published_reply', reviewId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('usage_events').insert({ user_id: user.id, event_type: eventType, review_id: reviewId ?? null });
  },
};
