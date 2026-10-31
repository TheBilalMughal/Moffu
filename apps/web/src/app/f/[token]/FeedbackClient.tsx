'use client';

import { useState } from 'react';

interface Props {
  token: string;
  customerName: string | null;
  orgName: string;
  googleReviewUrl: string | null;
  edgeFnUrl: string;
}

type Step = 'choose' | 'unhappy_form' | 'happy_done' | 'unhappy_done' | 'submitting' | 'error';

export function FeedbackClient({ token, customerName, orgName, googleReviewUrl, edgeFnUrl }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [feedbackText, setFeedbackText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const name = customerName ? `, ${customerName.split(' ')[0]}` : '';

  async function submit(sentiment: 'happy' | 'unhappy', text?: string) {
    setStep('submitting');
    try {
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sentiment, feedback_text: text ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_responded') { setStep('unhappy_done'); return; }
        throw new Error(data.error ?? 'Unknown error');
      }
      if (sentiment === 'happy') {
        if (data.google_review_url) {
          window.location.href = data.google_review_url;
        } else {
          setStep('happy_done');
        }
      } else {
        setStep('unhappy_done');
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setStep('error');
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0D4C3C] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5EAE8] shadow-sm overflow-hidden">

          {/* choose */}
          {step === 'choose' && (
            <div className="px-8 py-10 text-center">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">{orgName}</p>
              <h1 className="text-xl font-bold text-[#111827] mb-2">
                How was your experience{name}?
              </h1>
              <p className="text-sm text-[#6B7280] mb-8">Your honest feedback helps us improve.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => submit('happy')}
                  className="flex-1 flex flex-col items-center gap-2.5 px-4 py-5 rounded-xl border-2 border-[#E5EAE8] hover:border-[#0D4C3C] hover:bg-[#F0F7F5] transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75s.168-.75.375-.75S9.75 9.336 9.75 9.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">Great!</span>
                  <span className="text-[11px] text-[#9CA3AF]">Share on Google</span>
                </button>
                <button
                  onClick={() => setStep('unhappy_form')}
                  className="flex-1 flex flex-col items-center gap-2.5 px-4 py-5 rounded-xl border-2 border-[#E5EAE8] hover:border-amber-300 hover:bg-amber-50/40 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75s.168-.75.375-.75S9.75 9.336 9.75 9.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">Could be better</span>
                  <span className="text-[11px] text-[#9CA3AF]">Tell us what happened</span>
                </button>
              </div>
            </div>
          )}

          {/* unhappy form */}
          {step === 'unhappy_form' && (
            <div className="px-8 py-10">
              <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#374151] transition-colors mb-6">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                Back
              </button>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">{orgName}</p>
              <h1 className="text-xl font-bold text-[#111827] mb-2">We&apos;re sorry to hear that{name}</h1>
              <p className="text-sm text-[#6B7280] mb-6">Help us understand what went wrong so we can make it right.</p>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Tell us what happened..."
                rows={4}
                className="w-full px-4 py-3 text-sm text-[#111827] placeholder-[#D1D5DB] border border-[#E5EAE8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] resize-none transition"
              />
              <button
                onClick={() => submit('unhappy', feedbackText)}
                disabled={!feedbackText.trim()}
                className="w-full mt-4 py-3 px-4 bg-[#0D4C3C] text-white text-sm font-semibold rounded-xl hover:bg-[#083F32] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send feedback
              </button>
            </div>
          )}

          {/* submitting */}
          {step === 'submitting' && (
            <div className="px-8 py-16 text-center">
              <div className="w-10 h-10 border-2 border-[#0D4C3C]/20 border-t-[#0D4C3C] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-[#6B7280]">Saving your response...</p>
            </div>
          )}

          {/* happy done — Google redirect fallback */}
          {step === 'happy_done' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827] mb-2">Thanks{name}!</h2>
              <p className="text-sm text-[#6B7280] mb-6">We&apos;re glad you had a great experience.</p>
              {googleReviewUrl && (
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#0D4C3C] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#083F32] transition-colors"
                >
                  Leave a Google review
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* unhappy done */}
          {step === 'unhappy_done' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#0D4C3C]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827] mb-2">Feedback received</h2>
              <p className="text-sm text-[#6B7280]">
                Thank you{name}. The team has been notified and will look into this.
              </p>
            </div>
          )}

          {/* error */}
          {step === 'error' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827] mb-2">Something went wrong</h2>
              <p className="text-sm text-[#9CA3AF]">{errorMsg}</p>
              <button onClick={() => setStep('choose')} className="mt-4 text-xs font-semibold text-[#0D4C3C] hover:underline">
                Try again
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#D1D5DB] mt-6">Powered by Moffu</p>
      </div>
    </div>
  );
}
