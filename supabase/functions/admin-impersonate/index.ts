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

    // Verify caller is an active platform member with admin rights
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerMember } = await callerClient
      .from('platform_members')
      .select('role')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!callerMember || !['owner', 'super_admin', 'admin', 'support'].includes(callerMember.role)) {
      return json({ error: 'Forbidden — admin, super_admin, or support role required' }, 403);
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) return json({ error: 'Missing target_user_id' }, 400);

    // Service-role client for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch target user
    const { data: { user: targetUser }, error: targetErr } = await adminClient.auth.admin.getUserById(target_user_id);
    if (targetErr || !targetUser?.email) return json({ error: 'User not found' }, 404);

    // Generate a magic link for the target user (one-time, expires in 24h)
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
    });
    if (linkErr || !linkData) return json({ error: linkErr?.message ?? 'Failed to generate link' }, 500);

    // Audit log — impersonation is always logged
    await adminClient
      .from('audit_events')
      .insert({
        actor_id: caller.id,
        action: 'admin_impersonate_user',
        target_type: 'user',
        target_id: target_user_id,
        metadata: {
          target_email: targetUser.email,
          admin_email: caller.email,
          admin_role: callerMember.role,
        },
      });

    return json({ action_link: linkData.properties.action_link });

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
