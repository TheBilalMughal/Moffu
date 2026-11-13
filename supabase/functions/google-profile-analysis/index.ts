import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { buildReadiness, coordinatesValid, normalizeProfile, normalizeKeywords, normalizeCompetitors, parseMetrics } from './analysis.ts';
const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data),
  {status,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}});
class SafeError extends Error { constructor(public code: string, public status: number) { super(code); } }
async function provider(url: string, init: RequestInit = {}) {
  const res = await fetch(url,{...init,signal:AbortSignal.timeout(12000)});
  if (!res.ok) throw new SafeError(res.status===401 ? 'GOOGLE_RECONNECT_REQUIRED' :
    res.status===403 ? 'GOOGLE_ACCESS_REQUIRED' : res.status===429 ? 'GOOGLE_RATE_LIMITED' : 'GOOGLE_UNAVAILABLE',res.status);
  return res.json();
}
function dateParams(params: URLSearchParams, prefix: string, date: Date, withDay = true) {
  params.set(prefix+'.year',String(date.getUTCFullYear()));
  params.set(prefix+'.month',String(date.getUTCMonth()+1));
  if (withDay) params.set(prefix+'.day',String(date.getUTCDate()));
}
// Only request coalescing / short abuse protection is retained in memory. No provider content is persisted.
const inFlight = new Map<string, Promise<unknown>>();
const recent = new Map<string, number[]>();
Deno.serve(async(req: Request) => {
  if (req.method==='OPTIONS') return new Response(null,{headers:CORS});
  if (req.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({error:'UNAUTHORIZED'},401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError} = await admin.auth.getUser(auth.slice(7));
    if (authError || !user) return json({error:'UNAUTHORIZED'},401);
    let body;
    try { body = await req.json(); } catch { return json({error:'INVALID_REQUEST'},400); }
    if (!body || typeof body!=='object' || typeof body.location_id!=='string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.location_id) ||
      ![5,10,20,30].includes(body.radius_km)) return json({error:'INVALID_LOCATION_OR_RADIUS'},400);
    // Explicit owner filter matches the current user-scoped Google integration. Never fall back to another location.
    const {data:saved,error:locationError} = await admin.from('google_locations')
      .select('id,connection_id,display_name,address,google_location_name,latitude,longitude,dataforseo_place_id')
      .eq('id',body.location_id).eq('user_id',user.id).maybeSingle();
    if (locationError) return json({error:'DATABASE_UNAVAILABLE'},503);
    if (!saved) return json({error:'LOCATION_NOT_FOUND'},404);
    const {data:account,error:accountError} = await admin.from('profiles').select('status')
      .eq('id',user.id).maybeSingle();
    if (accountError) return json({error:'DATABASE_UNAVAILABLE'},503);
    if (!account || account.status!=='active') return json({error:'ACCOUNT_INACTIVE'},403);
    const {data:subscription,error:subscriptionError} = await admin.from('subscriptions').select('plan_id')
      .eq('user_id',user.id).eq('status','active').maybeSingle();
    if (subscriptionError) return json({error:'DATABASE_UNAVAILABLE'},503);
    if (!subscription) return json({error:'FEATURE_REQUIRED'},403);
    const {data:entitlement,error:entitlementError} = await admin.from('plan_entitlements').select('bool_value')
      .eq('plan_id',subscription.plan_id).eq('key','feature_google_profile').maybeSingle();
    if (entitlementError) return json({error:'DATABASE_UNAVAILABLE'},503);
    // Preserve the existing catalog's default-access behavior only when no feature row is configured.
    if (entitlement?.bool_value===false) return json({error:'FEATURE_REQUIRED'},403);
    const {data:conn,error:connError} = await admin.from('google_connections')
      .select('id,state,token_expiry').eq('id',saved.connection_id).eq('user_id',user.id).maybeSingle();
    if (connError) return json({error:'DATABASE_UNAVAILABLE'},503);
    if (!conn || conn.state==='DISCONNECTED' || conn.state==='REVOKED') return json({error:'GOOGLE_RECONNECT_REQUIRED'},409);
    const key = user.id+':'+saved.id+':'+body.radius_km;
    if (inFlight.has(key)) return json(await inFlight.get(key));
    const now = Date.now();
    for (const [id,times] of recent) if (!times.some(t=>now-t<60000)) recent.delete(id);
    const attempts = (recent.get(user.id) ?? []).filter(t=>now-t<60000);
    if (attempts.length>=6) return json({error:'RATE_LIMITED'},429);
    recent.set(user.id,[...attempts,now]);
    const work = (async() => {
      const warnings: {section:string;code:string}[] = [];
      const {data:settings,error:settingsError} = await admin.from('platform_settings')
        .select('key,value').in('key',['google_client_id','google_client_secret','google_maps_api_key']);
      if (settingsError) throw new SafeError('CONFIGURATION_UNAVAILABLE',503);
      const config = Object.fromEntries((settings ?? []).map((s:any)=>[s.key,s.value]));
      let accessToken: string | null = null;
      const resource = /(?:^|\/)(locations\/[0-9]+)$/.exec(saved.google_location_name)?.[1] ?? null;
      if (resource) {
        const {data:tokens,error:tokensError} = await admin.from('google_connection_tokens')
          .select('access_token,refresh_token').eq('connection_id',conn.id).maybeSingle();
        if (tokensError) throw new SafeError('DATABASE_UNAVAILABLE',503);
        accessToken = tokens?.access_token ?? null;
        if (!conn.token_expiry || Date.parse(conn.token_expiry) < now+60000) {
          accessToken=null;
          if (tokens?.refresh_token) {
            try {
              const fresh = await provider('https://oauth2.googleapis.com/token',{
                method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body:new URLSearchParams({grant_type:'refresh_token',refresh_token:tokens.refresh_token,
                  client_id:config.google_client_id || Deno.env.get('GOOGLE_CLIENT_ID') || '',
                  client_secret:config.google_client_secret || Deno.env.get('GOOGLE_CLIENT_SECRET') || ''}),
              });
              accessToken=fresh.access_token ?? null;
              if (accessToken) {
                const {error:saveToken} = await admin.from('google_connection_tokens').update({access_token:accessToken,
                  updated_at:new Date().toISOString()}).eq('connection_id',conn.id);
                const {error:saveExpiry} = await admin.from('google_connections').update({
                  token_expiry:new Date(now+(Number(fresh.expires_in ?? 3600)-60)*1000).toISOString()}).eq('id',conn.id);
                if (saveToken || saveExpiry) warnings.push({section:'profile',code:'TOKEN_STORAGE_FAILED'});
              }
            } catch { warnings.push({section:'profile',code:'GOOGLE_RECONNECT_REQUIRED'}); }
          }
        }
      }
      const read = async(section:string,url:string,init:RequestInit={}) => {
        try { return await provider(url,init); }
        catch(e) { warnings.push({section,code:e instanceof SafeError ? e.code : 'GOOGLE_UNAVAILABLE'}); return null; }
      };
      const headers={Authorization:'Bearer '+accessToken};
      const end=new Date(); end.setUTCDate(end.getUTCDate()-1);
      const start=new Date(end); start.setUTCDate(start.getUTCDate()-29);
      const month=new Date(Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth()-1,1));
      const perfParams=new URLSearchParams();
      for (const metric of ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
        'BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS','CALL_CLICKS','WEBSITE_CLICKS','BUSINESS_DIRECTION_REQUESTS'])
        perfParams.append('dailyMetrics',metric);
      dateParams(perfParams,'dailyRange.start_date',start); dateParams(perfParams,'dailyRange.end_date',end);
      const keywordParams=new URLSearchParams({pageSize:'100'});
      dateParams(keywordParams,'monthlyRange.start_month',month,false);
      dateParams(keywordParams,'monthlyRange.end_month',month,false);
      const base='https://businessprofileperformance.googleapis.com/v1/'+resource;
      if (!resource || !accessToken) {
        for (const section of ['profile','performance','keywords'])
          warnings.push({section,code:resource ? 'GOOGLE_RECONNECT_REQUIRED' : 'GBP_LOCATION_REQUIRED'});
      }
      const [raw,performance,keywords,totalResult,repliedResult,latestResult] = await Promise.all([
        resource && accessToken ? read('profile','https://mybusinessbusinessinformation.googleapis.com/v1/'+resource+
          '?readMask=name,title,storefrontAddress,categories,profile,latlng,phoneNumbers,websiteUri,regularHours,serviceArea,metadata',{headers}) : null,
        resource && accessToken ? read('performance',base+':fetchMultiDailyMetricsTimeSeries?'+perfParams,{headers}) : null,
        resource && accessToken ? read('keywords',base+'/searchkeywords/impressions/monthly?'+keywordParams,{headers}) : null,
        admin.from('reviews').select('id',{head:true,count:'exact'}).eq('user_id',user.id).eq('location_id',saved.id),
        admin.from('reviews').select('id',{head:true,count:'exact'}).eq('user_id',user.id).eq('location_id',saved.id)
          .not('reply_text','is',null).neq('reply_text',''),
        admin.from('reviews').select('published_at').eq('user_id',user.id).eq('location_id',saved.id)
          .order('published_at',{ascending:false,nullsFirst:false}).limit(1),
      ]);
      if (totalResult.error || repliedResult.error || latestResult.error) throw new SafeError('DATABASE_UNAVAILABLE',503);
      const profile=normalizeProfile(raw,saved);
      const reviews={total:totalResult.count ?? 0,replied:repliedResult.count ?? 0,rating:null,
        latest_at:latestResult.data?.[0]?.published_at ?? null};
      const mapsKey=config.google_maps_api_key || Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
      let competitorStatus='unavailable';
      let competitors:ReturnType<typeof normalizeCompetitors>=[];
      let yourRating:number | null=null;
      let yourReviewCount:number | null=null;
      // Fetch own place only by a verified place ID. No name-based identity guessing.
      if (mapsKey && profile.place_id) {
        const own=await read('places','https://places.googleapis.com/v1/places/'+encodeURIComponent(profile.place_id),{
          headers:{'X-Goog-Api-Key':mapsKey,'X-Goog-FieldMask':'id,location,primaryType,rating,userRatingCount'}});
        if (own) {
          if (!coordinatesValid(profile.latitude,profile.longitude) && coordinatesValid(own.location?.latitude,own.location?.longitude)) {
            profile.latitude=own.location.latitude; profile.longitude=own.location.longitude;
          }
          yourRating=own.rating ?? null; yourReviewCount=own.userRatingCount ?? null;
        }
      }
      if (!mapsKey) warnings.push({section:'competitors',code:'PLACES_NOT_CONFIGURED'});
      else if (!coordinatesValid(profile.latitude,profile.longitude)) warnings.push({section:'competitors',code:'COORDINATES_UNAVAILABLE'});
      else if (!profile.category) warnings.push({section:'competitors',code:'CATEGORY_UNAVAILABLE'});
      else {
        // Text Search supports GBP categories that do not map directly to Places type enums.
        // A location bias is not a radius restriction: enforce the circle using returned coordinates.
        const data=await read('competitors','https://places.googleapis.com/v1/places:searchText',{
          method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':mapsKey,
            'X-Goog-FieldMask':'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.googleMapsUri,places.attributions'},
          body:JSON.stringify({textQuery:profile.category,languageCode:'en',pageSize:20,
            locationBias:{circle:{center:{latitude:profile.latitude,longitude:profile.longitude},radius:body.radius_km*1000}}}),
        });
        if (data) { competitorStatus='available'; competitors=normalizeCompetitors(data.places ?? [],profile,body.radius_km); }
      }
      return {location_id:saved.id,fetched_at:new Date().toISOString(),profile,
        reviews:{...reviews,rating:yourRating,google_review_count:yourReviewCount},readiness:buildReadiness(profile,reviews),
        performance:performance ? {status:'available',...parseMetrics(performance),start:start.toISOString().slice(0,10),
          end:end.toISOString().slice(0,10)} : {status:'unavailable'},
        keywords:{status:keywords ? 'available' : 'unavailable',month:month.toISOString().slice(0,7),
          items:normalizeKeywords(keywords),has_more:Boolean(keywords?.nextPageToken)},
        nearby:{status:competitorStatus,radius_km:body.radius_km,items:competitors,
          sample_limit:20,source:'Google Places',ordering:'distance',search_term:profile.category},
        warnings};
    })();
    inFlight.set(key,work);
    try { return json(await work); } finally { inFlight.delete(key); }
  } catch(e) {
    // Never log OAuth payloads, API URLs/keys, provider bodies or customer content.
    console.error('google-profile-analysis:',e instanceof SafeError ? e.code : 'INTERNAL_ERROR');
    return json({error:e instanceof SafeError ? e.code : 'INTERNAL_ERROR'},e instanceof SafeError ? 502 : 500);
  }
});
