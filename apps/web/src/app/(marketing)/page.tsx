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
            <p className="text-xs text-[#111827]">*7 replies a week included.</p>
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
  return (
    <section id="how-it-works" className="bg-white px-6 lg:px-16 py-32 overflow-visible">
      <div className="max-w-[1380px] mx-auto grid md:grid-cols-2 gap-16 items-center">
        {/* Left: copy */}
        <div>
          <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-black leading-[1.1] text-[#111827] mb-6">
            Stop writing the same reply 40 times a month.
          </h2>
          <p className="text-[#111827]/65 text-lg leading-relaxed mb-8">
            Moffu handles every Google review in your voice — same day, every day. It sounds like you because you trained it to.
          </p>
          <p className="text-sm font-semibold text-[#111827]">One setup. Done forever.</p>
        </div>

        {/* Right: animated phone mockup */}
        <ReviewMockup />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats comparison
// ---------------------------------------------------------------------------

function StatsSection() {
  const rows = [
    { label: 'Independent restaurants', pct: 15 },
    { label: 'Chains', pct: 56 },
    { label: 'You with Moffu', pct: 100, highlight: true },
  ];
  return (
    <section className="bg-[#EDF5F1] px-6 lg:px-16 py-16">
      <div className="max-w-[1380px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm font-semibold text-[#111827]">Google review reply rate</p>
          <p className="text-xs text-[#111827]/50">the numbers tell the story</p>
        </div>
        <div className="space-y-5">
          {rows.map(({ label, pct, highlight }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${highlight ? 'font-semibold text-[#111827]' : 'text-[#111827]/60'}`}>{label}</span>
                <span className={`text-sm font-bold ${highlight ? 'text-[#111827]' : 'text-[#111827]/50'}`}>{pct}%</span>
              </div>
              <div className="h-2 bg-[#B8EDDA] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${highlight ? 'bg-[#2ECC8A]' : 'bg-[#2ECC8A]/30'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  'Restaurants', 'Cafés', 'Salons & spas', 'Dentists', 'Clinics',
  'Hotels', 'Auto repair', 'Gyms', 'Retail shops', 'Plumbers & trades',
  'Real estate', 'Vets', 'And many more',
];

function IndustriesSection() {
  return (
    <section className="bg-white px-6 lg:px-16 py-20">
      <div className="max-w-[1380px] mx-auto">
        <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">who it's for</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black leading-[1.1] text-[#111827] mb-4">
          On Google?<br />Moffu's for you.
        </h2>
        <p className="text-[#111827]/65 text-base mb-10 max-w-xl">
          Any business with a Google Business Profile can use Moffu, whatever you sell, wherever you are. Moffu replies in 37 languages.
        </p>

        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((name, i) => (
            <span
              key={name}
              className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                i === 0
                  ? 'bg-[#111827] text-white border-[#111827]'
                  : 'bg-white text-[#111827] border-[#E5E7EB] hover:border-[#111827]'
              }`}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: 'Replies that run themselves.',
    body: 'Moffu reads each review and replies in your voice, the same day. No extra staff. Set it once and every new review gets a thoughtful, on-brand response automatically.',
    tinted: true,
  },
  {
    title: 'Hours back for what matters.',
    body: 'Reviews get answered in the background while you work on what moves your business. No more Sunday-night review piles or scrambling for the right words.',
    tinted: false,
  },
  {
    title: 'Brand voice that scales.',
    body: 'Reply like a chain without hiring one. Set your tone, your language, and per-star rules — then Moffu sounds like you across every location, every time.',
    tinted: true,
  },
];

function FeaturesSection() {
  return (
    <div>
      {FEATURES.map(({ title, body, tinted }) => (
        <section
          key={title}
          className={`px-6 lg:px-16 py-20 ${tinted ? 'bg-[#EDF5F1]' : 'bg-white'}`}
        >
          <div className="max-w-[1380px] mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-[1.1] mb-4 text-[#111827]">
                {title}
              </h2>
              <p className="text-base leading-relaxed text-[#111827]/65">
                {body}
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="w-10 h-10 rounded-xl bg-[#2ECC8A] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case Study
// ---------------------------------------------------------------------------

function CaseStudySection() {
  return (
    <section className="bg-[#2ECC8A] px-6 lg:px-16 py-20">
      <div className="max-w-[1380px] mx-auto">
        <p className="text-xs font-semibold text-[#111827]/60 uppercase tracking-widest mb-3">Real results</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-[#111827] leading-[1.1] mb-4">
          From 3.9★ to 4.6★ in 6 weeks.
        </h2>
        <p className="text-[#111827]/65 text-base mb-12 max-w-xl">
          The Bloom Café was struggling with unanswered reviews and no time to respond. Here's what changed.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/40 rounded-2xl p-6 border border-[#111827]/10">
            <p className="text-xs font-semibold text-[#111827]/60 uppercase tracking-widest mb-5">Before Moffu</p>
            <ul className="space-y-3">
              {[
                '3.9★ average on Google',
                '2–3 hrs/week replying to reviews',
                'Negative reviews left unanswered',
                'No system to ask for new reviews',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#111827]/75">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-[#111827]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#111827]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </div>
          </div>

          <div className="bg-white/40 rounded-2xl p-6 border border-[#111827]/10">
            <p className="text-xs font-semibold text-[#111827]/60 uppercase tracking-widest mb-5">After Moffu</p>
            <ul className="space-y-3">
              {[
                ['4.6★ average', '— 0.7 points gained'],
                ['Replies in under 2 min', '— same day, every day'],
                ['100% reviews responded', '— not one missed'],
                ['47 new reviews', '— via email campaign'],
              ].map(([bold, rest]) => (
                <li key={bold} className="flex items-start gap-2 text-sm text-[#111827]/75">
                  <span className="text-[#111827] mt-0.5 flex-shrink-0">✓</span>
                  <span><strong className="text-[#111827]">{bold}</strong>{rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <blockquote className="mt-12 border-l-4 border-[#111827]/25 pl-6">
          <p className="text-[#111827] text-lg font-medium italic leading-relaxed">
            "I didn't realise how much a half-star improvement would change our walk-in traffic. Moffu paid for itself in the first month."
          </p>
          <footer className="mt-3 text-[#111827]/60 text-sm font-semibold">— Sarah M., Owner · The Bloom Café</footer>
        </blockquote>
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
    <section id="pricing" className="bg-[#EDF5F1] px-6 lg:px-16 min-h-[100svh] flex items-center py-20">
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
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-[#111827] leading-[1.1] mb-10">
          Common questions.
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group border border-[#E5E7EB] rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-[#EDF5F1] transition-colors">
                <span className="text-sm font-semibold text-[#111827] pr-4">{item.q}</span>
                <svg className="w-4 h-4 text-[#111827]/40 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </summary>
              <div className="px-5 pb-5 pt-1 text-sm text-[#111827]/65 leading-relaxed border-t border-[#F3F4F6]">
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
      <StatsSection />
      <IndustriesSection />
      <FeaturesSection />
      <CaseStudySection />
      <PricingSection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      <FAQSection />
    </main>
  );
}
