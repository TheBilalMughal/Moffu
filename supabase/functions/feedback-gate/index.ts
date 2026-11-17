import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

    if (error) {
      console.error('Failed to load feedback request:', error.message);
      return json({ error: 'Could not load this feedback link' }, 500);
    }
    if (!req_row) return json({ error: 'Not found' }, 404);
    if (req_row.status === 'responded') return json({ error: 'already_responded', name: req_row.customer_name }, 409);
    if (req_row.status === 'expired' || new Date(req_row.expires_at) <= new Date()) return json({ error: 'expired' }, 410);

    // Fetch org name for the page
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', req_row.org_id)
      .maybeSingle();

    return json({
      customer_name:    req_row.customer_name,
      google_review_url: req_row.google_review_url,
      org_name:         org?.name ?? 'this business',
    });
  }

  // ── POST /feedback-gate — submit response ──
  if (req.method === 'POST') {
    let body: { token?: unknown; sentiment?: unknown; feedback_text?: unknown; rating_choice?: unknown };
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { token, sentiment, feedback_text, rating_choice } = body;
    if (typeof token !== 'string' || token.trim().length < 16 || token.length > 128) {
      return json({ error: 'Invalid feedback token' }, 400);
    }
    if (sentiment !== 'happy' && sentiment !== 'unhappy') return json({ error: 'Invalid sentiment' }, 400);
    if (feedback_text !== undefined && typeof feedback_text !== 'string') return json({ error: 'Invalid feedback text' }, 400);
    if (typeof feedback_text === 'string' && feedback_text.length > 5000) return json({ error: 'Feedback is too long' }, 400);
    if (rating_choice !== undefined && rating_choice !== null && (!Number.isInteger(rating_choice) || Number(rating_choice) < 1 || Number(rating_choice) > 5)) {
      return json({ error: 'Invalid rating' }, 400);
    }

    const { data, error } = await supabase.rpc('submit_feedback_response', {
      p_token: token,
      p_sentiment: sentiment,
      p_feedback_text: typeof feedback_text === 'string' ? feedback_text.trim() : null,
      p_rating_choice: typeof rating_choice === 'number' ? rating_choice : null,
    });

    if (error) {
      console.error('Failed to save public feedback response:', error.message);
      return json({ error: 'Failed to save response' }, 500);
    }

    switch (data?.status) {
      case 'ok':
        return json({ ok: true, sentiment: data.sentiment, google_review_url: data.google_review_url });
      case 'already_responded':
        return json({ error: 'already_responded' }, 409);
      case 'expired':
        return json({ error: 'expired' }, 410);
      case 'not_found':
        return json({ error: 'Not found' }, 404);
      default:
        return json({ error: 'Invalid feedback response' }, 400);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
