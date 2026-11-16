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
  id: string; label: string; weight: number; severity: 'high' | 'medium' | 'low';
  status: 'pass' | 'action' | 'unknown' | 'not_applicable';
  observed_value: string | null;
  source: 'google_business_profile' | 'synced_reviews' | 'none';
  observed_at: string | null;
  evidence_ref: string | null;
  limitations: string[];
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
  const observedAt = new Date(now).toISOString();
  const add = (id: string, label: string, weight: number, pass: boolean | null, observedValue: string | null,
    source: Check['source'], evidenceRef: string | null, detail: string, recommendation: string) => {
    const status = pass === null ? 'unknown' : pass ? 'pass' : 'action';
    checks.push({id,label,weight,severity:weight>=20?'high':weight>=10?'medium':'low',status,
      observed_value:observedValue,source,observed_at:source==='none'?null:observedAt,evidence_ref:evidenceRef,
      limitations:source==='google_business_profile' ? ['Assessment uses only fields returned by the authorized Business Profile API.'] :
        source==='synced_reviews' ? ['Review findings use the reviews currently synced into Moffu and may not represent Google’s complete review history.'] :
        ['Google or review evidence was unavailable; this check is left unknown and excluded from coverage.'],
      detail,recommendation});
  };
  const profileSource: Check['source'] = known ? 'google_business_profile' : 'none';
  add('name','Business name',10,known ? Boolean(profile.name) : null,profile.name,profileSource,
    known ? 'google.business_information.title' : null,profile.name ?? 'Google Business Profile data was unavailable.',
    'Use your accurate real-world business name.');
  add('category','Primary category',20,known ? Boolean(profile.category) : null,profile.category,profileSource,
    known ? 'google.business_information.categories.primaryCategory' : null,profile.category ?? 'Google Business Profile data was unavailable.',
    'Choose the most specific category that accurately describes this location.');
  add('contact','Contact details',10,known ? Boolean(profile.phone) : null,profile.phone,profileSource,
    known ? 'google.business_information.phoneNumbers.primaryPhone' : null,profile.phone ?? 'Google Business Profile data was unavailable.',
    'Add a current customer contact number.');
  add('website','Website',10,known ? Boolean(profile.website) : null,profile.website,profileSource,
    known ? 'google.business_information.websiteUri' : null,profile.website ?? 'Google Business Profile data was unavailable.',
    'Link the website page that represents this location.');
  add('description','Business description',10,known ? Boolean(profile.description?.trim()) : null,
    profile.description?.trim() ? 'Description present' : profile.description,profileSource,
    known ? 'google.business_information.profile.description' : null,
    profile.description?.trim() ? 'Description present' : 'Google Business Profile data was unavailable.',
    'Describe your real services clearly; avoid keyword stuffing.');
  add('hours','Business hours',10,known ? profile.has_hours : null,
    known && profile.has_hours !== null ? profile.has_hours ? 'Regular hours present' : 'No regular hours returned' : null,
    profileSource,known ? 'google.business_information.regularHours' : null,
    known ? 'Regular hours ' + (profile.has_hours ? 'present' : 'not returned') : 'Google Business Profile data was unavailable.',
    'Maintain accurate regular and special hours where applicable.');
  const hasLocationInfo = Boolean(profile.address || profile.has_service_area);
  const locationValue = profile.address ?? (profile.has_service_area ? 'Service area configured' : null);
  add('location','Location or service area',10,known ? hasLocationInfo : null,locationValue,profileSource,
    known ? 'google.business_information.storefrontAddress|serviceArea' : null,
    locationValue ?? 'Google Business Profile data was unavailable.',
    'Keep the address or service area accurate for your business model. A service-area business does not need a public storefront address.');
  const rate = reviews.total ? reviews.replied / reviews.total : null;
  const reviewSource: Check['source'] = reviews.total > 0 ? 'synced_reviews' : 'none';
  add('responses','Review response coverage',10,rate === null ? null : rate >= 0.8,
    rate === null ? null : Math.round(rate*100) + '% of synced reviews answered',reviewSource,
    reviews.total > 0 ? 'reviews.synced_response_coverage' : null,
    rate === null ? 'No synced reviews' : Math.round(rate*100) + '% of synced reviews answered',
    'Respond helpfully to outstanding reviews. The 80% target is a Moffu operational target.');
  const age = reviews.latest_at ? (now - Date.parse(reviews.latest_at)) / 86400000 : null;
  add('activity','Recent review activity',10,age === null ? null : age <= 30,
    reviews.latest_at ?? null,reviews.latest_at ? 'synced_reviews' : 'none',
    reviews.latest_at ? 'reviews.latest_published_at' : null,
    age === null ? 'No synced review history' : 'Latest synced review: ' + reviews.latest_at?.slice(0,10),
    'Invite honest reviews from all customers without incentives or sentiment filtering. The 30-day target is a Moffu heuristic.');
  const assessed = checks.filter(c => c.status !== 'unknown' && c.status !== 'not_applicable');
  const possible = assessed.reduce((s,c)=>s+c.weight,0);
  return { score: possible ? Math.round(100*assessed.filter(c=>c.status==='pass').reduce((s,c)=>s+c.weight,0)/possible) : null,
    coverage: possible, checks, methodology_version:'moffu-local-readiness-v2',
    explanation:'Moffu Profile Doctor assessment based on the fields returned by Google Business Profile and your synced review summary. This is not a Google score, search position, or ranking prediction. Unknown checks are excluded; coverage shows assessed weight out of 100. The 80% response and 30-day activity thresholds are Moffu heuristics.' };
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
