import { useState } from 'react';

const TONE_PRESETS = [
  {
    key: 'professional',
    label: 'Professional',
    desc: 'Formal, polished, and brand-forward. Best for corporate or B2B businesses.',
  },
  {
    key: 'friendly',
    label: 'Friendly',
    desc: 'Warm, approachable, and conversational. Great for local or consumer-facing brands.',
  },
  {
    key: 'formal',
    label: 'Formal',
    desc: 'Structured and respectful tone with minimal contractions. Suits legal, medical, or finance.',
  },
  {
    key: 'casual',
    label: 'Casual',
    desc: 'Relaxed and natural. Works well for lifestyle, food, and entertainment brands.',
  },
] as const;

type ToneKey = (typeof TONE_PRESETS)[number]['key'];

const BUSINESS_TYPES = [
  'Restaurant / Cafe',
  'Retail Store',
  'Hotel / Hospitality',
  'Healthcare / Medical',
  'Legal / Finance',
  'Beauty / Wellness',
  'Education',
  'Automotive',
  'Real Estate',
  'Technology / SaaS',
  'Other',
];

const REPLY_LENGTHS = [
  { key: 'short', label: 'Short', desc: '1–2 sentences' },
  { key: 'medium', label: 'Medium', desc: '3–4 sentences' },
  { key: 'long', label: 'Long', desc: '5+ sentences' },
] as const;

type ReplyLengthKey = (typeof REPLY_LENGTHS)[number]['key'];

const REVIEWER_LANG_OPTIONS = [
  { key: 'primary', label: 'Always reply in my primary language' },
  { key: 'match', label: "Match the reviewer's language" },
] as const;

const NEGATIVE_REVIEW_OPTIONS = [
  { key: 'manual', label: 'Flag for manual review', desc: 'No draft generated — you handle it directly.' },
  { key: 'cautious', label: 'Generate a cautious draft', desc: 'AI creates a careful, empathetic draft for your review.' },
  { key: 'normal', label: 'Reply normally', desc: 'Treat like any other review.' },
] as const;

type NegativeRuleKey = (typeof NEGATIVE_REVIEW_OPTIONS)[number]['key'];

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-[#F3F4F6]">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">{children}</label>;
}

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

  function removePhrase(phrase: string) {
    setProhibitedPhrases((prev) => prev.filter((p) => p !== phrase));
  }

  async function handleSave() {
    setSaving(true);
    // TODO Phase 3 backend: persist to brand_brain table via Supabase
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Brand Brain</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Define your business identity and voice so AI can write replies that sound like you.
        </p>
      </div>

      {/* Business Info */}
      <SectionCard
        title="Business info"
        description="Basic details about your business. Used to personalise every reply."
      >
        <div className="space-y-4">
          <div>
            <FieldLabel>Business name</FieldLabel>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. The Blue Door Café"
              className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition-colors placeholder:text-[#9CA3AF]"
            />
          </div>
          <div>
            <FieldLabel>Business type</FieldLabel>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition-colors bg-white"
            >
              <option value="">Select a type…</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Short description <span className="normal-case text-[#9CA3AF] font-normal">(optional)</span></FieldLabel>
            <textarea
              value={businessDesc}
              onChange={(e) => setBusinessDesc(e.target.value)}
              placeholder="A brief sentence about what makes your business unique."
              rows={2}
              maxLength={200}
              className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none transition-colors placeholder:text-[#9CA3AF]"
            />
            <p className="text-xs text-[#9CA3AF] mt-1 text-right">{businessDesc.length}/200</p>
          </div>
        </div>
      </SectionCard>

      {/* Tone & Personality */}
      <SectionCard
        title="Tone & personality"
        description="Pick the voice that best matches your brand. You can adjust per-location later."
      >
        <div className="grid grid-cols-2 gap-3">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setTone(preset.key)}
              className={`text-left p-4 rounded-lg border transition-all ${
                tone === preset.key
                  ? 'border-[#0D4C3C] bg-[#E6F2EE]'
                  : 'border-[#E5EAE8] bg-white hover:border-[#0D4C3C]/40 hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className={`text-sm font-semibold ${tone === preset.key ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
                  {preset.label}
                </p>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  tone === preset.key ? 'border-[#0D4C3C]' : 'border-[#D1D5DB]'
                }`}>
                  {tone === preset.key && (
                    <div className="w-2 h-2 rounded-full bg-[#0D4C3C]" />
                  )}
                </div>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{preset.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Reply settings */}
      <SectionCard
        title="Reply settings"
        description="Control how AI structures and formats replies."
      >
        <div className="space-y-5">
          <div>
            <FieldLabel>Reply length</FieldLabel>
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

          <div className="space-y-3">
            <FieldLabel>Reply behaviour</FieldLabel>
            <label className="flex items-center justify-between py-3 px-4 bg-[#F8FAF9] rounded-lg border border-[#E5EAE8] cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[#111827]">Address reviewer by name</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">e.g. "Thank you, Sarah!" when name is available.</p>
              </div>
              <button
                role="switch"
                aria-checked={useCustomerName}
                onClick={() => setUseCustomerName(!useCustomerName)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  useCustomerName ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  useCustomerName ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>

            <label className="flex items-center justify-between py-3 px-4 bg-[#F8FAF9] rounded-lg border border-[#E5EAE8] cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[#111827]">Allow emoji in replies</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Adds occasional emoji when tone allows it.</p>
              </div>
              <button
                role="switch"
                aria-checked={useEmoji}
                onClick={() => setUseEmoji(!useEmoji)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  useEmoji ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  useEmoji ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Language */}
      <SectionCard
        title="Language"
        description="Set the primary language for AI replies and how to handle multilingual reviewers."
      >
        <div className="space-y-4">
          <div>
            <FieldLabel>Primary language</FieldLabel>
            <select
              value={primaryLanguage}
              onChange={(e) => setPrimaryLanguage(e.target.value)}
              className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition-colors bg-white"
            >
              {['English', 'Urdu', 'Arabic', 'French', 'Spanish', 'German', 'Hindi', 'Turkish', 'Malay', 'Indonesian'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>When reviewer writes in a different language</FieldLabel>
            <div className="space-y-2">
              {REVIEWER_LANG_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setReviewerLang(opt.key)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${
                      reviewerLang === opt.key ? 'border-[#0D4C3C]' : 'border-[#D1D5DB]'
                    }`}
                  >
                    {reviewerLang === opt.key && <div className="w-2 h-2 rounded-full bg-[#0D4C3C]" />}
                  </div>
                  <span className="text-sm text-[#374151]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Negative review rules */}
      <SectionCard
        title="Negative review handling"
        description="How should AI respond when a review has 1–2 stars or contains a complaint?"
      >
        <div className="space-y-2">
          {NEGATIVE_REVIEW_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              onClick={() => setNegativeRule(opt.key)}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                negativeRule === opt.key
                  ? 'border-[#0D4C3C] bg-[#E6F2EE]'
                  : 'border-[#E5EAE8] bg-white hover:border-[#0D4C3C]/40'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                negativeRule === opt.key ? 'border-[#0D4C3C]' : 'border-[#D1D5DB]'
              }`}>
                {negativeRule === opt.key && <div className="w-2 h-2 rounded-full bg-[#0D4C3C]" />}
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
      </SectionCard>

      {/* Prohibited phrases */}
      <SectionCard
        title="Prohibited phrases"
        description="Words or phrases AI must never include in replies (promises, legal terms, competitor names, etc.)."
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={prohibitedInput}
              onChange={(e) => setProhibitedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhrase(); } }}
              placeholder="Type a phrase and press Enter"
              className="flex-1 text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] transition-colors placeholder:text-[#9CA3AF]"
            />
            <button
              onClick={addPhrase}
              disabled={!prohibitedInput.trim()}
              className="text-sm font-medium text-[#0D4C3C] border border-[#0D4C3C] px-4 py-2.5 rounded-lg hover:bg-[#E6F2EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          {prohibitedPhrases.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {prohibitedPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-[#F3F4F6] border border-[#E5EAE8] px-3 py-1.5 rounded-lg"
                >
                  {phrase}
                  <button
                    onClick={() => removePhrase(phrase)}
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
            <p className="text-xs text-[#9CA3AF]">No prohibited phrases added yet.</p>
          )}
        </div>
      </SectionCard>

      {/* Example reply */}
      <SectionCard
        title="Example reply"
        description="Optionally paste a reply you've written that captures your voice. AI will use it as a style reference."
      >
        <textarea
          value={exampleReply}
          onChange={(e) => setExampleReply(e.target.value)}
          placeholder="Paste an example reply you're happy with…"
          rows={4}
          maxLength={800}
          className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none transition-colors placeholder:text-[#9CA3AF]"
        />
        <p className="text-xs text-[#9CA3AF] mt-1 text-right">{exampleReply.length}/800</p>
      </SectionCard>

      {/* Save */}
      <div className="flex items-center gap-3 pb-8">
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
        <p className="text-xs text-[#9CA3AF] ml-auto">
          Backend persistence coming in Phase 3 backend.
        </p>
      </div>
    </div>
  );
}
