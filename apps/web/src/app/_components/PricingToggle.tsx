'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WaitlistButton } from './WaitlistButton';

export interface PricingPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  badge_text: string | null;
  is_featured: boolean;
  contact_sales: boolean;
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

function calcDiscount(monthly_cents: number, annual_cents: number): number {
  if (monthly_cents <= 0 || annual_cents <= 0) return 0;
  return Math.round((1 - annual_cents / monthly_cents) * 100);
}

export function PricingToggle({ plans, waitlistEnabled = false, portalUrl = '' }: { plans: PricingPlan[]; waitlistEnabled?: boolean; portalUrl?: string }) {
  const [annual, setAnnual] = useState(false);

  const visiblePlans = plans;

  // Use the first plan with annual pricing to show the badge discount
  const firstWithAnnual = visiblePlans.find(p => p.annual_cents > 0 && p.monthly_cents > 0);
  const toggleDiscount = firstWithAnnual
    ? calcDiscount(firstWithAnnual.monthly_cents, firstWithAnnual.annual_cents)
    : 0;

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
            {toggleDiscount > 0 && (
              <span className="text-[11px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-semibold">
                Save {toggleDiscount}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className={`grid gap-6 mx-auto ${visiblePlans.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4 max-w-6xl' : 'md:grid-cols-3 max-w-5xl'}`}>
        {visiblePlans.map((plan) => {
          const isFree = plan.monthly_cents === 0 && !plan.contact_sales;
          const priceCents = annual && plan.annual_cents > 0 ? plan.annual_cents : plan.monthly_cents;
          const price = Math.round(priceCents / 100);
          const discount = calcDiscount(plan.monthly_cents, plan.annual_cents);

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

                {plan.contact_sales ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[1.75rem] font-bold text-[#111827] leading-none">Contact Sales</span>
                  </div>
                ) : isFree ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[2.75rem] font-bold text-[#111827] leading-none">Free</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[2.75rem] font-bold text-[#111827] leading-none">${price}</span>
                      <span className="text-[#6B7280] text-sm">/month</span>
                    </div>
                    {annual && plan.annual_cents > 0 && (
                      <p className="text-[12px] text-[#6B7280] mt-1">
                        Billed annually (${price * 12}/yr){discount > 0 && ` · save ${discount}%`}
                      </p>
                    )}
                  </>
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

              {plan.contact_sales ? (
                <a
                  href="mailto:sales@moffu.com"
                  className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                    plan.is_featured
                      ? 'bg-[#0D4C3C] hover:bg-[#083F32] text-white'
                      : 'border border-[#D1D5DB] text-[#374151] hover:bg-[#F8FAFB]'
                  }`}
                >
                  Contact Sales Team
                </a>
              ) : (
                <WaitlistButton
                  enabled={waitlistEnabled}
                  label={waitlistEnabled ? 'Join Waitlist' : 'Get Started'}
                  source="pricing"
                  portalUrl={portalUrl}
                  className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                    plan.is_featured
                      ? 'bg-[#0D4C3C] hover:bg-[#083F32] text-white'
                      : 'border border-[#D1D5DB] text-[#374151] hover:bg-[#F8FAFB]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
