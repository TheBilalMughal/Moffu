import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubRaw {
  id: string;
  plan_id: string;
  status: string;
  billing_interval: string | null;
  created_at: string;
  cancel_at_period_end: boolean;
}

interface PriceRaw {
  plan_id: string;
  billing_interval: string;
  amount_cents: number;
}

interface PlanRaw {
  id: string;
  slug: string;
  name: string;
}

interface EnrichedSub {
  id: string;
  planSlug: string;
  planName: string;
  amountCents: number;
  status: string;
  interval: string;
  createdAt: string;
  cancelAtPeriodEnd: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#F3F4F6] text-[#374151]',
  starter: 'bg-[#EFF6FF] text-[#1D4ED8]',
  growth: 'bg-[#F0FDF4] text-[#15803D]',
  scale: 'bg-[#FFF7ED] text-[#C2410C]',
};

const PLAN_BAR: Record<string, string> = {
  free: '#D1D5DB', starter: '#3B82F6', growth: '#10B981', scale: '#F97316',
};

function fmt(cents: number): string {
  if (cents === 0) return '$0';
  const v = cents / 100;
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(v % 1 === 0 ? 0 : 0)}`;
}

function fmtFull(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function getMonthStart(monthsAgo: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
}

function getMonthEnd(monthsAgo: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function TrendChart({ data }: { data: { label: string; mrr: number }[] }) {
  const max = Math.max(...data.map((d) => d.mrr), 1);
  const H = 100;

  return (
    <div className="flex items-end gap-3 h-32">
      {data.map((d, i) => {
        const pct = d.mrr / max;
        const barH = Math.max(pct * H, d.mrr > 0 ? 4 : 2);
        const isLast = i === data.length - 1;
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
            <p className="text-[10px] text-[#9CA3AF] font-medium">{d.mrr > 0 ? fmt(d.mrr) : '—'}</p>
            <div className="w-full flex items-end" style={{ height: H }}>
              <div
                className={`w-full rounded-t transition-all ${isLast ? 'bg-[#0D4C3C]' : 'bg-[#C7DDD8]'}`}
                style={{ height: barH }}
              />
            </div>
            <p className="text-[10px] text-[#9CA3AF]">{d.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MRRPage() {
  const [subs, setSubs] = useState<EnrichedSub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    const [subsRes, plansRes, pricesRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, plan_id, status, billing_interval, created_at, cancel_at_period_end')
        .order('created_at', { ascending: false }),
      supabase.from('plans').select('id, slug, name').order('sort_order'),
      supabase.from('plan_prices').select('plan_id, billing_interval, amount_cents').eq('currency', 'USD'),
    ]);

    const allPlans = ((plansRes.data ?? []) as PlanRaw[]);
    const planById = new Map<string, PlanRaw>(allPlans.map((p) => [p.id, p]));
    const priceMap = new Map<string, number>();
    ((pricesRes.data ?? []) as PriceRaw[]).forEach((p) =>
      priceMap.set(`${p.plan_id}:${p.billing_interval}`, p.amount_cents));

    const enriched: EnrichedSub[] = ((subsRes.data ?? []) as SubRaw[]).map((s) => {
      const plan = planById.get(s.plan_id);
      const interval = s.billing_interval ?? 'monthly';
      const amountCents = priceMap.get(`${s.plan_id}:${interval}`) ?? priceMap.get(`${s.plan_id}:monthly`) ?? 0;
      return {
        id: s.id,
        planSlug: plan?.slug ?? 'free',
        planName: plan?.name ?? 'Free',
        amountCents,
        status: s.status,
        interval,
        createdAt: s.created_at,
        cancelAtPeriodEnd: s.cancel_at_period_end,
      };
    });

    setSubs(enriched);
    setLoading(false);
  }

  const kpis = useMemo(() => {
    const active = subs.filter((s) => s.status === 'active');
    const paid = active.filter((s) => s.planSlug !== 'free');
    const mrr = paid.reduce((sum, s) => sum + s.amountCents, 0);
    const arr = mrr * 12;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const newThisMonth = paid.filter((s) => s.createdAt >= monthStart);
    const newMRR = newThisMonth.reduce((sum, s) => sum + s.amountCents, 0);

    const atRisk = active.filter((s) => s.planSlug !== 'free' && s.cancelAtPeriodEnd).length;
    const pastDue = subs.filter((s) => s.status === 'past_due').length;

    return { mrr, arr, paidCount: paid.length, newMRR, newCount: newThisMonth.length, atRisk: atRisk + pastDue };
  }, [subs]);

  const planBreakdown = useMemo(() => {
    const slugs = ['free', 'starter', 'growth', 'scale'];
    const NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', scale: 'Scale' };
    return slugs.map((slug) => {
      const rows = subs.filter((s) => s.planSlug === slug);
      const active = rows.filter((s) => s.status === 'active');
      const mrr = active.reduce((sum, s) => sum + s.amountCents, 0);
      return { slug, name: NAMES[slug], count: active.length, mrr };
    });
  }, [subs]);

  const maxPlanMRR = Math.max(...planBreakdown.map((d) => d.mrr), 1);

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const monthsAgo = 5 - i;
      const start = getMonthStart(monthsAgo).toISOString();
      const end = getMonthEnd(monthsAgo).toISOString();
      const label = monthLabel(getMonthStart(monthsAgo).toISOString());
      const newPaid = subs.filter(
        (s) => s.planSlug !== 'free' && s.createdAt >= start && s.createdAt <= end,
      );
      const mrr = newPaid.reduce((sum, s) => sum + s.amountCents, 0);
      return { label, mrr };
    });
  }, [subs]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827]">MRR Dashboard</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Monthly recurring revenue overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total MRR', value: fmtFull(kpis.mrr), sub: 'active paid plans', accent: false },
          { label: 'ARR', value: fmtFull(kpis.arr), sub: 'annualised', accent: false },
          { label: 'Paid Accounts', value: String(kpis.paidCount), sub: 'active subscriptions', accent: false },
          { label: 'New MRR (Mo)', value: fmtFull(kpis.newMRR), sub: `${kpis.newCount} new this month`, accent: kpis.newMRR > 0 },
          { label: 'At Risk', value: String(kpis.atRisk), sub: 'past due / canceling', accent: kpis.atRisk > 0 },
        ].map((c) => (
          <div key={c.label} className={`bg-white border rounded-xl px-5 py-4 ${c.accent && c.label === 'At Risk' && kpis.atRisk > 0 ? 'border-red-200' : 'border-[#E5EAE8]'}`}>
            <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.accent && c.label === 'At Risk' && kpis.atRisk > 0 ? 'text-red-600' : c.accent && kpis.newMRR > 0 ? 'text-[#0D4C3C]' : 'text-[#111827]'}`}>
              {c.value}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Plan Breakdown */}
        <div className="col-span-3 bg-white border border-[#E5EAE8] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#111827] mb-4">MRR by Plan</h2>
          <div className="space-y-4">
            {planBreakdown.map((d) => (
              <div key={d.slug}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PLAN_COLOR[d.slug] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                      {d.name}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">{d.count} active</span>
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">{fmtFull(d.mrr)}<span className="text-xs text-[#9CA3AF] font-normal">/mo</span></span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: d.mrr > 0 ? `${(d.mrr / maxPlanMRR) * 100}%` : '2px',
                      backgroundColor: PLAN_BAR[d.slug] ?? '#9CA3AF',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="col-span-2 bg-white border border-[#E5EAE8] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#111827] mb-1">New MRR — Last 6 Months</h2>
          <p className="text-xs text-[#9CA3AF] mb-4">New paid subscriptions acquired per month</p>
          <TrendChart data={trendData} />
        </div>
      </div>

      {/* Plan mix summary */}
      <div className="mt-4 bg-white border border-[#E5EAE8] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#111827] mb-4">Plan Mix</h2>
        <div className="grid grid-cols-4 gap-4">
          {planBreakdown.map((d) => {
            const total = subs.filter((s) => s.status === 'active').length || 1;
            const pct = Math.round((d.count / total) * 100);
            return (
              <div key={d.slug} className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={PLAN_BAR[d.slug] ?? '#9CA3AF'} strokeWidth="3"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#111827]">{pct}%</span>
                  </div>
                </div>
                <p className={`text-xs font-semibold inline-block px-2 py-0.5 rounded ${PLAN_COLOR[d.slug] ?? ''}`}>{d.name}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{d.count} active</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
