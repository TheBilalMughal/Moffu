import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Moffu uses cookies and similar tracking technologies.',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: October 02, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help
              websites remember your preferences and improve your experience. Moffu uses cookies and
              similar technologies to operate the platform securely and understand how it is used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Cookies We Use</h2>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Essential Cookies</h3>
            <p>
              These cookies are required for the platform to function. They manage your authentication
              session, maintain security, and remember your login state. You cannot opt out of essential
              cookies while using Moffu.
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li><strong>sb-access-token</strong>: Supabase authentication session token</li>
              <li><strong>sb-refresh-token</strong>: Used to refresh your session without re-login</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mb-2 mt-5">Analytics Cookies</h3>
            <p>
              We may use analytics cookies to understand how visitors interact with our website.
              These cookies collect anonymised data such as pages visited and time spent. You can
              opt out of analytics cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Third-Party Cookies</h2>
            <p>
              We do not allow third-party advertising cookies on Moffu. Any third-party services
              we use (such as payment processors or error tracking) may set their own cookies
              governed by their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Managing Cookies</h2>
            <p>
              You can control and delete cookies through your browser settings. Most browsers allow
              you to refuse cookies or delete existing ones. Note that disabling essential cookies
              will prevent you from logging in to Moffu.
            </p>
            <p className="mt-3">
              For more information on managing cookies, visit{' '}
              <a href="https://www.aboutcookies.org" className="text-[#6C55E8] underline" target="_blank" rel="noopener noreferrer">
                aboutcookies.org
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. Any changes will be posted on
              this page with an updated date. Continued use of Moffu after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact</h2>
            <p>
              If you have questions about our use of cookies, contact us at{' '}
              <a href="mailto:privacy@moffu.pro" className="text-[#6C55E8] underline">privacy@moffu.pro</a>.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
