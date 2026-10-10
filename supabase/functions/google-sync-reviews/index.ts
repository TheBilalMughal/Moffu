import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    // Get connection
    const { data: connection } = await supabase
      .from('google_connections')
      .select('id, state, token_expiry')
      .eq('user_id', user.id)
      .eq('state', 'CONNECTED')
      .single();

    if (!connection) return new Response(JSON.stringify({ error: 'No active Google connection' }), { status: 400 });

    // Get tokens
    const { data: tokenRow } = await supabase
      .from('google_connection_tokens')
      .select('access_token, refresh_token')
      .eq('connection_id', connection.id)
      .single();

    if (!tokenRow) return new Response(JSON.stringify({ error: 'No tokens found' }), { status: 400 });

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    const expiry = connection.token_expiry ? new Date(connection.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const newToken = await refreshAccessToken(tokenRow.refresh_token);
      if (!newToken) {
        await supabase.from('google_connections').update({ state: 'REFRESH_FAILED' }).eq('id', connection.id);
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 400 });
      }
      accessToken = newToken;
      const newExpiry = new Date(Date.now() + 3500 * 1000).toISOString();
      await supabase.from('google_connection_tokens').update({ access_token: newToken, updated_at: new Date().toISOString() }).eq('connection_id', connection.id);
      await supabase.from('google_connections').update({ token_expiry: newExpiry }).eq('id', connection.id);
    }

    // Get selected locations
    const { data: locations } = await supabase
      .from('google_locations')
      .select('id, google_location_name')
      .eq('connection_id', connection.id)
      .eq('is_selected', true);

    if (!locations?.length) return new Response(JSON.stringify({ synced: 0, message: 'No locations selected' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

    let totalSynced = 0;

    for (const location of locations) {
      const reviewsRes = await fetch(
        `https://mybusiness.googleapis.com/v4/${location.google_location_name}/reviews`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!reviewsRes.ok) continue;

      const reviewsData = await reviewsRes.json();
      const reviews: Array<{
        reviewId: string;
        reviewer?: { displayName?: string; profilePhotoUrl?: string };
        starRating?: string;
        comment?: string;
        createTime?: string;
        reviewReply?: { comment?: string; updateTime?: string };
      }> = reviewsData.reviews ?? [];

      const starMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

      for (const rv of reviews) {
        const rating = starMap[rv.starRating ?? ''] ?? null;
        const hasReply = !!rv.reviewReply?.comment;

        await supabase.from('reviews').upsert({
          location_id: location.id,
          user_id: user.id,
          google_review_id: rv.reviewId,
          reviewer_name: rv.reviewer?.displayName ?? null,
          reviewer_photo_url: rv.reviewer?.profilePhotoUrl ?? null,
          rating,
          body: rv.comment ?? null,
          published_at: rv.createTime ?? null,
          reply_text: rv.reviewReply?.comment ?? null,
          reply_published_at: rv.reviewReply?.updateTime ?? null,
          status: hasReply ? 'PUBLISHED' : 'NEW',
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'location_id,google_review_id', ignoreDuplicates: false });

        totalSynced++;
      }
    }

    await supabase.from('google_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connection.id);

    return new Response(JSON.stringify({ synced: totalSynced }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('google-sync-reviews error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
