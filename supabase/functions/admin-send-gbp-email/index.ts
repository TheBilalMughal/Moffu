import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const { data: pm } = await supabase
    .from('platform_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!pm) {
    return new Response('Forbidden', { status: 403, headers: CORS });
  }

  let body: { to_email?: string; org_name?: string; org_id?: string };
  try { body = await req.json(); } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS });
  }

  if (!body.to_email || !body.org_name || !body.org_id) {
    return new Response('Missing to_email, org_name, or org_id', { status: 400, headers: CORS });
  }

  // 24h cooldown check
  const { data: recent } = await supabase
    .from('admin_outreach_log')
    .select('sent_at')
    .eq('org_id', body.org_id)
    .eq('email_type', 'gbp_connect')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.sent_at) {
    const elapsed = Date.now() - new Date(recent.sent_at).getTime();
    if (elapsed < TWENTY_FOUR_HOURS) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'cooldown', next_eligible: new Date(new Date(recent.sent_at).getTime() + TWENTY_FOUR_HOURS).toISOString() }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }
  }

  const appUrl = 'https://app.moffu.pro';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <tr><td style="padding-bottom:20px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#6C55E8;border-radius:8px;width:28px;height:28px;text-align:center;vertical-align:middle;">
            <span style="color:#fff;font-size:14px;font-weight:900;line-height:28px;">M</span>
          </td>
          <td style="padding-left:8px;font-size:16px;font-weight:800;color:#1A1A1A;letter-spacing:-0.02em;vertical-align:middle;">Moffu</td>
        </tr></table>
      </td></tr>

      <tr><td style="background:#ffffff;border-radius:8px;border:1px solid #E5E5E5;padding:32px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">

          <tr><td style="padding-bottom:6px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Action Required</p>
          </td></tr>
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1A1A1A;letter-spacing:-0.02em;">Connect your Google Business Profile</h1>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">One step to unlock your review management</p>
          </td></tr>

          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">
              Hi there,<br/><br/>
              Your Moffu account for <strong>${body.org_name}</strong> is set up and ready. The last step is connecting your Google Business Profile so we can start syncing your reviews and generating AI reply drafts.<br/><br/>
              It takes about 30 seconds and you only need to do it once.
            </p>
          </td></tr>

          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <a href="${appUrl}/settings/connections" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:-0.01em;">Connect Google Business</a>
          </td></tr>

          <tr><td style="padding-top:20px;padding-bottom:4px;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Once connected</p>
          </td></tr>
          <tr><td style="padding-bottom:8px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:12px;"><div style="width:5px;height:5px;background:#6C55E8;border-radius:50%;"></div></td>
              <td style="font-size:13px;color:#374151;line-height:1.5;">All your Google reviews sync automatically</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding-bottom:8px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:12px;"><div style="width:5px;height:5px;background:#6C55E8;border-radius:50%;"></div></td>
              <td style="font-size:13px;color:#374151;line-height:1.5;">AI generates on-brand reply drafts in seconds</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:12px;"><div style="width:5px;height:5px;background:#6C55E8;border-radius:50%;"></div></td>
              <td style="font-size:13px;color:#374151;line-height:1.5;">Publish replies directly from Moffu to Google</td>
            </tr></table>
          </td></tr>

          <tr><td>
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Need help? <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
            </p>
          </td></tr>

        </table>
      </td></tr>

      <tr><td style="padding-top:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">
          &copy; ${year} Moffu &middot; <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">moffu.pro</a> &middot; <a href="${appUrl}/settings/notifications" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('RESEND_API_KEY not set');
    return new Response('Email service not configured', { status: 500, headers: CORS });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Moffu <notifications@moffu.pro>',
      reply_to: 'support@moffu.pro',
      to: [body.to_email],
      subject: 'Connect your Google Business Profile to start using Moffu',
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response('Failed to send email', { status: 500, headers: CORS });
  }

  // Log the send so the 24h cooldown can be enforced next time
  await supabase.from('admin_outreach_log').insert({
    org_id: body.org_id,
    email_type: 'gbp_connect',
    to_email: body.to_email,
    sent_by: user.id,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
