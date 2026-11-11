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

    // Only owner/super_admin can delete members
    if (!callerMember || !['owner', 'super_admin'].includes(callerMember.role)) {
      return json({ error: 'Forbidden — super_admin role required to delete members' }, 403);
    }

    const { member_ids } = await req.json();

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return json({ error: 'member_ids must be a non-empty array' }, 400);
    }

    // Prevent self-deletion
    const { data: callerMemberRow } = await callerClient
      .from('platform_members')
      .select('id')
      .eq('user_id', caller.id)
      .maybeSingle();

    const filteredIds = member_ids.filter((id: string) => id !== callerMemberRow?.id);

    if (filteredIds.length === 0) {
      return json({ error: 'Cannot delete your own account' }, 400);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: delErr } = await adminClient
      .from('platform_members')
      .delete()
      .in('id', filteredIds);

    if (delErr) return json({ error: delErr.message }, 500);

    return json({ success: true, deleted: filteredIds.length });

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
