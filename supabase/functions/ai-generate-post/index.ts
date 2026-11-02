import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// ── Platform specs ────────────────────────────────────────────────────────────

const PLATFORM_SPECS: Record<string, { captionLimit: number; hashtagCount: number; tone: string }> = {
  instagram: { captionLimit: 150,  hashtagCount: 15, tone: 'visual, punchy, emoji-friendly' },
  facebook:  { captionLimit: 300,  hashtagCount: 5,  tone: 'conversational, community-focused' },
  linkedin:  { captionLimit: 500,  hashtagCount: 5,  tone: 'professional, value-driven' },
};

const POST_TYPE_CONTEXT: Record<string, string> = {
  promotional:      'Promote an offer, deal, or product/service. Create urgency and excitement.',
  fun_gen_z:        'Fun, Gen Z style post. Use current slang (POV, no cap, hits different, lowkey, etc.), relatable humor, casual tone.',
  behind_scenes:    'Behind-the-scenes look at the business. Make it personal and authentic.',
  review_highlight: 'Turn a positive customer review into a social proof post. Quote or paraphrase the review.',
  seasonal:         'Seasonal or trending topic post. Tie the business to current events or holidays.',
  custom:           'Custom post based on the user context provided.',
};

const CATEGORY_IMAGE_HINTS: Record<string, string> = {
  restaurant:   'food photography, close-up of dish, warm lighting, appetizing',
  cafe:         'coffee photography, cozy atmosphere, latte art',
  hotel:        'hospitality, comfortable room, lobby, welcoming ambience',
  retail:       'product photography, clean background, lifestyle shot',
  travel:       'landscape, adventure, destination, golden hour',
  beauty:       'beauty product, skincare, lifestyle, clean aesthetic',
  healthcare:   'clean, professional, caring, trust-building',
  education:    'learning, books, classroom, growth mindset',
  real_estate:  'property exterior, interior design, aspirational',
  automotive:   'car photography, motion, lifestyle, power',
  technology:   'tech product, innovation, modern, minimal',
  other:        'high quality business photo, professional',
};

// ── AI call ───────────────────────────────────────────────────────────────────

async function callAI(
  provider: string, apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
): Promise<string> {
  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 1200 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model, max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'openai' || provider === 'groq') {
    const url = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 1200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

// ── Parse AI response into structured variant ─────────────────────────────────

interface Variant {
  caption: string;
  hashtags: string[];
  image_hint: string;
}

function parseVariants(raw: string, platforms: string[]): Record<string, Variant> {
  const result: Record<string, Variant> = {};

  for (const platform of platforms) {
    const platformUpper = platform.toUpperCase();
    // Look for platform section: === INSTAGRAM === or --- INSTAGRAM ---
    const sectionRe = new RegExp(
      `(?:===?|---?)\\s*${platformUpper}\\s*(?:===?|---?)[\\s\\S]*?CAPTION:\\s*([\\s\\S]*?)\\n\\s*HASHTAGS:\\s*([\\s\\S]*?)\\n\\s*IMAGE HINT:\\s*([\\s\\S]*?)(?=(?:===?|---?)|$)`,
      'i'
    );
    const m = raw.match(sectionRe);
    if (m) {
      result[platform] = {
        caption: m[1].trim(),
        hashtags: m[2].trim().split(/[\s,]+/).filter(h => h.startsWith('#')),
        image_hint: m[3].trim(),
      };
    }
  }

  // Fallback: if only one platform requested and parse failed, try simple parse
  if (Object.keys(result).length === 0 && platforms.length === 1) {
    const captionM = raw.match(/CAPTION:\s*([\s\S]*?)(?:\n\s*HASHTAGS:|$)/i);
    const hashtagsM = raw.match(/HASHTAGS:\s*([\s\S]*?)(?:\n\s*IMAGE HINT:|$)/i);
    const hintM = raw.match(/IMAGE HINT:\s*([\s\S]*?)$/i);
    const platform = platforms[0];
    result[platform] = {
      caption: captionM?.[1]?.trim() ?? raw.slice(0, 200),
      hashtags: (hashtagsM?.[1]?.trim() ?? '').split(/[\s,]+/).filter(h => h.startsWith('#')),
      image_hint: hintM?.[1]?.trim() ?? CATEGORY_IMAGE_HINTS['other'],
    };
  }

  return result;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  let body: {
    platform: string;
    post_type: string;
    user_context?: string;
    location_id?: string;
    variant_count?: number;
    source_review?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { platform, post_type, user_context, location_id, source_review } = body;
  const variantCount = Math.min(body.variant_count ?? 3, 3);

  if (!platform || !post_type) return json({ error: 'platform and post_type are required' }, 400);

  // ── Fetch org + settings ──────────────────────────────────────────────────

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member?.org_id) return json({ error: 'No org found' }, 400);
  const orgId = member.org_id;

  const [settingsRes, brainRes, aiSettingsRes, locationRes] = await Promise.all([
    supabase.from('marketing_settings').select('*').eq('org_id', orgId).maybeSingle(),
    supabase.from('brand_brain').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('ai_settings').select('provider, model, api_key_encrypted').eq('org_id', orgId).maybeSingle(),
    location_id
      ? supabase.from('google_locations').select('name, address, city, country').eq('id', location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const settings = settingsRes.data;
  const brain = brainRes.data;
  const aiCfg = aiSettingsRes.data;

  if (!aiCfg?.api_key_encrypted) return json({ error: 'AI not configured. Set up AI settings first.' }, 400);

  const category = settings?.business_category ?? 'other';
  const postStyles: string[] = settings?.post_styles ?? ['casual'];
  const customInstructions = settings?.custom_instructions ?? '';
  const locationName = locationRes?.data?.name ?? brain?.business_name ?? 'our business';
  const locationCity = locationRes?.data?.city ?? '';
  const businessType = brain?.business_type ?? category;
  const tone = brain?.tone ?? 'casual';
  const useEmoji = brain?.use_emoji ?? false;
  const primaryLanguage = brain?.primary_language ?? 'English';
  const prohibitedPhrases: string[] = brain?.prohibited_phrases ?? [];

  // Determine platforms to generate for
  const platforms = platform === 'all'
    ? ['instagram', 'facebook', 'linkedin']
    : [platform];

  // ── Build system + user prompts ──────────────────────────────────────────

  const systemPrompt = `You are an expert social media content creator for ${businessType} businesses.
You write platform-specific posts that match the brand voice perfectly.
Language: ${primaryLanguage}.
Brand tone: ${tone}. Use emoji: ${useEmoji ? 'yes, sparingly' : 'no'}.
${prohibitedPhrases.length > 0 ? `Never use these phrases: ${prohibitedPhrases.join(', ')}.` : ''}
${customInstructions ? `Special instructions: ${customInstructions}` : ''}
Always respond with ONLY the structured format requested. No extra commentary.`;

  const platformSections = platforms.map(p => {
    const spec = PLATFORM_SPECS[p];
    return `=== ${p.toUpperCase()} ===
CAPTION: [max ${spec.captionLimit} chars, ${spec.tone}]
HASHTAGS: [${spec.hashtagCount} relevant hashtags starting with #]
IMAGE HINT: [specific image description for this post]`;
  }).join('\n\n');

  const postTypeDesc = POST_TYPE_CONTEXT[post_type] ?? POST_TYPE_CONTEXT['custom'];
  const imageHintBase = CATEGORY_IMAGE_HINTS[category] ?? CATEGORY_IMAGE_HINTS['other'];
  const styleNote = postStyles.includes('gen_z') || post_type === 'fun_gen_z'
    ? 'Gen Z style: use current slang (POV, no cap, hits different, lowkey, slay, fr fr, bestie, etc.)'
    : `Style: ${postStyles.join(', ')}`;

  const userPrompt = `Generate ${variantCount} variants of a social media post.

Business: ${locationName}${locationCity ? `, ${locationCity}` : ''}
Category: ${businessType}
${styleNote}
Post type: ${postTypeDesc}
${user_context ? `Context/topic: ${user_context}` : ''}
${source_review ? `Customer review to highlight: "${source_review}"` : ''}
Image style for this category: ${imageHintBase}

For EACH variant (label them VARIANT 1, VARIANT 2, VARIANT 3), generate for ALL these platforms:

${platformSections}

Format EXACTLY like this for each variant:
--- VARIANT 1 ---
=== INSTAGRAM ===
CAPTION: [caption here]
HASHTAGS: #tag1 #tag2 #tag3
IMAGE HINT: [specific image description]

=== FACEBOOK ===
CAPTION: [caption here]
HASHTAGS: #tag1 #tag2
IMAGE HINT: [specific image description]

=== LINKEDIN ===
CAPTION: [caption here]
HASHTAGS: #tag1 #tag2
IMAGE HINT: [specific image description]

--- VARIANT 2 ---
[same structure]`;

  // ── Call AI ───────────────────────────────────────────────────────────────

  let rawOutput: string;
  try {
    rawOutput = await callAI(aiCfg.provider, aiCfg.api_key_encrypted, aiCfg.model, systemPrompt, userPrompt);
  } catch (err) {
    return json({ error: `AI call failed: ${(err as Error).message}` }, 502);
  }

  // ── Parse into variants ───────────────────────────────────────────────────

  const variants: Array<Record<string, Variant>> = [];

  // Split by variant markers
  const variantSections = rawOutput.split(/---\s*VARIANT\s*\d+\s*---/i).filter(s => s.trim());

  for (let i = 0; i < variantCount; i++) {
    const section = variantSections[i] ?? rawOutput;
    const parsed = parseVariants(section, platforms);
    if (Object.keys(parsed).length > 0) {
      variants.push(parsed);
    }
  }

  // Fallback: if parse totally failed, return raw
  if (variants.length === 0) {
    const fallback: Record<string, Variant> = {};
    for (const p of platforms) {
      fallback[p] = {
        caption: rawOutput.slice(0, PLATFORM_SPECS[p]?.captionLimit ?? 200),
        hashtags: [],
        image_hint: imageHintBase,
      };
    }
    variants.push(fallback);
  }

  // ── Save post to DB ───────────────────────────────────────────────────────

  const firstVariant = variants[0];
  const primaryPlatform = platforms[0];
  const primary = firstVariant[primaryPlatform] ?? Object.values(firstVariant)[0];

  const { data: post, error: insertErr } = await supabase
    .from('marketing_posts')
    .insert({
      org_id: orgId,
      location_id: location_id ?? null,
      created_by: user.id,
      platform,
      post_type,
      user_context: user_context ?? null,
      source_review_id: null,
      caption: primary?.caption ?? null,
      hashtags: primary?.hashtags ?? [],
      image_hint: primary?.image_hint ?? null,
      variants: variants,
      selected_variant: 0,
      status: settings?.auto_approve ? 'approved' : 'draft',
    })
    .select('id')
    .single();

  if (insertErr) return json({ error: insertErr.message }, 500);

  return json({
    post_id: post.id,
    variants,
    platforms,
    status: settings?.auto_approve ? 'approved' : 'draft',
  });
});
