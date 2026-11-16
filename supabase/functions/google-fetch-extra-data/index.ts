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

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{access_token:string;expires_in:number}|null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return typeof d.access_token==='string' ? {access_token:d.access_token,expires_in:Number(d.expires_in)||3600} : null;
}

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
    const locationId: string | null = body.location_id ?? null;
    if (locationId !== null && (typeof locationId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId)))
      return json({ error: 'Invalid location' }, 400);

    // ── Get the location ──────────────────────────────────────────────────────
    const locQ = supabase
      .from('google_locations')
      .select('id, google_location_name, connection_id')
      .eq('user_id', user.id);
    if (locationId) locQ.eq('id', locationId); else locQ.eq('is_selected', true);
    const { data: loc, error: locError } = await locQ.maybeSingle();
    if (locError) return json({ error: 'Database unavailable' }, 503);
    if (!loc) return json({ error: 'Location not found' }, 404);

    const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      supabase.from('profiles').select('status').eq('id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    ]);
    if (profileError || subscriptionError) return json({ error: 'Database unavailable' }, 503);
    if (!profile || profile.status !== 'active') return json({ error: 'Account inactive' }, 403);
    if (!subscription) return json({ error: 'Feature unavailable' }, 403);
    const { data: entitlement, error: entitlementError } = await supabase.from('plan_entitlements').select('bool_value')
      .eq('plan_id', subscription.plan_id).eq('key', 'feature_google_profile').maybeSingle();
    if (entitlementError) return json({ error: 'Database unavailable' }, 503);
    if (entitlement?.bool_value === false) return json({ error: 'Feature unavailable' }, 403);

    // ── Get tokens ────────────────────────────────────────────────────────────
    const [{ data: tokenRow, error: tokenError }, { data: conn, error: connectionError }] = await Promise.all([
      supabase.from('google_connection_tokens').select('access_token, refresh_token').eq('connection_id', loc.connection_id).maybeSingle(),
      supabase.from('google_connections').select('id,state,token_expiry').eq('id', loc.connection_id).eq('user_id', user.id).maybeSingle(),
    ]);
    if (tokenError || connectionError) return json({ error: 'Database unavailable' }, 503);
    if (!tokenRow) return json({ error: 'No token found' }, 400);
    if (!conn || conn.state === 'DISCONNECTED' || conn.state === 'REVOKED') return json({ error: 'Reconnect Google' }, 409);

    let accessToken = tokenRow.access_token;
    const expiry = conn?.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const { clientId, clientSecret } = await getGoogleCreds(supabase);
      if (clientId && clientSecret) {
        const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
        if (refreshed) {
          accessToken = refreshed.access_token;
          const expiresAt = new Date(Date.now() + Math.max(60, refreshed.expires_in - 60) * 1000).toISOString();
          const [{ error: tokenSaveError }, { error: expirySaveError }] = await Promise.all([
            supabase.from('google_connection_tokens')
            .update({ access_token: refreshed.access_token, updated_at: new Date().toISOString() })
            .eq('connection_id', loc.connection_id),
            supabase.from('google_connections').update({ token_expiry: expiresAt }).eq('id', loc.connection_id).eq('user_id', user.id),
          ]);
          if (tokenSaveError || expirySaveError) return json({ error: 'Could not save refreshed Google authorization' }, 503);
        } else return json({ error: 'Reconnect Google' }, 409);
      } else return json({ error: 'Google OAuth is not configured' }, 503);
      if (!accessToken) return json({ error: 'Reconnect Google' }, 409);
    }

    const locationName = loc.google_location_name;
    const authHdr = { Authorization: `Bearer ${accessToken}` };
    const providerInit = { headers: authHdr, signal: AbortSignal.timeout(15_000) };

    // ── Fetch photos, Q&A, posts in parallel ─────────────────────────────────
    const [mediaRes, questionsRes, postsRes] = await Promise.all([
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/media?pageSize=1`, providerInit),
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/questions?pageSize=10&answersPerQuestion=0`, providerInit),
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts?pageSize=10`, providerInit),
    ]);

    // ── Photos ────────────────────────────────────────────────────────────────
    let photos: { total: number | null; owner_total: number | null } | null = null;
    if (mediaRes.ok) {
      const d = await mediaRes.json();
      photos = {
        total:       d.totalMediaItemCount      ?? null,
        owner_total: d.totalOwnerMediaItemCount ?? null,
      };
    } else {
      console.warn('media API status:', mediaRes.status);
    }

    // ── Q&A ───────────────────────────────────────────────────────────────────
    let qanda: { total: number | null; unanswered: number } | null = null;
    if (questionsRes.ok) {
      const d = await questionsRes.json();
      type Question = { topAnswers?: unknown[] };
      const questions: Question[] = d.questions ?? [];
      qanda = {
        total:       d.totalSize ?? questions.length,
        unanswered:  questions.filter((q) => !q.topAnswers?.length).length,
      };
    } else {
      console.warn('questions API status:', questionsRes.status);
    }

    // ── Posts ─────────────────────────────────────────────────────────────────
    type LocalPost = {
      name?: string; summary?: string; topicType?: string; state?: string;
      createTime?: string; callToAction?: { actionType?: string };
      insights?: { localPostViewsForMedia?: number; localPostActionsForCallToAction?: number };
    };
    let posts: {
      name: string; summary: string | null; post_type: string | null;
      state: string | null; created_at: string | null;
      cta_type: string | null; views: number | null; clicks: number | null;
    }[] | null = null;
    if (postsRes.ok) {
      const d = await postsRes.json();
      posts = ((d.localPosts ?? []) as LocalPost[]).map((p) => ({
        name:       p.name ?? '',
        summary:    p.summary ?? null,
        post_type:  p.topicType ?? null,
        state:      p.state ?? null,
        created_at: p.createTime ?? null,
        cta_type:   p.callToAction?.actionType ?? null,
        views:      p.insights?.localPostViewsForMedia ?? null,
        clicks:     p.insights?.localPostActionsForCallToAction ?? null,
      }));
    } else {
      console.warn('localPosts API status:', postsRes.status);
    }

    return json({ photos, qanda, posts });

  } catch (err) {
    console.error('google-fetch-extra-data:', err instanceof Error ? err.name : 'UNKNOWN_ERROR');
    return json({ error: 'Internal error' }, 500);
  }
});
