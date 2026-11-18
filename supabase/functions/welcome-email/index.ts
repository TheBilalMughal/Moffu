import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('WELCOME_WEBHOOK_SECRET');
  if (webhookSecret && req.headers.get('x-webhook-secret') !== webhookSecret) {
    console.error('Invalid webhook secret');
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { record?: { id?: string; email?: string; raw_user_meta_data?: Record<string, string> } };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const record = body.record;
  if (!record?.email || !record?.id) return new Response('Missing user data', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Fetch active subscription + plan for this user
  const { data: subData } = await supabase
    .from('subscriptions')
    .select('billing_interval, plans(name, features, contact_sales)')
    .eq('user_id', record.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = subData?.plans as { name: string; features: string[]; contact_sales: boolean } | null;
  const planName = plan?.name ?? 'Free';
  const planFeatures: string[] = plan?.features ?? ['1 Location', '14 AI Drafts/week', '5 AI Replies/week', 'Help Center Support'];
  const billingInterval: string | null = subData?.billing_interval ?? null;

  const email = record.email;
  const meta = record.raw_user_meta_data ?? {};
  const name: string | null = meta.full_name ?? meta.display_name ?? meta.name ?? null;
  const appUrl = 'https://app.moffu.pro';
  const webUrl = Deno.env.get('WEB_URL') ?? 'https://moffu.pro';

  await sendEmail(
    email,
    'Welcome to Moffu',
    welcomeEmailHtml({ name, appUrl, webUrl, planName, planFeatures, billingInterval }),
  );

  return new Response('OK', { status: 200 });
});

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.error('RESEND_API_KEY not set'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Moffu <notifications@moffu.pro>',
      reply_to: 'support@moffu.pro',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

function welcomeEmailHtml({ name, appUrl, webUrl, planName, planFeatures, billingInterval }: {
  name: string | null;
  appUrl: string;
  webUrl: string;
  planName: string;
  planFeatures: string[];
  billingInterval: string | null;
}): string {
  const firstName = name ? name.split(' ')[0] : null;
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const year = new Date().getFullYear();

  const featureRows = planFeatures.map(f => `
    <tr><td style="padding:0 0 10px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;padding-top:5px;padding-right:12px;width:12px;">
          <div style="width:5px;height:5px;background:#6C55E8;border-radius:50%;"></div>
        </td>
        <td style="font-size:13px;color:#374151;line-height:1.5;">${f}</td>
      </tr></table>
    </td></tr>`).join('');

  const billingNote = billingInterval === 'annual'
    ? ' &middot; billed annually'
    : billingInterval === 'monthly' ? ' &middot; billed monthly' : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- Logo -->
      <tr><td style="padding-bottom:20px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#6C55E8;border-radius:8px;width:28px;height:28px;text-align:center;vertical-align:middle;">
            <span style="color:#fff;font-size:14px;font-weight:900;line-height:28px;">M</span>
          </td>
          <td style="padding-left:8px;font-size:16px;font-weight:800;color:#1A1A1A;letter-spacing:-0.02em;vertical-align:middle;">Moffu</td>
        </tr></table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:8px;border:1px solid #E5E5E5;padding:32px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr><td style="padding-bottom:6px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">New Account</p>
          </td></tr>
          <tr><td style="padding-bottom:4px;">
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#1A1A1A;letter-spacing:-0.02em;">Welcome to Moffu</h1>
          </td></tr>
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:13px;color:#9CA3AF;">Your account is active and ready to use.</p>
          </td></tr>

          <!-- Greeting + intro -->
          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">
              ${greeting}<br/><br/>
              Your account is live. Connect your Google Business Profile and reviews will start syncing automatically. You can generate AI reply drafts and publish them straight to Google from one place.
            </p>
          </td></tr>

          <!-- Plan section -->
          <tr><td style="padding-top:24px;padding-bottom:16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F9F9;border:1px solid #EBEBEB;border-radius:6px;padding:14px 18px;">
              <tr>
                <td>
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Your plan</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#1A1A1A;">${planName}${billingNote}</p>
                </td>
                <td align="right" valign="top">
                  <span style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em;">Active</span>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Plan features -->
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding-top:4px;">
              ${featureRows}
            </table>
          </td></tr>

          <!-- First step: Connect Google -->
          <tr><td style="padding-top:24px;padding-bottom:8px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">First step</p>
            <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.65;">Connect your Google Business Profile to start syncing reviews. Takes about 30 seconds.</p>
            <a href="${appUrl}/settings/connections" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:-0.01em;">Connect Google Business</a>
          </td></tr>

          <!-- Dashboard link -->
          <tr><td style="padding-top:16px;padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:13px;color:#9CA3AF;">
              Or <a href="${appUrl}" style="color:#6C55E8;text-decoration:none;font-weight:600;">open your dashboard</a> to explore first.
            </p>
          </td></tr>

          <!-- Support -->
          <tr><td style="padding-top:20px;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Questions? Reply to this email or write to <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
            </p>
          </td></tr>

        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">
          &copy; ${year} Moffu &middot; <a href="${webUrl}" style="color:#9CA3AF;text-decoration:none;">moffu.pro</a> &middot; <a href="${appUrl}/settings/notifications" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
