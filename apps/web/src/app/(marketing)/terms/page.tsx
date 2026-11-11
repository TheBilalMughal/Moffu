import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using the Moffu platform.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: October 20, 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Moffu platform (&quot;Service&quot;), you agree to be bound by these
              Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
              These Terms apply to all users, including business owners and their team members.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              Moffu is a SaaS platform that enables business owners to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Connect their Google Business Profile via Google OAuth</li>
              <li>View and manage customer reviews from their Google Business Profile locations</li>
              <li>Generate AI-powered draft responses to reviews</li>
              <li>Publish approved responses to Google on their behalf</li>
              <li>Configure brand tone and voice settings for AI-generated content</li>
              <li>Invite team members to collaborate on review management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
            <p>
              You must create an account to use the Service. You agree to provide accurate and
              complete information and to keep your account credentials secure. You are responsible
              for all activity that occurs under your account. Notify us immediately at{' '}
              <a href="mailto:support@moffu.pro" className="text-[#6C55E8] underline">support@moffu.pro</a>{' '}
              if you suspect unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google Business Profile Integration</h2>
            <p>
              When you connect your Google account, you authorize Moffu to access your Google Business
              Profile data on your behalf. You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You have the authority to manage the Google Business Profile(s) you connect to Moffu
              </li>
              <li>
                Review replies published through Moffu will appear as responses from your business
                on Google
              </li>
              <li>
                You are solely responsible for the content of all replies published through the Service
              </li>
              <li>
                AI-generated drafts are suggestions only — you must review and approve before publishing
              </li>
              <li>
                Your use of Google data through Moffu is subject to{' '}
                <a href="https://policies.google.com/terms" className="text-[#6C55E8] underline" target="_blank" rel="noopener noreferrer">
                  Google&apos;s Terms of Service
                </a>
              </li>
            </ul>
            <p className="mt-3">
              You can revoke Moffu&apos;s access to your Google account at any time through your Google
              Account security settings or through the Moffu platform settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Publish false, misleading, or deceptive review responses</li>
              <li>Violate Google&apos;s policies for Business Profile responses</li>
              <li>Harass, threaten, or defame reviewers</li>
              <li>Circumvent or attempt to circumvent any security measures</li>
              <li>Use the Service for any unlawful purpose</li>
              <li>Resell or sublicense access to the Service without authorization</li>
              <li>Reverse engineer or attempt to extract source code from the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Subscription and Billing</h2>
            <p>
              Moffu is offered on a subscription basis. By subscribing, you agree to pay the fees
              associated with your chosen plan. Subscriptions renew automatically unless cancelled.
              You may cancel at any time through your account settings; cancellation takes effect at
              the end of the current billing period. We reserve the right to change pricing with
              30 days&apos; notice. Refunds are issued at our discretion except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. AI-Generated Content</h2>
            <p>
              Our Service uses artificial intelligence to generate draft review responses. You
              acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>AI-generated drafts may not always be accurate or appropriate</li>
              <li>You are responsible for reviewing and editing all drafts before publishing</li>
              <li>Moffu does not guarantee the quality, accuracy, or suitability of AI outputs</li>
              <li>We are not liable for any consequences arising from published AI-generated content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              The Moffu platform, including its design, code, and branding, is owned by Moffu and
              protected by applicable intellectual property laws. You retain ownership of your
              business data, review content, and brand information you input into the Service.
              You grant Moffu a limited license to use your data solely to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Moffu shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the
              Service. Our total liability for any claim arising from these Terms shall not exceed
              the amount you paid to Moffu in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind, express or implied.
              We do not warrant that the Service will be uninterrupted, error-free, or that defects
              will be corrected. We are not responsible for the availability or content of third-party
              services, including Google Business Profile.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms or engage in
              conduct harmful to the Service or other users. You may terminate your account at any
              time by contacting us. Upon termination, your right to use the Service ceases and we
              will handle your data per our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              via email or platform notice. Continued use of the Service after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact</h2>
            <p>
              Questions about these Terms? Contact us:
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
