import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type EventType = 'ai_draft' | 'published_reply';

const ENTITLEMENT_KEY: Record<EventType, string> = {
  ai_draft: 'ai_drafts',
  published_reply: 'published_replies',
};

export async function checkAndRecordUsage(
  supabase: SupabaseClient,
  userId: string,
  eventType: EventType,
  reviewId?: string,
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  // 1. Get active subscription + entitlement in one query
  const entKey = ENTITLEMENT_KEY[eventType];

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_start, current_period_end, plan_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // No active subscription → deny
  if (!sub) return { allowed: false, used: 0, limit: 0 };

  const { data: ent } = await supabase
    .from('plan_entitlements')
    .select('value_type, limit_value, usage_reset')
    .eq('plan_id', sub.plan_id)
    .eq('key', entKey)
    .maybeSingle();

  // UNLIMITED or no entitlement row → allow without counting
  if (!ent || ent.value_type === 'UNLIMITED') {
    return { allowed: true, used: 0, limit: null };
  }

  // 2. Compute period window
  const resetCadence = ent.usage_reset as 'weekly' | 'monthly' | null ?? 'monthly';
  let periodStart: string;
  let periodEnd: string;

  if (resetCadence === 'weekly') {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    periodStart = start.toISOString();
    periodEnd = now.toISOString();
  } else {
    periodStart = sub.current_period_start;
    periodEnd = sub.current_period_end;
  }

  // 3. Count usage in period
  const { count } = await supabase
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const used = count ?? 0;
  const limit = ent.limit_value ?? 0;

  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  return { allowed: true, used, limit };
}
