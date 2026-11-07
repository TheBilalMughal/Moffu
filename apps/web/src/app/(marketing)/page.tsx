export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { PricingToggle, type PricingPlan } from '../_components/PricingToggle';
import { WaitlistButton } from '../_components/WaitlistButton';
import { createServerClient } from '../../lib/supabase/server';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroSection({ waitlistEnabled, portalUrl }: { waitlistEnabled: boolean; portalUrl: string }) {
  return (
    <section className="bg-[#D4FF53] px-6 lg:px-12 pt-20 pb-16 md:pt-24 md:pb-20">
      <div className="max-w-5xl mx-auto text-center">
        {/* Eyebrow */}
        <p className="text-sm font-medium text-[#1a2e00]/60 mb-8 tracking-wide">
          your Google reviews, all of them,
        </p>

        {/* Headline */}
        <h1 className="font-black leading-[0.92] tracking-tight text-[#111827] mb-0">
          <span
            className="block text-[clamp(4rem,12vw,9rem)] line-through decoration-[#0D4C3C] decoration-[7px] opacity-60"
            aria-hidden="true"
          >
            unanswered
          </span>
          <span className="block text-[clamp(4.5rem,13vw,10rem)]">ANSWERED.</span>
        </h1>

        <p className="text-xs font-bold text-[#1a2e00]/50 uppercase tracking-[0.25em] mt-7 mb-3">
          YOUR BUSINESS. YOUR VOICE. YOUR TIME BACK.
        </p>

        <Link
          href="/feature"
          className="inline-block text-sm font-semibold text-[#111827] underline underline-offset-2 decoration-[#111827]/30 hover:decoration-[#111827] transition-colors mb-10"
        >
          see moffu reply to your reviews
        </Link>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <WaitlistButton
            enabled={waitlistEnabled}
            label={waitlistEnabled ? 'Join Waitlist →' : 'Start Free →'}
            source="hero"
            portalUrl={portalUrl}
            arrow={false}
            className="inline-flex items-center gap-2 bg-[#111827] text-white font-semibold text-base px-8 py-3.5 rounded-lg hover:bg-[#1f2937] transition-colors"
          />
          <p className="text-xs text-[#1a2e00]/50">No trial. No credit card. Free for all locations.*</p>
          <p className="text-xs text-[#1a2e00]/40">*Up to 7 replies each week per location.</p>
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
    <section className="bg-white px-6 lg:px-12 py-20">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Left text */}
        <div>
          <h2 className="text-[clamp(2rem,5vw,3rem)] font-black leading-[1.1] text-[#111827] mb-5">
            Take Google reviews off your plate.
          </h2>
          <p className="text-[#6B7280] text-base leading-relaxed mb-6">
            Moffu replies to every Google review in your business's voice, the same day. No extra staff. No hours lost. Free for all locations.
          </p>
          <p className="text-sm font-semibold text-[#111827]">Save 15+ hours a month, on autopilot.</p>
        </div>

        {/* Right — mock review card */}
        <div className="bg-[#F7F7F5] rounded-2xl p-5 border border-[#E5E7EB]">
          {/* Business header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#0D4C3C] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Maple Street Bakery</p>
              <p className="text-xs text-[#9CA3AF]">Google Business Profile</p>
            </div>
          </div>

          {/* Review */}
          <div className="bg-white rounded-xl p-4 mb-3 border border-[#E5E7EB]">
            <div className="flex items-center gap-1 mb-2">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
            <p className="text-xs text-[#374151]">"The croissants were absolutely perfect! Came back for the third time this week..."</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1.5">— Lucia G.</p>
          </div>

          {/* Moffu reply */}
          <div className="bg-[#0D4C3C] rounded-xl p-4">
            <p className="text-[11px] font-semibold text-[#6FB89A] uppercase tracking-widest mb-2">Moffu replied</p>
            <p className="text-xs text-white/90 leading-relaxed">"Thank you so much, Lucia! Knowing you keep coming back genuinely makes our mornings. We'll have a fresh batch waiting for you..."</p>
          </div>

          {/* Footer badge */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-[#9CA3AF]">Replied in 3 hours</span>
            <span className="text-[11px] font-semibold text-[#0D4C3C]">Published to Google ✓</span>
          </div>
        </div>
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
    <section className="bg-[#0F1117] px-6 lg:px-12 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm font-semibold text-white">Google review reply rate</p>
          <p className="text-xs text-[#6B7280]">the numbers tell the story</p>
        </div>
        <div className="space-y-5">
          {rows.map(({ label, pct, highlight }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${highlight ? 'font-semibold text-[#D4FF53]' : 'text-[#9CA3AF]'}`}>{label}</span>
                <span className={`text-sm font-bold ${highlight ? 'text-[#D4FF53]' : 'text-[#6B7280]'}`}>{pct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${highlight ? 'bg-[#D4FF53]' : 'bg-white/30'}`}
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
    <section className="bg-white px-6 lg:px-12 py-20">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">who it's for</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black leading-[1.1] text-[#111827] mb-4">
          On Google?<br />Moffu's for you.
        </h2>
        <p className="text-[#6B7280] text-base mb-10 max-w-xl">
          Any business with a Google Business Profile can use Moffu, whatever you sell, wherever you are. Moffu replies in 37 languages.
        </p>

        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((name, i) => (
            <span
              key={name}
              className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                i === 0
                  ? 'bg-[#111827] text-white border-[#111827]'
                  : 'bg-white text-[#374151] border-[#E5E7EB] hover:border-[#111827] hover:text-[#111827]'
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
// Features — 3 panels
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: 'Replies that run themselves.',
    body: 'Moffu reads each review and replies in your voice, the same day. No extra staff. Set it once and every new review gets a thoughtful, on-brand response automatically.',
    dark: true,
  },
  {
    title: 'Hours back for what matters.',
    body: 'Reviews get answered in the background while you work on what moves your business. No more Sunday-night review piles or scrambling for the right words.',
    dark: false,
  },
  {
    title: 'Brand voice that scales.',
    body: 'Reply like a chain without hiring one. Set your tone, your language, and per-star rules — then Moffu sounds like you across every location, every time.',
    dark: true,
  },
];

function FeaturesSection() {
  return (
    <div>
      {FEATURES.map(({ title, body, dark }) => (
        <section
          key={title}
          className={`px-6 lg:px-12 py-20 ${dark ? 'bg-[#0F1117]' : 'bg-[#F7F7F5]'}`}
        >
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className={`text-[clamp(1.75rem,4vw,2.5rem)] font-black leading-[1.1] mb-4 ${dark ? 'text-white' : 'text-[#111827]'}`}>
                {title}
              </h2>
              <p className={`text-base leading-relaxed ${dark ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                {body}
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-[#D4FF53]' : 'bg-[#0D4C3C]'}`}>
                <svg className={`w-5 h-5 ${dark ? 'text-[#111827]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <section className="bg-[#0D4C3C] px-6 lg:px-12 py-20">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold text-[#6FB89A] uppercase tracking-widest mb-3">Real results</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-white leading-[1.1] mb-4">
          From 3.9★ to 4.6★ in 6 weeks.
        </h2>
        <p className="text-[#A7C4BB] text-base mb-12 max-w-xl">
          The Bloom Café was struggling with unanswered reviews and no time to respond. Here's what changed.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-xs font-semibold text-[#6FB89A] uppercase tracking-widest mb-5">Before Moffu</p>
            <ul className="space-y-3">
              {[
                '3.9★ average on Google',
                '2–3 hrs/week replying to reviews',
                'Negative reviews left unanswered',
                'No system to ask for new reviews',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-xs font-semibold text-[#6FB89A] uppercase tracking-widest mb-5">After Moffu</p>
            <ul className="space-y-3">
              {[
                ['4.6★ average', '— 0.7 points gained'],
                ['Replies in under 2 min', '— same day, every day'],
                ['100% reviews responded', '— not one missed'],
                ['47 new reviews', '— via email campaign'],
              ].map(([bold, rest]) => (
                <li key={bold} className="flex items-start gap-2 text-sm text-[#CBD5E1]">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                  <span><strong className="text-white">{bold}</strong>{rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <blockquote className="mt-12 border-l-4 border-[#6FB89A] pl-6">
          <p className="text-white text-lg font-medium italic leading-relaxed">
            "I didn't realise how much a half-star improvement would change our walk-in traffic. Moffu paid for itself in the first month."
          </p>
          <footer className="mt-3 text-[#6FB89A] text-sm font-semibold">— Sarah M., Owner · The Bloom Café</footer>
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
    <section id="pricing" className="bg-[#F7F7F5] px-6 lg:px-12 py-20">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">pricing</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-[#111827] leading-[1.1] mb-3">
          Plans for every stage of growth.
        </h2>
        <p className="text-[#6B7280] text-base mb-12">
          Start with one location or manage hundreds — with flexible add-ons.
        </p>
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
    a: 'Yes. Moffu connects directly to your Google Business Profile to pull in reviews and let you publish AI-generated replies — all without leaving the dashboard.',
  },
  {
    q: 'How does the AI generate replies?',
    a: 'You set up your Brand Brain — your business identity, tone of voice, and reply rules. The AI uses that profile to craft replies that sound exactly like you, not a generic bot.',
  },
  {
    q: 'Can I manage multiple locations?',
    a: 'Absolutely. Every plan supports at least one location, and you can add more as add-ons. Higher-tier plans include multiple locations out of the box.',
  },
  {
    q: 'What are Review Request Campaigns?',
    a: 'Campaigns let you email your past customers and ask them to leave a Google review. You upload a contact list, customise the message with your branding, and track opens and clicks.',
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
    <section id="faq" className="bg-white px-6 lg:px-12 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">faq</p>
        <h2 className="text-[clamp(2rem,5vw,3rem)] font-black text-[#111827] leading-[1.1] mb-12">
          Common questions.
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group border border-[#E5E7EB] rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-[#F7F7F5] transition-colors">
                <span className="text-sm font-semibold text-[#111827] pr-4">{item.q}</span>
                <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </summary>
              <div className="px-5 pb-5 pt-1 text-sm text-[#6B7280] leading-relaxed border-t border-[#F3F4F6]">
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
// Final CTA
// ---------------------------------------------------------------------------

function CTASection({ waitlistEnabled, portalUrl }: { waitlistEnabled: boolean; portalUrl: string }) {
  return (
    <section className="bg-[#D4FF53] px-6 lg:px-12 py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-[clamp(2.5rem,7vw,5rem)] font-black leading-[1.0] text-[#111827] mb-8">
          Start answering.<br />Stop ignoring.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <WaitlistButton
            enabled={waitlistEnabled}
            label={waitlistEnabled ? 'Join Waitlist' : 'Start Free'}
            source="cta_section"
            portalUrl={portalUrl}
            arrow
            className="inline-flex items-center gap-2 bg-[#111827] text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-[#1f2937] transition-colors"
          />
          <a
            href="#pricing"
            className="text-sm font-medium text-[#111827]/60 hover:text-[#111827] transition-colors"
          >
            View pricing →
          </a>
        </div>
        <p className="text-xs text-[#1a2e00]/50 mt-5">No credit card required · Free plan available · Cancel anytime</p>
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
      <CTASection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
    </main>
  );
}
