export interface Profile {
  id: string; name: string | null; address: string | null; category: string | null;
  additional_categories: string[]; description: string | null; phone: string | null;
  website: string | null; has_hours: boolean | null; has_service_area: boolean | null;
  latitude: number | null; longitude: number | null; place_id: string | null;
  maps_url: string | null; source: 'google_business_profile' | 'saved_location';
}
export interface ReviewSummary {
  total: number; replied: number; rating: number | null; latest_at: string | null;
}
export interface Check {
  id: string; label: string; weight: number; status: 'pass' | 'action' | 'unknown';
  detail: string; recommendation: string;
}
export function coordinatesValid(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
}
export function distanceKm(a: number, b: number, c: number, d: number): number {
  const rad = Math.PI / 180;
  const h = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function normalizeProfile(raw: any, saved: any): Profile {
  const address = raw?.storefrontAddress;
  return {
    id: saved.id, name: raw?.title ?? saved.display_name ?? null,
    address: raw ? (address ? [...(address.addressLines ?? []), address.locality, address.administrativeArea,
      address.postalCode, address.regionCode].filter(Boolean).join(', ') || null : null) : saved.address ?? null,
    category: raw?.categories?.primaryCategory?.displayName ?? null,
    additional_categories: (raw?.categories?.additionalCategories ?? []).map((c: any) => c.displayName).filter(Boolean),
    // Legacy description sometimes contained category text. Only trust a successful profile read.
    description: raw ? raw.profile?.description ?? null : null,
    phone: raw?.phoneNumbers?.primaryPhone ?? null, website: raw?.websiteUri ?? null,
    has_hours: raw ? Boolean(raw.regularHours?.periods?.length) : null,
    has_service_area: raw ? Boolean(raw.serviceArea?.places?.placeInfos?.length || raw.serviceArea?.regionCode) : null,
    latitude: raw?.latlng?.latitude ?? saved.latitude ?? null,
    longitude: raw?.latlng?.longitude ?? saved.longitude ?? null,
    place_id: raw?.metadata?.placeId ?? saved.dataforseo_place_id ?? null,
    maps_url: raw?.metadata?.mapsUri ?? null,
    source: raw ? 'google_business_profile' : 'saved_location',
  };
}
export function buildReadiness(profile: Profile, reviews: ReviewSummary, now = Date.now()) {
  const known = profile.source === 'google_business_profile';
  const checks: Check[] = [];
  const add = (id: string, label: string, weight: number, pass: boolean | null, detail: string, recommendation: string) =>
    checks.push({id,label,weight,status:pass === null ? 'unknown' : pass ? 'pass' : 'action',detail,recommendation});
  add('name','Business name',10,known ? Boolean(profile.name) : null,profile.name ?? 'Not returned','Use your accurate real-world business name.');
  add('category','Primary category',20,known ? Boolean(profile.category) : null,profile.category ?? 'Not returned','Choose the most specific category that accurately describes this location.');
  add('contact','Contact details',10,known ? Boolean(profile.phone) : null,profile.phone ?? 'Not returned','Add a current customer contact number.');
  add('website','Website',10,known ? Boolean(profile.website) : null,profile.website ?? 'Not returned','Link the website page that represents this location.');
  add('description','Business description',10,known ? Boolean(profile.description?.trim()) : null,profile.description ? 'Description present' : 'Not returned','Describe your real services clearly; avoid keyword stuffing.');
  add('hours','Business hours',10,profile.has_hours,'Regular hours ' + (profile.has_hours ? 'present' : 'not returned'),'Maintain accurate regular and special hours where applicable.');
  add('location','Location or service area',10,known ? Boolean(profile.address || profile.has_service_area) : null,
    profile.address ?? (profile.has_service_area ? 'Service area configured' : 'Not returned'),
    'Keep the address or service area accurate for your business model.');
  const rate = reviews.total ? reviews.replied / reviews.total : null;
  add('responses','Review response coverage',10,rate === null ? null : rate >= 0.8,
    rate === null ? 'No synced reviews' : Math.round(rate*100) + '% of synced reviews answered',
    'Respond helpfully to outstanding reviews. The 80% target is a Moffu operational target.');
  const age = reviews.latest_at ? (now - Date.parse(reviews.latest_at)) / 86400000 : null;
  add('activity','Recent review activity',10,age === null ? null : age <= 30,
    age === null ? 'No synced review history' : 'Latest synced review: ' + reviews.latest_at?.slice(0,10),
    'Invite honest reviews from all customers without incentives or sentiment filtering. The 30-day target is a Moffu heuristic.');
  const assessed = checks.filter(c => c.status !== 'unknown');
  const possible = assessed.reduce((s,c)=>s+c.weight,0);
  return { score: possible ? Math.round(100*assessed.filter(c=>c.status==='pass').reduce((s,c)=>s+c.weight,0)/possible) : null,
    coverage: possible, checks, methodology_version:'moffu-local-readiness-v1',
    explanation:'Moffu diagnostic with visible weights, based on available profile fields and synced review activity. Not a Google score, search position, or prediction. Unknown checks are excluded; coverage shows assessed weight out of 100.' };
}
export function parseMetrics(raw: any) {
  const values: Record<string, number> = {};
  const dates = new Set<string>();
  for (const group of raw?.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      for (const entry of series.timeSeries?.datedValues ?? []) {
        const date = entry.date;
        if (date) dates.add([date.year,String(date.month).padStart(2,'0'),String(date.day).padStart(2,'0')].join('-'));
        const n = Number(entry.value ?? 0);
        if (Number.isFinite(n)) values[series.dailyMetric] = (values[series.dailyMetric] ?? 0) + n;
      }
    }
  }
  return { search_views:(values.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0)+(values.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0),
    maps_views:(values.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0)+(values.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0),
    calls:values.CALL_CLICKS ?? 0, website_clicks:values.WEBSITE_CLICKS ?? 0,
    directions:values.BUSINESS_DIRECTION_REQUESTS ?? 0, days_with_data:dates.size };
}
export function normalizeKeywords(raw: any) {
  return (raw?.searchKeywordsCounts ?? []).map((item: any) => ({
    keyword:String(item.searchKeyword ?? ''), value:item.insightsValue?.value != null ? Number(item.insightsValue.value) : null,
    threshold:item.insightsValue?.threshold != null ? Number(item.insightsValue.threshold) : null,
  })).filter((item: any)=>item.keyword).sort((a: any,b: any)=>(b.value ?? -1)-(a.value ?? -1));
}
export function normalizeCompetitors(places: any[], profile: Profile, radius: number) {
  if (!coordinatesValid(profile.latitude,profile.longitude)) return [];
  const seen = new Set<string>();
  return places.filter(p=>p.id && !seen.has(p.id) && seen.add(p.id))
    .filter(p=>coordinatesValid(p.location?.latitude,p.location?.longitude))
    .map(p=>({place_id:p.id,name:p.displayName?.text ?? 'Unnamed business',rating:p.rating ?? null,
      review_count:p.userRatingCount ?? 0,address:p.formattedAddress ?? null,
      distance_km:distanceKm(profile.latitude!,profile.longitude!,p.location.latitude,p.location.longitude),
      is_you:p.id === profile.place_id,maps_url:p.googleMapsUri ?? null,
      attributions:p.attributions ?? []}))
    .filter(p=>p.distance_km <= radius).sort((a,b)=>a.distance_km-b.distance_km);
}
