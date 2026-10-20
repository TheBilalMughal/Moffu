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

const PROVIDER_META: Record<Provider, { name: string; docsUrl: string; defaultModel: string; modelOptions: string[] }> = {
  groq: {
    name: 'Groq',
    docsUrl: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    modelOptions: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-5-5',
    modelOptions: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  },
  gemini: {
    name: 'Google Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.0-flash',
    modelOptions: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
  },
  openai: {
    name: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    modelOptions: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  },
};

const PROVIDERS: Provider[] = ['groq', 'anthropic', 'gemini', 'openai'];

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
    const payload = { provider: form.provider, label: PROVIDER_META[form.provider].name, api_key: form.apiKey.trim(), model: form.model };
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-white">AI Provider Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage API keys for AI draft generation. Only one provider can be active at a time.</p>
      </div>

      {activeProvider && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg text-sm text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          Active: <span className="font-medium">{PROVIDER_META[activeProvider.provider].name}</span> — {activeProvider.model}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {PROVIDERS.map(provider => {
            const meta = PROVIDER_META[provider];
            const existing = settings.find(s => s.provider === provider);
            const isActive = existing?.is_active ?? false;

            return (
              <div key={provider} className={`rounded-xl border p-4 ${isActive ? 'border-emerald-600/50 bg-emerald-900/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${isActive ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                      {meta.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{meta.name}</span>
                        {isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-600/30">Active</span>}
                      </div>
                      {existing ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {showKey === existing.id
                              ? existing.api_key
                              : existing.api_key.slice(0, 8) + '••••••••••••••••••••'}
                          </span>
                          <button onClick={() => setShowKey(showKey === existing.id ? null : existing.id)} className="text-gray-600 hover:text-gray-400 ml-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showKey === existing.id ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">Not configured</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {existing && !isActive && (
                      <button
                        onClick={() => handleActivate(existing.id)}
                        disabled={activating === existing.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-700/40 disabled:opacity-50"
                      >
                        {activating === existing.id ? 'Activating...' : 'Set Active'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(existing ?? { provider } as AISetting)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                    >
                      {existing ? 'Edit' : 'Add'}
                    </button>
                    {existing && (
                      <button
                        onClick={() => handleDelete(existing.id)}
                        disabled={deleting === existing.id || isActive}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 disabled:opacity-30"
                        title={isActive ? 'Cannot delete active provider' : 'Remove'}
                      >
                        {deleting === existing.id ? '...' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>

                {existing && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-xs text-gray-500">
                    <span>Model: <span className="text-gray-400">{existing.model}</span></span>
                    <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get API key ↗</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {configuredProviders.has(form.provider) ? 'Edit' : 'Add'} {PROVIDER_META[form.provider].name}
              </h2>
              <button onClick={() => setForm(null)} className="text-gray-500 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => f && ({ ...f, apiKey: e.target.value }))}
                  placeholder="Paste your API key"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
                <a href={PROVIDER_META[form.provider].docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                  Get API key from {PROVIDER_META[form.provider].name} ↗
                </a>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Model</label>
                <select
                  value={form.model}
                  onChange={e => setForm(f => f && ({ ...f, model: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                >
                  {PROVIDER_META[form.provider].modelOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!form.apiKey.trim() || saving === form.provider}
                className="flex-1 bg-[#0D4C3C] hover:bg-[#0a3d30] text-white text-sm py-2 rounded-lg disabled:opacity-50"
              >
                {saving === form.provider ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
