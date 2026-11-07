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

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function PricingToggle({
  plans,
  waitlistEnabled = false,
  portalUrl = '',
}: {
  plans: PricingPlan[];
  waitlistEnabled?: boolean;
  portalUrl?: string;
}) {
  const [annual, setAnnual] = useState(false);

  const visiblePlans = plans;
  const firstWithAnnual = visiblePlans.find(p => p.annual_cents > 0 && p.monthly_cents > 0);
  const toggleDiscount = firstWithAnnual
    ? calcDiscount(firstWithAnnual.monthly_cents, firstWithAnnual.annual_cents)
    : 0;

  return (
    <>
      {/* ── Heading row + Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 mb-12">
        {/* Left: heading */}
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">pricing</p>
          <h2 className="text-[clamp(2.25rem,5vw,3.75rem)] font-black text-[#111827] leading-[1.05]">
            Plans for every<br />stage of growth.
          </h2>
        </div>

        {/* Right: toggle */}
        <div className="flex-shrink-0 pb-1">
          <div className="relative flex items-stretch bg-white border border-[#E5E7EB] rounded-xl p-1.5">
            {/* Sliding bouncy pill — covers exactly one half */}
            <div
              aria-hidden="true"
              className="absolute top-1.5 bottom-1.5 rounded-lg bg-[#2ECC8A] pointer-events-none"
              style={{
                left:       annual ? '50%'  : '6px',
                right:      annual ? '6px'  : '50%',
                transition: `left 0.42s ${SPRING}, right 0.42s ${SPRING}`,
              }}
            />

            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`relative z-10 flex-1 px-7 py-3 text-base font-semibold rounded-lg transition-colors duration-200 ${
                !annual ? 'text-white' : 'text-[#111827]/55 hover:text-[#111827]'
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`relative z-10 flex-1 px-7 py-3 text-base font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                annual ? 'text-white' : 'text-[#111827]/55 hover:text-[#111827]'
              }`}
            >
              Annual
              {toggleDiscount > 0 && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md font-bold transition-all duration-200 ${
                    annual ? 'bg-white/25 text-white' : 'bg-[#D1FAE5] text-[#065F46]'
                  }`}
                >
                  -{toggleDiscount}%
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Cards ── */}
      <div
        className={`grid gap-6 ${
          visiblePlans.length === 4
            ? 'sm:grid-cols-2 xl:grid-cols-4'
            : 'md:grid-cols-3'
        }`}
      >
        {visiblePlans.map((plan) => {
          const isFree     = plan.monthly_cents === 0 && !plan.contact_sales;
          const priceCents = annual && plan.annual_cents > 0 ? plan.annual_cents : plan.monthly_cents;
          const price      = Math.round(priceCents / 100);
          const discount   = calcDiscount(plan.monthly_cents, plan.annual_cents);
          const featured   = plan.is_featured;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl p-8 lg:p-10 border border-[#E5E7EB] ${
                featured ? 'bg-[#111827]' : 'bg-white'
              }`}
            >
              {/* Badge */}
              {featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#2ECC8A] text-[#111827] text-[11px] font-bold px-3 py-1 rounded-md whitespace-nowrap">
                    {plan.badge_text || 'Most Popular'}
                  </span>
                </div>
              )}

              {/* Plan name + description */}
              <div className="mb-6">
                <h3 className={`font-bold text-[1.0625rem] mb-1 ${featured ? 'text-white' : 'text-[#111827]'}`}>
                  {plan.name}
                </h3>
                <p className={`text-[13px] mb-5 ${featured ? 'text-white/55' : 'text-[#111827]/60'}`}>
                  {plan.description ?? ''}
                </p>

                {/* Price */}
                {plan.contact_sales ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`text-[1.75rem] font-bold leading-none ${featured ? 'text-white' : 'text-[#111827]'}`}>
                      Contact Sales
                    </span>
                  </div>
                ) : isFree ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`text-[3.25rem] font-black leading-none ${featured ? 'text-white' : 'text-[#111827]'}`}>
                      Free
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[3.25rem] font-black leading-none ${featured ? 'text-white' : 'text-[#111827]'}`}>
                        ${price}
                      </span>
                      <span className={`text-sm ${featured ? 'text-white/50' : 'text-[#111827]/50'}`}>/month</span>
                    </div>
                    {annual && plan.annual_cents > 0 && (
                      <p className={`text-[12px] mt-1 ${featured ? 'text-white/45' : 'text-[#111827]/50'}`}>
                        Billed annually (${price * 12}/yr){discount > 0 && ` · save ${discount}%`}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-7 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 text-[#2ECC8A]">
                      <CheckSolid />
                    </div>
                    <span className={`text-sm ${featured ? 'text-white/75' : 'text-[#111827]/75'}`}>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {plan.contact_sales ? (
                <a
                  href="mailto:sales@moffu.com"
                  className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    featured
                      ? 'border-2 border-white text-white hover:bg-white hover:text-[#0D4C3C] active:scale-95'
                      : 'border-2 border-[#111827] text-[#111827] hover:bg-[#111827] hover:text-[#2ECC8A]'
                  }`}
                >
                  Contact Sales Team
                </a>
              ) : featured ? (
                <WaitlistButton
                  enabled={waitlistEnabled}
                  label={waitlistEnabled ? 'Join Waitlist' : 'Get Started'}
                  source="pricing"
                  portalUrl={portalUrl}
                  className="block w-full text-center py-3 rounded-lg text-sm font-semibold border-2 border-white text-white hover:bg-white hover:text-[#0D4C3C] active:scale-95 transition-all duration-150"
                />
              ) : (
                <WaitlistButton
                  enabled={waitlistEnabled}
                  label={waitlistEnabled ? 'Join Waitlist' : 'Get Started'}
                  source="pricing"
                  portalUrl={portalUrl}
                  className="block w-full text-center py-3 rounded-lg text-sm font-semibold border-2 border-[#111827] text-[#111827] hover:bg-[#111827] hover:text-[#2ECC8A] transition-all duration-150"
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
