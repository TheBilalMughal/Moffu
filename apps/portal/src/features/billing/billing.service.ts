import { supabase } from '@/lib/supabase';

export type PlanSlug = 'free' | 'starter' | 'growth' | 'scale';

export interface Plan {
  id: string;
  slug: PlanSlug;
  name: string;
  sort_order: number;
  prices: { interval: 'monthly' | 'annual'; amount_cents: number }[];
  entitlements: Record<string, { value_type: string; limit_value: number | null; bool_value: boolean | null; enum_value: string | null; usage_reset: string | null }>;
  location_addon_cents: number | null;
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

function periodWindow(sub: Subscription, resetCadence: 'weekly' | 'monthly'): { start: Date; end: Date } {
  if (resetCadence === 'weekly') {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start, end: now };
  }
  return {
    start: new Date(sub.current_period_start),
    end: new Date(sub.current_period_end),
  };
}

export const billingService = {
  async getPlans(): Promise<Plan[]> {
    const [plansRes, pricesRes, entRes, addonRes] = await Promise.all([
      supabase.from('plans').select('id, slug, name, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('is_active', true),
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
      sort_order: p.sort_order,
      prices: prices.filter(pr => pr.plan_id === p.id).map(pr => ({ interval: pr.billing_interval as 'monthly' | 'annual', amount_cents: pr.amount_cents })),
      entitlements: Object.fromEntries(
        entitlements.filter(e => e.plan_id === p.id).map(e => [e.key, { value_type: e.value_type, limit_value: e.limit_value, bool_value: e.bool_value, enum_value: e.enum_value, usage_reset: e.usage_reset }])
      ),
      location_addon_cents: addons.find(a => a.plan_id === p.id)?.unit_price_cents ?? null,
    }));
  },

  async getSubscription(): Promise<Subscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, plans(slug, name), subscription_addons(addon_type, quantity)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!data) return null;

    const plan = (Array.isArray(data.plans) ? data.plans[0] : data.plans) as { slug: string; name: string } | null;
    const addons = (data.subscription_addons as { addon_type: string; quantity: number }[] | null) ?? [];
    const extraLocations = addons.filter(a => a.addon_type === 'extra_location').reduce((s, a) => s + a.quantity, 0);

    return {
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
    };
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

    const resetLabel = resetCadence === 'weekly' ? 'Resets weekly' : 'Resets monthly';

    return {
      ai_drafts_used: draftsUsed,
      ai_drafts_limit: draftEnt?.value_type === 'UNLIMITED' ? null : (draftEnt?.limit_value ?? null),
      published_replies_used: repliesUsed,
      published_replies_limit: replyEnt?.value_type === 'UNLIMITED' ? null : (replyEnt?.limit_value ?? null),
      reset_label: resetLabel,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    };
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
