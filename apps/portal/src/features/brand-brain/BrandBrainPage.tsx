import { useState } from 'react';

const TONE_PRESETS = [
  { key: 'professional', label: 'Professional', desc: 'Formal, polished, brand-forward.' },
  { key: 'friendly', label: 'Friendly', desc: 'Warm, approachable, conversational.' },
  { key: 'formal', label: 'Formal', desc: 'Structured and respectful. Suits legal, medical, finance.' },
  { key: 'casual', label: 'Casual', desc: 'Relaxed and natural. Great for lifestyle and food brands.' },
] as const;

type ToneKey = (typeof TONE_PRESETS)[number]['key'];

const BUSINESS_TYPES = [
  'Restaurant / Cafe', 'Retail Store', 'Hotel / Hospitality', 'Healthcare / Medical',
  'Legal / Finance', 'Beauty / Wellness', 'Education', 'Automotive',
  'Real Estate', 'Technology / SaaS', 'Other',
];

const REPLY_LENGTHS = [
  { key: 'short', label: 'Short', desc: '1–2 sentences' },
  { key: 'medium', label: 'Medium', desc: '3–4 sentences' },
  { key: 'long', label: 'Long', desc: '5+ sentences' },
] as const;

type ReplyLengthKey = (typeof REPLY_LENGTHS)[number]['key'];

const NEGATIVE_REVIEW_OPTIONS = [
  { key: 'manual', label: 'Flag for manual review', desc: 'No draft — you handle it directly.' },
  { key: 'cautious', label: 'Generate a cautious draft', desc: 'AI creates a careful, empathetic draft for your approval.' },
  { key: 'normal', label: 'Reply normally', desc: 'Treat like any other review.' },
] as const;

type NegativeRuleKey = (typeof NEGATIVE_REVIEW_OPTIONS)[number]['key'];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Radio({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${checked ? 'border-[#0D4C3C]' : 'border-[#D1D5DB]'}`}
    >
      {checked && <div className="w-2 h-2 rounded-full bg-[#0D4C3C]" />}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
      <div className="grid grid-cols-[280px_1fr] divide-x divide-[#F3F4F6]">
        <div className="px-6 py-6">
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">{description}</p>
        </div>
        <div className="px-6 py-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition-colors placeholder:text-[#9CA3AF] bg-white';

export function BrandBrainPage() {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessDesc, setBusinessDesc] = useState('');
  const [tone, setTone] = useState<ToneKey>('professional');
  const [replyLength, setReplyLength] = useState<ReplyLengthKey>('medium');
  const [useCustomerName, setUseCustomerName] = useState(true);
  const [useEmoji, setUseEmoji] = useState(false);
  const [primaryLanguage, setPrimaryLanguage] = useState('English');
  const [reviewerLang, setReviewerLang] = useState<'primary' | 'match'>('primary');
  const [negativeRule, setNegativeRule] = useState<NegativeRuleKey>('cautious');
  const [prohibitedInput, setProhibitedInput] = useState('');
  const [prohibitedPhrases, setProhibitedPhrases] = useState<string[]>([]);
  const [exampleReply, setExampleReply] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function addPhrase() {
    const trimmed = prohibitedInput.trim();
    if (trimmed && !prohibitedPhrases.includes(trimmed)) {
      setProhibitedPhrases((prev) => [...prev, trimmed]);
    }
    setProhibitedInput('');
  }

  async function handleSave() {
    setSaving(true);
    // TODO: persist to brand_brain table via Supabase (Phase 3 backend)
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Brand Brain</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Define your business identity and voice so AI writes replies that sound like you.
        </p>
      </div>

      {/* Business info */}
      <Section
        title="Business info"
        description="Basic details about your business. These personalise every AI-generated reply."
      >
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Business name</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. The Blue Door Café"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Business type</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputCls}>
            <option value="">Select a type…</option>
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
            Short description <span className="text-[#9CA3AF] font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={businessDesc}
            onChange={(e) => setBusinessDesc(e.target.value)}
            placeholder="One sentence about what makes your business unique."
            rows={2}
            maxLength={200}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-[#9CA3AF] mt-1 text-right">{businessDesc.length}/200</p>
        </div>
      </Section>

      {/* Tone */}
      <Section
        title="Tone & personality"
        description="Pick the voice that best matches your brand. Adjustable per location later."
      >
        <div className="grid grid-cols-2 gap-2.5">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setTone(preset.key)}
              className={`text-left p-3.5 rounded-lg border transition-all ${
                tone === preset.key
                  ? 'border-[#0D4C3C] bg-[#E6F2EE]'
                  : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40 hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-semibold ${tone === preset.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
                  {preset.label}
                </p>
                <Radio checked={tone === preset.key} onClick={() => setTone(preset.key)} />
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{preset.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Reply settings */}
      <Section
        title="Reply settings"
        description="Control how AI structures and formats each reply."
      >
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Reply length</label>
          <div className="flex gap-2">
            {REPLY_LENGTHS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setReplyLength(opt.key)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                  replyLength === opt.key
                    ? 'border-[#0D4C3C] bg-[#E6F2EE] text-[#0D4C3C]'
                    : 'border-[#E5EAE8] text-[#6B7280] hover:border-[#0D4C3C]/40'
                }`}
              >
                <span className="block">{opt.label}</span>
                <span className="block text-xs font-normal mt-0.5 opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Reply behaviour</label>
          {[
            {
              label: 'Address reviewer by name',
              sub: 'e.g. "Thank you, Sarah!" when name is available.',
              checked: useCustomerName,
              toggle: () => setUseCustomerName(!useCustomerName),
            },
            {
              label: 'Allow emoji in replies',
              sub: 'Adds occasional emoji when tone allows it.',
              checked: useEmoji,
              toggle: () => setUseEmoji(!useEmoji),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-4 py-3 bg-[#F8FAF9] rounded-lg border border-[#E5EAE8]"
            >
              <div>
                <p className="text-sm font-medium text-[#111827]">{item.label}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{item.sub}</p>
              </div>
              <Toggle checked={item.checked} onChange={item.toggle} />
            </div>
          ))}
        </div>
      </Section>

      {/* Language */}
      <Section
        title="Language"
        description="Set the primary language and how to handle reviewers who write in a different one."
      >
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Primary language</label>
          <select value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} className={inputCls}>
            {['English', 'Urdu', 'Arabic', 'French', 'Spanish', 'German', 'Hindi', 'Turkish', 'Malay', 'Indonesian'].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-2">When reviewer writes in a different language</label>
          <div className="space-y-2">
            {[
              { key: 'primary' as const, label: 'Always reply in my primary language' },
              { key: 'match' as const, label: "Match the reviewer's language" },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                <Radio checked={reviewerLang === opt.key} onClick={() => setReviewerLang(opt.key)} />
                <span className="text-sm text-[#374151]">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* Negative review rules */}
      <Section
        title="Negative review handling"
        description="How AI responds when a review has 1–2 stars or contains a complaint."
      >
        <div className="space-y-2">
          {NEGATIVE_REVIEW_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              onClick={() => setNegativeRule(opt.key)}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                negativeRule === opt.key
                  ? 'border-[#0D4C3C] bg-[#E6F2EE]'
                  : 'border-[#E5EAE8] hover:border-[#0D4C3C]/40'
              }`}
            >
              <div className="mt-0.5">
                <Radio checked={negativeRule === opt.key} onClick={() => setNegativeRule(opt.key)} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${negativeRule === opt.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* Prohibited phrases */}
      <Section
        title="Prohibited phrases"
        description="Words or phrases AI must never use — promises, legal terms, competitor names, etc."
      >
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={prohibitedInput}
              onChange={(e) => setProhibitedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhrase(); } }}
              placeholder="Type a phrase and press Enter"
              className={inputCls}
            />
            <button
              onClick={addPhrase}
              disabled={!prohibitedInput.trim()}
              className="text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-4 py-2.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Add
            </button>
          </div>
          {prohibitedPhrases.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {prohibitedPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-[#F3F4F6] border border-[#E5EAE8] px-3 py-1.5 rounded-lg"
                >
                  {phrase}
                  <button
                    onClick={() => setProhibitedPhrases((prev) => prev.filter((p) => p !== phrase))}
                    className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                    aria-label={`Remove ${phrase}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] mt-3">No prohibited phrases added yet.</p>
          )}
        </div>
      </Section>

      {/* Example reply */}
      <Section
        title="Example reply"
        description="Paste a reply you've written that captures your voice. AI uses it as a style reference."
      >
        <div>
          <textarea
            value={exampleReply}
            onChange={(e) => setExampleReply(e.target.value)}
            placeholder="Paste an example reply you're happy with…"
            rows={4}
            maxLength={800}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-[#9CA3AF] mt-1 text-right">{exampleReply.length}/800</p>
        </div>
      </Section>

      {/* Save bar */}
      <div className="flex items-center gap-3 py-2 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0D4C3C] hover:bg-[#083F32] disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Brand Brain'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#0D4C3C] font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
