import type { Metadata } from 'next';
import Link from 'next/link';
import { WaitlistButton } from '../../_components/WaitlistButton';
import { createServerClient } from '../../../lib/supabase/server';

export const metadata: Metadata = {
  title: 'Features — Brand Brain AI Review Responses | Moffu',
  description:
    'Brand Brain is your AI\'s memory. Set your tone, response rules, and personality once — and every Google review reply sounds exactly like you, every time.',
  keywords: [
    'Brand Brain',
    'AI brand voice',
    'Google review responses',
    'AI review management',
    'brand voice AI',
    'automated review replies',
    'review response software',
  ],
  openGraph: {
    title: 'Features — Brand Brain AI Review Responses',
    description:
      'Set your tone, rules, and personality once. Moffu\'s Brand Brain ensures every review response sounds like you — not a generic bot.',
    url: 'https://moffu.com/feature',
    siteName: 'Moffu',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moffu Features — Brand Brain',
    description: 'Teach your AI your brand voice. Every review reply, on-brand.',
  },
  alternates: {
    canonical: 'https://moffu.com/feature',
  },
};

const FEATURES = [
  {
    title: 'Tone & Personality',
    description:
      'Define how your brand speaks — formal, friendly, warm, or professional. Brand Brain applies it consistently across every response.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    title: 'Negative Review Handling',
    description:
      'Set rules for how to respond to 1-star and 2-star reviews. Empathetic, solution-focused replies — without you writing each one.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Response Rules',
    description:
      'Tell your AI what to always say, never say, and how to handle common topics like wait times, staff, or pricing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Location-Specific Settings',
    description:
      'Running multiple locations? Customise Brand Brain per location — different staff names, local offers, and neighbourhood context.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Language Support',
    description:
      'Serve customers in their language. Brand Brain keeps your tone consistent whether responding in English, Spanish, or beyond.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    title: 'Always Your Approval',
    description:
      'Brand Brain drafts — you approve. Every AI response is a suggestion until you publish it. You stay in control at all times.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect your Google Business Profile',
    body: 'Securely link one or more locations in under two minutes.',
  },
  {
    step: '02',
    title: 'Configure Brand Brain',
    body: 'Answer a few questions about your tone, rules, and what makes your brand unique.',
  },
  {
    step: '03',
    title: 'AI drafts your responses',
    body: 'When a new review arrives, Brand Brain generates a personalised, on-brand draft.',
  },
  {
    step: '04',
    title: 'Edit, approve & publish',
    body: 'Review the draft, make any tweaks, and publish directly to Google — in one click.',
  },
];

const FAQ = [
  {
    q: 'Can I change my Brand Brain settings after setup?',
    a: 'Yes — you can update your tone, rules, and location settings at any time. Changes apply to all future drafts immediately.',
  },
  {
    q: 'Does Brand Brain respond automatically without me reviewing?',
    a: 'No. Brand Brain always generates a draft for your approval. Responses are only published to Google when you confirm them.',
  },
  {
    q: 'Can I have different Brand Brain settings per location?',
    a: 'Yes. Each location can have its own tone, rules, and context — useful for franchise groups or multi-brand operators.',
  },
  {
    q: 'What types of reviews does Brand Brain handle?',
    a: 'All star ratings — from 5-star praise to 1-star complaints. You can set specific rules for how each rating range is handled.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://moffu.com' },
    { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://moffu.com/feature' },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default async function FeaturePage() {
  const supabase = await createServerClient();
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro';
  const { data: wSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'waitlist_enabled')
    .single();
  const waitlistEnabled = wSetting?.value === 'true';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main>

        {/* ── Hero + Features grid (combined) ── */}
        <section className="bg-white px-6 lg:px-16 pt-40 pb-24" aria-labelledby="features-heading">
          <div className="max-w-[1380px] mx-auto">
            <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-6">
              Features
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.05] tracking-tight text-[#111827] mb-8 max-w-3xl">
              Teach your AI how your brand communicates.
            </h1>
            <p className="text-lg text-[#6B7280] leading-relaxed mb-10 max-w-2xl">
              Brand Brain is the layer between raw AI and your business. Configure it once with
              your tone, rules, and preferences — and every Google review response sounds
              authentically like you.
            </p>
            <WaitlistButton
              enabled={waitlistEnabled}
              label={waitlistEnabled ? 'Join Waitlist' : 'Start Free →'}
              source="feature_hero"
              portalUrl={portalUrl}
              className="inline-block bg-[#111827] text-white px-7 py-3.5 rounded-lg font-black text-sm hover:scale-105 active:scale-95 transition-transform duration-150"
            />

            <div className="mt-20 border-t border-[#E5E7EB] pt-16">
            <h2 id="features-heading" className="text-[clamp(1.75rem,3vw,2.5rem)] font-black text-[#111827] leading-tight mb-12 max-w-xl">
              What's included
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(({ title, description, icon }) => (
                <div key={title} className="bg-white rounded-xl p-7 border border-[#E5E7EB]">
                  <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] text-[#111827] flex items-center justify-center mb-5">
                    {icon}
                  </div>
                  <h3 className="font-black text-[#111827] mb-2">{title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="bg-white px-6 lg:px-16 py-24" aria-labelledby="how-heading">
          <div className="max-w-[1380px] mx-auto">
            <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">
              How it works
            </p>
            <h2 id="how-heading" className="text-[clamp(2rem,4vw,3rem)] font-black text-[#111827] leading-tight mb-14 max-w-xl">
              Up and running in four steps.
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {HOW_IT_WORKS.map(({ step, title, body }) => (
                <div key={step}>
                  <p className="text-[3rem] font-black text-[#E5E7EB] leading-none mb-4">{step}</p>
                  <h3 className="font-black text-[#111827] mb-2 text-[0.9375rem]">{title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-[#F3F4F6] px-6 lg:px-16 py-24" aria-labelledby="faq-heading">
          <div className="max-w-[1380px] mx-auto">
            <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">
              FAQ
            </p>
            <h2 id="faq-heading" className="text-[clamp(2rem,4vw,3rem)] font-black text-[#111827] leading-tight mb-14 max-w-xl">
              Frequently asked questions
            </h2>
            <div className="grid lg:grid-cols-2 gap-4">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none select-none hover:bg-[#F3F4F6] transition-colors bg-white">
                    <span className="text-sm font-black text-[#111827] pr-4">{q}</span>
                    <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5 pt-1 bg-white text-sm text-[#6B7280] leading-relaxed">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-white px-6 lg:px-16 py-24">
          <div className="max-w-[1380px] mx-auto">
            <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.05] text-[#111827] mb-8">
              Ready to set up<br />your Brand Brain?
            </h2>
            <p className="text-[#6B7280] mb-10 text-lg max-w-xl leading-relaxed">
              Connect your Google Business Profile and start responding to reviews
              in your brand voice — today.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <WaitlistButton
                enabled={waitlistEnabled}
                label={waitlistEnabled ? 'Join Waitlist' : 'Get Started Free →'}
                source="feature_cta"
                portalUrl={portalUrl}
                className="inline-block bg-[#111827] text-white px-7 py-3.5 rounded-lg font-black text-sm hover:scale-105 active:scale-95 transition-transform duration-150"
              />
              <Link href="/#pricing" className="text-sm font-medium text-[#111827]/40 hover:text-[#111827] transition-colors">
                View pricing →
              </Link>
            </div>
            <p className="text-xs text-[#111827]/25 mt-5">No credit card required · Free plan available · Cancel anytime</p>
          </div>
        </section>

      </main>
    </>
  );
}
