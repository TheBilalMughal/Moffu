import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

const INTERVAL_OPTIONS = [
  { label: 'Every 5 minutes',  value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour',       value: '0 * * * *' },
];

export function SyncSettingsPage() {
  const toast = useToastStore();

  const [secret, setSecret]           = useState('');
  const [savedSecret, setSavedSecret] = useState('');
  const [showSecret, setShowSecret]   = useState(false);
  const [editingSecret, setEditingSecret] = useState(false);
  const [savingSecret, setSavingSecret]   = useState(false);

  const [interval, setInterval]           = useState('*/5 * * * *');
  const [savedInterval, setSavedInterval] = useState('*/5 * * * *');
  const [savingInterval, setSavingInterval] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['sync_reviews_secret', 'sync_cron_interval']);

    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

    const secretVal   = map['sync_reviews_secret'] ?? '';
    const intervalVal = map['sync_cron_interval']  ?? '*/5 * * * *';

    setSecret(secretVal);
    setSavedSecret(secretVal);
    setInterval(intervalVal);
    setSavedInterval(intervalVal);
    setLoading(false);
    if (!secretVal) setEditingSecret(true);
  }

  async function handleSaveSecret() {
    if (!secret.trim()) { toast.error('Secret cannot be empty'); return; }
    setSavingSecret(true);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'sync_reviews_secret', value: secret.trim() }, { onConflict: 'key' });
    setSavingSecret(false);
    if (error) { toast.error(error.message); return; }
    setSavedSecret(secret.trim());
    setEditingSecret(false);
    setShowSecret(false);
    toast.success('Sync secret saved.');
  }

  async function handleSaveInterval() {
    setSavingInterval(true);
    // Save to platform_settings
    const { error: settingsErr } = await supabase
      .from('platform_settings')
      .upsert({ key: 'sync_cron_interval', value: interval }, { onConflict: 'key' });
    if (settingsErr) { toast.error(settingsErr.message); setSavingInterval(false); return; }

    // Update the actual cron schedule via RPC
    const { error: rpcErr } = await supabase.rpc('update_sync_cron_schedule', { cron_expr: interval });
    setSavingInterval(false);
    if (rpcErr) { toast.error('Settings saved but cron update failed: ' + rpcErr.message); return; }

    setSavedInterval(interval);
    toast.success('Cron schedule updated.');
  }

  function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint8Array(40);
    crypto.getRandomValues(arr);
    setSecret(Array.from(arr, b => chars[b % chars.length]).join(''));
  }

  function handleCancelSecret() {
    setSecret(savedSecret);
    setEditingSecret(false);
    setShowSecret(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasSaved = !!savedSecret;
  const intervalLabel = INTERVAL_OPTIONS.find(o => o.value === savedInterval)?.label ?? savedInterval;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <SyncIcon />
            <h1 className="text-lg font-semibold text-[#111827]">Review Sync</h1>
          </div>
          <p className="text-sm text-[#9CA3AF]">Configure the automatic review sync schedule and security.</p>
        </div>

        {/* ── Cron Interval ── */}
        <section className="rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <p className="text-sm font-semibold text-[#111827]">Sync Frequency</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">How often reviews are automatically fetched from Google.</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INTERVAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setInterval(opt.value)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors text-center ${
                      interval === opt.value
                        ? 'bg-[#0D4C3C] text-white border-[#0D4C3C]'
                        : 'border-[#E5EAE8] text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {interval !== savedInterval && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleSaveInterval}
                  disabled={savingInterval}
                  className="px-4 py-1.5 bg-[#0D4C3C] text-white text-sm font-medium rounded-lg hover:bg-[#0a3d30] disabled:opacity-50 transition-colors"
                >
                  {savingInterval ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setInterval(savedInterval)}
                  className="text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {interval === savedInterval && (
              <p className="mt-2 text-xs text-[#9CA3AF]">Currently: <span className="font-medium text-[#374151]">{intervalLabel}</span></p>
            )}
          </div>
        </section>

        {/* ── Sync Secret ── */}
        <section className="rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#111827]">Sync Secret</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Authenticates the cron job when it calls the edge function.</p>
            </div>
            {hasSaved && !editingSecret && (
              <button
                onClick={() => setEditingSecret(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors"
              >
                <EditIcon /> Edit
              </button>
            )}
          </div>

          {editingSecret ? (
            <div className="px-5 py-4 space-y-3">
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Random secret key…"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] font-mono placeholder:font-sans placeholder:text-[#C4CAC8]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#374151]"
                >
                  {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button type="button" onClick={generateSecret} className="text-xs text-[#0D4C3C] hover:underline font-medium">
                Generate random secret
              </button>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveSecret}
                  disabled={savingSecret}
                  className="px-4 py-1.5 bg-[#0D4C3C] text-white text-sm font-medium rounded-lg hover:bg-[#0a3d30] disabled:opacity-50 transition-colors"
                >
                  {savingSecret ? 'Saving…' : 'Save secret'}
                </button>
                {hasSaved && (
                  <button onClick={handleCancelSecret} className="text-sm text-[#6B7280] hover:text-[#374151]">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3.5 flex items-center gap-4">
              <span className="flex-1 text-sm text-[#374151] font-mono">{'•'.repeat(24)}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(savedSecret); toast.success('Copied.'); }}
                className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                title="Copy"
              >
                <CopyIcon />
              </button>
            </div>
          )}
        </section>

        {/* How it works */}
        <div className="px-4 py-3 rounded-xl shadow-sm text-sm text-[#6B7280]">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">How it works</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>A pg_cron job fires on the chosen schedule and calls <code className="text-xs bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">google-sync-all</code></li>
            <li>It passes the sync secret in the <code className="text-xs bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">x-sync-secret</code> header</li>
            <li>The edge function verifies it, refreshes OAuth tokens if needed, and fetches reviews from Google Business Profile</li>
            <li>Changes take effect on the next cron run — no redeploy needed</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function SyncIcon() {
  return (
    <svg className="w-5 h-5 text-[#0D4C3C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
