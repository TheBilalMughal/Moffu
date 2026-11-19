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

    const { data: loc, error: locationError } = await locQ.maybeSingle();
    if (locationError) {
      console.error('google-competitors location lookup failed:', locationError.code);
      return ok({ competitors: [], warning: 'location_lookup_failed' });
    }
    if (!loc) return ok({ competitors: [], warning: 'location_not_found' });

    if (!loc.latitude || !loc.longitude) {
      return ok({ competitors: [], warning: 'no_coordinates' });
    }

    // Category is required for a meaningful text search
    const searchTerm = (loc.description || '').trim();
    if (!searchTerm) {
      return ok({ competitors: [], warning: 'no_category' });
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

    // Use Places API v1 Text Search — same endpoint as google-profile-analysis
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: searchTerm,
        languageCode: 'en',
        pageSize: 20,
        locationBias: {
          circle: {
            center: { latitude: loc.latitude, longitude: loc.longitude },
            radius: radiusKm * 1000,
          },
        },
      }),
    });

    if (!placesRes.ok) {
      const errBody = await placesRes.text();
      console.error('Places API HTTP error:', placesRes.status, errBody);
      return ok({ competitors: [], warning: 'places_api_unavailable' });
    }

    const placesData = await placesRes.json();

    // v1 returns { places: [...] } or { error: {...} }
    if (placesData.error) {
      console.error('Places API error:', placesData.error.status, placesData.error.message);
      return ok({ competitors: [], warning: `places_${placesData.error.status ?? 'error'}` });
    }

    const places = placesData.places ?? [];
    if (places.length === 0) {
      return ok({ competitors: [], warning: 'zero_results' });
    }

    type PlaceV1 = {
      id: string;
      displayName?: { text: string };
      rating?: number;
      userRatingCount?: number;
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    };

    const competitors = (places as PlaceV1[]).map((p, i) => {
      const lat = p.location?.latitude ?? loc.latitude!;
      const lng = p.location?.longitude ?? loc.longitude!;
      const distKm = haversineKm(loc.latitude!, loc.longitude!, lat, lng);
      const name = p.displayName?.text ?? '';
      const isYou = name.toLowerCase().trim() === (loc.display_name ?? '').toLowerCase().trim();
      return {
        position:     i + 1,
        name,
        place_id:     p.id ?? '',
        rating:       p.rating ?? null,
        review_count: p.userRatingCount ?? 0,
        address:      p.formattedAddress ?? null,
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
