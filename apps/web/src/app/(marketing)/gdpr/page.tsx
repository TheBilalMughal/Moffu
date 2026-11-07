import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GDPR — Moffu',
  description: 'Moffu\'s compliance with the General Data Protection Regulation.',
};

export default function GdprPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Compliance</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: October 25, 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Our Commitment</h2>
            <p>
              Moffu is committed to complying with the General Data Protection Regulation (GDPR)
              for users in the European Economic Area (EEA) and the United Kingdom. This page
              explains your rights and how we handle your personal data under GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data Controller</h2>
            <p>
              Moffu acts as the data controller for personal data you provide when creating an
              account and using the platform. For data processed on behalf of your customers
              (such as Google review content), Moffu acts as a data processor under your
              instructions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Legal Basis for Processing</h2>
            <p>We process your personal data on the following legal bases:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Contract performance</strong> — to provide the Moffu service you have subscribed to</li>
              <li><strong>Legitimate interests</strong> — to improve the platform, prevent fraud, and ensure security</li>
              <li><strong>Legal obligation</strong> — to comply with applicable laws and regulations</li>
              <li><strong>Consent</strong> — for optional communications such as marketing emails (you may withdraw at any time)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Your Rights Under GDPR</h2>
            <p>If you are located in the EEA or UK, you have the following rights:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Right of access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Right to rectification</strong> — request correction of inaccurate or incomplete data</li>
              <li><strong>Right to erasure</strong> — request deletion of your personal data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Right to restriction</strong> — request that we limit how we use your data</li>
              <li><strong>Right to data portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong>Right to object</strong> — object to processing based on legitimate interests</li>
              <li><strong>Rights related to automated decision-making</strong> — not to be subject to solely automated decisions that significantly affect you</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@moffu.com" className="text-[#6C55E8] underline">privacy@moffu.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Transfers</h2>
            <p>
              Moffu uses infrastructure providers (including Supabase and Vercel) that may process
              data in countries outside the EEA. Where data is transferred outside the EEA, we
              ensure appropriate safeguards are in place, such as Standard Contractual Clauses
              approved by the European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide the service. Upon account deletion, we will delete or anonymise your personal
              data within 90 days, unless we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Supervisory Authority</h2>
            <p>
              You have the right to lodge a complaint with your local data protection supervisory
              authority if you believe we have not complied with GDPR. In the UK, this is the{' '}
              <a href="https://ico.org.uk" className="text-[#6C55E8] underline" target="_blank" rel="noopener noreferrer">
                Information Commissioner&apos;s Office (ICO)
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact</h2>
            <p>
              For GDPR-related enquiries, contact our data protection team at{' '}
              <a href="mailto:privacy@moffu.com" className="text-[#6C55E8] underline">privacy@moffu.com</a>.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
