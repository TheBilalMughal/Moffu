import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { org_id, email, role } = await req.json();

    if (!org_id || !email || !role) {
      return json({ error: 'Missing required fields: org_id, email, role' }, 400);
    }

    const validRoles = ['admin', 'manager', 'viewer'];
    if (!validRoles.includes(role)) {
      return json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400);
    }

    // Create invitation via security-definer RPC (checks seat limit, auth, etc.)
    const { data: token, error: rpcErr } = await supabase.rpc('create_invitation', {
      p_org_id: org_id,
      p_email:  email,
      p_role:   role,
    }, { headers: { Authorization: authHeader } });

    if (rpcErr) {
      const msg = rpcErr.message ?? 'Failed to create invitation';
      const status = msg.includes('seat limit') ? 429 : msg.includes('authorized') ? 403 : 400;
      return json({ error: msg }, status);
    }

    // Fetch inviter display name for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single();

    const inviterName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Someone';
    const orgName     = org?.name ?? 'an organization';
    const appUrl      = Deno.env.get('APP_URL') ?? 'https://app.moffu.co';
    const acceptUrl   = `${appUrl}/invite/${token}`;
    const roleCap     = role.charAt(0).toUpperCase() + role.slice(1);

    // Send invite email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('RESEND_API_KEY not set — skipping email send');
      return json({ success: true, token, email_sent: false });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Moffu <noreply@moffu.co>',
        to:   [email],
        subject: `${inviterName} invited you to join ${orgName} on Moffu`,
        html: buildEmailHtml({ inviterName, orgName, role: roleCap, acceptUrl }),
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', errText);
      return json({ success: true, token, email_sent: false, email_error: errText });
    }

    return json({ success: true, email_sent: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function buildEmailHtml({ inviterName, orgName, role, acceptUrl }: {
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You have been invited to ${orgName}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:48px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E5EAE8;max-width:560px;width:100%">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #E5EAE8">
            <span style="font-size:20px;font-weight:700;color:#0D4C3C;letter-spacing:-0.3px">Moffu</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
              You have been invited
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6">
              <strong style="color:#111827">${inviterName}</strong> has invited you to join
              <strong style="color:#111827">${orgName}</strong> as a
              <strong style="color:#111827">${role}</strong>.
            </p>

            <a href="${acceptUrl}"
               style="display:inline-block;background:#0D4C3C;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;letter-spacing:0.1px">
              Accept invitation
            </a>

            <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;line-height:1.5">
              Or copy this link:<br />
              <span style="color:#0D4C3C;word-break:break-all">${acceptUrl}</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #E5EAE8">
            <p style="margin:0;font-size:12px;color:#9CA3AF">
              This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
