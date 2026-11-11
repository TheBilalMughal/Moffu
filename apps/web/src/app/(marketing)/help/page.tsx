import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Everything you need to get started with Moffu: connecting Google Business Profile, configuring Brand Brain, managing reviews, and billing.',
  alternates: { canonical: 'https://www.moffu.pro/help' },
};

// ── Icons ──────────────────────────────────────────────────────────────────

function IconRocket() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  );
}
function IconBrain() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconWrench() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

// ── Section data ───────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'getting-started',
    icon: <IconRocket />,
    title: 'Getting Started',
    color: 'bg-[#EDE9FF] text-[#6C55E8]',
    articles: [
      {
        q: 'How do I connect my Google Business Profile?',
        a: `Sign in to Moffu and go to Settings > Locations. Click "Add Location" and follow the Google OAuth flow. You will be asked to grant Moffu permission to read your reviews and post replies on your behalf. Once connected, your reviews will sync automatically within a few minutes.`,
      },
      {
        q: 'What happens after I connect a location?',
        a: `Moffu pulls your existing reviews and runs an initial sync. From the Reviews page you can see all reviews in one place. The AI will generate draft replies for any unanswered reviews. You review and approve each draft before it is published to Google.`,
      },
      {
        q: 'Can I connect multiple locations?',
        a: `Yes. Each Moffu location maps to one Google Business Profile listing. Add as many locations as your plan allows. Each location can have its own Brand Brain settings, tone, and reply rules.`,
      },
      {
        q: 'Is there a free plan?',
        a: `Yes. The Free plan lets you connect one location and reply to a limited number of reviews each month. No credit card is required to start. You can upgrade to a paid plan at any time from Settings > Billing.`,
      },
    ],
  },
  {
    id: 'brand-brain',
    icon: <IconBrain />,
    title: 'Brand Brain',
    color: 'bg-[#FEF3C7] text-[#D97706]',
    articles: [
      {
        q: 'What is Brand Brain?',
        a: `Brand Brain is your AI's memory. It stores your tone of voice, language preferences, reply rules per star rating, guardrails (things you never want the AI to say), and any location-specific context. Every AI-generated draft is shaped by what you have configured in Brand Brain.`,
      },
      {
        q: 'How do I set my tone and language?',
        a: `Go to Brand Brain in the sidebar. Under "Tone and Personality" you can describe how your business communicates: formal or casual, warm or professional, brief or detailed. Under "Language" choose the reply language. Changes apply to all future drafts immediately.`,
      },
      {
        q: 'Can I set different rules for 1-star and 5-star reviews?',
        a: `Yes. Brand Brain has per-star-rating rules. For example, you can set 1-2 star reviews to always include an apology and an offer to resolve the issue offline, while 4-5 star reviews get a warm thank-you. Configure this under "Reply Rules" in Brand Brain.`,
      },
      {
        q: 'What are guardrails?',
        a: `Guardrails are instructions that tell the AI what it must never say or do. For example: "Never mention competitor names", "Never offer a refund without manager approval", or "Do not use the word 'issue'". Guardrails are applied across all star ratings.`,
      },
      {
        q: 'Can different locations have different Brand Brain settings?',
        a: `Yes. Each location has its own Brand Brain. This is useful for franchise groups or multi-brand operators where each site has a different name, manager, local offers, or neighbourhood context.`,
      },
    ],
  },
  {
    id: 'reviews',
    icon: <IconStar />,
    title: 'Managing Reviews',
    color: 'bg-[#DCFCE7] text-[#16A34A]',
    articles: [
      {
        q: 'How often do reviews sync from Google?',
        a: `Moffu checks for new reviews at the interval you choose in Settings: every 1 hour, 4 hours, 12 hours, or 24 hours. Reviews also sync automatically when you first connect a location. Manual sync is available from the Reviews page.`,
      },
      {
        q: 'How do I reply to a review?',
        a: `Open any review from the Reviews page. Moffu shows the AI-generated draft alongside the original review. Read the draft, make any edits you like, then click "Publish to Google". The reply posts directly to your Google Business Profile within seconds.`,
      },
      {
        q: 'Can I reply to multiple reviews at once?',
        a: `Yes. Use the checkboxes on the Reviews page to select multiple reviews, then choose "Bulk Approve" to publish all selected drafts to Google at once. Bulk actions are available on paid plans.`,
      },
      {
        q: 'Can I filter reviews by star rating or status?',
        a: `Yes. The Reviews page has filters for star rating (1-5), reply status (replied, not replied), date range, and location. Use the search bar to find reviews by keyword.`,
      },
      {
        q: 'What happens if the AI draft is not right?',
        a: `You are always in control. Edit the draft directly in the reply box before publishing. If you want a completely fresh draft, click "Regenerate" and the AI will produce a new response using your Brand Brain settings.`,
      },
    ],
  },
  {
    id: 'billing',
    icon: <IconCard />,
    title: 'Billing and Plans',
    color: 'bg-[#FEE2E2] text-[#DC2626]',
    articles: [
      {
        q: 'How does billing work?',
        a: `Moffu uses Paddle as its payment processor and Merchant of Record. You are charged monthly or annually depending on your plan. All prices are shown in USD. Paddle handles invoicing, VAT/GST, and payment receipts.`,
      },
      {
        q: 'How do I upgrade or change my plan?',
        a: `Go to Settings > Billing in the customer portal. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades take effect at the end of the current billing period.`,
      },
      {
        q: 'What is the annual plan discount?',
        a: `Annual plans are charged monthly in advance for 12 months. The annual price per month is lower than the monthly price. The savings percentage is shown on the pricing page.`,
      },
      {
        q: 'How do I cancel my subscription?',
        a: `Go to Settings > Billing and click "Cancel subscription". Your plan stays active until the end of the current billing period. After cancellation you are moved to the Free plan automatically.`,
      },
      {
        q: 'Do you offer refunds?',
        a: `Yes. We offer refunds within 7 days of a charge if you have not used the paid features during that period. See our Refund Policy for full details or contact support@moffu.pro.`,
      },
    ],
  },
  {
    id: 'team',
    icon: <IconUsers />,
    title: 'Account and Team',
    color: 'bg-[#E0F2FE] text-[#0284C7]',
    articles: [
      {
        q: 'How do I invite team members?',
        a: `Go to Settings > Team. Click "Invite Member" and enter their email address. Invites are only available on paid plans. Free plan accounts are single-user. Invited members can log in with their own Google account.`,
      },
      {
        q: 'What roles are available?',
        a: `Moffu has three roles: Owner (full access, billing, and settings), Manager (can configure Brand Brain and approve replies), and Member (can view and approve replies but cannot change settings). Roles are set when sending an invite.`,
      },
      {
        q: 'How do I change my account email or profile?',
        a: `Go to Settings > Profile in the customer portal to update your display name, timezone, and notification preferences. Email address changes must be done through Google since Moffu uses Google OAuth for authentication.`,
      },
      {
        q: 'Can I transfer ownership of an account?',
        a: `Yes. The current Owner can reassign ownership to any existing team member from Settings > Team. Contact support@moffu.pro if you need help with an ownership transfer.`,
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: <IconWrench />,
    title: 'Troubleshooting',
    color: 'bg-[#F3F4F6] text-[#374151]',
    articles: [
      {
        q: 'My Google connection says "disconnected". What do I do?',
        a: `Google OAuth tokens expire or are revoked if you change your Google account password or revoke app permissions. Go to Settings > Locations, click the location, and reconnect your Google account. The re-auth flow takes under a minute.`,
      },
      {
        q: 'A reply I published is not showing on Google yet.',
        a: `Google typically shows new replies within 1 to 5 minutes. Occasionally Google indexing is delayed up to 30 minutes. Check the Reviews page in Moffu: if the status shows "Published", the reply was sent successfully. If still not visible after an hour, contact support@moffu.pro.`,
      },
      {
        q: 'New reviews are not appearing in my dashboard.',
        a: `Check your sync interval in Settings > Locations. If set to 24 hours, reviews may not appear until the next sync. Click "Sync Now" on the Reviews page to force an immediate pull from Google.`,
      },
      {
        q: 'The AI draft does not sound like my brand.',
        a: `This usually means Brand Brain needs more detail. Go to Brand Brain and add more specific tone instructions, examples of how you like to reply, and any guardrails. The more context you give Brand Brain, the more accurate the drafts will be.`,
      },
      {
        q: 'I am getting an error when trying to publish a reply.',
        a: `The most common cause is a disconnected Google account. Check Settings > Locations for a "Reconnect" prompt. If the connection looks healthy, try refreshing the page and publishing again. Persistent errors should be reported to support@moffu.pro with the review ID.`,
      },
    ],
  },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <section className="bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 lg:px-16 pt-40 pb-16">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-4">Help Center</p>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-black text-[#111827] leading-[1.05] mb-4">
            How can we help?
          </h1>
          <p className="text-lg text-[#6B7280] max-w-xl leading-relaxed mb-8">
            Find answers about connecting Google Business Profile, configuring Brand Brain, managing reviews, billing, and more.
          </p>

          {/* Quick jump links */}
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] px-4 py-2 rounded-lg hover:border-[#6C55E8] hover:text-[#6C55E8] transition-colors duration-150"
              >
                <span className="w-4 h-4">{s.icon}</span>
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Sections */}
      <div className="px-6 lg:px-16 py-16">
        <div className="max-w-[1380px] mx-auto space-y-20">

          {SECTIONS.map(section => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <div className="flex items-center gap-3 mb-8">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
                  {section.icon}
                </div>
                <h2 id={`${section.id}-heading`} className="text-xl font-black text-[#111827]">
                  {section.title}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {section.articles.map((article, i) => (
                  <details
                    key={i}
                    className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between gap-4 cursor-pointer px-6 py-5 select-none list-none hover:bg-[#F9FAFB] transition-colors duration-150">
                      <span className="text-sm font-semibold text-[#111827] leading-snug">{article.q}</span>
                      <svg
                        className="w-4 h-4 flex-shrink-0 text-[#9CA3AF] transition-transform duration-200 group-open:rotate-180"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </summary>
                    <div className="px-6 pb-5 pt-1">
                      <p className="text-sm text-[#6B7280] leading-relaxed whitespace-pre-line">{article.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          {/* Still need help CTA */}
          <section className="bg-[#111827] rounded-2xl px-8 py-12 text-center">
            <h2 className="text-2xl font-black text-white mb-3">Still need help?</h2>
            <p className="text-[#9CA3AF] mb-8 max-w-md mx-auto">
              Our support team replies within one business day.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-block bg-[#6C55E8] text-white font-bold text-sm px-7 py-3.5 rounded-lg hover:bg-[#5A42D1] active:scale-95 transition-all duration-150"
              >
                Contact Support
              </Link>
              <a
                href="mailto:support@moffu.pro"
                className="inline-block text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                support@moffu.pro
              </a>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
