import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cronSecret = Deno.env.get('ONBOARDING_CRON_SECRET');
  if (cronSecret && req.headers.get('x-webhook-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Find users who signed up 23–25 hours ago
  const now = Date.now();
  const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();
  const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000).toISOString();

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authError) {
    console.error('Error listing users:', authError);
    return new Response('Error listing users', { status: 500 });
  }

  const eligibleUsers = (authData?.users ?? []).filter(u => {
    const createdAt = new Date(u.created_at).getTime();
    return createdAt >= (now - 25 * 60 * 60 * 1000) && createdAt <= (now - 23 * 60 * 60 * 1000);
  });

  if (eligibleUsers.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = eligibleUsers.map(u => u.id);

  // Which of these already have a google_connection?
  const { data: connections } = await supabase
    .from('google_connections')
    .select('user_id')
    .in('user_id', userIds);

  const connectedUserIds = new Set((connections ?? []).map((c: { user_id: string }) => c.user_id));

  // Which already received the reminder?
  const { data: alreadySent } = await supabase
    .from('email_sequences')
    .select('user_id')
    .in('user_id', userIds)
    .eq('sequence_type', 'google_connect_reminder');

  const alreadySentIds = new Set((alreadySent ?? []).map((s: { user_id: string }) => s.user_id));

  const toEmail = eligibleUsers.filter(u =>
    !connectedUserIds.has(u.id) && !alreadySentIds.has(u.id) && u.email,
  );

  const appUrl = 'https://app.moffu.pro';
  let sent = 0;

  for (const user of toEmail) {
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    const name: string | null = meta.full_name ?? meta.display_name ?? meta.name ?? null;

    await sendEmail(
      user.email!,
      'Still need to connect Google — your reviews are waiting',
      reminderEmailHtml({ name, appUrl }),
    );

    await supabase.from('email_sequences').upsert({
      user_id: user.id,
      sequence_type: 'google_connect_reminder',
      sent_at: new Date().toISOString(),
    }, { onConflict: 'user_id,sequence_type', ignoreDuplicates: true });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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

function reminderEmailHtml({ name, appUrl }: { name: string | null; appUrl: string }): string {
  const firstName = name ? name.split(' ')[0] : null;
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const year = new Date().getFullYear();

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

          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#1A1A1A;letter-spacing:-0.02em;">Your reviews are waiting</h1>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">One step to unlock everything</p>
          </td></tr>

          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">
              ${greeting}<br/><br/>
              You signed up yesterday but haven't connected your Google Business Profile yet. Without it, Moffu can't sync your reviews and you can't generate AI reply drafts.<br/><br/>
              It takes about 30 seconds.
            </p>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <a href="${appUrl}/settings/connections" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:-0.01em;">Connect Google Business</a>
          </td></tr>

          <!-- What they unlock -->
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

          <!-- Support -->
          <tr><td>
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Need help? <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
            </p>
          </td></tr>

        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">
          &copy; ${year} Moffu &middot; <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">moffu.pro</a> &middot; <a href="${appUrl}/settings/notifications" style="color:#9CA3AF;text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
