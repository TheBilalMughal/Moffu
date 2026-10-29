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
      const refreshed = await doRefreshToken(tokenRow.refresh_token, clientId, clientSecret);
      accessToken = refreshed.access_token;
      await supabase.from('google_connection_tokens')
        .update({ access_token: accessToken })
        .eq('connection_id', connection.id);
      await supabase.from('google_connections')
        .update({ token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
        .eq('id', connection.id);
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
            status: hasReply ? 'PUBLISHED' : 'NEW',
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'location_id,google_review_id', ignoreDuplicates: false },
        );
        if (upsertErr) {
          errors.push(upsertErr.message);
          continue;
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
