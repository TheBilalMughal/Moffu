import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getGoogleCreds(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['google_client_id', 'google_client_secret', 'google_redirect_uri']);

  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

  return {
    clientId:     map['google_client_id']     || Deno.env.get('GOOGLE_CLIENT_ID')     || '',
    clientSecret: map['google_client_secret'] || Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
    redirectUri:  map['google_redirect_uri']  || Deno.env.get('GOOGLE_REDIRECT_URI')  || '',
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { code, state } = await req.json();
    if (!code || !state) return new Response(JSON.stringify({ error: 'Missing code or state' }), { status: 400, headers: corsHeaders });

    const { clientId, clientSecret, redirectUri } = await getGoogleCreds(supabase);
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Google credentials not configured. Set them in Admin → Settings → Google API.' }), { status: 500, headers: corsHeaders });
    }

    // Search Console / GA4 use their own service-role-only connection row so
    // granting analytics scopes never replaces the user's GBP refresh token.
    const { data: growthConnection, error: growthLookupError } = await supabase
      .from('google_growth_connections')
      .select('id,oauth_state,oauth_state_expires_at,refresh_token')
      .eq('user_id', user.id)
      .eq('oauth_state', state)
      .maybeSingle();
    if (growthLookupError) throw new Error('Google Growth connection lookup failed');
    if (growthConnection) {
      if (!growthConnection.oauth_state_expires_at || Date.parse(growthConnection.oauth_state_expires_at) < Date.now()) {
        await supabase.from('google_growth_connections').update({ oauth_state: null, oauth_state_expires_at: null }).eq('id', growthConnection.id);
        return new Response(JSON.stringify({ error: 'Google connection request expired. Please try again.' }), { status: 400, headers: corsHeaders });
      }

      const growthTokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      if (!growthTokenRes.ok) {
        console.error('Google Growth token exchange failed:', growthTokenRes.status);
        await supabase.from('google_growth_connections').update({ oauth_state: null, oauth_state_expires_at: null }).eq('id', growthConnection.id);
        return new Response(JSON.stringify({ error: 'Google authorization could not be completed. Please retry.' }), { status: 400, headers: corsHeaders });
      }

      const growthTokens = await growthTokenRes.json();
      if (typeof growthTokens.access_token !== 'string') throw new Error('Google Growth returned no access token');
      const grantedScopes = typeof growthTokens.scope === 'string' ? growthTokens.scope.split(/\s+/).filter(Boolean) : [];
      const requiredScopes = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'];
      if (grantedScopes.length && requiredScopes.some(scope => !grantedScopes.includes(scope))) {
        await supabase.from('google_growth_connections').update({ oauth_state: null, oauth_state_expires_at: null }).eq('id', growthConnection.id);
        return new Response(JSON.stringify({ error: 'Please grant both Search Console and Google Analytics read-only permissions.' }), { status: 400, headers: corsHeaders });
      }
      const refreshToken = typeof growthTokens.refresh_token === 'string' && growthTokens.refresh_token
        ? growthTokens.refresh_token : growthConnection.refresh_token;
      if (!refreshToken) throw new Error('Google did not issue a refresh token; reconnect with offline access.');

      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${growthTokens.access_token}` },
      });
      const profile = profileRes.ok ? await profileRes.json() : {};
      const { error: saveGrowthError } = await supabase.from('google_growth_connections').update({
        google_email: profile.email ?? null,
        access_token: growthTokens.access_token,
        refresh_token: refreshToken,
        token_expiry: new Date(Date.now() + Number(growthTokens.expires_in ?? 3600) * 1000).toISOString(),
        scopes: grantedScopes.length ? grantedScopes : requiredScopes,
        connected_at: new Date().toISOString(),
        oauth_state: null,
        oauth_state_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', growthConnection.id);
      if (saveGrowthError) throw new Error('Google Growth credentials could not be saved');
      return new Response(JSON.stringify({ success: true, redirect_to: '/google-growth?google_growth=connected' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('id, oauth_state')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) return new Response(JSON.stringify({ error: 'Connection not found' }), { status: 400, headers: corsHeaders });
    if (connection.oauth_state !== state) return new Response(JSON.stringify({ error: 'State mismatch' }), { status: 400, headers: corsHeaders });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      await supabase.from('google_connections').update({ state: 'ERROR', error_message: 'Token exchange failed', oauth_state: null }).eq('id', connection.id);
      return new Response(JSON.stringify({ error: 'Token exchange failed' }), { status: 400, headers: corsHeaders });
    }

    const tokens = await tokenRes.json();
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = userInfoRes.ok ? await userInfoRes.json() : {};

    await supabase.from('google_connection_tokens').upsert({
      connection_id: connection.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' });

    await supabase.from('google_connections').update({
      state: 'CONNECTED',
      google_email: googleUser.email ?? null,
      token_expiry: tokenExpiry,
      oauth_state: null,
      connected_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', connection.id);

    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!accountsRes.ok) {
      const accountsErr = await accountsRes.text();
      console.error('Accounts API failed:', accountsRes.status, accountsErr);
      await supabase.from('google_connections').update({
        state: 'ATTENTION_REQUIRED',
        error_message: `Business Account API error (${accountsRes.status}): ensure "My Business Account Management API" and "My Business Business Information API" are enabled in Google Cloud Console.`,
      }).eq('id', connection.id);
    } else {
      const accountsData = await accountsRes.json();
      const accounts: Array<{ name: string }> = accountsData.accounts ?? [];

      // Store the first account ID so reviews API can use full path
      const firstAccount = accounts[0]?.name ?? null;
      if (firstAccount) {
        await supabase.from('google_connections')
          .update({ google_account_id: firstAccount })
          .eq('id', connection.id);
      }

      for (const account of accounts) {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (!locRes.ok) continue;

        const locData = await locRes.json();
        const locations: Array<{ name: string; title?: string; storefrontAddress?: { addressLines?: string[] } }> = locData.locations ?? [];

        for (const loc of locations) {
          const address = loc.storefrontAddress?.addressLines?.join(', ') ?? null;
          // Store full path "accounts/{id}/locations/{id}" for Reviews API compatibility
          const fullLocationName = `${account.name}/${loc.name}`;
          await supabase.from('google_locations').upsert({
            connection_id: connection.id,
            user_id: user.id,
            google_location_name: fullLocationName,
            display_name: loc.title ?? null,
            address,
          }, { onConflict: 'connection_id,google_location_name' });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('google-oauth-callback error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
