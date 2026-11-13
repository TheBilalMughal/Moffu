import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

interface GeminiResult { text: string; inputTokens: number; outputTokens: number; totalTokens: number; }

async function callGemini(apiKey: string, model: string, prompt: string): Promise<GeminiResult> {
  const modelId = model?.startsWith('gemini') ? model : 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const inputTokens  = data.usageMetadata?.promptTokenCount     ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    inputTokens, outputTokens,
    totalTokens: data.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Auth: JWT or service-role cron call ───────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let orgId: string | null = null;
  let locationIds: string[] = [];

  const isCron = authHeader.startsWith('Bearer ') &&
    authHeader.replace('Bearer ', '') === SUPABASE_SERVICE_KEY;

  if (isCron) {
    // Cron mode: process all enabled locations across all orgs
    const { data: locs } = await supabaseService
      .from('google_locations')
      .select('id, org_id:google_connections(org_id)')
      .eq('is_selected', true);

    if (!locs?.length) return json({ processed: 0 });

    let total = 0;
    for (const loc of locs) {
      const locOrgId = (loc.org_id as unknown as { org_id: string } | null)?.org_id;
      if (!locOrgId) continue;
      const count = await processLocation(supabaseService, loc.id, locOrgId);
      total += count;
    }
    return json({ processed: total });
  }

  // Manual call: JWT required
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Parse body
  let body: { location_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body fine */ }

  // Resolve org
  const { data: member } = await supabaseService
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member?.org_id) return json({ error: 'No org found' }, 400);
  orgId = member.org_id;

  if (body.location_id) {
    locationIds = [body.location_id];
  } else {
    // All selected locations for this org's connections
    const { data: locs } = await supabaseService
      .from('google_locations')
      .select('id, google_connections!inner(org_id)')
      .eq('google_connections.org_id', orgId)
      .eq('is_selected', true);
    locationIds = (locs ?? []).map((l: { id: string }) => l.id);
  }

  if (!locationIds.length) return json({ error: 'No enabled locations found' }, 400);

  let total = 0;
  for (const locId of locationIds) {
    const count = await processLocation(supabaseService, locId, orgId!);
    total += count;
  }

  return json({ extracted: total, location_count: locationIds.length });
});

async function processLocation(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  orgId: string,
): Promise<number> {
  // Get AI settings
  const { data: aiCfg } = await supabase
    .from('ai_settings')
    .select('provider, api_key, model')
    .eq('is_active', true)
    .maybeSingle();

  if (!aiCfg?.api_key) return 0;

  // Fetch recent 4-5 star reviews for this location (last 100)
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, body, rating, reviewer_name')
    .eq('location_id', locationId)
    .gte('rating', 4)
    .not('body', 'is', null)
    .order('published_at', { ascending: false })
    .limit(100);

  if (!reviews?.length) return 0;

  // Build review text for Gemini
  const reviewTexts = reviews
    .filter((r: { body: string | null }) => r.body && r.body.trim().length > 10)
    .slice(0, 50)
    .map((r: { body: string; rating: number }, i: number) => `Review ${i + 1} (${r.rating} stars): ${r.body}`)
    .join('\n\n');

  if (!reviewTexts) return 0;

  const prompt = `You are analyzing positive customer reviews for a business. Extract the most compelling, specific highlights that could be turned into social media posts.

Reviews:
${reviewTexts}

Extract exactly 5 highlight phrases from these reviews. Each highlight should be:
- A specific, compelling phrase or theme that appears across multiple reviews (or stands out strongly)
- 5-15 words max, conversational, could work as a social media hook
- Based on what customers actually said — not generic praise

Also extract 3-5 keywords per highlight.

Respond with ONLY valid JSON in this exact format, no other text:
{
  "highlights": [
    {
      "text": "highlight phrase here",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}`;

  let parsed: { highlights: Array<{ text: string; keywords: string[] }> };
  try {
    const result = await callGemini(aiCfg.api_key, aiCfg.model ?? 'gemini-1.5-flash', prompt);
    supabase.from('ai_token_usage').insert({
      org_id: orgId,
      provider: 'gemini', model: aiCfg.model ?? 'gemini-1.5-flash',
      function_name: 'extract-review-highlights',
      input_tokens: result.inputTokens, output_tokens: result.outputTokens, total_tokens: result.totalTokens,
    }).then(() => {}).catch(() => {});
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 0;
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return 0;
  }

  if (!Array.isArray(parsed?.highlights)) return 0;

  const reviewIds = reviews.map((r: { id: string }) => r.id);
  let inserted = 0;

  for (const h of parsed.highlights.slice(0, 10)) {
    if (!h.text?.trim()) continue;
    const { error } = await supabase.from('review_highlights').upsert(
      {
        org_id: orgId,
        location_id: locationId,
        highlight_text: h.text.trim(),
        keywords: h.keywords ?? [],
        source_review_ids: reviewIds,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,location_id,highlight_text', ignoreDuplicates: false },
    );
    if (!error) inserted++;
  }

  return inserted;
}
