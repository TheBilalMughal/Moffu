import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: cors });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: cors });

    const { location_id, question_name, text } = await req.json();
    if (!location_id || !question_name || !text?.trim()) {
      return new Response(JSON.stringify({ error: 'location_id, question_name, text required' }), { status: 400, headers: cors });
    }

    const { data: loc } = await supabase.from('google_locations').select('google_location_name, connection_id').eq('id', location_id).eq('user_id', user.id).single();
    if (!loc) return new Response(JSON.stringify({ error: 'Location not found' }), { status: 404, headers: cors });

    const { data: conn } = await supabase.from('google_connections').select('id').eq('id', loc.connection_id).eq('user_id', user.id).single();
    if (!conn) return new Response(JSON.stringify({ error: 'Connection not found' }), { status: 404, headers: cors });

    const { data: tokens } = await supabase.from('google_connection_tokens').select('access_token, refresh_token, expires_at').eq('connection_id', conn.id).single();
    if (!tokens) return new Response(JSON.stringify({ error: 'No tokens' }), { status: 404, headers: cors });

    let accessToken = tokens.access_token;
    if (new Date(tokens.expires_at) <= new Date()) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '', client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '' }),
      });
      const rt = await r.json();
      if (!r.ok) return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401, headers: cors });
      accessToken = rt.access_token;
      await supabase.from('google_connection_tokens').update({ access_token: accessToken, expires_at: new Date(Date.now() + rt.expires_in * 1000).toISOString() }).eq('connection_id', conn.id);
    }

    // PUT to answers/owner endpoint (upsert merchant answer)
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${question_name}/answers/owner`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: json.error?.message ?? 'Failed to reply' }), { status: res.status, headers: cors });

    return new Response(JSON.stringify({ answer: json }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
