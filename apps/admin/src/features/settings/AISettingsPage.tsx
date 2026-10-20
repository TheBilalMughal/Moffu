import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Provider = 'groq' | 'anthropic' | 'gemini' | 'openai';

interface AISetting {
  id: string;
  provider: Provider;
  label: string;
  api_key: string;
  model: string;
  is_active: boolean;
}

interface ModelOption { id: string; label: string; }

const PROVIDER_META: Record<Provider, {
  name: string;
  docsUrl: string;
  defaultModel: string;
  modelOptions: ModelOption[];
  color: string;
  textColor: string;
  description: string;
}> = {
  groq: {
    name: 'Groq',
    docsUrl: 'https://console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-20b',
    modelOptions: [
      { id: 'openai/gpt-oss-20b',   label: 'GPT-OSS 20B  (1000 t/s)' },
      { id: 'openai/gpt-oss-120b',  label: 'GPT-OSS 120B  (powerful)' },
      { id: 'qwen/qwen3.8-27b',     label: 'Qwen 3.8 27B' },
    ],
    color: '#F97316',
    textColor: '#fff',
    description: 'Fast inference — requires Groq credits',
  },
  anthropic: {
    name: 'Anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-5-5',
    modelOptions: [
      { id: 'claude-haiku-5-5',   label: 'Claude Haiku 5.5  (fast · cheap)' },
      { id: 'claude-sonnet-5-5',  label: 'Claude Sonnet 5.5' },
      { id: 'claude-opus-5-5',    label: 'Claude Opus 5.5  (most capable)' },
    ],
    color: '#CC785C',
    textColor: '#fff',
    description: 'Claude models — high quality replies',
  },
  gemini: {
    name: 'Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-3.8-flash',
    modelOptions: [
      { id: 'gemini-3.8-flash',      label: 'Gemini 3.8 Flash  (recommended · free)' },
      { id: 'gemini-3.6-flash',      label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite  (fastest · free)' },
    ],
    color: '#4285F4',
    textColor: '#fff',
    description: 'Google AI — free quota, no billing needed',
  },
  openai: {
    name: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    modelOptions: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini  (fast · cheap)' },
      { id: 'gpt-4o',      label: 'GPT-4o' },
    ],
    color: '#10A37F',
    textColor: '#fff',
    description: 'GPT models — industry standard',
  },
};

const PROVIDERS: Provider[] = ['groq', 'anthropic', 'gemini', 'openai'];

function ProviderInitial({ provider, size = 'md' }: { provider: Provider; size?: 'sm' | 'md' | 'lg' }) {
  const meta = PROVIDER_META[provider];
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${sz} rounded-xl flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: meta.color, color: meta.textColor }}
    >
      {meta.name[0]}
    </div>
  );
}

export function AISettingsPage() {
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState<{ provider: Provider; apiKey: string; model: string } | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ai_settings').select('*').order('created_at');
    setSettings((data as AISetting[]) ?? []);
    setLoading(false);
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openAdd(provider: Provider) {
    setForm({ provider, apiKey: '', model: PROVIDER_META[provider].defaultModel });
  }

  function openEdit(s: AISetting) {
    setForm({ provider: s.provider, apiKey: s.api_key, model: s.model });
  }

  async function handleSave() {
    if (!form) return;
    setSaving(form.provider);
    const existing = settings.find(s => s.provider === form.provider);
    const payload = {
      provider: form.provider,
      label: PROVIDER_META[form.provider].name,
      api_key: form.apiKey.trim(),
      model: form.model,
    };
    let error;
    if (existing) {
      ({ error } = await supabase.from('ai_settings').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('ai_settings').insert(payload));
    }
    setSaving(null);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Saved successfully.', 'success');
    setForm(null);
    load();
  }

  async function handleActivate(id: string) {
    setActivating(id);
    const { error } = await supabase.from('ai_settings').update({ is_active: true }).eq('id', id);
    setActivating(null);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Provider activated.', 'success');
    load();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const { error } = await supabase.from('ai_settings').delete().eq('id', id);
    setDeleting(null);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Provider removed.', 'success');
    load();
  }

  const configuredProviders = new Set(settings.map(s => s.provider));
  const activeProvider = settings.find(s => s.is_active);
  const configured = settings.filter(s => configuredProviders.has(s.provider));
  const unconfigured = PROVIDERS.filter(p => !configuredProviders.has(p));

  return (
    <div className="h-full overflow-y-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === 'success'
            ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
            : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
        }`} style={{ animation: 'slideDown 0.2s ease' }}>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {toast.type === 'success'
            ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          }
          {toast.message}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-[22px] font-semibold text-[#111827] tracking-tight">AI Keys</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Connect an AI provider to power draft generation. Only one provider is active at a time.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-8">
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Loading providers…
          </div>
        ) : (
          <>
            {/* Active provider banner */}
            {activeProvider && (
              <div className="flex items-center gap-4 px-5 py-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl">
                <ProviderInitial provider={activeProvider.provider} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827]">{PROVIDER_META[activeProvider.provider].name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5 truncate">Model: {activeProvider.model}</p>
                </div>
                <button
                  onClick={() => openEdit(activeProvider)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#D1FAE5] bg-white text-[#059669] hover:bg-[#F0FDF4] transition-colors font-medium"
                >
                  Edit
                </button>
              </div>
            )}

            {/* Configured providers */}
            {configured.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Configured</h2>
                <div className="space-y-2">
                  {configured.map(s => {
                    const meta = PROVIDER_META[s.provider];
                    const isActive = s.is_active;
                    const masked = s.api_key.slice(0, 10) + '••••••••••••••••••';
                    return (
                      <div key={s.id} className={`flex items-center gap-4 px-5 py-4 rounded-xl border bg-white transition-all ${
                        isActive ? 'border-[#BBF7D0]' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                      }`}>
                        <ProviderInitial provider={s.provider} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#111827]">{meta.name}</span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-[#9CA3AF] font-mono">
                              {showKey === s.id ? s.api_key : masked}
                            </span>
                            <button
                              onClick={() => setShowKey(showKey === s.id ? null : s.id)}
                              className="text-[#D1D5DB] hover:text-[#6B7280] transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showKey === s.id
                                  ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"
                                  : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-[#9CA3AF] mt-0.5">Model: {s.model}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => handleActivate(s.id)}
                              disabled={activating === s.id}
                              className="text-xs px-3 py-1.5 rounded-lg border border-[#D1FAE5] bg-[#F0FDF4] text-[#059669] hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors font-medium"
                            >
                              {activating === s.id ? 'Activating…' : 'Set Active'}
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting === s.id || isActive}
                            title={isActive ? 'Deactivate before removing' : 'Remove'}
                            className="text-xs px-3 py-1.5 rounded-lg border border-[#FEE2E2] bg-white text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-30 transition-colors"
                          >
                            {deleting === s.id ? '…' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add providers */}
            {unconfigured.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">
                  {configured.length > 0 ? 'Add Another' : 'Choose a Provider'}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {unconfigured.map(provider => {
                    const meta = PROVIDER_META[provider];
                    return (
                      <button
                        key={provider}
                        onClick={() => openAdd(provider)}
                        className="flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB] transition-all text-left group"
                      >
                        <ProviderInitial provider={provider} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#111827]">{meta.name}</p>
                          <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">{meta.description}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {configured.length === 0 && (
              <div className="text-center py-4 text-sm text-[#9CA3AF]">
                Select a provider above to get started. Groq is free with no credit card required.
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-[#F3F4F6]">
              <ProviderInitial provider={form.provider} size="sm" />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-[#111827]">
                  {configuredProviders.has(form.provider) ? 'Edit' : 'Add'} {PROVIDER_META[form.provider].name}
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{PROVIDER_META[form.provider].description}</p>
              </div>
              <button onClick={() => setForm(null)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* API Key */}
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1.5 block">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => f && ({ ...f, apiKey: e.target.value }))}
                  placeholder="Paste your API key here"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm text-[#111827] placeholder-[#D1D5DB] focus:outline-none focus:border-[#0D4C3C] focus:ring-1 focus:ring-[#0D4C3C]/20 transition-colors"
                  autoFocus
                />
                <a
                  href={PROVIDER_META[form.provider].docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#0D4C3C] hover:underline mt-1.5 inline-flex items-center gap-1"
                >
                  Get API key from {PROVIDER_META[form.provider].name}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              {/* Model */}
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1.5 block">Model</label>
                <select
                  value={form.model}
                  onChange={e => setForm(f => f && ({ ...f, model: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#0D4C3C] focus:ring-1 focus:ring-[#0D4C3C]/20 bg-white transition-colors"
                >
                  {PROVIDER_META[form.provider].modelOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-3 px-6 pb-6">
              <button
                onClick={handleSave}
                disabled={!form.apiKey.trim() || saving === form.provider}
                className="flex-1 bg-[#0D4C3C] hover:bg-[#0a3d30] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving === form.provider ? 'Saving…' : 'Save Provider'}
              </button>
              <button
                onClick={() => setForm(null)}
                className="px-5 py-2.5 text-sm text-[#374151] hover:text-[#111827] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
