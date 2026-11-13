import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy — Moffu',
  description: 'How Moffu uses cookies and similar tracking technologies on its platform.',
};

const LAST_UPDATED = 'November 13, 2026';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">{title}</h2>
      <div className="space-y-3 text-[15px] text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

const TOC = [
  { href: '#what-are-cookies',    label: 'What Are Cookies' },
  { href: '#cookies-we-use',      label: 'Cookies We Use' },
  { href: '#third-party',         label: 'Third-Party Services' },
  { href: '#managing',            label: 'Managing Cookies' },
  { href: '#do-not-track',        label: 'Do Not Track' },
  { href: '#changes',             label: 'Changes to This Policy' },
  { href: '#contact',             label: 'Contact' },
];

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <div className="bg-[#111827] text-white px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-[#A78BFA] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black mb-3">Cookie Policy</h1>
          <p className="text-[#9CA3AF] text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* Intro callout */}
        <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl px-5 py-4 mb-10">
          <p className="text-[14px] text-[#4C1D95] leading-relaxed">
            This Cookie Policy explains how <strong>Creative Nodes LLC</strong> (&quot;Moffu&quot;, &quot;we&quot;, &quot;our&quot;)
            uses cookies and similar technologies on <strong>moffu.pro</strong> and the Moffu customer portal.
            By using our services, you agree to the use of essential cookies described below.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="bg-gray-50 rounded-xl px-5 py-4 mb-12">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Contents</p>
          <ol className="space-y-1.5">
            {TOC.map(({ href, label }, i) => (
              <li key={href}>
                <a href={href} className="text-[14px] text-[#6C55E8] hover:underline">
                  {i + 1}. {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">

          <Section id="what-are-cookies" title="1. What Are Cookies">
            <p>
              Cookies are small text files placed on your device (computer, phone, or tablet) when you
              visit a website. They allow the site to remember information about your visit — such as
              your login session or preferences — to make your next visit easier and the site more useful.
            </p>
            <p>
              Similar technologies include <strong>local storage</strong> and <strong>session storage</strong>,
              which store data in your browser rather than as a file. Moffu uses these for session
              management within the customer portal.
            </p>
          </Section>

          <Section id="cookies-we-use" title="2. Cookies We Use">
            <p>
              We only use cookies that are necessary to operate the platform. We do <strong>not</strong> use
              advertising cookies, social media pixels, or any form of cross-site tracking.
            </p>

            {/* Essential cookies table */}
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-gray-800 mb-3 uppercase tracking-wide">Essential Cookies (Always Active)</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Cookie Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Provider</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Purpose</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { name: 'sb-access-token',  provider: 'Supabase',  purpose: 'Authenticates your login session in the portal',      expiry: 'Session' },
                      { name: 'sb-refresh-token', provider: 'Supabase',  purpose: 'Silently refreshes your session without re-login',     expiry: '7 days' },
                      { name: 'sb-auth-token',    provider: 'Supabase',  purpose: 'OAuth state token used during Google sign-in flow',    expiry: 'Session' },
                    ].map(row => (
                      <tr key={row.name} className="bg-white hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-[12px] text-gray-800">{row.name}</td>
                        <td className="px-4 py-3 text-gray-600">{row.provider}</td>
                        <td className="px-4 py-3 text-gray-600">{row.purpose}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.expiry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-gray-400 mt-2">
                You cannot disable essential cookies while using the Moffu portal — they are required for authentication to work.
              </p>
            </div>

            {/* Analytics */}
            <div className="mt-6">
              <p className="text-[13px] font-semibold text-gray-800 mb-2 uppercase tracking-wide">Analytics Cookies (Optional)</p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-500">
                We do not currently run analytics cookies. If we add analytics in the future (for example,
                to understand which features are most used), this table will be updated and a cookie consent
                banner will be shown before any optional cookie is set.
              </div>
            </div>
          </Section>

          <Section id="third-party" title="3. Third-Party Services">
            <p>
              Moffu integrates with a small number of third-party services. Each may set their own cookies
              governed by their own privacy policies:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Supabase</strong> — our database and authentication provider. Their cookies are
                essential for login. See{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] underline">
                  Supabase Privacy Policy
                </a>.
              </li>
              <li>
                <strong>Stripe</strong> — our payment processor. Stripe may set cookies during checkout for
                fraud prevention. See{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] underline">
                  Stripe Privacy Policy
                </a>.
              </li>
              <li>
                <strong>Google OAuth</strong> — used when you connect your Google Business Profile. Google
                manages its own cookies during the OAuth consent flow. See{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#6C55E8] underline">
                  Google Privacy Policy
                </a>.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> allow any third-party advertising networks to place cookies on
              Moffu pages.
            </p>
          </Section>

          <Section id="managing" title="4. Managing Cookies">
            <p>
              You can control cookies through your browser settings. Most modern browsers let you:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>See which cookies are set and delete them individually</li>
              <li>Block all cookies from a specific site</li>
              <li>Be notified before a cookie is placed</li>
              <li>Block all third-party cookies</li>
            </ul>
            <p className="mt-3">
              Browser-specific instructions:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {[
                { browser: 'Chrome',  href: 'https://support.google.com/chrome/answer/95647' },
                { browser: 'Firefox', href: 'https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer' },
                { browser: 'Safari',  href: 'https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac' },
                { browser: 'Edge',    href: 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406' },
              ].map(({ browser, href }) => (
                <a
                  key={browser}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-[13px] font-medium text-[#6C55E8] bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg px-3 py-2 transition-colors"
                >
                  {browser}
                </a>
              ))}
            </div>
            <p className="text-[13px] text-gray-500 mt-3">
              Note: disabling essential cookies will prevent you from logging in to the Moffu portal.
            </p>
          </Section>

          <Section id="do-not-track" title="5. Do Not Track">
            <p>
              Some browsers have a &quot;Do Not Track&quot; (DNT) feature that signals to websites that you do not
              want to be tracked. Because we do not engage in cross-site tracking or behavioral advertising,
              a DNT signal does not change how Moffu operates — we only set essential cookies regardless
              of your DNT setting.
            </p>
          </Section>

          <Section id="changes" title="6. Changes to This Policy">
            <p>
              We may update this Cookie Policy when we add new features or integrations. Any material
              changes will be reflected in the &quot;Last updated&quot; date at the top of this page. If we start
              using optional cookies in the future, we will display a consent banner before setting them.
            </p>
          </Section>

          <Section id="contact" title="7. Contact">
            <p>
              Questions about our use of cookies? Contact us:
            </p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-[14px] space-y-1">
              <p><strong>Creative Nodes LLC</strong></p>
              <p className="text-gray-500">Operating as: Moffu</p>
              <p>
                Email:{' '}
                <a href="mailto:privacy@moffu.pro" className="text-[#6C55E8] underline">
                  privacy@moffu.pro
                </a>
              </p>
            </div>
          </Section>

        </div>

        {/* Related links */}
        <div className="mt-14 pt-8 border-t border-gray-100 flex flex-wrap gap-4">
          <Link href="/privacy" className="text-[13px] text-[#6C55E8] hover:underline">Privacy Policy →</Link>
          <Link href="/terms" className="text-[13px] text-[#6C55E8] hover:underline">Terms of Service →</Link>
          <Link href="/gdpr" className="text-[13px] text-[#6C55E8] hover:underline">GDPR →</Link>
        </div>

      </div>
    </main>
  );
}
