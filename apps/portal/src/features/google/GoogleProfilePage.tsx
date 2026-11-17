import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLocationStore } from '@/features/location/location.store';
import { supabase } from '@/lib/supabase';
import { googleService, type GoogleConnection, type GoogleLocation, type QAQuestion } from './google.service';
import { analysisMessage, fetchProfileAnalysis, type ProfileAnalysis } from './profile-analysis.service';
import { DateRangePicker } from '@/components/DateRangePicker';

const RADII=[5,10,20,30] as const;
const REFRESH_MS=15*60*1000;
const panel='rounded-xl border border-[#E5E7EB] bg-white';

function today():string { return new Date().toISOString().slice(0,10); }
function fmtMonth(iso:string):string { const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}); }
void today; void fmtMonth;

interface ReviewRow { rating:number|null; published_at:string|null; reply_text:string|null; }
interface MonthBucket { month:string; count:number; replied:number; }
interface RatingBucket { rating:number; count:number; }

function buildMonthBuckets(rows:ReviewRow[]):MonthBucket[]{
  const map:Record<string,{count:number;replied:number}>={};
  rows.forEach(r=>{
    if(!r.published_at) return;
    const key=r.published_at.slice(0,7);
    if(!map[key]) map[key]={count:0,replied:0};
    map[key]!.count++;
    if(r.reply_text) map[key]!.replied++;
  });
  return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([month,v])=>({month,...v}));
}
function buildRatingBuckets(rows:ReviewRow[]):RatingBucket[]{
  const counts:Record<number,number>={1:0,2:0,3:0,4:0,5:0};
  rows.forEach(r=>{if(r.rating!=null&&r.rating>=1&&r.rating<=5)counts[r.rating]!++;});
  return [5,4,3,2,1].map(rating=>({rating,count:counts[rating]!}));
}

interface InsightMetric{date:string;views_search:number;views_maps:number;calls:number;website_clicks:number;direction_requests:number;}
interface InsightTotals{views_search:number;views_maps:number;calls:number;website_clicks:number;direction_requests:number;total_views:number;}

function safeUrl(value:string|null|undefined):string|undefined{
  try{const url=new URL(value??'');return['https:','http:'].includes(url.protocol)?url.href:undefined;}
  catch{return undefined;}
}

function number(n:number|null|undefined){return n==null?'—':n.toLocaleString();}

// ── Icons ───────────────────────────────────────────────────────────
const IconShield=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconStar=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const IconCheck=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconPin=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconX=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconPlus=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconChevron=({open}:{open:boolean})=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${open?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>;
const IconImage=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconEdit=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconQuestion=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconSearch=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconSend=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;

// ── Layout helpers ───────────────────────────────────────────────────
function Section({title,description,action,children,className='',collapsible=false}:{title:string;description?:string;action?:ReactNode;children:ReactNode;className?:string;collapsible?:boolean}){
  const [open,setOpen]=useState(true);
  return <section className={`${panel} ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F3F4F6] p-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          {collapsible && <button type="button" onClick={()=>setOpen(v=>!v)} className="text-[#9CA3AF] hover:text-[#6B7280]"><IconChevron open={open}/></button>}
        </div>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6B7280]">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
    {open && <div className="p-5">{children}</div>}
  </section>;
}
function Empty({children}:{children:ReactNode}){return <p className="py-5 text-sm leading-relaxed text-[#6B7280]">{children}</p>;}
function Metric({label,value,detail,icon}:{label:string;value:ReactNode;detail?:string;icon?:ReactNode}){
  return <div className={panel+' p-4'}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs leading-relaxed text-[#6B7280]">{label}</p>
      {icon && <span className="flex-shrink-0 text-[#6C55E8] opacity-60">{icon}</span>}
    </div>
    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#111827]">{value}</p>
    {detail && <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">{detail}</p>}
  </div>;
}
function StatusDot({status}:{status:string}){
  const cls=status==='pass'?'bg-emerald-500':status==='action'?'bg-amber-400':'bg-[#D1D5DB]';
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cls} mt-1`}/>;
}

// ── Profile Strength Ring ────────────────────────────────────────────
function StrengthRing({score}:{score:number}){
  const r=22; const c=2*Math.PI*r;
  const fill=Math.min(100,Math.max(0,score));
  const dash=(fill/100)*c;
  const color=fill>=80?'#22C55E':fill>=60?'#6C55E8':fill>=40?'#F59E0B':'#EF4444';
  return <div className="flex flex-col items-center gap-1">
    <svg width="64" height="64" viewBox="0 0 64 64" aria-label={`Profile strength: ${fill}%`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#F3F4F6" strokeWidth="6"/>
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        style={{transformOrigin:'center',transform:'rotate(-90deg)'}} />
      <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="600" fill={color}>{fill}%</text>
    </svg>
    <span className="text-[10px] font-medium text-[#6B7280]">Strength</span>
  </div>;
}

// ── Add Post Modal ───────────────────────────────────────────────────
interface PostForm{type:'STANDARD'|'EVENT'|'OFFER';text:string;ctaType:string;ctaUrl:string;eventTitle:string;eventStart:string;eventEnd:string;}
const POST_TYPES=[{id:'STANDARD',label:"What's New"},{id:'EVENT',label:'Event'},{id:'OFFER',label:'Offer'}] as const;
const CTA_TYPES=[{id:'',label:'No CTA'},{id:'LEARN_MORE',label:'Learn more'},{id:'BOOK',label:'Book'},{id:'ORDER',label:'Order online'},{id:'SHOP',label:'Shop'},{id:'SIGN_UP',label:'Sign up'},{id:'CALL',label:'Call now'}];

function AddPostModal({locationId,onClose,onPosted}:{locationId:string;onClose:()=>void;onPosted:()=>void}){
  const [form,setForm]=useState<PostForm>({type:'STANDARD',text:'',ctaType:'',ctaUrl:'',eventTitle:'',eventStart:'',eventEnd:''});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const up=(k:keyof PostForm,v:string)=>setForm(f=>({...f,[k]:v}));
  async function submit(){
    if(!form.text.trim()){setErr('Post text is required.');return;}
    setSaving(true);setErr('');
    const payload:Parameters<typeof googleService.createGooglePost>[1]={summary:form.text,topic_type:form.type};
    if(form.ctaType){payload.cta_type=form.ctaType;}
    if(form.ctaUrl){payload.cta_url=form.ctaUrl;}
    if(form.eventTitle){payload.event_title=form.eventTitle;}
    if(form.eventStart){payload.event_start_date=form.eventStart;}
    if(form.eventEnd){payload.event_end_date=form.eventEnd;}
    const r=await googleService.createGooglePost(locationId,payload);
    setSaving(false);
    if(r.error){setErr(r.error);return;}
    onPosted();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Create a Google Post</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[#F3F4F6]"><IconX/></button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
        <div className="flex gap-2">
          {POST_TYPES.map(t=><button key={t.id} type="button" onClick={()=>up('type',t.id)}
            className={`flex-1 rounded-lg border py-2 text-xs font-medium ${form.type===t.id?'border-[#6C55E8] bg-[#F5F3FF] text-[#6C55E8]':'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'}`}>
            {t.label}</button>)}
        </div>
        <textarea value={form.text} onChange={e=>up('text',e.target.value)} maxLength={1500}
          rows={5} placeholder="Write something about your business..."
          className="w-full rounded-xl border border-[#E5E7EB] p-3 text-sm resize-none focus:border-[#6C55E8] focus:outline-none"/>
        <div className="text-right text-[10px] text-[#9CA3AF]">{form.text.length}/1500</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[#6B7280]">Call to action</label>
            <select value={form.ctaType} onChange={e=>up('ctaType',e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none">
              {CTA_TYPES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {form.ctaType && <div>
            <label className="mb-1 block text-xs text-[#6B7280]">CTA URL</label>
            <input value={form.ctaUrl} onChange={e=>up('ctaUrl',e.target.value)} placeholder="https://"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
          </div>}
        </div>
        {form.type==='EVENT' && <><input value={form.eventTitle} onChange={e=>up('eventTitle',e.target.value)} placeholder="Event title"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.eventStart} onChange={e=>up('eventStart',e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
            <input type="date" value={form.eventEnd} onChange={e=>up('eventEnd',e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
          </div></>}
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
      <div className="border-t border-[#E5E7EB] p-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB]">Cancel</button>
        <button type="button" onClick={submit} disabled={saving}
          className="rounded-lg bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
          {saving?'Publishing…':'Publish post'}</button>
      </div>
    </div>
  </div>;
}

// ── Q&A Manager ──────────────────────────────────────────────────────
function QAManager({locationId}:{locationId:string}){
  const [questions,setQuestions]=useState<QAQuestion[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [replies,setReplies]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState<Record<string,boolean>>({});
  const [saved,setSaved]=useState<Record<string,boolean>>({});

  useEffect(()=>{
    let alive=true;
    setLoading(true);setErr('');
    googleService.listQAs(locationId).then(r=>{
      if(!alive) return;
      if(r.error){setErr(r.error);}
      else{setQuestions(r.questions??[]);}
      setLoading(false);
    });
    return ()=>{alive=false;};
  },[locationId]);

  async function sendReply(q:QAQuestion){
    const text=replies[q.name]??'';
    if(!text.trim()) return;
    setSaving(s=>({...s,[q.name]:true}));
    const r=await googleService.replyQA(locationId,q.name,text);
    setSaving(s=>({...s,[q.name]:false}));
    if(!r.error){setSaved(s=>({...s,[q.name]:true}));setReplies(r=>({...r,[q.name]:''}))}
    else setErr(r.error);
  }

  if(loading) return <div className="h-24 animate-pulse rounded-xl bg-[#F3F4F6]"/>;
  if(err) return <p className="text-xs text-red-600">{err}</p>;
  if(!questions?.length) return <Empty>No questions found on your business profile.</Empty>;
  return <div className="space-y-4">
    {questions.map(q=><div key={q.name} className="rounded-xl border border-[#E5E7EB] p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0 rounded-full bg-[#F5F3FF] p-1 text-[#6C55E8]"><IconQuestion/></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#111827]">{q.text}</p>
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{q.author?.displayName ?? 'Anonymous'}</p>
        </div>
      </div>
      {q.topAnswers && q.topAnswers.length>0 && <div className="mt-3 ml-7 rounded-lg bg-[#F9FAFB] p-3">
        <p className="text-xs font-medium text-[#374151]">Current answer</p>
        <p className="mt-1 text-xs text-[#6B7280]">{q.topAnswers[0]?.text}</p>
      </div>}
      {saved[q.name] ? <p className="mt-3 ml-7 text-xs text-emerald-600 flex items-center gap-1"><IconCheck/>Reply published</p>
        : <div className="mt-3 ml-7 flex gap-2">
        <input value={replies[q.name]??''} onChange={e=>setReplies(r=>({...r,[q.name]:e.target.value}))}
          placeholder="Write your reply…"
          className="flex-1 min-w-0 rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
        <button type="button" disabled={saving[q.name]} onClick={()=>sendReply(q)}
          className="flex items-center gap-1 rounded-xl bg-[#6C55E8] px-3 py-2 text-xs font-medium text-white hover:bg-[#5A42D1] disabled:opacity-50">
          <IconSend/>{saving[q.name]?'Sending…':'Reply'}</button>
      </div>}
    </div>)}
  </div>;
}

// ── Business Info Editor ─────────────────────────────────────────────
function BusinessInfoEditor({locationId,initialDescription,initialWebsite,initialPhone}:{locationId:string;initialDescription?:string|null;initialWebsite?:string|null;initialPhone?:string|null}){
  const [desc,setDesc]=useState(initialDescription??'');
  const [web,setWeb]=useState(initialWebsite??'');
  const [phone,setPhone]=useState(initialPhone??'');
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');
  async function save(){
    setSaving(true);setMsg('');
    const fields:Parameters<typeof googleService.updateProfile>[1]={};
    if(desc) fields.description=desc;
    if(web) fields.websiteUri=web;
    if(phone) fields.primaryPhone=phone;
    const r=await googleService.updateProfile(locationId,fields);
    setSaving(false);
    setMsg(r.error??'Profile updated successfully.');
  }
  return <div className="space-y-4">
    <div>
      <label className="mb-1 block text-xs font-medium text-[#374151]">Business description</label>
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} maxLength={750}
        className="w-full rounded-xl border border-[#E5E7EB] p-3 text-sm resize-none focus:border-[#6C55E8] focus:outline-none"/>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Website URL</label>
        <input value={web} onChange={e=>setWeb(e.target.value)} placeholder="https://example.com"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#6C55E8] focus:outline-none"/>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Phone number</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555-000-0000"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#6C55E8] focus:outline-none"/>
      </div>
    </div>
    {msg && <p className={`text-xs ${msg.includes('successfully')?'text-emerald-600':'text-red-600'}`}>{msg}</p>}
    <button type="button" onClick={save} disabled={saving}
      className="rounded-lg bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
      {saving?'Saving…':'Save changes'}</button>
  </div>;
}

// ── Photo Manager with AI Gen + Canvas ──────────────────────────────
function PhotoManager({locationId,businessName}:{locationId:string;businessName:string}){
  const [businessType,setBusinessType]=useState('');
  const [postType,setPostType]=useState('STANDARD');
  const [description,setDescription]=useState('');
  const [style,setStyle]=useState('professional');
  const [generating,setGenerating]=useState(false);
  const [genErr,setGenErr]=useState('');
  const [genImage,setGenImage]=useState<string|null>(null);
  const [genMime,setGenMime]=useState('image/png');
  const [overlayText,setOverlayText]=useState('');
  const [uploading,setUploading]=useState(false);
  const [uploadMsg,setUploadMsg]=useState('');
  const canvasRef=useRef<HTMLCanvasElement>(null);

  async function generate(){
    setGenerating(true);setGenErr('');setGenImage(null);
    const r=await googleService.generateImage({businessType:businessType||businessName,postType,description,style});
    setGenerating(false);
    if(r.error){setGenErr(r.error);return;}
    setGenImage(r.imageBase64??null);
    setGenMime(r.mimeType??'image/png');
  }

  useEffect(()=>{
    if(!genImage||!canvasRef.current) return;
    const canvas=canvasRef.current;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    const img=new Image();
    img.onload=()=>{
      canvas.width=img.width; canvas.height=img.height;
      ctx.drawImage(img,0,0);
      if(overlayText){
        ctx.font=`bold ${Math.round(img.width/15)}px sans-serif`;
        ctx.fillStyle='rgba(0,0,0,0.5)';
        ctx.fillRect(0,img.height-Math.round(img.width/8),img.width,Math.round(img.width/8));
        ctx.fillStyle='#ffffff';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(overlayText,img.width/2,img.height-Math.round(img.width/16));
      }
    };
    img.src=`data:${genMime};base64,${genImage}`;
  },[genImage,genMime,overlayText]);

  async function uploadPhoto(){
    if(!genImage||!canvasRef.current) return;
    setUploading(true);setUploadMsg('');
    const dataUrl=canvasRef.current.toDataURL(genMime);
    const base64=dataUrl.split(',')[1]??'';
    const r=await googleService.uploadPhoto(locationId,base64,genMime);
    setUploading(false);
    setUploadMsg(r.error??'Photo uploaded to Google Business Profile.');
  }

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Business type</label>
        <input value={businessType} onChange={e=>setBusinessType(e.target.value)} placeholder={businessName}
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Post context</label>
        <select value={postType} onChange={e=>setPostType(e.target.value)}
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none">
          <option value="STANDARD">What's New</option>
          <option value="EVENT">Event</option>
          <option value="OFFER">Offer/Promotion</option>
        </select>
      </div>
    </div>
    <div>
      <label className="mb-1 block text-xs font-medium text-[#374151]">Scene / content description</label>
      <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. staff serving customers, interior of restaurant…"
        className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
    </div>
    <div className="flex gap-2">
      {(['professional','vibrant','minimal','warm'] as const).map(s=><button key={s} type="button" onClick={()=>setStyle(s)}
        className={`flex-1 rounded-lg border py-2 text-xs capitalize ${style===s?'border-[#6C55E8] bg-[#F5F3FF] text-[#6C55E8]':'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'}`}>{s}</button>)}
    </div>
    <button type="button" onClick={generate} disabled={generating}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C55E8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
      <IconImage/>{generating?'Generating…':'Generate image with AI'}</button>
    {genErr && <p className="text-xs text-red-600">{genErr}</p>}
    {genImage && <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full rounded-xl border border-[#E5E7EB]" style={{maxHeight:'360px',objectFit:'contain'}}/>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151]">Text overlay (optional)</label>
        <input value={overlayText} onChange={e=>setOverlayText(e.target.value)} placeholder="e.g. Grand Opening 20% Off"
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs focus:border-[#6C55E8] focus:outline-none"/>
      </div>
      {uploadMsg && <p className={`text-xs ${uploadMsg.includes('uploaded')?'text-emerald-600':'text-red-600'}`}>{uploadMsg}</p>}
      <button type="button" onClick={uploadPhoto} disabled={uploading}
        className="rounded-lg bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
        {uploading?'Uploading…':'Upload to Google Business Profile'}</button>
    </div>}
  </div>;
}

// ── Business Attributes Toggle ───────────────────────────────────────
const ATTRIBUTE_GROUPS=[
  {group:'Accessibility',attrs:[{id:'wheelchair_accessible_entrance',label:'Wheelchair accessible entrance'},{id:'wheelchair_accessible_parking',label:'Wheelchair accessible parking'},{id:'wheelchair_accessible_restroom',label:'Wheelchair accessible restroom'}]},
  {group:'Amenities',attrs:[{id:'wifi',label:'Free Wi-Fi'},{id:'outdoor_seating',label:'Outdoor seating'},{id:'restroom',label:'Restroom'},{id:'parking',label:'Free parking'}]},
  {group:'Payment',attrs:[{id:'credit_card',label:'Credit cards'},{id:'mobile_pay',label:'Mobile pay'},{id:'cash_only',label:'Cash only'}]},
];
function AttributesManager({locationId}:{locationId:string}){
  const [toggles,setToggles]=useState<Record<string,boolean>>({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');
  async function save(){
    setSaving(true);setMsg('');
    const attrs=Object.entries(toggles).filter(([,v])=>v).map(([id])=>({attributeId:id,uriValues:[{uri:''}],valueType:'BOOL',boolValues:[true]}));
    const r=await googleService.updateProfile(locationId,{attributes:attrs});
    setSaving(false);
    setMsg(r.error??'Attributes updated.');
  }
  return <div className="space-y-5">
    {ATTRIBUTE_GROUPS.map(g=><div key={g.group}>
      <p className="mb-2 text-xs font-semibold text-[#374151]">{g.group}</p>
      <div className="space-y-2">{g.attrs.map(a=><label key={a.id} className="flex cursor-pointer items-center gap-3">
        <div className="relative flex-shrink-0">
          <input type="checkbox" className="sr-only" checked={!!toggles[a.id]} onChange={e=>setToggles(t=>({...t,[a.id]:e.target.checked}))}/>
          <div className={`h-5 w-9 rounded-full transition-colors ${toggles[a.id]?'bg-[#6C55E8]':'bg-[#D1D5DB]'}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${toggles[a.id]?'translate-x-4':'translate-x-0.5'}`}/>
          </div>
        </div>
        <span className="text-xs text-[#374151]">{a.label}</span>
      </label>)}</div>
    </div>)}
    {msg && <p className={`text-xs ${msg.includes('updated')?'text-emerald-600':'text-red-600'}`}>{msg}</p>}
    <button type="button" onClick={save} disabled={saving}
      className="rounded-lg bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
      {saving?'Saving…':'Save attributes'}</button>
  </div>;
}

// ── Keyword Opportunity Tracker ──────────────────────────────────────
function KeywordTracker({metrics}:{metrics:InsightMetric[]}){
  if(!metrics.length) return <Empty>No insight data available. Check your Google connection and sync.</Empty>;
  const months=metrics.reduce<Record<string,{search:number;maps:number}>>((acc,m)=>{
    const key=m.date.slice(0,7);
    if(!acc[key]) acc[key]={search:0,maps:0};
    acc[key]!.search+=m.views_search;
    acc[key]!.maps+=m.views_maps;
    return acc;
  },{});
  const data=Object.entries(months).sort(([a],[b])=>a.localeCompare(b)).slice(-6);
  const max=Math.max(...data.map(([,v])=>v.search+v.maps),1);
  return <div>
    <div className="mb-3 flex items-center gap-4 text-[11px] text-[#6B7280]">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-[#6C55E8]"/>Search</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-[#C4B8F7]"/>Maps</span>
    </div>
    <div className="flex items-end gap-2" style={{height:'80px'}}>
      {data.map(([month,v])=>{
        const total=v.search+v.maps;
        const totalH=Math.max((total/max)*72,4);
        const searchH=total?Math.round(totalH*(v.search/total)):0;
        const mapsH=Math.round(totalH*(1-(v.search/total||0)));
        return <div key={month} className="flex-1 flex flex-col justify-end group relative" title={`${month}: ${total.toLocaleString()} impressions`}>
          <div className="w-full bg-[#C4B8F7] rounded-t-sm" style={{height:`${mapsH}px`}}/>
          <div className="w-full bg-[#6C55E8]" style={{height:`${searchH}px`}}/>
          <p className="mt-1 text-[10px] text-center text-[#9CA3AF]">{fmtMonth(month+'-01')}</p>
        </div>;
      })}
    </div>
    <div className="mt-4 grid grid-cols-3 gap-3">
      {data.slice(-3).map(([month,v])=>{
        const prev=data[data.findIndex(([m])=>m===month)-1];
        const prevTotal=prev?prev[1].search+prev[1].maps:null;
        const total=v.search+v.maps;
        const diff=prevTotal!=null?total-prevTotal:null;
        return <div key={month} className="rounded-xl bg-[#F9FAFB] p-3">
          <p className="text-[11px] text-[#6B7280]">{fmtMonth(month+'-01')}</p>
          <p className="mt-1 font-mono text-sm font-semibold text-[#111827]">{total.toLocaleString()}</p>
          {diff!=null && <p className={`text-[10px] ${diff>=0?'text-emerald-600':'text-red-500'}`}>{diff>=0?'+':''}{diff.toLocaleString()}</p>}
        </div>;
      })}
    </div>
  </div>;
}

// ── Profile Strength Advisor ─────────────────────────────────────────
function StrengthAdvisor({analysis}:{analysis:ProfileAnalysis}){
  const score=analysis.readiness?.score??0;
  const checks=[
    {label:'Business description',pass:!!analysis.profile?.description},
    {label:'Website linked',pass:!!analysis.profile?.website},
    {label:'Phone number',pass:!!analysis.profile?.phone},
    {label:'Business hours',pass:!!analysis.profile?.has_hours},
    {label:'Primary category',pass:!!analysis.profile?.category},
    {label:'Reviews with replies',pass:(analysis.reviews?.replied??0)>0},
    {label:'Google data connected',pass:analysis.profile?.source==='google_business_profile'},
  ];
  return <div className="space-y-4">
    <div className="flex items-center gap-6">
      <StrengthRing score={score}/>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#111827]">{score>=80?'Excellent profile':'Needs improvement'}</p>
        <p className="mt-1 text-xs text-[#6B7280]">{score>=80?'Your profile is well-optimized for discovery.':'Complete the checklist below to improve visibility.'}</p>
      </div>
    </div>
    <div className="space-y-2">
      {checks.map(c=><div key={c.label} className="flex items-center gap-2">
        <span className={`flex-shrink-0 ${c.pass?'text-emerald-500':'text-[#D1D5DB]'}`}>
          {c.pass ? <IconCheck/> : <span className="inline-block h-4 w-4 rounded-full border-2 border-current"/>}
        </span>
        <span className={`text-xs ${c.pass?'text-[#374151]':'text-[#9CA3AF]'}`}>{c.label}</span>
      </div>)}
    </div>
  </div>;
}

// ── Main page ────────────────────────────────────────────────────────
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

  const [globalFrom,setGlobalFrom]=useState('');
  const [globalTo,setGlobalTo]=useState('');

  const [reviewRows,setReviewRows]=useState<ReviewRow[]|null>(null);
  const [reviewLoading,setReviewLoading]=useState(false);

  const [insightMetrics,setInsightMetrics]=useState<InsightMetric[]|null>(null);
  const [insightTotals,setInsightTotals]=useState<InsightTotals|null>(null);
  const [insightLoading,setInsightLoading]=useState(false);
  const [insightError,setInsightError]=useState('');

  // Extra data (posts, photos summary)
  const [recentPosts,setRecentPosts]=useState<Array<{name:string;summary:string|null;post_type:string|null;state:string|null;created_at:string|null;cta_type:string|null;views:number|null;clicks:number|null}>|null>(null);
  const [extraLoading,setExtraLoading]=useState(false);

  // Add Post modal
  const [showPostModal,setShowPostModal]=useState(false);

  // Active advanced panel
  const [activePanel,setActivePanel]=useState<'none'|'qa'|'info'|'photos'|'attrs'|'keywords'|'strength'>('none');

  // Profile Doctor collapsed
  const [doctorOpen,setDoctorOpen]=useState(false);

  useEffect(()=>{
    let active=true;
    setInitialLoading(true);setInitialError('');
    Promise.all([googleService.getConnection(),googleService.getLocations()]).then(([conn,locs])=>{
      if(!active) return;
      if(conn.error||locs.error) throw new Error(conn.error||locs.error);
      setConnection(conn.data??null);
      const available=(locs.data??[]).filter(l=>l.is_selected);
      setLocations(available);
      setLocalId(current=>available.some(l=>l.id===current)?current:available[0]?.id??null);
    }).catch(e=>{if(active) setInitialError(e instanceof Error?e.message:'Unable to load your locations.');})
      .finally(()=>{if(active) setInitialLoading(false);});
    return ()=>{active=false;};
  },[initRevision]);

  const locationId=globalLocationId??localId;
  const selected=locations.find(l=>l.id===locationId);

  useEffect(()=>{
    const close=(e:MouseEvent)=>{if(!selectorRef.current?.contains(e.target as Node)) setMenuOpen(false);};
    document.addEventListener('mousedown',close);
    return ()=>document.removeEventListener('mousedown',close);
  },[]);

  useEffect(()=>{
    if(!selected||!connection){setAnalysis(null);setError('');setLoading(false);return;}
    const controller=new AbortController();
    setAnalysis(null);setError('');setLoading(true);
    fetchProfileAnalysis(selected.id,radius,controller.signal).then(data=>{
      if(!controller.signal.aborted) setAnalysis(data);
    }).catch(e=>{
      if(!controller.signal.aborted) setError(e instanceof Error?e.message:'Unable to load analysis.');
    }).finally(()=>{if(!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[selected?.id,connection?.id,radius,revision]);

  useEffect(()=>{
    const timer=setInterval(()=>{if(document.visibilityState==='visible') setRevision(n=>n+1);},REFRESH_MS);
    return ()=>clearInterval(timer);
  },[selected?.id,radius]);

  useEffect(()=>{
    if(!selected){setReviewRows(null);return;}
    let alive=true;
    setReviewLoading(true);setReviewRows(null);
    (async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user||!alive) return;
      let q=supabase.from('reviews').select('rating, published_at, reply_text')
        .eq('user_id',user.id).eq('location_id',selected.id);
      if(globalFrom) q=q.gte('published_at',globalFrom+'T00:00:00Z');
      if(globalTo)   q=q.lte('published_at',globalTo+'T23:59:59Z');
      const{data}=await q.order('published_at',{ascending:true});
      if(alive){setReviewRows((data??[]) as ReviewRow[]);setReviewLoading(false);}
    })();
    return ()=>{alive=false;};
  },[selected?.id,globalFrom,globalTo]);

  useEffect(()=>{
    if(!selected||!connection){setInsightMetrics(null);setInsightTotals(null);return;}
    let alive=true;
    setInsightLoading(true);setInsightError('');
    googleService.fetchInsights(selected.id,globalFrom,globalTo).then(r=>{
      if(!alive) return;
      if(r.error){setInsightError(r.error);}
      else{setInsightMetrics(r.data?.metrics??[]);setInsightTotals(r.data?.totals??null);}
      setInsightLoading(false);
    });
    return ()=>{alive=false;};
  },[selected?.id,connection?.id,globalFrom,globalTo]);

  useEffect(()=>{
    if(!selected||!connection){setRecentPosts(null);return;}
    let alive=true;
    setExtraLoading(true);
    googleService.fetchExtraData(selected.id).then(r=>{
      if(!alive) return;
      setRecentPosts(r.data?.posts??null);
      setExtraLoading(false);
    });
    return ()=>{alive=false;};
  },[selected?.id,connection?.id,revision]);

  void insightLoading; void insightTotals;

  const togglePanel=useCallback((panel:typeof activePanel)=>{
    setActivePanel(p=>p===panel?'none':panel);
  },[]);

  if(initialLoading) return <div className="space-y-4 p-6" role="status">
    {[0,1,2].map(n=><div key={n} className="h-24 animate-pulse rounded-xl bg-[#F3F4F6] motion-reduce:animate-none"/>)}
  </div>;
  if(initialError) return <div className="p-6"><div role="alert" className={panel+' p-5'}>
    <p className="text-sm text-red-700">{initialError}</p>
    <button className="mt-3 text-sm font-medium text-[#6C55E8]" onClick={()=>setInitRevision(n=>n+1)}>Retry</button>
  </div></div>;
  if(!connection) return <div className="p-6"><Section title="Google Business Profile">
    <Empty>Connect your Google account to analyze your business.</Empty>
    <Link to="/settings" className="text-sm font-medium text-[#6C55E8]">Open Settings</Link>
  </Section></div>;

  const current=analysis?.location_id===locationId&&analysis.nearby.radius_km===radius?analysis:null;
  const profile=current?.profile;
  const reviews=current?.reviews;
  const readiness=current?.readiness;
  const competitors=current?.nearby.items.filter(c=>!c.is_you)??[];
  const rated=competitors.filter(c=>c.rating!==null);
  const average=rated.length?rated.reduce((s,c)=>s+c.rating!,0)/rated.length:null;
  const reviewAverage=competitors.length?Math.round(competitors.reduce((s,c)=>s+c.review_count,0)/competitors.length):null;
  const warnings=(section:string)=>[...new Set(current?.warnings.filter(w=>w.section===section).map(w=>analysisMessage(w.code))??[])];
  const warningText=(section:string)=>warnings(section).join(' ')||'Google has not returned data for this section.';

  const advancedBtns=[
    {id:'qa' as const,label:'Q&A Manager',icon:<IconQuestion/>},
    {id:'info' as const,label:'Edit Info',icon:<IconEdit/>},
    {id:'photos' as const,label:'Photo AI',icon:<IconImage/>},
    {id:'attrs' as const,label:'Attributes',icon:<IconCheck/>},
    {id:'keywords' as const,label:'Keyword Trends',icon:<IconSearch/>},
    {id:'strength' as const,label:'Strength Advisor',icon:<IconShield/>},
  ];

  return <div className="w-full space-y-6 p-4 sm:p-6">

    {/* ── Profile Header ──────────────────────────────────────────────── */}
    <div className={`${panel} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#6C55E8] to-[#9B88F0] flex items-center justify-center text-white text-2xl font-bold shadow-sm">
              {(selected?.display_name??'?')[0]?.toUpperCase()}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#111827]">{selected?.display_name??'Select a location'}</h1>
              {profile?.source==='google_business_profile' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#6C55E8]">
                  <IconCheck/>Verified
                </span>
              )}
            </div>
            {selected?.address && <p className="mt-0.5 text-xs text-[#6B7280] flex items-center gap-1"><IconPin/>{selected.address}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
              {reviews?.google_review_count!=null && <span>{number(reviews.google_review_count)} reviews</span>}
              {reviews?.rating!=null && <span className="flex items-center gap-1 text-amber-500"><IconStar/>{reviews.rating.toFixed(1)}</span>}
              {profile?.category && <span className="text-[#9CA3AF]">{profile.category}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readiness && <StrengthRing score={readiness.score??0}/>}
          <div className="flex flex-col gap-2">
            <DateRangePicker from={globalFrom} to={globalTo} onChange={(f,t)=>{setGlobalFrom(f);setGlobalTo(t);}} alignRight/>
            <div className="flex gap-2">
              {!globalLocationId && locations.length>0 && <div ref={selectorRef} className="relative">
                <button type="button" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium hover:bg-[#F9FAFB]">
                  <span className="max-w-[160px] truncate">{selected?.display_name??'Choose location'}</span>
                  <IconChevron open={menuOpen}/>
                </button>
                {menuOpen && <div className="absolute right-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-sm">
                  {locations.map(l=><button key={l.id} type="button" onClick={()=>{setLocalId(l.id);setMenuOpen(false);}}
                    className={'block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[#F9FAFB] '+(l.id===locationId?'bg-[#F5F3FF] text-[#6C55E8]':'text-[#374151]')}>
                    {l.display_name??'Unnamed'}{l.address && <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">{l.address}</span>}
                  </button>)}
                </div>}
              </div>}
              <button type="button" disabled={loading||!selected} onClick={()=>setRevision(n=>n+1)}
                className="rounded-xl bg-[#6C55E8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1] disabled:opacity-50">
                {loading?'Analyzing…':'Refresh'}
              </button>
              {selected && <button type="button" onClick={()=>setShowPostModal(true)}
                className="flex items-center gap-1 rounded-xl border border-[#6C55E8] px-3 py-2 text-xs font-semibold text-[#6C55E8] hover:bg-[#F5F3FF]">
                <IconPlus/>Post
              </button>}
            </div>
          </div>
        </div>
      </div>
    </div>

    {!selected && <Section title="Choose a location">
      <Empty>{globalLocationId?'The selected location is not available.':'Select a business location in Settings.'}</Empty>
      <Link to="/settings" className="text-sm text-[#6C55E8]">Manage Google locations</Link>
    </Section>}

    {selected && <>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* ── Advanced feature toolbar ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {advancedBtns.map(b=><button key={b.id} type="button" onClick={()=>togglePanel(b.id)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${activePanel===b.id?'border-[#6C55E8] bg-[#F5F3FF] text-[#6C55E8]':'border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]'}`}>
          {b.icon}{b.label}
        </button>)}
      </div>

      {/* ── Active advanced panel ────────────────────────────────────── */}
      {activePanel==='qa' && <Section title="Q&A Manager" description="View customer questions and publish answers directly from Moffu.">
        <QAManager locationId={selected.id}/>
      </Section>}
      {activePanel==='info' && <Section title="Edit Business Info" description="Update your description, website and phone on Google Business Profile.">
        <BusinessInfoEditor locationId={selected.id} {...(profile?.description!=null?{initialDescription:profile.description}:{})} {...(profile?.website!=null?{initialWebsite:profile.website}:{})} {...(profile?.phone!=null?{initialPhone:profile.phone}:{})}/>
      </Section>}
      {activePanel==='photos' && <Section title="Photo Manager" description="Generate a professional image with AI, add text overlay, and upload to Google.">
        <PhotoManager locationId={selected.id} businessName={selected.display_name??''}/>
      </Section>}
      {activePanel==='attrs' && <Section title="Business Attributes" description="Toggle accessibility, amenity and payment attributes on your profile.">
        <AttributesManager locationId={selected.id}/>
      </Section>}
      {activePanel==='keywords' && <Section title="Keyword Opportunity Tracker" description="Monthly impression trends from Search and Maps.">
        <KeywordTracker metrics={insightMetrics??[]}/>
      </Section>}
      {activePanel==='strength' && current && <Section title="Profile Strength Advisor">
        <StrengthAdvisor analysis={current}/>
      </Section>}

      {loading && <div role="status" aria-live="polite" className="space-y-4">
        <p className="text-xs text-[#6B7280]">Fetching profile data…</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0,1,2,3].map(n=><div key={n} className="h-24 animate-pulse rounded-xl bg-[#F3F4F6]"/>)}</div>
      </div>}

      {current && <>
        {current.warnings.length>0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="status">
          Some Google data is unavailable. Each section below shows what could be loaded.
        </div>}

        {/* ── KPI row (5 col: 4 metrics + Search/Maps mini) ─────────── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Metric label="Moffu SEO readiness" value={readiness?.score==null?'—':readiness.score+'/100'}
            detail={'Coverage: '+(readiness?.coverage??'—')+' assessed'} icon={<IconShield/>}/>
          <Metric label="Google rating" value={reviews?.rating?.toFixed(1)?? '—'}
            detail={reviews?.google_review_count==null?'Google Places unavailable':number(reviews.google_review_count)+' reviews'} icon={<IconStar/>}/>
          <Metric label="Replies answered" value={reviews?.total?Math.round(reviews.replied/reviews.total*100)+'%':'—'}
            detail={number(reviews?.replied)+' of '+number(reviews?.total)+' synced'} icon={<IconCheck/>}/>
          <Metric label={'Nearby avg · '+radius+' km'} value={average?.toFixed(1)?? '—'}
            detail={rated.length+' rated nearby'} icon={<IconPin/>}/>
          {/* Search & Maps mini card */}
          <div className={panel+' p-4 flex flex-col gap-2'}>
            <p className="text-xs text-[#6B7280] font-medium">Search and Maps</p>
            {(()=>{
              const p=analysis?.performance;
              const stats:[string,number|null|undefined][]=[
                ['Search',p?.search_views],['Maps',p?.maps_views],['Calls',p?.calls],['Clicks',p?.website_clicks],
              ];
              return <div className="grid grid-cols-2 gap-1.5">{stats.map(([l,v])=><div key={l} className="rounded-lg bg-[#F9FAFB] p-2">
                <p className="text-[10px] text-[#9CA3AF]">{l}</p>
                <p className="font-mono text-sm font-semibold text-[#111827]">{v!=null?number(v):'—'}</p>
              </div>)}</div>;
            })()}
          </div>
        </div>

        {/* ── Recent Posts ─────────────────────────────────────────────── */}
        {!extraLoading && recentPosts && recentPosts.length>0 && (
          <Section title="Recent posts" action={
            <button type="button" onClick={()=>setShowPostModal(true)}
              className="flex items-center gap-1 rounded-xl bg-[#6C55E8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5A42D1]">
              <IconPlus/>Add post
            </button>
          }>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentPosts.map(p=><div key={p.name} className="flex-shrink-0 w-56 rounded-xl border border-[#E5E7EB] p-4">
                <span className="inline-block rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px] font-medium text-[#6C55E8] mb-2">{p.post_type??'POST'}</span>
                <p className="text-xs text-[#374151] line-clamp-3">{p.summary??'No content'}</p>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                  {p.views!=null && <span>{number(p.views)} views</span>}
                  {p.clicks!=null && <span>{number(p.clicks)} clicks</span>}
                </div>
              </div>)}
            </div>
          </Section>
        )}

        {/* ── Main 2-col grid ───────────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">

          {/* Left col: Business Profile + Review Analytics */}
          <div className="flex flex-col gap-6">

            {/* Business profile — social media style */}
            <Section className="flex-1" title="Business profile"
              action={<button type="button" onClick={()=>togglePanel('info')} className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB]"><IconEdit/>Edit</button>}>
              {profile?.source!=='google_business_profile' && <p className="mb-4 text-xs text-amber-700">{warningText('profile')}</p>}
              <div className="space-y-3">
                {[
                  {icon:<IconPin/>,label:'Address',value:profile?.address},
                  {icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>,label:'Phone',value:profile?.phone},
                  {icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,label:'Website',value:profile?.website,link:true},
                  {icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,label:'Category',value:profile?.category},
                  {icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,label:'Hours',value:profile?.has_hours==null?null:profile.has_hours?'Configured':'Not returned'},
                ].map(row=><div key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-[#9CA3AF]">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#9CA3AF]">{row.label}</p>
                    {row.link && safeUrl(row.value) ? <a href={safeUrl(row.value)} target="_blank" rel="noreferrer" className="text-xs text-[#6C55E8] hover:underline truncate block">{row.value}</a>
                      : <p className="text-xs text-[#374151] break-words">{row.value||'Not available'}</p>}
                  </div>
                </div>)}
                {profile?.description && <div className="mt-2 rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-[10px] font-medium text-[#9CA3AF] mb-1">Description</p>
                  <p className="text-xs text-[#374151] leading-relaxed">{profile.description}</p>
                </div>}
              </div>
              {safeUrl(profile?.maps_url) && <a className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#6C55E8]" href={safeUrl(profile?.maps_url)} target="_blank" rel="noreferrer">
                View on Google Maps
              </a>}
            </Section>

            {/* Review analytics */}
            <Section className="flex-1" title="Review analytics" description="Rating breakdown and volume trend from your synced reviews.">
              {reviewLoading && <div className="h-32 animate-pulse rounded-xl bg-[#F3F4F6]"/>}
              {!reviewLoading && reviewRows!=null && (()=>{
                const months=buildMonthBuckets(reviewRows);
                const ratings=buildRatingBuckets(reviewRows);
                const maxCount=Math.max(...months.map(m=>m.count),1);
                const maxRating=Math.max(...ratings.map(r=>r.count),1);
                const total=reviewRows.length;
                const STAR_COLOR=['','#EF4444','#F97316','#EAB308','#84CC16','#22C55E'];
                return total===0 ? <Empty>No reviews synced in this date range.</Empty> : <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-3 text-xs font-semibold text-[#374151]">Rating distribution</p>
                      <div className="space-y-2">{ratings.map(r=><div key={r.rating} className="flex items-center gap-2">
                        <span className="w-5 text-right text-[11px] text-[#6B7280]">{r.rating}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-[#F3F4F6]" style={{height:'8px'}}>
                          <div style={{width:`${(r.count/maxRating)*100}%`,height:'100%',background:STAR_COLOR[r.rating],borderRadius:'inherit'}}/>
                        </div>
                        <span className="w-7 text-[11px] text-[#9CA3AF]">{r.count}</span>
                      </div>)}</div>
                    </div>
                    <div>
                      <p className="mb-3 text-xs font-semibold text-[#374151]">Monthly volume</p>
                      <div className="flex items-end gap-1" style={{height:'64px'}}>
                        {months.map(m=>{
                          const h=Math.max((m.count/maxCount)*56,2);
                          return <div key={m.month} className="flex-1 relative flex flex-col justify-end"
                            title={`${m.month}: ${m.count} reviews`}>
                            <div style={{height:`${h}px`,background:'#6C55E8'}} className="rounded-t-sm w-full"/>
                          </div>;
                        })}
                      </div>
                      <div className="mt-3 flex justify-between text-[10px] text-[#9CA3AF]">
                        <span>{months[0]?.month}</span><span>{months[months.length-1]?.month}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-6 text-xs text-[#6B7280]">
                    <span><span className="font-semibold text-[#111827]">{total.toLocaleString()}</span> total</span>
                    <span><span className="font-semibold text-[#111827]">{reviewRows.filter(r=>r.reply_text).length.toLocaleString()}</span> replied</span>
                    <span><span className="font-semibold text-[#111827]">{total?Math.round(reviewRows.filter(r=>r.reply_text).length/total*100):0}%</span> reply rate</span>
                  </div>
                </>;
              })()}
            </Section>

          </div>

          {/* Right col: Profile Doctor (expandable) */}
          <section className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F3F4F6] p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#111827]">Profile Doctor diagnostics</h2>
                  <button type="button" onClick={()=>setDoctorOpen(v=>!v)} className="text-[#9CA3AF] hover:text-[#6B7280]">
                    <IconChevron open={doctorOpen}/>
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">Profile completeness and optimization tips.</p>
              </div>
              {/* Mini bar chart in header */}
              {readiness && <div className="flex items-end gap-0.5 h-8">
                {[readiness.score??0, reviews?.replied&&reviews.total?Math.round(reviews.replied/reviews.total*100):0, average?Math.round(average*20):0, (competitors.length?Math.min(100,Math.round(competitors.length*10)):0)].map((v,i)=>(
                  <div key={i} className="w-3 rounded-t-sm bg-[#6C55E8] opacity-80" style={{height:`${Math.max((v/100)*32,3)}px`}}/>
                ))}
              </div>}
            </div>
            {doctorOpen && <div className="p-5 space-y-5">
              {readiness && <>
                <div className="flex items-center gap-4">
                  <StrengthRing score={readiness.score??0}/>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{readiness.score??0}/100 readiness score</p>
                    <p className="text-xs text-[#6B7280]">Coverage: {readiness.coverage} weight assessed</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {readiness.checks?.map((c:{label:string;status:string;detail?:string})=>(
                    <div key={c.label} className="flex items-start gap-2">
                      <StatusDot status={c.status}/>
                      <div>
                        <p className="text-xs font-medium text-[#374151]">{c.label}</p>
                        {c.detail && <p className="text-[11px] text-[#9CA3AF]">{c.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>}
              {/* Competitor benchmarking */}
              {competitors.length>0 && <>
                <div className="border-t border-[#F3F4F6] pt-5">
                  <p className="mb-3 text-xs font-semibold text-[#374151]">Competitive Benchmarking</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                      <p className="text-[10px] text-[#9CA3AF]">Your rating</p>
                      <p className="font-mono text-lg font-bold text-[#6C55E8]">{reviews?.rating?.toFixed(1)?? '—'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                      <p className="text-[10px] text-[#9CA3AF]">Area avg</p>
                      <p className="font-mono text-lg font-bold text-[#374151]">{average?.toFixed(1)?? '—'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] p-3 text-center">
                      <p className="text-[10px] text-[#9CA3AF]">Avg reviews</p>
                      <p className="font-mono text-lg font-bold text-[#374151]">{reviewAverage??'—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    {RADII.map(r=><button key={r} type="button" onClick={()=>setRadius(r)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${radius===r?'border-[#6C55E8] text-[#6C55E8] bg-[#F5F3FF]':'border-[#E5E7EB] text-[#6B7280]'}`}>
                      {r} km</button>)}
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {competitors.slice(0,8).map((c,i)=><div key={c.place_id} className="flex items-center gap-3 text-xs">
                      <span className="flex-shrink-0 w-5 text-center font-medium text-[#9CA3AF]">#{i+1}</span>
                      <span className="flex-1 min-w-0 truncate text-[#374151]">{c.name}</span>
                      {c.rating!=null && <span className="flex items-center gap-0.5 text-amber-500 flex-shrink-0 text-[11px]"><IconStar/>{c.rating.toFixed(1)}</span>}
                      <span className="flex-shrink-0 text-[#9CA3AF] text-[11px]">{number(c.review_count)}</span>
                    </div>)}
                  </div>
                </div>
              </>}
            </div>}
            {!doctorOpen && readiness && <div className="p-5">
              <div className="flex items-center gap-4">
                <StrengthRing score={readiness.score??0}/>
                <div>
                  <p className="text-sm font-medium text-[#374151]">Click the arrow to expand full diagnostics</p>
                  <p className="text-xs text-[#6B7280]">{readiness.checks?.filter((c:{status:string})=>c.status==='action').length??0} action items found</p>
                </div>
              </div>
            </div>}
          </section>

        </div>
      </>}
    </>}

    {/* ── Add Post Modal ──────────────────────────────────────────────── */}
    {showPostModal && selected && (
      <AddPostModal locationId={selected.id} onClose={()=>setShowPostModal(false)}
        onPosted={()=>{setShowPostModal(false);setRevision(n=>n+1);}}/>
    )}
  </div>;
}
