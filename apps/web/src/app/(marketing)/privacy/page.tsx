import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Moffu collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: October 02, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Moffu (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Moffu platform, a SaaS service that allows
              business owners to manage and respond to Google Business Profile reviews using AI-generated
              draft replies. This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Account Information</h3>
            <p>
              When you create an account, we collect your name, email address, and business details.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">Google Business Profile Data</h3>
            <p>
              When you connect your Google account, we request access to your Google Business Profile
              using OAuth 2.0. With your explicit authorization, we access:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Your Google Business Profile locations and business information</li>
              <li>Customer reviews associated with your business locations</li>
              <li>The ability to post replies to reviews on your behalf</li>
            </ul>
            <p className="mt-3">
              We store access tokens securely on our servers to maintain the integration. You can
              revoke access at any time by disconnecting your Google account from our platform or
              through your Google Account security settings at{' '}
              <a href="https://myaccount.google.com/permissions" className="text-[#6C55E8] underline" target="_blank" rel="noopener noreferrer">
                myaccount.google.com/permissions
              </a>.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">Usage Data</h3>
            <p>
              We collect information about how you interact with our service, including pages visited,
              features used, and actions taken within the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and operate the Moffu service</li>
              <li>To fetch and display your Google Business Profile reviews</li>
              <li>To generate AI-powered draft responses to reviews using your Brand Brain settings</li>
              <li>To publish your approved replies to Google on your behalf</li>
              <li>To send transactional emails (account confirmation, billing receipts)</li>
              <li>To improve our AI models and service quality</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal data. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Google LLC</strong>: to authenticate your account and interact with the Google
                Business Profile API on your behalf
              </li>
              <li>
                <strong>Supabase</strong>: our database and authentication infrastructure provider
              </li>
              <li>
                <strong>Paddle</strong>: our payment processor and Merchant of Record for billing and subscription management
              </li>
              <li>
                <strong>AI providers</strong>: review content may be sent to AI services (such as
                Google Gemini) to generate draft replies; these providers process data under their own
                privacy policies
              </li>
              <li>
                <strong>Legal authorities</strong>: when required by law or to protect our legal rights
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your account data and review history for as long as your account is active.
              You may request deletion of your data by contacting us at{' '}
              <a href="mailto:support@moffu.pro" className="text-[#6C55E8] underline">support@moffu.pro</a>.
              Upon account deletion, we will delete or anonymize your personal data within 30 days,
              except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Security</h2>
            <p>
              We implement industry-standard security measures including encryption at rest and in
              transit, Row-Level Security (RLS) in our database, and regular security reviews.
              OAuth tokens are stored encrypted and are never exposed to client applications.
              No method of transmission over the internet is 100% secure; we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for processing (including Google account access)</li>
              <li>Data portability: receive a copy of your data in a structured format</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{' '}
              <a href="mailto:support@moffu.pro" className="text-[#6C55E8] underline">support@moffu.pro</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We may use
              analytics cookies to understand usage patterns. You can manage cookie preferences
              through your browser settings. See our{' '}
              <a href="/cookies" className="text-[#6C55E8] underline">Cookie Policy</a> for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Our service is not directed to individuals under the age of 16. We do not knowingly
              collect personal data from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by email or by displaying a notice on our platform. Continued use of the service
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              <p><strong>Moffu</strong></p>
              <p>Email: <a href="mailto:support@moffu.pro" className="text-[#6C55E8] underline">support@moffu.pro</a></p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
