import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1×1 transparent GIF — returned for open-tracking pixels
const TRANSPARENT_GIF = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
  0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x00,0x00,0x00,0x00,
  0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
  0x44,0x01,0x00,0x3b,
]);

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get('token');
  const event = url.searchParams.get('event') ?? 'open'; // open | click

  if (!token) {
    return new Response(TRANSPARENT_GIF, { headers: { 'Content-Type': 'image/gif' } });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  if (event === 'open') {
    // Increment open_count + update last_opened_at via RPC to avoid race
    await supabase.rpc('increment_feedback_open', { p_token: token });
  } else if (event === 'click') {
    const { data: request } = await supabase
      .from('feedback_requests')
      .select('google_review_url')
      .eq('token', token)
      .maybeSingle();

    let destination: URL;
    try {
      destination = new URL(request?.google_review_url ?? '');
      if (destination.protocol !== 'https:') throw new Error('Unsafe review URL');
    } catch {
      return new Response('Review link unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    await supabase
      .from('feedback_requests')
      .update({ clicked_at: new Date().toISOString() })
      .eq('token', token)
      .is('clicked_at', null); // first click timestamp only

    return new Response(null, {
      status: 302,
      headers: { Location: destination.href, 'Cache-Control': 'no-store' },
    });
  }

  // Open-tracking requests return the pixel; review clicks use a safe HTTPS redirect above.
  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
});
