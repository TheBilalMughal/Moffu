import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
function err(msg: string, status = 401) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err('Unauthorized');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return err('Unauthorized');

    const body = await req.json() as { location_id?: string; radius_km?: number };
    const radiusKm = body.radius_km ?? 5;

    // Get the user's location
    const locQ = supabase
      .from('google_locations')
      .select('id, display_name, latitude, longitude, description, address')
      .eq('user_id', user.id);
    if (body.location_id) locQ.eq('id', body.location_id);
    else locQ.eq('is_selected', true);

    const { data: loc } = await locQ.maybeSingle();
    if (!loc) return ok({ competitors: [], warning: 'location_not_found' });

    // No coordinates — return empty gracefully (coordinates populated on sync)
    if (!loc.latitude || !loc.longitude) {
      return ok({ competitors: [], warning: 'no_coordinates' });
    }

    // Get Google Maps API key
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['google_maps_api_key']);
    const settingsMap: Record<string, string> = {};
    (settings ?? []).forEach((r: { key: string; value: string }) => { settingsMap[r.key] = r.value; });

    const mapsKey = settingsMap['google_maps_api_key'] || Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
    if (!mapsKey) {
      return ok({ competitors: [], warning: 'no_maps_key' });
    }

    const params = new URLSearchParams({
      location: `${loc.latitude},${loc.longitude}`,
      radius:   String(radiusKm * 1000),
      key:      mapsKey,
    });
    // Add keyword only if available (improves relevance)
    const keyword = (loc.description ?? '').trim();
    if (keyword) params.set('keyword', keyword);

    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
    );

    if (!placesRes.ok) {
      console.error('Places API HTTP error:', placesRes.status);
      return ok({ competitors: [], warning: 'places_api_unavailable' });
    }

    const placesData = await placesRes.json();
    if (placesData.status === 'ZERO_RESULTS') {
      return ok({ competitors: [], warning: 'zero_results' });
    }
    if (placesData.status !== 'OK') {
      console.error('Places API status:', placesData.status, placesData.error_message);
      return ok({ competitors: [], warning: `places_${placesData.status}` });
    }

    type PlaceResult = {
      name: string;
      place_id: string;
      rating?: number;
      user_ratings_total?: number;
      vicinity?: string;
      geometry: { location: { lat: number; lng: number } };
    };

    const results: PlaceResult[] = placesData.results ?? [];
    const competitors = results.map((p, i) => {
      const distKm = haversineKm(loc.latitude!, loc.longitude!, p.geometry.location.lat, p.geometry.location.lng);
      const isYou = p.name.toLowerCase().trim() === (loc.display_name ?? '').toLowerCase().trim();
      return {
        position:     i + 1,
        name:         p.name,
        place_id:     p.place_id,
        rating:       p.rating ?? null,
        review_count: p.user_ratings_total ?? 0,
        address:      p.vicinity ?? null,
        distance_km:  Math.round(distKm * 10) / 10,
        is_you:       isYou,
      };
    });

    return ok({ competitors, your_location: { name: loc.display_name, lat: loc.latitude, lng: loc.longitude } });

  } catch (e) {
    console.error('google-competitors error:', e);
    return ok({ competitors: [], warning: 'internal_error' });
  }
});
