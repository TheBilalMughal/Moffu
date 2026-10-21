import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

interface MapsItem {
  type?: string;
  place_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  rating?: { value?: number; votes_count?: number };
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

    const { keyword } = await req.json();
    if (!keyword?.trim()) return json({ error: 'keyword is required' }, 400);

    const res = await fetch(
      'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DATAFORSEO_AUTH}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keyword: keyword.trim(),
          location_name: 'Pakistan',
          language_name: 'English',
          depth: 10,
        }]),
      },
    );

    if (!res.ok) {
      console.error('DataForSEO error:', res.status, await res.text());
      return json({ error: 'Search failed. Please try again.' }, 502);
    }

    const data = await res.json();
    const task = data.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      return json({ error: task?.status_message ?? 'Search failed.' }, 502);
    }

    const items: MapsItem[] = (task.result?.[0]?.items ?? [])
      .filter((i: MapsItem) => i.type === 'maps_search_result' && i.place_id && i.title);

    const businesses = items.slice(0, 8).map((i: MapsItem) => ({
      place_id: i.place_id,
      name: i.title,
      address: i.address ?? null,
      phone: i.phone ?? null,
      rating: i.rating?.value ?? null,
      reviews_count: i.rating?.votes_count ?? null,
    }));

    return json({ businesses });
  } catch (err) {
    console.error('google-search-business error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
