import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { googleService } from '@/features/google/google.service';

type DbStatus = 'NEW' | 'PENDING_REPLY' | 'DRAFT_READY' | 'AWAITING_APPROVAL' | 'PUBLISHING' | 'PUBLISHED' | 'PUBLISH_FAILED';
type UiStatus = 'pending' | 'draft_ready' | 'replied';
type FilterTab = 'all' | 'pending' | 'draft_ready' | 'replied';

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  published_at: string | null;
  body: string | null;
  status: DbStatus;
  reply_draft: string | null;
  reply_text: string | null;
}

function toUiStatus(s: DbStatus): UiStatus {
  if (s === 'PUBLISHED') return 'replied';
  if (s === 'DRAFT_READY' || s === 'AWAITING_APPROVAL' || s === 'PUBLISHING' || s === 'PUBLISH_FAILED') return 'draft_ready';
  return 'pending';
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-4 h-4 ${n <= rating ? 'text-amber-400' : 'text-[#D1D5DB]'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const STATUS_CONFIG: Record<UiStatus, { label: string; classes: string }> = {
  pending:    { label: 'Pending Reply', classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  draft_ready:{ label: 'Draft Ready',  classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
  replied:    { label: 'Replied',       classes: 'bg-[#E6F2EE] text-[#0D4C3C] border border-[#C3DDD6]' },
};

function ReviewCard({
  review,
  onGenerateDraft,
  onPublish,
  onDiscard,
}: {
  review: Review;
  onGenerateDraft: (id: string) => void;
  onPublish: (id: string, draft: string) => Promise<{ error?: string }>;
  onDiscard: (id: string) => Promise<void>;
}) {
  const uiStatus = toUiStatus(review.status);
  const status = STATUS_CONFIG[uiStatus];
  const [draftText, setDraftText] = useState(review.reply_draft ?? '');
  const [expanded, setExpanded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [publishError, setPublishError] = useState('');

  const isPublishing = review.status === 'PUBLISHING';
  const publishFailed = review.status === 'PUBLISH_FAILED';

  const dateStr = review.published_at
    ? new Date(review.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    const result = await onPublish(review.id, draftText);
    if (result?.error) setPublishError(result.error);
    setPublishing(false);
  }

  async function handleDiscard() {
    setDiscarding(true);
    await onDiscard(review.id);
    setDiscarding(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {(review.reviewer_name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">{review.reviewer_name ?? 'Anonymous'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Stars rating={review.rating} />
              {dateStr && <span className="text-xs text-[#9CA3AF]">{dateStr}</span>}
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 ${status.classes}`}>
          {isPublishing ? 'Publishing…' : status.label}
        </span>
      </div>

      {review.body && <p className="text-sm text-[#374151] leading-relaxed mb-4">{review.body}</p>}

      {/* No reply yet */}
      {uiStatus === 'pending' && (
        <div className="pt-3 border-t border-[#F3F4F6]">
          <button
            onClick={() => onGenerateDraft(review.id)}
            className="flex items-center gap-2 text-sm font-medium text-[#0D4C3C] hover:text-[#083F32] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Generate AI Draft
          </button>
        </div>
      )}

      {/* Draft ready — approve or discard */}
      {uiStatus === 'draft_ready' && (
        <div className="pt-3 border-t border-[#F3F4F6]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              {publishFailed ? 'Draft (publish failed — retry)' : 'AI Draft'}
            </p>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-[#0D4C3C] font-medium hover:underline">
              {expanded ? 'Collapse' : 'Edit'}
            </button>
          </div>
          {expanded ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              disabled={isPublishing || publishing}
              className="w-full text-sm text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none transition-colors disabled:opacity-60"
            />
          ) : (
            <p className="text-sm text-[#374151] bg-[#F8FAF9] rounded-lg px-3 py-2.5 leading-relaxed line-clamp-3">
              {draftText || <span className="text-[#9CA3AF] italic">No draft yet</span>}
            </p>
          )}
          {publishError && <p className="mt-2 text-xs text-red-600">{publishError}</p>}
          <div className="flex items-center gap-2.5 mt-3">
            <button
              onClick={handlePublish}
              disabled={publishing || isPublishing || !draftText}
              className="flex-1 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {publishing || isPublishing ? 'Publishing…' : 'Approve & Publish'}
            </button>
            <button
              onClick={handleDiscard}
              disabled={discarding || publishing || isPublishing}
              className="text-sm text-[#6B7280] hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {discarding ? '…' : 'Discard'}
            </button>
          </div>
        </div>
      )}

      {/* Already replied */}
      {uiStatus === 'replied' && (review.reply_text || review.reply_draft) && (
        <div className="pt-3 border-t border-[#F3F4F6]">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Your Reply</p>
          <p className="text-sm text-[#374151] bg-[#F8FAF9] rounded-lg px-3 py-2.5 leading-relaxed">
            {review.reply_text ?? review.reply_draft}
          </p>
        </div>
      )}
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'draft_ready',label: 'Draft Ready' },
  { key: 'replied',    label: 'Replied' },
];

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  async function loadReviews() {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, published_at, body, status, reply_draft, reply_text')
      .order('published_at', { ascending: false });
    if (!error) setReviews((data as Review[]) ?? []);
    setLoading(false);
  }

  async function checkConnection() {
    const { data } = await supabase
      .from('google_connections')
      .select('state')
      .eq('state', 'CONNECTED')
      .maybeSingle();
    setIsConnected(!!data);
  }

  useEffect(() => {
    loadReviews();
    checkConnection();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    setSyncError('');
    const { synced, error } = await googleService.syncReviews();
    if (error) {
      setSyncError(error);
    } else {
      setSyncMsg(`Synced ${synced} review${synced !== 1 ? 's' : ''}.`);
      await loadReviews();
    }
    setSyncing(false);
  }

  async function handleGenerateDraft(id: string) {
    // Phase 5: AI generation. For now, set a placeholder draft in DB.
    await supabase
      .from('reviews')
      .update({ status: 'DRAFT_READY', reply_draft: 'Thank you for taking the time to share your feedback! We really appreciate your honest review and will use it to continue improving our service. We hope to serve you again soon!' })
      .eq('id', id);
    await loadReviews();
  }

  async function handlePublish(id: string, draft: string): Promise<{ error?: string }> {
    const result = await googleService.publishReply(id, draft);
    if (!result.error) await loadReviews();
    return result;
  }

  async function handleDiscard(id: string) {
    await supabase
      .from('reviews')
      .update({ status: 'PENDING_REPLY', reply_draft: null })
      .eq('id', id);
    await loadReviews();
  }

  const byUiStatus = (r: Review) => toUiStatus(r.status);

  const counts: Record<FilterTab, number> = {
    all:         reviews.length,
    pending:     reviews.filter((r) => byUiStatus(r) === 'pending').length,
    draft_ready: reviews.filter((r) => byUiStatus(r) === 'draft_ready').length,
    replied:     reviews.filter((r) => byUiStatus(r) === 'replied').length,
  };

  const filtered = activeTab === 'all' ? reviews : reviews.filter((r) => byUiStatus(r) === activeTab);

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[1.5rem] font-bold text-[#111827]">Reviews</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Manage and respond to customer reviews.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !isConnected}
          title={!isConnected ? 'Connect Google Business Profile first' : 'Sync latest reviews'}
          className="flex items-center gap-2 bg-[#0D4C3C] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors hover:bg-[#083F32] disabled:cursor-not-allowed"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing…' : 'Sync Reviews'}
        </button>
      </div>

      {syncMsg && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          {syncMsg}
          <button onClick={() => setSyncMsg('')} className="ml-4 text-emerald-600 hover:text-emerald-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {syncError && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {syncError}
          <button onClick={() => setSyncError('')} className="ml-4 text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-white border border-[#E5EAE8] rounded-lg p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-[#0D4C3C] text-white' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${activeTab === key ? 'text-white/70' : 'text-[#9CA3AF]'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-[#E5EAE8] p-5 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F3F4F6]" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-[#F3F4F6] rounded w-32" />
                  <div className="h-2.5 bg-[#F3F4F6] rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5EAE8] px-8 py-12 text-center">
          {reviews.length === 0 ? (
            <>
              <p className="text-sm font-medium text-[#111827] mb-1">No reviews yet</p>
              <p className="text-sm text-[#9CA3AF]">
                {isConnected
                  ? 'Click "Sync Reviews" to pull your latest Google reviews.'
                  : 'Connect your Google Business Profile from Settings to get started.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#9CA3AF]">No reviews in this category.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onGenerateDraft={handleGenerateDraft}
              onPublish={handlePublish}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}
    </div>
  );
}
