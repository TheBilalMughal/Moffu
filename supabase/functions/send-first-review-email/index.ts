import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ReviewPayload {
  user_id?: string;
  location_id?: string;
  review_id?: string;
  reviewer_name?: string;
  rating?: number;
  body?: string;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('FIRST_REVIEW_WEBHOOK_SECRET');
  if (webhookSecret && req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: ReviewPayload;
  try { payload = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  if (!payload.location_id) return new Response('Missing location_id', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Resolve user_id via location chain if not provided directly
  let userId = payload.user_id;
  if (!userId) {
    const { data: loc } = await supabase
      .from('google_locations')
      .select('connection_id')
      .eq('id', payload.location_id)
      .maybeSingle();
    if (!loc?.connection_id) return new Response(JSON.stringify({ ok: true, skipped: 'no_location' }), { status: 200 });

    const { data: conn } = await supabase
      .from('google_connections')
      .select('user_id')
      .eq('id', loc.connection_id)
      .maybeSingle();
    if (!conn?.user_id) return new Response(JSON.stringify({ ok: true, skipped: 'no_connection' }), { status: 200 });
    userId = conn.user_id;
  }

  // Deduplication: skip if first_review email already sent
  const { data: existing } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('user_id', userId)
    .eq('sequence_type', 'first_review')
    .maybeSingle();

  if (existing) return new Response(JSON.stringify({ ok: true, skipped: 'already_sent' }), { status: 200 });

  // Count total reviews for this user (via full location chain)
  const { data: connRows } = await supabase
    .from('google_connections')
    .select('id')
    .eq('user_id', userId);

  const connectionIds = (connRows ?? []).map((c: { id: string }) => c.id);
  if (connectionIds.length === 0) return new Response(JSON.stringify({ ok: true, skipped: 'no_connections' }), { status: 200 });

  const { data: locRows } = await supabase
    .from('google_locations')
    .select('id')
    .in('connection_id', connectionIds);

  const locationIds = (locRows ?? []).map((l: { id: string }) => l.id);
  if (locationIds.length === 0) return new Response(JSON.stringify({ ok: true, skipped: 'no_locations' }), { status: 200 });

  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .in('location_id', locationIds);

  // Only send if this is truly the first review (count == 1)
  if (!count || count > 1) {
    return new Response(JSON.stringify({ ok: true, skipped: 'not_first', count }), { status: 200 });
  }

  // Get user's email
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    console.error('Could not fetch user email:', userError);
    return new Response(JSON.stringify({ ok: true, skipped: 'no_email' }), { status: 200 });
  }

  const userEmail = userData.user.email;
  const meta = (userData.user.user_metadata ?? {}) as Record<string, string>;
  const name: string | null = meta.full_name ?? meta.display_name ?? meta.name ?? null;
  const appUrl = 'https://app.moffu.pro';

  await sendEmail(
    userEmail,
    'wait. your first review just came in',
    firstReviewEmailHtml({
      name,
      appUrl,
      reviewerName: payload.reviewer_name ?? null,
      rating: payload.rating ?? null,
      reviewBody: payload.body ?? null,
    }),
  );

  // Mark as sent
  await supabase.from('email_sequences').upsert({
    user_id: userId,
    sequence_type: 'first_review',
    sent_at: new Date().toISOString(),
    metadata: { review_id: payload.review_id, rating: payload.rating },
  }, { onConflict: 'user_id,sequence_type', ignoreDuplicates: true });

  return new Response(JSON.stringify({ ok: true, sent: true }), {
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

function starsHtml(rating: number): string {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? '#F59E0B' : '#E5E7EB'};font-size:18px;">&#9733;</span>`,
  ).join('');
}

function firstReviewEmailHtml({ name, appUrl, reviewerName, rating, reviewBody }: {
  name: string | null;
  appUrl: string;
  reviewerName: string | null;
  rating: number | null;
  reviewBody: string | null;
}): string {
  const firstName = name ? name.split(' ')[0] : null;
  const greeting = firstName ? `${firstName},` : 'hey,';
  const year = new Date().getFullYear();
  const hasReviewContent = reviewerName || rating || reviewBody;
  const previewText = reviewBody ? reviewBody.slice(0, 100) + (reviewBody.length > 100 ? '...' : '') : null;

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

          <!-- Header label -->
          <tr><td style="padding-bottom:6px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">First Review</p>
          </td></tr>

          <!-- Big headline -->
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#1A1A1A;letter-spacing:-0.03em;line-height:1.2;">no way. you got your first review.</h1>
            <p style="margin:0;font-size:14px;color:#6B7280;">lowkey, this is kind of a big deal.</p>
          </td></tr>

          <!-- Hype section -->
          <tr><td style="padding-top:24px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">
              ${greeting}<br/><br/>
              not you already getting reviews. it's giving growth era. your first one just landed and it's not gonna reply itself.
            </p>
          </td></tr>

          ${hasReviewContent ? `
          <!-- Review card -->
          <tr><td style="padding-top:20px;padding-bottom:24px;border-bottom:1px solid #F0F0F0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">The review</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F9F9;border:1px solid #EBEBEB;border-radius:6px;padding:16px 20px;">
              <tr><td>
                ${reviewerName ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1A1A1A;">${reviewerName}</p>` : ''}
                ${rating ? `<p style="margin:0 0 10px;">${starsHtml(rating)}</p>` : ''}
                ${previewText ? `<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-style:italic;">"${previewText}"</p>` : ''}
              </td></tr>
            </table>
          </td></tr>` : ''}

          <!-- CTA -->
          <tr><td style="padding-top:24px;padding-bottom:8px;">
            <p style="margin:0 0 6px;font-size:13px;color:#374151;line-height:1.6;">go reply before they forget about you. your Brand Brain is set up and ready to draft something that actually sounds like you.</p>
          </td></tr>
          <tr><td style="padding-bottom:28px;border-bottom:1px solid #F0F0F0;">
            <a href="${appUrl}/reviews" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:-0.01em;">Reply now</a>
          </td></tr>

          <!-- Support -->
          <tr><td style="padding-top:20px;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              we're rooting for you. <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
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
