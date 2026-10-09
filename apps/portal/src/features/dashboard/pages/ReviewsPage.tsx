import { useState } from 'react';

type ReviewStatus = 'pending' | 'draft_ready' | 'replied';
type FilterTab = 'all' | 'pending' | 'draft_ready' | 'replied';

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  status: ReviewStatus;
  draft?: string;
}

const MOCK_REVIEWS: Review[] = [
  {
    id: '1',
    author: 'Sarah Mitchell',
    rating: 5,
    date: 'Oct 8, 2026',
    text: 'Absolutely fantastic service! The team went above and beyond to help us with our project. Highly recommend to anyone looking for a reliable partner.',
    status: 'draft_ready',
    draft: 'Thank you so much for your kind words, Sarah! We\'re thrilled to hear that our team exceeded your expectations. Your recommendation means the world to us, and we look forward to working with you again in the future!',
  },
  {
    id: '2',
    author: 'James Thornton',
    rating: 4,
    date: 'Oct 7, 2026',
    text: 'Really good experience overall. Minor delays in communication but the final result was excellent. Would use again.',
    status: 'pending',
  },
  {
    id: '3',
    author: 'Priya Sharma',
    rating: 2,
    date: 'Oct 5, 2026',
    text: 'Disappointed with the response time. Had to follow up multiple times before getting answers. The quality of work was okay but communication needs improvement.',
    status: 'pending',
  },
  {
    id: '4',
    author: 'Carlos Rivera',
    rating: 5,
    date: 'Oct 3, 2026',
    text: 'Outstanding! Fast, professional, and delivered exactly what was promised. The AI-powered responses are a game changer for our business.',
    status: 'replied',
    draft: 'Thank you Carlos! We really appreciate your feedback and are so happy the service is making a difference for your business.',
  },
  {
    id: '5',
    author: 'Emma Johansson',
    rating: 3,
    date: 'Oct 1, 2026',
    text: 'Average experience. Nothing particularly stood out. The product does what it says, but I expected a bit more for the price.',
    status: 'pending',
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`w-4 h-4 ${n <= rating ? 'text-amber-400' : 'text-[#D1D5DB]'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending Reply', classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  draft_ready: { label: 'Draft Ready', classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
  replied: { label: 'Replied', classes: 'bg-[#E6F2EE] text-[#0D4C3C] border border-[#C3DDD6]' },
};

function ReviewCard({ review, onGenerateDraft }: { review: Review; onGenerateDraft: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [draftText, setDraftText] = useState(review.draft ?? '');
  const status = STATUS_CONFIG[review.status];

  return (
    <div className="bg-white rounded-xl border border-[#E5EAE8] p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {review.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">{review.author}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Stars rating={review.rating} />
              <span className="text-xs text-[#9CA3AF]">{review.date}</span>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${status.classes}`}>
          {status.label}
        </span>
      </div>

      {/* Review text */}
      <p className="text-sm text-[#374151] leading-relaxed mb-4">{review.text}</p>

      {/* Draft section */}
      {review.status === 'pending' && (
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

      {review.status === 'draft_ready' && (
        <div className="pt-3 border-t border-[#F3F4F6]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">AI Draft</p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[#0D4C3C] font-medium hover:underline"
            >
              {expanded ? 'Collapse' : 'Edit'}
            </button>
          </div>
          {expanded ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              className="w-full text-sm text-[#374151] border border-[#D1D5DB] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none transition-colors"
            />
          ) : (
            <p className="text-sm text-[#374151] bg-[#F8FAF9] rounded-lg px-3 py-2.5 leading-relaxed line-clamp-3">
              {draftText}
            </p>
          )}
          <div className="flex items-center gap-2.5 mt-3">
            <button className="flex-1 bg-[#0D4C3C] hover:bg-[#083F32] text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              Approve &amp; Publish
            </button>
            <button className="text-sm text-[#6B7280] hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
              Discard
            </button>
          </div>
          <p className="mt-2 text-xs text-[#9CA3AF]">Publishing to Google requires Google Business Profile connection (Phase 4).</p>
        </div>
      )}

      {review.status === 'replied' && review.draft && (
        <div className="pt-3 border-t border-[#F3F4F6]">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Your Reply</p>
          <p className="text-sm text-[#374151] bg-[#F8FAF9] rounded-lg px-3 py-2.5 leading-relaxed">
            {review.draft}
          </p>
        </div>
      )}
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'draft_ready', label: 'Draft Ready' },
  { key: 'replied', label: 'Replied' },
];

export function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);

  function handleGenerateDraft(id: string) {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'draft_ready',
              draft:
                'Thank you for taking the time to share your feedback! We really appreciate your honest review and will use it to continue improving our service. We hope to serve you again soon!',
            }
          : r
      )
    );
  }

  const filtered = activeTab === 'all' ? reviews : reviews.filter((r) => r.status === activeTab);

  const counts: Record<FilterTab, number> = {
    all: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    draft_ready: reviews.filter((r) => r.status === 'draft_ready').length,
    replied: reviews.filter((r) => r.status === 'replied').length,
  };

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[1.5rem] font-bold text-[#111827]">Reviews</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Manage and respond to customer reviews.</p>
        </div>
        <button
          disabled
          title="Connect Google Business Profile first"
          className="flex items-center gap-2 bg-[#0D4C3C] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Reviews
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-white border border-[#E5EAE8] rounded-lg p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-[#0D4C3C] text-white'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${activeTab === key ? 'text-white/70' : 'text-[#9CA3AF]'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Review list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5EAE8] px-8 py-12 text-center">
          <p className="text-sm text-[#9CA3AF]">No reviews in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review) => (
            <ReviewCard key={review.id} review={review} onGenerateDraft={handleGenerateDraft} />
          ))}
        </div>
      )}
    </div>
  );
}
