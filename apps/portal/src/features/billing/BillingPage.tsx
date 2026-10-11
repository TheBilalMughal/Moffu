import { useEffect, useState } from 'react';
import { billingService, type Plan, type Subscription, type UsageSummary } from './billing.service';

function cents(amount: number) {
  return `$${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`;
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (limit || 1)) * 100));
  const danger = !unlimited && pct >= 90;
  const warn = !unlimited && pct >= 70 && pct < 90;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[#374151]">{label}</span>
        <span className={`text-xs font-semibold ${danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-[#6B7280]'}`}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
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
    </div>
  );
}

const SUPPORT_LABELS: Record<string, string> = {
  help_guides: 'Help guides',
  standard_email: 'Standard email',
  priority_email: 'Priority email',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Get started managing your reviews.',
  starter: 'For small businesses managing one location.',
  growth: 'For growing businesses with multiple locations.',
  scale: 'For agencies and large multi-location brands.',
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
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#F3F4F6] rounded w-40" />
          <div className="h-32 bg-[#F3F4F6] rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-[#F3F4F6] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === sub?.plan_id);
  const isFree = !sub || sub.plan_slug === 'free';

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-7">
        <h2 className="text-xl font-bold text-[#111827]">Billing & Plans</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your subscription and monitor usage.</p>
      </div>

      {/* Current plan + usage */}
      <div className="grid grid-cols-2 gap-5 mb-8">
        {/* Current plan card */}
        <div className="bg-white border border-[#E5EAE8] rounded-xl p-6">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Current Plan</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-[#111827]">{sub?.plan_name ?? 'Free'}</p>
              <p className="text-sm text-[#6B7280] mt-0.5">{PLAN_DESCRIPTIONS[sub?.plan_slug ?? 'free']}</p>
            </div>
            <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${isFree ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#E6F2EE] text-[#0D4C3C]'}`}>
              {isFree ? 'Free' : sub?.billing_interval === 'annual' ? 'Annual' : 'Monthly'}
            </span>
          </div>

          {!isFree && currentPlan && (
            <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
              <p className="text-xs text-[#9CA3AF]">
                {sub?.billing_interval === 'annual'
                  ? `${cents(currentPlan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0)}/mo · billed annually`
                  : `${cents(currentPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0)}/mo`}
              </p>
              {sub?.extra_locations ? (
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  + {sub.extra_locations} extra location{sub.extra_locations !== 1 ? 's' : ''} (add-on)
                </p>
              ) : null}
            </div>
          )}

          {isFree && (
            <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
              <p className="text-xs text-[#9CA3AF]">Upgrade to unlock more replies, locations and team seats.</p>
            </div>
          )}
        </div>

        {/* Usage card */}
        {usage && (
          <div className="bg-white border border-[#E5EAE8] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Usage this period</p>
              <span className="text-[10px] text-[#9CA3AF] bg-[#F8FAF9] border border-[#E5EAE8] px-2 py-0.5 rounded-lg">{usage.reset_label}</span>
            </div>
            <div className="space-y-4">
              <UsageMeter label="AI Drafts" used={usage.ai_drafts_used} limit={usage.ai_drafts_limit} />
              <UsageMeter label="Published Replies" used={usage.published_replies_used} limit={usage.published_replies_limit} />
            </div>
          </div>
        )}
      </div>

      {/* Interval toggle */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-[#111827]">Plans</h3>
        <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5">
          {(['monthly', 'annual'] as const).map(iv => (
            <button
              key={iv}
              onClick={() => setBillingInterval(iv)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${billingInterval === iv ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}
            >
              {iv === 'monthly' ? 'Monthly' : 'Annual'}
              {iv === 'annual' && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">–20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {plans.map(plan => {
          const isCurrent = plan.id === sub?.plan_id;
          const price = plan.prices.find(p => p.interval === billingInterval) ?? plan.prices.find(p => p.interval === 'monthly');
          const monthlyPrice = plan.prices.find(p => p.interval === 'monthly');
          const ents = plan.entitlements;
          const isScale = plan.slug === 'scale';

          return (
            <div key={plan.id}
              className={`relative bg-white border rounded-xl p-5 flex flex-col ${isCurrent ? 'border-[#0D4C3C] ring-1 ring-[#0D4C3C]' : 'border-[#E5EAE8]'}`}
            >
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-[#0D4C3C] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Current plan
                </span>
              )}
              {plan.slug === 'growth' && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-[#374151] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}

              <div className="mb-4">
                <p className="text-sm font-bold text-[#111827] mb-0.5">{plan.name}</p>
                <p className="text-[11px] text-[#9CA3AF] leading-snug">{PLAN_DESCRIPTIONS[plan.slug]}</p>
              </div>

              <div className="mb-5">
                {price && price.amount_cents > 0 ? (
                  <>
                    <span className="text-2xl font-bold text-[#111827]">{cents(price.amount_cents)}</span>
                    <span className="text-xs text-[#9CA3AF]">/mo</span>
                    {billingInterval === 'annual' && monthlyPrice && (
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                        Billed {cents(price.amount_cents * 12)}/yr
                        <span className="ml-1 text-emerald-600 font-semibold">
                          Save {cents((monthlyPrice.amount_cents - price.amount_cents) * 12)}/yr
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-2xl font-bold text-[#111827]">Free</span>
                )}
              </div>

              <ul className="space-y-2 text-xs text-[#374151] flex-1 mb-5">
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {isScale ? '1,000 locations' : `${ents['locations']?.limit_value ?? 1} location${(ents['locations']?.limit_value ?? 1) > 1 ? 's' : ''}`}
                  {plan.location_addon_cents ? <span className="text-[10px] text-[#9CA3AF] ml-1">(+{cents(plan.location_addon_cents)}/extra)</span> : null}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {ents['published_replies']?.value_type === 'UNLIMITED' ? 'Unlimited replies' : `${ents['published_replies']?.limit_value ?? 0} replies/${ents['published_replies']?.usage_reset === 'weekly' ? 'wk' : 'mo'}`}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {ents['ai_drafts']?.value_type === 'UNLIMITED' ? 'Unlimited AI drafts' : `${ents['ai_drafts']?.limit_value ?? 0} AI drafts/${ents['ai_drafts']?.usage_reset === 'weekly' ? 'wk' : 'mo'}`}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {ents['team_members']?.limit_value ?? 1} team member{(ents['team_members']?.limit_value ?? 1) > 1 ? 's' : ''}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {ents['brand_brain_profiles']?.value_type === 'UNLIMITED' ? 'Unlimited Brand Brain profiles' : `${ents['brand_brain_profiles']?.limit_value ?? 0} Brand Brain profile${(ents['brand_brain_profiles']?.limit_value ?? 0) > 1 ? 's' : ''}`}
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {SUPPORT_LABELS[ents['support_tier']?.enum_value ?? 'help_guides']}
                </li>
              </ul>

              {isCurrent ? (
                <button disabled className="w-full py-2 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-lg cursor-default">
                  Current plan
                </button>
              ) : plan.slug === 'free' ? (
                <button disabled className="w-full py-2 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-lg cursor-default">
                  Downgrade
                </button>
              ) : (
                <button
                  disabled
                  title="Payment coming soon"
                  className="w-full py-2 text-xs font-semibold text-white bg-[#0D4C3C] rounded-lg opacity-50 cursor-not-allowed"
                >
                  Upgrade — coming soon
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Location add-on info */}
      {!isFree && currentPlan?.location_addon_cents && (
        <div className="bg-white border border-[#E5EAE8] rounded-xl p-5 mb-6">
          <p className="text-sm font-bold text-[#111827] mb-1">Extra locations</p>
          <p className="text-xs text-[#6B7280]">
            Add extra locations to your {currentPlan.name} plan for {cents(currentPlan.location_addon_cents)}/location/month.
            Manage your connected locations in{' '}
            <a href="/settings" className="text-[#0D4C3C] font-semibold underline">Integrations</a>.
          </p>
        </div>
      )}

      {/* Stripe coming soon notice */}
      <div className="flex items-start gap-3 bg-[#FFFBEB] border border-amber-200 rounded-xl px-5 py-4">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-amber-800">Payments coming soon</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Stripe integration is in progress. Upgrades and billing management will be available shortly.
          </p>
        </div>
      </div>
    </div>
  );
}
