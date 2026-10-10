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

    const { replies } = await req.json() as { replies: string[] };
    if (!replies || replies.length === 0) return json({ error: 'No replies provided' }, 400);

    const repliesList = replies.map((r, i) => `Reply ${i + 1}: "${r}"`).join('\n\n');

    const prompt = `Analyze these ${replies.length} customer review replies written by a business owner. Extract their communication style and return ONLY a JSON object with these exact fields:

${repliesList}

Return ONLY this JSON (no markdown, no explanation):
{
  "tone": "professional" | "friendly" | "formal" | "casual",
  "reply_length": "short" | "medium" | "long",
  "use_customer_name": true | false,
  "use_emoji": true | false,
  "custom_tone_instructions": "brief style notes in 1-2 sentences describing unique aspects of their writing style",
  "notes": "one sentence summary of the overall voice"
}

Guidelines:
- tone: professional=polished/brand-focused, friendly=warm/conversational, formal=structured/respectful, casual=relaxed/natural
- reply_length: short=1-2 sentences avg, medium=3-4 sentences avg, long=5+ sentences avg
- use_customer_name: true if they address reviewers by name
- use_emoji: true if any emoji appear in the replies
- custom_tone_instructions: capture unique patterns like "always mentions loyalty program", "uses rhetorical questions", etc.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const modelConfigs = [
      { model: 'gemini-2.0-flash', body: { contents, generationConfig: { temperature: 0.3, maxOutputTokens: 300 } } },
      { model: 'gemini-1.5-flash', body: { contents, generationConfig: { temperature: 0.3, maxOutputTokens: 300 } } },
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

    if (!rawText) return json({ error: 'Empty response from AI' }, 500);

    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ error: 'Could not parse AI response' }, 500);

    const suggestions = JSON.parse(jsonMatch[0]);
    return json({ suggestions });
  } catch (err) {
    console.error('ai-analyze-voice error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
