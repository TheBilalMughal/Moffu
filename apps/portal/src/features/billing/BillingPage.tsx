import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { billingService, type Plan, type Subscription, type UsageSummary, type UsageDay, type PaddleTransaction } from './billing.service';
import { LocationSelectionModal } from './LocationSelectionModal';
import { supabase } from '@/lib/supabase';

interface OrgOverride {
  ai_drafts_per_month: number | null;
  published_replies_per_month: number | null;
  max_locations: number | null;
  max_team_members: number | null;
  campaign_emails_per_month: number | null;
  custom_price_cents: number | null;
  billing_interval: string | null;
  contract_start: string | null;
  contract_end: string | null;
}

// --- Helpers ---

function cents(amount: number) {
  return `$${(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}`;
}

function applyDiscount(amountCents: number, type: 'fixed' | 'percent' | null, value: number | null): number {
  if (!type || !value || value <= 0) return amountCents;
  if (type === 'percent') return Math.max(0, Math.round(amountCents * (1 - value / 100)));
  if (type === 'fixed') return Math.max(0, amountCents - Math.round(value * 100));
  return amountCents;
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
  growth:  { bg: 'bg-[#EDE9FE]', text: 'text-[#6C55E8]' },
  scale:   { bg: 'bg-[#1C1917]', text: 'text-stone-100' },
};

// --- Sub-components ---

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
          <div className="h-full w-full bg-[#EDE9FE] rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-[#111827]'}`}
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
                <div className="w-full flex flex-col rounded-t-sm overflow-hidden" style={{ height: `${barH}px` }}>
                  {draftsH > 0 && <div className="w-full bg-[#C4B5FD]" style={{ height: `${draftsH}px` }} />}
                  {repliesH > 0 && <div className="w-full bg-[#6C55E8]" style={{ height: `${repliesH}px` }} />}
                </div>
              )}
              {barH === 0 && <div className="w-full bg-[#F3F4F6] rounded-xl" style={{ height: '2px' }} />}
            </div>
          );
        })}
      </div>
      {/* Date labels -- every 2nd */}
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
          <div className="w-2.5 h-2.5 rounded-xl bg-[#C4B5FD]" />
          <span className="text-[10px] text-[#9CA3AF]">AI drafts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-xl bg-[#6C55E8]" />
          <span className="text-[10px] text-[#9CA3AF]">Published replies</span>
        </div>
      </div>
    </div>
  );
}

const COMPARISON_ROWS: { label: string; key: string; section?: string }[] = [
  { label: 'Locations',            key: 'locations' },
  { label: 'Replies',              key: 'published_replies' },
  { label: 'AI Drafts',            key: 'ai_drafts' },
  { label: 'Team members',         key: 'team_members' },
  { label: 'Brand Brain profiles', key: 'brand_brain_profiles' },
  { label: 'Google Profile',       key: 'feature_google_profile' },
  { label: 'Email Campaigns',      key: 'campaign_emails',    section: 'Campaigns' },
  { label: 'SMS Campaigns',        key: 'campaign_sms',       section: 'Campaigns' },
  { label: 'WhatsApp Campaigns',   key: 'campaign_whatsapp',  section: 'Campaigns' },
  { label: 'Support',              key: 'support_tier' },
];

function PlanComparisonModal({ plans, sub, billingInterval, currentPlan, onDowngrade, onClose }: {
  plans: Plan[];
  sub: Subscription | null;
  billingInterval: 'monthly' | 'annual';
  currentPlan: Plan | null;
  onDowngrade: (plan: Plan) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between rounded-t-2xl">
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
                <div key={plan.id} className={`text-center p-4 rounded-xl border ${isCurrent ? 'border-[#6C55E8] bg-[#F9FAFB]' : 'border-[#F3F4F6]'}`}>
                  {isCurrent && <p className="text-[10px] font-bold text-[#6C55E8] mb-1">Current</p>}
                  <p className={`text-sm font-bold ${isCurrent ? "text-[#6C55E8]" : "text-[#111827]"}`}>{plan.name}</p>
                  <p className={`text-lg font-bold mt-1 ${isCurrent ? "text-[#6C55E8]" : "text-[#111827]"}`}>
                    {plan.contact_sales ? (
                      <span className="text-sm font-semibold text-[#374151]">Custom</span>
                    ) : price && price.amount_cents > 0 ? (
                      <>{cents(price.amount_cents)}<span className="text-xs font-normal text-[#9CA3AF]">/mo</span></>
                    ) : 'Free'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Feature rows */}
          <div className="space-y-0">
            {COMPARISON_ROWS.map((row, ri) => {
              const prevRow = ri > 0 ? COMPARISON_ROWS[ri - 1] : null;
              const showSectionHeader = row.section && row.section !== prevRow?.section;
              return (
                <div key={row.key}>
                  {showSectionHeader && (
                    <div className="grid grid-cols-5 gap-3 pt-4 pb-1 border-t border-[#E5E7EB] mt-1">
                      <div className="col-span-5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{row.section}</span>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-5 gap-3 py-3 ${ri < COMPARISON_ROWS.length - 1 && !COMPARISON_ROWS[ri + 1]?.section ? 'border-b border-[#F9FAFB]' : ''}`}>
                    <div className="flex items-center">
                      <span className="text-xs font-medium text-[#374151]">{row.label}</span>
                    </div>
                    {plans.map(plan => (
                      <div key={plan.id} className="text-center">
                        <span className="text-xs text-[#374151]">{formatEntitlement(plan.entitlements[row.key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Location add-on row */}
            <div className="grid grid-cols-5 gap-3 py-3 border-t border-[#E5E7EB] mt-1">
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
              const currentSortOrder = currentPlan?.sort_order ?? 0;
              const isDowngrade = !isCurrent && plan.sort_order < currentSortOrder;
              return (
                <div key={plan.id}>
                  {isCurrent ? (
                    <button disabled className="w-full py-2 text-xs font-semibold text-[#9CA3AF] border border-[#E5E7EB] rounded-xl cursor-default">
                      Current
                    </button>
                  ) : isDowngrade ? (
                    <button onClick={() => { onClose(); onDowngrade(plan); }} className="w-full py-2 text-xs font-semibold text-[#374151] border border-[#E5E7EB] rounded-xl hover:bg-[#F3F4F6] transition-colors">
                      Downgrade
                    </button>
                  ) : plan.contact_sales ? (
                    <a href="mailto:sales@moffu.com" className="w-full py-2 text-xs font-semibold text-white bg-[#111827] rounded-xl flex items-center justify-center hover:bg-[#6C55E8] transition-colors">
                      Contact Sales
                    </a>
                  ) : (
                    <button disabled title="Coming soon" className="w-full py-2 text-xs font-semibold text-white bg-[#111827] rounded-xl opacity-50 cursor-not-allowed">
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
        <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111827]">Add extra location</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#374151]">Plan</span>
              <span className="font-semibold text-[#111827]">{plan.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#374151]">Included locations</span>
              <span className="font-semibold text-[#111827]">{plan.entitlements['locations']?.limit_value ?? 1}</span>
            </div>
            <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-xs">
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
            className="w-full py-2.5 text-xs font-semibold text-white bg-[#111827] rounded-xl opacity-50 cursor-not-allowed"
          >
            Confirm & Pay — coming soon
          </button>
          <p className="text-[10px] text-[#9CA3AF] text-center">Stripe integration is in progress.</p>
        </div>
      </div>
    </div>
  );
}

// --- Receipt download ---

function downloadReceipt(tx: { paddle_transaction_id: string; plan_name: string | null; billing_interval: string | null; amount_cents: number; currency: string; created_at: string }) {
  const date = new Date(tx.created_at);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const amount = `$${(tx.amount_cents / 100).toFixed(2)}`;
  const interval = tx.billing_interval === 'annual' ? 'Annual' : 'Monthly';
  const shortId = tx.paddle_transaction_id.replace('txn_', '').slice(0, 12).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Moffu Receipt ${shortId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:#F9FAFB;padding:40px 16px;color:#111827}
  .wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E5E7EB;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:32px}
  .logo-mark{width:36px;height:36px;background:#6C55E8;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;line-height:1}
  .logo-name{font-size:20px;font-weight:900;letter-spacing:-.03em}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid #F3F4F6}
  .receipt-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;margin-bottom:4px}
  .receipt-id{font-size:22px;font-weight:800;letter-spacing:-.02em}
  .receipt-date{font-size:13px;color:#6B7280;margin-top:4px}
  .badge{background:#EDE9FE;color:#6C55E8;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;text-align:left;padding:0 0 10px}
  th:last-child{text-align:right}
  td{font-size:14px;color:#374151;padding:12px 0;border-top:1px solid #F3F4F6}
  td:last-child{text-align:right;font-weight:600;color:#111827}
  .total-row td{border-top:2px solid #E5E7EB;padding-top:16px;font-size:16px;font-weight:700;color:#111827}
  .footer{margin-top:28px;padding-top:20px;border-top:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;line-height:1.6}
  .status{display:inline-flex;align-items:center;gap:5px;background:#ECFDF5;color:#059669;font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px}
  .dot{width:5px;height:5px;background:#059669;border-radius:50%}
  @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border:none;border-radius:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <div class="logo-mark">M</div>
    <span class="logo-name">Moffu</span>
  </div>
  <div class="header">
    <div>
      <div class="receipt-label">Receipt</div>
      <div class="receipt-id">#${shortId}</div>
      <div class="receipt-date">${dateStr}</div>
    </div>
    <span class="status"><span class="dot"></span>Paid</span>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>
          <div style="font-weight:600;color:#111827">${tx.plan_name ?? 'Moffu Plan'}</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">${interval} subscription</div>
        </td>
        <td>${amount}</td>
      </tr>
      <tr class="total-row">
        <td>Total</td>
        <td>${amount} ${tx.currency}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <div style="margin-bottom:4px"><strong style="color:#374151">Transaction ID:</strong> ${tx.paddle_transaction_id}</div>
    <div>Thank you for using Moffu. For billing questions, contact <a href="mailto:support@moffu.pro" style="color:#6C55E8">support@moffu.pro</a></div>
    <div style="margin-top:12px;font-size:11px">© ${date.getFullYear()} Moffu · moffu.pro</div>
  </div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// --- Payment Success Modal ---

function PaymentSuccessModal({ tx, planName, onClose }: {
  tx: { paddle_transaction_id: string; amount_cents: number; currency: string; created_at: string; billing_interval: string | null; plan_name: string | null } | null;
  planName: string;
  onClose: () => void;
}) {
  const displayPlan = tx?.plan_name ?? planName;
  const amount = tx ? `$${(tx.amount_cents / 100).toFixed(2)}` : null;
  const shortId = tx?.paddle_transaction_id?.replace('txn_', '').slice(0, 12).toUpperCase() ?? null;
  const dateStr = tx ? new Date(tx.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Purple header */}
        <div className="bg-[#6C55E8] px-8 pt-8 pb-6 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white/80 text-sm font-semibold mb-1">Payment successful</p>
          <h2 className="text-white text-2xl font-black tracking-tight">Welcome to {displayPlan}!</h2>
        </div>

        {/* Receipt body */}
        <div className="px-8 py-6">
          {/* Moffu logo row */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-[#6C55E8] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <span className="font-black text-[#111827] text-base tracking-tight">Moffu</span>
          </div>

          {/* Transaction details */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">Plan</span>
              <span className="text-xs font-semibold text-[#111827]">{displayPlan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">Billing</span>
              <span className="text-xs font-semibold text-[#111827] capitalize">{tx?.billing_interval ?? 'Monthly'}</span>
            </div>
            {amount && (
              <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                <span className="text-sm font-bold text-[#111827]">Total charged</span>
                <span className="text-sm font-black text-[#111827]">{amount}</span>
              </div>
            )}
          </div>

          {/* Transaction ID + date */}
          {shortId && (
            <div className="space-y-1 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Transaction ID</span>
                <span className="text-xs font-mono font-semibold text-[#374151]">{shortId}</span>
              </div>
              {dateStr && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9CA3AF]">Date</span>
                  <span className="text-xs text-[#374151]">{dateStr}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Status</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Paid
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {tx && (
              <button
                onClick={() => downloadReceipt(tx)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-[#111827] border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Receipt
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#111827] rounded-xl hover:bg-[#6C55E8] transition-colors"
            >
              Go to Billing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---

export function BillingPage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const billingSubView = pathname === '/plan' ? 'plan' : 'billing';
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<UsageDay[]>([]);
  const [transactions, setTransactions] = useState<PaddleTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [orgOverride, setOrgOverride] = useState<OrgOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [showCompare, setShowCompare] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [overageProtection, setOverageProtection] = useState(true);
  const [overageToggling, setOverageToggling] = useState(false);
  const [downgradePlan, setDowngradePlan] = useState<Plan | null>(null);
  const [downgradeMsg, setDowngradeMsg] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ planName: string; tx: PaddleTransaction | null } | null>(null);
  const paddleReadyRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Load Paddle.js once
  useEffect(() => {
    if (paddleReadyRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      const w = window as Window & { Paddle?: { Environment: { set: (e: string) => void }; Setup: (o: object) => void } };
      if (!w.Paddle) return;
      const env = import.meta.env.VITE_PADDLE_ENVIRONMENT ?? 'sandbox';
      if (env === 'sandbox') w.Paddle.Environment.set('sandbox');
      w.Paddle.Setup({ token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN ?? '' });
      paddleReadyRef.current = true;
    };
    document.head.appendChild(script);
  }, []);

  async function openPaddleCheckout(priceId: string, planSlug: string, planName: string) {
    const w = window as Window & { Paddle?: { Checkout: { open: (o: object) => void } } };
    if (!w.Paddle?.Checkout) {
      alert('Payment system loading, please try again in a moment.');
      return;
    }
    if (!userIdRef.current) {
      const { data: { user } } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null;
    }
    setCheckoutLoading(planSlug);
    try {
      w.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { user_id: userIdRef.current },
        settings: { successUrl: `${window.location.origin}/billing?upgraded=1` },
        eventCallback: (ev: { name: string; data?: { transaction_id?: string } }) => {
          if (ev.name === 'checkout.completed') {
            const tid = ev.data?.transaction_id ?? null;
            try {
              localStorage.setItem('moffu_checkout_success', JSON.stringify({ planName, tid }));
            } catch { /* ignore */ }
          }
        },
      });
    } finally {
      setCheckoutLoading(null);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(search);
    const isUpgraded = params.get('upgraded') === '1';

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
        setOverageProtection(s.overage_protection);
      }
      // Fetch org-level override (enterprise custom quota)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
        const { data: member } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (member?.org_id) {
          const { data: ov } = await supabase
            .from('org_plan_overrides')
            .select('ai_drafts_per_month,published_replies_per_month,max_locations,max_team_members,campaign_emails_per_month,custom_price_cents,billing_interval,contract_start,contract_end')
            .eq('org_id', member.org_id)
            .maybeSingle();
          setOrgOverride(ov ?? null);
        }
      }
      setLoading(false);

      // Always load transaction history on billing view
      if (billingSubView === 'billing') {
        setTxLoading(true);
        billingService.getTransactions().then(txList => {
          setTransactions(txList);
          setTxLoading(false);
        });
      }

      // Show success modal if redirected from Paddle checkout
      if (isUpgraded) {
        navigate('/billing', { replace: true });
        let storedPlanName = s?.plan_name ?? 'Your plan';
        let storedTid: string | null = null;
        try {
          const raw = localStorage.getItem('moffu_checkout_success');
          if (raw) {
            const parsed = JSON.parse(raw) as { planName?: string; tid?: string };
            if (parsed.planName) storedPlanName = parsed.planName;
            if (parsed.tid) storedTid = parsed.tid;
            localStorage.removeItem('moffu_checkout_success');
          }
        } catch { /* ignore */ }

        // Try to fetch the matching transaction (webhook may need a moment)
        let matchTx: PaddleTransaction | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise(r => setTimeout(r, 1200));
          const txList = await billingService.getTransactions();
          if (txList.length > 0) {
            matchTx = storedTid ? (txList.find(t => t.paddle_transaction_id === storedTid) ?? txList[0] ?? null) : (txList[0] ?? null);
            if (matchTx) break;
          }
        }
        setSuccessModal({ planName: storedPlanName, tx: matchTx });
        // Also refresh transaction list
        const txList = await billingService.getTransactions();
        setTransactions(txList);
      }
    });
  }, [search, navigate, billingSubView]);

  async function handleDowngradeClick(plan: Plan) {
    if (!currentPlan) return;
    const newLimit = plan.entitlements['locations']?.limit_value ?? 1;
    const { data: activeLocs } = await (await import('@/lib/supabase')).supabase
      .from('google_locations')
      .select('id')
      .eq('is_selected', true);
    const activeCount = activeLocs?.length ?? 0;
    if (activeCount > newLimit) {
      setDowngradePlan(plan);
    } else {
      setDowngradeMsg(`Downgrade to ${plan.name} requested. Billing management coming soon.`);
    }
  }

  async function handleOverageToggle() {
    if (!sub || overageToggling) return;
    const next = !overageProtection;
    setOverageToggling(true);
    setOverageProtection(next);
    await billingService.updateOverageProtection(sub.id, next);
    setSub(s => s ? { ...s, overage_protection: next } : s);
    setOverageToggling(false);
  }

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8">
        <div className="animate-pulse space-y-5">
          <div className="h-7 bg-[#F3F4F6] rounded w-48" />
          <div className="h-36 bg-[#F3F4F6] rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="h-40 bg-[#F3F4F6] rounded-2xl" />
            <div className="h-40 bg-[#F3F4F6] rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
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

  // Resolve effective limits (org override takes precedence; -1 = unlimited → null)
  function resolveLimit(overrideVal: number | null | undefined, planVal: number | null): number | null {
    if (overrideVal === -1) return null; // unlimited
    if (overrideVal != null) return overrideVal;
    return planVal;
  }
  const effectiveDraftsLimit = resolveLimit(orgOverride?.ai_drafts_per_month, usage?.ai_drafts_limit ?? null);
  const effectiveRepliesLimit = resolveLimit(orgOverride?.published_replies_per_month, usage?.published_replies_limit ?? null);
  const hasOverride = orgOverride !== null;

  // Usage alerts (use effective limits)
  const draftsAlertPct = usage && effectiveDraftsLimit ? Math.round((usage.ai_drafts_used / effectiveDraftsLimit) * 100) : 0;
  const repliesAlertPct = usage && effectiveRepliesLimit ? Math.round((usage.published_replies_used / effectiveRepliesLimit) * 100) : 0;
  const hasAlert = draftsAlertPct >= 80 || repliesAlertPct >= 80;
  const alertCritical = draftsAlertPct >= 90 || repliesAlertPct >= 90;

  // Team seats (org override takes precedence)
  const seatLimit = resolveLimit(orgOverride?.max_team_members, currentPlan?.entitlements['team_members']?.limit_value ?? null) ?? 1;

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[#F3F4F6]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#111827]/5 blur-3xl" aria-hidden="true"/>
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#111827]/4 blur-3xl" aria-hidden="true"/>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">

      {/* Modals */}
      {showCompare && (
        <PlanComparisonModal
          plans={plans}
          sub={sub}
          billingInterval={billingInterval}
          currentPlan={currentPlan ?? null}
          onDowngrade={handleDowngradeClick}
          onClose={() => setShowCompare(false)}
        />
      )}
      {showAddLocation && currentPlan && (
        <AddLocationDialog plan={currentPlan} onClose={() => setShowAddLocation(false)} />
      )}
      {downgradePlan && (
        <LocationSelectionModal
          newPlanName={downgradePlan.name}
          locationLimit={downgradePlan.entitlements['locations']?.limit_value ?? 1}
          onConfirm={async () => {
            setDowngradePlan(null);
            setDowngradeMsg(`Downgrade to ${downgradePlan.name} requested. Billing management coming soon.`);
          }}
          onCancel={() => setDowngradePlan(null)}
        />
      )}
      {downgradeMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#111827] mb-1">Locations updated</p>
            <p className="text-xs text-[#6B7280] mb-4">{downgradeMsg}</p>
            <button onClick={() => setDowngradeMsg(null)} className="px-5 py-2 text-xs font-semibold text-white bg-[#111827] rounded-xl hover:bg-[#6C55E8]">
              Done
            </button>
          </div>
        </div>
      )}
      {successModal && (
        <PaymentSuccessModal
          planName={successModal.planName}
          tx={successModal.tx}
          onClose={() => setSuccessModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">{billingSubView === 'billing' ? 'Billing' : 'Plan'}</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">{billingSubView === 'billing' ? 'View your payment history and invoices.' : 'Manage your subscription and track feature usage.'}</p>
        </div>
{billingSubView === 'plan' && (
        <button
          onClick={() => setShowCompare(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#374151] border border-[#E5E7EB] rounded-lg hover:border-[#6C55E8]/30 hover:text-[#6C55E8] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Compare all plans
        </button>
      )}
      </div>

      {billingSubView === 'plan' && (<>
      {/* Annual savings banner */}
      {annualSavings > 0 && (
        <div className="flex items-center justify-between px-1 py-2 mb-4">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-[#6C55E8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[#6C55E8]">
              <span className="font-bold">Switch to annual and save {cents(annualSavings)}/year</span>
              {' '}on your {currentPlan?.name} plan — that's {cents(annualSavings / 12)}/mo off.
            </p>
          </div>
          <button
            disabled
            className="flex-shrink-0 text-[11px] font-bold text-white bg-[#111827] px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
          >
            Switch — coming soon
          </button>
        </div>
      )}

      {/* Current plan + usage -- 2 equal columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        {/* Current plan card */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">

          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Current Plan</p>
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${planColor.bg}`}>
              <svg className={`w-4.5 h-4.5 ${planColor.text}`} style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-[#111827]">{sub?.plan_name ?? 'Free'}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isFree ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#EDE9FE] text-[#6C55E8]'}`}>
                  {isFree ? 'Free' : sub?.billing_interval === 'annual' ? 'Annual' : 'Monthly'}
                </span>
                {hasOverride && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FFF7ED] text-[#C2410C]">
                    Scale
                  </span>
                )}
              </div>
              <p className="text-xs text-[#4B5563] mt-0.5">{PLAN_DESCRIPTIONS[planSlug]}</p>
              {!isFree && currentPlan && (
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {orgOverride?.custom_price_cents
                    ? `${cents(orgOverride.custom_price_cents)}/mo · custom`
                    : currentPlan.contact_sales
                      ? 'Custom pricing · contact sales@moffu.com'
                      : sub?.billing_interval === 'annual'
                        ? `${cents(currentPlan.prices.find(p => p.interval === 'annual')?.amount_cents ?? 0)}/mo · billed annually`
                        : `${cents(currentPlan.prices.find(p => p.interval === 'monthly')?.amount_cents ?? 0)}/mo`}
                </p>
              )}
              {orgOverride?.contract_end && (
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                  Contract through {new Date(orgOverride.contract_end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
              <div className="h-full bg-[#111827] rounded-full" style={{ width: `${Math.min(100, Math.round((1 / (seatLimit || 1)) * 100))}%` }} />
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1">You (owner) · {seatLimit - 1} seat{seatLimit - 1 !== 1 ? 's' : ''} available</p>
          </div>
        </div>

        {/* Usage card */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">

          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Usage this period</p>
            {usage && (
              <span className="text-[10px] text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-md">{usage.reset_label}</span>
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
              <UsageMeter label="AI Drafts" used={usage.ai_drafts_used} limit={effectiveDraftsLimit} />
              <UsageMeter label="Published Replies" used={usage.published_replies_used} limit={effectiveRepliesLimit} />
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF]">No active subscription.</p>
          )}

          {/* Overage protection toggle */}
          <div className="border-t border-[#F3F4F6] mt-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#374151]">Overage protection</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                  {overageProtection
                    ? 'Actions blocked when limit is reached'
                    : 'Actions allowed beyond limit — charged per reply'}
                </p>
              </div>
              <button
                onClick={handleOverageToggle}
                disabled={overageToggling || !sub}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${overageToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${overageProtection ? 'bg-[#111827]' : 'bg-[#D1D5DB]'}`}
                aria-label="Toggle overage protection"
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${overageProtection ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            {(() => {
              const pricePerReply = sub ? billingService.getOveragePricePerReplyCents(sub, plans) : null;
              if (!overageProtection && pricePerReply !== null) {
                return (
                  <div className="mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[10px] text-amber-700">
                      Each reply over limit costs <strong>{cents(pricePerReply)}</strong> — charged via Stripe at period end.
                    </p>
                  </div>
                );
              }
              if (!overageProtection && pricePerReply === null) {
                return <p className="text-[10px] text-[#9CA3AF] mt-1">Overage pricing applies when Stripe is connected.</p>;
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Usage history + Add-ons -- 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        {/* Usage history chart */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">

          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Usage history · last 14 days</p>
          <UsageHistoryChart days={history} />
        </div>

        {/* Add-ons card */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">

          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Add-ons</p>

          {/* Active addon line items */}
          {sub && sub.addon_items.length > 0 ? (
            <div className="space-y-3 mb-4">
              {sub.addon_items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2.5 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
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
                      className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] px-2 py-0.5 rounded-md cursor-not-allowed opacity-50"
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
              className="w-full flex items-center justify-between px-4 py-3 border border-dashed border-[#6C55E8]/30 rounded-xl hover:bg-[#F9FAFB] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-[#374151] group-hover:text-[#6C55E8]">Add extra location</p>
                  <p className="text-[10px] text-[#9CA3AF]">{cents(currentPlan.location_addon_cents)}/mo per location</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6C55E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              {iv === 'annual' && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">—20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
        {plans.map(plan => {
          const isCurrent = plan.id === sub?.plan_id;
          const price = plan.prices.find(p => p.interval === billingInterval) ?? plan.prices.find(p => p.interval === 'monthly');
          const monthlyPrice = plan.prices.find(p => p.interval === 'monthly');
          const isScale = plan.slug === 'scale';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border transition-shadow ${
                isCurrent
                  ? 'border-[#6C55E8] ring-2 ring-[#6C55E8] bg-white shadow-sm'
                  : isScale
                  ? 'border-[#1C1917] bg-[#1C1917]'
                  : 'border-[#E5E7EB] bg-white hover:shadow-sm'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#111827] px-3 py-0.5 rounded whitespace-nowrap">Current plan</span>
                </div>
              )}
              {plan.is_featured && !isCurrent && (
                <div className="absolute -top-3 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold text-white bg-[#374151] px-3 py-0.5 rounded whitespace-nowrap">
                    {plan.badge_text || 'Most popular'}
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                <div className="mb-5">
                  <p className={`text-sm font-bold mb-1 ${isScale ? 'text-stone-100' : 'text-[#111827]'}`}>{plan.name}</p>
                  <p className={`text-xs leading-relaxed ${isScale ? 'text-stone-400' : 'text-[#6B7280]'}`}>{plan.description ?? PLAN_DESCRIPTIONS[plan.slug]}</p>
                </div>

                <div className="mb-6">
                  {plan.contact_sales ? (
                    <span className={`text-sm font-semibold ${isScale ? 'text-stone-300' : 'text-[#374151]'}`}>Custom pricing</span>
                  ) : price && price.amount_cents > 0 ? (
                    <>
                      {(() => {
                        const discountedCents = applyDiscount(price.amount_cents, plan.discount_type, plan.discount_value);
                        const hasDiscount = discountedCents < price.amount_cents;
                        return (
                          <>
                            {hasDiscount && (
                              <p className={`text-lg line-through mb-0.5 ${isScale ? 'text-stone-500' : 'text-[#9CA3AF]'}`}>
                                {cents(price.amount_cents)}/mo
                              </p>
                            )}
                            <div className="flex items-end gap-1">
                              <span className={`text-3xl font-bold ${isScale ? 'text-white' : 'text-[#111827]'}`}>{cents(discountedCents)}</span>
                              <span className={`text-sm mb-1 ${isScale ? 'text-stone-400' : 'text-[#9CA3AF]'}`}>/mo</span>
                              {hasDiscount && (
                                <span className="mb-1.5 ml-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {plan.discount_type === 'percent' ? `-${plan.discount_value}%` : `-${cents(Math.round((plan.discount_value ?? 0) * 100))}`}
                                </span>
                              )}
                            </div>
                            {billingInterval === 'annual' && monthlyPrice && price && (
                              <p className={`text-[11px] mt-1 ${isScale ? 'text-stone-400' : 'text-[#9CA3AF]'}`}>
                                Billed {cents(applyDiscount(price.amount_cents, plan.discount_type, plan.discount_value) * 12)}/yr
                                {monthlyPrice.amount_cents !== price.amount_cents && (
                                  <span className="ml-1.5 text-emerald-500 font-semibold">
                                    Save {cents((applyDiscount(monthlyPrice.amount_cents, plan.discount_type, plan.discount_value) - applyDiscount(price.amount_cents, plan.discount_type, plan.discount_value)) * 12)}/yr
                                  </span>
                                )}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <span className={`text-3xl font-bold ${isScale ? 'text-white' : 'text-[#111827]'}`}>Free</span>
                  )}
                </div>

                <div className={`border-t mb-5 ${isScale ? 'border-stone-700' : 'border-[#F3F4F6]'}`} />

                <ul className="space-y-2.5 text-xs flex-1 mb-6">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isScale ? 'text-emerald-400' : 'text-[#6C55E8]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={isScale ? 'text-stone-300' : 'text-[#374151]'}>{feat}</span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  const currentSortOrder = currentPlan?.sort_order ?? 0;
                  const isDowngrade = !isCurrent && plan.sort_order < currentSortOrder;
                  const isUpgrade = !isCurrent && plan.sort_order > currentSortOrder;
                  if (isScale) return (
                    <button disabled className="w-full py-2.5 text-xs font-semibold rounded-xl cursor-not-allowed bg-stone-700 text-stone-400">
                      Coming soon
                    </button>
                  );
                  if (isCurrent) return (
                    <button disabled className="w-full py-2.5 text-xs font-semibold rounded-xl cursor-default border border-[#E5E7EB] text-[#9CA3AF]">
                      Current plan
                    </button>
                  );
                  if (isDowngrade) return (
                    <button onClick={() => handleDowngradeClick(plan)} className="w-full py-2.5 text-xs font-semibold text-[#374151] border border-[#E5E7EB] rounded-xl hover:bg-[#F3F4F6] transition-colors">
                      Downgrade
                    </button>
                  );
                  if (plan.contact_sales) return (
                    <a href="mailto:sales@moffu.com" className="w-full py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center bg-[#111827] text-white hover:bg-[#6C55E8] transition-colors">
                      Contact Sales Team
                    </a>
                  );
                  if (isUpgrade) {
                    const price = plan.prices.find(p => p.interval === billingInterval) ?? plan.prices.find(p => p.interval === 'monthly');
                    const paddlePriceId = price?.paddle_price_id ?? null;
                    if (!paddlePriceId) return (
                      <button disabled className="w-full py-2.5 text-xs font-semibold rounded-xl cursor-not-allowed opacity-50 bg-[#111827] text-white">
                        Upgrade
                      </button>
                    );
                    return (
                      <button
                        onClick={() => openPaddleCheckout(paddlePriceId, plan.slug, plan.name)}
                        disabled={checkoutLoading === plan.slug}
                        className="w-full py-2.5 text-xs font-semibold rounded-xl bg-[#6C55E8] text-white hover:bg-[#5A42D1] disabled:opacity-60 transition-colors"
                      >
                        {checkoutLoading === plan.slug ? 'Loading…' : 'Upgrade'}
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          );
        })}
      </div>

      </>)}

            {/* Billing view */}
      {billingSubView === 'billing' && (
        <div className="space-y-6">

          {/* Current plan summary */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Current Plan</p>
            {loading ? (
              <div className="animate-pulse h-10 bg-[#F3F4F6] rounded-lg" />
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${planColor.bg} ${planColor.text}`}>
                    {(currentPlan?.name ?? 'Free').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      {isFree ? 'Free plan' : (
                        sub?.billing_interval === 'annual'
                          ? `$${((currentPlan?.prices.find(p => p.interval === "annual")?.amount_cents ?? 0) / 100).toFixed(0)}/mo (billed annually)`
                          : `$${((currentPlan?.prices.find(p => p.interval === "monthly")?.amount_cents ?? 0) / 100).toFixed(0)}/mo`
                      )}
                    </p>
                    {!isFree && sub?.current_period_end && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        Next billing: {new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <a href="/plan" className="text-xs font-semibold text-[#6C55E8] hover:underline">
                  Manage Plan
                </a>
              </div>
            )}
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#111827]">Transaction History</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Your past payments and invoices</p>
              </div>
              {txLoading && <div className="w-4 h-4 border-2 border-[#E5E7EB] border-t-[#6C55E8] rounded-full animate-spin" />}
            </div>

            {transactions.length > 0 ? (
              <>
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Description</p>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Amount</p>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Status</p>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide text-right">Receipt</p>
                </div>
                {transactions.map(tx => (
                  <div key={tx.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-4 px-5 py-4 border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFAFA]">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{tx.plan_name ?? 'Moffu Plan'}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {tx.billing_interval && <span className="ml-2 capitalize">{tx.billing_interval}</span>}
                      </p>
                      <p className="text-[10px] font-mono text-[#D1D5DB] mt-0.5">{tx.paddle_transaction_id.slice(0, 20)}…</p>
                    </div>
                    <div className="text-sm font-semibold text-[#111827] md:text-right self-center">
                      ${(tx.amount_cents / 100).toFixed(2)}
                    </div>
                    <div className="self-center md:justify-self-end">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Paid
                      </span>
                    </div>
                    <div className="self-center md:justify-self-end">
                      <button
                        onClick={() => downloadReceipt(tx)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#6C55E8] hover:text-[#5A42D1]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : !loading && !txLoading ? (
              <div className="px-5 py-12 text-center">
                <svg className="w-9 h-9 mx-auto mb-3 text-[#E5E7EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                <p className="text-sm font-semibold text-[#374151] mb-1">No transactions yet</p>
                <p className="text-xs text-[#9CA3AF]">Your payment history will appear here after your first payment.</p>
              </div>
            ) : (
              <div className="px-5 py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#6C55E8] rounded-full animate-spin" />
              </div>
            )}
          </div>

        </div>
      )}
      </div>{/* end scrollable */}
    </div>
  );
}

