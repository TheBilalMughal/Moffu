import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify JWT and get user
  const { data: { user }, error: userErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Parse body
  let path = '/';
  try {
    const body = await req.json();
    path = typeof body?.path === 'string' ? body.path.slice(0, 500) : '/';
  } catch {
    // keep default
  }

  // Extract real IP — Vercel/Supabase sets x-forwarded-for
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = (req.headers.get('user-agent') || '').slice(0, 300);

  const { error } = await supabase.from('page_views').insert({
    user_id:    user.id,
    ip,
    path,
    user_agent: userAgent || null,
  });

  if (error) {
    console.error('page_views insert error:', error);
    return json({ error: 'Failed to log' }, 500);
  }

  return json({ ok: true });
});
