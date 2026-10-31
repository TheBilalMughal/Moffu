import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
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
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.access_token ?? null;
}

// Extract "locations/12345" from "accounts/123/locations/12345"
function toPerformanceName(fullLocationName: string): string {
  const parts = fullLocationName.split('/');
  return parts.slice(-2).join('/');
}

function dateToIso(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const locationId: string | null = body.location_id ?? null;

    // Get the location — either specified or the user's selected one
    const locQuery = supabase
      .from('google_locations')
      .select('id, google_location_name, connection_id')
      .eq('user_id', user.id);

    const { data: location } = locationId
      ? await locQuery.eq('id', locationId).maybeSingle()
      : await locQuery.eq('is_selected', true).maybeSingle();

    if (!location) return json({ error: 'No location found' }, 404);

    // Get tokens
    const [{ data: tokenRow }, { data: conn }] = await Promise.all([
      supabase.from('google_connection_tokens')
        .select('access_token, refresh_token')
        .eq('connection_id', location.connection_id)
        .single(),
      supabase.from('google_connections')
        .select('token_expiry')
        .eq('id', location.connection_id)
        .single(),
    ]);

    if (!tokenRow) return json({ error: 'No tokens' }, 400);

    let accessToken = tokenRow.access_token;
    const expiry = conn?.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      const newToken = await refreshAccessToken(tokenRow.refresh_token);
      if (!newToken) return json({ error: 'Token refresh failed' }, 400);
      accessToken = newToken;
      await supabase.from('google_connection_tokens')
        .update({ access_token: newToken, updated_at: new Date().toISOString() })
        .eq('connection_id', location.connection_id);
    }

    // Build date range: last 90 days
    const endDate   = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 89);

    const perfLocationName = toPerformanceName(location.google_location_name);

    const METRICS = [
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'WEBSITE_CLICKS',
    ];

    const params = new URLSearchParams();
    METRICS.forEach(m => params.append('dailyMetrics', m));
    params.set('dailyRange.startDate.year',  String(startDate.getFullYear()));
    params.set('dailyRange.startDate.month', String(startDate.getMonth() + 1));
    params.set('dailyRange.startDate.day',   String(startDate.getDate()));
    params.set('dailyRange.endDate.year',    String(endDate.getFullYear()));
    params.set('dailyRange.endDate.month',   String(endDate.getMonth() + 1));
    params.set('dailyRange.endDate.day',     String(endDate.getDate()));

    const apiRes = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${perfLocationName}/dailyMetrics:batchGet?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Insights API error:', apiRes.status, errText);
      return json({ error: `Insights API error (${apiRes.status})` }, 502);
    }

    const apiData = await apiRes.json();
    const series: Array<{ dailyMetric: string; timeSeries: { datedValues: Array<{ date: { year: number; month: number; day: number }; value?: string }> } }> =
      apiData.multiDailyMetricTimeSeries ?? [];

    // Aggregate by date
    const byDate: Record<string, {
      impressions_maps: number;
      impressions_search: number;
      direction_requests: number;
      call_clicks: number;
      website_clicks: number;
    }> = {};

    for (const s of series) {
      const metric = s.dailyMetric;
      for (const dv of (s.timeSeries?.datedValues ?? [])) {
        const dateStr = dateToIso(dv.date);
        if (!byDate[dateStr]) {
          byDate[dateStr] = { impressions_maps: 0, impressions_search: 0, direction_requests: 0, call_clicks: 0, website_clicks: 0 };
        }
        const val = parseInt(dv.value ?? '0', 10) || 0;
        const row = byDate[dateStr]!;
        if (metric === 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS' || metric === 'BUSINESS_IMPRESSIONS_MOBILE_MAPS') {
          row.impressions_maps += val;
        } else if (metric === 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH' || metric === 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH') {
          row.impressions_search += val;
        } else if (metric === 'BUSINESS_DIRECTION_REQUESTS') {
          row.direction_requests += val;
        } else if (metric === 'CALL_CLICKS') {
          row.call_clicks += val;
        } else if (metric === 'WEBSITE_CLICKS') {
          row.website_clicks += val;
        }
      }
    }

    // Upsert into location_insights
    const rows = Object.entries(byDate).map(([date, vals]) => ({
      user_id:     user.id,
      location_id: location.id,
      date,
      synced_at:   new Date().toISOString(),
      ...vals,
    }));

    if (rows.length > 0) {
      await supabase.from('location_insights').upsert(rows, { onConflict: 'location_id,date' });
    }

    // Build 30-day summary
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 29);
    const thirtyAgoStr = thirtyAgo.toISOString().slice(0, 10);

    const last30 = Object.entries(byDate)
      .filter(([d]) => d >= thirtyAgoStr)
      .sort(([a], [b]) => a.localeCompare(b));

    let totalImpressions = 0, totalDirections = 0, totalCalls = 0, totalWebsite = 0;
    const trend: { date: string; impressions: number }[] = [];

    for (const [date, vals] of last30) {
      const imp = vals.impressions_maps + vals.impressions_search;
      totalImpressions   += imp;
      totalDirections    += vals.direction_requests;
      totalCalls         += vals.call_clicks;
      totalWebsite       += vals.website_clicks;
      trend.push({ date, impressions: imp });
    }

    return json({
      ok: true,
      rows_synced: rows.length,
      summary: {
        impressions:        totalImpressions,
        direction_requests: totalDirections,
        call_clicks:        totalCalls,
        website_clicks:     totalWebsite,
        trend,
      },
    });
  } catch (err) {
    console.error('google-fetch-insights error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
