export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { PricingToggle, type PricingPlan } from '../_components/PricingToggle';
import { WaitlistButton } from '../_components/WaitlistButton';
import { createServerClient } from '../../lib/supabase/server';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-[#0D4C3C] rounded-lg flex items-center justify-center flex-shrink-0">
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <path d="M1 13V1l8 8L17 1v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function CheckSolid({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hero — full-width split screen
// ---------------------------------------------------------------------------

function HeroSection({ waitlistEnabled, portalUrl }: { waitlistEnabled: boolean; portalUrl: string }) {
  return (
    <section className="relative flex-1 flex flex-col overflow-hidden">
      {/* Full-width background image */}
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        className="object-cover object-center"
        priority
        aria-hidden="true"
      />
      {/* Fallback gradient */}
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(145deg, #C9B49A 0%, #A8896A 35%, #7A6050 65%, #5C4535 100%)' }}
        aria-hidden="true"
      />
      {/* Left overlay — white fade so text stays legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right, white 22%, rgba(255,255,255,0.80) 38%, transparent 52%)' }}
        aria-hidden="true"
      />

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex items-center px-8 lg:px-16 xl:px-24">
        <div className="max-w-[680px]">
          <p className="text-[11px] font-semibold text-[#0D4C3C] uppercase tracking-[0.14em] mb-5">
            · Google Review Management
          </p>
          <h1 className="text-5xl xl:text-[3.25rem] leading-[1.12] font-bold text-[#111827] mb-5">
            AI review responses that sound like your brand.
          </h1>
          <p className="text-[1.0625rem] text-[#6B7280] leading-relaxed mb-9">
            Connect your Google Business Profile, teach your AI agent how your brand
            communicates, and turn customer reviews into thoughtful, on-brand responses.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-10">
            <WaitlistButton
              enabled={waitlistEnabled}
              label={waitlistEnabled ? 'Join Waitlist' : 'Get Started'}
              source="hero"
              portalUrl={portalUrl}
              className="bg-[#0D4C3C] hover:bg-[#083F32] text-white px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors duration-150"
            />
            <Link
              href="/feature"
              className="border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#111827] px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors duration-150"
            >
              See How It Works
            </Link>
          </div>
          <div className="flex flex-row items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-[#6B7280] whitespace-nowrap">Google Business Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs text-[#6B7280] whitespace-nowrap">Your Brand Voice Everywhere</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-[#6B7280] whitespace-nowrap">Built for Multi-Location Businesses</span>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

function TrustedBySection() {
  return (
    <section className="bg-white px-8 lg:px-16 py-10 reveal">
      <p className="text-center text-[13px] text-[#6B7280] mb-7">
        Trusted by businesses that care about their reputation
      </p>
      <div className="flex flex-wrap justify-center gap-10 lg:gap-16 reveal-stagger">
        {INDUSTRIES.map(({ label, icon }) => (
          <div key={label} className="flex flex-col items-center gap-2 text-[#9CA3AF]">
            {icon}
            <span className="text-xs text-[#9CA3AF]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trusted by
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  {
    label: 'Restaurants',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h.01M7 3h.01M3 7h18M5 21V11a2 2 0 012-2h10a2 2 0 012 2v10M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4" /></svg>,
  },
  {
    label: 'Hotels',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    label: 'Healthcare',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  },
  {
    label: 'Retail',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  },
  {
    label: 'Salons & Spas',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>,
  },
  {
    label: 'Automotive',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  },
  {
    label: 'Agencies',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
];


// ---------------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------------

const HOW_IT_WORKS_STEPS = [
  { n: '1', title: 'Connect Google Business', body: 'Securely connect your Google Business Profile.' },
  { n: '2', title: 'Build your Brand Brain', body: 'Set your tone, rules, and response preferences.' },
  { n: '3', title: 'AI prepares responses', body: 'Get thoughtful, on-brand drafts for new reviews.' },
  { n: '4', title: 'Review & publish', body: 'Edit if needed, then publish directly to Google.' },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 bg-white flex-1 flex flex-col justify-center">
      <div className="px-8 lg:px-16">
        <div className="text-center mb-10 reveal">
          <h2 className="text-[2.125rem] font-bold text-[#111827] mb-3">How It Works</h2>
          <p className="text-[#6B7280] text-[1.0625rem]">
            Get from reviews to on-brand responses in four simple steps.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 reveal-stagger">
          {HOW_IT_WORKS_STEPS.map(({ n, title, body }) => (
            <div key={n} className="border border-[#E5E7EB] rounded-xl p-7 bg-white">
              <div className="w-9 h-9 rounded-full bg-[#0D4C3C] text-white flex items-center justify-center text-sm font-bold mb-6">
                {n}
              </div>
              <h3 className="font-bold text-[#111827] mb-2 text-[1rem]">{title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Brand Brain — full-width split
// ---------------------------------------------------------------------------

const BRAND_BRAIN_FEATURES = [
  'Tone and personality',
  'Negative review handling',
  'Response rules',
  'Location-specific settings',
  'Languages',
];

function BrandBrainSection() {
  return (
    <section id="product" className="grid lg:grid-cols-2 flex-1 bg-white">
      {/* Left — product screenshot with padding so all corners show */}
      {/* Place file at apps/web/public/images/brand-brain.jpg */}
      <div className="flex items-center px-8 lg:px-16 py-8">
        <div className="relative w-full h-full min-h-[320px] overflow-hidden rounded-2xl">
          <Image
            src="/images/brand-brain.jpg"
            alt="Moffu Brand Brain dashboard — AI review management interface"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[#F8FAFB] -z-10">
            <div className="text-center text-[#9CA3AF] p-10">
              <svg className="w-16 h-16 mx-auto mb-4 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">[Product screenshot — asset TBD]</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — text */}
      <div className="flex flex-col justify-center px-8 lg:px-16 xl:px-20 py-20 bg-white reveal">
        <h2 className="text-[2.375rem] leading-[1.15] font-bold text-[#111827] mb-5">
          Your AI should learn your brand, not sound like everyone else.
        </h2>
        <p className="text-[#6B7280] mb-8 leading-relaxed text-[1.0625rem]">
          Brand Brain helps your AI agent understand your business, tone, and response
          style — so every reply feels like you.
        </p>

        <div className="grid grid-cols-2 gap-y-3.5 gap-x-8 mb-9">
          {BRAND_BRAIN_FEATURES.map((feat) => (
            <div key={feat} className="flex items-start gap-2">
              <div className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#0D4C3C]">
                <CheckSolid />
              </div>
              <span className="text-sm text-[#374151]">{feat}</span>
            </div>
          ))}
        </div>

        <div>
          <Link
            href="/feature"
            className="inline-block border border-[#D1D5DB] bg-white hover:bg-[#F8FAFB] text-[#374151] px-6 py-3 rounded-lg text-sm font-medium transition-colors duration-150"
          >
            Learn about Brand Brain
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing — fetched from DB
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
    <section id="pricing" className="h-screen flex flex-col justify-center bg-[#F8FAFB]">
      <div className="px-8 lg:px-16">
        <div className="text-center mb-10 reveal">
          <h2 className="text-[2.125rem] font-bold text-[#111827] mb-3">
            Plans for every stage of growth
          </h2>
          <p className="text-[#6B7280] text-[1.0625rem]">
            Start with one location or manage hundreds — with flexible add-ons.
          </p>
        </div>
        <PricingToggle plans={plans} waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

function IntegrationsSection() {
  const integrations = [
    {
      name: 'Google Business',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      label: 'Google Business',
      desc: 'Reviews & replies',
      status: 'live',
    },
    {
      name: 'Resend',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true">
          <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0v.01L12 13l7-7.99V5H5zm0 2.41V19h14V7.41l-7 7.99-7-7.99z"/>
        </svg>
      ),
      label: 'Resend',
      desc: 'Campaign emails',
      status: 'live',
    },
    {
      name: 'Stripe',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#635BFF" aria-hidden="true">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
        </svg>
      ),
      label: 'Stripe',
      desc: 'Billing & payments',
      status: 'live',
    },
    {
      name: 'SMS',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
      ),
      label: 'SMS',
      desc: 'Campaign texts',
      status: 'soon',
    },
    {
      name: 'WhatsApp',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#25D366" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.885.52 3.65 1.428 5.163L2 22l4.917-1.407A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
        </svg>
      ),
      label: 'WhatsApp',
      desc: 'Campaign messages',
      status: 'soon',
    },
    {
      name: 'More',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
        </svg>
      ),
      label: 'More coming',
      desc: 'Integrations roadmap',
      status: 'soon',
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-[#E5E7EB]">
      <div className="px-8 lg:px-16 max-w-5xl mx-auto">
        <div className="text-center mb-10 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4C3C] mb-3">Integrations</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 reveal">
          {integrations.map(item => (
            <div key={item.name} className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center ${
              item.status === 'soon'
                ? 'border-dashed border-[#E5E7EB] bg-[#FAFAFA] opacity-60'
                : 'border-[#E5E7EB] bg-white hover:border-[#0D4C3C] hover:shadow-sm transition-all'
            }`}>
              <div className={item.status === 'soon' ? 'text-[#9CA3AF]' : ''}>{item.icon}</div>
              <p className="text-xs font-semibold text-[#111827] leading-tight">{item.label}</p>
              <p className="text-[11px] text-[#9CA3AF] leading-tight">{item.desc}</p>
              {item.status === 'soon' && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#F3F4F6] text-[#6B7280] text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Case Study Strip
// ---------------------------------------------------------------------------

function CaseStudySection() {
  return (
    <section className="py-20 bg-[#0D4C3C]">
      <div className="px-8 lg:px-16 max-w-5xl mx-auto">
        <div className="text-center mb-12 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6FB89A] mb-3">Real results</p>
          <h2 className="text-[2rem] font-bold text-white">From 3.9★ to 4.6★ in 6 weeks</h2>
          <p className="text-[#A7C4BB] mt-3 max-w-xl mx-auto">
            The Bloom Café was struggling with negative reviews and had no time to respond. Here's what changed after switching to Moffu.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 reveal">
          {/* Before */}
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-[#6FB89A] text-xs font-semibold uppercase tracking-widest mb-4">Before Moffu</p>
            <ul className="space-y-3 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400 flex-shrink-0">✕</span>
                3.9★ average on Google
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400 flex-shrink-0">✕</span>
                Replying to reviews took 2–3 hrs/week
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400 flex-shrink-0">✕</span>
                Negative reviews left unanswered for weeks
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400 flex-shrink-0">✕</span>
                No system to ask happy customers for reviews
              </li>
            </ul>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </div>
              <p className="text-[#6FB89A] text-xs font-semibold text-center">6 weeks<br/>with Moffu</p>
            </div>
          </div>

          {/* After */}
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-[#6FB89A] text-xs font-semibold uppercase tracking-widest mb-4">After Moffu</p>
            <ul className="space-y-3 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400 flex-shrink-0">✓</span>
                <span><strong className="text-white">4.6★</strong> average — 0.7 points gained</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400 flex-shrink-0">✓</span>
                Replies sent in <strong className="text-white">under 2 minutes</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400 flex-shrink-0">✓</span>
                <strong className="text-white">100%</strong> of reviews responded to
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-green-400 flex-shrink-0">✓</span>
                <strong className="text-white">47 new reviews</strong> via email campaign
              </li>
            </ul>
          </div>
        </div>

        {/* Quote */}
        <div className="mt-10 text-center reveal">
          <blockquote className="text-[#E2EDE8] text-lg font-medium italic max-w-2xl mx-auto">
            "I didn't realise how much a half-star improvement would change our walk-in traffic. Moffu paid for itself in the first month."
          </blockquote>
          <p className="text-[#6FB89A] text-sm mt-3 font-semibold">— Sarah M., Owner · The Bloom Café</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsSection() {
  const stats = [
    { value: '2,400+', label: 'Businesses trust Moffu' },
    { value: '180k+',  label: 'Reviews managed' },
    { value: '4.8★',   label: 'Average rating boost' },
    { value: '3 min',  label: 'Average setup time' },
  ];
  return (
    <section className="bg-white py-10">
      <div className="px-8 lg:px-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center reveal">
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-[#0D4C3C]">{s.value}</p>
              <p className="text-sm text-[#6B7280] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Moffu helped us go from 3.9 to 4.6 stars on Google in just 6 weeks. The AI replies save our team hours every week.",
      name: 'Sarah M.',
      role: 'Owner, The Bloom Café',
      stars: 5,
    },
    {
      quote: "We manage 12 locations and Moffu keeps everything in one place. The Brand Brain feature is a game-changer for consistent responses.",
      name: 'James R.',
      role: 'Operations Manager, FreshFit Gyms',
      stars: 5,
    },
    {
      quote: "Before Moffu I was manually replying to 40+ reviews a week. Now it takes 15 minutes. Absolute must-have.",
      name: 'Aisha K.',
      role: 'Founder, Nourish Bakehouse',
      stars: 5,
    },
  ];

  return (
    <section className="py-20 bg-[#F8FAFB]">
      <div className="px-8 lg:px-16">
        <div className="text-center mb-12 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4C3C] mb-3">What customers say</p>
          <h2 className="text-[2rem] font-bold text-[#111827]">Loved by local businesses</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm reveal flex flex-col">
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[#374151] text-sm leading-relaxed flex-1">"{t.quote}"</p>
              <div className="mt-5 pt-4 border-t border-[#F3F4F6]">
                <p className="text-sm font-semibold text-[#111827]">{t.name}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
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
    a: 'Campaigns let you email your past customers and ask them to leave a Google review. You upload a contact list, customize the message with your branding, and track opens and clicks.',
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
    <section id="faq" className="py-20 bg-white">
      <div className="px-8 lg:px-16 max-w-3xl mx-auto">
        <div className="text-center mb-12 reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4C3C] mb-3">FAQ</p>
          <h2 className="text-[2rem] font-bold text-[#111827]">Common questions</h2>
        </div>
        <div className="space-y-4 reveal">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group border border-[#E5E7EB] rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-[#F8FAFB] transition-colors">
                <span className="text-sm font-semibold text-[#111827] pr-4">{item.q}</span>
                <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </summary>
              <div className="px-5 pb-4 pt-1 text-sm text-[#6B7280] leading-relaxed border-t border-[#F3F4F6]">
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
    <section className="py-24 bg-[#0D4C3C]">
      <div className="px-8 lg:px-16 text-center reveal">
        <h2 className="text-[2.25rem] font-bold text-white mb-4 leading-tight">
          Start growing your reputation today
        </h2>
        <p className="text-[#A7C4BB] text-lg mb-8 max-w-xl mx-auto">
          Join 2,400+ businesses that use Moffu to manage reviews, build trust, and win more customers.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <WaitlistButton
            enabled={waitlistEnabled}
            label={waitlistEnabled ? 'Join Waitlist' : 'Get started free'}
            source="cta_section"
            portalUrl={portalUrl}
            arrow
            className="inline-flex items-center gap-2 bg-white text-[#0D4C3C] font-semibold px-7 py-3.5 rounded-xl text-sm hover:bg-[#F0F9F6] transition-colors"
          />
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 text-[#A7C4BB] font-medium px-7 py-3.5 rounded-xl text-sm hover:text-white transition-colors"
          >
            View pricing
          </a>
        </div>
        <p className="text-[#6B9A8A] text-xs mt-5">No credit card required · Free plan available · Cancel anytime</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const supabase = await createServerClient();
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? '';

  const { data: wSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'waitlist_enabled')
    .single();
  const waitlistEnabled = wSetting?.value === 'true';

  return (
    <main>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <HeroSection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
        <TrustedBySection />
      </div>
      <StatsSection />
      <div className="flex flex-col h-screen">
        <HowItWorksSection />
        <BrandBrainSection />
      </div>
      <CaseStudySection />
      <TestimonialsSection />
      <PricingSection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
      <FAQSection />
      <CTASection waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
    </main>
  );
}
