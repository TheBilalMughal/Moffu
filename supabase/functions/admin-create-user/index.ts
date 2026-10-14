import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['super_admin', 'admin', 'finance', 'support', 'operations', 'viewer'];

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

    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerMember } = await callerClient
      .from('platform_members')
      .select('role')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!callerMember || !['super_admin', 'admin'].includes(callerMember.role)) {
      return json({ error: 'Forbidden — super_admin or admin role required' }, 403);
    }

    const { email, role, name, phone, password } = await req.json();

    if (!email || !role || !name) return json({ error: 'Missing required fields: email, role, name' }, 400);
    if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
    if (!VALID_ROLES.includes(role)) return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);

    // Non-super_admin cannot create super_admins
    if (role === 'super_admin' && callerMember.role !== 'super_admin') {
      return json({ error: 'Only super_admin can create other super_admins' }, 403);
    }

    // Service-role client for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check if user already exists
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    let userId: string;

    if (existing) {
      // Update password and confirm email for existing user
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (updateErr) return json({ error: updateErr.message }, 500);
      userId = existing.id;
    } else {
      // Create user directly with password — no email invite
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { display_name: name.trim(), full_name: name.trim() },
      });

      if (createErr || !newUser.user) {
        return json({ error: createErr?.message ?? 'Failed to create user' }, 500);
      }

      userId = newUser.user.id;
    }

    // Ensure profile exists and is active (email_confirm:true on INSERT skips the UPDATE trigger
    // that normally sets status='active', so we must do it explicitly)
    await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        display_name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    // Add to platform_members (upsert in case already exists)
    const { error: memberErr } = await adminClient
      .from('platform_members')
      .upsert({ user_id: userId, role, is_active: true }, { onConflict: 'user_id' });

    if (memberErr) return json({ error: memberErr.message }, 500);

    return json({ success: true, user_id: userId, existing_account: !!existing });

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
