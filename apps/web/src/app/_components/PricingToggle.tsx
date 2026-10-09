'use client';

import { useState } from 'react';
import Link from 'next/link';

const PRICING_PLANS = [
  {
    name: 'Starter',
    description: 'Great for single location businesses.',
    monthlyPrice: 29,
    features: ['1 location included', 'AI review responses', 'Brand Brain', 'Basic analytics'],
    popular: false,
  },
  {
    name: 'Growth',
    description: 'For growing businesses with multiple locations.',
    monthlyPrice: 79,
    features: ['5 locations included', 'Everything in Starter', 'Advanced analytics', 'Team members'],
    popular: true,
  },
  {
    name: 'Scale',
    description: 'For larger organizations and agencies.',
    monthlyPrice: 199,
    features: ['10 locations included', 'Everything in Growth', 'Priority support', 'Advanced permissions'],
    popular: false,
  },
];

function CheckSolid() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PricingToggle() {
  const [annual, setAnnual] = useState(false);

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
        {PRICING_PLANS.map(({ name, description, monthlyPrice, features, popular }) => {
          const price = annual ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
          return (
            <div
              key={name}
              className={`relative bg-white border rounded-xl p-7 flex flex-col ${
                popular ? 'border-[#0D4C3C] ring-1 ring-[#0D4C3C]' : 'border-[#E5E7EB]'
              }`}
            >
              {popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#0D4C3C] text-white text-[11px] font-semibold px-3 py-1 rounded-md whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-[#111827] text-[1.0625rem] mb-1">{name}</h3>
                <p className="text-[13px] text-[#6B7280] mb-5">{description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[2.75rem] font-bold text-[#111827] leading-none">${price}</span>
                  <span className="text-[#6B7280] text-sm">/month</span>
                </div>
                {annual && (
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    Billed annually (${price * 12}/yr)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-7 flex-1">
                {features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex-shrink-0 text-[#0D4C3C]">
                      <CheckSolid />
                    </div>
                    <span className="text-sm text-[#374151]">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                  popular
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
