import { useEffect, useState } from 'react';
import { billingService, type Plan, type Subscription, type UsageSummary, type UsageDay } from './billing.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cents(amount: number) {
  return `$${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`;
}

function formatEntitlement(ent: { value_type: string; limit_value: number | null; bool_value: boolean | null; enum_value: string | null; usage_reset: string | null } | undefined): string {
  if (!ent) return '—';
  if (ent.value_type === 'UNLIMITED') return 'Unlimited';
  if (ent.value_type === 'BOOLEAN') return ent.bool_value ? 'Yes' : 'No';
  if (ent.value_type === 'ENUM') return SUPPORT_LABELS[ent.enum_value ?? ''] ?? ent.enum_value ?? '—';
  const reset = ent.usage_reset === 'weekly' ? '/wk' : ent.usage_reset === 'monthly' ? '/mo' : '';
  return `${ent.limit_value}${reset}`;
}

const SUPPORT_LABELS: Record<string, string> = {
  help_guides: 'Help center guides',
  standard_email: 'Standard email',
  priority_email: 'Priority email',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Get started at no cost.',
  starter: 'For small businesses with one location.',
  growth: 'For growing teams with multiple locations.',
  scale: 'For agencies and large multi-location brands.',
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free:    { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' },
  starter: { bg: 'bg-[#EFF6FF]', text: 'text-blue-700' },
  growth:  { bg: 'bg-[#E6F2EE]', text: 'text-[#0D4C3C]' },
  scale:   { bg: 'bg-[#1C1917]', text: 'text-stone-100' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
          {unlimited ? `${used} · unlimited` : `${used} / ${limit}`}
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
      {!unlimited && <p className="text-[10px] text-[#9CA3AF] mt-1">{pct}% used</p>}
    </div>
  );
}

const CHART_H = 60;

function UsageHistoryChart({ days }: { days: UsageDay[] }) {
  const last14 = days.slice(-14);
  const hasData = last14.some(d => d.ai_drafts > 0 || d.published_replies > 0);
  const maxVal = Math.max(...last14.map(d => d.ai_drafts + d.published_replies), 1);

  if (!hasData) {
    return (
      <div className="h-20 flex items-center justify-center">
        <p className="text-xs text-[#9CA3AF]">No usage in the last 14 days</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-0.5" style={{ height: `${CHART_H}px` }}>
        {last14.map((day) => {
          const total = day.ai_drafts + day.published_replies;
          const barH = Math.max(Math.round((total / maxVal) * CHART_H), total > 0 ? 2 : 0);
          const draftsH = total > 0 ? Math.round((day.ai_drafts / total) * barH) : 0;
          const repliesH = barH - draftsH;
          return (
            <div key={day.date} className="flex-1 flex flex-col justify-end" style={{ height: `${CHART_H}px` }}>
              {barH > 0 && (
                <div className="w-full rounded-sm overflow-hidden" style={{ height: `${barH}px` }}>
                  <div className="w-full bg-[#6BAE9A]" style={{ height: `${draftsH}px` }} />
                  <div className="w-full bg-[#0D4C3C]" style={{ height: `${repliesH}px` }} />
                </div>
              )}
              {barH === 0 && <div className="w-full bg-[#F3F4F6] rounded-sm" style={{ height: '2px' }} />}
            </div>
          );
        })}
      </div>
      {/* Date labels — every 2nd */}
      <div className="flex gap-0.5 mt-1">
        {last14.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[9px] text-[#D1D5DB]">
                {new Date(day.date + 'T12:00:00').getDate()}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#6BAE9A]" />
          <span className="text-[10px] text-[#9CA3AF]">AI drafts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#0D4C3C]" />
          <span className="text-[10px] text-[#9CA3AF]">Published replies</span>
        </div>
      </div>
    </div>
  );
}

const COMPARISON_ROWS: { label: string; key: string }[] = [
  { label: 'Locations',            key: 'locations' },
  { label: 'Replies',              key: 'published_replies' },
  { label: 'AI Drafts',            key: 'ai_drafts' },
  { label: 'Team members',         key: 'team_members' },
  { label: 'Brand Brain profiles', key: 'brand_brain_profiles' },
  { label: 'Support',              key: 'support_tier' },
];

function PlanComparisonModal({ plans, sub, billingInterval, onClose }: {
  plans: Plan[];
  sub: Subscription | null;
  billingInterval: 'monthly' | 'annual';
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 bg-white border-b border-[#E5EAE8] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-[#111827]">Compare plans</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">All prices in USD · {billingInterval === 'annual' ? 'billed annually' : 'billed monthly'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Price row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div />
            {plans.map(plan => {
              const isCurrent = plan.id === sub?.plan_id;
              const price = plan.prices.find(p => p.interval === billingInterval) ?? plan.prices.find(p => p.interval === 'monthly');
              return (
                <div key={plan.id} className={`text-center p-4 rounded-xl border ${isCurrent ? 'border-[#0D4C3C] bg-[#F8FAF9]' : 'border-[#F3F4F6]'}`}>
                  {isCurrent && <p className="text-[10px] font-bold text-[#0D4C3C] mb-1">Current</p>}
                  <p className="text-sm font-bold text-[#111827]">{plan.name}</p>
                  <p className="text-lg font-bold text-[#111827] mt-1">
                    {price && price.amount_cents > 0 ? cents(price.amount_cents) : 'Free'}
                    {price && price.amount_cents > 0 && <span className="text-xs font-normal text-[#9CA3AF]">/mo</span>}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Feature rows */}
          <div className="space-y-0">
            {COMPARISON_ROWS.map((row, ri) => (
              <div key={row.key} className={`grid grid-cols-5 gap-3 py-3 ${ri < COMPARISON_ROWS.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-[#374151]">{row.label}</span>
                </div>
                {plans.map(plan => (
                  <div key={plan.id} className="text-center">
                    <span className="text-xs text-[#374151]">{formatEntitlement(plan.entitlements[row.key])}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Location add-on row */}
            <div className="grid grid-cols-5 gap-3 py-3 border-t border-[#E5EAE8] mt-1">
              <div className="flex items-center">
                <span className="text-xs font-medium text-[#374151]">Extra location</span>
              </div>
              {plans.map(plan => (
                <div key={plan.id} className="text-center">
                  <span className="text-xs text-[#374151]">
                    {plan.location_addon_cents ? `+${cents(plan.location_addon_cents)}/loc` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA row */}
          <div className="grid grid-cols-5 gap-3 mt-6">
            <div />
            {plans.map(plan => {
              const isCurrent = plan.id === sub?.plan_id;
              return (
                <div key={plan.id}>
                  {isCurrent ? (
                    <button disabled className="w-full py-2 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-xl cursor-default">
                      Current
                    </button>
                  ) : plan.slug === 'free' ? (
                    <button disabled className="w-full py-2 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-xl cursor-default">
                      Downgrade
                    </button>
                  ) : (
                    <button disabled title="Coming soon" className="w-full py-2 text-xs font-semibold text-white bg-[#0D4C3C] rounded-xl opacity-50 cursor-not-allowed">
                      Upgrade
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddLocationDialog({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const addonCents = plan.location_addon_cents ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#E5EAE8] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111827]">Add extra location</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#F8FAF9] border border-[#E5EAE8] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#374151]">Plan</span>
              <span className="font-semibold text-[#111827]">{plan.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#374151]">Included locations</span>
              <span className="font-semibold text-[#111827]">{plan.entitlements['locations']?.limit_value ?? 1}</span>
            </div>
            <div className="border-t border-[#E5EAE8] pt-2 flex justify-between text-xs">
              <span className="text-[#374151]">Extra location cost</span>
              <span className="font-bold text-[#111827]">{cents(addonCents)}/mo per location</span>
            </div>
          </div>
          <p className="text-xs text-[#6B7280]">
            Extra locations are added immediately and billed prorated for the remainder of your billing period.
          </p>
          <button
            disabled
            title="Stripe integration coming soon"
            className="w-full py-2.5 text-xs font-semibold text-white bg-[#0D4C3C] rounded-xl opacity-50 cursor-not-allowed"
          >
            Confirm & Pay — coming soon
          </button>
          <p className="text-[10px] text-[#9CA3AF] text-center">Stripe integration is in progress.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<UsageDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [showCompare, setShowCompare] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);

  useEffect(() => {
    Promise.all([
      billingService.getPlans(),
      billingService.getSubscription(),
      billingService.getUsageHistory(),
    ]).then(async ([ps, s, hist]) => {
      setPlans(ps);
      setSub(s);
      setHistory(hist);
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
        <div className="animate-pulse space-y-5">
          <div className="h-7 bg-[#F3F4F6] rounded w-48" />
          <div className="h-36 bg-[#F3F4F6] rounded-2xl" />
          <div className="grid grid-cols-2 gap-5">
            <div className="h-40 bg-[#F3F4F6] rounded-2xl" />
            <div className="h-40 bg-[#F3F4F6] rounded-2xl" />
          </div>
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
  const planColor = (PLAN_COLORS[planSlug] ?? PLAN_COLORS.free)!;

  // Annual savings
  const monthlyPaidPlan = !isFree && sub?.billing_interval !== 'annual' && currentPlan;
  const annualSavings = monthlyPaidPlan
    ? (() => {
        const mo = currentPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0;
        const ann = currentPlan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0;
        return (mo - ann) * 12;
      })()
    : 0;

  // Usage alerts
  const draftsAlertPct = usage && usage.ai_drafts_limit ? Math.round((usage.ai_drafts_used / usage.ai_drafts_limit) * 100) : 0;
  const repliesAlertPct = usage && usage.published_replies_limit ? Math.round((usage.published_replies_used / usage.published_replies_limit) * 100) : 0;
  const hasAlert = draftsAlertPct >= 80 || repliesAlertPct >= 80;
  const alertCritical = draftsAlertPct >= 90 || repliesAlertPct >= 90;

  // Team seats (owner-only until Phase 7 team feature)
  const seatLimit = currentPlan?.entitlements['team_members']?.limit_value ?? 1;

  return (
    <div className="px-8 py-8">
      {/* Modals */}
      {showCompare && (
        <PlanComparisonModal
          plans={plans}
          sub={sub}
          billingInterval={billingInterval}
          onClose={() => setShowCompare(false)}
        />
      )}
      {showAddLocation && currentPlan && (
        <AddLocationDialog plan={currentPlan} onClose={() => setShowAddLocation(false)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Billing & Plans</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Manage your subscription and track feature usage.</p>
        </div>
        <button
          onClick={() => setShowCompare(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#374151] border border-[#E5EAE8] rounded-lg hover:border-[#0D4C3C]/30 hover:text-[#0D4C3C] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Compare all plans
        </button>
      </div>

      {/* Annual savings banner */}
      {annualSavings > 0 && (
        <div className="flex items-center justify-between bg-[#E6F2EE] border border-[#0D4C3C]/20 rounded-xl px-5 py-3 mb-5">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[#0D4C3C]">
              <span className="font-bold">Switch to annual and save {cents(annualSavings)}/year</span>
              {' '}on your {currentPlan?.name} plan — that's {cents(annualSavings / 12)}/mo off.
            </p>
          </div>
          <button
            disabled
            className="flex-shrink-0 text-[11px] font-bold text-white bg-[#0D4C3C] px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
          >
            Switch — coming soon
          </button>
        </div>
      )}

      {/* Current plan + usage — 2 equal columns */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Current plan card */}
        <div className="bg-white border border-[#E5EAE8] rounded-2xl p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Current Plan</p>
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${planColor.bg}`}>
              <svg className={`w-4.5 h-4.5 ${planColor.text}`} style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#111827]">{sub?.plan_name ?? 'Free'}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isFree ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#E6F2EE] text-[#0D4C3C]'}`}>
                  {isFree ? 'Free' : sub?.billing_interval === 'annual' ? 'Annual' : 'Monthly'}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">{PLAN_DESCRIPTIONS[planSlug]}</p>
              {!isFree && currentPlan && (
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {sub?.billing_interval === 'annual'
                    ? `${cents(currentPlan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0)}/mo · billed annually`
                    : `${cents(currentPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0)}/mo`}
                </p>
              )}
            </div>
          </div>

          {/* Team seats */}
          <div className="border-t border-[#F3F4F6] pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#374151]">Team seats</span>
              <span className="text-xs text-[#6B7280]">1 / {seatLimit}</span>
            </div>
            <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-[#0D4C3C] rounded-full" style={{ width: `${Math.min(100, Math.round((1 / (seatLimit || 1)) * 100))}%` }} />
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1">You (owner) · {seatLimit - 1} seat{seatLimit - 1 !== 1 ? 's' : ''} available</p>
          </div>
        </div>

        {/* Usage card */}
        <div className="bg-white border border-[#E5EAE8] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Usage this period</p>
            {usage && (
              <span className="text-[10px] text-[#9CA3AF] bg-[#F8FAF9] border border-[#E5EAE8] px-2 py-0.5 rounded-md">{usage.reset_label}</span>
            )}
          </div>

          {/* Usage alert */}
          {hasAlert && usage && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4 ${alertCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <svg className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${alertCritical ? 'text-red-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <p className={`text-[11px] ${alertCritical ? 'text-red-700' : 'text-amber-700'}`}>
                {alertCritical
                  ? "You've nearly hit your limit. Upgrade to keep generating."
                  : "You're approaching your usage limit for this period."}
              </p>
            </div>
          )}

          {usage ? (
            <div className="space-y-4">
              <UsageMeter label="AI Drafts" used={usage.ai_drafts_used} limit={usage.ai_drafts_limit} />
              <UsageMeter label="Published Replies" used={usage.published_replies_used} limit={usage.published_replies_limit} />
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF]">No active subscription.</p>
          )}

          {/* Overage protection toggle */}
          <div className="border-t border-[#F3F4F6] mt-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#374151]">Overage protection</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Block actions when limit is reached</p>
              </div>
              <button
                disabled
                title="Available with Stripe"
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#0D4C3C] opacity-40 transition-colors"
                aria-label="Overage protection — coming soon"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow translate-x-4 transition-transform" />
              </button>
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1">Configurable when Stripe is connected.</p>
          </div>
        </div>
      </div>

      {/* Usage history + Add-ons — 2 columns */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Usage history chart */}
        <div className="bg-white border border-[#E5EAE8] rounded-2xl p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Usage history · last 14 days</p>
          <UsageHistoryChart days={history} />
        </div>

        {/* Add-ons card */}
        <div className="bg-white border border-[#E5EAE8] rounded-2xl p-6">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-4">Add-ons</p>

          {/* Active addon line items */}
          {sub && sub.addon_items.length > 0 ? (
            <div className="space-y-3 mb-4">
              {sub.addon_items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2.5 px-3 bg-[#F8FAF9] border border-[#E5EAE8] rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-[#111827]">
                      {item.addon_type === 'extra_location' ? 'Extra location' : item.addon_type}
                      {item.quantity > 1 && <span className="text-[#9CA3AF]"> ×{item.quantity}</span>}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">{cents(item.unit_price_cents)}/mo per unit</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#374151]">{cents(item.unit_price_cents * item.quantity)}/mo</span>
                    <button
                      disabled
                      title="Cancellation available when Stripe is connected"
                      className="text-[10px] text-[#9CA3AF] border border-[#E5EAE8] px-2 py-0.5 rounded-md cursor-not-allowed opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] mb-4">No active add-ons.</p>
          )}

          {/* Add extra location */}
          {!isFree && currentPlan?.location_addon_cents ? (
            <button
              onClick={() => setShowAddLocation(true)}
              className="w-full flex items-center justify-between px-4 py-3 border border-dashed border-[#0D4C3C]/30 rounded-xl hover:bg-[#F8FAF9] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#E6F2EE] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-[#374151] group-hover:text-[#0D4C3C]">Add extra location</p>
                  <p className="text-[10px] text-[#9CA3AF]">{cents(currentPlan.location_addon_cents)}/mo per location</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#0D4C3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : isFree ? (
            <p className="text-[11px] text-[#9CA3AF]">Upgrade to a paid plan to add extra locations.</p>
          ) : null}
        </div>
      </div>

      {/* Plans section */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Plans</h3>
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

      {/* Plan cards */}
      <div className="grid grid-cols-4 gap-5 mb-4">
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
              {isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#0D4C3C] px-3 py-0.5 rounded whitespace-nowrap">Current plan</span>
                </div>
              )}
              {isGrowth && !isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#374151] px-3 py-0.5 rounded whitespace-nowrap">Most popular</span>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                <div className="mb-5">
                  <p className={`text-sm font-bold mb-1 ${isScale ? 'text-stone-100' : 'text-[#111827]'}`}>{plan.name}</p>
                  <p className={`text-xs leading-relaxed ${isScale ? 'text-stone-400' : 'text-[#6B7280]'}`}>{PLAN_DESCRIPTIONS[plan.slug]}</p>
                </div>

                <div className="mb-6">
                  {price && price.amount_cents > 0 ? (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={`text-3xl font-bold ${isScale ? 'text-white' : 'text-[#111827]'}`}>{cents(price.amount_cents)}</span>
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

                <div className={`border-t mb-5 ${isScale ? 'border-stone-700' : 'border-[#F3F4F6]'}`} />

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
                          <span className={`ml-1 ${isScale ? 'text-stone-500' : 'text-[#9CA3AF]'}`}>(+{cents(plan.location_addon_cents)}/extra)</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className={`w-full py-2.5 text-xs font-semibold rounded-xl cursor-default border ${isScale ? 'border-stone-600 text-stone-500' : 'border-[#E5EAE8] text-[#9CA3AF]'}`}>
                    Current plan
                  </button>
                ) : plan.slug === 'free' ? (
                  <button disabled className="w-full py-2.5 text-xs font-semibold text-[#9CA3AF] border border-[#E5EAE8] rounded-xl cursor-default">
                    Downgrade
                  </button>
                ) : (
                  <button disabled title="Coming soon" className={`w-full py-2.5 text-xs font-semibold rounded-xl cursor-not-allowed opacity-50 ${isScale ? 'bg-white text-[#1C1917]' : 'bg-[#0D4C3C] text-white'}`}>
                    Upgrade — coming soon
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flat notice */}
      <p className="text-xs text-[#9CA3AF]">
        Payments coming soon — Stripe integration is in progress. Upgrades and billing management will be available shortly.
      </p>
    </div>
  );
}
