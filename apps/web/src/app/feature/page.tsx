import type { Metadata } from 'next';
import Link from 'next/link';

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

export default function FeaturePage() {
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
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="px-8 lg:px-16 py-4 bg-white border-b border-[#F3F4F6]">
          <ol className="flex items-center gap-2 text-[13px]" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link
                href="/"
                itemProp="item"
                className="text-[#6B7280] hover:text-[#0D4C3C] transition-colors duration-150"
              >
                <span itemProp="name">Home</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <li aria-hidden="true">
              <svg className="w-3.5 h-3.5 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-[#111827] font-medium">Features</span>
              <meta itemProp="position" content="2" />
            </li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="bg-white px-8 lg:px-16 py-20 text-center max-w-4xl mx-auto">
          <p className="text-[11px] font-semibold text-[#0D4C3C] uppercase tracking-[0.14em] mb-4">
            · Feature
          </p>
          <h1 className="text-[2.75rem] lg:text-[3.5rem] leading-[1.1] font-bold text-[#111827] mb-6">
            Teach your AI how your<br className="hidden sm:block" /> brand communicates.
          </h1>
          <p className="text-[1.125rem] text-[#6B7280] leading-relaxed mb-10 max-w-2xl mx-auto">
            Brand Brain is the layer between raw AI and your business. Configure it once with
            your tone, rules, and preferences — and every Google review response sounds
            authentically like you.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[#0D4C3C] hover:bg-[#083F32] text-white px-7 py-3.5 rounded-lg font-semibold text-sm transition-colors duration-150"
          >
            Start Free Trial
          </Link>
        </section>

        {/* Features grid */}
        <section className="bg-[#F8FAFB] px-8 lg:px-16 py-20" aria-labelledby="features-heading">
          <div className="max-w-5xl mx-auto">
            <h2 id="features-heading" className="text-[2rem] font-bold text-[#111827] text-center mb-14">
              Everything Brand Brain can do
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(({ title, description, icon }) => (
                <div key={title} className="bg-white rounded-xl p-7 border border-[#E5E7EB]">
                  <div className="w-10 h-10 rounded-lg bg-[#E6F2EE] text-[#0D4C3C] flex items-center justify-center mb-5">
                    {icon}
                  </div>
                  <h3 className="font-bold text-[#111827] mb-2">{title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-white px-8 lg:px-16 py-20" aria-labelledby="how-heading">
          <div className="max-w-4xl mx-auto">
            <h2 id="how-heading" className="text-[2rem] font-bold text-[#111827] text-center mb-14">
              How Brand Brain works
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {HOW_IT_WORKS.map(({ step, title, body }) => (
                <div key={step} className="flex gap-5">
                  <div className="text-[2rem] font-bold text-[#E5E7EB] leading-none flex-shrink-0 w-10">
                    {step}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#111827] mb-1.5">{title}</h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-[#F8FAFB] px-8 lg:px-16 py-20" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto">
            <h2 id="faq-heading" className="text-[2rem] font-bold text-[#111827] text-center mb-12">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="bg-white rounded-xl p-7 border border-[#E5E7EB]">
                  <h3 className="font-bold text-[#111827] mb-2">{q}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0D4C3C] px-8 lg:px-16 py-20 text-center">
          <h2 className="text-[2rem] font-bold text-white mb-4">
            Ready to set up your Brand Brain?
          </h2>
          <p className="text-[#A7C4BC] mb-8 text-[1.0625rem] max-w-xl mx-auto">
            Connect your Google Business Profile and start responding to reviews
            in your brand voice — today.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white hover:bg-[#F9FAFB] text-[#0D4C3C] px-8 py-4 rounded-lg font-semibold text-sm transition-colors duration-150"
          >
            Get Started Free
          </Link>
        </section>
      </main>
    </>
  );
}
