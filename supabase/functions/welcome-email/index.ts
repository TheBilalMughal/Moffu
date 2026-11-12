import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Validate webhook secret so only our DB trigger can call this
  const webhookSecret = Deno.env.get('WELCOME_WEBHOOK_SECRET');
  if (webhookSecret) {
    const incoming = req.headers.get('x-webhook-secret');
    if (incoming !== webhookSecret) {
      console.error('Invalid webhook secret');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: { record?: { id?: string; email?: string; raw_user_meta_data?: Record<string, string> } };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const record = body.record;
  if (!record?.email || !record?.id) {
    return new Response('Missing user data', { status: 400 });
  }

  const email = record.email;
  const meta = record.raw_user_meta_data ?? {};
  const name: string | null = meta.full_name ?? meta.display_name ?? meta.name ?? null;
  const appUrl = 'https://app.moffu.pro';
  const webUrl = Deno.env.get('WEB_URL') ?? 'https://moffu.pro';

  await sendEmail(
    email,
    'Welcome to Moffu — you\'re in',
    welcomeEmailHtml({ name, appUrl, webUrl }),
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

function welcomeEmailHtml({ name, appUrl, webUrl }: {
  name: string | null;
  appUrl: string;
  webUrl: string;
}): string {
  const firstName = name ? name.split(' ')[0] : null;
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F1FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1FF;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- Logo -->
      <tr><td align="center" style="padding-bottom:24px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#6C55E8;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
            <span style="color:#fff;font-size:18px;font-weight:900;line-height:36px;">M</span>
          </td>
          <td style="padding-left:10px;font-size:20px;font-weight:900;color:#111827;letter-spacing:-0.03em;vertical-align:middle;">Moffu</td>
        </tr></table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

        <!-- Purple header -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#6C55E8;padding:32px 36px 28px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.08em;">Welcome to Moffu</p>
            <h1 style="margin:0 0 10px;font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;line-height:1.1;">you&rsquo;re in.<br/>let&rsquo;s get to work.</h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.72);line-height:1.6;">Your account is live. No more ignored reviews, no more lost customers.</p>
          </td></tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px 0;">

          <!-- Greeting -->
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
              ${greeting}<br/><br/>
              Most businesses lose customers because they let bad reviews sit unanswered for weeks. You just fixed that. Here&rsquo;s what&rsquo;s ready for you right now.
            </p>
          </td></tr>

          <!-- Features label -->
          <tr><td style="padding-top:24px;padding-bottom:16px;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">What you unlocked</p>
          </td></tr>

          <!-- Feature 1 -->
          <tr><td style="padding-bottom:18px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:14px;">
                <div style="width:6px;height:6px;background:#6C55E8;border-radius:50%;"></div>
              </td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">AI Reply Drafts</p>
                <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">On-brand replies to any review in seconds. No blank page, no guesswork.</p>
              </td>
            </tr></table>
          </td></tr>

          <!-- Feature 2 -->
          <tr><td style="padding-bottom:18px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:14px;">
                <div style="width:6px;height:6px;background:#6C55E8;border-radius:50%;"></div>
              </td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Auto-sync Reviews</p>
                <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">Google reviews come in automatically. Nothing slips through.</p>
              </td>
            </tr></table>
          </td></tr>

          <!-- Feature 3 -->
          <tr><td style="padding-bottom:18px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:14px;">
                <div style="width:6px;height:6px;background:#6C55E8;border-radius:50%;"></div>
              </td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Brand Brain</p>
                <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">Set your tone, language and rules once. Every reply sounds like you, not a bot.</p>
              </td>
            </tr></table>
          </td></tr>

          <!-- Feature 4 -->
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F3F4F6;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;padding-top:5px;padding-right:14px;">
                <div style="width:6px;height:6px;background:#6C55E8;border-radius:50%;"></div>
              </td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">Review Analytics</p>
                <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">See where your ratings are going and what to fix. Data, not gut feeling.</p>
              </td>
            </tr></table>
          </td></tr>

          <!-- Plan line -->
          <tr><td style="padding:20px 0 24px;border-bottom:1px solid #F3F4F6;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:13px;color:#9CA3AF;">You&rsquo;re on the <span style="font-weight:700;color:#111827;">Free Plan</span> &mdash; 1 location, 25 AI drafts/mo</td>
              <td align="right" style="font-size:11px;font-weight:700;color:#6C55E8;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;padding-left:12px;">Active</td>
            </tr></table>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:24px 0 20px;">
            <a href="${appUrl}" style="display:block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:15px;border-radius:10px;text-decoration:none;text-align:center;letter-spacing:-0.01em;">Open your dashboard</a>
          </td></tr>

          <!-- Support -->
          <tr><td style="padding-bottom:32px;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Got questions? We actually reply &mdash; <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
            </p>
          </td></tr>

        </table>

        <!-- Upgrade strip -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#F3F4F6;padding:16px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Need more locations or unlimited AI replies? <a href="${webUrl}/pricing" style="color:#6C55E8;font-weight:700;text-decoration:none;">See upgrade options</a>
            </p>
          </td></tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">
          &copy; ${year} Moffu &middot; <a href="${webUrl}" style="color:#9CA3AF;text-decoration:none;">moffu.pro</a> &middot; <a href="${appUrl}/settings/notifications" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
