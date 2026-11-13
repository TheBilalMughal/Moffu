import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLocationStore } from '@/features/location/location.store';
import { googleService, type GoogleConnection, type GoogleLocation } from './google.service';
import { analysisMessage, fetchProfileAnalysis, type ProfileAnalysis } from './profile-analysis.service';

const RADII=[5,10,20,30] as const;
const REFRESH_MS=15*60*1000;
const panel='rounded-xl border border-[#E5E7EB] bg-white';
const number=(n:number|null|undefined)=>n==null ? '—' : n.toLocaleString();
function safeUrl(value:string|null|undefined):string|undefined {
  try { const url=new URL(value ?? ''); return ['https:','http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
function GoogleAttribution(){
  return <div className="flex items-center gap-2 text-xs text-[#6B7280]">
    <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
      alt="Powered by Google" className="h-[18px] w-auto" />
  </div>;
}
function Section({title,description,action,children}:{title:string;description?:string;action?:ReactNode;children:ReactNode}){
  return <section className={panel}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F3F4F6] p-5">
      <div><h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6B7280]">{description}</p>}</div>{action}
    </div><div className="p-5">{children}</div>
  </section>;
}
function Empty({children}:{children:ReactNode}){
  return <p className="py-5 text-sm leading-relaxed text-[#6B7280]">{children}</p>;
}
function Metric({label,value,detail}:{label:string;value:ReactNode;detail?:string}){
  return <div className={panel+' p-4'}>
    <p className="text-xs text-[#6B7280]">{label}</p>
    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#111827]">{value}</p>
    {detail && <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">{detail}</p>}
  </div>;
}

export function GoogleProfilePage(){
  const globalLocationId=useLocationStore(s=>s.selectedId);
  const [locations,setLocations]=useState<GoogleLocation[]>([]);
  const [connection,setConnection]=useState<GoogleConnection|null>(null);
  const [initialLoading,setInitialLoading]=useState(true);
  const [initialError,setInitialError]=useState('');
  const [localId,setLocalId]=useState<string|null>(null);
  const [radius,setRadius]=useState<typeof RADII[number]>(5);
  const [analysis,setAnalysis]=useState<ProfileAnalysis|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [revision,setRevision]=useState(0);
  const [menuOpen,setMenuOpen]=useState(false);
  const [initRevision,setInitRevision]=useState(0);
  const selectorRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let active=true;
    setInitialLoading(true); setInitialError('');
    Promise.all([googleService.getConnection(),googleService.getLocations()]).then(([conn,locs])=>{
      if (!active) return;
      if (conn.error || locs.error) throw new Error(conn.error || locs.error);
      setConnection(conn.data ?? null);
      const available=(locs.data ?? []).filter(l=>l.is_selected);
      setLocations(available);
      setLocalId(current=>available.some(l=>l.id===current) ? current : available[0]?.id ?? null);
    }).catch(e=>{if(active) setInitialError(e instanceof Error ? e.message : 'Unable to load your locations.');})
      .finally(()=>{if(active) setInitialLoading(false);});
    return ()=>{active=false;};
  },[initRevision]);

  // "All locations" needs an explicit local choice. An invalid global selection never falls back to a different business.
  const locationId=globalLocationId ?? localId;
  const selected=locations.find(l=>l.id===locationId);
  useEffect(()=>{
    const close=(e:MouseEvent)=>{if(!selectorRef.current?.contains(e.target as Node)) setMenuOpen(false);};
    document.addEventListener('mousedown',close);
    return ()=>document.removeEventListener('mousedown',close);
  },[]);
  useEffect(()=>{
    if (!selected || !connection) {setAnalysis(null);setError('');setLoading(false);return;}
    const controller=new AbortController();
    setAnalysis(null);setError('');setLoading(true);
    fetchProfileAnalysis(selected.id,radius,controller.signal).then(data=>{
      if(!controller.signal.aborted) setAnalysis(data);
    }).catch(e=>{
      if(!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load analysis.');
    }).finally(()=>{if(!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[selected?.id,connection?.id,radius,revision]);

  useEffect(()=>{
    if (!selected) return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible') setRevision(n=>n+1);},REFRESH_MS);
    return ()=>clearInterval(timer);
  },[selected?.id,radius]);

  if(initialLoading) return <div className="space-y-4 p-6" role="status" aria-label="Loading business locations">
    {[0,1,2].map(n=><div key={n} className="h-24 animate-pulse rounded-xl bg-[#F3F4F6] motion-reduce:animate-none" />)}
  </div>;
  if(initialError) return <div className="p-6"><div role="alert" className={panel+' p-5'}>
    <p className="text-sm text-red-700">{initialError}</p>
    <button className="mt-3 text-sm font-medium text-[#6C55E8]" onClick={()=>setInitRevision(n=>n+1)}>Retry loading locations</button>
  </div></div>;
  if(!connection) return <div className="p-6"><Section title="Google Business Profile">
    <Empty>Connect your Google account to analyze your business locations.</Empty>
    <Link to="/settings" className="text-sm font-medium text-[#6C55E8]">Open Settings</Link>
  </Section></div>;

  const current=analysis?.location_id===locationId && analysis.nearby.radius_km===radius ? analysis : null;
  const profile=current?.profile;
  const reviews=current?.reviews;
  const readiness=current?.readiness;
  const competitors=current?.nearby.items.filter(c=>!c.is_you) ?? [];
  const rated=competitors.filter(c=>c.rating!==null);
  const average=rated.length ? rated.reduce((s,c)=>s+c.rating!,0)/rated.length : null;
  const reviewAverage=competitors.length ? Math.round(competitors.reduce((s,c)=>s+c.review_count,0)/competitors.length) : null;
  const warnings=(section:string)=>[...new Set(current?.warnings.filter(w=>w.section===section).map(w=>analysisMessage(w.code)) ?? [])];
  const warningText=(section:string)=>warnings(section).join(' ') || 'Google has not returned data for this section.';
  const fields=[
    ['Primary category',profile?.category],['Additional categories',profile?.additional_categories.join(', ')],
    ['Address',profile?.address],['Phone',profile?.phone],['Website',profile?.website],
    ['Business description',profile?.description],
    ['Regular hours',profile?.has_hours==null ? null : profile.has_hours ? 'Configured' : 'Not returned'],
  ];
  return <div className="w-full space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>

        <h1 className="text-xl font-semibold tracking-tight text-[#111827]">{selected?.display_name ?? 'Select a business location'}</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">Profile readiness, search performance and nearby businesses for this location.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!globalLocationId && locations.length>0 && <div ref={selectorRef} className="relative">
          <button type="button" aria-expanded={menuOpen} aria-controls="profile-location-options"
            onClick={()=>setMenuOpen(v=>!v)} onKeyDown={e=>{if(e.key==='Escape') setMenuOpen(false);}}
            className="inline-flex max-w-[280px] items-center gap-2 whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium">
            <span className="truncate">{selected?.display_name ?? 'Choose location'}</span>
            <svg className={`h-3 w-3 flex-shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {menuOpen && <div id="profile-location-options" className="absolute left-0 z-30 mt-1 max-h-72 w-72 sm:left-auto sm:right-0 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-sm"
            onKeyDown={e=>{if(e.key==='Escape') setMenuOpen(false);}}>
            {locations.map(l=><button key={l.id} type="button" aria-pressed={l.id===locationId}
              onClick={()=>{setLocalId(l.id);setMenuOpen(false);}}
              className={'block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#F9FAFB] '+(l.id===locationId ? 'bg-[#F5F3FF] text-[#6C55E8]' : 'text-[#374151]')}>
              {l.display_name ?? 'Unnamed location'}{l.address && <span className="mt-1 block text-[11px] text-[#6B7280]">{l.address}</span>}
            </button>)}
          </div>}
        </div>}
        <button disabled={loading || !selected} onClick={()=>setRevision(n=>n+1)}
          className="rounded-lg bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#5A42D1] disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Analyzing…' : 'Refresh analysis'}
        </button>
      </div>
    </header>
    {!selected && <Section title="Choose a location"><Empty>
      {globalLocationId ? 'The selected location is not available. Choose an active location in the top bar.' :
        'Select a business location in Settings to start your analysis.'}
    </Empty><Link to="/settings" className="text-sm text-[#6C55E8]">Manage Google locations</Link></Section>}
    {selected && <>
      {current && (
        <div className="flex justify-end text-[11px] text-[#6B7280]">
          <span>Fetched {new Date(current.fetched_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,'-')}, {new Date(current.fetched_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && <div role="status" aria-live="polite" className="space-y-4">
        <p className="text-xs text-[#6B7280]">Fetching this location’s Google profile and search data…</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0,1,2,3].map(n=><div key={n} className="h-24 animate-pulse rounded-xl bg-[#F3F4F6] motion-reduce:animate-none" />)}</div>
      </div>}
      {current && <>
        {current.warnings.length>0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900" role="status">
          Some Google data is unavailable. Each section below explains what could be loaded.
        </div>}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Metric label="Moffu SEO readiness" value={readiness?.score==null ? '—' : readiness.score+'/100'} detail={'Coverage: '+readiness?.coverage+'/100 weight assessed'} />
          <Metric label="Google rating" value={reviews?.rating?.toFixed(1) ?? '—'} detail={reviews?.google_review_count==null ? 'Google Places rating unavailable' : number(reviews.google_review_count)+' Google reviews'} />
          <Metric label="Synced reviews answered" value={reviews?.total ? Math.round(reviews.replied/reviews.total*100)+'%' : '—'} detail={number(reviews?.replied)+' of '+number(reviews?.total)+' synced reviews'} />
          <Metric label={'Nearby average rating · '+radius+' km'} value={average?.toFixed(1) ?? '—'} detail={rated.length+' rated businesses in the returned sample'} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Business profile" description="Business category and description are fetched as separate Google fields.">
            {profile?.source!=='google_business_profile' && <p className="mb-4 text-xs leading-relaxed text-amber-700">{warningText('profile')} Saved identity is shown; unknown fields are not scored as missing.</p>}
            <dl className="divide-y divide-[#F3F4F6]">{fields.map(([label,value])=><div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3 text-xs">
              <dt className="text-[#6B7280]">{label}</dt><dd className="break-words font-medium leading-relaxed text-[#374151]">
                {label==='Website' && safeUrl(value) ? <a href={safeUrl(value)} target="_blank" rel="noreferrer" className="text-[#6C55E8] hover:underline">{value}</a> : value || 'Not available'}
              </dd></div>)}</dl>
            {safeUrl(profile?.maps_url) && <a className="mt-4 inline-block text-xs font-medium text-[#6C55E8]" href={safeUrl(profile?.maps_url)} target="_blank" rel="noreferrer">View this business on Google Maps</a>}
          </Section>
          <Section title="SEO readiness checklist" description="A transparent Moffu diagnostic informed by Google's local ranking guidance.">
            <p className="mb-4 text-xs leading-relaxed text-[#6B7280]">{readiness?.explanation}</p>
            <div className="space-y-3">{readiness?.checks.map(check=><div key={check.id} className="border-b border-[#F3F4F6] pb-3 last:border-0">
              <div className="flex justify-between gap-3 text-xs"><span className="font-medium text-[#374151]">{check.label} <span className="font-normal text-[#9CA3AF]">· {check.weight} points</span></span>
                <span className={check.status==='pass' ? 'text-emerald-700' : check.status==='unknown' ? 'text-[#9CA3AF]' : 'text-amber-700'}>
                  {check.status==='pass' ? 'Present / met' : check.status==='unknown' ? 'Unknown' : 'Improve'}</span></div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{check.status==='action' ? check.recommendation : check.detail}</p>
            </div>)}</div>
            <a href="https://support.google.com/business/answer/7091" target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-medium text-[#6C55E8]">Google’s local ranking guidance</a>
          </Section>
        </div>
        <Section title="Search and Maps performance" description={current.performance.start ?
          current.performance.start+' to '+current.performance.end+' · Google Business Profile data may arrive with a delay.' : 'Last 30 completed days'}>
          {current.performance.status==='available' && (current.performance.days_with_data ?? 0)>0 ?
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[
              ['Search impressions',current.performance.search_views],['Maps impressions',current.performance.maps_views],
              ['Call clicks',current.performance.calls],['Website clicks',current.performance.website_clicks],['Direction requests',current.performance.directions],
            ].map(([label,value])=><div key={label} className="rounded-lg bg-[#F9FAFB] p-4">
              <p className="text-[11px] text-[#6B7280]">{label}</p><p className="mt-2 font-mono text-xl font-semibold tabular-nums">{number(value as number|undefined)}</p>
            </div>)}</div> :
            <Empty>{current.performance.status==='available' ? 'Google returned no performance observations for this period.' : warningText('performance')}</Empty>}
        </Section>
        <Section title="Search terms bringing customers to this profile"
          description={'Google Business Profile · '+current.keywords.month+' · Last completed calendar month. These are profile discovery terms, not all searches within a radius.'}>
          {current.keywords.status!=='available' ? <Empty>{warningText('keywords')}</Empty> : current.keywords.items.length===0 ?
            <Empty>Google has not returned search terms for this month. Small volumes and reporting delays may limit available data.</Empty> :
            <div className="max-h-96 overflow-auto"><table className="w-full text-left text-xs">
              <thead><tr className="border-b border-[#E5E7EB] text-[#6B7280]"><th scope="col" className="pb-3 font-medium">Search term</th><th scope="col" className="pb-3 text-right font-medium">Monthly impressions</th></tr></thead>
              <tbody>{current.keywords.items.map(item=><tr key={item.keyword} className="border-b border-[#F3F4F6] last:border-0">
                <td className="py-3 pr-4">{item.keyword}</td><td className="py-3 text-right font-mono tabular-nums">{item.value!=null ? number(item.value) : item.threshold!=null ? '< '+number(item.threshold) : 'Not reported'}</td>
              </tr>)}</tbody></table>
              {current.keywords.has_more && <p className="mt-3 text-[11px] text-[#6B7280]">Showing the first 100 terms returned by Google.</p>}
            </div>}
        </Section>
        <Section title="Nearby competitor comparison"
          description={'Businesses matching '+(current.nearby.search_term ?? 'your primary category')+'. Distances are from this location. This is a maximum 20-result discovery sample, not a Google ranking or a complete market census.'}
          action={<div className="inline-flex flex-wrap gap-1 rounded-lg bg-[#F3F4F6] p-1" aria-label="Competitor search radius">{RADII.map(r=><button key={r} aria-pressed={radius===r}
            onClick={()=>setRadius(r)} className={'rounded-md px-3 py-1.5 text-xs font-medium '+(r===radius ? 'bg-white text-[#6C55E8] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]')}>{r} km</button>)}</div>}>
          {current.nearby.status!=='available' ? <Empty>{warningText('competitors')}</Empty> : competitors.length===0 ?
            <Empty>No other matching businesses were returned within {radius} km. This does not prove there are no competitors in the area.</Empty> :
            <>
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-[#6B7280]">
                <span>{competitors.length} nearby businesses returned</span><span>Average reviews: {number(reviewAverage)}</span>
                {reviews?.rating!=null && average!=null && <span>Your rating vs sample: {(reviews.rating-average)>=0 ? '+' : ''}{(reviews.rating-average).toFixed(1)}</span>}
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs">
                <thead><tr className="border-b border-[#E5E7EB] text-[#6B7280]">{['Business','Distance','Rating','Reviews'].map(h=><th key={h} scope="col" className="pb-3 pr-4 font-medium">{h}</th>)}</tr></thead>
                <tbody>{competitors.map(c=><tr key={c.place_id} className="border-b border-[#F3F4F6] last:border-0">
                  <td className="py-3 pr-4"><a href={safeUrl(c.maps_url)} target="_blank" rel="noreferrer" className="font-medium text-[#374151] hover:text-[#6C55E8]">{c.name}</a>
                    <p className="mt-1 max-w-sm text-[11px] text-[#9CA3AF]">{c.address}</p>
                    {c.attributions.map((a,i)=><a key={i} href={safeUrl(a.providerUri)} target="_blank" rel="noreferrer" className="mr-2 text-[10px] text-[#6B7280]">{a.provider}</a>)}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{c.distance_km.toFixed(1)} km</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{c.rating?.toFixed(1) ?? '—'}</td>
                  <td className="py-3 font-mono tabular-nums">{number(c.review_count)}</td>
                </tr>)}</tbody></table></div>
            </>}
          <div className="mt-4 border-t border-[#F3F4F6] pt-4"><GoogleAttribution /></div>
        </Section>
        <Section title="Local search opportunities" description="What the available data can tell you">
          <div className="grid gap-5 md:grid-cols-3">
            <div><h3 className="text-xs font-semibold text-[#374151]">Relevance</h3><p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
              {profile?.category ? 'Your primary category is '+profile.category+'. Review actual discovery terms above and keep your category, services and business information accurate.' :
              'Fetch or set an accurate primary category before comparing similar businesses.'}</p></div>
            <div><h3 className="text-xs font-semibold text-[#374151]">Distance</h3><p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
              Compare nearby businesses at 5, 10, 20 or 30 km. Google does not return radius-based public search volumes through these profile and Places endpoints.</p></div>
            <div><h3 className="text-xs font-semibold text-[#374151]">Prominence</h3><p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
              {average==null ? 'A competitor sample is needed to benchmark ratings and review counts.' :
              'The returned competitor sample averages '+average.toFixed(1)+' stars and '+number(reviewAverage)+' reviews. Build authentic customer feedback and answer outstanding reviews.'}</p></div>
          </div>
        </Section>
      </>}
    </>}
  </div>;
}
