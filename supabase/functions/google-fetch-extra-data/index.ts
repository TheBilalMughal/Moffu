import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.access_token ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const locationId: string | null = body.location_id ?? null;

    // ── Get the location ──────────────────────────────────────────────────────
    const locQ = supabase
      .from('google_locations')
      .select('id, google_location_name, connection_id')
      .eq('user_id', user.id);
    if (locationId) locQ.eq('id', locationId); else locQ.eq('is_selected', true);
    const { data: loc } = await locQ.maybeSingle();
    if (!loc) return json({ error: 'Location not found' }, 404);

    // ── Get tokens ────────────────────────────────────────────────────────────
    const [{ data: tokenRow }, { data: conn }] = await Promise.all([
      supabase.from('google_connection_tokens').select('access_token, refresh_token').eq('connection_id', loc.connection_id).single(),
      supabase.from('google_connections').select('token_expiry').eq('id', loc.connection_id).single(),
    ]);
    if (!tokenRow) return json({ error: 'No token found' }, 400);

    let accessToken = tokenRow.access_token;
    const expiry = conn?.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const { clientId, clientSecret } = await getGoogleCreds(supabase);
      if (clientId && clientSecret) {
        const newToken = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
        if (newToken) {
          accessToken = newToken;
          await supabase.from('google_connection_tokens')
            .update({ access_token: newToken, updated_at: new Date().toISOString() })
            .eq('connection_id', loc.connection_id);
        }
      }
    }

    const locationName = loc.google_location_name;
    const authHdr = { Authorization: `Bearer ${accessToken}` };

    // ── Fetch photos, Q&A, posts in parallel ─────────────────────────────────
    const [mediaRes, questionsRes, postsRes] = await Promise.all([
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/media?pageSize=1`, { headers: authHdr }),
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/questions?pageSize=10&answersPerQuestion=0`, { headers: authHdr }),
      fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts?pageSize=10`, { headers: authHdr }),
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
      console.warn('media API:', mediaRes.status, await mediaRes.text());
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
      console.warn('questions API:', questionsRes.status, await questionsRes.text());
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
      console.warn('localPosts API:', postsRes.status, await postsRes.text());
    }

    return json({ photos, qanda, posts });

  } catch (err) {
    console.error('google-fetch-extra-data error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
