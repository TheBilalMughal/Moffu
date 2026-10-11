import { useEffect, useState } from 'react';
import { billingService, type Plan, type Subscription, type UsageSummary } from './billing.service';

function cents(amount: number) {
  return `$${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (limit || 1)) * 100));
  const danger = !unlimited && pct >= 90;
  const warn = !unlimited && pct >= 70 && pct < 90;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#374151]">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-[#6B7280]'}`}>
          {unlimited ? `${used} used · unlimited` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
        {unlimited ? (
          <div className="h-full w-full bg-[#E6F2EE] rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-[#0D4C3C]'}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {!unlimited && (
        <p className="text-[10px] text-[#9CA3AF] mt-1">{pct}% used</p>
      )}
    </div>
  );
}

const SUPPORT_LABELS: Record<string, string> = {
  help_guides: 'Help center guides',
  standard_email: 'Standard email support',
  priority_email: 'Priority email support',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Get started at no cost.',
  starter: 'For small businesses with one location.',
  growth: 'For growing teams with multiple locations.',
  scale: 'For agencies and large multi-location brands.',
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  free:    { bg: 'bg-[#F3F4F6]',  text: 'text-[#6B7280]',  border: 'border-[#E5EAE8]' },
  starter: { bg: 'bg-[#EFF6FF]',  text: 'text-blue-700',   border: 'border-blue-200' },
  growth:  { bg: 'bg-[#E6F2EE]',  text: 'text-[#0D4C3C]',  border: 'border-[#0D4C3C]/30' },
  scale:   { bg: 'bg-[#1C1917]',  text: 'text-stone-100',  border: 'border-stone-800' },
};

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    Promise.all([billingService.getPlans(), billingService.getSubscription()]).then(async ([ps, s]) => {
      setPlans(ps);
      setSub(s);
      if (s) {
        const u = await billingService.getUsage(s, ps);
        setUsage(u);
        if (s.billing_interval) setBillingInterval(s.billing_interval);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-7 bg-[#F3F4F6] rounded w-48" />
          <div className="h-36 bg-[#F3F4F6] rounded-2xl" />
          <div className="grid grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-80 bg-[#F3F4F6] rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === sub?.plan_id);
  const isFree = !sub || sub.plan_slug === 'free';
  const planSlug = sub?.plan_slug ?? 'free';
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const planColor = (PLAN_COLORS[planSlug] ?? PLAN_COLORS.free)!;

  return (
    <div className="px-8 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-[#111827]">Billing & Plans</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your subscription and track feature usage.</p>
      </div>

      {/* Current plan + usage — full width banner */}
      <div className="bg-white border border-[#E5EAE8] rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-6 items-start">
          {/* Left: plan info */}
          <div className="flex items-start gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${planColor.bg}`}>
              <svg className={`w-5 h-5 ${planColor.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-bold text-[#111827]">{sub?.plan_name ?? 'Free'}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isFree ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#E6F2EE] text-[#0D4C3C]'}`}>
                  {isFree ? 'Free' : sub?.billing_interval === 'annual' ? 'Annual billing' : 'Monthly billing'}
                </span>
              </div>
              <p className="text-sm text-[#6B7280] mt-0.5">{PLAN_DESCRIPTIONS[planSlug]}</p>
              {!isFree && currentPlan && (
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-[#9CA3AF]">
                    {sub?.billing_interval === 'annual'
                      ? `${cents(currentPlan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0)}/mo · billed annually`
                      : `${cents(currentPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0)}/mo`}
                  </span>
                  {sub?.extra_locations ? (
                    <span className="text-xs text-[#9CA3AF]">
                      + {sub.extra_locations} extra location{sub.extra_locations !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
              )}
              {isFree && (
                <p className="text-xs text-[#9CA3AF] mt-2">Upgrade to unlock more replies, locations, and team seats.</p>
              )}
            </div>
          </div>

          {/* Right: usage meters */}
          {usage && (
            <div className="bg-[#F8FAF9] border border-[#E5EAE8] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#374151]">Usage this period</span>
                <span className="text-[10px] text-[#9CA3AF] bg-white border border-[#E5EAE8] px-2 py-0.5 rounded-md">{usage.reset_label}</span>
              </div>
              <UsageMeter label="AI Drafts" used={usage.ai_drafts_used} limit={usage.ai_drafts_limit} />
              <UsageMeter label="Published Replies" used={usage.published_replies_used} limit={usage.published_replies_limit} />
            </div>
          )}
        </div>
      </div>

      {/* Stripe coming soon notice */}
      <p className="text-xs text-[#9CA3AF] mb-8">
        Payments coming soon — Stripe integration is in progress. Upgrades and billing management will be available shortly.
      </p>

      {/* Plans section header + toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Choose a plan</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">All plans include a 14-day free trial on upgrade.</p>
        </div>
        <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5">
          {(['monthly', 'annual'] as const).map(iv => (
            <button
              key={iv}
              onClick={() => setBillingInterval(iv)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billingInterval === iv ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              {iv === 'monthly' ? 'Monthly' : 'Annual'}
              {iv === 'annual' && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">–20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards — 4 col, full width */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {plans.map(plan => {
          const isCurrent = plan.id === sub?.plan_id;
          const price = plan.prices.find(p => p.interval === billingInterval) ?? plan.prices.find(p => p.interval === 'monthly');
          const monthlyPrice = plan.prices.find(p => p.interval === 'monthly');
          const ents = plan.entitlements;
          const isScale = plan.slug === 'scale';
          const isGrowth = plan.slug === 'growth';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border transition-shadow ${
                isCurrent
                  ? 'border-[#0D4C3C] ring-2 ring-[#0D4C3C] bg-white shadow-sm'
                  : isScale
                  ? 'border-[#1C1917] bg-[#1C1917]'
                  : 'border-[#E5EAE8] bg-white hover:shadow-sm'
              }`}
            >
              {/* Badge */}
              {isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#0D4C3C] px-3 py-0.5 rounded-full whitespace-nowrap">
                    Current plan
                  </span>
                </div>
              )}
              {isGrowth && !isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#374151] px-3 py-0.5 rounded-full whitespace-nowrap">
                    Most popular
                  </span>
                </div>
              )}

              {/* Card body */}
              <div className="p-6 flex flex-col flex-1">
                {/* Name + description */}
                <div className="mb-5">
                  <p className={`text-sm font-bold mb-1 ${isScale ? 'text-stone-100' : 'text-[#111827]'}`}>{plan.name}</p>
                  <p className={`text-xs leading-relaxed ${isScale ? 'text-stone-400' : 'text-[#6B7280]'}`}>{PLAN_DESCRIPTIONS[plan.slug]}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {price && price.amount_cents > 0 ? (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={`text-3xl font-bold ${isScale ? 'text-white' : 'text-[#111827]'}`}>
                          {cents(price.amount_cents)}
                        </span>
                        <span className={`text-sm mb-1 ${isScale ? 'text-stone-400' : 'text-[#9CA3AF]'}`}>/mo</span>
                      </div>
                      {billingInterval === 'annual' && monthlyPrice && price && (
                        <p className={`text-[11px] mt-1 ${isScale ? 'text-stone-400' : 'text-[#9CA3AF]'}`}>
                          Billed {cents(price.amount_cents * 12)}/yr
                          <span className="ml-1.5 text-emerald-500 font-semibold">
                            Save {cents((monthlyPrice.amount_cents - price.amount_cents) * 12)}/yr
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    <span className={`text-3xl font-bold ${isScale ? 'text-white' : 'text-[#111827]'}`}>Free</span>
                  )}
                </div>

                {/* Divider */}
                <div className={`border-t mb-5 ${isScale ? 'border-stone-700' : 'border-[#F3F4F6]'}`} />

                {/* Features */}
                <ul className="space-y-2.5 text-xs flex-1 mb-6">
                  {[
                    `${ents['locations']?.limit_value ?? 1} location${(ents['locations']?.limit_value ?? 1) !== 1 ? 's' : ''}`,
                    ents['published_replies']?.value_type === 'UNLIMITED' ? 'Unlimited replies' : `${ents['published_replies']?.limit_value ?? 0} replies/${ents['published_replies']?.usage_reset === 'weekly' ? 'week' : 'mo'}`,
                    ents['ai_drafts']?.value_type === 'UNLIMITED' ? 'Unlimited AI drafts' : `${ents['ai_drafts']?.limit_value ?? 0} AI drafts/${ents['ai_drafts']?.usage_reset === 'weekly' ? 'week' : 'mo'}`,
                    `${ents['team_members']?.limit_value ?? 1} team member${(ents['team_members']?.limit_value ?? 1) !== 1 ? 's' : ''}`,
                    ents['brand_brain_profiles']?.value_type === 'UNLIMITED' ? 'Unlimited Brand Brain profiles' : `${ents['brand_brain_profiles']?.limit_value ?? 0} Brand Brain profile${(ents['brand_brain_profiles']?.limit_value ?? 0) !== 1 ? 's' : ''}`,
                    SUPPORT_LABELS[ents['support_tier']?.enum_value ?? 'help_guides'],
                  ].map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isScale ? 'text-emerald-400' : 'text-[#0D4C3C]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={isScale ? 'text-stone-300' : 'text-[#374151]'}>
                        {feat}
                        {i === 0 && plan.location_addon_cents ? (
                          <span className={`ml-1 ${isScale ? 'text-stone-500' : 'text-[#9CA3AF]'}`}>
                            (+{cents(plan.location_addon_cents)}/extra)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button disabled className={`w-full py-2.5 text-xs font-semibold rounded-xl cursor-default border ${isScale ? 'border-stone-600 text-stone-500 bg-transparent' : 'border-[#E5EAE8] text-[#9CA3AF] bg-transparent'}`}>
                    Current plan
                  </button>
                ) : plan.slug === 'free' ? (
                  <button disabled className="w-full py-2.5 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-xl cursor-default">
                    Downgrade
                  </button>
                ) : (
                  <button
                    disabled
                    title="Stripe integration coming soon"
                    className={`w-full py-2.5 text-xs font-semibold rounded-xl cursor-not-allowed transition-opacity ${
                      isScale
                        ? 'bg-white text-[#1C1917] opacity-40'
                        : 'bg-[#0D4C3C] text-white opacity-50'
                    }`}
                  >
                    Upgrade — coming soon
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Location add-on info */}
      {!isFree && currentPlan?.location_addon_cents && (
        <div className="bg-white border border-[#E5EAE8] rounded-xl px-6 py-4">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-[#111827]">Need more locations?</p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Add extra locations to your {currentPlan.name} plan for {cents(currentPlan.location_addon_cents)}/location/month.
                Toggle locations on in{' '}
                <a href="/settings" className="text-[#0D4C3C] font-semibold underline underline-offset-2">Integrations</a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
