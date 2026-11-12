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
      case 'transaction.payment_failed': {
        await handlePaymentFailed(supabase, data);
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

  // Update subscription
  await supabase
    .from('subscriptions')
    .update({ paddle_transaction_id: transactionId, paddle_customer_id: customerId, payment_failure_count: 0 })
    .eq('user_id', userId);

  // Parse amount from details.totals (Paddle sends cents as integer string)
  const details = (data.details as Record<string, unknown> | null) ?? {};
  const totals = (details.totals as Record<string, unknown> | null) ?? {};
  const grandTotalRaw = totals.grand_total as string ?? '0';
  const amountCents = parseInt(grandTotalRaw, 10) || 0;
  const currency = (data.currency_code as string) ?? 'USD';

  // Get plan name and billing interval from items
  const items = (data.items as Array<{ price?: { id?: string }; product?: { name?: string } }>) ?? [];
  const priceId = items[0]?.price?.id;
  const productName = items[0]?.product?.name ?? null;
  const priceInfo = priceId ? await getPaddlePriceInfo(priceId) : null;

  // Store transaction record
  await supabase.from('paddle_transactions').upsert({
    user_id: userId,
    paddle_transaction_id: transactionId,
    paddle_subscription_id: (data.subscription_id as string) ?? null,
    plan_name: productName,
    billing_interval: priceInfo?.billing_interval ?? null,
    amount_cents: amountCents,
    currency,
    status: 'completed',
  }, { onConflict: 'paddle_transaction_id' });
}

async function handlePaymentFailed(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>) {
  const customData = (data.custom_data as Record<string, string> | null) ?? {};
  const userId = customData.user_id;
  if (!userId) {
    console.error('No user_id in custom_data for payment_failed');
    return;
  }

  // Increment failure count
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, payment_failure_count')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sub) return;

  const newCount = (sub.payment_failure_count ?? 0) + 1;
  await supabase.from('subscriptions')
    .update({ payment_failure_count: newCount })
    .eq('id', sub.id);

  // Get owner email
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.email;
  const name = profile?.display_name ?? null;

  if (!email) return;

  const webUrl = Deno.env.get('WEB_URL') ?? 'https://moffu.pro';

  if (newCount >= 3) {
    // Suspend org
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .maybeSingle();

    if (orgMember) {
      await supabase.from('organizations')
        .update({ status: 'suspended' })
        .eq('id', orgMember.org_id);

      await supabase.from('audit_events').insert({
        actor_id: null,
        action: 'auto_suspend_org_payment_failure',
        target_type: 'organization',
        target_id: orgMember.org_id,
        meta: { reason: 'payment_failure', failure_count: newCount, user_id: userId },
      });
    }

    await sendEmail(email, 'Your Moffu account has been suspended', suspendedEmailHtml(name, webUrl));
  } else {
    await sendEmail(email, 'Payment failed — please update your billing details', paymentFailedEmailHtml(name, newCount, webUrl));
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.error('RESEND_API_KEY not set'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Moffu <notifications@moffu.pro>', to: [to], subject, html }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

function emailWrapper(content: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:28px;">
        <div style="background:#6C55E8;border-radius:12px;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:20px;font-weight:800;line-height:40px;">M</span>
        </div>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #E5E7EB;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        ${content}
      </td></tr>
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#D1D5DB;">Powered by <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">Moffu</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function paymentFailedEmailHtml(name: string | null, attempt: number, webUrl: string) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return emailWrapper(`
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Billing alert</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">Payment failed</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      ${greeting}<br/>
      We were unable to process your payment (attempt ${attempt} of 3). Please update your billing details to avoid service interruption.
    </p>
    <a href="${webUrl}/billing" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
      Update payment details
    </a>
    <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
      If we cannot process payment after 3 attempts, your account will be suspended. Contact <a href="mailto:support@moffu.pro" style="color:#6C55E8;">support@moffu.pro</a> if you need help.
    </p>
  `);
}

function suspendedEmailHtml(name: string | null, webUrl: string) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return emailWrapper(`
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#DC2626;text-transform:uppercase;letter-spacing:0.08em;">Account suspended</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">Your account has been suspended</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      ${greeting}<br/>
      After 3 unsuccessful payment attempts, your Moffu account has been suspended. Update your billing details to restore access immediately.
    </p>
    <a href="${webUrl}/billing" style="display:inline-block;background:#DC2626;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
      Restore access
    </a>
    <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
      Your data is safe and will be retained. Reply to this email or contact <a href="mailto:support@moffu.pro" style="color:#6C55E8;">support@moffu.pro</a> if you need assistance.
    </p>
  `);
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
