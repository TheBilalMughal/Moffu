import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

interface GBPReview {
  name: string;
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

interface GBPReviewsResponse {
  reviews?: GBPReview[];
  nextPageToken?: string;
}

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

async function fetchGBPReviews(locationName: string, accessToken: string): Promise<GBPReview[]> {
  const reviews: GBPReview[] = [];
  let pageToken = '';
  do {
    const url = `https://mybusinessreviews.googleapis.com/v1/${locationName}/reviews?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.error('GBP reviews error:', res.status, await res.text());
      break;
    }
    const data: GBPReviewsResponse = await res.json();
    reviews.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return reviews;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-sync-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const syncSecret = req.headers.get('x-sync-secret') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const isServiceRole = authHeader.replace('Bearer ', '') === SUPABASE_SERVICE_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (!isServiceRole) {
    const { data: settingRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'sync_reviews_secret')
      .maybeSingle();
    const storedSecret = settingRow?.value ?? '';
    if (!storedSecret || syncSecret !== storedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
  }

  const { clientId, clientSecret } = await getGoogleCreds(supabase);
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'Google credentials not configured' }),
      { status: 500 },
    );
  }

  const { data: connections, error: connErr } = await supabase
    .from('google_connections')
    .select('id, user_id, token_expiry')
    .eq('state', 'CONNECTED');

  if (connErr || !connections?.length) {
    return new Response(JSON.stringify({ synced: 0, users: 0 }), { status: 200 });
  }

  let totalUsers = 0;
  let totalSynced = 0;
  const errors: string[] = [];

  for (const connection of connections) {
    try {
      const { data: tokenRow } = await supabase
        .from('google_connection_tokens')
        .select('access_token, refresh_token')
        .eq('connection_id', connection.id)
        .single();

      if (!tokenRow) continue;

      // Refresh if within 1 minute of expiry
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`connection ${connection.id}: token refresh failed: ${msg}`);
          await supabase.from('google_connections')
            .update({ state: 'ATTENTION_REQUIRED', error_message: 'Token refresh failed during auto-sync' })
            .eq('id', connection.id);
          continue;
        }
      }

      const { data: locations } = await supabase
        .from('google_locations')
        .select('id, google_location_name')
        .eq('connection_id', connection.id)
        .eq('is_selected', true);

      if (!locations?.length) continue;

      totalUsers++;
      let userSynced = 0;

      for (const location of locations) {
        const reviews = await fetchGBPReviews(location.google_location_name, accessToken);

        for (const review of reviews) {
          const hasReply = !!review.reviewReply?.comment;
          const { error: upsertErr } = await supabase.from('reviews').upsert(
            {
              location_id: location.id,
              user_id: connection.user_id,
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
          if (!upsertErr) userSynced++;
        }
      }

      await supabase.from('google_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', connection.id);

      totalSynced += userSynced;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`connection ${connection.id}: ${msg}`);
      console.error('sync error for connection', connection.id, err);
    }
  }

  console.log(`auto-sync complete: ${totalSynced} reviews across ${totalUsers} users`);

  return new Response(
    JSON.stringify({ synced: totalSynced, users: totalUsers, errors }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
