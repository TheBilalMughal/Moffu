import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  marketingService, GeneratePostResult, Variant,
  POST_TYPES, TARGET_PLATFORMS, PLATFORM_LABELS,
} from './marketingService';
import { useLocationStore } from '@/features/location/location.store';

// ── Copy icon ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  return (
    <button onClick={copy} title="Copy" className="p-1 rounded text-[#9CA3AF] hover:text-[#6C55E8] transition-colors flex-shrink-0">
      {copied
        ? <svg className="w-3.5 h-3.5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      }
    </button>
  );
}

// ── Variant card ───────────────────────────────────────────────────────────────

function VariantCard({ index, variantData, platforms }: {
  index: number;
  variantData: Record<string, Variant>;
  platforms: string[];
}) {
  const availPlatforms = platforms.filter(p => variantData[p]);
  const [activePlatform, setActivePlatform] = useState(availPlatforms[0] ?? '');
  const v = variantData[activePlatform];

  function downloadText() {
    if (!v) return;
    const text = `CAPTION:\n${v.caption}\n\nHASHTAGS:\n${v.hashtags.join(' ')}\n\nIMAGE HINT:\n${v.image_hint}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-variant-${index + 1}-${activePlatform}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <p className="text-sm font-bold text-[#111827]">Variant {index + 1}</p>
        <button
          onClick={downloadText}
          className="flex items-center gap-1.5 text-xs font-medium text-[#6C55E8] border border-[#6C55E8]/30 px-3 py-1.5 rounded-lg hover:bg-[#EDE9FE] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Download
        </button>
      </div>

      {/* Platform tabs */}
      {availPlatforms.length > 1 && (
        <div className="flex border-b border-[#F3F4F6]">
          {availPlatforms.map(p => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${activePlatform === p ? 'text-[#6C55E8] border-b-2 border-[#6C55E8] -mb-px' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
            >
              {PLATFORM_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {v ? (
        <div className="px-5 py-4 space-y-4">
          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Caption</p>
              <CopyButton text={v.caption} />
            </div>
            <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{v.caption}</p>
          </div>

          {/* Hashtags */}
          {v.hashtags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Hashtags</p>
                <CopyButton text={v.hashtags.join(' ')} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.hashtags.map(h => (
                  <span key={h} className="text-xs text-[#6C55E8] bg-[#EDE9FE] px-2 py-0.5 rounded-lg font-medium">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Image hint */}
          {v.image_hint && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Image Suggestion</p>
                <CopyButton text={v.image_hint} />
              </div>
              <p className="text-xs text-[#6B7280] italic">{v.image_hint}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No content for this platform.</div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Step = 'configure' | 'generating' | 'results';

export function NewPostPage() {
  const navigate = useNavigate();
  const { selectedId: locationId } = useLocationStore();

  const [step, setStep] = useState<Step>('configure');
  const [result, setResult] = useState<GeneratePostResult | null>(null);
  const [error, setError] = useState('');

  // Configure form state
  const [platform, setPlatform] = useState('all');
  const [postType, setPostType] = useState('');
  const [userContext, setUserContext] = useState('');
  const [variantCount, setVariantCount] = useState(3);

  async function generate() {
    if (!postType) { setError('Select a post type.'); return; }
    setError('');
    setStep('generating');

    const params: Parameters<typeof marketingService.generatePost>[0] = { platform, post_type: postType, variant_count: variantCount };
    if (userContext.trim()) params.user_context = userContext.trim();
    if (locationId) params.location_id = locationId;
    const res = await marketingService.generatePost(params);

    if (res.error) {
      setError(res.error);
      setStep('configure');
      return;
    }

    setResult(res);
    setStep('results');
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/marketing')}
          className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Create Post</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">AI-generated social media content for your platforms.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {step === 'configure' && (
          <div className="max-w-2xl space-y-6">
            {/* Platform */}
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-3">Platform</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { value: 'all', label: 'All Platforms' },
                  ...TARGET_PLATFORMS,
                ].map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${platform === p.value ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8]' : 'border-[#E5E7EB] text-[#374151] hover:border-[#6C55E8]/40'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Post type */}
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-3">Post Type</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {POST_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setPostType(t.value)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${postType === t.value ? 'border-[#6C55E8] bg-[#EDE9FE]' : 'border-[#E5E7EB] hover:border-[#6C55E8]/40'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${postType === t.value ? 'border-[#6C55E8]' : 'border-[#D1D5DB]'}`}>
                      {postType === t.value && <div className="w-2.5 h-2.5 rounded-full bg-[#111827]"/>}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${postType === t.value ? 'text-[#6C55E8]' : 'text-[#111827]'}`}>{t.label}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Context (optional) */}
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-1.5">
                Context / Topic <span className="text-[#9CA3AF] font-normal">(optional)</span>
              </p>
              <textarea
                value={userContext}
                onChange={e => setUserContext(e.target.value)}
                placeholder="Describe what this post is about, a special offer, event, or any extra instructions…"
                rows={3}
                maxLength={500}
                className="w-full text-sm text-[#111827] border border-[#D1D5DB] rounded-xl px-4 py-3 focus:outline-none focus:border-[#6C55E8] transition-colors placeholder:text-[#9CA3AF] bg-white resize-none"
              />
            </div>

            {/* Variants */}
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-3">Number of Variants</p>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setVariantCount(n)}
                    className={`w-14 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${variantCount === n ? 'border-[#6C55E8] bg-[#EDE9FE] text-[#6C55E8]' : 'border-[#E5E7EB] text-[#374151] hover:border-[#6C55E8]/40'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={generate}
              disabled={!postType}
              className="flex items-center gap-2 bg-[#111827] hover:bg-[#6C55E8] disabled:opacity-50 text-white text-sm font-bold px-7 py-3 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Generate
            </button>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center h-72 gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#6C55E8] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-[#111827]">Generating your posts…</p>
              <p className="text-sm text-[#9CA3AF] mt-1">AI is crafting {variantCount} variant{variantCount !== 1 ? 's' : ''} for you.</p>
            </div>
          </div>
        )}

        {step === 'results' && result && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-base font-bold text-[#111827]">{result.variants.length} Variant{result.variants.length !== 1 ? 's' : ''} Generated</p>
                <p className="text-sm text-[#6B7280]">
                  For {result.platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')}. Copy captions and hashtags to use in your apps.
                </p>
              </div>
              <button
                onClick={() => { setStep('configure'); setResult(null); }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#6C55E8] border border-[#6C55E8]/30 px-4 py-2 rounded-xl hover:bg-[#EDE9FE] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Post
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {result.variants.map((variantData, i) => (
                <VariantCard
                  key={i}
                  index={i}
                  variantData={variantData}
                  platforms={result.platforms}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
