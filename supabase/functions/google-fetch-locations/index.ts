import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    // Get connection + tokens
    const { data: conn, error: connErr } = await supabase
      .from('google_connections')
      .select('id, state')
      .eq('user_id', user.id)
      .single();

    if (connErr || !conn) return new Response(JSON.stringify({ error: 'No connection found' }), { status: 400, headers: corsHeaders });

    const { data: tokenRow, error: tokenErr } = await supabase
      .from('google_connection_tokens')
      .select('access_token')
      .eq('connection_id', conn.id)
      .single();

    if (tokenErr || !tokenRow?.access_token) {
      return new Response(JSON.stringify({ error: 'No access token — please reconnect Google.' }), { status: 400, headers: corsHeaders });
    }

    const accessToken = tokenRow.access_token;

    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      console.error('Accounts API failed:', accountsRes.status, errText);
      return new Response(JSON.stringify({
        error: `Google API error (${accountsRes.status}). Ensure "My Business Account Management API" is enabled in Google Cloud Console.`
      }), { status: 400, headers: corsHeaders });
    }

    const accountsData = await accountsRes.json();
    const accounts: Array<{ name: string }> = accountsData.accounts ?? [];
    let total = 0;

    for (const account of accounts) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!locRes.ok) continue;

      const locData = await locRes.json();
      const locations: Array<{ name: string; title?: string; storefrontAddress?: { addressLines?: string[] } }> = locData.locations ?? [];

      for (const loc of locations) {
        const address = loc.storefrontAddress?.addressLines?.join(', ') ?? null;
        await supabase.from('google_locations').upsert({
          connection_id: conn.id,
          user_id: user.id,
          google_location_name: loc.name,
          display_name: loc.title ?? null,
          address,
        }, { onConflict: 'connection_id,google_location_name' });
        total++;
      }
    }

    // Clear error, mark connected
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
