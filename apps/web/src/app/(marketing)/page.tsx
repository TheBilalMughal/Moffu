export const dynamic = 'force-dynamic';

import React from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { PricingToggle, type PricingPlan } from '../_components/PricingToggle';
import { WaitlistButton } from '../_components/WaitlistButton';
import { HeroEmailForm } from '../_components/HeroEmailForm';
import { HeroHeadline } from '../_components/HeroHeadline';
import { ReviewMockup } from '../_components/ReviewMockup';
import { createServerClient } from '../../lib/supabase/server';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroSection({ waitlistEnabled, portalUrl }: { waitlistEnabled: boolean; portalUrl: string }) {
  return (
    <section className="bg-[#2ECC8A]">
      {/* Hero content — fills full screen height, padded for fixed navbar */}
      <div className="px-6 lg:px-16 flex flex-col" style={{ minHeight: '100svh', paddingTop: '7rem' }}>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <HeroHeadline />

          <p className="text-sm font-bold text-[#111827]/50 uppercase tracking-[0.3em] mt-8 mb-12">
            REPLY FAST. SOUND HUMAN. DO NOTHING.
          </p>

          <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
            <HeroEmailForm portalUrl={portalUrl} />
            <p className="text-sm text-[#111827]">fr no credit card. free for real.</p>
          </div>
        </div>

        {/* Trusted by strip — pinned to bottom of hero, white bg */}
        <div className="bg-white -mx-6 lg:-mx-16 px-6 lg:px-16 py-6">
          <p className="text-[11px] font-semibold text-[#111827]/40 uppercase tracking-widest text-center mb-5">
            Trusted by businesses that care about their reputation
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            {([
              {
                name: 'Restaurants',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 2v5c0 1.7-1.3 3-3 3s-3-1.3-3-3V2"/>
                    <line x1="5" y1="10" x2="5" y2="20"/>
                    <path d="M14 2c0 0 3 2 3 6v1h-6V8c0-4 3-6 3-6z"/>
                    <line x1="14" y1="15" x2="14" y2="20"/>
                  </svg>
                ),
              },
              {
                name: 'Hotels',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="6" width="18" height="13" rx="1"/>
                    <path d="M6 19v-5h10v5"/>
                    <path d="M6 14h10"/>
                    <path d="M6 2l5 4 5-4"/>
                  </svg>
                ),
              },
              {
                name: 'Healthcare',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 2C6.5 2 3 5.5 3 10c0 5.25 8 11 8 11s8-5.75 8-11c0-4.5-3.5-8-8-8z"/>
                    <line x1="11" y1="7" x2="11" y2="13"/>
                    <line x1="8" y1="10" x2="14" y2="10"/>
                  </svg>
                ),
              },
              {
                name: 'Retail',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h14l-1.5 9H5.5L4 7z"/>
                    <path d="M4 7L3 3H1"/>
                    <circle cx="8" cy="19" r="1"/>
                    <circle cx="16" cy="19" r="1"/>
                    <path d="M8 11h6"/>
                  </svg>
                ),
              },
              {
                name: 'Salons & Spas',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="6" cy="6" r="2"/>
                    <circle cx="6" cy="16" r="2"/>
                    <line x1="8" y1="6" x2="20" y2="18"/>
                    <line x1="8" y1="16" x2="14" y2="10"/>
                    <path d="M20 6l-4 4"/>
                  </svg>
                ),
              },
              {
                name: 'Automotive',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12l2-5h10l2 5"/>
                    <rect x="2" y="12" width="18" height="5" rx="1"/>
                    <circle cx="6" cy="17" r="2"/>
                    <circle cx="16" cy="17" r="2"/>
                    <line x1="8" y1="12" x2="14" y2="12"/>
                  </svg>
                ),
              },
              {
                name: 'Agencies',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="8" width="18" height="12" rx="1"/>
                    <path d="M7 8V6a4 4 0 0 1 8 0v2"/>
                    <line x1="11" y1="13" x2="11" y2="15"/>
                    <circle cx="11" cy="13" r="1"/>
                  </svg>
                ),
              },
            ] as { name: string; icon: React.ReactNode }[]).map((item, i, arr) => (
              <span key={item.name} className="flex items-center gap-6">
                <span className="flex flex-col items-center gap-1.5 text-[#111827]/60">
                  {item.icon}
                  <span className="text-xs font-semibold text-[#111827]/65 whitespace-nowrap">{item.name}</span>
                </span>
                {i < arr.length - 1 && (
                  <span className="hidden sm:block w-px h-8 bg-[#111827]/10" aria-hidden="true" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Value Prop
// ---------------------------------------------------------------------------

function ValuePropSection() {
  const reviews = [
    {
      name: 'Sarah M.',
      rating: 5,
      text: 'Best coffee shop in the area. Staff are always so welcoming and the espresso is incredible.',
      reply: "Thank you so much, Sarah! Welcoming guests is what we’re all about — see you next time ☕",
      rotate: '-rotate-1',
      delay: '0s',
    },
    {
      name: 'James T.',
      rating: 2,
      text: 'Waited 25 minutes for a table with no update. Food was fine but the experience let us down.',
      reply: "Hi James, we’re really sorry about the wait — that’s not the experience we want for anyone. We’d love to make it right.",
      rotate: 'rotate-1',
      delay: '0.4s',
    },
    {
      name: 'Priya K.',
      rating: 5,
      text: 'Absolutely love this place. Came for my birthday and they made it so special. 10/10.',
      reply: "Happy birthday, Priya! 🎉 So glad we could be part of your day — it means the world to us.",
      rotate: '-rotate-[0.5deg]',
      delay: '0.8s',
    },
  ];

  return (
    <section id="how-it-works" className="bg-white px-6 lg:px-16 py-24 overflow-visible">
      <div className="max-w-[1380px] mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Left: copy */}
        <div>
          <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">how it works</p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-[1.1] text-[#111827] mb-6">
            Stop writing the same reply 40 times a month.
          </h2>
          <p className="text-[#111827]/65 text-base leading-relaxed mb-8">
            Moffu handles every Google review in your voice — same day, every day. It sounds like you because you trained it to.
          </p>

          <ul className="space-y-4 mb-10">
            {[
              ['Connect in 2 minutes', 'Link your Google Business Profile — no technical setup.'],
              ['Train your Brand Brain once', 'Set your tone, rules, and what your AI should never say.'],
              ['Approve before it posts', 'Every reply is a draft until you say go. You stay in control.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-black text-[#111827]">{title}</p>
                  <p className="text-sm text-[#111827]/55 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="inline-flex items-center gap-2 bg-[#111827] text-white text-xs font-bold px-4 py-2 rounded-lg">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            One setup. Done forever.
          </div>
        </div>

        {/* Right: floating review cards */}
        <div className="relative flex flex-col gap-5 py-6">
          {reviews.map((r, i) => (
            <div
              key={r.name}
              className={`bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)] ${
                i === 0 ? 'float-a' : i === 1 ? 'float-b' : 'float-c'
              } ${i === 1 ? 'ml-6' : i === 2 ? 'ml-3' : ''}`}
            >
              {/* Reviewer row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-black text-[#111827]">
                  {r.name[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#111827]">{r.name}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <svg key={si} className={`w-3 h-3 ${si < r.rating ? 'text-[#F59E0B]' : 'text-[#E5E7EB]'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                    ))}
                  </div>
                </div>
                <div className="ml-auto">
                  <svg className="w-4 h-4 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#111827]/65 leading-relaxed mb-3">{r.text}</p>
              {/* Draft reply */}
              <div className="bg-[#F3F4F6] rounded-xl px-3 py-2.5 flex gap-2 items-start">
                <span className="text-[9px] font-black text-[#111827]/40 uppercase tracking-widest mt-0.5 flex-shrink-0">Draft</span>
                <p className="text-[11px] text-[#111827]/70 leading-relaxed">{r.reply}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}


// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURES_GRID = [
  {
    title: 'Tone & Personality',
    description: 'Define how your brand speaks — formal, friendly, warm, or professional. Brand Brain applies it consistently across every response.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    title: 'Negative Review Handling',
    description: 'Set rules for how to respond to 1-star and 2-star reviews. Empathetic, solution-focused replies — without you writing each one.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Response Rules',
    description: 'Tell your AI what to always say, never say, and how to handle common topics like wait times, staff, or pricing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Location-Specific Settings',
    description: 'Running multiple locations? Customise Brand Brain per location — different staff names, local offers, and neighbourhood context.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Language Support',
    description: 'Serve customers in their language. Brand Brain keeps your tone consistent whether responding in English, Spanish, or beyond.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    title: 'Always Your Approval',
    description: 'Brand Brain drafts — you approve. Every AI response is a suggestion until you publish it. You stay in control at all times.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="bg-[#F3F4F6] px-6 lg:px-16 py-24">
      <div className="max-w-[1380px] mx-auto">
        <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-6">
          Features
        </p>
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-black leading-[1.05] tracking-tight text-[#111827] mb-6 max-w-3xl">
          Teach your AI how your brand communicates.
        </h2>
        <p className="text-lg text-[#6B7280] leading-relaxed mb-14 max-w-2xl">
          Brand Brain is the layer between raw AI and your business. Configure it once with
          your tone, rules, and preferences — and every Google review response sounds
          authentically like you.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_GRID.map(({ title, description, icon }) => (
              <div key={title} className="bg-white rounded-xl p-7 border border-[#E5E7EB]">
                <div className="w-10 h-10 rounded-lg bg-white text-[#111827] flex items-center justify-center mb-5">
                  {icon}
                </div>
                <h4 className="font-black text-[#111827] mb-2">{title}</h4>
                <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Case Study
// ---------------------------------------------------------------------------

function CaseStudySection() {
  return (
    <section className="bg-white px-6 lg:px-16 py-24 min-h-screen flex items-center">
      <div className="max-w-[1380px] mx-auto w-full">
        <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">Real results</p>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black text-[#111827] leading-[1.1] mb-4">
          From 3.9★ to 4.6★ in 6 weeks.
        </h2>
        <p className="text-[#111827]/50 text-base mb-14 max-w-xl leading-relaxed">
          The Bloom Café was struggling with unanswered reviews and no time to respond. Here's what changed.
        </p>

        <div className="grid md:grid-cols-2 gap-5 mb-10">
          {/* Before */}
          <div className="rounded-2xl p-7 border border-[#E5E7EB] bg-[#F3F4F6]">
            <p className="text-xs font-semibold text-[#111827]/40 uppercase tracking-widest mb-6">Before Moffu</p>
            <ul className="space-y-4">
              {[
                '3.9★ average on Google',
                '2–3 hrs/week replying to reviews',
                'Negative reviews left unanswered',
                'No system to ask for new reviews',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-[#111827]/60">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-2xl p-7 border border-[#E5E7EB] bg-[#F3F4F6]">
            <p className="text-xs font-semibold text-[#2ECC8A] uppercase tracking-widest mb-6">After Moffu</p>
            <ul className="space-y-4">
              {[
                ['4.6★ average', '— 0.7 points gained'],
                ['Replies in under 2 min', '— same day, every day'],
                ['100% reviews responded', '— not one missed'],
                ['47 new reviews', '— via email campaign'],
              ].map(([bold, rest]) => (
                <li key={bold} className="flex items-center gap-3 text-sm text-[#111827]/80">
                  <span className="w-5 h-5 rounded-full bg-[#2ECC8A]/25 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-[#2ECC8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  </span>
                  <span><strong className="text-[#111827] font-semibold">{bold}</strong><span className="text-[#111827]/50">{rest}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quote */}
        <div className="rounded-2xl p-7 border border-[#E5E7EB] bg-[#F3F4F6]">
          <svg className="w-7 h-7 text-[#2ECC8A] mb-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
          </svg>
          <p className="text-[#111827] text-lg font-medium italic leading-relaxed mb-4">
            "I didn't realise how much a half-star improvement would change our walk-in traffic. Moffu paid for itself in the first month."
          </p>
          <p className="text-[#111827]/40 text-sm font-semibold">Sarah M., Owner · The Bloom Café</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

async function fetchPricingPlans(): Promise<PricingPlan[]> {
  noStore();
  try {
    const supabase = createServerClient();
    const [plansRes, pricesRes] = await Promise.all([
      supabase
        .from('plans')
        .select('id, slug, name, description, features, badge_text, is_featured, contact_sales')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('plan_prices')
        .select('plan_id, billing_interval, amount_cents, currency')
        .eq('is_active', true),
    ]);

    const plans = plansRes.data ?? [];
    const prices = pricesRes.data ?? [];

    return plans.map((p) => {
      const planPrices = prices.filter((pr) => pr.plan_id === p.id);
      const monthly = planPrices.find((pr) => pr.billing_interval === 'monthly');
      const annual = planPrices.find((pr) => pr.billing_interval === 'annual');
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
        badge_text: p.badge_text ?? null,
        is_featured: p.is_featured ?? false,
        contact_sales: p.contact_sales ?? false,
        monthly_cents: monthly?.amount_cents ?? 0,
        annual_cents: annual?.amount_cents ?? 0,
        currency: monthly?.currency ?? annual?.currency ?? 'USD',
      };
    });
  } catch {
    return [];
  }
}

async function PricingSection({ waitlistEnabled, portalUrl }: { waitlistEnabled: boolean; portalUrl: string }) {
  const plans = await fetchPricingPlans();
  return (
    <section id="pricing" className="bg-[#F3F4F6] px-6 lg:px-16 min-h-[100svh] flex items-center py-20">
      <div className="max-w-[1380px] mx-auto w-full">
        <PricingToggle plans={plans} waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'Does Moffu work with Google Business Profile?',
    a: 'Yes. Moffu connects directly to your Google Business Profile to pull in reviews and publish AI-generated replies — all without leaving the dashboard.',
  },
  {
    q: 'How does the AI generate replies?',
    a: 'You set up your Brand Brain — your business identity, tone of voice, and reply rules per star rating. The AI uses that profile to craft replies that sound exactly like you, not a generic bot.',
  },
  {
    q: 'Can I manage multiple locations?',
    a: 'Absolutely. Every plan supports at least one location, and you can add more as add-ons. Higher-tier plans include multiple locations out of the box.',
  },
  {
    q: 'What is the Brand Brain?',
    a: 'Brand Brain is your AI identity profile. You tell Moffu your business name, tone of voice, language, and how to respond to different star ratings. Every reply follows those rules automatically.',
  },
  {
    q: 'What are Review Request Campaigns?',
    a: 'Campaigns let you email past customers and ask them to leave a Google review. Upload a contact list, customise the message with your branding, and track opens and clicks.',
  },
  {
    q: 'How fast are replies published?',
    a: 'Moffu can sync and auto-reply to new reviews within hours. You can also trigger a manual sync anytime from the Reviews page or let the auto-sync run on a schedule you choose.',
  },
  {
    q: 'Can I edit a reply before it goes live?',
    a: 'Yes. Every AI-generated reply is a draft first. You can edit it, approve it as-is, or regenerate a new version before it is published to Google.',
  },
  {
    q: 'What languages does Moffu support?',
    a: 'Moffu can generate replies in any language your Brand Brain is configured for. You can set a default language and override it per location.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes — the Free plan lets you get started at no cost with one location and limited replies per month. No credit card required.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription at any time from the billing page. Your account stays active until the end of the billing period.',
  },
];

function FAQSection() {
  return (
    <section id="faq" className="bg-white px-6 lg:px-16 min-h-screen flex items-center py-20">
      <div className="max-w-[1380px] mx-auto w-full">
        <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">faq</p>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black text-[#111827] leading-[1.1] mb-10">
          Common questions.
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
              <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none select-none hover:bg-[#F3F4F6] transition-colors duration-150">
                <span className="text-sm font-black text-[#111827] pr-4 leading-snug">{item.q}</span>
                <span className="w-6 h-6 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-open:rotate-45">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14"/>
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-6 pt-3 text-sm text-[#6B7280] leading-relaxed border-t border-[#F3F4F6]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const supabase = await createServerClient();
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro';

  const { data: wSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'waitlist_enabled')
    .single();
  const waitlistEnabled = wSetting?.value === 'true';

  return (
    <main>
      <HeroSection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      <ValuePropSection />
      <FeaturesSection />
      <CaseStudySection />
      <PricingSection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      <FAQSection />
    </main>
  );
}
