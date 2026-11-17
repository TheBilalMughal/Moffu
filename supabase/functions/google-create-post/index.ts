import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function getGoogleCreds(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('platform_settings').select('key, value')
    .in('key', ['google_client_id', 'google_client_secret']);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
  return {
    clientId:     map['google_client_id']     || Deno.env.get('GOOGLE_CLIENT_ID')     || '',
    clientSecret: map['google_client_secret'] || Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
  };
}

async function refreshAccessToken(
  refreshToken: string, clientId: string, clientSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId,
      client_secret: clientSecret, grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return typeof d.access_token === 'string'
    ? { access_token: d.access_token, expires_in: Number(d.expires_in) || 3600 }
    : null;
}

const VALID_TOPIC_TYPES = new Set(['STANDARD', 'EVENT', 'OFFER']);
const VALID_CTA_TYPES   = new Set(['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL', '']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
    if (!bearer) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(bearer[1]);
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);

    const {
      location_id,
      summary,
      topic_type = 'STANDARD',
      cta_type   = '',
      cta_url    = '',
      event_title      = '',
      event_start_date = '',
      event_end_date   = '',
    } = body as Record<string, string>;

    if (!location_id)         return json({ error: 'location_id is required' }, 400);
    if (!summary?.trim())     return json({ error: 'summary is required' }, 400);
    if (summary.length > 1500) return json({ error: 'summary must be 1500 characters or fewer' }, 400);
    if (!VALID_TOPIC_TYPES.has(topic_type)) return json({ error: 'Invalid topic_type' }, 400);
    if (!VALID_CTA_TYPES.has(cta_type))     return json({ error: 'Invalid cta_type' }, 400);

    // Get location
    const { data: loc, error: locError } = await supabase
      .from('google_locations')
      .select('id, google_location_name, connection_id')
      .eq('id', location_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (locError) return json({ error: 'Database unavailable' }, 503);
    if (!loc)     return json({ error: 'Location not found' }, 404);

    // Get tokens
    const [{ data: tokenRow }, { data: conn }] = await Promise.all([
      supabase.from('google_connection_tokens')
        .select('access_token, refresh_token')
        .eq('connection_id', loc.connection_id).maybeSingle(),
      supabase.from('google_connections')
        .select('id, state, token_expiry')
        .eq('id', loc.connection_id).eq('user_id', user.id).maybeSingle(),
    ]);
    if (!tokenRow) return json({ error: 'No token found' }, 400);
    if (!conn || conn.state === 'DISCONNECTED' || conn.state === 'REVOKED')
      return json({ error: 'Reconnect Google' }, 409);

    let accessToken = tokenRow.access_token;
    const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const { clientId, clientSecret } = await getGoogleCreds(supabase);
      if (!clientId || !clientSecret) return json({ error: 'Google OAuth is not configured' }, 503);
      const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
      if (!refreshed) return json({ error: 'Reconnect Google' }, 409);
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + Math.max(60, refreshed.expires_in - 60) * 1000).toISOString();
      await Promise.all([
        supabase.from('google_connection_tokens')
          .update({ access_token: refreshed.access_token, updated_at: new Date().toISOString() })
          .eq('connection_id', loc.connection_id),
        supabase.from('google_connections')
          .update({ token_expiry: expiresAt })
          .eq('id', loc.connection_id).eq('user_id', user.id),
      ]);
    }

    // Build request body for Google API
    // deno-lint-ignore no-explicit-any
    const postBody: Record<string, any> = {
      topicType: topic_type,
      summary:   summary.trim(),
    };

    if (cta_type) {
      postBody.callToAction = { actionType: cta_type };
      if (cta_type !== 'CALL' && cta_url) postBody.callToAction.url = cta_url;
    }

    if ((topic_type === 'EVENT' || topic_type === 'OFFER') && event_title && event_start_date && event_end_date) {
      const start = new Date(event_start_date);
      const end   = new Date(event_end_date);
      postBody.event = {
        title: event_title,
        schedule: {
          startDate: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
          endDate:   { year: end.getFullYear(),   month: end.getMonth()   + 1, day: end.getDate()   },
        },
      };
    }

    // Create post on Google Business Profile
    const googleRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${loc.google_location_name}/localPosts`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const googleData = await googleRes.json().catch(() => null);
    if (!googleRes.ok) {
      const errMsg = googleData?.error?.message ?? `Google API error (${googleRes.status})`;
      console.error('google-create-post Google error:', googleRes.status, errMsg);
      return json({ error: errMsg }, 502);
    }

    return json({
      post: {
        name:       googleData.name       ?? '',
        summary:    googleData.summary    ?? null,
        post_type:  googleData.topicType  ?? null,
        state:      googleData.state      ?? null,
        created_at: googleData.createTime ?? null,
        cta_type:   googleData.callToAction?.actionType ?? null,
        views:      null,
        clicks:     null,
      },
    });

  } catch (err) {
    console.error('google-create-post error:', err instanceof Error ? err.message : 'UNKNOWN_ERROR');
    return json({ error: 'Internal error' }, 500);
  }
});
