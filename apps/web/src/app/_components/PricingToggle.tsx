'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface PricingPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  badge_text: string | null;
  is_featured: boolean;
  monthly_cents: number;
  annual_cents: number;
  currency: string;
}

function CheckSolid() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
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

export function PricingToggle({ plans }: { plans: PricingPlan[] }) {
  const [annual, setAnnual] = useState(false);

  const visiblePlans = plans.filter(p => p.slug !== 'free');

  return (
    <>
      {/* Toggle */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
              !annual ? 'bg-[#0D4C3C] text-white' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-colors duration-150 flex items-center gap-2 ${
              annual ? 'bg-[#0D4C3C] text-white' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Annual
            <span className="text-[11px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-semibold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {visiblePlans.map((plan) => {
          const priceCents = annual && plan.annual_cents > 0 ? plan.annual_cents : plan.monthly_cents;
          const isFree = plan.monthly_cents === 0;

          return (
            <div
              key={plan.id}
              className={`relative bg-white border rounded-xl p-7 flex flex-col ${
                plan.is_featured ? 'border-[#0D4C3C] ring-1 ring-[#0D4C3C]' : 'border-[#E5E7EB]'
              }`}
            >
              {plan.is_featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#0D4C3C] text-white text-[11px] font-semibold px-3 py-1 rounded-md whitespace-nowrap">
                    {plan.badge_text || 'Most Popular'}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-[#111827] text-[1.0625rem] mb-1">{plan.name}</h3>
                <p className="text-[13px] text-[#6B7280] mb-5">{plan.description ?? ''}</p>
                <div className="flex items-baseline gap-1">
                  {isFree ? (
                    <span className="text-[2.75rem] font-bold text-[#111827] leading-none">Free</span>
                  ) : (
                    <>
                      <span className="text-[2.75rem] font-bold text-[#111827] leading-none">
                        {formatPrice(priceCents, plan.currency)}
                      </span>
                      <span className="text-[#6B7280] text-sm">/month</span>
                    </>
                  )}
                </div>
                {annual && plan.annual_cents > 0 && !isFree && (
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    Billed annually ({formatPrice(plan.annual_cents * 12, plan.currency)}/yr)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-7 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 text-[#0D4C3C]">
                      <CheckSolid />
                    </div>
                    <span className="text-sm text-[#374151]">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="https://appmoffu.vercel.app/auth/signup"
                className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                  plan.is_featured
                    ? 'bg-[#0D4C3C] hover:bg-[#083F32] text-white'
                    : 'border border-[#D1D5DB] text-[#374151] hover:bg-[#F8FAFB]'
                }`}
              >
                Get Started
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
