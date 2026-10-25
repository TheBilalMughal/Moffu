import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Toast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import {
  brandBrainService, BrandBrainData, LocationOverride, GoogleLocation,
  StarRatingRules, KeywordContext, ApprovalRules,
} from './brandBrain.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const TONE_PRESETS = [
  { key: 'professional', label: 'Professional', desc: 'Formal, polished, brand-forward.' },
  { key: 'friendly',     label: 'Friendly',     desc: 'Warm, approachable, conversational.' },
  { key: 'formal',       label: 'Formal',        desc: 'Structured and respectful. Suits legal, medical, finance.' },
  { key: 'casual',       label: 'Casual',        desc: 'Relaxed and natural. Great for lifestyle and food brands.' },
] as const;

const BUSINESS_TYPES = [
  'Restaurant / Cafe','Retail Store','Hotel / Hospitality','Healthcare / Medical',
  'Legal / Finance','Beauty / Wellness','Education','Automotive',
  'Real Estate','Technology / SaaS','Other',
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

type ToneKey   = (typeof TONE_PRESETS)[number]['key'];
type LengthKey = (typeof REPLY_LENGTHS)[number]['key'];
type NegKey    = (typeof NEGATIVE_OPTS)[number]['key'];

const WIZARD_STEPS = [
  { id: 1, label: 'Identity',  icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 2, label: 'Voice',     icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 3, label: 'Format',    icon: 'M4 6h16M4 12h16M4 18h7' },
  { id: 4, label: 'Rules',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 5, label: 'Guardrails',icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { id: 6, label: 'Locations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 7, label: 'Preview',   icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
];

// ── Default state ─────────────────────────────────────────────────────────────

const DEFAULT_DATA: BrandBrainData = {
  business_name: '', business_type: '', business_desc: '',
  tone: 'professional', reply_length: 'medium',
  use_customer_name: true, use_emoji: false,
  primary_language: 'English', reviewer_lang_behaviour: 'primary',
  negative_rule: 'cautious', prohibited_phrases: [], example_reply: '',
  custom_tone_instructions: '', reply_signature: '',
  star_rating_rules: {}, keyword_contexts: [],
  approval_rules: { require_approval_below: 0 },
};

interface OverrideFlags {
  business_name: boolean; tone: boolean; reply_length: boolean;
  use_customer_name: boolean; use_emoji: boolean; primary_language: boolean;
  reviewer_lang_behaviour: boolean; negative_rule: boolean;
  prohibited_phrases: boolean; example_reply: boolean;
  custom_tone_instructions: boolean; reply_signature: boolean;
  star_rating_rules: boolean; approval_rules: boolean;
}

const DEFAULT_FLAGS: OverrideFlags = {
  business_name: false, tone: false, reply_length: false,
  use_customer_name: false, use_emoji: false, primary_language: false,
  reviewer_lang_behaviour: false, negative_rule: false,
  prohibited_phrases: false, example_reply: false,
  custom_tone_instructions: false, reply_signature: false,
  star_rating_rules: false, approval_rules: false,
};

// ── Primitive components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, size = 'md' }: { checked: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-9 h-5';
  const dot = size === 'sm' ? 'w-3 h-3 top-0.5 left-0.5' : 'w-4 h-4 top-0.5 left-0.5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-4';
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      className={`relative ${w} rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}>
      <span className={`absolute ${dot} bg-white rounded-full shadow transition-transform ${checked ? translate : ''}`}/>
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

function SelectField({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  function handleOpen() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
    }
    setOpen(o => !o);
  }

  const dropdown = open ? (
    <div ref={dropRef} style={dropStyle} className="bg-white border border-[#E5EAE8] rounded-xl shadow-lg py-1.5 max-h-56 overflow-y-auto">
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
  ) : null;

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen} disabled={disabled}
        className={`w-full flex items-center justify-between text-sm border rounded-lg px-3.5 py-2.5 text-left transition-colors
          ${disabled ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-default' : 'bg-white text-[#111827] border-[#D1D5DB] hover:border-[#0D4C3C] focus:outline-none'}`}>
        <span className={!value ? 'text-[#9CA3AF]' : ''}>{value || placeholder || 'Select…'}</span>
        <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {createPortal(dropdown, document.body)}
    </div>
  );
}


const inputCls = 'w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#0D4C3C] transition-colors placeholder:text-[#9CA3AF] bg-white';

function PhrasesInput({ phrases, onChange }: { phrases: string[]; onChange: (p: string[]) => void }) {
  const [input, setInput] = useState('');
  function add() { const v = input.trim(); if (v && !phrases.includes(v)) onChange([...phrases, v]); setInput(''); }
  return (
    <div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type a phrase and press Enter" className={inputCls}/>
        <button onClick={add} disabled={!input.trim()}
          className="text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-4 py-2.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors whitespace-nowrap">
          Add
        </button>
      </div>
      {phrases.length > 0 && (
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
      )}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, steps, completed, stepMask, onJump }: {
  current: number; steps: typeof WIZARD_STEPS; completed: Set<number>; stepMask: number; onJump: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-0 px-10 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9] overflow-x-auto flex-shrink-0">
      {steps.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = completed.has(step.id) && !isActive;
        const isLocked = step.id !== 7 && !(stepMask & (1 << (step.id - 1)));
        const isReachable = !isLocked && (isDone || isActive || completed.has(step.id - 1) || step.id === 1);
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <button
              onClick={() => isLocked ? onJump(-step.id) : isReachable && onJump(step.id)}
              title={isLocked ? `Upgrade to unlock ${step.label}` : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                isActive ? 'text-[#0D4C3C]'
                : isLocked ? 'text-[#C4CAC8] hover:bg-[#F3F4F6] cursor-pointer'
                : isDone ? 'text-[#0D4C3C] hover:bg-[#F0F7F5] cursor-pointer'
                : 'text-[#9CA3AF] cursor-default'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all ${
                isActive ? 'bg-[#0D4C3C] text-white'
                : isLocked ? 'bg-[#F3F4F6] text-[#C4CAC8]'
                : isDone ? 'bg-[#E6F2EE] text-[#0D4C3C]'
                : 'bg-[#F3F4F6] text-[#9CA3AF]'
              }`}>
                {isLocked
                  ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  : isDone ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  : step.id
                }
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-[#0D4C3C]' : isLocked ? 'text-[#C4CAC8]' : isDone ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${isDone ? 'bg-[#0D4C3C]/30' : 'bg-[#E5EAE8]'}`}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Business Identity ─────────────────────────────────────────────────

type LocIdentityOverride = { business_name: string | null; business_type: string | null; business_desc: string | null };

function Step1({ data, onChange, locations, locOverrides, onLocOverride }: {
  data: BrandBrainData;
  onChange: (p: Partial<BrandBrainData>) => void;
  locations: GoogleLocation[];
  locOverrides: Record<string, LocIdentityOverride>;
  onLocOverride: (locId: string, field: keyof LocIdentityOverride, value: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Business Identity</h2>
        <p className="text-sm text-[#6B7280]">Basic details that personalise every AI-generated reply.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Global defaults */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Global defaults</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Applied to all locations unless overridden.</p>
          </div>
          <div className="px-5 py-5 bg-[#FAFAFA] space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Business name <span className="text-red-400">*</span></label>
              <input type="text" value={data.business_name} onChange={e => onChange({ business_name: e.target.value })}
                placeholder="e.g. The Blue Door Café" className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Business type</label>
              <SelectField value={data.business_type} onChange={v => onChange({ business_type: v })}
                options={BUSINESS_TYPES} placeholder="Select a type…"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Short description <span className="text-[#9CA3AF] font-normal">(optional)</span>
              </label>
              <textarea value={data.business_desc} onChange={e => onChange({ business_desc: e.target.value })}
                placeholder="One sentence about what makes your business unique." rows={3} maxLength={200}
                className={`${inputCls} resize-none`}/>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5 text-right">{data.business_desc.length}/200</p>
            </div>
          </div>
        </div>

        {/* Right — Per-location identity */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Per-location overrides</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Leave blank to inherit the global default.</p>
          </div>
          {locations.length === 0 ? (
            <div className="px-5 py-10 bg-[#FAFAFA] text-center">
              <svg className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <p className="text-xs text-[#9CA3AF]">No locations connected yet.</p>
            </div>
          ) : (
            <div className="bg-[#FAFAFA] divide-y divide-[#E5EAE8]">
              {locations.map(loc => {
                const ov = locOverrides[loc.id] ?? { business_name: null, business_type: null, business_desc: null };
                const hasOverride = !!(ov.business_type || ov.business_desc);
                const isOpen = expanded.has(loc.id);
                return (
                  <div key={loc.id}>
                    {/* Clickable location header */}
                    <button
                      onClick={() => toggle(loc.id)}
                      className="w-full flex items-center gap-2.5 px-5 py-3 bg-white hover:bg-[#F8FAF9] transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#E6F2EE] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#374151] uppercase tracking-wide truncate">{loc.display_name ?? 'Location'}</p>
                        {loc.address && <p className="text-[10px] text-[#9CA3AF] truncate">{loc.address}</p>}
                      </div>
                      {hasOverride && (
                        <span className="text-[10px] font-semibold text-[#0D4C3C] bg-[#E6F2EE] px-2 py-0.5 rounded-md flex-shrink-0">
                          {[ov.business_type && 'type', ov.business_desc && 'desc'].filter(Boolean).join(' · ')} overridden
                        </span>
                      )}
                      <svg
                        className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {/* Collapsible fields */}
                    {isOpen && (
                      <div className="px-5 py-4 space-y-3 border-t border-[#E5EAE8]">
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">Business type</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <SelectField value={ov.business_type ?? ''} onChange={v => onLocOverride(loc.id, 'business_type', v || null)}
                                options={BUSINESS_TYPES} placeholder={data.business_type || 'Same as default'}/>
                            </div>
                            {ov.business_type && (
                              <button onClick={() => onLocOverride(loc.id, 'business_type', null)} className="text-[#9CA3AF] hover:text-red-500 flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">Short description</label>
                          <div className="flex items-start gap-2">
                            <textarea value={ov.business_desc ?? ''} onChange={e => onLocOverride(loc.id, 'business_desc', e.target.value || null)}
                              placeholder={data.business_desc || 'Same as default'} rows={2} maxLength={200}
                              className={`${inputCls} resize-none flex-1`}/>
                            {ov.business_desc && (
                              <button onClick={() => onLocOverride(loc.id, 'business_desc', null)} className="text-[#9CA3AF] hover:text-red-500 flex-shrink-0 mt-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Voice & Tone ─────────────────────────────────────────────────────

function ImportRepliesModal({ onApply, onClose, analyzing }: {
  onApply: (text: string) => void; onClose: () => void; analyzing: boolean;
}) {
  const [text, setText] = useState('');
  const count = text.split('\n\n').filter(s => s.trim().length > 20).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5EAE8]">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Import from real replies</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">AI will analyze your writing style and suggest settings.</p>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-semibold text-[#374151] mb-1.5">Paste your replies (separate with a blank line)</label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
            placeholder={"Thank you so much, Sarah! We're thrilled you enjoyed your visit...\n\nWe really appreciate your kind feedback! Our team works hard to...\n\nThank you for taking the time to share your experience with us..."}
            className={`${inputCls} resize-none`}/>
          <p className="text-xs text-[#9CA3AF] mt-1">{count} reply{count !== 1 ? 'ies' : ''} detected · need at least 2</p>
        </div>
        <div className="px-6 py-4 border-t border-[#E5EAE8] flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm text-[#6B7280] font-medium px-4 py-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">Cancel</button>
          <button onClick={() => onApply(text)} disabled={count < 2 || analyzing}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {analyzing
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Analyzing…</>
              : 'Analyze voice'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function Step2({ data, onChange, onAnalyzeVoice }: {
  data: BrandBrainData;
  onChange: (p: Partial<BrandBrainData>) => void;
  onAnalyzeVoice: (text: string) => Promise<void>;
}) {
  const [showImport, setShowImport] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function handleAnalyze(text: string) {
    setAnalyzing(true);
    await onAnalyzeVoice(text);
    setAnalyzing(false);
    setShowImport(false);
  }

  return (
    <div className="space-y-6">
      {showImport && <ImportRepliesModal onApply={handleAnalyze} onClose={() => setShowImport(false)} analyzing={analyzing}/>}

      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Voice & Tone</h2>
        <p className="text-sm text-[#6B7280]">Pick the voice that best matches your brand.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Tone presets */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-[#E5EAE8] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Tone preset</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Choose the voice that fits your brand.</p>
            </div>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 text-xs text-[#0D4C3C] font-medium hover:underline flex-shrink-0 ml-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              Import from replies
            </button>
          </div>
          <div className="p-4 bg-[#FAFAFA] grid grid-cols-2 gap-2">
            {TONE_PRESETS.map(p => (
              <button key={p.key} onClick={() => onChange({ tone: p.key })}
                className={`text-left p-4 rounded-xl border-2 transition-all ${data.tone === p.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] bg-white hover:border-[#0D4C3C]/40 hover:bg-[#F8FAF9]'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-sm font-bold ${data.tone === p.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{p.label}</p>
                  <Radio checked={data.tone === p.key} onClick={() => onChange({ tone: p.key })}/>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right — Custom instructions */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Custom tone instructions</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Extra style notes injected into every AI prompt.</p>
          </div>
          <div className="p-5 bg-[#FAFAFA]">
            <textarea value={data.custom_tone_instructions} onChange={e => onChange({ custom_tone_instructions: e.target.value })}
              placeholder="e.g. Always mention our loyalty program. Use rhetorical questions occasionally. Keep a warm but professional distance."
              rows={6} maxLength={400} className={`${inputCls} resize-none`}/>
            <p className="text-[10px] text-[#9CA3AF] mt-1.5 flex justify-between">
              <span>Beyond the preset — added directly to the AI prompt.</span>
              <span>{data.custom_tone_instructions.length}/400</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Reply Format ──────────────────────────────────────────────────────

function Step3({ data, onChange }: { data: BrandBrainData; onChange: (p: Partial<BrandBrainData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Reply Format</h2>
        <p className="text-sm text-[#6B7280]">Control how AI structures and formats each reply.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Length + Behaviour */}
        <div className="space-y-5">
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Reply length</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA]">
              <div className="flex gap-2">
                {REPLY_LENGTHS.map(opt => (
                  <button key={opt.key} onClick={() => onChange({ reply_length: opt.key })}
                    className={`flex-1 py-3 px-3 rounded-xl border-2 text-sm font-medium transition-all text-center ${data.reply_length === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]' : 'border-[#E5EAE8] bg-white text-[#6B7280] hover:border-[#0D4C3C]/40'}`}>
                    <span className="block font-bold">{opt.label}</span>
                    <span className="block text-xs font-normal mt-0.5 opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Reply behaviour</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA] space-y-2.5">
              {[
                { label: 'Address reviewer by name', sub: 'e.g. "Thank you, Sarah!" when name is available.', field: 'use_customer_name' as const },
                { label: 'Allow emoji in replies', sub: 'Adds occasional emoji when tone allows it.', field: 'use_emoji' as const },
              ].map(item => (
                <div key={item.field} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#E5EAE8]">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{item.label}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{item.sub}</p>
                  </div>
                  <Toggle checked={data[item.field] as boolean} onChange={() => onChange({ [item.field]: !data[item.field] })}/>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Reply signature */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Reply signature</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Appended to every reply. Leave blank to skip.</p>
          </div>
          <div className="px-5 py-5 bg-[#FAFAFA]">
            <input type="text" value={data.reply_signature} onChange={e => onChange({ reply_signature: e.target.value })}
              placeholder="e.g. Warm regards, The Blue Door Café Team" maxLength={120} className={inputCls}/>
            <p className="text-xs text-[#9CA3AF] mt-2">Used as a consistent sign-off across all AI-generated replies.</p>

            {data.reply_signature && (
              <div className="mt-4 p-4 border border-[#E5EAE8] rounded-xl bg-white">
                <p className="text-[10px] text-[#9CA3AF] mb-1.5 font-medium uppercase tracking-wide">Preview</p>
                <p className="text-sm text-[#374151] italic">…and we look forward to seeing you again soon.<br/><span className="not-italic font-medium text-[#111827]">{data.reply_signature}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Language & Rules ──────────────────────────────────────────────────

function Step4({ data, onChange }: { data: BrandBrainData; onChange: (p: Partial<BrandBrainData>) => void }) {
  function setStarRule(bucket: keyof StarRatingRules, field: 'tone' | 'reply_length', value: string | null) {
    const current = data.star_rating_rules;
    const bucketVal = current[bucket] ?? {};
    const updated: StarRatingRules = {
      ...current,
      [bucket]: value ? { ...bucketVal, [field]: value } : { ...bucketVal, [field]: undefined },
    };
    // Clean empty buckets
    if (!updated[bucket]?.tone && !updated[bucket]?.reply_length) delete updated[bucket];
    onChange({ star_rating_rules: updated });
  }

  const starBuckets: { key: keyof StarRatingRules; label: string; stars: string; color: string }[] = [
    { key: 'five_star', label: '5 stars',   stars: '★★★★★', color: 'text-emerald-600' },
    { key: 'mid_star',  label: '3–4 stars', stars: '★★★★☆', color: 'text-amber-500'  },
    { key: 'low_star',  label: '1–2 stars', stars: '★★☆☆☆', color: 'text-red-500'    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Language & Rules</h2>
        <p className="text-sm text-[#6B7280]">Language settings, negative handling, and per-star overrides.</p>
      </div>

      <div className="grid grid-cols-2 gap-5 items-start">
        {/* Left column — Language + Negative handling */}
        <div className="space-y-5">

          {/* Language */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden bg-[#FAFAFA]">
            <div className="px-4 py-3 bg-white border-b border-[#E5EAE8]">
              <h3 className="text-xs font-bold text-[#374151] uppercase tracking-wide">Language</h3>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Primary language</label>
                <SelectField value={data.primary_language} onChange={v => onChange({ primary_language: v })} options={LANGUAGES}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">When reviewer writes in a different language</label>
                <div className="space-y-2">
                  {[
                    { key: 'primary' as const, label: 'Always reply in my primary language' },
                    { key: 'match'   as const, label: "Match the reviewer's language" },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer" onClick={() => onChange({ reviewer_lang_behaviour: opt.key })}>
                      <Radio checked={data.reviewer_lang_behaviour === opt.key} onClick={() => onChange({ reviewer_lang_behaviour: opt.key })}/>
                      <span className="text-sm text-[#374151]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Negative handling */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden bg-[#FAFAFA]">
            <div className="px-4 py-3 bg-white border-b border-[#E5EAE8]">
              <h3 className="text-xs font-bold text-[#374151] uppercase tracking-wide">Negative review handling (1–2 stars)</h3>
            </div>
            <div className="px-4 py-4 space-y-2.5">
              {NEGATIVE_OPTS.map(opt => (
                <div key={opt.key} onClick={() => onChange({ negative_rule: opt.key })}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${data.negative_rule === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] bg-white hover:border-[#0D4C3C]/40'}`}>
                  <div className="mt-0.5"><Radio checked={data.negative_rule === opt.key} onClick={() => onChange({ negative_rule: opt.key })}/></div>
                  <div>
                    <p className={`text-sm font-bold ${data.negative_rule === opt.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{opt.label}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column — Per-star overrides */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden bg-[#FAFAFA]">
          <div className="px-4 py-3 bg-white border-b border-[#E5EAE8]">
            <h3 className="text-xs font-bold text-[#374151] uppercase tracking-wide">Per-star tone & length</h3>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Override tone or length per rating bucket. Leave blank to use defaults.</p>
          </div>
          <div className="divide-y divide-[#E5EAE8]">
            {starBuckets.map(bucket => {
              const rule = data.star_rating_rules[bucket.key];
              return (
                <div key={bucket.key} className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${bucket.color}`}>{bucket.stars}</span>
                    <span className="text-xs font-semibold text-[#374151]">{bucket.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-1 block font-medium">Tone</label>
                      <SelectField value={rule?.tone ?? ''} onChange={v => setStarRule(bucket.key, 'tone', v || null)}
                        options={TONE_PRESETS.map(p => p.label)} placeholder="Default"/>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9CA3AF] mb-1 block font-medium">Length</label>
                      <SelectField value={rule?.reply_length ?? ''} onChange={v => setStarRule(bucket.key, 'reply_length', v || null)}
                        options={REPLY_LENGTHS.map(r => r.key)} placeholder="Default"/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Guardrails ────────────────────────────────────────────────────────

function Step5({ data, onChange }: { data: BrandBrainData; onChange: (p: Partial<BrandBrainData>) => void }) {
  const [kwInput, setKwInput] = useState({ keyword: '', context: '' });

  function addKeyword() {
    if (!kwInput.keyword.trim() || !kwInput.context.trim()) return;
    const newCtx: KeywordContext = { id: Date.now().toString(), keyword: kwInput.keyword.trim(), context: kwInput.context.trim() };
    onChange({ keyword_contexts: [...data.keyword_contexts, newCtx] });
    setKwInput({ keyword: '', context: '' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Guardrails</h2>
        <p className="text-sm text-[#6B7280]">Set boundaries, inject context, and control approval flow.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Prohibited phrases + Keyword contexts */}
        <div className="space-y-5">

          {/* Prohibited phrases */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Prohibited phrases</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Words AI must never use — promises, legal terms, competitor names.</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA]">
              <PhrasesInput phrases={data.prohibited_phrases} onChange={v => onChange({ prohibited_phrases: v })}/>
            </div>
          </div>

          {/* Keyword contexts */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Keyword-triggered context</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Inject context when a review mentions a keyword.</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA] space-y-3">
              {data.keyword_contexts.length > 0 && (
                <div className="space-y-2">
                  {data.keyword_contexts.map(kc => (
                    <div key={kc.id} className="flex items-start gap-2 p-3 bg-white rounded-lg border border-[#E5EAE8]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0D4C3C] mb-0.5">"{kc.keyword}"</p>
                        <p className="text-xs text-[#374151]">{kc.context}</p>
                      </div>
                      <button onClick={() => onChange({ keyword_contexts: data.keyword_contexts.filter(x => x.id !== kc.id) })}
                        className="text-[#9CA3AF] hover:text-red-500 flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4 border border-[#E5EAE8] rounded-xl bg-white space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#9CA3AF] mb-1">Trigger keyword</label>
                    <input type="text" value={kwInput.keyword} onChange={e => setKwInput(p => ({ ...p, keyword: e.target.value }))}
                      placeholder="e.g. parking" className={`${inputCls} py-2`}/>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#9CA3AF] mb-1">Context to inject</label>
                    <input type="text" value={kwInput.context} onChange={e => setKwInput(p => ({ ...p, context: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                      placeholder="e.g. We're adding 50 new spots" className={`${inputCls} py-2`}/>
                  </div>
                </div>
                <button onClick={addKeyword} disabled={!kwInput.keyword.trim() || !kwInput.context.trim()}
                  className="text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-4 py-2 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 transition-colors">
                  Add context rule
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right — Approval queue + Example reply */}
        <div className="space-y-5">

          {/* Approval queue */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Manual approval queue</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Require a human to approve AI drafts before publishing.</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA]">
              <div className="flex gap-2">
                {[
                  { val: 0, label: 'Never',    sub: 'All drafts auto-approved' },
                  { val: 3, label: '≤3 stars', sub: 'Flag negative reviews' },
                  { val: 4, label: '≤4 stars', sub: 'Flag most reviews' },
                  { val: 6, label: 'Always',   sub: 'All drafts need approval' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => onChange({ approval_rules: { require_approval_below: opt.val } })}
                    className={`flex-1 py-2.5 px-2 rounded-xl border-2 text-xs font-medium transition-all text-center ${data.approval_rules.require_approval_below === opt.val ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]' : 'border-[#E5EAE8] bg-white text-[#6B7280] hover:border-[#0D4C3C]/40'}`}>
                    <span className="block font-bold">{opt.label}</span>
                    <span className="block font-normal opacity-70 mt-0.5">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Example reply */}
          <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-[#E5EAE8]">
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Example reply</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">AI uses this as a style reference — paste one you're happy with.</p>
            </div>
            <div className="px-5 py-4 bg-[#FAFAFA]">
              <textarea value={data.example_reply} onChange={e => onChange({ example_reply: e.target.value })}
                placeholder="Paste an example reply you're happy with…" rows={6} maxLength={800} className={`${inputCls} resize-none`}/>
              <p className="text-[10px] text-[#9CA3AF] mt-1 text-right">{data.example_reply.length}/800</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Step 6: Location Overrides ────────────────────────────────────────────────

function OverrideRow({ label, fieldKey, flags, onToggle, inheritedLabel, children }: {
  label: string; fieldKey: keyof OverrideFlags;
  flags: OverrideFlags; onToggle: (k: keyof OverrideFlags) => void;
  inheritedLabel: string; children: React.ReactNode;
}) {
  const active = flags[fieldKey];
  return (
    <div className={`rounded-xl border-2 transition-colors ${active ? 'border-[#0D4C3C]/30 bg-white' : 'border-[#E5EAE8] bg-[#FAFAFA]'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-[#374151]">{label}</span>
          {!active && <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md truncate max-w-[140px]">↑ {inheritedLabel}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-[10px] text-[#9CA3AF]">{active ? 'Override' : 'Inherited'}</span>
          <Toggle checked={active} onChange={() => onToggle(fieldKey)} size="sm"/>
        </div>
      </div>
      {active && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function LocationOverridePanel({ location, globalData, overrideData, flags, onDataChange, onFlagToggle }: {
  location: GoogleLocation;
  globalData: BrandBrainData;
  overrideData: BrandBrainData;
  flags: OverrideFlags;
  onDataChange: (p: Partial<BrandBrainData>) => void;
  onFlagToggle: (k: keyof OverrideFlags) => void;
}) {
  return (
    <div className="space-y-2.5">
      <OverrideRow label="Tone" fieldKey="tone" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={TONE_PRESETS.find(p => p.key === globalData.tone)?.label ?? globalData.tone}>
        <div className="grid grid-cols-2 gap-2">
          {TONE_PRESETS.map(p => (
            <button key={p.key} onClick={() => onDataChange({ tone: p.key })}
              className={`text-left p-3 rounded-lg border-2 transition-all ${overrideData.tone === p.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-xs font-bold ${overrideData.tone === p.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{p.label}</p>
                <Radio checked={overrideData.tone === p.key} onClick={() => onDataChange({ tone: p.key })}/>
              </div>
              <p className="text-[10px] text-[#6B7280]">{p.desc}</p>
            </button>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Custom tone instructions" fieldKey="custom_tone_instructions" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.custom_tone_instructions || 'None'}>
        <textarea value={overrideData.custom_tone_instructions} onChange={e => onDataChange({ custom_tone_instructions: e.target.value })}
          placeholder="Extra tone instructions for this location…" rows={2} className={`${inputCls} resize-none`}/>
      </OverrideRow>

      <OverrideRow label="Reply length" fieldKey="reply_length" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.reply_length}>
        <div className="flex gap-2">
          {REPLY_LENGTHS.map(opt => (
            <button key={opt.key} onClick={() => onDataChange({ reply_length: opt.key })}
              className={`flex-1 py-2 px-2 rounded-lg border-2 text-xs font-medium transition-all text-center ${overrideData.reply_length === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]' : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C]/40'}`}>
              <span className="block font-bold">{opt.label}</span>
              <span className="block font-normal opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Reply signature" fieldKey="reply_signature" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.reply_signature || 'None'}>
        <input type="text" value={overrideData.reply_signature} onChange={e => onDataChange({ reply_signature: e.target.value })}
          placeholder="e.g. The Team at Location Name" maxLength={120} className={inputCls}/>
      </OverrideRow>

      <OverrideRow label="Address reviewer by name" fieldKey="use_customer_name" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.use_customer_name ? 'Yes' : 'No'}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#374151]">Address reviewer by name</p>
          <Toggle checked={overrideData.use_customer_name} onChange={() => onDataChange({ use_customer_name: !overrideData.use_customer_name })}/>
        </div>
      </OverrideRow>

      <OverrideRow label="Allow emoji" fieldKey="use_emoji" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.use_emoji ? 'Yes' : 'No'}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#374151]">Allow emoji in replies</p>
          <Toggle checked={overrideData.use_emoji} onChange={() => onDataChange({ use_emoji: !overrideData.use_emoji })}/>
        </div>
      </OverrideRow>

      <OverrideRow label="Language" fieldKey="primary_language" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.primary_language}>
        <SelectField value={overrideData.primary_language} onChange={v => onDataChange({ primary_language: v })} options={LANGUAGES}/>
      </OverrideRow>

      <OverrideRow label="Negative review handling" fieldKey="negative_rule" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={NEGATIVE_OPTS.find(o => o.key === globalData.negative_rule)?.label ?? globalData.negative_rule}>
        <div className="space-y-1.5">
          {NEGATIVE_OPTS.map(opt => (
            <div key={opt.key} onClick={() => onDataChange({ negative_rule: opt.key })}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${overrideData.negative_rule === opt.key ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
              <Radio checked={overrideData.negative_rule === opt.key} onClick={() => onDataChange({ negative_rule: opt.key })}/>
              <div>
                <p className={`text-xs font-bold ${overrideData.negative_rule === opt.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>{opt.label}</p>
                <p className="text-[10px] text-[#6B7280]">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </OverrideRow>

      <OverrideRow label="Example reply" fieldKey="example_reply" flags={flags} onToggle={onFlagToggle}
        inheritedLabel={globalData.example_reply ? 'Set' : 'Not set'}>
        <textarea value={overrideData.example_reply} onChange={e => onDataChange({ example_reply: e.target.value })}
          placeholder="Example reply specific to this location…" rows={3} maxLength={800} className={`${inputCls} resize-none`}/>
      </OverrideRow>
    </div>
  );
}

function Step6({ locations, locCache, globalData, onDataChange, onFlagToggle }: {
  locations: GoogleLocation[];
  locCache: Record<string, { data: BrandBrainData; flags: OverrideFlags }>;
  globalData: BrandBrainData;
  onDataChange: (locId: string, p: Partial<BrandBrainData>) => void;
  onFlagToggle: (locId: string, k: keyof OverrideFlags) => void;
}) {
  const [selectedLoc, setSelectedLoc] = useState(locations[0]?.id ?? '');
  if (locations.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Location Overrides</h2>
        <div className="mt-6 text-center py-12 border border-[#E5EAE8] rounded-xl bg-[#FAFAFA]">
          <svg className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <p className="text-sm font-medium text-[#374151]">No locations connected yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Connect Google Business Profile in Settings to add location-specific overrides.</p>
        </div>
      </div>
    );
  }

  const loc = locations.find(l => l.id === selectedLoc);
  const cache = locCache[selectedLoc];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[#111827] mb-1">Location Overrides</h2>
        <p className="text-sm text-[#6B7280]">Customise Brand Brain settings per location. Toggle a field to override it.</p>
      </div>
      <div className="flex gap-5">
        {/* Location list */}
        <div className="w-64 flex-shrink-0 space-y-1">
          {locations.map(l => {
            const lflags = locCache[l.id]?.flags;
            const overrides = lflags ? Object.values(lflags).filter(Boolean).length : 0;
            const isActive = selectedLoc === l.id;
            return (
              <button key={l.id} onClick={() => setSelectedLoc(l.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${isActive ? 'border-[#0D4C3C] bg-[#E6F2EE]' : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'}`}>
                <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#0D4C3C]' : 'text-[#374151]'}`}>{l.display_name ?? 'Location'}</p>
                {overrides > 0 && <p className={`text-[10px] mt-0.5 ${isActive ? 'text-[#0D4C3C]' : 'text-[#9CA3AF]'}`}>{overrides} override{overrides !== 1 ? 's' : ''}</p>}
              </button>
            );
          })}
        </div>
        {/* Override form */}
        <div className="flex-1 min-w-0">
          {loc && cache ? (
            <LocationOverridePanel
              location={loc}
              globalData={globalData}
              overrideData={cache.data}
              flags={cache.flags}
              onDataChange={p => onDataChange(selectedLoc, p)}
              onFlagToggle={k => onFlagToggle(selectedLoc, k)}
            />
          ) : (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-[#F3F4F6] rounded-xl"/>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 7: AI Voice Preview ──────────────────────────────────────────────────

function Step7({ data, onGeneratePreview, onSave, saving }: {
  data: BrandBrainData;
  onGeneratePreview: (testReview?: { reviewer_name: string; rating: number; body: string }) => Promise<void>;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{ draft: string; test_review: { reviewer_name: string; rating: number; body: string } } | null>(null);
  const [customReview, setCustomReview] = useState({ reviewer_name: 'Sarah Johnson', rating: 5, body: 'Absolutely loved my experience here! The staff were incredibly friendly and the food was delicious.' });
  const [showCustom, setShowCustom] = useState(false);
  const [previewError, setPreviewError] = useState('');

  async function handlePreview() {
    setGenerating(true); setPreviewError('');
    await onGeneratePreview(showCustom ? customReview : undefined);
    setGenerating(false);
  }

  // get preview result from parent via a callback
  const [previewDraft, setPreviewDraft] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">AI Voice Preview</h2>
        <p className="text-sm text-[#6B7280]">Generate a sample reply using your Brand Brain settings before saving.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Test review config */}
        <div className="border border-[#E5EAE8] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#E5EAE8]">
            <div>
              <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">Test review</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Review to test your Brand Brain voice against.</p>
            </div>
            <button onClick={() => setShowCustom(s => !s)} className="text-xs text-[#0D4C3C] font-medium hover:underline flex-shrink-0 ml-3">
              {showCustom ? 'Use default' : 'Customise'}
            </button>
          </div>
          {showCustom ? (
            <div className="px-5 py-4 bg-[#FAFAFA] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-[#9CA3AF] mb-1">Reviewer name</label>
                  <input type="text" value={customReview.reviewer_name} onChange={e => setCustomReview(p => ({ ...p, reviewer_name: e.target.value }))} className={`${inputCls} py-2`}/>
                </div>
                <div>
                  <label className="block text-[10px] text-[#9CA3AF] mb-1">Rating</label>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setCustomReview(p => ({ ...p, rating: n }))}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${customReview.rating === n ? 'bg-[#0D4C3C] text-white border-[#0D4C3C]' : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#0D4C3C]'}`}>
                        {n}★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[#9CA3AF] mb-1">Review text</label>
                <textarea value={customReview.body} onChange={e => setCustomReview(p => ({ ...p, body: e.target.value }))}
                  rows={4} className={`${inputCls} resize-none`}/>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 bg-[#FAFAFA]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-xs font-bold flex-shrink-0">SJ</div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Sarah Johnson</p>
                  <p className="text-xs text-amber-500">★★★★★ 5 stars</p>
                </div>
              </div>
              <p className="text-sm text-[#374151]">Absolutely loved my experience here! The staff were incredibly friendly and the food was delicious.</p>
            </div>
          )}
        </div>

        {/* Right — AI output + actions */}
        <div className="space-y-4">
          <div className={`border rounded-xl overflow-hidden transition-all ${previewDraft ? 'border-[#0D4C3C]/30 bg-[#F0F7F5]' : 'border-[#E5EAE8] bg-[#FAFAFA]'}`}>
            <div className={`px-5 py-3 border-b flex items-center gap-2 ${previewDraft ? 'border-[#0D4C3C]/20' : 'border-[#E5EAE8] bg-white'}`}>
              <svg className={`w-4 h-4 ${previewDraft ? 'text-[#0D4C3C]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              <p className={`text-xs font-bold uppercase tracking-wide ${previewDraft ? 'text-[#0D4C3C]' : 'text-[#374151]'}`}>AI-generated sample reply</p>
            </div>
            <div className="px-5 py-4 min-h-[140px] flex items-center">
              {previewDraft
                ? <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{previewDraft}</p>
                : <p className="text-sm text-[#9CA3AF] italic">Click "Generate preview" to see how your Brand Brain sounds.</p>
              }
            </div>
          </div>

          <PreviewStepActions
            generating={generating} previewDraft={previewDraft} saving={saving}
            onGenerate={async () => {
              setGenerating(true); setPreviewError('');
              const { draft, error } = await (async () => {
                const r = await brandBrainService.previewVoice(data, showCustom ? customReview : undefined);
                return r;
              })();
              if (error) setPreviewError(error);
              else if (draft) setPreviewDraft(draft);
              setGenerating(false);
            }}
            onSave={onSave}
            error={previewError}
          />
        </div>
      </div>
    </div>
  );
}


function PreviewStepActions({ generating, previewDraft, saving, onGenerate, onSave, error }: {
  generating: boolean; previewDraft: string | null; saving: boolean;
  onGenerate: () => void; onSave: () => void; error: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onGenerate} disabled={generating}
        className="flex items-center gap-2 border border-[#0D4C3C] text-[#0D4C3C] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#E6F2EE] disabled:opacity-50 transition-colors">
        {generating
          ? <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Generating…</>
          : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Generate preview</>
        }
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors">
        {saving
          ? <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Saving…</>
          : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Save Brand Brain</>
        }
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ── Completion score ──────────────────────────────────────────────────────────

function completionScore(d: BrandBrainData) {
  let s = 0;
  if (d.business_name.trim()) s += 20;
  if (d.business_type) s += 10;
  if (d.business_desc.trim()) s += 10;
  if (d.tone) s += 15;
  if (d.example_reply.trim()) s += 20;
  if (d.prohibited_phrases.length > 0) s += 10;
  if (d.reply_length) s += 5;
  if (d.custom_tone_instructions.trim()) s += 5;
  if (d.reply_signature.trim()) s += 5;
  return s;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BrandBrainPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [data, setData] = useState<BrandBrainData>(DEFAULT_DATA);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);

  // Per-location identity overrides (managed in Step 1)
  const [locNameOverrides, setLocNameOverrides] = useState<Record<string, LocIdentityOverride>>({});

  // Per-location full overrides (Step 6)
  const [locCache, setLocCache] = useState<Record<string, { data: BrandBrainData; flags: OverrideFlags; loaded: boolean }>>({});

  // Wizard state
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [stepMask, setStepMask] = useState(63); // bitmask: bit0=step1…bit5=step6; 63=all unlocked; step7 always on

  const visibleSteps = locations.length > 0 ? WIZARD_STEPS : WIZARD_STEPS.filter(s => s.id !== 6);

  useEffect(() => {
    // Load brand_brain_steps entitlement for this plan
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sub } = await supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
      if (!sub) return;
      const { data: ent } = await supabase.from('plan_entitlements').select('value_type, limit_value').eq('plan_id', sub.plan_id).eq('key', 'brand_brain_steps').maybeSingle();
      if (ent) setStepMask(ent.value_type === 'UNLIMITED' ? 63 : ((ent.limit_value ?? 63) & 63));
    })();
  }, []);

  useEffect(() => {
    Promise.all([
      brandBrainService.load(),
      brandBrainService.loadLocations(),
      brandBrainService.loadAllOverrides(),
    ]).then(([globalRes, locsRes, overridesRes]) => {
      if (globalRes.data) { setData(globalRes.data); setCompleted(new Set([1,2,3,4,5,6,7])); }
      const locs = locsRes.data ?? [];
      setLocations(locs);

      // Build locNameOverrides
      const names: Record<string, LocIdentityOverride> = {};
      const cache: Record<string, { data: BrandBrainData; flags: OverrideFlags; loaded: boolean }> = {};

      const allOverrides = overridesRes.data ?? [];
      for (const ov of allOverrides) {
        names[ov.location_id] = {
          business_name: ov.business_name ?? null,
          business_type: (ov as unknown as Record<string, string | null>).business_type ?? null,
          business_desc: (ov as unknown as Record<string, string | null>).business_desc ?? null,
        };

        const flags = { ...DEFAULT_FLAGS };
        const overrideData = { ...(globalRes.data ?? DEFAULT_DATA) };
        const overridable = Object.keys(DEFAULT_FLAGS) as (keyof OverrideFlags)[];
        overridable.forEach(k => {
          const v = (ov as unknown as Record<string, unknown>)[k];
          if (v !== null && v !== undefined && k !== 'business_name') {
            flags[k] = true;
            (overrideData as unknown as Record<string, unknown>)[k] = v;
          }
        });
        if (ov.business_name !== null && ov.business_name !== undefined) flags.business_name = true;
        cache[ov.location_id] = { data: overrideData, flags, loaded: true };
      }

      // Init cache for locations without overrides
      for (const loc of locs) {
        if (!cache[loc.id]) cache[loc.id] = { data: { ...(globalRes.data ?? DEFAULT_DATA) }, flags: { ...DEFAULT_FLAGS }, loaded: true };
        if (!names[loc.id]) names[loc.id] = { business_name: null, business_type: null, business_desc: null };
      }

      setLocNameOverrides(names);
      setLocCache(cache);
      setLoading(false);
    });
  }, []);

  function patch(p: Partial<BrandBrainData>) { setData(prev => ({ ...prev, ...p })); }

  function setLocName(locId: string, field: keyof LocIdentityOverride, value: string | null) {
    setLocNameOverrides(prev => {
      const cur = prev[locId] ?? { business_name: null, business_type: null, business_desc: null };
      return { ...prev, [locId]: { ...cur, [field]: value } };
    });
  }

  function patchLocData(locId: string, p: Partial<BrandBrainData>) {
    setLocCache(prev => ({ ...prev, [locId]: { ...prev[locId]!, data: { ...prev[locId]!.data, ...p } } }));
  }

  function toggleLocFlag(locId: string, key: keyof OverrideFlags) {
    setLocCache(prev => {
      const cur = prev[locId]!;
      const newFlags = { ...cur.flags, [key]: !cur.flags[key] };
      let newData = { ...cur.data };
      if (!newFlags[key]) {
        (newData as unknown as Record<string, unknown>)[key] = (data as unknown as Record<string, unknown>)[key];
      }
      return { ...prev, [locId]: { ...cur, flags: newFlags, data: newData } };
    });
  }

  async function handleAnalyzeVoice(text: string) {
    const replies = text.split('\n\n').map(s => s.trim()).filter(s => s.length > 20);
    const { suggestions, error } = await brandBrainService.analyzeVoice(replies);
    if (error) { setToast({ message: error, type: 'error' }); return; }
    if (suggestions) {
      setData(prev => ({ ...prev, ...suggestions }));
      setToast({ message: 'Voice analyzed! Settings updated with suggestions.', type: 'success' });
    }
  }

  async function handleSave() {
    setSaving(true);

    // Save global
    const { error } = await brandBrainService.save(data);
    if (error) { setToast({ message: error.message, type: 'error' }); setSaving(false); return; }

    // Save location overrides
    for (const locId of locations.map(l => l.id)) {
      const identOv = locNameOverrides[locId];
      const cache = locCache[locId];
      const flags = cache?.flags ?? DEFAULT_FLAGS;
      const hasAny = Object.values(flags).some(Boolean)
        || !!identOv?.business_name || !!identOv?.business_type || !!identOv?.business_desc;

      if (!hasAny) {
        await brandBrainService.deleteOverride(locId);
      } else {
        const cacheData = cache?.data ?? data;
        const payload: Omit<LocationOverride, 'location_id'> = {
          business_name: identOv?.business_name ?? null,
          business_type: identOv?.business_type ?? null,
          business_desc: identOv?.business_desc ?? null,
          tone: flags.tone ? cacheData.tone : null,
          reply_length: flags.reply_length ? cacheData.reply_length : null,
          use_customer_name: flags.use_customer_name ? cacheData.use_customer_name : null,
          use_emoji: flags.use_emoji ? cacheData.use_emoji : null,
          primary_language: flags.primary_language ? cacheData.primary_language : null,
          reviewer_lang_behaviour: flags.reviewer_lang_behaviour ? cacheData.reviewer_lang_behaviour : null,
          negative_rule: flags.negative_rule ? cacheData.negative_rule : null,
          prohibited_phrases: flags.prohibited_phrases ? cacheData.prohibited_phrases : null,
          example_reply: flags.example_reply ? cacheData.example_reply : null,
          custom_tone_instructions: flags.custom_tone_instructions ? cacheData.custom_tone_instructions : null,
          reply_signature: flags.reply_signature ? cacheData.reply_signature : null,
          approval_rules: flags.approval_rules ? cacheData.approval_rules : null,
        };
        await brandBrainService.saveOverride(locId, payload);
      }
    }

    setToast({ message: 'Brand Brain saved.', type: 'success' });
    setCompleted(new Set(visibleSteps.map(s => s.id)));
    setSaving(false);
  }

  function goNext() {
    setCompleted(prev => new Set([...prev, step]));
    const steps = visibleSteps.map(s => s.id);
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]!);
  }

  function goPrev() {
    const steps = visibleSteps.map(s => s.id);
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]!);
  }

  const navigate = useNavigate();
  function jumpTo(n: number) {
    if (n < 0) { navigate('/billing'); return; } // negative = locked step
    setStep(n);
  }

  const score = completionScore(data);
  const stepProgress = visibleSteps.length > 0 ? Math.round((completed.size / visibleSteps.length) * 100) : 0;
  const isLastStep = step === visibleSteps[visibleSteps.length - 1]?.id;
  const isFirstStep = step === visibleSteps[0]?.id;

  if (loading) {
    return (
      <div className="px-10 py-8">
        <div className="h-8 w-48 bg-[#F3F4F6] rounded-lg animate-pulse mb-2"/>
        <div className="flex gap-2 mb-8">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-8 w-24 bg-[#F3F4F6] rounded-full animate-pulse"/>)}</div>
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-[#E5EAE8] h-32 mb-5 animate-pulse"/>)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)}/>}

      {/* Header */}
      <div className="px-10 py-4 border-b border-[#E5EAE8] bg-[#F8FAF9] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Brand Brain</h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Step {visibleSteps.findIndex(s => s.id === step) + 1} of {visibleSteps.length}</p>
          </div>
          {/* Step progress bar */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div className="h-full bg-[#0D4C3C] rounded-full transition-all duration-500"
                style={{ width: `${stepProgress}%` }}/>
            </div>
            <span className="text-xs font-semibold text-[#0D4C3C]">{completed.size}/{visibleSteps.length}</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
          {saving
            ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Saving…</>
            : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Save</>
          }
        </button>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} steps={visibleSteps} completed={completed} stepMask={stepMask} onJump={jumpTo}/>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-8 py-7">
        {step !== 7 && !(stepMask & (1 << (step - 1))) ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
            <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-[#111827]">This step requires an upgrade</p>
              <p className="text-sm text-[#6B7280] mt-1">This step is not included in your current plan. Upgrade to unlock it.</p>
            </div>
            <button onClick={() => navigate('/billing')}
              className="bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
              View Plans
            </button>
          </div>
        ) : (
          <>
            {step === 1 && <Step1 data={data} onChange={patch} locations={locations} locOverrides={locNameOverrides} onLocOverride={setLocName}/>}
            {step === 2 && <Step2 data={data} onChange={patch} onAnalyzeVoice={handleAnalyzeVoice}/>}
            {step === 3 && <Step3 data={data} onChange={patch}/>}
            {step === 4 && <Step4 data={data} onChange={patch}/>}
            {step === 5 && <Step5 data={data} onChange={patch}/>}
            {step === 6 && locations.length > 0 && <Step6 locations={locations} locCache={locCache} globalData={data} onDataChange={patchLocData} onFlagToggle={toggleLocFlag}/>}
            {step === 7 && <Step7 data={data} onGeneratePreview={async (tr) => { const r = await brandBrainService.previewVoice(data, tr); if (r.error) setToast({ message: r.error, type: 'error' }); return; }} onSave={handleSave} saving={saving}/>}
          </>
        )}
      </div>

      {/* Navigation footer */}
      <div className="px-10 py-4 bg-[#F8FAF9] flex items-center justify-between flex-shrink-0">
        <button onClick={goPrev} disabled={isFirstStep}
          className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] px-4 py-2 rounded-xl hover:bg-[#F3F4F6] disabled:opacity-0 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div className="flex items-center gap-1.5">
          {visibleSteps.map(s => (
            <button key={s.id} onClick={() => jumpTo(s.id)}
              className={`w-2 h-2 rounded-full transition-all ${s.id === step ? 'bg-[#0D4C3C] w-4' : completed.has(s.id) ? 'bg-[#0D4C3C]/40' : 'bg-[#E5E7EB]'}`}/>
          ))}
        </div>
        {!isLastStep ? (
          <button onClick={goNext}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            {saving ? 'Saving…' : 'Save & Finish'}
          </button>
        )}
      </div>
    </div>
  );
}
