import { useState } from 'react';

interface AutoRule {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  badge?: string;
}

const DEFAULT_RULES: AutoRule[] = [
  {
    id: 'auto_logo_on_signup',
    title: 'Auto-assign logo on signup',
    description: 'When a new client signs up, attempt to fetch their logo from Clearbit using their domain. Falls back to initials avatar.',
    enabled: false,
    badge: 'Coming soon',
  },
  {
    id: 'auto_plan_on_trial_end',
    title: 'Auto-downgrade on trial expiry',
    description: 'Automatically move a client to the Free plan when their trial period ends and no payment method is on file.',
    enabled: true,
  },
  {
    id: 'auto_suspend_on_failed_payment',
    title: 'Suspend on repeated payment failure',
    description: 'Suspend a client account after 3 consecutive failed billing attempts. Sends a notification email before suspension.',
    enabled: true,
  },
  {
    id: 'auto_notify_usage_limit',
    title: 'Notify clients near usage limit',
    description: 'Send an in-app + email nudge when a client reaches 80% of their monthly AI draft quota.',
    enabled: false,
    badge: 'Coming soon',
  },
  {
    id: 'auto_package_sync',
    title: 'Sync plan features on upgrade',
    description: 'Immediately unlock higher-tier features when a client upgrades their plan — no manual intervention required.',
    enabled: true,
  },
];

function RuleRow({ rule, onToggle }: { rule: AutoRule; onToggle: (id: string) => void }) {
  const isComingSoon = !!rule.badge;
  return (
    <div className="flex items-start gap-4 py-5 border-b border-[#F3F4F6] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-[#111827]">{rule.title}</p>
          {rule.badge && (
            <span className="text-[10px] font-black text-[#9CA3AF] bg-[#F3F4F6] border border-[#E5E7EB] px-2 py-0.5 rounded">
              {rule.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280] leading-relaxed">{rule.description}</p>
      </div>
      <button
        onClick={() => !isComingSoon && onToggle(rule.id)}
        disabled={isComingSoon}
        aria-label={rule.enabled ? 'Disable' : 'Enable'}
        className={`flex-shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none mt-0.5 ${
          isComingSoon ? 'opacity-40 cursor-not-allowed' :
          rule.enabled ? 'bg-[#0D4C3C]' : 'bg-[#D1D5DB]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function WebsiteAutomationPage() {
  const [rules, setRules] = useState<AutoRule[]>(DEFAULT_RULES);

  function toggleRule(id: string) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  const enabledCount = rules.filter(r => r.enabled && !r.badge).length;

  return (
    <div className="px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Automation</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Configure automatic platform behaviours triggered by client events.</p>
        </div>
        <span className="text-xs font-semibold text-[#0D4C3C] bg-[#F0F7F4] border border-[#D1FAE5] px-2.5 py-1 rounded-lg">
          {enabledCount} active
        </span>
      </div>

      {/* Rules list */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] px-6 mb-8">
        {rules.map(rule => (
          <RuleRow key={rule.id} rule={rule} onToggle={toggleRule} />
        ))}
      </div>

      {/* Info callout */}
      <div className="flex gap-3 bg-[#F8FAF9] border border-[#E5E7EB] rounded-xl px-5 py-4">
        <svg className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-[#6B7280] leading-relaxed">
          Automation rules run server-side via scheduled Edge Functions. Changes take effect within the next billing cycle check.
          Rules marked <span className="font-semibold text-[#9CA3AF]">Coming soon</span> are under development and cannot be enabled yet.
        </p>
      </div>
    </div>
  );
}
