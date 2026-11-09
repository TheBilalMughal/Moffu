import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy — Moffu',
  description: 'Moffu refund and cancellation policy.',
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: November 9, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p>
              Moffu (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) offers subscription-based access to the Moffu platform.
              This Refund Policy explains when and how refunds are issued. By subscribing to Moffu,
              you agree to this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Subscription Cancellation</h2>
            <p>
              You may cancel your subscription at any time from your account settings. Upon cancellation:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your subscription remains active until the end of the current billing period</li>
              <li>You will not be charged for subsequent billing periods</li>
              <li>Access to paid features continues until the period ends</li>
              <li>No partial refunds are issued for unused days in the current period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Refund Eligibility</h2>
            <p>Refunds may be considered in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Duplicate charges:</strong> If you were charged more than once for the same
                subscription period due to a technical error, we will refund the duplicate charge.
              </li>
              <li>
                <strong>Service unavailability:</strong> If Moffu experienced a significant outage
                (exceeding 72 consecutive hours) during your paid period, you may request a pro-rated
                credit or refund for the affected time.
              </li>
              <li>
                <strong>Accidental annual subscription:</strong> If you accidentally subscribed to
                an annual plan and contact us within 48 hours of the charge without having used the
                service, we will issue a full refund.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Non-Refundable Circumstances</h2>
            <p>Refunds will not be issued in the following cases:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Change of mind after using the service</li>
              <li>Failure to cancel before automatic renewal</li>
              <li>Partial use of a subscription period</li>
              <li>Accounts suspended or terminated due to violation of our Terms of Service</li>
              <li>Dissatisfaction with AI-generated content quality (we recommend using the free plan to evaluate before upgrading)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How to Request a Refund</h2>
            <p>
              To request a refund, contact us at{' '}
              <a href="mailto:support@moffu.pro" className="text-[#6C55E8] underline">support@moffu.pro</a>{' '}
              within 14 days of the charge. Please include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your account email address</li>
              <li>The date and amount of the charge</li>
              <li>The reason for your refund request</li>
            </ul>
            <p className="mt-3">
              We aim to respond to all refund requests within 3 business days. Approved refunds are
              processed through our payment provider (Paddle) and typically appear on your statement
              within 5–10 business days, depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Free Plan</h2>
            <p>
              Moffu offers a free plan that allows you to evaluate the service before committing to
              a paid subscription. We encourage all new users to use the free plan first.
              No payment information is required to use the free plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Payment Processing</h2>
            <p>
              All payments are processed securely by{' '}
              <a href="https://www.paddle.com" className="text-[#6C55E8] underline" target="_blank" rel="noopener noreferrer">
                Paddle
              </a>
              , our payment provider. Paddle acts as the Merchant of Record for all Moffu transactions,
              meaning Paddle handles billing, tax compliance, and payment disputes on our behalf.
              For billing-related disputes, you may also contact Paddle directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Refund Policy from time to time. Changes will be posted on this page
              with an updated date. Continued use of the service after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Us</h2>
            <p>Questions about refunds? Contact us:</p>
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
