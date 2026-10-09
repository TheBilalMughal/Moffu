import Image from 'next/image';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-[#0D4C3C] rounded-lg flex items-center justify-center flex-shrink-0">
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <path
          d="M1 13V1l8 8L17 1v12"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
// Navigation
// ---------------------------------------------------------------------------

function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
      <div className="w-full px-8 lg:px-16 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-semibold text-[#111827] text-[15px]">Moffu</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          <Link href="#product" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Product
          </Link>
          <Link href="#solutions" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Solutions
          </Link>
          <Link href="#resources" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Resources
          </Link>
          <Link href="#pricing" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-5">
          <Link href="/login" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-[#0D4C3C] hover:bg-[#083F32] text-white px-5 py-2.5 rounded-lg font-medium transition-colors duration-150"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero — full-width split screen
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative h-[calc(100vh-64px)] flex flex-col overflow-hidden">
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
        style={{ background: 'linear-gradient(to right, white 42%, rgba(255,255,255,0.85) 58%, transparent 75%)' }}
        aria-hidden="true"
      />

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex items-center px-8 lg:px-16 xl:px-24">
        <div className="max-w-[560px]">
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
            <Link
              href="/signup"
              className="bg-[#0D4C3C] hover:bg-[#083F32] text-white px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors duration-150"
            >
              Get Started
            </Link>
            <Link
              href="#how-it-works"
              className="border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#111827] px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors duration-150"
            >
              See How It Works
            </Link>
          </div>
          <div className="flex flex-wrap gap-7">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-[#6B7280]">Google Business Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-xs text-[#6B7280]">Your Brand Voice Everywhere</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6B7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-[#6B7280]">Built for Multi-Location Businesses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted by — bottom strip inside the same viewport */}
      <div className="relative z-10 bg-white/90 backdrop-blur-sm border-t border-[#E5E7EB] px-8 lg:px-16 py-5">
        <p className="text-center text-[12px] text-[#6B7280] mb-4">
          Trusted by businesses that care about their reputation
        </p>
        <div className="flex flex-wrap justify-center gap-8 lg:gap-14">
          {INDUSTRIES.map(({ label, icon }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-[#9CA3AF]">
              {icon}
              <span className="text-[11px] text-[#9CA3AF]">{label}</span>
            </div>
          ))}
        </div>
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
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h.01M7 3h.01M3 7h18M5 21V11a2 2 0 012-2h10a2 2 0 012 2v10M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4" /></svg>,
  },
  {
    label: 'Hotels',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    label: 'Healthcare',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  },
  {
    label: 'Retail',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  },
  {
    label: 'Salons & Spas',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>,
  },
  {
    label: 'Automotive',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  },
  {
    label: 'Agencies',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
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
    <section id="how-it-works" className="py-24 bg-white border-t border-[#E5E7EB]">
      <div className="px-8 lg:px-16">
        <div className="text-center mb-14">
          <h2 className="text-[2.125rem] font-bold text-[#111827] mb-3">How It Works</h2>
          <p className="text-[#6B7280] text-[1.0625rem]">
            Get from reviews to on-brand responses in four simple steps.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
    <section id="product" className="grid lg:grid-cols-2 min-h-[520px] border-t border-[#E5E7EB]">
      {/* Left — product screenshot, full bleed */}
      {/* Place file at apps/web/public/images/brand-brain.jpg */}
      <div className="relative bg-[#F8FAFB] min-h-[320px] lg:min-h-[480px] overflow-hidden">
        <Image
          src="/images/brand-brain.jpg"
          alt="Moffu Brand Brain dashboard — AI review management interface"
          fill
          className="object-cover object-center"
        />
        {/* Placeholder shown until real screenshot is added */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#F8FAFB] -z-10">
          <div className="text-center text-[#9CA3AF] p-10">
            <svg className="w-16 h-16 mx-auto mb-4 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">[Product screenshot — asset TBD]</p>
          </div>
        </div>
      </div>

      {/* Right — text */}
      <div className="flex flex-col justify-center px-8 lg:px-16 xl:px-20 py-20 bg-white">
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
            href="#"
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
// Pricing
// NOTE: Prices match the design reference. BILLING-001/002 in checklist are TBD —
// require business sign-off before go-live.
// ---------------------------------------------------------------------------

const PRICING_PLANS = [
  {
    name: 'Starter',
    description: 'Great for single location businesses.',
    price: 29,
    features: ['1 location included', 'AI review responses', 'Brand Brain', 'Basic analytics'],
    popular: false,
  },
  {
    name: 'Growth',
    description: 'For growing businesses with multiple locations.',
    price: 79,
    features: ['5 locations included', 'Everything in Starter', 'Advanced analytics', 'Team members'],
    popular: true,
  },
  {
    name: 'Scale',
    description: 'For larger organizations and agencies.',
    price: 199,
    features: ['10 locations included', 'Everything in Growth', 'Priority support', 'Advanced permissions'],
    popular: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-[#F8FAFB] border-t border-[#E5E7EB]">
      <div className="px-8 lg:px-16">
        <div className="text-center mb-12">
          <h2 className="text-[2.125rem] font-bold text-[#111827] mb-3">
            Plans for every stage of growth
          </h2>
          <p className="text-[#6B7280] text-[1.0625rem]">
            Start with one location or manage hundreds — with flexible add-ons.
          </p>
        </div>

        {/* Toggle — static display, Monthly selected */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1">
            <span className="px-5 py-2 text-sm font-medium rounded-md bg-[#0D4C3C] text-white">
              Monthly
            </span>
            <span className="px-5 py-2 text-sm text-[#6B7280] flex items-center gap-2 cursor-default select-none">
              Annual
              <span className="text-[11px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-semibold">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING_PLANS.map(({ name, description, price, features, popular }) => (
            <div
              key={name}
              className={`relative bg-white border rounded-xl p-7 flex flex-col ${
                popular ? 'border-[#0D4C3C] ring-1 ring-[#0D4C3C]' : 'border-[#E5E7EB]'
              }`}
            >
              {popular && (
                // NOTE: reference shows pill badge; using rounded-md per no-pill design rule (CLAUDE.md)
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#0D4C3C] text-white text-[11px] font-semibold px-3 py-1 rounded-md whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-[#111827] text-[1.0625rem] mb-1">{name}</h3>
                <p className="text-[13px] text-[#6B7280] mb-5">{description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[2.75rem] font-bold text-[#111827] leading-none">${price}</span>
                  <span className="text-[#6B7280] text-sm">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-7 flex-1">
                {features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 text-[#0D4C3C]">
                      <CheckSolid />
                    </div>
                    <span className="text-sm text-[#374151]">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                  popular
                    ? 'bg-[#0D4C3C] hover:bg-[#083F32] text-white'
                    : 'border border-[#D1D5DB] text-[#374151] hover:bg-[#F8FAFB]'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer — minimal; not in reference
// ---------------------------------------------------------------------------

function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white py-8">
      <div className="px-8 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-sm font-semibold text-[#111827]">Moffu</span>
        </div>
        <p className="text-xs text-[#9CA3AF]">
          {/* [DEVELOPMENT BUILD] Legal copy TBD */}© {new Date().getFullYear()} Moffu. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <BrandBrainSection />
        <PricingSection />
      </main>
      <SiteFooter />
    </>
  );
}
