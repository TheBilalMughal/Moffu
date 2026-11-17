import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildPrompt(businessType: string, postType: string, description: string, style: string): string {
  const styleMap: Record<string, string> = {
    professional: 'professional, clean, corporate, high quality photography',
    vibrant: 'vibrant, colorful, eye-catching, modern',
    minimal: 'minimalist, clean, white space, simple',
    warm: 'warm tones, cozy, inviting, lifestyle photography',
  };
  const styleDesc = styleMap[style] || styleMap.professional;

  const businessContext = businessType ? `for a ${businessType} business` : '';
  const postContext = postType === 'EVENT' ? 'announcing an upcoming event' : postType === 'OFFER' ? 'promoting a special offer or discount' : 'as a general business update';
  const descContext = description ? ` The image should convey: ${description}.` : '';

  return `Create a high-quality ${styleDesc} photograph ${businessContext}, suitable ${postContext} on Google Business Profile.${descContext} The image should be visually appealing for a business listing, 16:9 aspect ratio, no text overlays, no logos. Professional business photography style.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: cors });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: cors });

    const { business_type = '', post_type = 'STANDARD', description = '', style = 'professional' } = await req.json();

    // Get active Gemini API key
    const { data: aiSetting } = await supabase.from('ai_settings').select('api_key').eq('provider', 'gemini').eq('is_active', true).maybeSingle();
    const geminiKey = aiSetting?.api_key;
    if (!geminiKey) return new Response(JSON.stringify({ error: 'Gemini API key not configured. Add it in Admin → AI Settings.' }), { status: 503, headers: cors });

    const prompt = buildPrompt(business_type, post_type, description, style);

    // Use Gemini 2.0 Flash image generation
    const model = 'gemini-2.0-flash-preview-image-generation';
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );

    const geminiJson = await geminiRes.json();
    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: geminiJson.error?.message ?? 'Image generation failed' }), { status: 500, headers: cors });
    }

    // Extract image from response
    const parts = geminiJson.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
    if (!imagePart?.inlineData) {
      return new Response(JSON.stringify({ error: 'No image generated. Try a different description.' }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({
      image_base64: imagePart.inlineData.data,
      mime_type: imagePart.inlineData.mimeType ?? 'image/png',
      prompt_used: prompt,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
