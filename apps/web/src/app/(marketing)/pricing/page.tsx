import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Pricing — Moffu',
  description: 'Simple, transparent pricing. Start free and scale as you grow.',
};

export const revalidate = 60; // revalidate every 60s

interface PlanPrice {
  interval: string;
  amount_cents: number;
  currency: string;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  badge_text: string | null;
  is_featured: boolean;
  sort_order: number;
  plan_prices: PlanPrice[];
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function getPlans(): Promise<Plan[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('plans')
    .select('id, slug, name, description, features, badge_text, is_featured, sort_order, plan_prices(interval, amount_cents, currency)')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as Plan[];
}

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="pt-24 pb-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-[#0D4C3C] uppercase tracking-widest mb-4">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#111827] leading-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[#6B7280]">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>
        </div>
      </section>

      {/* Plans grid */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {plans.length === 0 ? (
            <p className="text-center text-[#9CA3AF] py-20">Pricing plans coming soon.</p>
          ) : (
            <div className={`grid gap-6 ${plans.length <= 2 ? 'max-w-2xl mx-auto grid-cols-1 sm:grid-cols-2' : plans.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
              {plans.map((plan) => {
                const monthly = plan.plan_prices?.find(p => p.interval === 'monthly');
                const annual = plan.plan_prices?.find(p => p.interval === 'annual');
                const isFree = monthly?.amount_cents === 0;

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl p-8 border transition-shadow ${
                      plan.is_featured
                        ? 'border-[#0D4C3C] bg-[#0D4C3C] text-white shadow-2xl shadow-[#0D4C3C]/20 scale-[1.02]'
                        : 'border-[#E5EAE8] bg-white hover:shadow-lg'
                    }`}
                  >
                    {/* Badge */}
                    {plan.badge_text && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] whitespace-nowrap">
                          {plan.badge_text}
                        </span>
                      </div>
                    )}

                    {/* Plan name */}
                    <div className="mb-6">
                      <h3 className={`text-lg font-bold mb-1 ${plan.is_featured ? 'text-white' : 'text-[#111827]'}`}>
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className={`text-sm ${plan.is_featured ? 'text-[#A7D4C5]' : 'text-[#6B7280]'}`}>
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mb-8">
                      <div className="flex items-end gap-1">
                        <span className={`text-4xl font-bold ${plan.is_featured ? 'text-white' : 'text-[#111827]'}`}>
                          {isFree ? 'Free' : monthly ? formatPrice(monthly.amount_cents, monthly.currency) : '—'}
                        </span>
                        {!isFree && monthly && (
                          <span className={`text-sm mb-1 ${plan.is_featured ? 'text-[#A7D4C5]' : 'text-[#9CA3AF]'}`}>
                            /month
                          </span>
                        )}
                      </div>
                      {!isFree && annual && annual.amount_cents > 0 && monthly && annual.amount_cents < monthly.amount_cents && (
                        <p className={`text-xs mt-1 ${plan.is_featured ? 'text-[#A7D4C5]' : 'text-[#6B7280]'}`}>
                          {formatPrice(annual.amount_cents, annual.currency)}/mo billed annually
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={isFree ? 'https://appmoffu.vercel.app/auth/signup' : 'https://appmoffu.vercel.app/auth/signup'}
                      className={`block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors mb-8 ${
                        plan.is_featured
                          ? 'bg-white text-[#0D4C3C] hover:bg-[#F0FDF4]'
                          : 'bg-[#0D4C3C] text-white hover:bg-[#0a3d30]'
                      }`}
                    >
                      {isFree ? 'Get started free' : 'Get started'}
                    </Link>

                    {/* Features */}
                    {plan.features.length > 0 && (
                      <ul className="space-y-3 flex-1">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <svg
                              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.is_featured ? 'text-[#7FCAB7]' : 'text-[#0D4C3C]'}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className={`text-sm ${plan.is_featured ? 'text-[#D1EDE6]' : 'text-[#374151]'}`}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ / CTA */}
      <section className="border-t border-[#E5EAE8] py-16 px-6 text-center bg-[#F8FAF9]">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-[#111827] mb-3">Still have questions?</h2>
          <p className="text-[#6B7280] mb-6">
            Reach out to us and we'll help you pick the right plan for your business.
          </p>
          <a
            href="mailto:support@moffu.io"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D4C3C] text-white rounded-lg text-sm font-semibold hover:bg-[#0a3d30] transition-colors"
          >
            Contact us
          </a>
        </div>
      </section>
    </main>
  );
}
