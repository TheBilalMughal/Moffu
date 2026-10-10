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

    const body = await req.json();
    const { settings, test_review } = body as {
      settings: {
        business_name?: string; tone?: string; reply_length?: string;
        use_customer_name?: boolean; use_emoji?: boolean;
        primary_language?: string; negative_rule?: string;
        prohibited_phrases?: string[]; example_reply?: string;
        custom_tone_instructions?: string; reply_signature?: string;
        star_rating_rules?: Record<string, { tone?: string; reply_length?: string }>;
      };
      test_review?: { reviewer_name: string; rating: number; body: string };
    };

    const review = test_review ?? {
      reviewer_name: 'Sarah Johnson',
      rating: 5,
      body: 'Absolutely loved my experience here! The staff were incredibly friendly and attentive. The food was delicious and the ambiance was perfect. Will definitely be coming back!',
    };

    const businessName = settings.business_name ?? 'our business';
    const tone = settings.tone ?? 'professional';
    const lengthGuide =
      settings.reply_length === 'short' ? '1-2 sentences' :
      settings.reply_length === 'long'  ? '5+ sentences' : '2-3 sentences';
    const addressByName = settings.use_customer_name ?? true;
    const useEmoji = settings.use_emoji ?? false;
    const language = settings.primary_language ?? 'English';
    const prohibited = (settings.prohibited_phrases ?? []).join(', ');
    const exampleReply = settings.example_reply ?? '';
    const customInstructions = settings.custom_tone_instructions ?? '';
    const signature = settings.reply_signature ?? '';

    // Check per-star overrides
    const ratingKey = review.rating >= 5 ? 'five_star' : review.rating >= 3 ? 'mid_star' : 'low_star';
    const starOverride = settings.star_rating_rules?.[ratingKey];
    const effectiveTone = starOverride?.tone ?? tone;
    const effectiveLength = starOverride?.reply_length === 'short' ? '1-2 sentences'
      : starOverride?.reply_length === 'long' ? '5+ sentences'
      : starOverride?.reply_length === 'medium' ? '2-3 sentences'
      : lengthGuide;

    const firstName = review.reviewer_name.split(' ')[0] || 'there';
    const constraints = [
      `Tone: ${effectiveTone}`,
      `Length: ${effectiveLength}`,
      `Language: ${language}`,
      addressByName ? `Address reviewer by first name "${firstName}"` : 'Do not use the reviewer\'s name',
      useEmoji ? 'You may include 1-2 relevant emojis' : 'No emojis',
      prohibited ? `Never use these phrases: ${prohibited}` : '',
      customInstructions ? `Additional style notes: ${customInstructions}` : '',
      signature ? `End every reply with this signature: "${signature}"` : '',
    ].filter(Boolean).join('. ');

    const prompt = `Write a Google Business review reply for ${businessName}.

Customer review (${review.rating}/5 stars): "${review.body}"
Reviewer: ${review.reviewer_name}

Requirements: ${constraints}${exampleReply ? `\n\nStyle reference (match this tone): "${exampleReply}"` : ''}

Reply (output the reply text only, nothing else):`;

    const sysInstruction = { parts: [{ text: 'You are a customer service specialist. Output ONLY the reply text — no labels, no markdown, no extra commentary.' }] };
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];

    const modelConfigs = [
      { model: 'gemini-2.0-flash', body: { system_instruction: sysInstruction, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 400 } } },
      { model: 'gemini-1.5-flash', body: { system_instruction: sysInstruction, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 400 } } },
    ];

    let draft = '';
    for (const { model, body: geminiBody } of modelConfigs) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
      );
      if (!res.ok) { console.error(`Gemini ${model} error:`, res.status); continue; }
      const data = await res.json();
      draft = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (draft) break;
    }

    if (!draft) return json({ error: 'Empty response from AI' }, 500);
    return json({ draft, test_review: review });
  } catch (err) {
    console.error('ai-preview-voice error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
