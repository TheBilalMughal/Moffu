import { useCallback, useEffect, useRef, useState } from 'react';
import { brandBrainService, BrandBrainData, LocationOverride, GoogleLocation } from './brandBrain.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const TONE_PRESETS = [
  { key: 'professional', label: 'Professional', desc: 'Formal, polished, brand-forward.' },
  { key: 'friendly',     label: 'Friendly',     desc: 'Warm, approachable, conversational.' },
  { key: 'formal',       label: 'Formal',        desc: 'Structured and respectful. Suits legal, medical, finance.' },
  { key: 'casual',       label: 'Casual',        desc: 'Relaxed and natural. Great for lifestyle and food brands.' },
] as const;

const BUSINESS_TYPES = [
  'Restaurant / Cafe', 'Retail Store', 'Hotel / Hospitality', 'Healthcare / Medical',
  'Legal / Finance', 'Beauty / Wellness', 'Education', 'Automotive',
  'Real Estate', 'Technology / SaaS', 'Other',
];

const REPLY_LENGTHS = [
  { key: 'short',  label: 'Short',  desc: '1–2 sentences' },
  { key: 'medium', label: 'Medium', desc: '3–4 sentences' },
  { key: 'long',   label: 'Long',   desc: '5+ sentences' },
] as const;

const NEGATIVE_OPTS = [
  { key: 'manual',   label: 'Flag for manual review', desc: 'No draft — you handle it directly.' },
  { key: 'cautious', label: 'Generate cautious draft', desc: 'AI creates a careful, empathetic draft for your approval.' },
  { key: 'normal',   label: 'Reply normally',          desc: 'Treat like any other review.' },
] as const;

const LANGUAGES = ['English','Urdu','Arabic','French','Spanish','German','Hindi','Turkish','Malay','Indonesian'];

type ToneKey     = (typeof TONE_PRESETS)[number]['key'];
type LengthKey   = (typeof REPLY_LENGTHS)[number]['key'];
type NegKey      = (typeof NEGATIVE_OPTS)[number]['key'];

// ── Derived types ─────────────────────────────────────────────────────────────

// Editable snapshot for both global and per-location
interface FormData {
  // global-only
  business_name: string;
  business_type: string;
  business_desc: string;
  // shared (overridable per location)
  tone: ToneKey;
  reply_length: LengthKey;
  use_customer_name: boolean;
  use_emoji: boolean;
  primary_language: string;
  reviewer_lang_behaviour: 'primary' | 'match';
  negative_rule: NegKey;
  prohibited_phrases: string[];
  example_reply: string;
}

interface OverrideFlags {
  tone: boolean; reply_length: boolean; use_customer_name: boolean;
  use_emoji: boolean; primary_language: boolean; reviewer_lang_behaviour: boolean;
  negative_rule: boolean; prohibited_phrases: boolean; example_reply: boolean;
}

const DEFAULT_GLOBAL: FormData = {
  business_name: '', business_type: '', business_desc: '',
  tone: 'professional', reply_length: 'medium',
  use_customer_name: true, use_emoji: false,
  primary_language: 'English', reviewer_lang_behaviour: 'primary',
  negative_rule: 'cautious', prohibited_phrases: [], example_reply: '',
};

const DEFAULT_FLAGS: OverrideFlags = {
  tone: false, reply_length: false, use_customer_name: false,
  use_emoji: false, primary_language: false, reviewer_lang_behaviour: false,
  negative_rule: false, prohibited_phrases: false, example_reply: false,
};

// ── Primitive components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`}/>
    </button>
  );
}

function Radio({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${checked ? 'border-[#0D4C3C]' : 'border-[#D1D5DB] hover:border-[#0D4C3C]/50'}`}>
      {checked && <div className="w-2 h-2 rounded-full bg-[#0D4C3C]"/>}
    </div>
  );
}

// Custom dropdown replacing native <select>
function SelectField({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        className={`w-full flex items-center justify-between text-sm border rounded-lg px-3.5 py-2.5 text-left transition-colors
          ${disabled ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-default' : 'bg-white text-[#111827] border-[#D1D5DB] hover:border-[#0D4C3C] focus:outline-none focus:border-[#0D4C3C]'}`}>
        <span className={!value ? 'text-[#9CA3AF]' : ''}>{value || placeholder || 'Select…'}</span>
        <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-[#E5EAE8] rounded-xl shadow-lg py-1.5 max-h-56 overflow-y-auto">
          {placeholder && (
            <button onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${!value ? 'text-[#0D4C3C] font-medium bg-[#F0F7F5]' : 'text-[#9CA3AF] hover:bg-[#F8F9FA]'}`}>
              {placeholder}
            </button>
          )}
          {options.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition-colors ${value === opt ? 'text-[#0D4C3C] font-medium bg-[#F0F7F5]' : 'text-[#374151] hover:bg-[#F8F9FA]'}`}>
              <span>{opt}</span>
              {value === opt && <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Toast
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const h = setTimeout(() => setVisible(false), 3200);
    const r = setTimeout(onDone, 3700);
    return () => { clearTimeout(h); clearTimeout(r); };
  }, [onDone]);
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-start gap-3 bg-white shadow-lg rounded-xl px-4 py-3 max-w-sm border border-[#E5EAE8] transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`}>
        {type === 'error'
          ? <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          : <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
        }
      </div>
      <p className="text-sm text-[#374151] leading-snug">{message}</p>
    </div>
  );
}

// Override wrapper — shows "inherited" badge + enable toggle for location overrides
function OverrideRow({ label, fieldKey, flags, onToggle, globalValue, children }: {
  label: string; fieldKey: keyof OverrideFlags;
  flags: OverrideFlags; onToggle: (k: keyof OverrideFlags) => void;
  globalValue: React.ReactNode; children: React.ReactNode;
}) {
  const active = flags[fieldKey];
  return (
    <div className={`rounded-lg border transition-colors ${active ? 'border-[#0D4C3C]/30 bg-white' : 'border-[#E5EAE8] bg-[#FAFAFA]'}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-[#374151]">{label}</span>
          {!active && (
            <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md">
              Inherited: {globalValue}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-[10px] text-[#9CA3AF]">{active ? 'Override on' : 'Override off'}</span>
          <Toggle checked={active} onChange={() => onToggle(fieldKey)}/>
        </div>
      </div>
      {active && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

const inputCls = 'w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#0D4C3C] transition-colors placeholder:text-[#9CA3AF] bg-white resize-none';

// ── Completion score ──────────────────────────────────────────────────────────

function completionScore(f: FormData): number {
  let score = 0;
  if (f.business_name.trim()) score += 20;
  if (f.business_type) score += 15;
  if (f.business_desc.trim()) score += 10;
  if (f.tone) score += 15;
  if (f.example_reply.trim()) score += 20;
  if (f.prohibited_phrases.length > 0) score += 10;
  if (f.reply_length) score += 10;
  return score;
}

function CompletionBar({ score }: { score: number }) {
  const color = score >= 80 ? '#0D4C3C' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="px-3 py-2.5 border-t border-[#F3F4F6]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Setup complete</span>
        <span className="text-xs font-bold" style={{ color }}>{score}%</span>
      </div>
      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }}/>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Prohibited phrases input ──────────────────────────────────────────────────

function PhrasesInput({ phrases, onChange }: { phrases: string[]; onChange: (p: string[]) => void }) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim();
    if (v && !phrases.includes(v)) onChange([...phrases, v]);
    setInput('');
  }
  return (
    <div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type a phrase and press Enter"
          className={inputCls}/>
        <button onClick={add} disabled={!input.trim()}
          className="text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-4 py-2.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors whitespace-nowrap">
          Add
        </button>
      </div>
      {phrases.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {phrases.map(p => (
            <span key={p} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-[#F3F4F6] border border-[#E5EAE8] px-2.5 py-1 rounded-lg">
              {p}
              <button onClick={() => onChange(phrases.filter(x => x !== p))} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF] mt-2">No prohibited phrases added yet.</p>
      )}
    </div>
  );
}

// ── Global form content ───────────────────────────────────────────────────────

function GlobalForm({ data, onChange }: { data: FormData; onChange: (patch: Partial<FormData>) => void }) {
  return (
    <div className="space-y-6">
      <Section title="Business info" description="Basic details that personalise every AI-generated reply.">
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Business name</label>
          <input type="text" value={data.business_name} onChange={e => onChange({ business_name: e.target.value })}
            placeholder="e.g. The Blue Door Café" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Business type</label>
          <SelectField value={data.business_type} onChange={v => onChange({ business_type: v })}
            options={BUSINESS_TYPES} placeholder="Select a type…"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
            Short description <span className="text-[#9CA3AF] font-normal">(optional)</span>
          </label>
          <textarea value={data.business_desc} onChange={e => onChange({ business_desc: e.target.value })}
            placeholder="One sentence about what makes your business unique." rows={2} maxLength={200} className={inputCls}/>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5 text-right">{data.business_desc.length}/200</p>
        </div>
      </Section>

      <Section title="Tone & personality" description="Pick the voice that best matches your brand.">
        <div className="grid grid-cols-2 gap-2">
          {TONE_PRESETS.map(p => (
            <button key={p.key} onClick={() => onChange({ tone: p.key })}
              className={`text-left p-3.5 rounded-lg border transition-all ${data.tone === p.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40 hover:bg-[#F8FAF9]'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-semibold ${data.tone === p.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{p.label}</p>
                <Radio checked={data.tone === p.key} onClick={() => onChange({ tone: p.key })}/>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Reply settings" description="Control how AI structures and formats each reply.">
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Reply length</label>
          <div className="flex gap-2">
            {REPLY_LENGTHS.map(opt => (
              <button key={opt.key} onClick={() => onChange({ reply_length: opt.key })}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all text-center ${data.reply_length === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]' : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C]/40'}`}>
                <span className="block">{opt.label}</span>
                <span className="block text-xs font-normal mt-0.5 opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Address reviewer by name', sub: 'e.g. "Thank you, Sarah!" when name is available.', field: 'use_customer_name' as const },
            { label: 'Allow emoji in replies', sub: 'Adds occasional emoji when tone allows it.', field: 'use_emoji' as const },
          ].map(item => (
            <div key={item.field} className="flex items-center justify-between px-4 py-3 bg-[#F8FAF9] rounded-lg border border-[#E5EAE8]">
              <div>
                <p className="text-sm font-medium text-[#111827]">{item.label}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{item.sub}</p>
              </div>
              <Toggle checked={data[item.field] as boolean} onChange={() => onChange({ [item.field]: !data[item.field] })}/>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Language" description="Set the primary language and how to handle reviewers who write in a different one.">
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Primary language</label>
          <SelectField value={data.primary_language} onChange={v => onChange({ primary_language: v })} options={LANGUAGES}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-2">When reviewer writes in a different language</label>
          <div className="space-y-2">
            {[
              { key: 'primary' as const, label: 'Always reply in my primary language' },
              { key: 'match' as const,   label: "Match the reviewer's language" },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-3 cursor-pointer" onClick={() => onChange({ reviewer_lang_behaviour: opt.key })}>
                <Radio checked={data.reviewer_lang_behaviour === opt.key} onClick={() => onChange({ reviewer_lang_behaviour: opt.key })}/>
                <span className="text-sm text-[#374151]">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Negative review handling" description="How AI responds when a review has 1–2 stars or contains a complaint.">
        <div className="space-y-2">
          {NEGATIVE_OPTS.map(opt => (
            <div key={opt.key} onClick={() => onChange({ negative_rule: opt.key })}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${data.negative_rule === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
              <div className="mt-0.5"><Radio checked={data.negative_rule === opt.key} onClick={() => onChange({ negative_rule: opt.key })}/></div>
              <div>
                <p className={`text-sm font-semibold ${data.negative_rule === opt.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{opt.label}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Prohibited phrases" description="Words or phrases AI must never use — promises, legal terms, competitor names.">
        <PhrasesInput phrases={data.prohibited_phrases} onChange={v => onChange({ prohibited_phrases: v })}/>
      </Section>

      <Section title="Example reply" description="Paste a reply you've written that captures your voice. AI uses it as a style reference.">
        <div>
          <textarea value={data.example_reply} onChange={e => onChange({ example_reply: e.target.value })}
            placeholder="Paste an example reply you're happy with…" rows={4} maxLength={800} className={inputCls}/>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5 text-right">{data.example_reply.length}/800</p>
        </div>
      </Section>
    </div>
  );
}

// ── Location override form ────────────────────────────────────────────────────

function LocationForm({ data, globalData, flags, onDataChange, onFlagToggle }: {
  data: FormData; globalData: FormData;
  flags: OverrideFlags;
  onDataChange: (patch: Partial<FormData>) => void;
  onFlagToggle: (k: keyof OverrideFlags) => void;
}) {
  function globalLabel(val: unknown): string {
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) return val.length > 0 ? `${val.length} phrase${val.length !== 1 ? 's' : ''}` : 'None';
    return String(val ?? '—');
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#9CA3AF] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-3.5 py-2.5">
        These settings override the global Brand Brain for this location only.
        Toggle a field on to customise it; leave it off to inherit the global value.
      </p>

      <OverrideRow label="Tone" fieldKey="tone" flags={flags} onToggle={onFlagToggle}
        globalValue={TONE_PRESETS.find(p => p.key === globalData.tone)?.label ?? globalData.tone}>
        <div className="grid grid-cols-2 gap-2">
          {TONE_PRESETS.map(p => (
            <button key={p.key} onClick={() => onDataChange({ tone: p.key })}
              className={`text-left p-3 rounded-lg border transition-all ${data.tone === p.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-xs font-semibold ${data.tone === p.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{p.label}</p>
                <Radio checked={data.tone === p.key} onClick={() => onDataChange({ tone: p.key })}/>
              </div>
              <p className="text-[10px] text-[#6B7280]">{p.desc}</p>
            </button>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Reply length" fieldKey="reply_length" flags={flags} onToggle={onFlagToggle}
        globalValue={globalLabel(globalData.reply_length)}>
        <div className="flex gap-2">
          {REPLY_LENGTHS.map(opt => (
            <button key={opt.key} onClick={() => onDataChange({ reply_length: opt.key })}
              className={`flex-1 py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center ${data.reply_length === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]' : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C]/40'}`}>
              <span className="block">{opt.label}</span>
              <span className="block font-normal opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Address reviewer by name" fieldKey="use_customer_name" flags={flags} onToggle={onFlagToggle}
        globalValue={globalLabel(globalData.use_customer_name)}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#374151]">Address reviewer by name</p>
          <Toggle checked={data.use_customer_name} onChange={() => onDataChange({ use_customer_name: !data.use_customer_name })}/>
        </div>
      </OverrideRow>

      <OverrideRow label="Allow emoji" fieldKey="use_emoji" flags={flags} onToggle={onFlagToggle}
        globalValue={globalLabel(globalData.use_emoji)}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#374151]">Allow emoji in replies</p>
          <Toggle checked={data.use_emoji} onChange={() => onDataChange({ use_emoji: !data.use_emoji })}/>
        </div>
      </OverrideRow>

      <OverrideRow label="Primary language" fieldKey="primary_language" flags={flags} onToggle={onFlagToggle}
        globalValue={globalLabel(globalData.primary_language)}>
        <SelectField value={data.primary_language} onChange={v => onDataChange({ primary_language: v })} options={LANGUAGES}/>
      </OverrideRow>

      <OverrideRow label="Language behaviour" fieldKey="reviewer_lang_behaviour" flags={flags} onToggle={onFlagToggle}
        globalValue={globalData.reviewer_lang_behaviour === 'primary' ? 'Always primary' : 'Match reviewer'}>
        <div className="space-y-2">
          {[
            { key: 'primary' as const, label: 'Always reply in primary language' },
            { key: 'match' as const,   label: "Match the reviewer's language" },
          ].map(opt => (
            <label key={opt.key} className="flex items-center gap-3 cursor-pointer" onClick={() => onDataChange({ reviewer_lang_behaviour: opt.key })}>
              <Radio checked={data.reviewer_lang_behaviour === opt.key} onClick={() => onDataChange({ reviewer_lang_behaviour: opt.key })}/>
              <span className="text-sm text-[#374151]">{opt.label}</span>
            </label>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Negative review handling" fieldKey="negative_rule" flags={flags} onToggle={onFlagToggle}
        globalValue={NEGATIVE_OPTS.find(o => o.key === globalData.negative_rule)?.label ?? globalData.negative_rule}>
        <div className="space-y-2">
          {NEGATIVE_OPTS.map(opt => (
            <div key={opt.key} onClick={() => onDataChange({ negative_rule: opt.key })}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${data.negative_rule === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
              <div className="mt-0.5"><Radio checked={data.negative_rule === opt.key} onClick={() => onDataChange({ negative_rule: opt.key })}/></div>
              <div>
                <p className={`text-xs font-semibold ${data.negative_rule === opt.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{opt.label}</p>
                <p className="text-[10px] text-[#6B7280] mt-0.5">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Prohibited phrases" fieldKey="prohibited_phrases" flags={flags} onToggle={onFlagToggle}
        globalValue={globalLabel(globalData.prohibited_phrases)}>
        <PhrasesInput phrases={data.prohibited_phrases} onChange={v => onDataChange({ prohibited_phrases: v })}/>
      </OverrideRow>

      <OverrideRow label="Example reply" fieldKey="example_reply" flags={flags} onToggle={onFlagToggle}
        globalValue={globalData.example_reply ? 'Set' : 'Not set'}>
        <div>
          <textarea value={data.example_reply} onChange={e => onDataChange({ example_reply: e.target.value })}
            placeholder="Paste an example reply specific to this location…" rows={3} maxLength={800} className={inputCls}/>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5 text-right">{data.example_reply.length}/800</p>
        </div>
      </OverrideRow>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BrandBrainPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Global state
  const [globalData, setGlobalData] = useState<FormData>(DEFAULT_GLOBAL);
  const [globalDirty, setGlobalDirty] = useState(false);

  // Locations
  const [locations, setLocations] = useState<GoogleLocation[]>([]);

  // Selected nav item: 'global' | location id
  const [selected, setSelected] = useState<string>('global');

  // Per-location data cache: locationId → { data, flags, dirty }
  const [locCache, setLocCache] = useState<Record<string, {
    data: FormData; flags: OverrideFlags; dirty: boolean; loaded: boolean;
  }>>({});

  const [saving, setSaving] = useState(false);

  // Load global + locations on mount
  useEffect(() => {
    Promise.all([
      brandBrainService.load(),
      brandBrainService.loadLocations(),
    ]).then(([globalRes, locsRes]) => {
      if (globalRes.data) setGlobalData({ ...DEFAULT_GLOBAL, ...globalRes.data });
      if (locsRes.data) setLocations(locsRes.data);
      setLoading(false);
    });
  }, []);

  // Lazy-load override when switching to a location
  useEffect(() => {
    if (selected === 'global') return;
    const locationId = selected;
    if (locCache[locationId]?.loaded) return;

    brandBrainService.loadOverride(locationId).then(({ data }) => {
      const flags = { ...DEFAULT_FLAGS };
      const formData = { ...globalData }; // start from global as base display values

      if (data) {
        // For each field present in override, mark flag ON and use override value
        const overridable: (keyof OverrideFlags)[] = [
          'tone','reply_length','use_customer_name','use_emoji',
          'primary_language','reviewer_lang_behaviour','negative_rule',
          'prohibited_phrases','example_reply',
        ];
        overridable.forEach(k => {
          const v = data[k as keyof LocationOverride];
          if (v !== null && v !== undefined) {
            flags[k] = true;
            (formData as Record<string, unknown>)[k] = v;
          }
        });
      }

      setLocCache(prev => ({
        ...prev,
        [locationId]: { data: formData, flags, dirty: false, loaded: true },
      }));
    });
  }, [selected, globalData]);

  function patchGlobal(patch: Partial<FormData>) {
    setGlobalData(prev => ({ ...prev, ...patch }));
    setGlobalDirty(true);
  }

  function patchLocData(locationId: string, patch: Partial<FormData>) {
    setLocCache(prev => ({
      ...prev,
      [locationId]: { ...prev[locationId]!, data: { ...prev[locationId]!.data, ...patch }, dirty: true },
    }));
  }

  function toggleLocFlag(locationId: string, key: keyof OverrideFlags) {
    setLocCache(prev => {
      const cur = prev[locationId]!;
      const newFlags = { ...cur.flags, [key]: !cur.flags[key] };
      // When turning OFF an override, reset that field to global value
      let newData = { ...cur.data };
      if (!newFlags[key]) {
        (newData as unknown as Record<string, unknown>)[key] = (globalData as unknown as Record<string, unknown>)[key];
      }
      return { ...prev, [locationId]: { ...cur, flags: newFlags, data: newData, dirty: true } };
    });
  }

  async function handleSave() {
    setSaving(true);
    if (selected === 'global') {
      const { error } = await brandBrainService.save(globalData);
      if (error) setToast({ message: error.message, type: 'error' });
      else { setToast({ message: 'Global settings saved.', type: 'success' }); setGlobalDirty(false); }
    } else {
      const locationId = selected;
      const loc = locCache[locationId];
      if (!loc) { setSaving(false); return; }

      // Build override payload: only include flagged fields
      const payload: Omit<LocationOverride, 'location_id'> = {
        tone: loc.flags.tone ? loc.data.tone : null,
        reply_length: loc.flags.reply_length ? loc.data.reply_length : null,
        use_customer_name: loc.flags.use_customer_name ? loc.data.use_customer_name : null,
        use_emoji: loc.flags.use_emoji ? loc.data.use_emoji : null,
        primary_language: loc.flags.primary_language ? loc.data.primary_language : null,
        reviewer_lang_behaviour: loc.flags.reviewer_lang_behaviour ? loc.data.reviewer_lang_behaviour : null,
        negative_rule: loc.flags.negative_rule ? loc.data.negative_rule : null,
        prohibited_phrases: loc.flags.prohibited_phrases ? loc.data.prohibited_phrases : null,
        example_reply: loc.flags.example_reply ? loc.data.example_reply : null,
      };

      // Check if any override is active
      const hasAny = Object.values(loc.flags).some(Boolean);
      if (!hasAny) {
        // No overrides — delete the override row if it exists
        await brandBrainService.deleteOverride(locationId);
        setToast({ message: 'Location overrides removed (using global settings).', type: 'success' });
      } else {
        const { error } = await brandBrainService.saveOverride(locationId, payload);
        if (error) setToast({ message: error.message, type: 'error' });
        else setToast({ message: 'Location settings saved.', type: 'success' });
      }

      setLocCache(prev => ({ ...prev, [locationId]: { ...prev[locationId]!, dirty: false } }));
    }
    setSaving(false);
  }

  const isDirty = selected === 'global'
    ? globalDirty
    : !!(locCache[selected]?.dirty);

  const score = completionScore(globalData);
  const activeLocData = selected !== 'global' ? locCache[selected]?.data : undefined;
  const activeLocFlags = selected !== 'global' ? locCache[selected]?.flags : undefined;
  const activeLocLoaded = selected !== 'global' ? locCache[selected]?.loaded : true;
  const overrideCount = selected !== 'global' && activeLocFlags
    ? Object.values(activeLocFlags).filter(Boolean).length
    : 0;

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="h-8 w-48 bg-[#F3F4F6] rounded-lg animate-pulse mb-2"/>
        <div className="h-4 w-80 bg-[#F3F4F6] rounded-lg animate-pulse mb-8"/>
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-[#E5EAE8] h-32 mb-5 animate-pulse"/>)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)}/>}

      {/* Top header */}
      <div className="px-10 py-4 border-b border-[#E5EAE8] bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Brand Brain</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Define your voice so AI writes replies that sound like you.</p>
        </div>
        <button onClick={handleSave} disabled={saving || !isDirty}
          className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:cursor-not-allowed">
          {saving
            ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Saving…</>
            : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Save changes</>
          }
        </button>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-[#E5EAE8] bg-[#FAFAFA] flex flex-col overflow-y-auto">
          {/* Global */}
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-1">Global</p>
            <button onClick={() => setSelected('global')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selected === 'global' ? 'bg-[#0D4C3C] text-white' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/>
                </svg>
                <span>Default settings</span>
              </div>
              {globalDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"/>}
            </button>
          </div>

          {/* Locations */}
          {locations.length > 0 && (
            <div className="px-3 pt-2 pb-4">
              <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-1">Locations</p>
              {locations.map(loc => {
                const isActive = selected === loc.id;
                const locFlags = locCache[loc.id]?.flags;
                const overrides = locFlags ? Object.values(locFlags).filter(Boolean).length : 0;
                const dirty = locCache[loc.id]?.dirty;
                return (
                  <button key={loc.id} onClick={() => setSelected(loc.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors mb-0.5 ${isActive ? 'bg-[#0D4C3C] text-white' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium truncate">{loc.display_name ?? 'Location'}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>}
                        {overrides > 0 && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-[#E6F2EE] text-[#0D4C3C]'}`}>
                            {overrides}
                          </span>
                        )}
                      </div>
                    </div>
                    {loc.address && <p className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{loc.address}</p>}
                  </button>
                );
              })}
            </div>
          )}

          {locations.length === 0 && (
            <div className="px-5 py-4 text-xs text-[#9CA3AF] leading-relaxed">
              Connect Google Business Profile in Settings to see your locations here.
            </div>
          )}

          {/* Completion bar — global only */}
          {selected === 'global' && <div className="mt-auto"><CompletionBar score={score}/></div>}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {selected === 'global' ? (
            <>
              <div className="mb-5 flex items-center gap-2">
                <h2 className="text-base font-bold text-[#111827]">Default settings</h2>
                <span className="text-xs text-[#9CA3AF]">Apply to all locations unless overridden</span>
              </div>
              <GlobalForm data={globalData} onChange={patchGlobal}/>
            </>
          ) : !activeLocLoaded ? (
            <div className="space-y-3 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded-lg"/>)}
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[#111827]">
                  {locations.find(l => l.id === selected)?.display_name ?? 'Location'}
                </h2>
                {overrideCount > 0 ? (
                  <span className="text-xs font-medium text-[#0D4C3C] bg-[#E6F2EE] px-2 py-0.5 rounded-md">
                    {overrideCount} override{overrideCount !== 1 ? 's' : ''} active
                  </span>
                ) : (
                  <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-md">Using global settings</span>
                )}
              </div>
              {activeLocData && activeLocFlags && (
                <LocationForm
                  data={activeLocData}
                  globalData={globalData}
                  flags={activeLocFlags}
                  onDataChange={p => patchLocData(selected, p)}
                  onFlagToggle={k => toggleLocFlag(selected, k)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
