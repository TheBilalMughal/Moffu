import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT_URI_SETTING = 'google_redirect_uri';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Connection = {
  id: string;
  user_id: string;
  google_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  oauth_state: string | null;
  oauth_state_expires_at: string | null;
  scopes: string[];
  search_console_site_url: string | null;
  ga4_property_id: string | null;
};

class GrowthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
}

async function googleConfig(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.from('platform_settings').select('key,value')
    .in('key', ['google_client_id', 'google_client_secret', REDIRECT_URI_SETTING]);
  if (error) throw new GrowthError('GOOGLE_CONFIGURATION_UNAVAILABLE', 503);
  const values = Object.fromEntries((data ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
  const clientId = values.google_client_id || Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = values.google_client_secret || Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  const redirectUri = values[REDIRECT_URI_SETTING] || Deno.env.get('GOOGLE_REDIRECT_URI') || '';
  if (!clientId || !clientSecret || !redirectUri) throw new GrowthError('GOOGLE_CONFIGURATION_INCOMPLETE', 503);
  return { clientId, clientSecret, redirectUri };
}

async function getUser(req: Request, admin: ReturnType<typeof createClient>) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new GrowthError('UNAUTHORIZED', 401);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new GrowthError('UNAUTHORIZED', 401);
  return user;
}

async function getConnection(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin.from('google_growth_connections')
    .select('id,user_id,google_email,access_token,refresh_token,token_expiry,oauth_state,oauth_state_expires_at,scopes,search_console_site_url,ga4_property_id')
    .eq('user_id', userId).maybeSingle();
  if (error) throw new GrowthError('CONNECTION_LOOKUP_FAILED', 503);
  return data as Connection | null;
}

async function freshAccessToken(admin: ReturnType<typeof createClient>, connection: Connection, userId: string) {
  if (!connection.refresh_token) throw new GrowthError('GOOGLE_RECONNECT_REQUIRED', 401);
  const expiry = connection.token_expiry ? Date.parse(connection.token_expiry) : 0;
  if (connection.access_token && expiry > Date.now() + 60_000) return connection.access_token;

  const { clientId, clientSecret } = await googleConfig(admin);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new GrowthError(response.status === 400 ? 'GOOGLE_RECONNECT_REQUIRED' : 'GOOGLE_TOKEN_REFRESH_FAILED', 401);
  const tokens = await response.json();
  if (typeof tokens.access_token !== 'string') throw new GrowthError('GOOGLE_TOKEN_REFRESH_FAILED', 401);
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString();
  const updates: Record<string, unknown> = { access_token: tokens.access_token, token_expiry: expiresAt, updated_at: new Date().toISOString() };
  if (typeof tokens.refresh_token === 'string' && tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
  const { error } = await admin.from('google_growth_connections').update(updates).eq('user_id', userId);
  if (error) throw new GrowthError('TOKEN_STORAGE_FAILED', 503);
  return tokens.access_token as string;
}

async function providerJson(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    let providerCode = `HTTP_${response.status}`;
    try {
      const payload = await response.json();
      const providerError = payload?.error;
      const reasons = [
        ...(Array.isArray(providerError?.errors) ? providerError.errors.map((item: { reason?: string }) => item?.reason) : []),
        ...(Array.isArray(providerError?.details) ? providerError.details.map((item: { reason?: string }) => item?.reason) : []),
      ].filter((reason): reason is string => typeof reason === 'string' && /^[A-Za-z0-9_]+$/.test(reason));
      // Google uses PERMISSION_DENIED for disabled APIs too; preserve the
      // structured reason so the UI can tell setup errors from account access.
      providerCode = reasons.find(reason => ['SERVICE_DISABLED', 'accessNotConfigured', 'API_KEY_SERVICE_BLOCKED'].includes(reason))
        ?? providerError?.status
        ?? providerCode;
    } catch { /* keep HTTP status only */ }
    throw new GrowthError(`GOOGLE_API_${providerCode}`, response.status === 401 ? 401 : 502);
  }
  return response.json();
}

async function listResources(accessToken: string) {
  const [searchConsole, analytics] = await Promise.allSettled([
    providerJson('https://www.googleapis.com/webmasters/v3/sites', accessToken),
    (async () => {
      const properties: Array<{ property: string; displayName: string; parentAccount?: string }> = [];
      let pageToken = '';
      for (let page = 0; page < 10; page++) {
        const params = new URLSearchParams({ pageSize: '200' });
        if (pageToken) params.set('pageToken', pageToken);
        const result = await providerJson(`https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params}`, accessToken);
        for (const account of result.accountSummaries ?? []) {
          for (const property of account.propertySummaries ?? []) {
            if (typeof property.property === 'string') properties.push({
              property: property.property,
              displayName: property.displayName ?? property.property,
              parentAccount: account.displayName,
            });
          }
        }
        pageToken = result.nextPageToken ?? '';
        if (!pageToken) break;
      }
      return properties;
    })(),
  ]);
  return {
    searchConsole: searchConsole.status === 'fulfilled'
      ? { items: (searchConsole.value.siteEntry ?? []).map((site: { siteUrl: string; permissionLevel?: string }) => ({ siteUrl: site.siteUrl, permissionLevel: site.permissionLevel ?? null })), error: null }
      : { items: [], error: searchConsole.reason instanceof GrowthError ? searchConsole.reason.code : 'SEARCH_CONSOLE_UNAVAILABLE' },
    analytics: analytics.status === 'fulfilled'
      ? { items: analytics.value, error: null }
      : { items: [], error: analytics.reason instanceof GrowthError ? analytics.reason.code : 'ANALYTICS_ADMIN_UNAVAILABLE' },
  };
}

function metric(row: any, name: string): number {
  const index = row?.metricHeaders?.findIndex((header: { name: string }) => header.name === name) ?? -1;
  return index >= 0 ? Number(row.metricValues?.[index]?.value ?? 0) : 0;
}

function dateRange(days: number, offsetDays = 0) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 3 - offsetDays); // Search Console data is not fully current.
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

async function searchConsoleReport(accessToken: string, siteUrl: string, range: ReturnType<typeof dateRange>) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const base = { ...range, type: 'web', dataState: 'final' };
  const [summary, queries] = await Promise.all([
    providerJson(endpoint, accessToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) }),
    providerJson(endpoint, accessToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, dimensions: ['query'], rowLimit: 20 }) }),
  ]);
  const totals = summary.rows?.[0] ?? {};
  return {
    ...range,
    clicks: Number(totals.clicks ?? 0),
    impressions: Number(totals.impressions ?? 0),
    ctr: Number(totals.ctr ?? 0),
    averagePosition: Number(totals.position ?? 0),
    queries: (queries.rows ?? []).map((row: any) => ({ query: row.keys?.[0] ?? '', clicks: Number(row.clicks ?? 0), impressions: Number(row.impressions ?? 0), ctr: Number(row.ctr ?? 0), averagePosition: Number(row.position ?? 0) })),
  };
}

async function analyticsReport(accessToken: string, property: string, range: ReturnType<typeof dateRange>) {
  const resource = property.replace(/^properties\//, '');
  if (!/^\d+$/.test(resource)) throw new GrowthError('INVALID_GA4_PROPERTY', 400);
  const result = await providerJson(`https://analyticsdata.googleapis.com/v1beta/properties/${resource}:runReport`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
      dimensionFilter: { filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'EXACT', value: 'google / organic' } } },
    }),
  });
  const row = result.rows?.[0];
  return { ...range, sessions: metric(result, 'sessions') || Number(row?.metricValues?.[0]?.value ?? 0), users: metric(result, 'totalUsers') || Number(row?.metricValues?.[1]?.value ?? 0), conversions: metric(result, 'conversions') || Number(row?.metricValues?.[2]?.value ?? 0) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const user = await getUser(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : 'status';

    if (action === 'start') {
      const { clientId, redirectUri } = await googleConfig(admin);
      const state = randomState();
      const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
      const { data: existing, error: lookupError } = await admin.from('google_growth_connections').select('id')
        .eq('user_id', user.id).maybeSingle();
      if (lookupError) throw new GrowthError('CONNECTION_LOOKUP_FAILED', 503);
      const { error } = existing
        ? await admin.from('google_growth_connections').update({ oauth_state: state, oauth_state_expires_at: expiry, updated_at: new Date().toISOString() }).eq('user_id', user.id)
        : await admin.from('google_growth_connections').insert({ user_id: user.id, oauth_state: state, oauth_state_expires_at: expiry });
      if (error) throw new GrowthError('CONNECTION_SAVE_FAILED', 503);
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES,
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
      return json({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    let connection = await getConnection(admin, user.id);
    if (action === 'disconnect') {
      if (connection?.refresh_token) {
        await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: connection.refresh_token }), signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
      }
      const { error } = await admin.from('google_growth_connections').delete().eq('user_id', user.id);
      if (error) throw new GrowthError('DISCONNECT_FAILED', 503);
      return json({ success: true });
    }
    if (!connection?.refresh_token) {
      if (action === 'status') return json({ connected: false, resources: null, searchConsoleSiteUrl: null, ga4PropertyId: null });
      throw new GrowthError('GOOGLE_GROWTH_NOT_CONNECTED', 400);
    }

    const accessToken = await freshAccessToken(admin, connection, user.id);
    if (action === 'status') {
      const resources = await listResources(accessToken);
      return json({ connected: true, googleEmail: connection.google_email, scopes: connection.scopes,
        searchConsoleSiteUrl: connection.search_console_site_url, ga4PropertyId: connection.ga4_property_id, resources });
    }

    if (action === 'configure') {
      const siteUrl = typeof body.searchConsoleSiteUrl === 'string' ? body.searchConsoleSiteUrl : '';
      const property = typeof body.ga4PropertyId === 'string' ? body.ga4PropertyId : '';
      const resources = await listResources(accessToken);
      if (siteUrl && (resources.searchConsole.error || !resources.searchConsole.items.some((site: { siteUrl: string }) => site.siteUrl === siteUrl))) throw new GrowthError('SEARCH_CONSOLE_PROPERTY_NOT_ACCESSIBLE', 400);
      if (property && (resources.analytics.error || !resources.analytics.items.some((item: { property: string }) => item.property === property))) throw new GrowthError('GA4_PROPERTY_NOT_ACCESSIBLE', 400);
      const { error } = await admin.from('google_growth_connections').update({ search_console_site_url: siteUrl || null, ga4_property_id: property || null, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      if (error) throw new GrowthError('PROPERTY_SELECTION_SAVE_FAILED', 503);
      return json({ success: true, searchConsoleSiteUrl: siteUrl || null, ga4PropertyId: property || null });
    }

    if (action === 'report') {
      connection = await getConnection(admin, user.id);
      if (!connection?.search_console_site_url || !connection.ga4_property_id) throw new GrowthError('SELECT_BOTH_PROPERTIES', 400);
      const days = body.days === 90 ? 90 : 28;
      const currentRange = dateRange(days);
      const previousRange = dateRange(days, days);
      const results = await Promise.all([
        searchConsoleReport(accessToken, connection.search_console_site_url, currentRange),
        searchConsoleReport(accessToken, connection.search_console_site_url, previousRange),
        analyticsReport(accessToken, connection.ga4_property_id, currentRange),
        analyticsReport(accessToken, connection.ga4_property_id, previousRange),
      ]);
      return json({ days, searchConsole: { current: results[0], previous: results[1] }, analytics: { current: results[2], previous: results[3] }, dataThrough: currentRange.endDate });
    }

    throw new GrowthError('UNKNOWN_ACTION', 400);
  } catch (error) {
    const code = error instanceof GrowthError ? error.code : 'INTERNAL_ERROR';
    const status = error instanceof GrowthError ? error.status : 500;
    console.error('google-growth:', code);
    return json({ error: code }, status);
  }
});
