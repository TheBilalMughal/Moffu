import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const url = new URL(req.url);

  // ── GET /feedback-gate?token=xxx — fetch request details for public page ──
  if (req.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'Missing token' }, 400);

    const { data: req_row, error } = await supabase
      .from('feedback_requests')
      .select('id, token, status, expires_at, customer_name, google_review_url, org_id, location_id')
      .eq('token', token)
      .maybeSingle();

    if (error || !req_row) return json({ error: 'Not found' }, 404);
    if (req_row.status === 'responded') return json({ error: 'already_responded', name: req_row.customer_name }, 409);
    if (new Date(req_row.expires_at) < new Date()) return json({ error: 'expired' }, 410);

    // Fetch org name for the page
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', req_row.org_id)
      .maybeSingle();

    return json({
      id:               req_row.id,
      token:            req_row.token,
      customer_name:    req_row.customer_name,
      google_review_url: req_row.google_review_url,
      org_name:         org?.name ?? 'this business',
    });
  }

  // ── POST /feedback-gate — submit response ──
  if (req.method === 'POST') {
    let body: { token: string; sentiment: 'happy' | 'unhappy'; feedback_text?: string; rating_choice?: number };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { token, sentiment, feedback_text, rating_choice } = body;
    if (!token || !sentiment) return json({ error: 'Missing fields' }, 400);
    if (!['happy', 'unhappy'].includes(sentiment)) return json({ error: 'Invalid sentiment' }, 400);

    // Load request row
    const { data: req_row, error: fetchErr } = await supabase
      .from('feedback_requests')
      .select('id, status, expires_at, org_id, location_id, google_review_url')
      .eq('token', token)
      .maybeSingle();

    if (fetchErr || !req_row) return json({ error: 'Not found' }, 404);
    if (req_row.status === 'responded') return json({ error: 'already_responded' }, 409);
    if (new Date(req_row.expires_at) < new Date()) return json({ error: 'expired' }, 410);

    // Insert response
    const { error: insertErr } = await supabase.from('feedback_responses').insert({
      request_id:    req_row.id,
      org_id:        req_row.org_id,
      location_id:   req_row.location_id,
      sentiment,
      rating_choice: rating_choice ?? null,
      feedback_text: sentiment === 'unhappy' ? (feedback_text ?? null) : null,
    });

    if (insertErr) return json({ error: 'Failed to save response' }, 500);

    // Mark request as responded
    await supabase
      .from('feedback_requests')
      .update({ status: 'responded' })
      .eq('id', req_row.id);

    return json({
      ok:               true,
      sentiment,
      google_review_url: sentiment === 'happy' ? req_row.google_review_url : null,
    });
  }

  return json({ error: 'Method not allowed' }, 405);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
