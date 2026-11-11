import type { Metadata } from 'next';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Moffu team. We reply within one business day.',
  alternates: { canonical: 'https://www.moffu.pro/contact' },
};

const CONTACTS = [
  {
    label: 'General',
    email: 'hello@moffu.pro',
    desc: 'General questions and partnerships',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    label: 'Support',
    email: 'support@moffu.pro',
    desc: 'Technical issues and account help',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    label: 'Sales',
    email: 'sales@moffu.pro',
    desc: 'Enterprise plans and custom pricing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <section className="bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 lg:px-16 pt-40 pb-16">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-4">Contact</p>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-black text-[#111827] leading-[1.05] mb-4">
            Get in touch.
          </h1>
          <p className="text-lg text-[#6B7280] max-w-lg leading-relaxed">
            We reply within one business day. For faster help, check the{' '}
            <a href="/help" className="text-[#6C55E8] hover:underline font-medium">Help Center</a>{' '}
            first.
          </p>
        </div>
      </section>

      {/* Body */}
      <div className="px-6 lg:px-16 py-16">
        <div className="max-w-[1380px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">

            {/* Form — 3 cols */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

            {/* Contact info — 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-base font-black text-[#111827]">Other ways to reach us</h2>

              {CONTACTS.map(c => (
                <a
                  key={c.email}
                  href={`mailto:${c.email}`}
                  className="flex items-start gap-4 p-5 rounded-xl border border-[#E5E7EB] hover:border-[#6C55E8] hover:bg-[#F9FAFB] transition-all duration-150 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#EDE9FF] text-[#6C55E8] flex items-center justify-center flex-shrink-0 group-hover:bg-[#6C55E8] group-hover:text-white transition-colors duration-150">
                    {c.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#374151] uppercase tracking-widest mb-0.5">{c.label}</p>
                    <p className="text-sm font-semibold text-[#6C55E8]">{c.email}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{c.desc}</p>
                  </div>
                </a>
              ))}

              <div className="border-t border-[#E5E7EB] pt-6">
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-widest mb-3">Response time</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  We aim to reply to all messages within one business day. Urgent billing issues are typically handled within a few hours.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#374151] uppercase tracking-widest mb-3">Self-serve first</p>
                <p className="text-sm text-[#6B7280] leading-relaxed mb-3">
                  Many questions are answered in the Help Center. Check there first for instant answers.
                </p>
                <a href="/help" className="text-sm font-semibold text-[#6C55E8] hover:underline">
                  Browse Help Center
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
