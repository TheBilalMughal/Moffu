import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

async function getGoogleCreds(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['google_client_id', 'google_client_secret']);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
  return {
    clientId:     map['google_client_id']     || Deno.env.get('GOOGLE_CLIENT_ID')     || '',
    clientSecret: map['google_client_secret'] || Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
  };
}

async function doRefreshToken(rt: string, clientId: string, clientSecret: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// Resolve account prefix and fix location names if they lack it
async function resolveAccountPrefix(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  storedAccountId: string | null,
  accessToken: string,
): Promise<string | null> {
  if (storedAccountId) return storedAccountId;

  const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('accounts API error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const accountName: string | null = data.accounts?.[0]?.name ?? null; // "accounts/{id}"
  if (accountName) {
    await supabase.from('google_connections')
      .update({ google_account_id: accountName })
      .eq('id', connectionId);
  }
  return accountName;
}

interface GBPReview {
  name: string;
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

interface GBPReviewsResponse {
  reviews?: GBPReview[];
  nextPageToken?: string;
}

async function fetchGBPReviews(locationName: string, accessToken: string, errors: string[]): Promise<GBPReview[]> {
  const reviews: GBPReview[] = [];
  let pageToken = '';
  // Use v4 endpoint (Google My Business API — enabled via Cloud Console)
  const baseUrl = `https://mybusiness.googleapis.com/v4/${locationName}/reviews`;
  do {
    const url = `${baseUrl}?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.text();
      console.error('GBP reviews error:', res.status, body);
      errors.push(`GBP Reviews API ${res.status} for ${locationName}: ${body.substring(0, 300)}`);
      break;
    }
    const data: GBPReviewsResponse = await res.json();
    reviews.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return reviews;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { clientId, clientSecret } = await getGoogleCreds(supabase);
    if (!clientId || !clientSecret) {
      return json({ error: 'Google credentials not configured in Admin → Settings → Google API.' }, 500);
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('id, state, token_expiry, google_account_id')
      .eq('user_id', user.id)
      .eq('state', 'CONNECTED')
      .single();
    if (!connection) return json({ error: 'No active Google connection' }, 400);

    const { data: tokenRow } = await supabase
      .from('google_connection_tokens')
      .select('access_token, refresh_token')
      .eq('connection_id', connection.id)
      .single();
    if (!tokenRow) return json({ error: 'No tokens found' }, 400);

    let accessToken = tokenRow.access_token;
    const expiry = connection.token_expiry ? new Date(connection.token_expiry) : new Date(0);
    if (expiry <= new Date(Date.now() + 60_000)) {
      try {
        const refreshed = await doRefreshToken(tokenRow.refresh_token, clientId, clientSecret);
        accessToken = refreshed.access_token;
        await supabase.from('google_connection_tokens')
          .update({ access_token: accessToken })
          .eq('connection_id', connection.id);
        await supabase.from('google_connections')
          .update({ token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
          .eq('id', connection.id);
      } catch (refreshErr) {
        console.error('Token refresh failed — marking REFRESH_FAILED:', refreshErr);
        await supabase.from('google_connections')
          .update({ state: 'REFRESH_FAILED' })
          .eq('id', connection.id);
        // Notify the owner
        await notifyGoogleRefreshFailed(supabase, user.id).catch(e => console.error('Notify error:', e));
        return json({ error: 'Google token refresh failed. Please reconnect your Google account.' }, 401);
      }
    }

    // Resolve account prefix (fixes old connections that didn't store it)
    const accountPrefix = await resolveAccountPrefix(
      supabase, connection.id, connection.google_account_id, accessToken,
    );

    const { data: locations } = await supabase
      .from('google_locations')
      .select('id, google_location_name')
      .eq('connection_id', connection.id)
      .eq('is_selected', true);

    if (!locations?.length) return json({ synced: 0, message: 'No locations selected' });

    let totalSynced = 0;
    const errors: string[] = [];

    for (const location of locations) {
      let locationName = location.google_location_name;

      // Fix bare "locations/{id}" to "accounts/{id}/locations/{id}"
      if (accountPrefix && !locationName.startsWith('accounts/')) {
        locationName = `${accountPrefix}/${locationName}`;
        await supabase.from('google_locations')
          .update({ google_location_name: locationName })
          .eq('id', location.id);
      }

      const reviews = await fetchGBPReviews(locationName, accessToken, errors);

      for (const review of reviews) {
        const hasReply = !!review.reviewReply?.comment;

        // Upsert content fields WITHOUT status — preserves DRAFT_READY / DRAFTING / NEEDS_ATTENTION
        // on existing rows so a sync never wipes out a user's saved draft.
        const { error: upsertErr } = await supabase.from('reviews').upsert(
          {
            location_id: location.id,
            user_id: user.id,
            google_review_id: review.reviewId,
            reviewer_name: review.reviewer?.isAnonymous ? null : (review.reviewer?.displayName ?? null),
            reviewer_photo_url: review.reviewer?.profilePhotoUrl ?? null,
            rating: review.starRating ? (STAR_MAP[review.starRating] ?? null) : null,
            body: review.comment ?? null,
            published_at: review.createTime ?? null,
            reply_text: review.reviewReply?.comment ?? null,
            reply_published_at: review.reviewReply?.updateTime ?? null,
            last_synced_at: new Date().toISOString(),
            // status intentionally omitted — INSERT default is 'NEW'; UPDATE keeps existing value.
            // We only force PUBLISHED below when Google confirms the reply exists.
          },
          { onConflict: 'location_id,google_review_id', ignoreDuplicates: false },
        );
        if (upsertErr) {
          errors.push(upsertErr.message);
          continue;
        }

        // If Google has a published reply, always mark PUBLISHED regardless of local draft state.
        if (hasReply) {
          await supabase
            .from('reviews')
            .update({ status: 'PUBLISHED' })
            .eq('location_id', location.id)
            .eq('google_review_id', review.reviewId);
        }

        totalSynced++;
      }
    }

    await supabase.from('google_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return json({ synced: totalSynced, errors });
  } catch (err) {
    console.error('google-sync-reviews error:', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Google reconnect notification ─────────────────────────────────────────────

async function notifyGoogleRefreshFailed(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.email;
  if (!email) return;

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  const name = profile?.display_name ?? null;
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  const webUrl = Deno.env.get('WEB_URL') ?? 'https://moffu.pro';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
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
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#B45309;background:#FFF7ED;display:inline-block;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.08em;">Action required</p>
        <h1 style="margin:16px 0;font-size:22px;font-weight:700;color:#111827;">Reconnect your Google account</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
          ${greeting}<br/>
          Your Google Business Profile connection has expired. We were unable to sync your latest reviews. Reconnect your account to restore automatic syncing.
        </p>
        <a href="${webUrl}/settings" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
          Reconnect Google account
        </a>
        <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
          If you need help, contact <a href="mailto:support@moffu.pro" style="color:#6C55E8;">support@moffu.pro</a>
        </p>
      </td></tr>
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#D1D5DB;">Powered by <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">Moffu</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Moffu <notifications@moffu.pro>',
      to: [email],
      subject: 'Action required: Reconnect your Google account',
      html,
    }),
  });
}
