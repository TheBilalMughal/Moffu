import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

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

    const { review_id } = await req.json();
    if (!review_id) return json({ error: 'Missing review_id' }, 400);

    // Fetch review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('reviewer_name, rating, body')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single();

    if (reviewError || !review) return json({ error: 'Review not found' }, 404);

    // Fetch brand brain settings
    const { data: brain } = await supabase
      .from('brand_brain')
      .select('business_name, tone, reply_length, use_customer_name, use_emoji, primary_language, negative_rule, prohibited_phrases, example_reply')
      .eq('user_id', user.id)
      .maybeSingle();

    const businessName = brain?.business_name ?? 'our business';
    const tone = brain?.tone ?? 'Professional';
    const lengthGuide =
      brain?.reply_length === 'Short' ? '1-2 sentences' :
      brain?.reply_length === 'Long'  ? '4-5 sentences' :
                                        '2-3 sentences';
    const addressByName = brain?.use_customer_name ?? false;
    const useEmoji = brain?.use_emoji ?? false;
    const language = brain?.primary_language ?? 'English';
    const prohibited = (brain?.prohibited_phrases as string[] ?? []).join(', ');
    const exampleReply = brain?.example_reply ?? '';
    const negativeHandling = brain?.negative_rule ?? 'Normal';

    const firstName = (review.reviewer_name ?? '').split(' ')[0] || 'there';

    const constraints = [
      `Tone: ${tone}`,
      `Length: ${lengthGuide}`,
      `Language: ${language}`,
      addressByName ? `Address reviewer by first name "${firstName}"` : 'Do not use the reviewer\'s name',
      useEmoji ? 'You may include 1-2 relevant emojis' : 'No emojis',
      prohibited ? `Never use these phrases: ${prohibited}` : '',
      review.rating <= 2 ? `Negative review — be empathetic, acknowledge the issue, offer to resolve offline. Strategy: ${negativeHandling}` : '',
    ].filter(Boolean).join('. ');

    const prompt = `Write a Google Business review reply for ${businessName}.

Customer review (${review.rating}/5 stars): "${review.body ?? '(no text)'}"

Requirements: ${constraints}${exampleReply ? `\n\nStyle reference (match this tone): "${exampleReply}"` : ''}

Reply (output the reply text only, nothing else):`;


    // Call Gemini
    const geminiBody = JSON.stringify({
      system_instruction: {
        parts: [{ text: 'You are a customer service specialist. Output ONLY the reply text — no labels, no markdown, no thinking, no extra commentary.' }],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
    });

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest'];
    let draft = '';

    for (const model of models) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: geminiBody }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error(`Gemini ${model} error:`, geminiRes.status, err);
        continue;
      }
      const geminiData = await geminiRes.json();
      draft = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (draft) break;
    }

    if (!draft) return json({ error: 'Empty response from AI' }, 500);

    // Save draft to DB and set status DRAFT_READY
    await supabase
      .from('reviews')
      .update({ reply_draft: draft, status: 'DRAFT_READY' })
      .eq('id', review_id)
      .eq('user_id', user.id);

    return json({ draft });
  } catch (err) {
    console.error('ai-generate-draft error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
