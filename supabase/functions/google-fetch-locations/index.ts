import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('Token refresh failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.access_token ?? null;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, 3000));
    return fetchWithRetry(url, init, retries - 1);
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { clientId, clientSecret } = await getGoogleCreds(supabase);

    // Get connection
    const { data: conn, error: connErr } = await supabase
      .from('google_connections')
      .select('id, state, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (connErr || !conn) return new Response(JSON.stringify({ error: 'No connection found' }), { status: 400, headers: corsHeaders });

    // Get tokens
    const { data: tokenRow } = await supabase
      .from('google_connection_tokens')
      .select('access_token, refresh_token')
      .eq('connection_id', conn.id)
      .single();

    if (!tokenRow?.access_token) {
      return new Response(JSON.stringify({ error: 'No access token — please reconnect Google.' }), { status: 400, headers: corsHeaders });
    }

    // Refresh token if expired or close to expiry
    let accessToken = tokenRow.access_token;
    const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
    if (!expiry || expiry < new Date(Date.now() + 60_000)) {
      if (!tokenRow.refresh_token) {
        return new Response(JSON.stringify({ error: 'Token expired — please reconnect Google.' }), { status: 400, headers: corsHeaders });
      }
      const newToken = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
      if (!newToken) {
        await supabase.from('google_connections').update({ state: 'REFRESH_FAILED', error_message: 'Token refresh failed. Please reconnect.' }).eq('id', conn.id);
        return new Response(JSON.stringify({ error: 'Token refresh failed — please reconnect Google.' }), { status: 400, headers: corsHeaders });
      }
      accessToken = newToken;
      const newExpiry = new Date(Date.now() + 3500 * 1000).toISOString();
      await supabase.from('google_connection_tokens').update({ access_token: newToken, updated_at: new Date().toISOString() }).eq('connection_id', conn.id);
      await supabase.from('google_connections').update({ token_expiry: newExpiry }).eq('id', conn.id);
    }

    const accountsRes = await fetchWithRetry(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      console.error('Accounts API failed:', accountsRes.status, errText);

      // On 401 after fresh token, token might be revoked — ask to reconnect
      if (accountsRes.status === 401) {
        await supabase.from('google_connections').update({
          state: 'ATTENTION_REQUIRED',
          error_message: 'Google authorization expired. Please disconnect and reconnect your Google account.',
        }).eq('id', conn.id);
        return new Response(JSON.stringify({ error: 'Google authorization expired. Please reconnect.' }), { status: 400, headers: corsHeaders });
      }

      const msg = accountsRes.status === 429
        ? 'Google API rate limit hit. Please wait a minute and retry.'
        : `Google API error (${accountsRes.status}): ${errText}`;

      await supabase.from('google_connections').update({
        state: 'ATTENTION_REQUIRED',
        error_message: msg,
      }).eq('id', conn.id);

      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
    }

    const accountsData = await accountsRes.json();
    const accounts: Array<{ name: string }> = accountsData.accounts ?? [];
    let total = 0;

    for (const account of accounts) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!locRes.ok) {
        console.error('Locations API failed:', locRes.status, await locRes.text());
        continue;
      }

      const locData = await locRes.json();
      const locations: Array<{ name: string; title?: string; storefrontAddress?: { addressLines?: string[] } }> = locData.locations ?? [];

      for (const loc of locations) {
        const address = loc.storefrontAddress?.addressLines?.join(', ') ?? null;
        // Use full path "accounts/{id}/locations/{id}" to match oauth-callback format
        const fullLocationName = loc.name.startsWith('accounts/')
          ? loc.name
          : `${account.name}/${loc.name}`;
        await supabase.from('google_locations').upsert({
          connection_id: conn.id,
          user_id: user.id,
          google_location_name: fullLocationName,
          display_name: loc.title ?? null,
          address,
        }, { onConflict: 'connection_id,google_location_name' });
        total++;
      }
    }

    await supabase.from('google_connections').update({
      state: 'CONNECTED',
      error_message: null,
    }).eq('id', conn.id);

    return new Response(JSON.stringify({ success: true, locations_fetched: total }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('google-fetch-locations error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
