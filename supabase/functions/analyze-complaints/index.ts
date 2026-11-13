import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY    = Deno.env.get('GEMINI_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

interface Review {
  id: string;
  body: string | null;
  rating: number;
  reviewer_name: string;
}

async function geminiAnalyze(reviews: Review[]): Promise<Map<string, { is_complaint: boolean; summary: string }>> {
  const reviewsText = reviews
    .map((r, i) => `Review ${i + 1} [ID:${r.id}] (${r.rating} star by ${r.reviewer_name || 'Anonymous'}):\n${r.body || '(no text)'}`)
    .join('\n\n---\n\n');

  const prompt = `Analyze each of the following customer reviews (all 1-3 stars). For each review, determine:
1. Is it a genuine complaint about a product, service, staff, quality, or experience? (true/false)
2. If it IS a complaint, provide a concise 1-sentence summary of the core complaint (max 20 words). If NOT a complaint (e.g. it is just a low rating with no text, praise with low stars, spam, or unintelligible), leave summary empty.

Return ONLY a JSON array — no markdown, no explanation:
[
  { "id": "review_id", "is_complaint": true, "summary": "Customer complained about slow service and cold food." },
  { "id": "review_id", "is_complaint": false, "summary": "" }
]

Reviews to analyze:
${reviewsText}`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const modelConfigs = [
    { model: 'gemini-2.0-flash', body: { contents, generationConfig: { temperature: 0.1, maxOutputTokens: 1000 } } },
    { model: 'gemini-1.5-flash', body: { contents, generationConfig: { temperature: 0.1, maxOutputTokens: 1000 } } },
  ];

  let rawText = '';
  for (const { model, body } of modelConfigs) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) { console.error(`Gemini ${model} error:`, res.status); continue; }
    const data = await res.json();
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (rawText) break;
  }

  const results = new Map<string, { is_complaint: boolean; summary: string }>();
  if (!rawText) return results;

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return results;
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ id: string; is_complaint: boolean; summary: string }>;
    for (const item of parsed) {
      if (item.id) results.set(item.id, { is_complaint: !!item.is_complaint, summary: item.summary || '' });
    }
  } catch (e) {
    console.error('Parse error:', e, rawText);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    // Get user's org
    const { data: member } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) return json({ error: 'No organization found' }, 403);

    const { data: locations } = await supabase
      .from('google_locations')
      .select('id')
      .eq('org_id', member.org_id)
      .eq('is_selected', true);

    if (!locations || locations.length === 0) return json({ analyzed: 0, complaints: 0 });

    const locationIds = locations.map((l: { id: string }) => l.id);

    // Fetch up to 50 unanalyzed low-rating reviews at a time
    const { data: reviews, error: fetchErr } = await supabase
      .from('reviews')
      .select('id, body, rating, reviewer_name')
      .in('location_id', locationIds)
      .lte('rating', 3)
      .is('complaint_analyzed_at', null)
      .not('body', 'is', null)
      .neq('body', '')
      .order('published_at', { ascending: false })
      .limit(50);

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!reviews || reviews.length === 0) return json({ analyzed: 0, complaints: 0, message: 'Nothing to analyze' });

    // Also analyze reviews with body=null/'' — mark them not_complaint directly
    const { data: noBodyReviews } = await supabase
      .from('reviews')
      .select('id')
      .in('location_id', locationIds)
      .lte('rating', 3)
      .is('complaint_analyzed_at', null)
      .or('body.is.null,body.eq.')
      .limit(100);

    // Mark no-body reviews as non-complaints without calling AI
    if (noBodyReviews && noBodyReviews.length > 0) {
      const now = new Date().toISOString();
      await supabase
        .from('reviews')
        .update({ is_complaint: false, complaint_analyzed_at: now })
        .in('id', noBodyReviews.map((r: { id: string }) => r.id));
    }

    // AI-analyze reviews that have text
    const aiResults = await geminiAnalyze(reviews as Review[]);

    // Batch update results
    const now = new Date().toISOString();
    let complaintsFound = 0;

    for (const review of reviews as Review[]) {
      const result = aiResults.get(review.id);
      const is_complaint = result?.is_complaint ?? false;
      const complaint_summary = result?.summary ?? null;
      if (is_complaint) complaintsFound++;

      await supabase
        .from('reviews')
        .update({
          is_complaint,
          complaint_summary: is_complaint ? complaint_summary : null,
          complaint_analyzed_at: now,
        })
        .eq('id', review.id);
    }

    return json({
      analyzed: reviews.length,
      complaints: complaintsFound,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
