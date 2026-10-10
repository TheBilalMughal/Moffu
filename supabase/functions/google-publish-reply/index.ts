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

    const { review_id, reply_text } = await req.json();
    if (!review_id || !reply_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing review_id or reply_text' }), { status: 400 });
    }

    // Get review + location + connection
    const { data: review } = await supabase
      .from('reviews')
      .select('id, google_review_id, status, location_id, google_locations(google_location_name, connection_id)')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single();

    if (!review) return new Response(JSON.stringify({ error: 'Review not found' }), { status: 404 });
    if (review.status !== 'AWAITING_APPROVAL') {
      return new Response(JSON.stringify({ error: 'Review is not awaiting approval' }), { status: 400 });
    }

    const location = review.google_locations as { google_location_name: string; connection_id: string } | null;
    if (!location) return new Response(JSON.stringify({ error: 'Location not found' }), { status: 400 });

    // Get tokens
    const { data: tokenRow } = await supabase
      .from('google_connection_tokens')
      .select('access_token, refresh_token')
      .eq('connection_id', location.connection_id)
      .single();

    if (!tokenRow) return new Response(JSON.stringify({ error: 'No tokens' }), { status: 400 });

    // Get connection for expiry
    const { data: conn } = await supabase
      .from('google_connections')
      .select('token_expiry')
      .eq('id', location.connection_id)
      .single();

    let accessToken = tokenRow.access_token;
    const expiry = conn?.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const newToken = await refreshAccessToken(tokenRow.refresh_token);
      if (!newToken) return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 400 });
      accessToken = newToken;
      await supabase.from('google_connection_tokens').update({ access_token: newToken, updated_at: new Date().toISOString() }).eq('connection_id', location.connection_id);
    }

    // Mark as PUBLISHING
    await supabase.from('reviews').update({ status: 'PUBLISHING' }).eq('id', review_id);

    // Publish reply to Google
    const publishRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${location.google_location_name}/reviews/${review.google_review_id}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: reply_text.trim() }),
      }
    );

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      console.error('Google publish failed:', errText);
      await supabase.from('reviews').update({ status: 'PUBLISH_FAILED' }).eq('id', review_id);
      return new Response(JSON.stringify({ error: 'Google publish failed' }), { status: 502 });
    }

    const now = new Date().toISOString();
    await supabase.from('reviews').update({
      status: 'PUBLISHED',
      reply_text: reply_text.trim(),
      reply_published_at: now,
      reply_draft: null,
    }).eq('id', review_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('google-publish-reply error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
