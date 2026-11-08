import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok', 200);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerMember } = await callerClient
      .from('platform_members')
      .select('role')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!callerMember || !['owner', 'super_admin', 'admin'].includes(callerMember.role)) {
      return json({ error: 'Forbidden — admin role required' }, 403);
    }

    const { user_id, password } = await req.json();

    if (!user_id || !password) return json({ error: 'Missing required fields: user_id, password' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ success: true });

  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
