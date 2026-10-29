import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAndRecordUsage } from '../_shared/billing.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
};

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
    return new Response(null, { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { review_id, reply_text } = await req.json();
    if (!review_id || !reply_text?.trim()) {
      return json({ error: 'Missing review_id or reply_text' }, 400);
    }

    // Get review + location + connection
    const { data: review } = await supabase
      .from('reviews')
      .select('id, google_review_id, status, location_id, google_locations(google_location_name, connection_id)')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single();

    if (!review) return json({ error: 'Review not found' }, 404);

    // Allow publish from AWAITING_APPROVAL, DRAFT, or PUBLISH_FAILED states
    const publishableStatuses = ['AWAITING_APPROVAL', 'DRAFT', 'PUBLISH_FAILED', 'NEW'];
    if (!publishableStatuses.includes(review.status)) {
      return json({ error: `Cannot publish from status: ${review.status}` }, 400);
    }

    // Check published_reply limit before hitting Google
    const limitCheck = await checkAndRecordUsage(supabase, user.id, 'published_reply', review_id);
    if (!limitCheck.allowed) {
      return json({
        error: 'Published reply limit reached for this period',
        used: limitCheck.used,
        limit: limitCheck.limit,
      }, 429);
    }

    const location = review.google_locations as { google_location_name: string; connection_id: string } | null;
    if (!location) return json({ error: 'Location not found' }, 400);

    // Get tokens
    const { data: tokenRow } = await supabase
      .from('google_connection_tokens')
      .select('access_token, refresh_token')
      .eq('connection_id', location.connection_id)
      .single();

    if (!tokenRow) return json({ error: 'No tokens' }, 400);

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
      if (!newToken) return json({ error: 'Token refresh failed' }, 400);
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
      console.error('Google publish failed:', publishRes.status, errText);
      await supabase.from('reviews').update({ status: 'PUBLISH_FAILED' }).eq('id', review_id);
      return json({ error: `Google publish failed (${publishRes.status}): ${errText.substring(0, 200)}` }, 502);
    }

    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('reviews').update({
        status: 'PUBLISHED',
        reply_text: reply_text.trim(),
        reply_published_at: now,
        reply_draft: null,
      }).eq('id', review_id),
      supabase.from('usage_events').insert({ user_id: user.id, event_type: 'published_reply', review_id }),
    ]);

    return json({ success: true });
  } catch (err) {
    console.error('google-publish-reply error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
