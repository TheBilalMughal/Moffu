import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAndRecordUsage } from '../_shared/billing.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

async function callAI(provider: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  throw new Error(`Unknown provider: ${provider}`);
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

    // Load active AI provider from DB
    const { data: aiSetting } = await supabase
      .from('ai_settings')
      .select('provider, api_key, model')
      .eq('is_active', true)
      .maybeSingle();

    if (!aiSetting) return json({ error: 'No AI provider configured. Please set one in the admin panel.' }, 503);

    // Fetch review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('reviewer_name, rating, body')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single();

    if (reviewError || !review) return json({ error: 'Review not found' }, 404);

    // Check AI draft limit
    const limitCheck = await checkAndRecordUsage(supabase, user.id, 'ai_draft', review_id);
    if (!limitCheck.allowed) {
      const msg = limitCheck.limit === 0
        ? 'No active subscription found. Please contact support.'
        : `AI draft limit reached (${limitCheck.used}/${limitCheck.limit} used this period).`;
      return json({ error: msg, used: limitCheck.used, limit: limitCheck.limit }, 429);
    }

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

    const systemPrompt = 'You are a customer service specialist. Output ONLY the reply text — no labels, no markdown, no extra commentary.';
    const userPrompt = `Write a Google Business review reply for ${businessName}.

Customer review (${review.rating}/5 stars): "${review.body ?? '(no text)'}"

Requirements: ${constraints}${exampleReply ? `\n\nStyle reference (match this tone): "${exampleReply}"` : ''}

Reply (output the reply text only, nothing else):`;

    const draft = await callAI(aiSetting.provider, aiSetting.api_key, aiSetting.model, systemPrompt, userPrompt);

    if (!draft) return json({ error: 'Empty response from AI' }, 500);

    await Promise.all([
      supabase
        .from('reviews')
        .update({ reply_draft: draft, status: 'DRAFT_READY' })
        .eq('id', review_id)
        .eq('user_id', user.id),
      supabase
        .from('usage_events')
        .insert({ user_id: user.id, event_type: 'ai_draft', review_id }),
    ]);

    return json({ draft });
  } catch (err) {
    console.error('ai-generate-draft error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return json({ error: msg }, 500);
  }
});
