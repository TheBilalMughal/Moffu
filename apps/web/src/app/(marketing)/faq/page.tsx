import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description:
    'Got questions about Moffu? Find answers about Google review replies, Brand Brain, pricing, locations, and more.',
  alternates: { canonical: 'https://www.moffu.pro/faq' },
  openGraph: {
    title: 'Moffu FAQ — Frequently Asked Questions',
    description:
      'Find answers about Google review replies, Brand Brain, pricing, and locations.',
    url: 'https://www.moffu.pro/faq',
    type: 'website',
    siteName: 'Moffu',
    locale: 'en_US',
  },
};

const FAQ_ITEMS = [
  {
    q: 'Does Moffu work with Google Business Profile?',
    a: 'Yes. Moffu connects directly to your Google Business Profile to pull in reviews and publish AI-generated replies, all without leaving the dashboard.',
  },
  {
    q: 'How does the AI generate replies?',
    a: 'You set up your Brand Brain: your business identity, tone of voice, and reply rules per star rating. The AI uses that profile to craft replies that sound exactly like you, not a generic bot.',
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
    a: 'Yes. The Free plan lets you get started at no cost with one location and limited replies per month. No credit card required.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription at any time from the billing page. Your account stays active until the end of the billing period.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.moffu.pro' },
    { '@type': 'ListItem', position: 2, name: 'FAQ',  item: 'https://www.moffu.pro/faq' },
  ],
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main>
        <section className="bg-white px-6 lg:px-16 pt-40 pb-24">
          <div className="max-w-[1380px] mx-auto">
            <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">
              FAQ
            </p>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-[#111827] mb-4 max-w-2xl">
              Frequently asked questions.
            </h1>
            <p className="text-lg text-[#6B7280] leading-relaxed mb-14 max-w-xl">
              Everything you need to know about Moffu and how it works.
            </p>

            <div className="grid gap-3 max-w-3xl">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="group border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
                  <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none select-none hover:bg-[#F3F4F6] transition-colors duration-150">
                    <h2 className="text-sm font-black text-[#111827] pr-4 leading-snug m-0">{item.q}</h2>
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

            <div className="mt-16 pt-10 border-t border-[#E5E7EB]">
              <p className="text-sm text-[#6B7280] mb-4">Still have questions?</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-[#111827] text-white text-sm font-bold px-6 py-3 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150"
              >
                Contact us →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
