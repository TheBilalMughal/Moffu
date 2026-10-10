import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { data: connection } = await supabase
      .from('google_connections')
      .select('id, google_connection_tokens(access_token)')
      .eq('user_id', user.id)
      .single();

    if (connection) {
      // Try to revoke token with Google (best-effort)
      const tokens = connection.google_connection_tokens as Array<{ access_token: string }>;
      const accessToken = tokens?.[0]?.access_token;
      if (accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
        }).catch(() => { /* best-effort */ });
      }

      // Delete tokens
      await supabase.from('google_connection_tokens').delete().eq('connection_id', connection.id);

      // Mark as DISCONNECTED
      await supabase.from('google_connections').update({
        state: 'DISCONNECTED',
        google_email: null,
        token_expiry: null,
        connected_at: null,
        last_synced_at: null,
        error_message: null,
      }).eq('id', connection.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('google-disconnect error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
