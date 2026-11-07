'use client';

import { useEffect, useState } from 'react';

const REVIEWS = [
  {
    stars: 5,
    text: 'Absolutely love this place! Staff was super helpful and I found exactly what I needed. 10/10 will come back!',
    reviewer: 'Aisha K.',
    initial: 'A',
    color: 'from-purple-300 to-pink-300',
    time: '2 days ago',
    reply: "Thank you so much, Aisha! Comments like yours make our day. We can't wait to see you again — there's a new collection just arrived you'll love!",
  },
  {
    stars: 3,
    text: 'Good products but the wait time was a bit long. Would love to see more staff during peak hours.',
    reviewer: 'Marcus T.',
    initial: 'M',
    color: 'from-blue-300 to-cyan-300',
    time: '5 days ago',
    reply: "Thanks for the honest feedback, Marcus. You're totally right — peak hours have been busier lately. We're already working on it. Hope to give you a smoother experience next time!",
  },
];

// Timeline per review slot (ms):
// 0        → review card slides in
// 900      → reply card slides in
// 3400     → both fade out
// 4000     → next review starts (or reset)
const SHOW_IN_MS   = 0;
const REPLY_IN_MS  = 900;
const FADE_OUT_MS  = 3400;
const NEXT_MS      = 4000;
const TOTAL_MS     = NEXT_MS * REVIEWS.length + 400; // full cycle

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3 h-3 ${i <= count ? 'text-amber-400' : 'text-[#D1D5DB]'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  );
}

export function ReviewMockup() {
  const [cycle,       setCycle]       = useState(0);
  const [reviewIdx,   setReviewIdx]   = useState(-1);  // -1 = nothing shown
  const [showReview,  setShowReview]  = useState(false);
  const [showReply,   setShowReply]   = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    REVIEWS.forEach((_, i) => {
      const base = NEXT_MS * i;

      ts.push(setTimeout(() => {
        setReviewIdx(i);
        setShowReview(false);
        setShowReply(false);
      }, base));

      ts.push(setTimeout(() => setShowReview(true),  base + 100));
      ts.push(setTimeout(() => setShowReply(true),   base + REPLY_IN_MS));

      ts.push(setTimeout(() => {
        setShowReview(false);
        setShowReply(false);
      }, base + FADE_OUT_MS));
    });

    ts.push(setTimeout(() => {
      setReviewIdx(-1);
      setCycle(c => c + 1);
    }, TOTAL_MS));

    return () => ts.forEach(clearTimeout);
  }, [cycle]);

  const review = reviewIdx >= 0 ? REVIEWS[reviewIdx] : null;

  return (
    <div className="flex justify-center md:justify-end">
      {/* ── Sketch-style phone frame ── */}
      <div className="relative w-[260px]">

        {/* Animated theme-color glow — all 4 sides */}
        <style>{`
          @keyframes phoneGlow {
            0%,100% {
              box-shadow:
                0  0  28px  8px rgba(13,76,60,0.35),
                0  0  70px 20px rgba(13,76,60,0.18),
                0  0 120px 40px rgba(46,204,138,0.08),
                inset 0 1px 0 rgba(255,255,255,0.9);
            }
            50% {
              box-shadow:
                0  0  50px 16px rgba(13,76,60,0.55),
                0  0 110px 36px rgba(13,76,60,0.28),
                0  0 180px 60px rgba(46,204,138,0.14),
                inset 0 1px 0 rgba(255,255,255,0.9);
            }
          }
        `}</style>

        {/* Outer phone border — sketch / wireframe look */}
        <div
          className="relative rounded-[2.6rem] border-2 border-[#0D4C3C]/20 bg-[#FAFAFA] p-[10px]"
          style={{ animation: 'phoneGlow 3.5s ease-in-out infinite' }}
        >
          {/* Sketch side buttons */}
          <div className="absolute -left-[2px] top-[88px]  w-[2px] h-7 bg-[#111827]/12 rounded-full" />
          <div className="absolute -left-[2px] top-[128px] w-[2px] h-7 bg-[#111827]/12 rounded-full" />
          <div className="absolute -right-[2px] top-[108px] w-[2px] h-10 bg-[#111827]/12 rounded-full" />

          {/* Screen */}
          <div className="rounded-[2rem] bg-white overflow-hidden h-[500px] flex flex-col border border-[#E5E7EB]">

            {/* Status bar + pill */}
            <div className="bg-white flex-shrink-0">
              {/* Sketch status bar */}
              <div className="flex items-center justify-between px-5 pt-3 pb-0">
                <span className="text-[9px] font-semibold text-[#111827]/40 tracking-tight">9:41</span>
                <div className="w-14 h-4 bg-[#111827]/8 rounded-full border border-[#111827]/10" />
                <div className="flex items-center gap-1">
                  {/* signal dots */}
                  <div className="flex gap-[2px] items-end h-3">
                    {[2,3,4,3].map((h,i) => (
                      <div key={i} className="w-[2.5px] rounded-sm bg-[#111827]/30" style={{height: `${h * 3}px`}} />
                    ))}
                  </div>
                  {/* battery */}
                  <div className="w-5 h-2.5 rounded-[2px] border border-[#111827]/30 relative ml-0.5">
                    <div className="absolute inset-[2px] rounded-sm bg-[#111827]/30 w-3/4" />
                    <div className="absolute -right-[3px] top-[3px] w-[2px] h-[4px] bg-[#111827]/20 rounded-r-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Google business header */}
            <div className="px-4 pt-2 pb-2.5 border-b border-[#F3F4F6] flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-[9px] font-bold text-[#111827]/40 uppercase tracking-widest">Google Reviews</span>
              </div>
              <p className="text-[13px] font-black text-[#111827] leading-tight">Harper&apos;s Beauty Bar</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Stars count={4} />
                <span className="text-[9px] text-[#111827]/40 font-medium">4.4 · 183 reviews</span>
              </div>
            </div>

            {/* Review slot — single card at a time */}
            <div className="flex-1 flex flex-col justify-center px-3 py-4 relative overflow-hidden">

              {/* Idle placeholder dots when no review is shown */}
              {!showReview && (
                <div className="flex justify-center gap-2 absolute inset-0 items-center">
                  {REVIEWS.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: reviewIdx === i ? '#2ECC8A' : '#E5E7EB' }}
                    />
                  ))}
                </div>
              )}

              {/* Review card */}
              <div
                className="transition-all duration-500"
                style={{
                  opacity:   showReview ? 1 : 0,
                  transform: showReview ? 'translateY(0)' : 'translateY(18px)',
                }}
              >
                {review && (
                  <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#F3F4F6]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${review.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-[9px] font-bold text-white">{review.initial}</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#111827]">{review.reviewer}</p>
                        <p className="text-[9px] text-[#111827]/40">{review.time}</p>
                      </div>
                    </div>
                    <Stars count={review.stars} />
                    <p className="text-[10px] text-[#111827]/70 mt-1 leading-relaxed">{review.text}</p>
                  </div>
                )}
              </div>

              {/* Reply card */}
              {review && (
                <div
                  className="mt-2 pl-3 transition-all duration-500"
                  style={{
                    opacity:   showReply ? 1 : 0,
                    transform: showReply ? 'translateY(0)' : 'translateY(12px)',
                  }}
                >
                  <div className="bg-[#2ECC8A]/10 rounded-xl p-3 border border-[#2ECC8A]/25 relative">
                    <div className="absolute -left-3 top-3 w-2.5 h-2.5 rounded-full bg-[#2ECC8A] flex items-center justify-center">
                      <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <p className="text-[9px] font-bold text-[#2ECC8A] uppercase tracking-wider mb-1">Replied by Moffu</p>
                    <p className="text-[10px] text-[#111827]/70 leading-relaxed">{review.reply}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress dots at bottom */}
            <div className="flex justify-center gap-1.5 pb-3 flex-shrink-0">
              {REVIEWS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      reviewIdx === i ? '16px' : '5px',
                    height:     '5px',
                    background: reviewIdx === i ? '#2ECC8A' : '#E5E7EB',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-16 h-1 bg-[#111827]/10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
