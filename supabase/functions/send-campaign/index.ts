import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function replaceTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '');
}

function buildEmailHtml(body: string, trackOpenUrl: string, trackClickUrl: string, reviewLink: string): string {
  const withClickTracking = body.replace(
    /\{\{review_link\}\}/g,
    `<a href="${trackClickUrl}" style="color:#0D4C3C;font-weight:600;">Leave a Review</a>`,
  );
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
          <div style="font-size:15px;line-height:1.7;color:#374151;">${withClickTracking.replace(/\n/g, '<br>')}</div>
          <div style="margin-top:28px;text-align:center;">
            <a href="${trackClickUrl}" style="display:inline-block;background:#0D4C3C;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">Leave a Review</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            You received this email because you interacted with our business.<br>
            <a href="${trackClickUrl.replace('event=click', 'event=unsubscribe')}" style="color:#9CA3AF;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="">
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const env = {
      supabaseUrl:        Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey:    Deno.env.get('SUPABASE_ANON_KEY')!,
      supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      resendApiKey:       Deno.env.get('RESEND_API_KEY') ?? '',
    };

    const callerClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const adminClient = createClient(env.supabaseUrl, env.supabaseServiceKey);

    // Auth
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { campaign_id } = await req.json() as { campaign_id: string };
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Load campaign
    const { data: campaign, error: campErr } = await adminClient
      .from('campaigns').select('*, organizations(name)').eq('id', campaign_id).single();
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Verify caller belongs to org
    const { data: mem } = await adminClient
      .from('org_members').select('role').eq('org_id', campaign.org_id).eq('user_id', user.id).single();
    if (!mem) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (campaign.status === 'sent') {
      return new Response(JSON.stringify({ error: 'Already sent' }), { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Load pending contacts
    const { data: contacts } = await adminClient
      .from('campaign_contacts').select('*').eq('campaign_id', campaign_id).eq('status', 'pending');
    if (!contacts?.length) {
      await adminClient.from('campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaign_id);
      return new Response(JSON.stringify({ sent_count: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Mark sending
    await adminClient.from('campaigns').update({ status: 'sending' }).eq('id', campaign_id);

    const orgName = (campaign.organizations as any)?.name ?? 'Moffu';
    const fromName = campaign.from_name || orgName;
    const fromEmail = `noreply@moffu.com`;
    const reviewLink = campaign.review_link || 'https://g.page/r/review';
    const trackBase = `${env.supabaseUrl}/functions/v1/campaign-track`;

    let sentCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
      const tokens: Record<string, string> = {
        name:          contact.name ?? 'Valued Customer',
        business_name: orgName,
        review_link:   reviewLink,
      };

      const subject  = replaceTokens(campaign.subject ?? 'We\'d love your feedback!', tokens);
      const bodyText = replaceTokens(campaign.body, tokens);

      const trackOpenUrl  = `${trackBase}?event=open&contact_id=${contact.id}&campaign_id=${campaign_id}`;
      const trackClickUrl = `${trackBase}?event=click&contact_id=${contact.id}&campaign_id=${campaign_id}&url=${encodeURIComponent(reviewLink)}`;

      const html = buildEmailHtml(bodyText, trackOpenUrl, trackClickUrl, reviewLink);

      try {
        if (!env.resendApiKey) throw new Error('RESEND_API_KEY not configured');

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
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
          throw new Error((err as any).message ?? `HTTP ${res.status}`);
        }

        await adminClient.from('campaign_contacts').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', contact.id);
        await adminClient.from('campaign_events').insert({ campaign_id, contact_id: contact.id, event_type: 'sent' });
        sentCount++;

      } catch (e: any) {
        await adminClient.from('campaign_contacts').update({ status: 'failed', error: e.message }).eq('id', contact.id);
        await adminClient.from('campaign_events').insert({ campaign_id, contact_id: contact.id, event_type: 'failed', meta: { error: e.message } });
        failCount++;
      }
    }

    const finalStatus = sentCount > 0 ? 'sent' : 'failed';
    await adminClient.from('campaigns').update({
      status:      finalStatus,
      sent_at:     new Date().toISOString(),
      sent_count:  sentCount,
      total_contacts: contacts.length,
    }).eq('id', campaign_id);

    await adminClient.from('audit_events').insert({
      actor_id:    user.id,
      action:      'campaign_sent',
      target_type: 'campaign',
      target_id:   campaign_id,
      meta:        { sent_count: sentCount, fail_count: failCount },
    }).catch(() => {});

    return new Response(JSON.stringify({ sent_count: sentCount, fail_count: failCount }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
