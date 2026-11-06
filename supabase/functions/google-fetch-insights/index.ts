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

function toPerformanceName(fullLocationName: string): string {
  const parts = fullLocationName.split('/');
  return parts.slice(-2).join('/');
}

function dateToIso(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function isoToDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
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
    const rangeDays: number = body.range_days ?? 30;
    const customStart: string | null = body.start_date ?? null;
    const customEnd: string | null = body.end_date ?? null;

    // Compute requested date range
    const rangeEnd   = new Date();
    const rangeStart = new Date();
    if (customStart && customEnd) {
      const s = new Date(customStart + 'T00:00:00Z');
      const e = new Date(customEnd + 'T00:00:00Z');
      rangeStart.setTime(s.getTime());
      rangeEnd.setTime(e.getTime());
    } else {
      rangeStart.setDate(rangeEnd.getDate() - (rangeDays - 1));
    }
    const rangeStartStr = rangeStart.toISOString().slice(0, 10);
    const rangeEndStr   = rangeEnd.toISOString().slice(0, 10);

    // Get the location
    const locQuery = supabase
      .from('google_locations')
      .select('id, display_name, google_location_name, connection_id')
      .eq('user_id', user.id);

    const { data: location } = locationId
      ? await locQuery.eq('id', locationId).maybeSingle()
      : await locQuery.eq('is_selected', true).limit(1).maybeSingle();

    if (!location) return json({ error: 'No location found' }, 404);

    // Get all user's selected locations for multi-location breakdown
    const { data: allLocations } = await supabase
      .from('google_locations')
      .select('id, display_name')
      .eq('user_id', user.id)
      .eq('is_selected', true);

    // ── Sync from Google API (always refresh latest data) ──────────────────────

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

    if (tokenRow) {
      let accessToken = tokenRow.access_token;
      const expiry = conn?.token_expiry ? new Date(conn.token_expiry) : null;
      if (!expiry || expiry < new Date(Date.now() + 60_000)) {
        const newToken = await refreshAccessToken(tokenRow.refresh_token);
        if (newToken) {
          accessToken = newToken;
          await supabase.from('google_connection_tokens')
            .update({ access_token: newToken, updated_at: new Date().toISOString() })
            .eq('connection_id', location.connection_id);
        }
      }

      // Always sync 90 days so we have history for any range request
      const syncEnd   = new Date();
      const syncStart = new Date();
      syncStart.setDate(syncEnd.getDate() - 89);

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
      params.set('dailyRange.startDate.year',  String(syncStart.getFullYear()));
      params.set('dailyRange.startDate.month', String(syncStart.getMonth() + 1));
      params.set('dailyRange.startDate.day',   String(syncStart.getDate()));
      params.set('dailyRange.endDate.year',    String(syncEnd.getFullYear()));
      params.set('dailyRange.endDate.month',   String(syncEnd.getMonth() + 1));
      params.set('dailyRange.endDate.day',     String(syncEnd.getDate()));

      const apiRes = await fetch(
        `https://businessprofileperformance.googleapis.com/v1/${perfLocationName}/dailyMetrics:batchGet?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        type SeriesEntry = {
          dailyMetric: string;
          timeSeries: { datedValues: Array<{ date: { year: number; month: number; day: number }; value?: string }> };
        };
        const series: SeriesEntry[] = apiData.multiDailyMetricTimeSeries ?? [];

        const byDate: Record<string, {
          impressions_maps: number; impressions_search: number;
          direction_requests: number; call_clicks: number; website_clicks: number;
        }> = {};

        for (const s of series) {
          for (const dv of (s.timeSeries?.datedValues ?? [])) {
            const dateStr = dateToIso(dv.date);
            if (!byDate[dateStr]) {
              byDate[dateStr] = { impressions_maps: 0, impressions_search: 0, direction_requests: 0, call_clicks: 0, website_clicks: 0 };
            }
            const val = parseInt(dv.value ?? '0', 10) || 0;
            const row = byDate[dateStr]!;
            if (s.dailyMetric === 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS' || s.dailyMetric === 'BUSINESS_IMPRESSIONS_MOBILE_MAPS') {
              row.impressions_maps += val;
            } else if (s.dailyMetric === 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH' || s.dailyMetric === 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH') {
              row.impressions_search += val;
            } else if (s.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS') {
              row.direction_requests += val;
            } else if (s.dailyMetric === 'CALL_CLICKS') {
              row.call_clicks += val;
            } else if (s.dailyMetric === 'WEBSITE_CLICKS') {
              row.website_clicks += val;
            }
          }
        }

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
      } else {
        console.error('Insights API error:', apiRes.status, await apiRes.text());
      }
    }

    // ── Read back from location_insights for requested range ──────────────────

    const { data: insightRows } = await supabase
      .from('location_insights')
      .select('date, impressions_search, impressions_maps, direction_requests, call_clicks, website_clicks')
      .eq('user_id', user.id)
      .eq('location_id', location.id)
      .gte('date', rangeStartStr)
      .lte('date', rangeEndStr)
      .order('date', { ascending: true });

    type InsightRow = {
      date: string;
      impressions_search: number;
      impressions_maps: number;
      direction_requests: number;
      call_clicks: number;
      website_clicks: number;
    };

    const rows = (insightRows ?? []) as InsightRow[];

    // Build metrics array
    const metrics = rows.map(r => ({
      date:               r.date,
      views_search:       r.impressions_search,
      views_maps:         r.impressions_maps,
      calls:              r.call_clicks,
      website_clicks:     r.website_clicks,
      direction_requests: r.direction_requests,
    }));

    // Compute totals
    const totals = rows.reduce(
      (acc, r) => ({
        views_search:       acc.views_search       + r.impressions_search,
        views_maps:         acc.views_maps         + r.impressions_maps,
        calls:              acc.calls              + r.call_clicks,
        website_clicks:     acc.website_clicks     + r.website_clicks,
        direction_requests: acc.direction_requests + r.direction_requests,
        total_views:        acc.total_views        + r.impressions_search + r.impressions_maps,
      }),
      { views_search: 0, views_maps: 0, calls: 0, website_clicks: 0, direction_requests: 0, total_views: 0 }
    );

    // Per-location breakdown (for multi-location users)
    const locationBreakdown: { id: string; display_name: string | null; total_views: number }[] = [];
    if ((allLocations?.length ?? 0) > 1) {
      for (const loc of (allLocations ?? [])) {
        const { data: locRows } = await supabase
          .from('location_insights')
          .select('impressions_search, impressions_maps')
          .eq('user_id', user.id)
          .eq('location_id', loc.id)
          .gte('date', rangeStartStr)
          .lte('date', rangeEndStr);
        const total = (locRows ?? []).reduce(
          (s: number, r: { impressions_search: number; impressions_maps: number }) =>
            s + r.impressions_search + r.impressions_maps, 0
        );
        locationBreakdown.push({ id: loc.id, display_name: loc.display_name, total_views: total });
      }
    }

    // Baseline: first 30 days after the user's earliest synced data
    const { data: baselineRows } = await supabase
      .from('location_insights')
      .select('date, impressions_search, impressions_maps, direction_requests, call_clicks, website_clicks')
      .eq('user_id', user.id)
      .eq('location_id', location.id)
      .order('date', { ascending: true })
      .limit(30);

    let baseline = null;
    if ((baselineRows?.length ?? 0) >= 7) {
      const br = (baselineRows ?? []) as InsightRow[];
      baseline = br.reduce(
        (acc, r) => ({
          views_search:       acc.views_search       + r.impressions_search,
          views_maps:         acc.views_maps         + r.impressions_maps,
          calls:              acc.calls              + r.call_clicks,
          website_clicks:     acc.website_clicks     + r.website_clicks,
          direction_requests: acc.direction_requests + r.direction_requests,
          total_views:        acc.total_views        + r.impressions_search + r.impressions_maps,
          captured_at:        br[0]!.date,
        }),
        { views_search: 0, views_maps: 0, calls: 0, website_clicks: 0, direction_requests: 0, total_views: 0, captured_at: '' }
      );
    }

    return json({
      metrics,
      totals,
      queries:    [],
      locations:  locationBreakdown,
      date_range: { start: rangeStartStr, end: rangeEndStr },
      baseline,
    });

  } catch (err) {
    console.error('google-fetch-insights error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
