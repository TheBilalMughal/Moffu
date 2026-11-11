import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description: 'Moffu was built for business owners tired of ignoring reviews. Learn why we built it, what drives us, and where we are going.',
  alternates: { canonical: 'https://www.moffu.pro/about' },
};

const VALUES = [
  {
    title: 'Business owners first',
    body: 'Every decision we make starts with one question: does this make life easier for someone running a real business? Not the enterprise, not the agency. The owner.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    title: 'You stay in control',
    body: 'AI drafts, you approve. We will never auto-publish a reply without your sign-off. Your brand voice is yours. We just help you use it faster.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    title: 'Honest by default',
    body: 'No fake engagement, no auto-spam, no reply farms. Every response we help you write is genuine: it reflects your business, not a template.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    title: 'Simple over clever',
    body: 'Review management does not need to be complicated. We cut every feature that did not earn its place. Fast to set up, easy to use every day.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* White zone behind fixed navbar so dark text is visible */}
      <div className="bg-white h-28" />

      {/* Hero */}
      <section className="bg-[#111827] px-6 lg:px-16 pt-16 pb-24">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#D8CCFF] uppercase tracking-widest mb-6">About Moffu</p>
          <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] font-black text-white leading-[1.0] tracking-tight mb-8 max-w-4xl">
            Built for the business that keeps getting left on read.
          </h1>
          <p className="text-lg text-white/60 max-w-2xl leading-relaxed">
            Every review your business receives is a public conversation. Most businesses never reply. Not because they do not care. Not because they do not have something to say. Because replying well takes time they simply do not have.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="px-6 lg:px-16 py-24">
        <div className="max-w-[1380px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-5">Our story</p>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-black text-[#111827] leading-[1.1] mb-6">
                We got tired of watching good businesses get buried by unanswered reviews.
              </h2>
            </div>
            <div className="space-y-5 text-[#6B7280] leading-relaxed text-[1rem]">
              <p>
                Moffu started with a simple observation: businesses with the best products were losing to competitors who just replied faster. A 1-star review with no response looks worse than a 1-star review with a thoughtful, human reply.
              </p>
              <p>
                The problem was never that owners did not care. It was that writing a good reply for every single review, across multiple locations, in the right tone, without sounding robotic, takes real time. Time that a restaurant manager, a clinic owner, or a shop floor supervisor simply does not have between shifts.
              </p>
              <p>
                So we built Moffu. Not an auto-responder that blasts generic text. A tool that learns your brand voice and drafts replies that actually sound like you wrote them. You stay in control. The AI does the heavy lifting.
              </p>
              <p>
                We are a small team. We build in the open, talk to our customers directly, and ship what we hear. If you have a suggestion, we genuinely want to hear it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-[#F9FAFB] px-6 lg:px-16 py-24">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-5">What we believe</p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black text-[#111827] leading-[1.1] mb-14 max-w-xl">
            Four things we will not compromise on.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ title, body, icon }) => (
              <div key={title} className="bg-white rounded-xl p-7 border border-[#E5E7EB]">
                <div className="w-9 h-9 rounded-lg bg-[#EDE9FF] text-[#6C55E8] flex items-center justify-center mb-5">
                  {icon}
                </div>
                <h3 className="font-black text-[#111827] text-[0.9375rem] mb-2">{title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works in brief */}
      <section className="px-6 lg:px-16 py-24">
        <div className="max-w-[1380px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-5">The product</p>
              <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black text-[#111827] leading-[1.1] mb-6">
                Brand Brain is the difference.
              </h2>
              <p className="text-[#6B7280] leading-relaxed mb-8">
                Most AI tools give you generic output because they know nothing about your business. Brand Brain changes that. You configure it once with your tone, language, and reply rules per star rating. Every draft comes out sounding like you, not a chatbot.
              </p>
              <div className="space-y-3">
                {[
                  'Tone and personality settings',
                  'Per-star-rating reply rules',
                  'Guardrails: what the AI must never say',
                  'Per-location customisation',
                  'Multilingual reply support',
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#EDE9FF] text-[#6C55E8] flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <span className="text-sm text-[#374151]">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/feature"
                  className="inline-block bg-[#111827] text-white font-bold text-sm px-6 py-3 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150"
                >
                  See all features
                </Link>
                <Link
                  href="/contact"
                  className="inline-block text-sm font-semibold text-[#6C55E8] border border-[#6C55E8] px-6 py-3 rounded-lg hover:bg-[#6C55E8] hover:text-white transition-colors duration-150"
                >
                  Talk to us
                </Link>
              </div>
            </div>

            {/* Visual */}
            <div className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-8 space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-[#6C55E8] rounded-lg flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                  </svg>
                </div>
                <span className="text-[#111827] font-black text-sm">Brand Brain</span>
                <span className="ml-auto text-[10px] font-bold text-[#6C55E8] bg-[#EDE9FF] px-2 py-0.5 rounded">Active</span>
              </div>
              {[
                { label: 'Tone', value: 'Warm and professional' },
                { label: 'Language', value: 'English' },
                { label: '1-2 star rule', value: 'Apologise, offer to resolve offline' },
                { label: '5 star rule', value: 'Thank, invite back, mention team' },
                { label: 'Never say', value: 'Competitor names, pricing details' },
              ].map(({ label, value }) => (
                <div key={label} className="border border-[#E5E7EB] bg-white rounded-lg px-4 py-3">
                  <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-sm text-[#374151]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#D8CCFF] px-6 lg:px-16 py-24">
        <div className="max-w-[1380px] mx-auto text-center">
          <h2 className="text-[clamp(2rem,6vw,4rem)] font-black text-[#111827] leading-[1.0] mb-6">
            Stop ghosting your reviews.
          </h2>
          <p className="text-[#111827]/60 text-lg mb-10 max-w-md mx-auto">
            Free plan available. No credit card required. Set up in under two minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={`${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro'}/auth/signup`}
              className="inline-block bg-[#111827] text-white font-black text-sm px-8 py-4 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150"
            >
              Start Free
            </a>
            <Link
              href="/feature"
              className="inline-block text-sm font-semibold text-[#111827]/70 hover:text-[#111827] transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
