import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { code, state } = await req.json();
    if (!code || !state) return new Response(JSON.stringify({ error: 'Missing code or state' }), { status: 400 });

    // Validate state
    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('id, oauth_state')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) return new Response(JSON.stringify({ error: 'Connection not found' }), { status: 400 });
    if (connection.oauth_state !== state) return new Response(JSON.stringify({ error: 'State mismatch' }), { status: 400 });

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      await supabase.from('google_connections').update({ state: 'ERROR', error_message: 'Token exchange failed', oauth_state: null }).eq('id', connection.id);
      return new Response(JSON.stringify({ error: 'Token exchange failed' }), { status: 400 });
    }

    const tokens = await tokenRes.json();
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get Google user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = userInfoRes.ok ? await userInfoRes.json() : {};

    // Store tokens (service role — no RLS restriction)
    await supabase.from('google_connection_tokens').upsert({
      connection_id: connection.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' });

    // Update connection
    await supabase.from('google_connections').update({
      state: 'CONNECTED',
      google_email: googleUser.email ?? null,
      token_expiry: tokenExpiry,
      oauth_state: null,
      connected_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', connection.id);

    // Fetch Google Business accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!accountsRes.ok) {
      const accountsErr = await accountsRes.text();
      console.error('Accounts API failed:', accountsRes.status, accountsErr);
      // Mark connection with attention required so user knows to check API setup
      await supabase.from('google_connections').update({
        error_message: `Business Account API error (${accountsRes.status}): ensure "My Business Account Management API" and "My Business Business Information API" are enabled in Google Cloud Console.`,
      }).eq('id', connection.id);
    } else {
      const accountsData = await accountsRes.json();
      const accounts: Array<{ name: string }> = accountsData.accounts ?? [];
      console.log(`Found ${accounts.length} accounts`);

      for (const account of accounts) {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (!locRes.ok) {
          const locErr = await locRes.text();
          console.error('Locations API failed for', account.name, ':', locRes.status, locErr);
          continue;
        }

        const locData = await locRes.json();
        const locations: Array<{ name: string; title?: string; storefrontAddress?: { addressLines?: string[] } }> = locData.locations ?? [];
        console.log(`Found ${locations.length} locations for ${account.name}`);

        for (const loc of locations) {
          const address = loc.storefrontAddress?.addressLines?.join(', ') ?? null;
          await supabase.from('google_locations').upsert({
            connection_id: connection.id,
            user_id: user.id,
            google_location_name: loc.name,
            display_name: loc.title ?? null,
            address,
          }, { onConflict: 'connection_id,google_location_name' });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('google-oauth-callback error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
