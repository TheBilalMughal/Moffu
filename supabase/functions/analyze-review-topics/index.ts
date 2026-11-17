import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY     = Deno.env.get('GEMINI_API_KEY')!;

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

// Canonical topic slugs the AI must use
const TOPIC_SLUGS = [
  'staff_service',
  'food_quality',
  'wait_time',
  'value_pricing',
  'cleanliness',
  'ambiance',
  'delivery_shipping',
  'location_parking',
  'communication',
];

interface Review { id: string; body: string; rating: number; }

interface TopicTag { topic: string; sentiment: 'positive' | 'negative' | 'neutral'; }
type AnalysisMap = Map<string, TopicTag[]>;

async function callGemini(prompt: string): Promise<string> {
  for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      },
    );
    if (!res.ok) continue;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (text) return text;
  }
  return '';
}

async function analyzeTopics(reviews: Review[]): Promise<AnalysisMap> {
  const reviewsText = reviews
    .map((r, i) => `Review ${i + 1} [ID:${r.id}] (${r.rating} stars): ${r.body}`)
    .join('\n\n---\n\n');

  const prompt = `Analyze each customer review and tag it with relevant topics. Only use topics from this list:
${TOPIC_SLUGS.join(', ')}

For each review, identify ALL relevant topics and the sentiment for that topic (positive / negative / neutral).
A review can have 1–4 topics. Skip reviews with no body or less than 5 characters.

Return ONLY a JSON array, no markdown:
[
  { "id": "review_id", "topics": [{ "topic": "staff_service", "sentiment": "positive" }] },
  { "id": "review_id", "topics": [] }
]

Reviews:
${reviewsText}`;

  const rawText = await callGemini(prompt);
  const result: AnalysisMap = new Map();
  if (!rawText) return result;

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return result;
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ id: string; topics: TopicTag[] }>;
    for (const item of parsed) {
      if (item.id && Array.isArray(item.topics)) {
        // Sanitize — only allow valid slugs and sentiments
        const valid = item.topics.filter(
          t => TOPIC_SLUGS.includes(t.topic) && ['positive','negative','neutral'].includes(t.sentiment),
        );
        result.set(item.id, valid);
      }
    }
  } catch (e) {
    console.error('Topic parse error:', e);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: member } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member?.org_id) return json({ error: 'No organization found' }, 403);

    let body: { location_id?: string } = {};
    try { body = await req.json(); } catch { /* empty fine */ }

    // Resolve location IDs to process
    let locationIds: string[];
    if (body.location_id) {
      locationIds = [body.location_id];
    } else {
      const { data: locs } = await supabase
        .from('google_locations')
        .select('id')
        .eq('org_id', member.org_id)
        .eq('is_selected', true);
      locationIds = (locs ?? []).map((l: { id: string }) => l.id);
    }

    if (!locationIds.length) return json({ analyzed: 0, tagged: 0 });

    // Fetch unanalyzed reviews with text (batch of 60)
    const { data: reviews, error: fetchErr } = await supabase
      .from('reviews')
      .select('id, body, rating, location_id')
      .in('location_id', locationIds)
      .is('topics_analyzed_at', null)
      .not('body', 'is', null)
      .neq('body', '')
      .order('published_at', { ascending: false })
      .limit(60);

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!reviews?.length) return json({ analyzed: 0, tagged: 0, message: 'Nothing to analyze' });

    // Also mark no-body reviews as done without calling AI
    const { data: noBody } = await supabase
      .from('reviews')
      .select('id')
      .in('location_id', locationIds)
      .is('topics_analyzed_at', null)
      .or('body.is.null,body.eq.')
      .limit(200);

    const now = new Date().toISOString();
    if (noBody?.length) {
      await supabase
        .from('reviews')
        .update({ topics_analyzed_at: now })
        .in('id', noBody.map((r: { id: string }) => r.id));
    }

    // Build a location_id lookup map
    const locationMap = new Map<string, string>();
    for (const r of reviews as Array<{ id: string; body: string; rating: number; location_id: string }>) {
      locationMap.set(r.id, r.location_id);
    }

    const topicsMap = await analyzeTopics(
      reviews as Review[],
    );

    let taggedCount = 0;
    for (const review of reviews as Array<{ id: string; body: string; rating: number; location_id: string }>) {
      const tags = topicsMap.get(review.id) ?? [];

      // Upsert topic rows
      if (tags.length) {
        const rows = tags.map(t => ({
          review_id:   review.id,
          org_id:      member.org_id,
          location_id: review.location_id,
          topic:       t.topic,
          sentiment:   t.sentiment,
          analyzed_at: now,
        }));
        const { error: upsertErr } = await supabase
          .from('review_topics')
          .upsert(rows, { onConflict: 'review_id,topic', ignoreDuplicates: false });
        if (!upsertErr) taggedCount += tags.length;
      }

      // Mark review as analyzed
      await supabase
        .from('reviews')
        .update({ topics_analyzed_at: now })
        .eq('id', review.id);
    }

    return json({ analyzed: reviews.length, tagged: taggedCount });
  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
