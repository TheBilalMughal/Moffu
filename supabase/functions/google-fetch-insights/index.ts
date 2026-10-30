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

// Extract numeric location ID from "locations/123" or "accounts/xxx/locations/123"
function extractLocationId(name: string): string | null {
  const m = name.match(/locations\/(\d+)$/);
  return m ? m[1]! : null;
}

function dateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setDate(end.getDate() - 2); // Google data has ~2 day delay
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { start, end };
}

function toDateParam(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function dateStr(d: { year: number; month: number; day: number }) {
  return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
}

const PERF_BASE = 'https://businessprofileperformance.googleapis.com/v1';

const METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const rangeDays: number = body.range_days ?? 30;
    const locationIdFilter: string | null = body.location_id ?? null;

    // Get connection + refresh token
    const { data: conn } = await supabase
      .from('google_connections')
      .select('id, state, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!conn || conn.state !== 'CONNECTED' || !conn.refresh_token) {
      return json({ error: 'Google not connected' }, 400);
    }

    const { clientId, clientSecret } = await getGoogleCreds(supabase);
    const { access_token } = await doRefreshToken(conn.refresh_token, clientId, clientSecret);

    // Get selected locations
    let locQuery = supabase
      .from('google_locations')
      .select('id, google_location_name, display_name')
      .eq('is_selected', true)
      .eq('connection_id', conn.id);
    if (locationIdFilter) locQuery = locQuery.eq('id', locationIdFilter);
    const { data: locations } = await locQuery;

    const validLocs = (locations ?? []).filter((l: { google_location_name: string }) =>
      extractLocationId(l.google_location_name) !== null
    );

    if (validLocs.length === 0) {
      return json({ metrics: [], totals: {}, queries: [], locations: [] });
    }

    const { start, end } = dateRange(rangeDays);
    const startParam = toDateParam(start);
    const endParam = toDateParam(end);

    // Fetch metrics for each location and aggregate
    const allDailyMap = new Map<string, {
      views_search: number; views_maps: number;
      calls: number; website_clicks: number; direction_requests: number;
    }>();

    let totalViewsSearch = 0, totalViewsMaps = 0;
    let totalCalls = 0, totalWebsite = 0, totalDirections = 0;

    const locResults: { id: string; display_name: string | null; total_views: number }[] = [];

    for (const loc of validLocs) {
      const locId = extractLocationId(loc.google_location_name)!;
      const params = new URLSearchParams();
      for (const m of METRICS) params.append('dailyMetric', m);
      params.set('dailyRange.startDate.year',  String(startParam.year));
      params.set('dailyRange.startDate.month', String(startParam.month));
      params.set('dailyRange.startDate.day',   String(startParam.day));
      params.set('dailyRange.endDate.year',  String(endParam.year));
      params.set('dailyRange.endDate.month', String(endParam.month));
      params.set('dailyRange.endDate.day',   String(endParam.day));

      const res = await fetch(
        `${PERF_BASE}/locations/${locId}/dailyMetrics:batchGet?${params}`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      if (!res.ok) {
        console.error(`Performance API error for ${locId}:`, res.status, await res.text());
        continue;
      }

      const data = await res.json() as {
        multiDailyMetricTimeSeries?: {
          dailyMetric: string;
          timeSeries?: { datedValues?: { date: { year: number; month: number; day: number }; value?: string }[] };
        }[];
      };

      let locViews = 0;

      for (const series of data.multiDailyMetricTimeSeries ?? []) {
        const metric = series.dailyMetric;
        for (const dv of series.timeSeries?.datedValues ?? []) {
          const ds = dateStr(dv.date);
          const val = parseInt(dv.value ?? '0', 10) || 0;
          if (!allDailyMap.has(ds)) {
            allDailyMap.set(ds, { views_search: 0, views_maps: 0, calls: 0, website_clicks: 0, direction_requests: 0 });
          }
          const entry = allDailyMap.get(ds)!;
          if (metric === 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH' || metric === 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH') {
            entry.views_search += val; totalViewsSearch += val; locViews += val;
          } else if (metric === 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS' || metric === 'BUSINESS_IMPRESSIONS_MOBILE_MAPS') {
            entry.views_maps += val; totalViewsMaps += val; locViews += val;
          } else if (metric === 'CALL_CLICKS') {
            entry.calls += val; totalCalls += val;
          } else if (metric === 'WEBSITE_CLICKS') {
            entry.website_clicks += val; totalWebsite += val;
          } else if (metric === 'BUSINESS_DIRECTION_REQUESTS') {
            entry.direction_requests += val; totalDirections += val;
          }
        }
      }

      locResults.push({ id: loc.id, display_name: loc.display_name, total_views: locViews });
    }

    // Sort metrics by date
    const metrics = [...allDailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    // Fetch search queries for first valid location (or filtered)
    let queries: { query: string; count: number }[] = [];
    const firstLoc = validLocs[0];
    if (firstLoc) {
      const locId = extractLocationId(firstLoc.google_location_name)!;
      const qRes = await fetch(
        `${PERF_BASE}/locations/${locId}/searchkeywords/impressions/monthly`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      if (qRes.ok) {
        const qData = await qRes.json() as {
          searchKeywordsCounts?: { searchKeyword: string; insightsValue?: { value?: string } }[];
        };
        queries = (qData.searchKeywordsCounts ?? [])
          .map(q => ({ query: q.searchKeyword, count: parseInt(q.insightsValue?.value ?? '0', 10) || 0 }))
          .filter(q => q.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
      }
    }

    return json({
      metrics,
      totals: {
        views_search: totalViewsSearch,
        views_maps: totalViewsMaps,
        calls: totalCalls,
        website_clicks: totalWebsite,
        direction_requests: totalDirections,
        total_views: totalViewsSearch + totalViewsMaps,
      },
      queries,
      locations: locResults,
      date_range: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    });

  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
