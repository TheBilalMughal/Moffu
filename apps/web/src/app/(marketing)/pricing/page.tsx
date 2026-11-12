export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '../../../lib/supabase/server';
import { PricingToggle, type PricingPlan } from '../../_components/PricingToggle';

export const metadata: Metadata = {
  title: 'Pricing — Plans for Every Business',
  description:
    'Start free, no credit card required. Upgrade when you need more locations or AI replies. Simple, transparent pricing for Google review management.',
  alternates: { canonical: 'https://www.moffu.pro/pricing' },
  openGraph: {
    title: 'Moffu Pricing — Plans for Every Business',
    description:
      'Start free, no credit card required. Upgrade when you need more locations or AI replies.',
    url: 'https://www.moffu.pro/pricing',
    type: 'website',
    siteName: 'Moffu',
    locale: 'en_US',
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',    item: 'https://www.moffu.pro' },
    { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://www.moffu.pro/pricing' },
  ],
};

async function fetchPricingPlans(): Promise<PricingPlan[]> {
  noStore();
  try {
    const supabase = createServerClient();
    const [plansRes, pricesRes] = await Promise.all([
      supabase
        .from('plans')
        .select('id, slug, name, description, features, badge_text, is_featured, contact_sales, discount_type, discount_value')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('plan_prices')
        .select('plan_id, billing_interval, amount_cents, currency')
        .eq('is_active', true),
    ]);
    const plans = plansRes.data ?? [];
    const prices = pricesRes.data ?? [];
    return plans.map((p) => {
      const planPrices = prices.filter((pr) => pr.plan_id === p.id);
      const monthly = planPrices.find((pr) => pr.billing_interval === 'monthly');
      const annual  = planPrices.find((pr) => pr.billing_interval === 'annual');
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
        badge_text: p.badge_text ?? null,
        is_featured: p.is_featured ?? false,
        contact_sales: p.contact_sales ?? false,
        monthly_cents: monthly?.amount_cents ?? 0,
        annual_cents:  annual?.amount_cents ?? 0,
        currency: monthly?.currency ?? annual?.currency ?? 'USD',
        discount_type:  (p.discount_type as 'fixed' | 'percent' | null) ?? null,
        discount_value: p.discount_value != null ? Number(p.discount_value) : null,
      };
    });
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const supabase = await createServerClient();
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.moffu.pro';

  const [wSettingRes, plans] = await Promise.all([
    supabase.from('platform_settings').select('value').eq('key', 'waitlist_enabled').single(),
    fetchPricingPlans(),
  ]);
  const waitlistEnabled = wSettingRes.data?.value === 'true';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main>
        <section className="bg-[#F3F4F6] px-6 lg:px-16 pt-40 pb-24 min-h-screen flex items-start">
          <div className="max-w-[1380px] mx-auto w-full">
            <p className="text-sm font-semibold text-[#111827]/50 uppercase tracking-widest mb-4">
              Pricing
            </p>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-[#111827] mb-4 max-w-2xl">
              Simple pricing. No surprises.
            </h1>
            <p className="text-lg text-[#6B7280] leading-relaxed mb-14 max-w-xl">
              Start free, no credit card required. Upgrade when you need more locations or unlimited AI replies.
            </p>
            <PricingToggle plans={plans} waitlistEnabled={waitlistEnabled} portalUrl={portalUrl} />
          </div>
        </section>
      </main>
    </>
  );
}
