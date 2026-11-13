import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

type Provider = 'groq' | 'anthropic' | 'gemini' | 'openai';
type InternalTab = 'dashboard' | Provider;

interface AISetting {
  id: string;
  provider: Provider;
  label: string;
  api_key: string;
  model: string;
  is_active: boolean;
}

interface ModelOption { id: string; label: string; tag?: string; }

const PROVIDER_META: Record<Provider, {
  name: string;
  docsUrl: string;
  defaultModel: string;
  modelOptions: ModelOption[];
  color: string;
  textColor: string;
  description: string;
  freeTier?: { label: string; reqPerDay: number; };
}> = {
  groq: {
    name: 'Groq',
    docsUrl: 'https://console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-20b',
    modelOptions: [
      { id: 'openai/gpt-oss-20b',  label: 'GPT-OSS 20B',  tag: '1000 t/s' },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', tag: 'powerful' },
      { id: 'qwen/qwen3.8-27b',    label: 'Qwen 3.8 27B' },
    ],
    color: '#F97316',
    textColor: '#fff',
    description: 'Fast inference. Requires Groq credits.',
  },
  anthropic: {
    name: 'Anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-5-5',
    modelOptions: [
      { id: 'claude-haiku-5-5',  label: 'Claude Haiku 5.5',  tag: 'fast, cheap' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-opus-5-5',   label: 'Claude Opus 5.5',   tag: 'most capable' },
    ],
    color: '#CC785C',
    textColor: '#fff',
    description: 'Claude models. High quality replies.',
  },
  gemini: {
    name: 'Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-3.8-flash',
    modelOptions: [
      { id: 'gemini-3.8-flash',      label: 'Gemini 3.8 Flash',      tag: 'recommended' },
      { id: 'gemini-3.6-flash',      label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', tag: 'fastest' },
    ],
    color: '#4285F4',
    textColor: '#fff',
    description: 'Google AI. Free quota, no billing needed.',
    freeTier: { label: '1,500 requests/day free', reqPerDay: 1500 },
  },
  openai: {
    name: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    modelOptions: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tag: 'fast, cheap' },
      { id: 'gpt-4o',      label: 'GPT-4o' },
    ],
    color: '#10A37F',
    textColor: '#fff',
    description: 'GPT models. Industry standard.',
  },
};

const PROVIDERS: Provider[] = ['gemini', 'openai', 'groq', 'anthropic'];

interface DailyBucket  { date: string; calls: number; errors: number; tokens: number; }
interface FnBucket     { name: string; calls: number; tokens: number; errors: number; }
interface UsageData {
  callsToday: number; calls7d: number; calls30d: number; errors30d: number;
  tokensToday: number; tokens30d: number;
  dailyTrend: DailyBucket[];
  byFunction: FnBucket[];
  recentErrors: { created_at: string; function_name: string; error_code: string; provider: string; model: string; }[];
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

function ProviderDot({ provider }: { provider: Provider }) {
  const m = PROVIDER_META[provider];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ backgroundColor: m.color, color: m.textColor }}>
      {m.name[0]}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <p className="text-xs font-medium text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#111827] leading-tight">{value}</p>
      {sub && <p className="text-xs text-[#6B7280] mt-0.5">{sub}</p>}
    </div>
  );
}

function TrendChart({ data }: { data: DailyBucket[] }) {
  const maxCalls = Math.max(...data.map(d => d.calls), 1);
  const W = 580, H = 80;
  const barW = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.calls / maxCalls) * (H - 6));
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        return (
          <rect key={d.date} x={x} y={H - h} width={w} height={h} rx={2}
            fill={d.errors > 0 ? '#FCA5A5' : '#6C55E8'}
            opacity={d.calls === 0 ? 0.15 : 0.75} />
        );
      })}
    </svg>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ usage, loading, tableExists, activeProvider }: {
  usage: UsageData | null;
  loading: boolean;
  tableExists: boolean;
  activeProvider?: AISetting;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-16 justify-center">
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Loading usage data…
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[#374151] mb-1">Usage Tracking Not Active</h3>
        <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
          Token usage will appear here once the edge functions start logging calls to the ai_token_usage table.
        </p>
      </div>
    );
  }

  if (!usage) return null;
  const hasData = usage.calls30d > 0;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Calls Today"        value={usage.callsToday.toLocaleString()} sub={`${usage.tokensToday.toLocaleString()} tokens`} />
        <KpiCard label="Calls Last 7 Days"  value={usage.calls7d.toLocaleString()} />
        <KpiCard label="Calls Last 30 Days" value={usage.calls30d.toLocaleString()} sub={`${usage.tokens30d.toLocaleString()} tokens`} />
        <KpiCard label="Errors (30 days)"   value={usage.errors30d.toLocaleString()}
          {...(usage.calls30d > 0 ? { sub: `${((usage.errors30d / usage.calls30d) * 100).toFixed(1)}% error rate` } : {})} />
      </div>

      {/* Free-tier limit bar */}
      {activeProvider && PROVIDER_META[activeProvider.provider].freeTier && (() => {
        const ft = PROVIDER_META[activeProvider.provider].freeTier!;
        const pct = Math.min(100, (usage.callsToday / ft.reqPerDay) * 100);
        const barColor = pct > 80 ? '#DC2626' : pct > 50 ? '#F59E0B' : '#6C55E8';
        return (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#374151]">{PROVIDER_META[activeProvider.provider].name} Free Tier Today</p>
              <span className="text-xs text-[#9CA3AF]">{ft.label}</span>
            </div>
            <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1.5 flex items-center gap-2">
              <span>{usage.callsToday.toLocaleString()} / {ft.reqPerDay.toLocaleString()} requests</span>
              {pct > 80 && <span className="font-semibold text-[#DC2626]">Near limit</span>}
            </p>
          </div>
        );
      })()}

      {/* Trend chart */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#374151]">Daily Calls (30 days)</p>
          <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block bg-[#6C55E8]" /> Success
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block bg-[#FCA5A5]" /> Errors
            </span>
          </div>
        </div>
        {hasData ? (
          <TrendChart data={usage.dailyTrend} />
        ) : (
          <div className="h-20 flex items-center justify-center text-xs text-[#D1D5DB]">No calls recorded yet</div>
        )}
        <div className="flex items-center justify-between mt-1 text-[10px] text-[#D1D5DB]">
          <span>{usage.dailyTrend[0]?.date.slice(5)}</span>
          <span>{usage.dailyTrend[usage.dailyTrend.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      {/* Per-function breakdown */}
      {usage.byFunction.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F3F4F6]">
            <p className="text-xs font-semibold text-[#374151]">By Feature</p>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {usage.byFunction.map(fn => (
              <div key={fn.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-6 h-6 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#374151] truncate">{fn.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{fn.tokens.toLocaleString()} tokens</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-[#111827]">{fn.calls.toLocaleString()}</p>
                  <p className="text-[11px] text-[#9CA3AF]">calls</p>
                </div>
                {fn.errors > 0 && (
                  <span className="text-[11px] font-medium text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded-lg">
                    {fn.errors} err
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent errors */}
      {usage.recentErrors.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F3F4F6]">
            <p className="text-xs font-semibold text-[#374151]">Recent Errors</p>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {usage.recentErrors.slice(0, 8).map((err, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[11px] font-semibold text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.5 rounded-md flex-shrink-0">
                  {err.error_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#374151] truncate">{err.function_name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{err.provider} / {err.model}</p>
                </div>
                <span className="text-[11px] text-[#D1D5DB] flex-shrink-0">
                  {new Date(err.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <p className="text-center text-xs text-[#D1D5DB] py-6">No AI calls recorded in the last 30 days.</p>
      )}
    </div>
  );
}

// ── Provider Tab ──────────────────────────────────────────────────────────────

function ProviderTab({
  provider, setting, form, onFormChange,
  showKey, onToggleShowKey,
  saving, activating, deleting,
  onSave, onActivate, onDelete,
}: {
  provider: Provider;
  setting?: AISetting;
  form: { apiKey: string; model: string };
  onFormChange: (field: 'apiKey' | 'model', value: string) => void;
  showKey: boolean;
  onToggleShowKey: () => void;
  saving: boolean; activating: boolean; deleting: boolean;
  onSave: () => void; onActivate: () => void; onDelete: () => void;
}) {
  const meta = PROVIDER_META[provider];
  const isConfigured = !!setting;
  const isActive = setting?.is_active ?? false;

  return (
    <div className="space-y-4">
      {/* Provider header */}
      <div className={`flex items-center gap-4 p-5 rounded-xl border ${
        isActive ? 'bg-[#E0F2FE]/40 border-[#BAE6FD]' : 'bg-[#FAFAFA] border-[#E5E7EB]'
      }`}>
        <ProviderDot provider={provider} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#111827]">{meta.name}</span>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" /> Active
              </span>
            )}
            {isConfigured && !isActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" /> Configured
              </span>
            )}
            {!isConfigured && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]">
                Not set up
              </span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{meta.description}</p>
          {meta.freeTier && (
            <p className="text-xs font-medium text-[#6B7280] mt-0.5">{meta.freeTier.label}</p>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <label className="text-xs font-semibold text-[#374151] mb-2 block">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={e => onFormChange('apiKey', e.target.value)}
            placeholder={isConfigured ? 'Key saved. Enter a new one to replace.' : 'Paste your API key here'}
            className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm text-[#111827] placeholder-[#D1D5DB] focus:outline-none focus:border-[#6C55E8] focus:ring-1 focus:ring-[#6C55E8]/20 pr-10 font-mono"
          />
          <button type="button" onClick={onToggleShowKey}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D1D5DB] hover:text-[#6B7280] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showKey
                ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"
                : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
            </svg>
          </button>
        </div>
        <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#6C55E8] hover:underline mt-2 inline-flex items-center gap-1">
          Get API key from {meta.name}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Model selection */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <label className="text-xs font-semibold text-[#374151] mb-3 block">Model</label>
        <div className="space-y-2">
          {meta.modelOptions.map(opt => (
            <button key={opt.id} onClick={() => onFormChange('model', opt.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg border text-left transition-all ${
                form.model === opt.id
                  ? 'border-[#6C55E8] bg-[#6C55E8]/5'
                  : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#FAFAFA]'
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                form.model === opt.id ? 'border-[#6C55E8]' : 'border-[#D1D5DB]'
              }`}>
                {form.model === opt.id && <div className="w-2 h-2 rounded-full bg-[#6C55E8]" />}
              </div>
              <span className={`text-sm flex-1 ${form.model === opt.id ? 'text-[#111827] font-medium' : 'text-[#374151]'}`}>
                {opt.label}
              </span>
              {opt.tag && (
                <span className="text-[11px] text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-lg flex-shrink-0">
                  {opt.tag}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onSave}
          disabled={saving || (!form.apiKey.trim() && !isConfigured)}
          className="flex-1 bg-[#111111] hover:bg-[#6C55E8] disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          {saving ? 'Saving…' : isConfigured ? 'Save Changes' : 'Add Provider'}
        </button>
        {isConfigured && !isActive && (
          <button onClick={onActivate} disabled={activating}
            className="px-4 py-2.5 text-sm font-medium text-[#0369A1] bg-[#E0F2FE] hover:bg-[#BAE6FD] rounded-lg transition-colors border border-[#BAE6FD] disabled:opacity-50">
            {activating ? 'Activating…' : 'Set Active'}
          </button>
        )}
        {isConfigured && (
          <button onClick={onDelete} disabled={deleting || isActive}
            title={isActive ? 'Switch to another provider first' : 'Remove provider'}
            className="px-4 py-2.5 text-sm font-medium text-[#DC2626] bg-white border border-[#FEE2E2] hover:bg-[#FEF2F2] rounded-lg transition-colors disabled:opacity-30">
            {deleting ? '…' : 'Remove'}
          </button>
        )}
      </div>
      {isActive && isConfigured && (
        <p className="text-xs text-[#9CA3AF] text-center">Switch to another provider before removing this one.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AISettingsPage() {
  const [activeTab, setActiveTab] = useState<InternalTab>('dashboard');
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [activating, setActivating] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const toast = useToastStore();

  const [forms, setForms] = useState<Record<Provider, { apiKey: string; model: string }>>({
    gemini:    { apiKey: '', model: PROVIDER_META.gemini.defaultModel },
    openai:    { apiKey: '', model: PROVIDER_META.openai.defaultModel },
    groq:      { apiKey: '', model: PROVIDER_META.groq.defaultModel },
    anthropic: { apiKey: '', model: PROVIDER_META.anthropic.defaultModel },
  });
  const [showKey, setShowKey] = useState<Provider | null>(null);

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageTableExists, setUsageTableExists] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (activeTab === 'dashboard') loadUsage(); }, [activeTab]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ai_settings').select('*').order('created_at');
    const rows = (data as AISetting[]) ?? [];
    setSettings(rows);
    setForms(prev => {
      const updated = { ...prev };
      rows.forEach(s => { updated[s.provider] = { apiKey: s.api_key, model: s.model }; });
      return updated;
    });
    setLoading(false);
  }

  async function loadUsage() {
    setUsageLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('ai_token_usage')
        .select('created_at, function_name, provider, model, total_tokens, error_code')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) { setUsageTableExists(false); setUsageLoading(false); return; }

      const rows = data ?? [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const callsToday  = rows.filter(r => new Date(r.created_at) >= today).length;
      const calls7d     = rows.filter(r => new Date(r.created_at) >= sevenDaysAgo).length;
      const calls30d    = rows.length;
      const errors30d   = rows.filter(r => r.error_code).length;
      const tokensToday = rows.filter(r => new Date(r.created_at) >= today).reduce((s, r) => s + (r.total_tokens || 0), 0);
      const tokens30d   = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);

      const dailyMap = new Map<string, DailyBucket>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, { date: key, calls: 0, errors: 0, tokens: 0 });
      }
      rows.forEach(r => {
        const b = dailyMap.get(r.created_at.slice(0, 10));
        if (b) { b.calls++; if (r.error_code) b.errors++; b.tokens += r.total_tokens || 0; }
      });
      const dailyTrend = Array.from(dailyMap.values());

      const fnMap = new Map<string, FnBucket>();
      rows.forEach(r => {
        const b = fnMap.get(r.function_name) || { name: r.function_name, calls: 0, tokens: 0, errors: 0 };
        b.calls++; b.tokens += r.total_tokens || 0; if (r.error_code) b.errors++;
        fnMap.set(r.function_name, b);
      });
      const byFunction = Array.from(fnMap.values()).sort((a, b) => b.calls - a.calls);

      const recentErrors = rows
        .filter(r => r.error_code)
        .slice(0, 20)
        .map(r => ({ created_at: r.created_at, function_name: r.function_name, error_code: r.error_code!, provider: r.provider, model: r.model }));

      setUsage({ callsToday, calls7d, calls30d, errors30d, tokensToday, tokens30d, dailyTrend, byFunction, recentErrors });
      setUsageTableExists(true);
    } catch { setUsageTableExists(false); }
    setUsageLoading(false);
  }

  async function handleSave(provider: Provider) {
    setSaving(provider);
    const existing = settings.find(s => s.provider === provider);
    const form = forms[provider];
    if (!form.apiKey.trim() && !existing) { setSaving(null); return; }

    const payload: Partial<AISetting> & { provider: Provider; label: string } = {
      provider,
      label: PROVIDER_META[provider].name,
      model: form.model,
    };
    if (form.apiKey.trim()) (payload as Record<string, unknown>).api_key = form.apiKey.trim();

    let error;
    const noActiveExists = !settings.some(s => s.is_active);
    if (existing) {
      ({ error } = await supabase.from('ai_settings').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('ai_settings').insert({
        ...payload,
        api_key: form.apiKey.trim(),
        is_active: noActiveExists,
      }));
    }
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(existing ? 'Saved.' : `${PROVIDER_META[provider].name} added${noActiveExists ? ' and set as active' : ''}.`);
    load();
  }

  async function handleActivate(provider: Provider) {
    const s = settings.find(s => s.provider === provider);
    if (!s) return;
    setActivating(provider);
    const activeIds = settings.filter(s => s.is_active).map(s => s.id);
    if (activeIds.length > 0) {
      await supabase.from('ai_settings').update({ is_active: false }).in('id', activeIds);
    }
    const { error } = await supabase.from('ai_settings').update({ is_active: true }).eq('id', s.id);
    setActivating(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${PROVIDER_META[provider].name} is now active.`);
    load();
  }

  async function handleDelete(provider: Provider) {
    const s = settings.find(s => s.provider === provider);
    if (!s || s.is_active) return;
    setDeleting(provider);
    const { error } = await supabase.from('ai_settings').delete().eq('id', s.id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Provider removed.');
    setForms(prev => ({ ...prev, [provider]: { apiKey: '', model: PROVIDER_META[provider].defaultModel } }));
    load();
  }

  const settingByProvider = Object.fromEntries(settings.map(s => [s.provider, s])) as Partial<Record<Provider, AISetting>>;
  const activeProvider = settings.find(s => s.is_active);

  const TABS_CONFIG: { id: InternalTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    ...PROVIDERS.map(p => ({ id: p as InternalTab, label: PROVIDER_META[p].name })),
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-semibold text-[#111827] tracking-tight">AI Keys</h1>
            <p className="text-sm text-[#6B7280] mt-1">Manage AI provider keys and monitor token usage.</p>
          </div>
          {activeProvider && !loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E0F2FE] rounded-xl border border-[#BAE6FD]">
              <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
              <span className="text-xs font-semibold text-[#0369A1]">
                {PROVIDER_META[activeProvider.provider].name} active
              </span>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-xl mb-6">
          {TABS_CONFIG.map(tab => {
            const setting = tab.id !== 'dashboard' ? settingByProvider[tab.id as Provider] : undefined;
            const color   = tab.id !== 'dashboard' ? PROVIDER_META[tab.id as Provider]?.color : undefined;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#374151]'
                }`}>
                {tab.id !== 'dashboard' && setting && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: setting.is_active ? '#0EA5E9' : color }} />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-16 justify-center">
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Loading…
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab usage={usage} loading={usageLoading} tableExists={usageTableExists} {...(activeProvider ? { activeProvider } : {})} />
            )}
            {activeTab !== 'dashboard' && (
              <ProviderTab
                provider={activeTab as Provider}
                {...(settingByProvider[activeTab as Provider] ? { setting: settingByProvider[activeTab as Provider] } : {})}
                form={forms[activeTab as Provider]}
                onFormChange={(field, value) =>
                  setForms(prev => ({ ...prev, [activeTab]: { ...prev[activeTab as Provider], [field]: value } }))
                }
                showKey={showKey === activeTab}
                onToggleShowKey={() => setShowKey(prev => prev === activeTab ? null : activeTab as Provider)}
                saving={saving === activeTab}
                activating={activating === activeTab}
                deleting={deleting === activeTab}
                onSave={() => handleSave(activeTab as Provider)}
                onActivate={() => handleActivate(activeTab as Provider)}
                onDelete={() => handleDelete(activeTab as Provider)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
