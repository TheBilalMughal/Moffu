import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Require auth — only logged-in portal users can send emails
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Verify JWT
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  let body: { request_id: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { request_id } = body;
  if (!request_id) return json({ error: 'Missing request_id' }, 400);

  // Load request + org + location
  const { data: reqRow } = await supabase
    .from('feedback_requests')
    .select('id, token, customer_name, customer_email, channel, sent_at, org_id, location_id, google_review_url')
    .eq('id', request_id)
    .maybeSingle();

  if (!reqRow) return json({ error: 'Not found' }, 404);
  if (!reqRow.customer_email) return json({ error: 'No email address on this request' }, 400);
  if (reqRow.sent_at) return json({ error: 'Already sent' }, 409);

  // Verify ownership
  const { data: membership } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', reqRow.org_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return json({ error: 'Forbidden' }, 403);

  const { data: owner } = await supabase.from('org_members').select('user_id')
    .eq('org_id', reqRow.org_id).eq('role', 'owner').eq('status', 'active').maybeSingle();
  if (!owner) return json({ error: 'Organization owner not found' }, 403);
  const { data: subscription } = await supabase.from('subscriptions').select('plan_id')
    .eq('user_id', owner.user_id).in('status', ['active', 'trialing']).maybeSingle();
  if (!subscription) return json({ error: 'An active subscription is required to send feedback requests.' }, 402);
  const { data: feedbackFeature } = await supabase.from('plan_entitlements').select('bool_value')
    .eq('plan_id', subscription.plan_id).eq('key', 'feature_feedback').maybeSingle();
  if (feedbackFeature?.bool_value === false) {
    return json({ error: 'Feedback is not included in your current plan.' }, 402);
  }

  const [{ data: org }, { data: location }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', reqRow.org_id).maybeSingle(),
    reqRow.location_id
      ? supabase.from('google_locations').select('display_name, address').eq('id', reqRow.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const orgName      = org?.name ?? 'Us';
  const locationName = location?.display_name ?? null;
  const locationAddr = location?.address ?? null;
  const firstName    = reqRow.customer_name?.split(' ')[0] ?? null;
  const greeting     = firstName ? `Hi ${firstName},` : 'Hi,';

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const webUrl       = (Deno.env.get('WEB_URL') ?? 'https://www.moffu.pro').replace(/\/+$/, '');
  const feedbackLink = `${webUrl}/f/${reqRow.token}`;
  const trackOpenUrl = `${supabaseUrl}/functions/v1/feedback-track?token=${reqRow.token}&event=open`;
  const trackClickUrl= `${supabaseUrl}/functions/v1/feedback-track?token=${reqRow.token}&event=click`;
  const publicReviewUrl = (() => {
    try {
      const reviewUrl = new URL(reqRow.google_review_url ?? '');
      return reviewUrl.protocol === 'https:' ? reviewUrl.href : null;
    } catch { return null; }
  })();
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const escapeHtmlAttr = escapeHtml;
  const safeOrgName = escapeHtml(orgName);
  const safeGreeting = escapeHtml(greeting);
  const safeLocationName = locationName ? escapeHtml(locationName) : null;
  const safeLocationAddr = locationAddr ? escapeHtml(locationAddr) : null;
  const fromName = orgName.replace(/[\r\n]+/g, ' ').trim().slice(0, 120) || 'Business';
  const actionsHtml = publicReviewUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48%" style="padding-right:6px;">
                    <a href="${escapeHtmlAttr(trackClickUrl)}" style="display:block;text-align:center;background:#0D4C3C;color:#ffffff;font-size:14px;font-weight:600;padding:14px 16px;border-radius:12px;text-decoration:none;">
                      Leave an honest Google review
                    </a>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding-left:6px;">
                    <a href="${escapeHtmlAttr(feedbackLink)}" style="display:block;text-align:center;background:#F8FAF9;color:#374151;font-size:14px;font-weight:600;padding:14px 16px;border-radius:12px;text-decoration:none;border:1px solid #E5EAE8;">
                      Share private feedback
                    </a>
                  </td>
                </tr>
              </table>` : `
              <a href="${escapeHtmlAttr(feedbackLink)}" style="display:block;text-align:center;background:#0D4C3C;color:#ffffff;font-size:14px;font-weight:600;padding:14px 20px;border-radius:12px;text-decoration:none;margin-bottom:28px;">
                Share private feedback
              </a>`;

  // HTML email
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>How was your experience?</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0D4C3C;border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:18px;font-weight:700;line-height:40px;">★</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;border:1px solid #E5EAE8;padding:40px 40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

              <!-- Location badge -->
              ${locationName ? `
              <p style="margin:0 0 20px;text-align:center;">
                <span style="display:inline-block;background:#F0F7F5;border:1px solid #D1EAE4;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:600;color:#0D4C3C;text-transform:uppercase;letter-spacing:0.06em;">
                  ${safeLocationName}${safeLocationAddr ? ` · ${safeLocationAddr}` : ''}
                </span>
              </p>` : ''}

              <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;text-align:center;">${safeOrgName}</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;text-align:center;line-height:1.3;">
                How was your experience?
              </h1>
              <p style="margin:0 0 32px;font-size:14px;color:#6B7280;text-align:center;line-height:1.6;">
                ${safeGreeting}<br/>
                We welcome honest feedback. A public Google review and private feedback are both optional and available to every customer.
              </p>

              <!-- Same public-review and private-feedback options for every recipient -->
              ${actionsHtml}

              <p style="margin:0;font-size:11px;color:#D1D5DB;text-align:center;">
                Or <a href="${escapeHtmlAttr(feedbackLink)}" style="color:#9CA3AF;text-decoration:underline;">open in browser</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#D1D5DB;">
                Powered by <a href="${escapeHtmlAttr(webUrl)}" style="color:#9CA3AF;text-decoration:none;">Moffu</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- Tracking pixel (1×1 transparent GIF) -->
  <img src="${escapeHtmlAttr(trackOpenUrl)}" width="1" height="1" style="display:none;border:0;" alt=""/>
</body>
</html>`;

  // Send via Resend
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return json({ error: 'Email service not configured (RESEND_API_KEY missing)' }, 503);

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    `${fromName} <feedback@moffu.co>`,
      to:      [reqRow.customer_email],
      subject: `How was your experience at ${(locationName ?? orgName).replace(/[\r\n]+/g, ' ').slice(0, 160)}?`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    return json({ error: `Email provider error: ${err}` }, 502);
  }

  // Mark as sent
  await supabase
    .from('feedback_requests')
    .update({ sent_at: new Date().toISOString(), channel: 'email' })
    .eq('id', request_id);

  return json({ ok: true });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
