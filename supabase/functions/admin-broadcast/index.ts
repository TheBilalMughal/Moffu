import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const env = {
      supabaseUrl:        Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey:    Deno.env.get('SUPABASE_ANON_KEY')!,
      supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    };

    const callerClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const adminClient = createClient(env.supabaseUrl, env.supabaseServiceKey);

    // Auth check — must be platform_member with broadcast permission
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const { data: pm } = await adminClient
      .from('platform_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const allowed = ['super_admin', 'admin', 'support', 'operations'];
    if (!pm || !allowed.includes(pm.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { broadcast_id } = await req.json() as { broadcast_id: string };
    if (!broadcast_id) {
      return new Response(JSON.stringify({ error: 'broadcast_id required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Load broadcast
    const { data: bc, error: bcErr } = await adminClient
      .from('broadcasts')
      .select('*')
      .eq('id', broadcast_id)
      .single();

    if (bcErr || !bc) return new Response(JSON.stringify({ error: 'Broadcast not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    if (bc.status === 'sent') return new Response(JSON.stringify({ error: 'Already sent' }), { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } });

    // Mark as sending
    await adminClient.from('broadcasts').update({ status: 'sending' }).eq('id', broadcast_id);

    // Resolve target user IDs
    let targetUserIds: string[] = [];

    if (bc.target_type === 'all') {
      const { data: auths } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      // Exclude platform members
      const { data: pms } = await adminClient.from('platform_members').select('user_id');
      const pmIds = new Set((pms ?? []).map((p: any) => p.user_id));
      targetUserIds = (auths?.users ?? []).filter(u => !pmIds.has(u.id)).map(u => u.id);

    } else if (bc.target_type === 'plan') {
      // Users on given plan slug
      const { data: subs } = await adminClient
        .from('subscriptions')
        .select('user_id, plans(slug)')
        .eq('status', 'active');
      targetUserIds = (subs ?? [])
        .filter((s: any) => s.plans?.slug === bc.target_value)
        .map((s: any) => s.user_id);

    } else if (bc.target_type === 'org') {
      const { data: members } = await adminClient
        .from('org_members')
        .select('user_id')
        .eq('org_id', bc.target_value);
      targetUserIds = (members ?? []).map((m: any) => m.user_id);

    } else if (bc.target_type === 'user') {
      if (bc.target_value) targetUserIds = [bc.target_value];
    }

    if (targetUserIds.length === 0) {
      await adminClient.from('broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: 0 }).eq('id', broadcast_id);
      return new Response(JSON.stringify({ sent_count: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Bulk insert notifications in chunks of 500
    const CHUNK = 500;
    let totalSent = 0;
    for (let i = 0; i < targetUserIds.length; i += CHUNK) {
      const chunk = targetUserIds.slice(i, i + CHUNK);
      const rows = chunk.map(uid => ({
        user_id:      uid,
        broadcast_id: broadcast_id,
        title:        bc.title,
        body:         bc.body,
        type:         bc.type,
        is_read:      false,
      }));
      const { error: insertErr } = await adminClient.from('user_notifications').insert(rows);
      if (insertErr) {
        await adminClient.from('broadcasts').update({ status: 'failed' }).eq('id', broadcast_id);
        return new Response(JSON.stringify({ error: 'Insert failed', detail: insertErr.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      totalSent += chunk.length;
    }

    // Mark sent
    await adminClient.from('broadcasts').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: totalSent,
    }).eq('id', broadcast_id);

    // Audit
    await adminClient.from('audit_events').insert({
      actor_id:    user.id,
      action:      'admin_broadcast_sent',
      target_type: 'broadcast',
      target_id:   broadcast_id,
      meta:        { target_type: bc.target_type, sent_count: totalSent },
    });

    return new Response(JSON.stringify({ sent_count: totalSent }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
