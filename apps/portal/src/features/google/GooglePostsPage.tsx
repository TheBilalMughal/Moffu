import { useEffect, useState, type ReactNode } from 'react';
import { useLocationStore } from '@/features/location/location.store';
import { googleService } from './google.service';

// ── helpers ──────────────────────────────────────────────────────────────────
const panel = 'rounded-xl border border-[#E5E7EB] bg-white';

const CTA_OPTIONS = [
  { value: '', label: 'No button' },
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'CALL', label: 'Call now' },
];

const TOPIC_TYPES = [
  {
    value: 'STANDARD' as const,
    label: "What's New",
    desc: 'Share a general update, announcement, or news about your business.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l5 5v9a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
      </svg>
    ),
  },
  {
    value: 'EVENT' as const,
    label: 'Event',
    desc: 'Promote an event at your business, like a sale, grand opening, or workshop.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    value: 'OFFER' as const,
    label: 'Offer',
    desc: 'Share a special offer, discount, or deal that customers can redeem.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
];

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function number(n: number | null | undefined) { return n == null ? '—' : n.toLocaleString(); }

type PostRow = {
  name: string;
  summary: string | null;
  post_type: string | null;
  state: string | null;
  created_at: string | null;
  cta_type: string | null;
  views: number | null;
  clicks: number | null;
};

// ── Post type badge ───────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    STANDARD: { label: "What's New", cls: 'bg-[#F5F3FF] text-[#6C55E8]' },
    EVENT:    { label: 'Event',       cls: 'bg-blue-50 text-blue-700' },
    OFFER:    { label: 'Offer',       cls: 'bg-amber-50 text-amber-700' },
  };
  const item = map[type ?? ''] ?? { label: type ?? 'Post', cls: 'bg-[#F3F4F6] text-[#6B7280]' };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${item.cls}`}>{item.label}</span>;
}

// ── State badge ───────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: string | null }) {
  const live = state === 'LIVE';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-[#D1D5DB]'}`} />
      {state ?? 'Unknown'}
    </span>
  );
}

// ── Google character counter ──────────────────────────────────────────────────
function CharCounter({ value, max }: { value: string; max: number }) {
  const rem = max - value.length;
  return (
    <span className={`text-[11px] tabular-nums ${rem < 100 ? 'text-amber-600' : rem < 50 ? 'text-red-600' : 'text-[#9CA3AF]'}`}>
      {rem} remaining
    </span>
  );
}

// ── Preview card ─────────────────────────────────────────────────────────────
function PostPreview({
  topicType, summary, photoUrl, eventTitle, eventStart, eventEnd, ctaType,
}: {
  topicType: 'STANDARD' | 'EVENT' | 'OFFER';
  summary: string;
  photoUrl: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  ctaType: string;
}) {
  const hasPhoto = !!photoUrl.trim();
  const hasCta   = !!ctaType;
  const hasEvent = (topicType === 'EVENT' || topicType === 'OFFER') && eventTitle;
  const ctaLabel = CTA_OPTIONS.find(o => o.value === ctaType)?.label ?? ctaType;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
      {/* Google Maps-style header */}
      <div className="flex items-center gap-2 border-b border-[#F3F4F6] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-[#111827]">Your Business</p>
          <p className="text-[10px] text-[#9CA3AF]">Google Business Profile preview</p>
        </div>
      </div>

      {/* Photo placeholder / image */}
      {hasPhoto ? (
        <img src={photoUrl} alt="Post media" className="h-40 w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="flex h-36 items-center justify-center bg-[#F9FAFB] border-b border-[#F3F4F6]">
          <div className="text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <p className="text-[11px] text-[#9CA3AF]">Add a photo to increase engagement</p>
          </div>
        </div>
      )}

      <div className="p-4">
        {hasEvent && (
          <div className="mb-2 flex items-center gap-2">
            <TypeBadge type={topicType} />
            <span className="text-[11px] text-[#6B7280]">{eventTitle}</span>
          </div>
        )}
        {hasEvent && eventStart && eventEnd && (
          <p className="mb-2 text-[11px] text-[#6B7280]">
            {fmtDate(eventStart)} — {fmtDate(eventEnd)}
          </p>
        )}
        <p className="text-xs leading-relaxed text-[#374151] line-clamp-4">
          {summary || <span className="italic text-[#9CA3AF]">Your post text will appear here…</span>}
        </p>
        {hasCta && (
          <button type="button" disabled
            className="mt-3 w-full rounded-lg border border-[#6C55E8] py-2 text-xs font-semibold text-[#6C55E8]">
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm leading-relaxed text-[#6B7280]">{children}</p>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function GooglePostsPage() {
  const locationId = useLocationStore(s => s.selectedId);

  // Post list
  type ExtraData = Awaited<ReturnType<typeof googleService.fetchExtraData>>['data'];
  const [extraData, setExtraData]     = useState<ExtraData>(undefined);
  const [extraLoading, setExtraLoading] = useState(false);
  const [extraError, setExtraError]   = useState('');
  const [revision, setRevision]       = useState(0);

  useEffect(() => {
    if (!locationId) { setExtraData(undefined); setExtraLoading(false); return; }
    let alive = true;
    setExtraLoading(true); setExtraData(undefined); setExtraError('');
    googleService.fetchExtraData(locationId).then(r => {
      if (alive) { setExtraData(r.data); setExtraError(r.error ?? ''); setExtraLoading(false); }
    }).catch(() => {
      if (alive) { setExtraData(undefined); setExtraError('Could not load posts. Check your Google connection.'); setExtraLoading(false); }
    });
    return () => { alive = false; };
  }, [locationId, revision]);

  // Create form state
  const [topicType, setTopicType] = useState<'STANDARD' | 'EVENT' | 'OFFER'>('STANDARD');
  const [summary,   setSummary]   = useState('');
  const [photoUrl,  setPhotoUrl]  = useState('');
  const [ctaType,   setCtaType]   = useState('');
  const [ctaUrl,    setCtaUrl]    = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd,   setEventEnd]   = useState('');
  const [offerCode,  setOfferCode]  = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  const needsEvent = topicType === 'EVENT' || topicType === 'OFFER';
  const needsUrl   = ctaType && ctaType !== 'CALL';

  function resetForm() {
    setSummary(''); setPhotoUrl(''); setCtaType(''); setCtaUrl('');
    setEventTitle(''); setEventStart(''); setEventEnd('');
    setOfferCode(''); setOfferTerms(''); setTopicType('STANDARD');
    setCreateError(''); setCreateSuccess(false);
  }

  async function handlePublish() {
    setCreateError(''); setCreateSuccess(false);
    if (!locationId)        { setCreateError('Select a location from the top bar.'); return; }
    if (!summary.trim())    { setCreateError('Post text is required.'); return; }
    if (needsEvent && !eventTitle.trim()) { setCreateError('Event / offer title is required.'); return; }
    if (needsEvent && (!eventStart || !eventEnd)) { setCreateError('Start and end dates are required.'); return; }
    if (needsUrl && !ctaUrl.trim()) { setCreateError('CTA URL is required for this button type.'); return; }
    setCreating(true);
    const res = await googleService.createGooglePost(locationId, {
      summary,
      topic_type: topicType,
      cta_type: ctaType || undefined,
      cta_url: ctaUrl || undefined,
      event_title: eventTitle || undefined,
      event_start_date: eventStart || undefined,
      event_end_date: eventEnd || undefined,
    });
    setCreating(false);
    if (res.error) { setCreateError(res.error); return; }
    setCreateSuccess(true);
    setTimeout(() => { resetForm(); setRevision(n => n + 1); }, 2000);
  }

  const posts = extraData?.posts ?? [];

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[#111827]">Google Business Posts</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
          Create posts that appear on your Google Business Profile in Search and Maps. Posts can include updates, events, and offers.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* ── Left: create form ─────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Post type selector */}
          <section className={panel}>
            <div className="border-b border-[#F3F4F6] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#111827]">Post type</h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">Choose the category that best describes this post.</p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {TOPIC_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setTopicType(t.value)}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${topicType === t.value ? 'border-[#6C55E8] bg-[#F5F3FF]' : 'border-[#E5E7EB] bg-[#FAFAFA] hover:border-[#6C55E8]/40'}`}>
                  <span className={topicType === t.value ? 'text-[#6C55E8]' : 'text-[#6B7280]'}>{t.icon}</span>
                  <span className={`text-xs font-semibold ${topicType === t.value ? 'text-[#6C55E8]' : 'text-[#374151]'}`}>{t.label}</span>
                  <span className="text-[11px] leading-relaxed text-[#9CA3AF]">{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Event / Offer details */}
          {needsEvent && (
            <section className={panel}>
              <div className="border-b border-[#F3F4F6] px-5 py-4">
                <h2 className="text-sm font-semibold text-[#111827]">{topicType === 'OFFER' ? 'Offer details' : 'Event details'}</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">Required for {topicType === 'OFFER' ? 'offer' : 'event'} posts.</p>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#374151]">
                    {topicType === 'OFFER' ? 'Offer title' : 'Event name'} <span className="text-red-500">*</span>
                  </label>
                  <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} maxLength={58}
                    placeholder={topicType === 'OFFER' ? 'e.g. 20% off this weekend' : 'e.g. Grand Opening Sale'}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#374151]">Start date <span className="text-red-500">*</span></label>
                    <input type="date" value={eventStart} min={today()} onChange={e => setEventStart(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-[#111827] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#374151]">End date <span className="text-red-500">*</span></label>
                    <input type="date" value={eventEnd} min={eventStart || today()} onChange={e => setEventEnd(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-[#111827] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                  </div>
                </div>
                {topicType === 'OFFER' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#374151]">Coupon code <span className="text-[11px] font-normal text-[#9CA3AF]">(optional)</span></label>
                    <input value={offerCode} onChange={e => setOfferCode(e.target.value)} maxLength={58}
                      placeholder="e.g. SUMMER20"
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs font-mono text-[#111827] placeholder:font-sans placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                  </div>
                )}
                {topicType === 'OFFER' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#374151]">Terms and conditions <span className="text-[11px] font-normal text-[#9CA3AF]">(optional)</span></label>
                    <textarea value={offerTerms} onChange={e => setOfferTerms(e.target.value)} rows={2} maxLength={500}
                      placeholder="e.g. Valid for new customers only. Cannot be combined with other offers."
                      className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Post text */}
          <section className={panel}>
            <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Post text</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">What you want customers to know. Up to 1,500 characters.</p>
              </div>
              <CharCounter value={summary} max={1500} />
            </div>
            <div className="p-5">
              <textarea value={summary} onChange={e => setSummary(e.target.value)} maxLength={1500} rows={5}
                placeholder={
                  topicType === 'STANDARD' ? "Share what's new at your business — a new service, product, achievement, or update…"
                  : topicType === 'EVENT'  ? "Tell customers about this event — what it is, why they should come, and what to expect…"
                  :                          "Describe your offer — what customers get, the value, and how they can redeem it…"
                }
                className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
              <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                Google may shorten how your post appears in search. Keep key information near the beginning.
              </p>
            </div>
          </section>

          {/* Photo URL */}
          <section className={panel}>
            <div className="border-b border-[#F3F4F6] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#111827]">Photo <span className="text-[11px] font-normal text-[#9CA3AF]">(optional)</span></h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">Posts with photos get significantly more engagement. Minimum 400×300px, JPG or PNG.</p>
            </div>
            <div className="p-5">
              <label className="mb-1.5 block text-xs font-medium text-[#374151]">Public photo URL</label>
              <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
              <p className="mt-2 text-[11px] text-[#9CA3AF]">The URL must be publicly accessible. Google will fetch the image directly.</p>
            </div>
          </section>

          {/* Call to action */}
          <section className={panel}>
            <div className="border-b border-[#F3F4F6] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#111827]">Call to action button <span className="text-[11px] font-normal text-[#9CA3AF]">(optional)</span></h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">Add a button to your post to direct customers to take a specific action.</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {CTA_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setCtaType(o.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${ctaType === o.value ? 'border-[#6C55E8] bg-[#F5F3FF] text-[#6C55E8]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#6C55E8]/40 hover:text-[#6C55E8]'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {needsUrl && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-[#374151]">Button URL <span className="text-red-500">*</span></label>
                  <input type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                    placeholder="https://yourbusiness.com/page"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#6C55E8] focus:outline-none focus:ring-1 focus:ring-[#6C55E8]" />
                </div>
              )}
            </div>
          </section>

          {/* Errors / success + publish button */}
          <div>
            {createError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700" role="alert">{createError}</p>
            )}
            {createSuccess && (
              <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-700" role="status">
                Post published to Google Business Profile. Refreshing posts list…
              </p>
            )}
            {!locationId && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                Select a location from the top bar before publishing.
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={resetForm} disabled={creating}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50">
                Clear form
              </button>
              <button type="button" onClick={handlePublish} disabled={creating || !summary.trim() || !locationId}
                className="inline-flex items-center gap-2 rounded-lg bg-[#6C55E8] px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#5A42D1] disabled:cursor-not-allowed disabled:opacity-50">
                {creating ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Publishing…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Publish to Google
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: preview + posts list ──────────────────────────────── */}
        <div className="space-y-6">
          {/* Live preview */}
          <div>
            <p className="mb-3 text-xs font-semibold text-[#374151]">Preview</p>
            <PostPreview
              topicType={topicType} summary={summary} photoUrl={photoUrl}
              eventTitle={eventTitle} eventStart={eventStart} eventEnd={eventEnd}
              ctaType={ctaType}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-[#9CA3AF]">
              Google may display your post differently depending on the surface (Search, Maps, mobile).
            </p>
          </div>

          {/* Google requirements */}
          <div className={panel + ' p-4'}>
            <p className="mb-3 text-xs font-semibold text-[#374151]">Google post guidelines</p>
            <ul className="space-y-2">
              {[
                'Post text: up to 1,500 characters',
                'Photos: JPG/PNG, min 400×300px, max 10MB',
                'Standard posts expire after 7 days',
                'Events and offers stay until end date',
                'No personal contact info in post text',
                'No misleading or prohibited content',
              ].map(r => (
                <li key={r} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#6B7280]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C55E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Recent posts ──────────────────────────────────────────────── */}
      <section className={panel}>
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Recent posts on Google</h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">Last 10 posts returned by Google Business Profile.</p>
          </div>
          <button type="button" onClick={() => setRevision(n => n + 1)} disabled={extraLoading || !locationId}
            className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50">
            {extraLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div className="p-5">
          {!locationId && <Empty>Select a location from the top bar to see its posts.</Empty>}
          {locationId && extraLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map(n => <div key={n} className="h-16 animate-pulse rounded-lg bg-[#F3F4F6]" />)}
            </div>
          )}
          {locationId && !extraLoading && extraError && (
            <p className="text-xs leading-relaxed text-[#6B7280]">{extraError}</p>
          )}
          {locationId && !extraLoading && !extraError && posts.length === 0 && (
            <Empty>No posts found for this location. Create one above and it will appear here after publishing.</Empty>
          )}
          {locationId && !extraLoading && posts.length > 0 && (
            <div className="space-y-3">
              {(posts as PostRow[]).map((post, i) => (
                <article key={post.name || i}
                  className="grid grid-cols-[1fr_auto] gap-4 rounded-xl border border-[#F3F4F6] bg-[#FAFAFA] px-4 py-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <TypeBadge type={post.post_type} />
                      <StateBadge state={post.state} />
                    </div>
                    <p className="text-xs font-medium leading-snug text-[#374151] line-clamp-2">
                      {post.summary ?? 'No caption'}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">
                      {post.cta_type ? post.cta_type.replace(/_/g, ' ') + ' · ' : ''}
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : 'No date'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {post.views != null && (
                      <p className="font-mono text-sm font-semibold tabular-nums text-[#111827]">{number(post.views)}</p>
                    )}
                    {post.views != null && <p className="text-[10px] text-[#9CA3AF]">views</p>}
                    {post.clicks != null && (
                      <p className="mt-1 font-mono text-xs tabular-nums text-[#374151]">{number(post.clicks)} clicks</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Attribution */}
      <div className="flex items-center gap-2 justify-end">
        <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
          alt="Powered by Google" className="h-[18px] w-auto" />
      </div>
    </div>
  );
}
