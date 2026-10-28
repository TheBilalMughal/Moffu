import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/lib/toast';

export function SyncSettingsPage() {
  const toast = useToastStore();

  const [secret, setSecret]         = useState('');
  const [savedSecret, setSavedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'sync_reviews_secret')
      .maybeSingle();
    const val = data?.value ?? '';
    setSecret(val);
    setSavedSecret(val);
    setLoading(false);
    if (!val) setEditing(true);
  }

  async function handleSave() {
    if (!secret.trim()) { toast.error('Secret cannot be empty'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'sync_reviews_secret', value: secret.trim() }, { onConflict: 'key' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedSecret(secret.trim());
    setEditing(false);
    setShowSecret(false);
    toast.success('Sync secret saved.');
  }

  function handleCancel() {
    setSecret(savedSecret);
    setEditing(false);
    setShowSecret(false);
  }

  function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint8Array(40);
    crypto.getRandomValues(arr);
    setSecret(Array.from(arr, b => chars[b % chars.length]).join(''));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[#0D4C3C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasSaved = !!savedSecret;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <SyncIcon />
              <h1 className="text-lg font-semibold text-[#111827]">Review Sync</h1>
              {hasSaved && !editing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-[#9CA3AF]">Auto-sync secret used by the hourly cron job.</p>
          </div>
          {hasSaved && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#374151] border border-[#E5EAE8] rounded-lg hover:bg-[#F3F4F6] transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="shadow-sm rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2.5">How it works</p>
          <ol className="text-sm text-[#6B7280] space-y-1.5 list-decimal list-inside">
            <li>A pg_cron job runs every hour and calls the <code className="text-xs bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">google-sync-all</code> edge function</li>
            <li>The cron passes this secret in the <code className="text-xs bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">x-sync-secret</code> header</li>
            <li>The edge function verifies it and syncs reviews for all connected users</li>
            <li>Change the secret here and the cron picks it up automatically on the next run</li>
          </ol>
        </div>

        {editing ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <label className="text-xs font-semibold text-[#374151] uppercase tracking-wide">Sync Secret</label>
              </div>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Random secret key…"
                  className="w-full px-3 py-2.5 pr-20 text-sm border border-[#E5EAE8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D4C3C]/20 focus:border-[#0D4C3C] font-mono placeholder:font-sans placeholder:text-[#C4CAC8] transition-colors"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret(s => !s)}
                    className="p-1.5 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    title={showSecret ? 'Hide' : 'Show'}
                  >
                    {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={generateSecret}
                className="mt-2 text-xs text-[#0D4C3C] hover:underline font-medium"
              >
                Generate random secret
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-[#0D4C3C] text-white text-sm font-medium rounded-lg hover:bg-[#0a3d30] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save secret'}
              </button>
              {hasSaved && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-[#374151] hover:text-[#111827] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 flex items-center gap-4">
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide w-28 flex-shrink-0">Sync Secret</span>
              <span className="flex-1 text-sm text-[#374151] font-mono">{'•'.repeat(24)}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(savedSecret); toast.success('Copied to clipboard.'); }}
                className="p-1 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                title="Copy"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        )}

        {/* Cron info */}
        <div className="mt-6 px-4 py-3 shadow-sm rounded-xl text-sm text-[#6B7280]">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-1.5">Cron schedule</p>
          Reviews sync automatically every hour at <code className="text-xs bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">:00</code>.
          The cron reads this secret live from the database — no redeploy needed after changes.
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
