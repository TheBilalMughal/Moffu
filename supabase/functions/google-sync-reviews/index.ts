import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Base64(login:password) stored as a single secret
const DATAFORSEO_AUTH = Deno.env.get('DATAFORSEO_AUTH')!;

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

interface DFSReviewItem {
  review_id?: string;
  author_title?: string;
  author_image_url?: string;
  rating?: { value?: number };
  review_text?: string;
  timestamp?: string;
  owner_answer?: string;
  owner_timestamp?: string;
}

interface DFSResult {
  place_id?: string;
  items?: DFSReviewItem[];
}

interface DFSTask {
  result?: DFSResult[];
  status_code?: number;
  status_message?: string;
}

interface DFSResponse {
  tasks?: DFSTask[];
}

async function fetchReviewsFromDataForSEO(
  keyword: string,
  placeId: string | null,
  depth = 100,
): Promise<{ place_id: string | null; items: DFSReviewItem[] }> {
  const body = placeId
    ? [{ place_id: placeId, depth, sort_by: 'newest' }]
    : [{ keyword, location_name: 'Pakistan', language_name: 'English', depth, sort_by: 'newest' }];

  const res = await fetch(
    'https://api.dataforseo.com/v3/business_data/google/reviews/live/advanced',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DATAFORSEO_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    console.error('DataForSEO HTTP error:', res.status, await res.text());
    return { place_id: null, items: [] };
  }

  const data: DFSResponse = await res.json();
  const task = data.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    console.error('DataForSEO task error:', task?.status_code, task?.status_message);
    return { place_id: null, items: [] };
  }

  const result = task.result?.[0];
  return {
    place_id: result?.place_id ?? null,
    items: result?.items ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    // Get active connection
    const { data: connection } = await supabase
      .from('google_connections')
      .select('id, state')
      .eq('user_id', user.id)
      .eq('state', 'CONNECTED')
      .single();

    if (!connection) return json({ error: 'No active Google connection' }, 400);

    // Get selected locations
    const { data: locations } = await supabase
      .from('google_locations')
      .select('id, display_name, address, dataforseo_place_id')
      .eq('connection_id', connection.id)
      .eq('is_selected', true);

    if (!locations?.length) {
      return json({ synced: 0, message: 'No locations selected' });
    }

    let totalSynced = 0;

    for (const location of locations) {
      const keyword = [location.display_name, location.address]
        .filter(Boolean)
        .join(' ');

      const { place_id, items } = await fetchReviewsFromDataForSEO(
        keyword,
        location.dataforseo_place_id ?? null,
      );

      // Store place_id for future syncs (avoids keyword search overhead)
      if (place_id && place_id !== location.dataforseo_place_id) {
        await supabase
          .from('google_locations')
          .update({ dataforseo_place_id: place_id })
          .eq('id', location.id);
      }

      for (const item of items) {
        if (!item.review_id) continue;

        const rating = item.rating?.value ?? null;
        const hasReply = !!item.owner_answer;

        const { error: upsertErr } = await supabase.from('reviews').upsert(
          {
            location_id: location.id,
            user_id: user.id,
            google_review_id: item.review_id,
            reviewer_name: item.author_title ?? null,
            reviewer_photo_url: item.author_image_url ?? null,
            rating,
            body: item.review_text ?? null,
            published_at: item.timestamp ?? null,
            reply_text: item.owner_answer ?? null,
            reply_published_at: item.owner_timestamp ?? null,
            status: hasReply ? 'PUBLISHED' : 'NEW',
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'location_id,google_review_id', ignoreDuplicates: false },
        );

        if (upsertErr) {
          console.error('upsert error for review', item.review_id, upsertErr.message);
          continue;
        }

        totalSynced++;
      }
    }

    await supabase
      .from('google_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return json({ synced: totalSynced });
  } catch (err) {
    console.error('google-sync-reviews error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
