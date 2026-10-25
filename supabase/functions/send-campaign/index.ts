import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function replaceTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '');
}

function buildEmailHtml(bodyText: string, trackOpenUrl: string, trackClickUrl: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:#0D4C3C;padding:20px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">Moffu</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="font-size:15px;line-height:1.7;color:#374151;">${bodyText.replace(/\n/g, '<br>')}</div>
          <div style="margin-top:28px;text-align:center;">
            <a href="${trackClickUrl}" style="display:inline-block;background:#0D4C3C;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">Leave a Review</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            You received this email because you interacted with our business.<br>
            <a href="${unsubUrl}" style="color:#9CA3AF;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="">
</body>
</html>`;
}

// ── Entitlement checker ─────────────────────────────────────────────────────

interface Entitlement {
  value_type: string;
  limit_value: number | null;
  usage_reset: string | null;
}

async function checkCampaignEmailLimit(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  newEmailCount: number,
): Promise<{ allowed: boolean; reason?: string; limit: number | null; used: number }> {

  // 1. Find org owner → their subscription → plan
  const { data: owner } = await adminClient
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (!owner) {
    return { allowed: false, reason: 'No owner found for this organization.', limit: 0, used: 0 };
  }

  const { data: sub } = await adminClient
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', owner.user_id)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .single();

  if (!sub) {
    return { allowed: false, reason: 'No active subscription found. Please upgrade your plan to send campaigns.', limit: 0, used: 0 };
  }

  // 2. Get campaign_emails entitlement for the plan
  const { data: ent } = await adminClient
    .from('plan_entitlements')
    .select('value_type, limit_value, usage_reset')
    .eq('plan_id', sub.plan_id)
    .eq('key', 'campaign_emails')
    .single() as { data: Entitlement | null };

  // No entitlement row = feature not included on this plan
  if (!ent) {
    return { allowed: false, reason: 'Campaign emails are not included in your current plan. Please upgrade to send review request campaigns.', limit: 0, used: 0 };
  }

  // Unlimited
  if (ent.value_type === 'UNLIMITED') {
    return { allowed: true, limit: null, used: 0 };
  }

  const limitValue = ent.limit_value ?? 0;

  // Limit = 0 means feature is blocked on this plan
  if (limitValue === 0) {
    return { allowed: false, reason: 'Campaign emails are not included in your current plan. Please upgrade to send review request campaigns.', limit: 0, used: 0 };
  }

  // 3. Count emails sent this month for this org
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await adminClient
    .from('campaign_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'sent')
    .gte('created_at', monthStart)
    .in('campaign_id', (
      adminClient
        .from('campaigns')
        .select('id')
        .eq('org_id', orgId)
    ) as unknown as string[]);

  // Fallback: direct count query if the above doesn't work
  const { data: countData } = await adminClient.rpc('count_org_campaign_emails_this_month', {
    p_org_id: orgId,
    p_month_start: monthStart,
  }).catch(() => ({ data: null }));

  const used = typeof countData === 'number' ? countData : (count ?? 0);
  const remaining = limitValue - used;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You have reached your monthly email limit of ${limitValue}. Used: ${used}. Resets on the 1st of next month.`,
      limit: limitValue,
      used,
    };
  }

  // Would this campaign exceed the limit?
  if (used + newEmailCount > limitValue) {
    return {
      allowed: false,
      reason: `This campaign would send ${newEmailCount} emails but you only have ${remaining} remaining this month (limit: ${limitValue}, used: ${used}).`,
      limit: limitValue,
      used,
    };
  }

  return { allowed: true, limit: limitValue, used };
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey       = Deno.env.get('RESEND_API_KEY') ?? '';

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { campaign_id } = await req.json() as { campaign_id: string };
    if (!campaign_id) return json({ error: 'campaign_id required' }, 400);

    // Load campaign
    const { data: campaign, error: campErr } = await adminClient
      .from('campaigns')
      .select('*, organizations(name)')
      .eq('id', campaign_id)
      .single();
    if (campErr || !campaign) return json({ error: 'Campaign not found' }, 404);

    // Verify caller is an org member
    const { data: mem } = await adminClient
      .from('org_members')
      .select('role')
      .eq('org_id', campaign.org_id)
      .eq('user_id', user.id)
      .single();
    if (!mem) return json({ error: 'Forbidden' }, 403);

    if (campaign.status === 'sent') return json({ error: 'Campaign already sent' }, 409);

    // Load pending contacts
    const { data: contacts } = await adminClient
      .from('campaign_contacts')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending');

    if (!contacts?.length) {
      await adminClient.from('campaigns')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', campaign_id);
      return json({ sent_count: 0 });
    }

    // ── Entitlement check ───────────────────────────────────────────────────
    const limitCheck = await checkCampaignEmailLimit(adminClient, campaign.org_id, contacts.length);

    if (!limitCheck.allowed) {
      // Mark campaign as failed with reason
      await adminClient.from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign_id);

      return json({
        error: limitCheck.reason,
        limit_exceeded: true,
        limit: limitCheck.limit,
        used: limitCheck.used,
      }, 402); // 402 Payment Required — clear signal to upgrade
    }
    // ───────────────────────────────────────────────────────────────────────

    // Mark sending
    await adminClient.from('campaigns').update({ status: 'sending' }).eq('id', campaign_id);

    const orgName    = (campaign.organizations as any)?.name ?? 'Moffu';
    const fromName   = campaign.from_name || orgName;
    const fromEmail  = `noreply@moffu.com`;
    const reviewLink = campaign.review_link || 'https://g.page/r/review';
    const trackBase  = `${supabaseUrl}/functions/v1/campaign-track`;

    let sentCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
      const tokens: Record<string, string> = {
        name:          contact.name ?? 'Valued Customer',
        business_name: orgName,
        review_link:   reviewLink,
      };

      const subject  = replaceTokens(campaign.subject ?? "We'd love your feedback!", tokens);
      const bodyText = replaceTokens(campaign.body ?? '', tokens);

      const trackOpenUrl  = `${trackBase}?event=open&contact_id=${contact.id}&campaign_id=${campaign_id}`;
      const trackClickUrl = `${trackBase}?event=click&contact_id=${contact.id}&campaign_id=${campaign_id}&url=${encodeURIComponent(reviewLink)}`;
      const unsubUrl      = `${trackBase}?event=unsubscribe&contact_id=${contact.id}&campaign_id=${campaign_id}`;

      const html = buildEmailHtml(bodyText, trackOpenUrl, trackClickUrl, unsubUrl);

      try {
        if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:     `${fromName} <${fromEmail}>`,
            to:       [contact.email],
            reply_to: campaign.reply_to || undefined,
            subject,
            html,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).message ?? `Resend HTTP ${res.status}`);
        }

        await adminClient.from('campaign_contacts')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', contact.id);
        await adminClient.from('campaign_events')
          .insert({ campaign_id, contact_id: contact.id, event_type: 'sent' });
        sentCount++;

      } catch (e: any) {
        await adminClient.from('campaign_contacts')
          .update({ status: 'failed', error: e.message })
          .eq('id', contact.id);
        await adminClient.from('campaign_events')
          .insert({ campaign_id, contact_id: contact.id, event_type: 'failed', meta: { error: e.message } });
        failCount++;
      }
    }

    const finalStatus = sentCount > 0 ? 'sent' : 'failed';
    await adminClient.from('campaigns').update({
      status:         finalStatus,
      sent_at:        new Date().toISOString(),
      sent_count:     sentCount,
      total_contacts: contacts.length,
    }).eq('id', campaign_id);

    await adminClient.from('audit_events').insert({
      actor_id:    user.id,
      action:      'campaign_sent',
      target_type: 'campaign',
      target_id:   campaign_id,
      meta:        { sent_count: sentCount, fail_count: failCount, limit: limitCheck.limit, used_before: limitCheck.used },
    }).catch(() => {});

    return json({ sent_count: sentCount, fail_count: failCount, limit: limitCheck.limit, used_before: limitCheck.used });

  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
