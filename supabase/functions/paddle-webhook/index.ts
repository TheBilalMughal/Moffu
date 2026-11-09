import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paddle-signature',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Paddle Billing webhook signature verification (h1=HMAC-SHA256)
async function verifyPaddleSignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(';').map(p => p.split('=')));
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${body}`));
  const computed = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === h1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('PADDLE_WEBHOOK_SECRET not set');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('paddle-signature');

  const valid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
  if (!valid) {
    console.error('Invalid Paddle signature');
    return json({ error: 'Invalid signature' }, 401);
  }

  let event: { event_type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { event_type, data } = event;
  console.log('Paddle event:', event_type, data?.id);

  try {
    switch (event_type) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.activated': {
        await handleSubscriptionUpsert(supabase, data);
        break;
      }
      case 'subscription.canceled': {
        await handleSubscriptionCanceled(supabase, data);
        break;
      }
      case 'subscription.paused': {
        await handleSubscriptionPaused(supabase, data);
        break;
      }
      case 'transaction.completed': {
        await handleTransactionCompleted(supabase, data);
        break;
      }
      default:
        console.log('Unhandled Paddle event:', event_type);
    }
  } catch (err) {
    console.error('Error handling Paddle event:', event_type, err);
    return json({ error: 'Handler error' }, 500);
  }

  return json({ received: true });
});

async function getPaddlePriceInfo(priceId: string) {
  // Look up plan_id and billing_interval from paddle_price_id
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data } = await supabase
    .from('plan_prices')
    .select('plan_id, billing_interval')
    .eq('paddle_price_id', priceId)
    .maybeSingle();
  return data;
}

async function handleSubscriptionUpsert(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const paddleSubId = data.id as string;
  const customerId = (data.customer_id as string) ?? null;
  const status = mapStatus(data.status as string);
  const customData = (data.custom_data as Record<string, string> | null) ?? {};
  const userId = customData.user_id;

  if (!userId) {
    console.error('No user_id in custom_data for subscription', paddleSubId);
    return;
  }

  // Get price from first item
  const items = (data.items as Array<{ price: { id: string } }>) ?? [];
  const priceId = items[0]?.price?.id;
  const priceInfo = priceId ? await getPaddlePriceInfo(priceId) : null;

  const scheduledChange = data.scheduled_change as { action: string } | null;
  const cancelAtPeriodEnd = scheduledChange?.action === 'cancel';

  const currentPeriodStart = (data.current_billing_period as { starts_at: string } | null)?.starts_at ?? new Date().toISOString();
  const currentPeriodEnd = (data.current_billing_period as { ends_at: string } | null)?.ends_at ?? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

  const updatePayload: Record<string, unknown> = {
    paddle_subscription_id: paddleSubId,
    paddle_customer_id: customerId,
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  if (priceInfo) {
    updatePayload.plan_id = priceInfo.plan_id;
    updatePayload.billing_interval = priceInfo.billing_interval;
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert({ user_id: userId, ...updatePayload }, { onConflict: 'user_id' });

  if (error) console.error('Error upserting subscription:', error);
}

async function handleSubscriptionCanceled(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const paddleSubId = data.id as string;
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', paddleSubId);
  if (error) console.error('Error canceling subscription:', error);
}

async function handleSubscriptionPaused(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const paddleSubId = data.id as string;
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', paddleSubId);
  if (error) console.error('Error pausing subscription:', error);
}

async function handleTransactionCompleted(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const transactionId = data.id as string;
  const customerId = (data.customer_id as string) ?? null;
  const customData = (data.custom_data as Record<string, string> | null) ?? {};
  const userId = customData.user_id;
  if (!userId) return;

  await supabase
    .from('subscriptions')
    .update({ paddle_transaction_id: transactionId, paddle_customer_id: customerId })
    .eq('user_id', userId);
}

function mapStatus(paddleStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    paused: 'paused',
  };
  return map[paddleStatus] ?? 'active';
}
