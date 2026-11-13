const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(path.resolve(__dirname,'../../../apps/portal/node_modules/typescript'));
function compile(file,bindings={}){
  const source=fs.readFileSync(path.join(__dirname,file),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{module,exports:module.exports,require,console,Date,Map,Set,URL,URLSearchParams,
    Response,Request,AbortSignal,...bindings},{filename:file});
  return module.exports;
}
const a=compile('analysis.ts');
const saved={id:'location-a',display_name:'Same business name',address:'Old address',latitude:0,longitude:0};
test('profile keeps categories separate from description and preserves zero coordinates',()=>{
  const p=a.normalizeProfile({title:'Business',categories:{primaryCategory:{displayName:'Cafe'},
    additionalCategories:[{displayName:'Restaurant'}]},profile:{description:'Real description'}},saved);
  assert.equal(p.category,'Cafe');assert.equal(p.description,'Real description');
  assert.deepEqual(Array.from(p.additional_categories),['Restaurant']);
  assert.equal(a.coordinatesValid(p.latitude,p.longitude),true);
});
test('unavailable profile fields are unknown, not penalized as missing',()=>{
  const p=a.normalizeProfile(null,saved);
  const result=a.buildReadiness(p,{total:0,replied:0,rating:null,latest_at:null});
  assert.equal(result.score,null);assert.equal(result.coverage,0);
  assert.ok(result.checks.every(c=>c.status==='unknown'));
});
test('rating is not invented from synced reviews and thresholds remain thresholds',()=>{
  const list=a.normalizeKeywords({searchKeywordsCounts:[
    {searchKeyword:'cafe',insightsValue:{value:'123'}},
    {searchKeyword:'coffee near me',insightsValue:{threshold:'15'}},
  ]});
  assert.equal(list[0].value,123);assert.equal(list[1].value,null);assert.equal(list[1].threshold,15);
});
test('performance parses nested Google dailyMetricTimeSeries and string counts',()=>{
  const result=a.parseMetrics({multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[
    {dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{date:{year:2026,month:10,day:1},value:'12'}]}},
    {dailyMetric:'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',timeSeries:{datedValues:[{date:{year:2026,month:10,day:1},value:'50'}]}},
    {dailyMetric:'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',timeSeries:{datedValues:[{date:{year:2026,month:10,day:2},value:'7'}]}},
  ]}]});
  assert.equal(result.calls,12);assert.equal(result.search_views,57);assert.equal(result.days_with_data,2);
});
test('competitors enforce radius, dedupe place IDs and never identify by shared name',()=>{
  const p={...a.normalizeProfile(null,saved),place_id:'own'};
  const place=(id,lat)=>({id,displayName:{text:'Same business name'},location:{latitude:lat,longitude:0}});
  const results=a.normalizeCompetitors([place('other',0.01),place('other',0.01),place('own',0),place('outside',1)],p,5);
  assert.equal(results.length,2);
  assert.equal(results[0].is_you,true);assert.equal(results[1].is_you,false);
  assert.ok(results.every(p=>p.distance_km<=5));
});
test('readiness weights total 100 and complete observed checks score 100',()=>{
  const profile=a.normalizeProfile({title:'Cafe',categories:{primaryCategory:{displayName:'Cafe'}},
    storefrontAddress:{addressLines:['Main St']},phoneNumbers:{primaryPhone:'123'},websiteUri:'https://example.com',
    profile:{description:'Cafe'},regularHours:{periods:[{}]}},saved);
  const result=a.buildReadiness(profile,{total:100,replied:80,rating:null,latest_at:'2026-11-12T12:00:00Z'},Date.parse('2026-11-13T12:00:00Z'));
  assert.equal(result.checks.reduce((n,c)=>n+c.weight,0),100);
  assert.equal(result.score,100);assert.equal(result.coverage,100);
});
function handler({user=true,location=null,accountStatus='active',entitled=true}={}){
  let serve;let providerCalls=0;const queried=[];
  const chain={select(){return this;},eq(key,value){queried.push([key,value]);return this;},
    maybeSingle:async()=>({data:location,error:null})};
  const client={auth:{getUser:async()=>({data:{user:user ? {id:'caller'} : null},error:null})},
    from:(table)=>({...chain,maybeSingle:async()=>({data:table==='profiles' ? {status:accountStatus} : table==='subscriptions' ? {plan_id:'plan'} : table==='plan_entitlements' ? {bool_value:entitled} : location,error:null})})};
  compile('index.ts',{
    require:(id)=>id==='./analysis.ts' ? a : {createClient:()=>client},
    fetch:async()=>{providerCalls++;throw Error('Unexpected external fetch');},
    Deno:{env:{get:()=> 'test-value'},serve:fn=>{serve=fn;}},
  });
  return {run:serve,queried,getProviderCalls:()=>providerCalls};
}
const id='11111111-1111-4111-8111-111111111111';
function req(body,auth='Bearer test'){return new Request('https://example.com',{method:'POST',
  headers:{'Content-Type':'application/json',...(auth ? {Authorization:auth} : {})},body:JSON.stringify(body)});}
test('analysis endpoint rejects missing or invalid authentication before provider calls',async()=>{
  const h=handler({user:false});
  assert.equal((await h.run(req({location_id:id,radius_km:5},''))).status,401);
  assert.equal((await h.run(req({location_id:id,radius_km:5}))).status,401);
  assert.equal(h.getProviderCalls(),0);
});
test('analysis endpoint rejects null, malformed location and unapproved radius',async()=>{
  const h=handler();
  for(const body of [null,{location_id:null,radius_km:5},{location_id:id,radius_km:50},{location_id:'x',radius_km:5}])
    assert.equal((await h.run(req(body))).status,400);
  assert.equal(h.getProviderCalls(),0);
});
test('unknown or cross-user location never falls back or invokes providers',async()=>{
  const h=handler();
  const response=await h.run(req({location_id:id,radius_km:5}));
  assert.equal(response.status,404);
  assert.ok(h.queried.some(([key,value])=>key==='id' && value===id));
  assert.ok(h.queried.some(([key,value])=>key==='user_id' && value==='caller'));
  assert.equal(h.getProviderCalls(),0);
});

test('inactive account and disabled plan entitlement deny provider access',async()=>{
  const inactive=handler({location:{id},accountStatus:'suspended'});
  assert.equal((await inactive.run(req({location_id:id,radius_km:5}))).status,403);
  assert.equal(inactive.getProviderCalls(),0);
  const denied=handler({location:{id},entitled:false});
  assert.equal((await denied.run(req({location_id:id,radius_km:5}))).status,403);
  assert.equal(denied.getProviderCalls(),0);
});
