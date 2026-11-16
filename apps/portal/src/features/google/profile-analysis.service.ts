import { supabase } from '@/lib/supabase';
export interface ProfileAnalysis {
  location_id: string; fetched_at: string;
  profile: {
    id:string; name:string|null; address:string|null; category:string|null; additional_categories:string[];
    description:string|null; phone:string|null; website:string|null; has_hours:boolean|null;
    has_service_area:boolean|null; latitude:number|null; longitude:number|null; place_id:string|null;
    maps_url:string|null; source:'google_business_profile'|'saved_location';
  };
  reviews:{total:number;replied:number;rating:number|null;google_review_count:number|null;latest_at:string|null};
  readiness:{score:number|null;coverage:number;explanation:string;methodology_version:string;
    checks:{id:string;label:string;weight:number;severity:'high'|'medium'|'low';
      status:'pass'|'action'|'unknown'|'not_applicable';observed_value:string|null;
      source:'google_business_profile'|'synced_reviews'|'none';observed_at:string|null;
      evidence_ref:string|null;limitations:string[];detail:string;recommendation:string}[]};
  performance:{status:string;search_views?:number;maps_views?:number;calls?:number;website_clicks?:number;
    directions?:number;days_with_data?:number;start?:string;end?:string};
  keywords:{status:string;month:string;items:{keyword:string;value:number|null;threshold:number|null}[];has_more:boolean};
  nearby:{status:string;radius_km:number;sample_limit:number;source:string;ordering:string;search_term:string|null;
    items:{place_id:string;name:string;rating:number|null;review_count:number;address:string|null;distance_km:number;
      is_you:boolean;maps_url:string|null;attributions:{provider?:string;providerUri?:string}[]}[]};
  warnings:{section:string;code:string}[];
}
const messages:Record<string,string>={
  FEATURE_REQUIRED:'Your current plan does not include Google Profile analysis.',
  ACCOUNT_INACTIVE:'Your account is not active. Contact support to restore access.',
  UNAUTHORIZED:'Your session expired. Sign in again.',
  LOCATION_NOT_FOUND:'This location is no longer available. Select another location.',
  GOOGLE_RECONNECT_REQUIRED:'Reconnect Google to refresh this business profile.',
  GOOGLE_ACCESS_REQUIRED:'Google has not granted access to this data. Check your Business Profile permissions and API configuration.',
  GOOGLE_RATE_LIMITED:'Google is temporarily limiting requests. Please retry later.',
  GOOGLE_UNAVAILABLE:'Google data could not be loaded. Try refreshing shortly.',
  PLACES_NOT_CONFIGURED:'Nearby business analysis is not enabled yet. Contact your administrator.',
  COORDINATES_UNAVAILABLE:'Google has not returned coordinates for this location.',
  CATEGORY_UNAVAILABLE:'A primary business category is required to find relevant competitors.',
  GBP_LOCATION_REQUIRED:'Connect this location through Google Business Profile to access profile details and performance.',
  RATE_LIMITED:'Please wait a minute before refreshing again.',
  TOKEN_STORAGE_FAILED:'Google authorization could not be saved. Contact support if this continues.',
  CONFIGURATION_UNAVAILABLE:'Business analysis configuration could not be loaded.',
  DATABASE_UNAVAILABLE:'Saved business data could not be loaded. Please retry.',
  INTERNAL_ERROR:'Business analysis could not be loaded. Please retry.',
};
export const analysisMessage=(code:string)=>messages[code] ?? 'Business analysis is temporarily unavailable. Please retry.';
export async function fetchProfileAnalysis(locationId:string,radiusKm:number,signal:AbortSignal):Promise<ProfileAnalysis>{
  const {data:{session}}=await supabase.auth.getSession();
  if (!session) throw new Error(messages.UNAUTHORIZED);
  const res=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/google-profile-analysis',{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',
      apikey:import.meta.env.VITE_SUPABASE_ANON_KEY},
    body:JSON.stringify({location_id:locationId,radius_km:radiusKm}),
    signal:AbortSignal.any([signal,AbortSignal.timeout(60000)]),
  });
  const body=await res.json().catch(()=>null);
  if (!res.ok) throw new Error(analysisMessage(body?.error ?? (res.status===401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR')));
  if (!body || body.location_id!==locationId || !body.profile || !body.readiness || !body.nearby)
    throw new Error('The business analysis response was incomplete. Please retry.');
  const fetchedAt=typeof body.fetched_at==='string' ? body.fetched_at : null;
  const checks=Array.isArray(body.readiness.checks) ? body.readiness.checks.map((check:Record<string,unknown>)=>{
    const weight=typeof check.weight==='number' ? check.weight : 0;
    const source=check.source==='google_business_profile' || check.source==='synced_reviews' || check.source==='none'
      ? check.source : body.profile.source==='google_business_profile' ? 'google_business_profile' : 'none';
    const limitations=Array.isArray(check.limitations) ? check.limitations.filter((item):item is string=>typeof item==='string') :
      source==='synced_reviews' ? ['Review findings use reviews currently synced into Moffu and may not represent Google’s complete review history.'] :
      source==='google_business_profile' ? ['Assessment uses only fields returned by the authorized Business Profile API.'] :
      ['Google or review evidence was unavailable; this check is left unknown and excluded from coverage.'];
    return {
      ...check,
      weight,
      severity:check.severity==='high' || check.severity==='medium' || check.severity==='low'
        ? check.severity : weight>=20 ? 'high' : weight>=10 ? 'medium' : 'low',
      status:check.status==='pass' || check.status==='action' || check.status==='not_applicable' ? check.status : 'unknown',
      observed_value:typeof check.observed_value==='string' ? check.observed_value : null,
      source,
      observed_at:typeof check.observed_at==='string' ? check.observed_at : source==='none' ? null : fetchedAt,
      evidence_ref:typeof check.evidence_ref==='string' ? check.evidence_ref : null,
      limitations,
      detail:typeof check.detail==='string' ? check.detail : 'Evidence was not returned.',
      recommendation:typeof check.recommendation==='string' ? check.recommendation : 'Review this profile field in Google Business Profile.',
    };
  }) : [];
  return { ...body, readiness:{ ...body.readiness, methodology_version:body.readiness.methodology_version ?? 'moffu-local-readiness-v1', checks } } as ProfileAnalysis;
}
